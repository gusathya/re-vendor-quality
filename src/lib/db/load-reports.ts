import type Database from 'better-sqlite3';
import { randomUUID } from 'node:crypto';
import type { ScoreResult } from '../scoring';

export interface LoadReport {
  id: string;
  vendorId: string;
  loadNumber: string;
}

export interface LoadReadingInput {
  sopParameterId: string | null;
  stationNo: number;
  stationName: string;
  parameterName: string;
  value: number | null;
  dipTimeSeconds: number | null;
  score: ScoreResult;
}

export interface LoadReading extends LoadReadingInput {
  id: string;
  loadReportId: string;
}

export function loadNumberExists(db: Database.Database, vendorId: string, loadNumber: string): boolean {
  const row = db
    .prepare('SELECT 1 FROM load_reports WHERE vendor_id = ? AND load_number = ?')
    .get(vendorId, loadNumber);
  return row !== undefined;
}

export function createLoadReport(
  db: Database.Database,
  input: {
    vendorId: string; loadNumber: string; filePath: string; partNumber: string; totalWeightKg: number;
    loadInTime: string; loadOutTime: string; totalTimeSeconds: number; uploadedBy: string;
  },
): LoadReport {
  const id = randomUUID();
  db.prepare(`
    INSERT INTO load_reports
      (id, vendor_id, load_number, file_path, part_number, total_weight_kg,
       load_in_time, load_out_time, total_time_seconds, uploaded_by)
    VALUES (@id, @vendorId, @loadNumber, @filePath, @partNumber, @totalWeightKg,
            @loadInTime, @loadOutTime, @totalTimeSeconds, @uploadedBy)
  `).run({ id, ...input });
  return { id, vendorId: input.vendorId, loadNumber: input.loadNumber };
}

export function insertLoadReadings(
  db: Database.Database,
  loadReportId: string,
  readings: LoadReadingInput[],
): LoadReading[] {
  const insert = db.prepare(`
    INSERT INTO load_readings
      (id, load_report_id, sop_parameter_id, station_no, station_name, parameter_name, value, dip_time_seconds, score)
    VALUES (@id, @loadReportId, @sopParameterId, @stationNo, @stationName, @parameterName, @value, @dipTimeSeconds, @score)
  `);
  const inserted: LoadReading[] = [];
  const runAll = db.transaction((rows: LoadReadingInput[]) => {
    for (const row of rows) {
      const id = randomUUID();
      insert.run({ id, loadReportId, ...row });
      inserted.push({ id, loadReportId, ...row });
    }
  });
  runAll(readings);
  return inserted;
}

export function getLoadReadingsForReport(db: Database.Database, loadReportId: string): LoadReading[] {
  return db
    .prepare(
      `SELECT id, load_report_id AS loadReportId, sop_parameter_id AS sopParameterId, station_no AS stationNo,
              station_name AS stationName, parameter_name AS parameterName, value, dip_time_seconds AS dipTimeSeconds, score
       FROM load_readings WHERE load_report_id = ?`,
    )
    .all(loadReportId) as LoadReading[];
}
