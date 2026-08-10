// src/lib/db/client.ts
import Database from 'better-sqlite3';
import { readFileSync } from 'node:fs';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

// Resolved relative to process.cwd() (repo root) rather than __dirname, because this
// app runs as a long-lived Node process launched from the repo root (`next start` or a
// Docker container built from the repo root) — not as a serverless function where cwd
// could be ambiguous. Once Next.js bundles this module, __dirname points at the compiled
// output under .next/server/..., not the src/ tree, so schema.sql would not be found there.
const SCHEMA_PATH = path.join(process.cwd(), 'src/lib/db/schema.sql');

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
