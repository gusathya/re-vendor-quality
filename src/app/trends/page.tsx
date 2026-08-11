import { getDb } from '@/lib/db/client';
import { getParameterTrend } from '@/lib/dashboard-queries';
import { requireVendorSession } from '@/lib/require-vendor-session';
import { DashboardShell } from '@/components/DashboardShell';

// Next.js 16 passes searchParams as a Promise to Server Components (same as `params`,
// see src/app/sops/[id]/page.tsx, and the Table page at src/app/page.tsx), so it must be
// awaited before use.
export default async function TrendsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const vendorSession = await requireVendorSession();
  if (!vendorSession) return <main className="section">Sign in as a vendor user to see the dashboard.</main>;

  const resolvedSearchParams = await searchParams;
  const parameterNameParam = resolvedSearchParams.parameterName;
  const parameterName = typeof parameterNameParam === 'string' && parameterNameParam ? parameterNameParam : 'Temperature';

  const db = getDb();
  const trend = getParameterTrend(db, vendorSession.vendorId, parameterName);

  return (
    <DashboardShell vendorId={vendorSession.vendorId}>
      <h2>Trend — {parameterName}</h2>
      <table>
        <thead><tr><th>Load</th><th>Uploaded</th><th>Value</th><th>Score</th></tr></thead>
        <tbody>
          {trend.map((t, i) => (
            <tr key={i} className={t.score === 'fail' ? 'out-of-limit' : ''}>
              <td>{t.loadNumber}</td><td>{t.uploadedAt}</td><td>{t.value}</td><td>{t.score}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {trend.length === 0 && <p>No scored readings yet for {parameterName}. Upload more load reports to see a trend.</p>}
    </DashboardShell>
  );
}
