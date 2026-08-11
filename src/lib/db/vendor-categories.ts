import type Database from 'better-sqlite3';
import { randomUUID } from 'node:crypto';

export interface VendorCategory {
  id: string;
  name: string;
  slug: string;
}

export function getAllCategories(db: Database.Database): VendorCategory[] {
  return db
    .prepare('SELECT id, name, slug FROM vendor_categories ORDER BY name')
    .all() as VendorCategory[];
}

export function getCategoryBySlug(db: Database.Database, slug: string): VendorCategory | null {
  return (
    (db
      .prepare('SELECT id, name, slug FROM vendor_categories WHERE slug = ?')
      .get(slug) as VendorCategory | undefined) ?? null
  );
}

export function createCategory(
  db: Database.Database,
  input: { name: string; slug: string },
): VendorCategory {
  const id = randomUUID();
  db.prepare('INSERT INTO vendor_categories (id, name, slug) VALUES (?, ?, ?)').run(
    id,
    input.name,
    input.slug,
  );
  return { id, ...input };
}
