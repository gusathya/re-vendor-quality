import type Database from 'better-sqlite3';
import { randomUUID } from 'node:crypto';

export type UserRole = 'admin' | 'vendor';

export interface User {
  id: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  vendorId: string | null;
}

export function createUser(
  db: Database.Database,
  input: { email: string; passwordHash: string; role: UserRole; vendorId: string | null },
): User {
  const id = randomUUID();
  db.prepare('INSERT INTO users (id, email, password_hash, role, vendor_id) VALUES (?, ?, ?, ?, ?)').run(
    id, input.email, input.passwordHash, input.role, input.vendorId,
  );
  return { id, ...input };
}

export function getUserByEmail(db: Database.Database, email: string): User | null {
  const row = db
    .prepare('SELECT id, email, password_hash AS passwordHash, role, vendor_id AS vendorId FROM users WHERE email = ?')
    .get(email) as User | undefined;
  return row ?? null;
}
