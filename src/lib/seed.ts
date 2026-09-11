// src/lib/seed.ts
import type Database from 'better-sqlite3';
import { createVendor, getVendorByName, updateVendorMeta, type Vendor } from './db/vendors';
import { createStationAlias } from './db/station-aliases';
import { createCategory, getCategoryBySlug } from './db/vendor-categories';
import { KNOWN_UNIQUE_PLATERS_ALIASES } from './known-station-aliases';
import { ensureDemoUsers } from './demo-users';

export interface SeedResult {
  vendor: Vendor;
  stationAliasCount: number;
}

const CATEGORIES = [
  { name: 'Sheet Metal & Fabrication', slug: 'sheet-metal-fabrication' },
  { name: 'Casting & Machining', slug: 'casting-machining' },
  { name: 'Forging & Machining', slug: 'forging-machining' },
  { name: 'Non-Metallic', slug: 'non-metallic' },
  { name: 'Mechanical Proprietary', slug: 'mechanical-proprietary' },
  { name: 'Electrical Proprietary', slug: 'electrical-proprietary' },
];

export async function seed(db: Database.Database): Promise<SeedResult> {
  // Seed commodity categories (idempotent via slug check)
  for (const cat of CATEGORIES) {
    if (!getCategoryBySlug(db, cat.slug)) {
      createCategory(db, cat);
    }
  }

  // Seed vendor
  let vendor = getVendorByName(db, 'Unique Platers');
  if (!vendor) {
    vendor = createVendor(db, { name: 'Unique Platers', processName: 'Alkaline Zinc Iron Plating (Barrel)' });
  }

  // Assign category and vendor code if not already set
  if (!vendor.vendorCode) {
    const nonMetallicCat = getCategoryBySlug(db, 'non-metallic');
    updateVendorMeta(db, vendor.id, {
      categoryId: nonMetallicCat?.id ?? null,
      vendorCode: 'UP-001',
    });
    // Refresh after update
    vendor = getVendorByName(db, 'Unique Platers')!;
  }

  ensureDemoUsers(db);

  // KNOWN_UNIQUE_PLATERS_ALIASES uses a placeholder vendorId ('unique-platers') because the
  // real vendor id doesn't exist until seed time — substitute the real one here rather than
  // inserting the placeholder verbatim. createStationAlias is idempotent (see station-aliases.ts)
  // so re-running the seed script doesn't hit the (vendor_id, load_report_station_name) UNIQUE
  // constraint.
  let stationAliasCount = 0;
  for (const alias of KNOWN_UNIQUE_PLATERS_ALIASES) {
    createStationAlias(db, {
      vendorId: vendor.id,
      stationGroupKey: alias.stationGroupKey,
      loadReportStationName: alias.loadReportStationName,
    });
    stationAliasCount += 1;
  }

  return { vendor, stationAliasCount };
}
