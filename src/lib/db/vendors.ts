import type Database from 'better-sqlite3';
import { randomUUID } from 'node:crypto';

export interface Vendor {
  id: string;
  name: string;
  processName: string;
  categoryId: string | null;
  categoryName: string | null;
  vendorCode: string | null;
  folderUrl: string | null;
}

const SELECT_VENDOR = `
  SELECT
    v.id,
    v.name,
    v.process_name AS processName,
    v.category_id AS categoryId,
    vc.name AS categoryName,
    v.vendor_code AS vendorCode,
    v.folder_url AS folderUrl
  FROM vendors v
  LEFT JOIN vendor_categories vc ON vc.id = v.category_id
`;

export function createVendor(db: Database.Database, input: { name: string; processName: string }): Vendor {
  const id = randomUUID();
  db.prepare('INSERT INTO vendors (id, name, process_name) VALUES (?, ?, ?)').run(id, input.name, input.processName);
  return { id, name: input.name, processName: input.processName, categoryId: null, categoryName: null, vendorCode: null, folderUrl: null };
}

export function getVendorByName(db: Database.Database, name: string): Vendor | null {
  const row = db.prepare(`${SELECT_VENDOR} WHERE v.name = ?`).get(name) as Vendor | undefined;
  return row ?? null;
}

export function getVendorById(db: Database.Database, id: string): Vendor | null {
  const row = db.prepare(`${SELECT_VENDOR} WHERE v.id = ?`).get(id) as Vendor | undefined;
  return row ?? null;
}

export function getAllVendors(db: Database.Database): Vendor[] {
  return db
    .prepare(`${SELECT_VENDOR} ORDER BY vc.name NULLS LAST, v.name`)
    .all() as Vendor[];
}

export function updateVendorFolderUrl(db: Database.Database, id: string, url: string | null): void {
  db.prepare('UPDATE vendors SET folder_url = ? WHERE id = ?').run(url || null, id);
}

export function updateVendorMeta(
  db: Database.Database,
  id: string,
  fields: { categoryId?: string | null; vendorCode?: string | null; folderUrl?: string | null },
): void {
  if ('categoryId' in fields) {
    db.prepare('UPDATE vendors SET category_id = ? WHERE id = ?').run(fields.categoryId ?? null, id);
  }
  if ('vendorCode' in fields) {
    db.prepare('UPDATE vendors SET vendor_code = ? WHERE id = ?').run(fields.vendorCode?.trim() || null, id);
  }
  if ('folderUrl' in fields) {
    db.prepare('UPDATE vendors SET folder_url = ? WHERE id = ?').run(fields.folderUrl?.trim() || null, id);
  }
}
