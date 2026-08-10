// src/lib/db/client.test.ts
import { describe, it, expect, afterEach } from 'vitest';
import { unlinkSync, existsSync } from 'node:fs';
import { createDb } from './client';

const TEST_DB_PATH = './data/test-client.sqlite';

afterEach(() => {
  if (existsSync(TEST_DB_PATH)) unlinkSync(TEST_DB_PATH);
});

describe('createDb', () => {
  it('creates all expected tables from schema.sql', () => {
    const db = createDb(TEST_DB_PATH);
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
      .all() as { name: string }[];
    const tableNames = tables.map((row) => row.name);

    expect(tableNames).toEqual([
      'dashboard_prefs', 'load_readings', 'load_reports', 'manual_checks',
      'sop_documents', 'sop_parameters', 'station_aliases', 'users', 'vendors',
    ]);
    db.close();
  });

  it('enforces the role check constraint on users', () => {
    const db = createDb(TEST_DB_PATH);
    expect(() =>
      db
        .prepare('INSERT INTO users (id, email, password_hash, role) VALUES (?, ?, ?, ?)')
        .run('u1', 'x@example.com', 'hash', 'not-a-real-role'),
    ).toThrow();
    db.close();
  });
});
