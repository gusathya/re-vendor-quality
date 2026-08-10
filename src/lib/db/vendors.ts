import type Database from 'better-sqlite3';
import { randomUUID } from 'node:crypto';

export interface Vendor {
  id: string;
  name: string;
  processName: string;
}

export function createVendor(db: Database.Database, input: { name: string; processName: string }): Vendor {
  const id = randomUUID();
  db.prepare('INSERT INTO vendors (id, name, process_name) VALUES (?, ?, ?)').run(id, input.name, input.processName);
  return { id, name: input.name, processName: input.processName };
}

export function getVendorByName(db: Database.Database, name: string): Vendor | null {
  const row = db.prepare('SELECT id, name, process_name AS processName FROM vendors WHERE name = ?').get(name) as
    | Vendor
    | undefined;
  return row ?? null;
}
