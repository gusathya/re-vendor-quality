import type Database from 'better-sqlite3';
import { randomUUID } from 'node:crypto';
import type { LimitStatus } from '../parsers/sop-limit-parser';

export interface SopDocument {
  id: string;
  vendorId: string;
  filePath: string;
  status: 'draft' | 'active' | 'superseded';
}

export interface SopParameterInput {
  stationGroupKey: string;
  srNo: string;
  stationNo: string | null;
  process: string;
  productChemical: string | null;
  characteristic: string | null;
  minValue: number | null;
  maxValue: number | null;
  unit: string | null;
  status: LimitStatus;
  rawControlLimit: string | null;
  rawSpecLimit: string | null;
}

export interface SopParameter extends SopParameterInput {
  id: string;
  sopDocumentId: string;
}

export function createDraftSopDocument(
  db: Database.Database,
  input: { vendorId: string; filePath: string; uploadedBy: string },
): SopDocument {
  const id = randomUUID();
  db.prepare('INSERT INTO sop_documents (id, vendor_id, file_path, status, uploaded_by) VALUES (?, ?, ?, ?, ?)').run(
    id, input.vendorId, input.filePath, 'draft', input.uploadedBy,
  );
  return { id, vendorId: input.vendorId, filePath: input.filePath, status: 'draft' };
}

export function insertSopParameters(
  db: Database.Database,
  sopDocumentId: string,
  params: SopParameterInput[],
): SopParameter[] {
  const insert = db.prepare(`
    INSERT INTO sop_parameters
      (id, sop_document_id, station_group_key, sr_no, station_no, process, product_chemical,
       characteristic, min_value, max_value, unit, status, raw_control_limit, raw_spec_limit)
    VALUES (@id, @sopDocumentId, @stationGroupKey, @srNo, @stationNo, @process, @productChemical,
            @characteristic, @minValue, @maxValue, @unit, @status, @rawControlLimit, @rawSpecLimit)
  `);
  const inserted: SopParameter[] = [];
  const runAll = db.transaction((rows: SopParameterInput[]) => {
    for (const row of rows) {
      const id = randomUUID();
      insert.run({ id, sopDocumentId, ...row });
      inserted.push({ id, sopDocumentId, ...row });
    }
  });
  runAll(params);
  return inserted;
}

export function getSopParameterById(db: Database.Database, id: string): SopParameter | null {
  const row = db
    .prepare(
      `SELECT id, sop_document_id AS sopDocumentId, station_group_key AS stationGroupKey, sr_no AS srNo,
              station_no AS stationNo, process, product_chemical AS productChemical, characteristic,
              min_value AS minValue, max_value AS maxValue, unit, status,
              raw_control_limit AS rawControlLimit, raw_spec_limit AS rawSpecLimit
       FROM sop_parameters WHERE id = ?`,
    )
    .get(id) as SopParameter | undefined;
  return row ?? null;
}

export function getSopParameterForVendor(db: Database.Database, id: string, vendorId: string): SopParameter | null {
  const row = db
    .prepare(
      `SELECT p.id, p.sop_document_id AS sopDocumentId, p.station_group_key AS stationGroupKey, p.sr_no AS srNo,
              p.station_no AS stationNo, p.process, p.product_chemical AS productChemical, p.characteristic,
              p.min_value AS minValue, p.max_value AS maxValue, p.unit, p.status,
              p.raw_control_limit AS rawControlLimit, p.raw_spec_limit AS rawSpecLimit
       FROM sop_parameters p
       JOIN sop_documents d ON d.id = p.sop_document_id
       WHERE p.id = ? AND d.vendor_id = ?`,
    )
    .get(id, vendorId) as SopParameter | undefined;
  return row ?? null;
}

export function getSopParametersByDocument(db: Database.Database, sopDocumentId: string): SopParameter[] {
  return db
    .prepare(
      `SELECT id, sop_document_id AS sopDocumentId, station_group_key AS stationGroupKey, sr_no AS srNo,
              station_no AS stationNo, process, product_chemical AS productChemical, characteristic,
              min_value AS minValue, max_value AS maxValue, unit, status,
              raw_control_limit AS rawControlLimit, raw_spec_limit AS rawSpecLimit
       FROM sop_parameters WHERE sop_document_id = ?
       ORDER BY display_order, sr_no`,
    )
    .all(sopDocumentId) as SopParameter[];
}

export function insertBlankSopParameter(db: Database.Database, sopDocumentId: string): SopParameter {
  const id = randomUUID();
  const maxRow = db
    .prepare('SELECT COALESCE(MAX(display_order), -1) AS m FROM sop_parameters WHERE sop_document_id = ?')
    .get(sopDocumentId) as { m: number };
  db.prepare(
    `INSERT INTO sop_parameters
       (id, sop_document_id, station_group_key, sr_no, process, status, display_order)
     VALUES (?, ?, '', 'NEW', '', 'parsed', ?)`,
  ).run(id, sopDocumentId, maxRow.m + 1);
  return {
    id, sopDocumentId,
    stationGroupKey: '', srNo: 'NEW', stationNo: null,
    process: '', productChemical: null, characteristic: null,
    minValue: null, maxValue: null, unit: null,
    status: 'parsed', rawControlLimit: null, rawSpecLimit: null,
  };
}

export function deleteSopParameterById(db: Database.Database, parameterId: string): void {
  db.prepare('DELETE FROM sop_parameters WHERE id = ?').run(parameterId);
}

export function setSopParameterOrder(db: Database.Database, orderedIds: string[]): void {
  const update = db.prepare('UPDATE sop_parameters SET display_order = ? WHERE id = ?');
  db.transaction(() => { orderedIds.forEach((id, i) => update.run(i, id)); })();
}

export function updateSopParameterLimits(
  db: Database.Database,
  id: string,
  minValue: number | null,
  maxValue: number | null,
  unit: string | null,
): void {
  const effectiveMin = minValue === null || Number.isNaN(minValue) ? null : minValue;
  const effectiveMax = maxValue === null || Number.isNaN(maxValue) ? null : maxValue;
  const status: LimitStatus = effectiveMin === null && effectiveMax === null ? 'no_limit' : 'parsed';
  db.prepare('UPDATE sop_parameters SET min_value = ?, max_value = ?, unit = ?, status = ? WHERE id = ?').run(
    effectiveMin, effectiveMax, unit, status, id,
  );
}

export function activateSopDocument(db: Database.Database, sopDocumentId: string, vendorId: string): void {
  const run = db.transaction(() => {
    db.prepare(
      "UPDATE sop_documents SET status = 'superseded' WHERE vendor_id = ? AND status = 'active'",
    ).run(vendorId);
    const result = db
      .prepare(
        "UPDATE sop_documents SET status = 'active', activated_at = datetime('now') WHERE id = ? AND vendor_id = ?",
      )
      .run(sopDocumentId, vendorId);
    if (result.changes === 0) {
      throw new Error(`Cannot activate SOP document ${sopDocumentId}: it does not belong to vendor ${vendorId}`);
    }
  });
  run();
}

export function getActiveSopParameters(db: Database.Database, vendorId: string): SopParameter[] {
  return db
    .prepare(
      `SELECT p.id, p.sop_document_id AS sopDocumentId, p.station_group_key AS stationGroupKey, p.sr_no AS srNo,
              p.station_no AS stationNo, p.process, p.product_chemical AS productChemical, p.characteristic,
              p.min_value AS minValue, p.max_value AS maxValue, p.unit, p.status,
              p.raw_control_limit AS rawControlLimit, p.raw_spec_limit AS rawSpecLimit
       FROM sop_parameters p
       JOIN sop_documents d ON d.id = p.sop_document_id
       WHERE d.vendor_id = ? AND d.status = 'active'`,
    )
    .all(vendorId) as SopParameter[];
}
