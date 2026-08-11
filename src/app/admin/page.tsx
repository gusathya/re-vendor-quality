import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getDb } from '@/lib/db/client';
import {
  getAdminKpis,
  getVendorStats,
  getCrossVendorStationFailures,
  getCrossVendorParameterFailures,
  getAdminTimeline,
  getVendorStationHeatmap,
} from '@/lib/admin-queries';
import { AdminTabs } from '@/components/AdminTabs';
import { VendorComparisonChart, PassRateChart } from '@/components/charts/VendorComparisonChart';
import { AdminTimelineChart } from '@/components/charts/AdminTimelineChart';
import { HotspotChart } from '@/components/charts/HotspotChart';
import Link from 'next/link';

function cellBg(passes: number, total: number) {
  const r = passes / total;
  if (r >= 0.9) return '#dcfce7';
  if (r >= 0.7) return '#fef9c3';
  return '#fee2e2';
}
function cellFg(passes: number, total: number) {
  const r = passes / total;
  if (r >= 0.9) return '#166534';
  if (r >= 0.7) return '#92400e';
  return '#991b1b';
}

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await auth();
  if (!session?.user) redirect('/login');
  if (session.user.role !== 'admin') redirect('/');

  const resolvedParams = await searchParams;
  const tab = typeof resolvedParams.tab === 'string' ? resolvedParams.tab : 'overview';

  const db = getDb();
  const kpis = getAdminKpis(db);
  const vendors = getVendorStats(db);

  return (
    <main className="section">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <h1 style={{ margin: 0 }}>
          <span className="accent-bar" />
          Admin Dashboard
        </h1>
        <Link
          href="/"
          style={{
            fontSize: 12,
            color: '#6b7280',
            border: '1px solid var(--color-card-border)',
            borderRadius: 6,
            padding: '5px 14px',
            textDecoration: 'none',
          }}
        >
          ← Vendor View
        </Link>
      </div>

      {/* Global KPI strip */}
      <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', marginBottom: 24 }}>
        <div className="kpi-card navy">
          <div className="kpi-card-label">Vendors</div>
          <div className="kpi-card-value">{kpis.vendorCount}</div>
          <div className="kpi-card-sub">active</div>
        </div>
        <div className="kpi-card navy">
          <div className="kpi-card-label">Total Loads</div>
          <div className="kpi-card-value">{kpis.loadCount}</div>
          <div className="kpi-card-sub">across all vendors</div>
        </div>
        <div className="kpi-card navy">
          <div className="kpi-card-label">Total Readings</div>
          <div className="kpi-card-value">{kpis.totalReadings}</div>
          <div className="kpi-card-sub">scored</div>
        </div>
        <div className={`kpi-card ${kpis.passRate >= 0.9 ? 'green' : kpis.passRate >= 0.7 ? '' : 'red'}`}>
          <div className="kpi-card-label">Overall Pass Rate</div>
          <div
            className="kpi-card-value"
            style={{ color: kpis.passRate >= 0.9 ? 'var(--color-success)' : kpis.passRate >= 0.7 ? 'var(--color-warning)' : 'var(--color-danger)' }}
          >
            {Math.round(kpis.passRate * 100)}%
          </div>
          <div className="kpi-card-sub">{kpis.totalPasses} pass / {kpis.totalFails} fail</div>
        </div>
      </div>

      <AdminTabs />

      {tab === 'overview' && <OverviewTab vendors={vendors} />}
      {tab === 'failures' && <FailuresTab db={db} />}
      {tab === 'timeline' && <TimelineTab db={db} />}
      {tab === 'vendors' && <VendorsTab vendors={vendors} />}
    </main>
  );
}

/* ── Overview ── */
function OverviewTab({ vendors }: { vendors: Awaited<ReturnType<typeof getVendorStats>> }) {
  return (
    <div>
      <div className="grid-2" style={{ marginBottom: 24 }}>
        <div className="chart-card">
          <div className="chart-title">Pass vs Fail by Vendor</div>
          <VendorComparisonChart vendors={vendors} />
        </div>
        <div className="chart-card">
          <div className="chart-title">Pass Rate by Vendor</div>
          <PassRateChart vendors={vendors} />
        </div>
      </div>

      <div className="chart-card">
        <div className="chart-title">Vendor Summary</div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Vendor</th>
                <th>Process</th>
                <th>Loads</th>
                <th>Readings</th>
                <th>Pass</th>
                <th>Fail</th>
                <th>Pass Rate</th>
                <th>Last Upload</th>
              </tr>
            </thead>
            <tbody>
              {vendors.map((v) => {
                const rate = Math.round(v.passRate * 100);
                return (
                  <tr key={v.vendorId}>
                    <td><strong>{v.vendorName}</strong></td>
                    <td style={{ color: '#6b7280', fontSize: 12 }}>{v.processName}</td>
                    <td>{v.loadCount}</td>
                    <td>{v.totalReadings}</td>
                    <td style={{ color: 'var(--color-success)', fontWeight: 600 }}>{v.passes}</td>
                    <td style={{ color: v.fails > 0 ? 'var(--color-danger)' : '#9ca3af', fontWeight: 600 }}>{v.fails}</td>
                    <td>
                      <span
                        className="badge"
                        style={{
                          background: rate >= 90 ? '#dcfce7' : rate >= 70 ? '#fef3c7' : '#fee2e2',
                          color: rate >= 90 ? '#166534' : rate >= 70 ? '#92400e' : '#991b1b',
                        }}
                      >
                        {rate}%
                      </span>
                    </td>
                    <td style={{ color: '#6b7280', fontSize: 12 }}>{v.lastUploadAt?.slice(0, 16) ?? '—'}</td>
                  </tr>
                );
              })}
              {vendors.length === 0 && (
                <tr><td colSpan={8} style={{ textAlign: 'center', color: '#9ca3af', padding: 24 }}>No vendors yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ── Failures ── */
function FailuresTab({ db }: { db: ReturnType<typeof getDb> }) {
  const stationFails = getCrossVendorStationFailures(db);
  const paramFails = getCrossVendorParameterFailures(db);
  const heatmap = getVendorStationHeatmap(db);

  const stations = [...new Set(heatmap.map((d) => d.stationName))].sort();
  const vendorNames = [...new Set(heatmap.map((d) => d.vendorName))].sort();
  const lookup = new Map(heatmap.map((d) => [`${d.stationName}||${d.vendorName}`, d]));

  return (
    <div>
      <div className="grid-2" style={{ marginBottom: 24 }}>
        <div className="chart-card">
          <div className="chart-title">Top Failing Stations (cross-vendor)</div>
          <HotspotChart data={stationFails.map((s) => ({ name: `${s.vendorName} — ${s.stationName}`, failCount: s.failCount }))} />
        </div>
        <div className="chart-card">
          <div className="chart-title">Top Failing Parameters (cross-vendor)</div>
          <HotspotChart data={paramFails.map((p) => ({ name: `${p.vendorName} — ${p.parameterName}`, failCount: p.failCount }))} />
        </div>
      </div>

      <div className="chart-card">
        <div className="chart-title">Pass Rate Heatmap — Station × Vendor</div>
        {heatmap.length === 0 ? (
          <p style={{ color: '#9ca3af', fontSize: 13 }}>No scored data yet.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ borderCollapse: 'collapse', fontSize: 11 }}>
              <thead>
                <tr>
                  <th style={{ padding: '7px 12px', background: 'var(--color-navy-primary)', color: 'white', textAlign: 'left', minWidth: 150 }}>
                    Station ↓ / Vendor →
                  </th>
                  {vendorNames.map((v) => (
                    <th key={v} style={{ padding: '7px 10px', background: 'var(--color-navy-primary)', color: 'white', textAlign: 'center', whiteSpace: 'nowrap' }}>
                      {v}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {stations.map((station) => (
                  <tr key={station}>
                    <td style={{ padding: '6px 12px', fontWeight: 600, background: '#f8fafc', borderBottom: '1px solid #e5e7eb', whiteSpace: 'nowrap' }}>
                      {station}
                    </td>
                    {vendorNames.map((vendor) => {
                      const cell = lookup.get(`${station}||${vendor}`);
                      if (!cell) return (
                        <td key={vendor} style={{ padding: '6px 10px', textAlign: 'center', background: '#f9fafb', borderBottom: '1px solid #e5e7eb', color: '#d1d5db' }}>—</td>
                      );
                      const rate = Math.round((cell.passes / cell.total) * 100);
                      return (
                        <td key={vendor} title={`${cell.passes}/${cell.total} pass`} style={{
                          padding: '6px 10px', textAlign: 'center', fontWeight: 700,
                          background: cellBg(cell.passes, cell.total),
                          color: cellFg(cell.passes, cell.total),
                          borderBottom: '1px solid #e5e7eb',
                        }}>
                          {rate}%
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
            <p style={{ fontSize: 11, color: '#9ca3af', marginTop: 8 }}>Green ≥ 90% · Yellow 70–89% · Red &lt; 70% · Hover cell for raw counts</p>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Timeline ── */
function TimelineTab({ db }: { db: ReturnType<typeof getDb> }) {
  const timeline = getAdminTimeline(db);

  return (
    <div>
      <div className="chart-card" style={{ marginBottom: 24 }}>
        <div className="chart-title">Load-by-Load Results — All Vendors (chronological)</div>
        <AdminTimelineChart data={timeline} />
      </div>

      <div className="chart-card">
        <div className="chart-title">Load Detail</div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Vendor</th>
                <th>Load</th>
                <th>Uploaded</th>
                <th>Pass</th>
                <th>Fail</th>
                <th>Pass Rate</th>
              </tr>
            </thead>
            <tbody>
              {timeline.map((t, i) => {
                const total = t.passes + t.fails;
                const rate = total > 0 ? Math.round((t.passes / total) * 100) : 0;
                return (
                  <tr key={i} className={t.fails > 0 ? 'out-of-limit' : ''}>
                    <td>{t.vendorName}</td>
                    <td><strong>{t.loadNumber}</strong></td>
                    <td style={{ color: '#6b7280', fontSize: 12 }}>{t.uploadedAt?.slice(0, 16)}</td>
                    <td style={{ color: 'var(--color-success)', fontWeight: 600 }}>{t.passes}</td>
                    <td style={{ color: t.fails > 0 ? 'var(--color-danger)' : '#9ca3af', fontWeight: 600 }}>{t.fails}</td>
                    <td>
                      <span className="badge" style={{
                        background: rate >= 90 ? '#dcfce7' : rate >= 70 ? '#fef3c7' : '#fee2e2',
                        color: rate >= 90 ? '#166534' : rate >= 70 ? '#92400e' : '#991b1b',
                      }}>
                        {rate}%
                      </span>
                    </td>
                  </tr>
                );
              })}
              {timeline.length === 0 && (
                <tr><td colSpan={6} style={{ textAlign: 'center', color: '#9ca3af', padding: 24 }}>No load data yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ── Vendors ── */
function VendorsTab({ vendors }: { vendors: Awaited<ReturnType<typeof getVendorStats>> }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
      {vendors.map((v) => {
        const rate = Math.round(v.passRate * 100);
        const barColor = rate >= 90 ? 'var(--color-success)' : rate >= 70 ? 'var(--color-warning)' : 'var(--color-danger)';
        return (
          <div key={v.vendorId} className="card" style={{ borderTop: `4px solid ${barColor}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--color-text-heading)' }}>{v.vendorName}</div>
                <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>{v.processName}</div>
              </div>
              <span
                className="badge"
                style={{
                  fontSize: 14,
                  padding: '4px 12px',
                  background: rate >= 90 ? '#dcfce7' : rate >= 70 ? '#fef3c7' : '#fee2e2',
                  color: rate >= 90 ? '#166534' : rate >= 70 ? '#92400e' : '#991b1b',
                }}
              >
                {rate}%
              </span>
            </div>

            {/* Pass rate bar */}
            <div style={{ height: 6, background: '#f1f5f9', borderRadius: 3, marginBottom: 14, overflow: 'hidden' }}>
              <div style={{ width: `${rate}%`, height: '100%', background: barColor, borderRadius: 3, transition: 'width 0.4s' }} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 14 }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--color-text-heading)', fontFamily: 'Share Tech, monospace' }}>{v.loadCount}</div>
                <div style={{ fontSize: 10, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Loads</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--color-success)', fontFamily: 'Share Tech, monospace' }}>{v.passes}</div>
                <div style={{ fontSize: 10, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Pass</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 18, fontWeight: 800, color: v.fails > 0 ? 'var(--color-danger)' : '#9ca3af', fontFamily: 'Share Tech, monospace' }}>{v.fails}</div>
                <div style={{ fontSize: 10, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Fail</div>
              </div>
            </div>

            <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 14 }}>
              Last upload: {v.lastUploadAt?.slice(0, 16) ?? 'No data yet'}
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <Link
                href={`/sops?vendorId=${v.vendorId}`}
                style={{
                  flex: 1, textAlign: 'center',
                  padding: '6px 0', borderRadius: 6, fontSize: 11,
                  background: 'var(--color-navy-primary)', color: 'white',
                  textDecoration: 'none', fontFamily: 'Share Tech, monospace',
                  textTransform: 'uppercase', letterSpacing: '0.05em',
                }}
              >
                SOPs
              </Link>
              <Link
                href={`/settings`}
                style={{
                  flex: 1, textAlign: 'center',
                  padding: '6px 0', borderRadius: 6, fontSize: 11,
                  background: 'transparent', color: 'var(--color-navy-primary)',
                  border: '1px solid var(--color-navy-primary)',
                  textDecoration: 'none', fontFamily: 'Share Tech, monospace',
                  textTransform: 'uppercase', letterSpacing: '0.05em',
                }}
              >
                Settings
              </Link>
            </div>
          </div>
        );
      })}
      {vendors.length === 0 && (
        <p style={{ color: '#9ca3af', fontSize: 13 }}>No vendors found. Run the seed script to create demo data.</p>
      )}
    </div>
  );
}
