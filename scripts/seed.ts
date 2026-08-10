import { getDb } from '../src/lib/db/client';
import { seed } from '../src/lib/seed';

seed(getDb()).then(({ vendor, stationAliasCount }) => {
  console.log(
    `Seeded vendor ${vendor.name} (${vendor.id}) and demo users. Seeded ${stationAliasCount} station aliases.`,
  );
  process.exit(0);
});
