// src/lib/seed.ts
import bcrypt from 'bcryptjs';
import type Database from 'better-sqlite3';
import { createVendor, getVendorByName, type Vendor } from './db/vendors';
import { createUser, getUserByEmail } from './db/users';
import { createStationAlias } from './db/station-aliases';
import { KNOWN_UNIQUE_PLATERS_ALIASES } from './known-station-aliases';

export interface SeedResult {
  vendor: Vendor;
  stationAliasCount: number;
}

export async function seed(db: Database.Database): Promise<SeedResult> {
  let vendor = getVendorByName(db, 'Unique Platers');
  if (!vendor) {
    vendor = createVendor(db, { name: 'Unique Platers', processName: 'Alkaline Zinc Iron Plating (Barrel)' });
  }

  if (!getUserByEmail(db, 'admin@leadership-fractal.local')) {
    createUser(db, {
      email: 'admin@leadership-fractal.local',
      passwordHash: await bcrypt.hash('Admin@123', 10),
      role: 'admin',
      vendorId: null,
    });
  }

  if (!getUserByEmail(db, 'vendor@unique-platers.local')) {
    createUser(db, {
      email: 'vendor@unique-platers.local',
      passwordHash: await bcrypt.hash('Vendor@123', 10),
      role: 'vendor',
      vendorId: vendor.id,
    });
  }

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
