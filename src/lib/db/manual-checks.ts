import type Database from 'better-sqlite3';
import { randomUUID } from 'node:crypto';

export interface ManualCheckInput {
  vendorId: string;
  sopParameterId: string;
  value: number;
  checkedAt: string;
  enteredBy: string;
  score: 'pass' | 'fail';
}

export interface ManualCheck extends ManualCheckInput {
  id: string;
}

export function createManualCheck(db: Database.Database, input: ManualCheckInput): ManualCheck {
  const id = randomUUID();
  db.prepare(`
    INSERT INTO manual_checks (id, vendor_id, sop_parameter_id, value, checked_at, entered_by, score)
    VALUES (@id, @vendorId, @sopParameterId, @value, @checkedAt, @enteredBy, @score)
  `).run({ id, ...input });
  return { id, ...input };
}

export function getManualChecksForVendor(db: Database.Database, vendorId: string): ManualCheck[] {
  return db
    .prepare(
      `SELECT id, vendor_id AS vendorId, sop_parameter_id AS sopParameterId, value,
              checked_at AS checkedAt, entered_by AS enteredBy, score
       FROM manual_checks WHERE vendor_id = ? ORDER BY checked_at`,
    )
    .all(vendorId) as ManualCheck[];
}
