import { getDb } from '@/lib/db/client';
import { getParameterTrend, listScoredParameterNames } from '@/lib/dashboard-queries';
import { requireVendorSession } from '@/lib/require-vendor-session';
import { DashboardShell } from '@/components/DashboardShell';
import { TrendChart } from '@/components/charts/TrendChart';

export default async function TrendsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const vendorSession = await requireVendorSession();
  if (!vendorSession) return <main className="section">Sign in as a vendor user to see the dashboard.</main>;

  const resolvedSearchParams = await searchParams;
  const parameterNameParam = resolvedSearchParams.parameterName;
  const db = getDb();

  const availableParams = listScoredParameterNames(db, vendorSession.vendorId);
  const parameterName =
    typeof parameterNameParam === 'string' && parameterNameParam
      ? parameterNameParam
      : (availableParams[0] ?? 'Temperature');

  const trend = getParameterTrend(db, vendorSession.vendorId, parameterName);

  return (
    <DashboardShell vendorId={vendorSession.vendorId}>
      <div className="page-head" style={{ marginBottom: 16 }}>
        <h2 style={{ margin: 0 }}>Parameter Trend</h2>
        <form method="GET" className="toolbar">
          <label htmlFor="parameterName" style={{ margin: 0, fontSize: 12 }}>Parameter</label>
          <select
            id="parameterName"
            name="parameterName"
            defaultValue={parameterName}
            style={{ width: 'auto', minWidth: 160, flex: '1 1 160px' }}
          >
            {availableParams.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
          <button type="submit" style={{ padding: '6px 14px', fontSize: 11 }}>View</button>
        </form>
      </div>

      <div className="chart-card">
        <div className="chart-title">{parameterName} over time — {trend.length} readings</div>
        <TrendChart data={trend} parameterName={parameterName} />
      </div>

      {trend.length > 0 && (
        <div className="table-wrap" style={{ marginTop: 20 }}>
          <table>
            <thead>
              <tr>
                <th>Load</th>
                <th>Uploaded</th>
                <th>Value</th>
                <th>Min</th>
                <th>Max</th>
                <th>Score</th>
              </tr>
            </thead>
            <tbody>
              {trend.map((t, i) => (
                <tr key={i} className={t.score === 'fail' ? 'out-of-limit' : ''}>
                  <td>{t.loadNumber}</td>
                  <td>{t.uploadedAt}</td>
                  <td><strong>{t.value}</strong></td>
                  <td style={{ color: '#6b7280' }}>{t.minValue ?? '—'}</td>
                  <td style={{ color: '#6b7280' }}>{t.maxValue ?? '—'}</td>
                  <td>
                    <span className={`badge badge-${t.score}`}>{t.score}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </DashboardShell>
  );
}
