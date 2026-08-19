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

  // Additive column migrations — SQLite throws on duplicate ADD COLUMN, so we suppress that.
  try { db.exec('ALTER TABLE vendors ADD COLUMN folder_url TEXT'); } catch {}
  try { db.exec('ALTER TABLE vendors ADD COLUMN category_id TEXT REFERENCES vendor_categories(id)'); } catch {}
  try { db.exec('ALTER TABLE vendors ADD COLUMN vendor_code TEXT'); } catch {}

  // Migrate users table to support the 'customer' role.
  // SQLite CHECK constraints can't be altered in place, so we recreate the table when needed.
  const userSql = (db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='users'").get() as { sql: string } | undefined)?.sql ?? '';
  if (!userSql.includes("'customer'")) {
    db.pragma('foreign_keys = OFF');
    db.exec(`
      CREATE TABLE users_new (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL CHECK (role IN ('admin', 'vendor', 'customer')),
        vendor_id TEXT REFERENCES vendors(id),
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      INSERT INTO users_new SELECT * FROM users;
      DROP TABLE users;
      ALTER TABLE users_new RENAME TO users;
    `);
    db.pragma('foreign_keys = ON');
  }

  // Push/approval columns on load_reports.
  try { db.exec("ALTER TABLE load_reports ADD COLUMN push_status TEXT NOT NULL DEFAULT 'draft'"); } catch {}
  try { db.exec('ALTER TABLE load_reports ADD COLUMN pushed_at TEXT'); } catch {}
  try { db.exec('ALTER TABLE load_reports ADD COLUMN reviewed_at TEXT'); } catch {}
  try { db.exec('ALTER TABLE load_reports ADD COLUMN reviewed_by TEXT'); } catch {}
  try { db.exec('ALTER TABLE load_reports ADD COLUMN review_note TEXT'); } catch {}

  // Customer-editable SOP row ordering.
  try { db.exec('ALTER TABLE sop_parameters ADD COLUMN display_order INTEGER NOT NULL DEFAULT 0'); } catch {}

  // Vendor submission note (mandatory comment when submitting a batch to RE).
  try { db.exec('ALTER TABLE load_reports ADD COLUMN push_note TEXT'); } catch {}

  // Audit trail for batch lifecycle events.
  db.exec(`
    CREATE TABLE IF NOT EXISTS batch_events (
      id            TEXT PRIMARY KEY,
      load_report_id TEXT NOT NULL REFERENCES load_reports(id) ON DELETE CASCADE,
      event_type    TEXT NOT NULL,
      actor_email   TEXT,
      note          TEXT,
      created_at    TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

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
