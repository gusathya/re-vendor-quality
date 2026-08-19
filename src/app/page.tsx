import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getDb } from '@/lib/db/client';
import Link from 'next/link';
import {
  getVendorBatchKpis,
  getVendorBestBatch,
  getVendorStationFailStats,
  getVendorBatchTrend,
} from '@/lib/vendor-queries';
import { VendorBatchTrendChart } from '@/components/charts/VendorBatchTrendChart';

export default async function VendorDashboard() {
  const session = await auth();
  if (!session?.user) redirect('/login');
  if (session.user.role !== 'vendor') redirect('/admin');

  const vendorId = session.user.vendorId;
  if (!vendorId) redirect('/admin');

  const db = getDb();

  const vendor = db
    .prepare('SELECT name, vendor_code FROM vendors WHERE id = ?')
    .get(vendorId) as { name: string; vendor_code: string | null } | undefined;

  const kpis = getVendorBatchKpis(db, vendorId);
  const bestBatch = getVendorBestBatch(db, vendorId);
  const stationFails = getVendorStationFailStats(db, vendorId);
  const trendData = getVendorBatchTrend(db, vendorId);

  const passRatePct = Math.round(kpis.overallPassRate * 100);
  const passRateColor =
    passRatePct >= 90 ? 'var(--color-success)' :
    passRatePct >= 70 ? 'var(--color-warning)' :
    'var(--color-danger)';

  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  return (
    <main className="section">
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ margin: '0 0 4px' }}>
          <span className="accent-bar" />
          {vendor?.name ?? 'Vendor'} Dashboard
        </h1>
        {vendor?.vendor_code && (
          <div style={{ fontSize: 12, color: '#9ca3af', fontFamily: 'Share Tech, monospace' }}>
            Code: {vendor.vendor_code}
          </div>
        )}
      </div>

      {/* KPI strip — #9 */}
      <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', marginBottom: 28 }}>
        <div className="kpi-card navy">
          <div className="kpi-card-label">Total Batches</div>
          <div className="kpi-card-value">{kpis.totalBatches}</div>
          <div className="kpi-card-sub">{kpis.draftCount} drafts</div>
        </div>
        <div className="kpi-card" style={{ background: 'var(--color-card-bg)', border: '1px solid var(--color-card-border)' }}>
          <div className="kpi-card-label" style={{ color: '#6b7280' }}>Overall Pass Rate</div>
          <div className="kpi-card-value" style={{ color: passRateColor }}>{passRatePct}%</div>
          <div className="kpi-card-sub" style={{ color: '#9ca3af' }}>{kpis.totalReadings.toLocaleString()} readings</div>
        </div>
        <div className="kpi-card green">
          <div className="kpi-card-label">Approved</div>
          <div className="kpi-card-value">{kpis.approvedCount}</div>
          <div className="kpi-card-sub">by RE</div>
        </div>
        <div className="kpi-card navy">
          <div className="kpi-card-label">Pending Review</div>
          <div className="kpi-card-value">{kpis.pendingCount}</div>
          <div className="kpi-card-sub">awaiting RE</div>
        </div>
        <div className="kpi-card red">
          <div className="kpi-card-label">Rejected</div>
          <div className="kpi-card-value">{kpis.rejectedCount}</div>
          <div className="kpi-card-sub">need correction</div>
        </div>
      </div>

      {/* Best batch + trend chart — #12 & #1 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(220px,280px) 1fr', gap: 20, marginBottom: 24, alignItems: 'start' }}>
        {/* Best batch */}
        {bestBatch ? (
          <div className="card" style={{ borderLeft: '4px solid var(--color-success)' }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-success)', marginBottom: 10 }}>
              Your Best Batch
            </div>
            <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--color-success)', lineHeight: 1 }}>
              {bestBatch.passRate}%
            </div>
            <div style={{ fontSize: 13, fontWeight: 700, margin: '6px 0 2px', color: 'var(--color-text-heading)' }}>
              Load {bestBatch.loadNumber}
            </div>
            <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 12 }}>
              {bestBatch.passes} of {bestBatch.total} readings passed
            </div>
            <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 12 }}>
              Uploaded {bestBatch.uploadedAt.slice(0, 10)}
            </div>
            <Link
              href={`/loads/${bestBatch.id}/review`}
              style={{ fontSize: 12, color: 'var(--color-nav-active-text)', textDecoration: 'none' }}
            >
              View details →
            </Link>
          </div>
        ) : (
          <div className="card" style={{ color: '#9ca3af', fontSize: 13 }}>
            Upload your first batch to see your best score here.
          </div>
        )}

        {/* Pass rate trend */}
        <div className="card">
          <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 14, color: 'var(--color-text-heading)' }}>
            Pass Rate Trend — by Batch
          </div>
          <VendorBatchTrendChart data={trendData} />
        </div>
      </div>

      {/* Station fail breakdown — #2 */}
      {stationFails.length > 0 && (
        <div className="card" style={{ marginBottom: 24 }}>
          <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 14, color: 'var(--color-text-heading)' }}>
            Top Failing Stations
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Station / Process</th>
                  <th style={{ textAlign: 'right' }}>Fail Count</th>
                  <th style={{ textAlign: 'right' }}>Fail Rate</th>
                  <th style={{ width: 160 }}>Severity</th>
                </tr>
              </thead>
              <tbody>
                {stationFails.map((s) => (
                  <tr key={s.stationName}>
                    <td style={{ fontWeight: 600, fontSize: 13 }}>{s.stationName}</td>
                    <td style={{ textAlign: 'right', color: 'var(--color-danger)', fontWeight: 700 }}>{s.failCount}</td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>{s.failRate}%</td>
                    <td>
                      <div style={{ background: 'var(--color-card-border)', borderRadius: 4, height: 8, overflow: 'hidden' }}>
                        <div style={{
                          width: `${Math.min(s.failRate, 100)}%`,
                          height: '100%',
                          background: s.failRate >= 50 ? 'var(--color-danger)' : s.failRate >= 20 ? 'var(--color-warning)' : 'var(--color-success)',
                          borderRadius: 4,
                        }} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Quick actions */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <Link
          href="/loads/new"
          style={{
            background: 'var(--color-navy-primary)',
            color: 'white',
            padding: '10px 20px',
            borderRadius: 8,
            fontSize: 13,
            fontFamily: 'Share Tech, monospace',
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            textDecoration: 'none',
          }}
        >
          + Upload New Batch
        </Link>
        <Link
          href="/loads"
          style={{
            border: '1px solid var(--color-card-border)',
            color: 'var(--color-text-body)',
            padding: '10px 20px',
            borderRadius: 8,
            fontSize: 13,
            textDecoration: 'none',
          }}
        >
          My Batches
        </Link>
        <Link
          href={`/vendor/scorecard?month=${currentMonth}`}
          style={{
            border: '1px solid var(--color-card-border)',
            color: 'var(--color-text-body)',
            padding: '10px 20px',
            borderRadius: 8,
            fontSize: 13,
            textDecoration: 'none',
          }}
        >
          Monthly Scorecard
        </Link>
      </div>
    </main>
  );
}
