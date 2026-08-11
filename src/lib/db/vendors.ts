import type Database from 'better-sqlite3';
import { randomUUID } from 'node:crypto';

export interface Vendor {
  id: string;
  name: string;
  processName: string;
  folderUrl: string | null;
}

export function createVendor(db: Database.Database, input: { name: string; processName: string }): Vendor {
  const id = randomUUID();
  db.prepare('INSERT INTO vendors (id, name, process_name) VALUES (?, ?, ?)').run(id, input.name, input.processName);
  return { id, name: input.name, processName: input.processName, folderUrl: null };
}

export function getVendorByName(db: Database.Database, name: string): Vendor | null {
  const row = db.prepare('SELECT id, name, process_name AS processName, folder_url AS folderUrl FROM vendors WHERE name = ?').get(name) as Vendor | undefined;
  return row ?? null;
}

export function getVendorById(db: Database.Database, id: string): Vendor | null {
  const row = db.prepare('SELECT id, name, process_name AS processName, folder_url AS folderUrl FROM vendors WHERE id = ?').get(id) as Vendor | undefined;
  return row ?? null;
}

export function getAllVendors(db: Database.Database): Vendor[] {
  return db.prepare('SELECT id, name, process_name AS processName, folder_url AS folderUrl FROM vendors ORDER BY name').all() as Vendor[];
}

export function updateVendorFolderUrl(db: Database.Database, id: string, url: string | null): void {
  db.prepare('UPDATE vendors SET folder_url = ? WHERE id = ?').run(url || null, id);
}
