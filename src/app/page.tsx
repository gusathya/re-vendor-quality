import { getDb } from '@/lib/db/client';
import { getFilteredReadings, getLoadTimeline, type DashboardFilters } from '@/lib/dashboard-queries';
import { requireVendorSession } from '@/lib/require-vendor-session';
import { DashboardShell } from '@/components/DashboardShell';
import { FilterBar } from '@/components/FilterBar';
import { LoadTimelineChart } from '@/components/charts/LoadTimelineChart';

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
  const timeline = getLoadTimeline(db, vendorSession.vendorId);

  return (
    <DashboardShell vendorId={vendorSession.vendorId} filters={filters}>
      {timeline.length > 0 && (
        <div className="chart-card" style={{ marginBottom: 20 }}>
          <div className="chart-title">Load-by-Load Score Timeline</div>
          <LoadTimelineChart data={timeline} />
        </div>
      )}

      <FilterBar />

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Load</th>
              <th>Station</th>
              <th>Parameter</th>
              <th>Value</th>
              <th>Score</th>
            </tr>
          </thead>
          <tbody>
            {readings.map((r) => (
              <tr key={r.id} className={r.score === 'fail' ? 'out-of-limit' : ''}>
                <td>{r.loadNumber}</td>
                <td>{r.stationName}</td>
                <td>{r.parameterName}</td>
                <td><strong>{r.value}</strong></td>
                <td><span className={`badge badge-${r.score}`}>{r.score}</span></td>
              </tr>
            ))}
            {readings.length === 0 && (
              <tr><td colSpan={5} style={{ textAlign: 'center', color: '#9ca3af', padding: 24 }}>No readings match the current filter.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </DashboardShell>
  );
}
