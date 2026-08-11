import type Database from 'better-sqlite3';

export interface AdminKpis {
  vendorCount: number;
  totalReadings: number;
  totalPasses: number;
  totalFails: number;
  passRate: number;
  loadCount: number;
}

export function getAdminKpis(db: Database.Database): AdminKpis {
  const row = db
    .prepare(
      `SELECT
         COUNT(DISTINCT lr.vendor_id) AS vendorCount,
         COUNT(r.id)                  AS totalReadings,
         SUM(CASE WHEN r.score = 'pass' THEN 1 ELSE 0 END) AS totalPasses,
         SUM(CASE WHEN r.score = 'fail' THEN 1 ELSE 0 END) AS totalFails,
         COUNT(DISTINCT lr.id)        AS loadCount
       FROM load_reports lr
       JOIN load_readings r ON r.load_report_id = lr.id
       WHERE r.score != 'unscored'`,
    )
    .get() as {
      vendorCount: number;
      totalReadings: number;
      totalPasses: number | null;
      totalFails: number | null;
      loadCount: number;
    };

  const passes = row.totalPasses ?? 0;
  const fails = row.totalFails ?? 0;
  const total = row.totalReadings;
  return {
    vendorCount: row.vendorCount,
    totalReadings: total,
    totalPasses: passes,
    totalFails: fails,
    passRate: total > 0 ? passes / total : 0,
    loadCount: row.loadCount,
  };
}

export interface VendorStat {
  vendorId: string;
  vendorName: string;
  processName: string;
  totalReadings: number;
  passes: number;
  fails: number;
  passRate: number;
  loadCount: number;
  lastUploadAt: string | null;
}

export function getVendorStats(db: Database.Database): VendorStat[] {
  const rows = db
    .prepare(
      `SELECT
         v.id            AS vendorId,
         v.name          AS vendorName,
         v.process_name  AS processName,
         COUNT(r.id)     AS totalReadings,
         SUM(CASE WHEN r.score = 'pass' THEN 1 ELSE 0 END) AS passes,
         SUM(CASE WHEN r.score = 'fail' THEN 1 ELSE 0 END) AS fails,
         COUNT(DISTINCT lr.id) AS loadCount,
         MAX(lr.uploaded_at)   AS lastUploadAt
       FROM vendors v
       LEFT JOIN load_reports lr ON lr.vendor_id = v.id
       LEFT JOIN load_readings r ON r.load_report_id = lr.id AND r.score != 'unscored'
       GROUP BY v.id
       ORDER BY v.name`,
    )
    .all() as (Omit<VendorStat, 'passRate'> & { passes: number | null; fails: number | null })[];

  return rows.map((r) => {
    const passes = r.passes ?? 0;
    const fails = r.fails ?? 0;
    const total = r.totalReadings;
    return { ...r, passes, fails, passRate: total > 0 ? passes / total : 0 };
  });
}

export interface CrossVendorStationRow {
  stationName: string;
  vendorName: string;
  failCount: number;
}

export function getCrossVendorStationFailures(db: Database.Database): CrossVendorStationRow[] {
  return db
    .prepare(
      `SELECT r.station_name AS stationName, v.name AS vendorName, COUNT(*) AS failCount
       FROM load_readings r
       JOIN load_reports lr ON lr.id = r.load_report_id
       JOIN vendors v ON v.id = lr.vendor_id
       WHERE r.score = 'fail'
       GROUP BY r.station_name, v.id
       ORDER BY failCount DESC
       LIMIT 25`,
    )
    .all() as CrossVendorStationRow[];
}

export interface CrossVendorParamRow {
  parameterName: string;
  vendorName: string;
  failCount: number;
}

export function getCrossVendorParameterFailures(db: Database.Database): CrossVendorParamRow[] {
  return db
    .prepare(
      `SELECT r.parameter_name AS parameterName, v.name AS vendorName, COUNT(*) AS failCount
       FROM load_readings r
       JOIN load_reports lr ON lr.id = r.load_report_id
       JOIN vendors v ON v.id = lr.vendor_id
       WHERE r.score = 'fail'
       GROUP BY r.parameter_name, v.id
       ORDER BY failCount DESC
       LIMIT 25`,
    )
    .all() as CrossVendorParamRow[];
}

export interface AdminTimelinePoint {
  loadNumber: string;
  vendorName: string;
  uploadedAt: string;
  passes: number;
  fails: number;
}

export function getAdminTimeline(db: Database.Database): AdminTimelinePoint[] {
  return db
    .prepare(
      `SELECT
         lr.load_number  AS loadNumber,
         v.name          AS vendorName,
         lr.uploaded_at  AS uploadedAt,
         SUM(CASE WHEN r.score = 'pass' THEN 1 ELSE 0 END) AS passes,
         SUM(CASE WHEN r.score = 'fail' THEN 1 ELSE 0 END) AS fails
       FROM load_reports lr
       JOIN vendors v ON v.id = lr.vendor_id
       JOIN load_readings r ON r.load_report_id = lr.id
       WHERE r.score != 'unscored'
       GROUP BY lr.id
       ORDER BY lr.uploaded_at ASC`,
    )
    .all() as AdminTimelinePoint[];
}

export interface VendorStationCell {
  stationName: string;
  vendorName: string;
  passes: number;
  total: number;
}

export function getVendorStationHeatmap(db: Database.Database): VendorStationCell[] {
  return db
    .prepare(
      `SELECT
         r.station_name AS stationName,
         v.name         AS vendorName,
         SUM(CASE WHEN r.score = 'pass' THEN 1 ELSE 0 END) AS passes,
         COUNT(*) AS total
       FROM load_readings r
       JOIN load_reports lr ON lr.id = r.load_report_id
       JOIN vendors v ON v.id = lr.vendor_id
       WHERE r.score != 'unscored'
       GROUP BY r.station_name, v.id
       ORDER BY r.station_name, v.name`,
    )
    .all() as VendorStationCell[];
}
