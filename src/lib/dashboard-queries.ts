// src/lib/dashboard-queries.ts
import type Database from 'better-sqlite3';

export interface DashboardFilters {
  from?: string;
  to?: string;
  parameterName?: string;
  result?: 'pass' | 'fail';
}

export interface Kpis {
  totalReadings: number;
  passRate: number;
  outOfLimitCount: number;
}

interface ReadingRow {
  id: string;
  stationName: string;
  parameterName: string;
  value: number | null;
  score: string;
  loadNumber: string;
  uploadedAt: string;
}

function whereClause(vendorId: string, filters: DashboardFilters): { sql: string; args: unknown[] } {
  const conditions = ['lr.vendor_id = ?', "r.score != 'unscored'"];
  const args: unknown[] = [vendorId];

  if (filters.parameterName) {
    conditions.push('r.parameter_name = ?');
    args.push(filters.parameterName);
  }
  if (filters.result) {
    conditions.push('r.score = ?');
    args.push(filters.result);
  }
  if (filters.from) {
    conditions.push('lr.uploaded_at >= ?');
    args.push(filters.from);
  }
  if (filters.to) {
    conditions.push('lr.uploaded_at <= ?');
    args.push(filters.to);
  }

  return { sql: conditions.join(' AND '), args };
}

export function getKpis(db: Database.Database, vendorId: string, filters: DashboardFilters): Kpis {
  const { sql, args } = whereClause(vendorId, filters);
  const row = db
    .prepare(
      `SELECT COUNT(*) AS total, SUM(CASE WHEN r.score = 'pass' THEN 1 ELSE 0 END) AS passes,
              SUM(CASE WHEN r.score = 'fail' THEN 1 ELSE 0 END) AS fails
       FROM load_readings r JOIN load_reports lr ON lr.id = r.load_report_id
       WHERE ${sql}`,
    )
    .get(...args) as { total: number; passes: number | null; fails: number | null };

  const passes = row.passes ?? 0;
  const fails = row.fails ?? 0;

  return {
    totalReadings: row.total,
    passRate: row.total > 0 ? passes / row.total : 0,
    outOfLimitCount: fails,
  };
}

export function getFilteredReadings(db: Database.Database, vendorId: string, filters: DashboardFilters): ReadingRow[] {
  const { sql, args } = whereClause(vendorId, filters);
  return db
    .prepare(
      `SELECT r.id, r.station_name AS stationName, r.parameter_name AS parameterName, r.value, r.score,
              lr.load_number AS loadNumber, lr.uploaded_at AS uploadedAt
       FROM load_readings r JOIN load_reports lr ON lr.id = r.load_report_id
       WHERE ${sql} ORDER BY lr.uploaded_at DESC`,
    )
    .all(...args) as ReadingRow[];
}

export interface TrendPoint {
  loadNumber: string;
  uploadedAt: string;
  value: number | null;
  score: string;
}

export function getParameterTrend(db: Database.Database, vendorId: string, parameterName: string): TrendPoint[] {
  return db
    .prepare(
      `SELECT lr.load_number AS loadNumber, lr.uploaded_at AS uploadedAt, r.value, r.score
       FROM load_readings r JOIN load_reports lr ON lr.id = r.load_report_id
       WHERE lr.vendor_id = ? AND r.parameter_name = ? AND r.score != 'unscored'
       ORDER BY lr.uploaded_at ASC`,
    )
    .all(vendorId, parameterName) as TrendPoint[];
}

export interface HotspotRow {
  failCount: number;
}

export function getStationHotspots(db: Database.Database, vendorId: string): (HotspotRow & { stationName: string })[] {
  return db
    .prepare(
      `SELECT r.station_name AS stationName, COUNT(*) AS failCount
       FROM load_readings r JOIN load_reports lr ON lr.id = r.load_report_id
       WHERE lr.vendor_id = ? AND r.score = 'fail'
       GROUP BY r.station_name ORDER BY failCount DESC`,
    )
    .all(vendorId) as (HotspotRow & { stationName: string })[];
}

export function getParameterHotspots(db: Database.Database, vendorId: string): (HotspotRow & { parameterName: string })[] {
  return db
    .prepare(
      `SELECT r.parameter_name AS parameterName, COUNT(*) AS failCount
       FROM load_readings r JOIN load_reports lr ON lr.id = r.load_report_id
       WHERE lr.vendor_id = ? AND r.score = 'fail'
       GROUP BY r.parameter_name ORDER BY failCount DESC`,
    )
    .all(vendorId) as (HotspotRow & { parameterName: string })[];
}
