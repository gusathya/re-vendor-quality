// src/lib/db/client.ts
import Database from 'better-sqlite3';
import { readFileSync } from 'node:fs';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

const SCHEMA_PATH = path.resolve(__dirname, 'schema.sql');

export function createDb(filePath: string): Database.Database {
  mkdirSync(path.dirname(filePath), { recursive: true });
  const db = new Database(filePath);
  db.pragma('foreign_keys = ON');
  db.exec(readFileSync(SCHEMA_PATH, 'utf-8'));
  return db;
}

let singleton: Database.Database | null = null;

/** App-wide singleton connection, pointed at DATABASE_PATH (defaults to ./data/vendor-quality.sqlite). */
export function getDb(): Database.Database {
  if (!singleton) {
    const filePath = process.env.DATABASE_PATH ?? './data/vendor-quality.sqlite';
    singleton = createDb(filePath);
  }
  return singleton;
}
