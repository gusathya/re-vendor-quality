import { getDb } from '@/lib/db/client';
import { listLoadNumbers, getLoadReadingsByLoadNumber } from '@/lib/dashboard-queries';
import { requireVendorSession } from '@/lib/require-vendor-session';
import { DashboardShell } from '@/components/DashboardShell';

// Next.js 16 passes searchParams as a Promise to Server Components (same as `params`,
// see src/app/sops/[id]/page.tsx and the Table/Trends pages), so it must be awaited before use.
export default async function ComparePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const vendorSession = await requireVendorSession();
  if (!vendorSession) return <main className="section">Sign in as a vendor user to see the dashboard.</main>;

  const resolvedSearchParams = await searchParams;
  const aParam = resolvedSearchParams.a;
  const bParam = resolvedSearchParams.b;

  const db = getDb();
  const loadNumbers = listLoadNumbers(db, vendorSession.vendorId);

  const loadA = typeof aParam === 'string' && aParam ? aParam : loadNumbers[0];
  const loadB = typeof bParam === 'string' && bParam ? bParam : loadNumbers[1];

  const readingsA = loadA ? getLoadReadingsByLoadNumber(db, vendorSession.vendorId, loadA) : [];
  const readingsB = loadB ? getLoadReadingsByLoadNumber(db, vendorSession.vendorId, loadB) : [];

  return (
    <DashboardShell vendorId={vendorSession.vendorId}>
      <h2>Compare loads</h2>
      <div className="split-2" style={{ gap: 24 }}>
        <div>
          <h3>{loadA ?? 'No load selected'}</h3>
          <div className="table-wrap">
          <table>
            <thead><tr><th>Station</th><th>Parameter</th><th>Value</th></tr></thead>
            <tbody>
              {readingsA.map((r) => (
                <tr key={r.id} className={r.score === 'fail' ? 'out-of-limit' : ''}>
                  <td>{r.stationName}</td><td>{r.parameterName}</td><td>{r.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
        <div>
          <h3>{loadB ?? 'No load selected'}</h3>
          <div className="table-wrap">
          <table>
            <thead><tr><th>Station</th><th>Parameter</th><th>Value</th></tr></thead>
            <tbody>
              {readingsB.map((r) => (
                <tr key={r.id} className={r.score === 'fail' ? 'out-of-limit' : ''}>
                  <td>{r.stationName}</td><td>{r.parameterName}</td><td>{r.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}
