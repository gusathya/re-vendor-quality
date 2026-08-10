import type Database from 'better-sqlite3';
import { randomUUID } from 'node:crypto';

export interface StationAliasRecord {
  id: string;
  vendorId: string;
  stationGroupKey: string;
  loadReportStationName: string;
}

/**
 * Idempotent insert: `station_aliases` has a UNIQUE (vendor_id, load_report_station_name)
 * constraint, and the seed script re-runs this on every invocation, so re-inserting the
 * same vendor+name pair must be a safe no-op rather than a thrown constraint error.
 */
export function createStationAlias(
  db: Database.Database,
  input: { vendorId: string; stationGroupKey: string; loadReportStationName: string },
): StationAliasRecord {
  const existing = getStationAlias(db, input.vendorId, input.loadReportStationName);
  if (existing) return existing;

  const id = randomUUID();
  db.prepare(
    'INSERT INTO station_aliases (id, vendor_id, station_group_key, load_report_station_name) VALUES (?, ?, ?, ?)',
  ).run(id, input.vendorId, input.stationGroupKey, input.loadReportStationName);
  return { id, ...input };
}

export function getStationAlias(
  db: Database.Database,
  vendorId: string,
  loadReportStationName: string,
): StationAliasRecord | null {
  const row = db
    .prepare(
      'SELECT id, vendor_id AS vendorId, station_group_key AS stationGroupKey, load_report_station_name AS loadReportStationName ' +
        'FROM station_aliases WHERE vendor_id = ? AND load_report_station_name = ?',
    )
    .get(vendorId, loadReportStationName) as StationAliasRecord | undefined;
  return row ?? null;
}

export function getStationAliasesForVendor(db: Database.Database, vendorId: string): StationAliasRecord[] {
  return db
    .prepare(
      'SELECT id, vendor_id AS vendorId, station_group_key AS stationGroupKey, load_report_station_name AS loadReportStationName ' +
        'FROM station_aliases WHERE vendor_id = ?',
    )
    .all(vendorId) as StationAliasRecord[];
}
