import { getDb } from '@/lib/db/client';
import { getFilteredReadings, type DashboardFilters } from '@/lib/dashboard-queries';
import { requireVendorSession } from '@/lib/require-vendor-session';
import { DashboardShell } from '@/components/DashboardShell';
import { FilterBar } from '@/components/FilterBar';

// Next.js 16 passes searchParams as a Promise to Server Components (same as `params`,
// see src/app/sops/[id]/page.tsx), so it must be awaited before use.
export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const vendorSession = await requireVendorSession();
  if (!vendorSession) return <main className="section">Sign in as a vendor user to see the dashboard.</main>;

  const resolvedSearchParams = await searchParams;
  const resultParam = resolvedSearchParams.result;
  const parameterNameParam = resolvedSearchParams.parameterName;

  const filters: DashboardFilters = {
    result: resultParam === 'pass' || resultParam === 'fail' ? resultParam : undefined,
    parameterName: typeof parameterNameParam === 'string' && parameterNameParam ? parameterNameParam : undefined,
  };

  const db = getDb();
  const readings = getFilteredReadings(db, vendorSession.vendorId, filters);

  return (
    <DashboardShell vendorId={vendorSession.vendorId} filters={filters}>
      <FilterBar />
      <table>
        <thead><tr><th>Load</th><th>Station</th><th>Parameter</th><th>Value</th><th>Score</th></tr></thead>
        <tbody>
          {readings.map((r) => (
            <tr key={r.id} className={r.score === 'fail' ? 'out-of-limit' : ''}>
              <td>{r.loadNumber}</td><td>{r.stationName}</td><td>{r.parameterName}</td><td>{r.value}</td><td>{r.score}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </DashboardShell>
  );
}
