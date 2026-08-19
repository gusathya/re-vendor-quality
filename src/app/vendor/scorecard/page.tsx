import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getDb } from '@/lib/db/client';
import {
  getVendorMonthlyStats,
  getVendorMonthlyBatches,
  getVendorMonthlyStationStats,
} from '@/lib/vendor-queries';
import Link from 'next/link';

function StatusChip({ status }: { status: string }) {
  const cfg: Record<string, { bg: string; color: string; label: string }> = {
    draft:    { bg: '#f1f5f9', color: '#475569', label: 'Draft' },
    pending:  { bg: '#fef3c7', color: '#92400e', label: 'Pending' },
    approved: { bg: '#dcfce7', color: '#166534', label: 'Approved' },
    rejected: { bg: '#fee2e2', color: '#991b1b', label: 'Rejected' },
  };
  const s = cfg[status] ?? cfg.draft;
  return (
    <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 10, fontSize: 10, fontWeight: 700, background: s.bg, color: s.color, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
      {s.label}
    </span>
  );
}

function monthLabel(m: string) {
  const [y, mo] = m.split('-');
  return new Date(Number(y), Number(mo) - 1).toLocaleString('en-US', { month: 'long', year: 'numeric' });
}

export default async function MonthlyScorecard({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await auth();
  if (!session?.user) redirect('/login');
  if (session.user.role !== 'vendor') redirect('/');

  const vendorId = session.user.vendorId;
  if (!vendorId) redirect('/');

  const resolved = await searchParams;
  const now = new Date();
  const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const month = typeof resolved.month === 'string' && /^\d{4}-\d{2}$/.test(resolved.month)
    ? resolved.month
    : defaultMonth;

  const db = getDb();
  const vendor = db.prepare('SELECT name, vendor_code FROM vendors WHERE id = ?').get(vendorId) as { name: string; vendor_code: string | null } | undefined;

  const stats = getVendorMonthlyStats(db, vendorId, month);
  const batches = getVendorMonthlyBatches(db, vendorId, month);
  const stationStats = getVendorMonthlyStationStats(db, vendorId, month);

  // Build month navigation links
  const [y, mo] = month.split('-').map(Number);
  const prevDate = new Date(y, mo - 2);
  const nextDate = new Date(y, mo);
  const prevMonth = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;
  const nextMonth = `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, '0')}`;
  const isCurrentMonth = month === defaultMonth;

  const passRateColor = stats.passRate >= 90 ? 'var(--color-success)' : stats.passRate >= 70 ? 'var(--color-warning)' : 'var(--color-danger)';

  return (
    <>
      <style>{`
        @media print {
          body > header, body > nav, body > footer, .no-print { display: none !important; }
          main { padding: 0 !important; }
        }
      `}</style>

      <main className="section">
        {/* Nav */}
        <div className="no-print" style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
          <Link href="/" style={{ fontSize: 13, color: 'var(--color-nav-active-text)', textDecoration: 'none' }}>← Dashboard</Link>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
            <Link href={`/vendor/scorecard?month=${prevMonth}`} style={{ fontSize: 13, color: 'var(--color-nav-active-text)', textDecoration: 'none', padding: '6px 12px', border: '1px solid var(--color-card-border)', borderRadius: 6 }}>‹ Prev</Link>
            <span style={{ fontSize: 14, fontWeight: 700, minWidth: 160, textAlign: 'center', color: 'var(--color-text-heading)' }}>{monthLabel(month)}</span>
            {!isCurrentMonth && (
              <Link href={`/vendor/scorecard?month=${nextMonth}`} style={{ fontSize: 13, color: 'var(--color-nav-active-text)', textDecoration: 'none', padding: '6px 12px', border: '1px solid var(--color-card-border)', borderRadius: 6 }}>Next ›</Link>
            )}
            <button
              style={{ background: 'var(--color-navy-primary)', color: 'white', border: 'none', borderRadius: 6, padding: '6px 16px', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}
              onClick={() => window.print()}
            >
              Save PDF
            </button>
          </div>
        </div>

        {/* Header */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ background: 'var(--color-red-accent)', color: 'white', width: 40, height: 40, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Share Tech, monospace', fontWeight: 700, fontSize: 15 }}>RE</div>
            <div>
              <div style={{ fontFamily: 'Share Tech, monospace', fontSize: 13, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--color-text-heading)' }}>Royal Enfield — Vendor Quality</div>
              <div style={{ fontSize: 11, color: '#9ca3af' }}>Monthly Quality Scorecard</div>
            </div>
          </div>
          <h1 style={{ margin: '16px 0 4px' }}>
            <span className="accent-bar" />
            {monthLabel(month)}
          </h1>
          <div style={{ fontSize: 13, color: '#6b7280' }}>
            {vendor?.vendor_code ? `[${vendor.vendor_code}] ` : ''}{vendor?.name}
          </div>
        </div>

        {/* KPIs */}
        <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', marginBottom: 28 }}>
          <div className="kpi-card navy">
            <div className="kpi-card-label">Batches</div>
            <div className="kpi-card-value">{stats.totalBatches}</div>
            <div className="kpi-card-sub">submitted</div>
          </div>
          <div className="kpi-card" style={{ background: 'var(--color-card-bg)', border: '1px solid var(--color-card-border)' }}>
            <div className="kpi-card-label" style={{ color: '#6b7280' }}>Pass Rate</div>
            <div className="kpi-card-value" style={{ color: passRateColor }}>{stats.passRate}%</div>
            <div className="kpi-card-sub" style={{ color: '#9ca3af' }}>{stats.totalReadings} readings</div>
          </div>
          <div className="kpi-card green">
            <div className="kpi-card-label">Approved</div>
            <div className="kpi-card-value">{stats.approvedCount}</div>
          </div>
          <div className="kpi-card red">
            <div className="kpi-card-label">Rejected</div>
            <div className="kpi-card-value">{stats.rejectedCount}</div>
          </div>
          <div className="kpi-card navy">
            <div className="kpi-card-label">Pending</div>
            <div className="kpi-card-value">{stats.pendingCount}</div>
          </div>
        </div>

        {/* Pass rate bar */}
        <div className="card" style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 600, marginBottom: 8, color: 'var(--color-text-heading)' }}>
            <span>Overall Pass Rate — {monthLabel(month)}</span>
            <span style={{ color: passRateColor }}>{stats.passRate}% ({stats.passes}/{stats.totalReadings})</span>
          </div>
          <div style={{ background: 'var(--color-card-border)', borderRadius: 6, height: 16, overflow: 'hidden' }}>
            <div style={{ width: `${stats.passRate}%`, height: '100%', background: passRateColor, borderRadius: 6, transition: 'width 0.4s' }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#9ca3af', marginTop: 4 }}>
            <span>0%</span>
            <span style={{ color: 'var(--color-success)' }}>90% target</span>
            <span>100%</span>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 24 }}>
          {/* Batch list */}
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px', fontWeight: 700, fontSize: 13, borderBottom: '1px solid var(--color-card-border)', color: 'var(--color-text-heading)' }}>
              Batches This Month
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Load #</th>
                    <th style={{ textAlign: 'right' }}>Pass Rate</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {batches.map((b) => {
                    const rate = b.total > 0 ? Math.round((b.passes / b.total) * 100) : null;
                    return (
                      <tr key={b.id}>
                        <td>
                          <Link href={`/loads/${b.id}/review`} style={{ color: 'var(--color-nav-active-text)', textDecoration: 'none', fontWeight: 600, fontSize: 13 }}>
                            {b.loadNumber}
                          </Link>
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 700, color: rate !== null ? (rate >= 90 ? 'var(--color-success)' : rate >= 70 ? 'var(--color-warning)' : 'var(--color-danger)') : undefined }}>
                          {rate !== null ? `${rate}%` : '—'}
                        </td>
                        <td><StatusChip status={b.pushStatus} /></td>
                      </tr>
                    );
                  })}
                  {batches.length === 0 && (
                    <tr><td colSpan={3} style={{ textAlign: 'center', color: '#9ca3af', padding: 20, fontSize: 13 }}>No batches this month.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Station performance */}
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px', fontWeight: 700, fontSize: 13, borderBottom: '1px solid var(--color-card-border)', color: 'var(--color-text-heading)' }}>
              Station Performance
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Station</th>
                    <th style={{ textAlign: 'right' }}>Passes</th>
                    <th style={{ textAlign: 'right' }}>Fails</th>
                    <th style={{ textAlign: 'right' }}>Fail %</th>
                  </tr>
                </thead>
                <tbody>
                  {stationStats.map((s) => (
                    <tr key={s.stationName} style={{ background: s.failRate >= 50 ? 'rgba(239,68,68,0.05)' : undefined }}>
                      <td style={{ fontSize: 12 }}>{s.stationName}</td>
                      <td style={{ textAlign: 'right', color: 'var(--color-success)', fontWeight: 600 }}>{s.passes}</td>
                      <td style={{ textAlign: 'right', color: s.fails > 0 ? 'var(--color-danger)' : '#9ca3af', fontWeight: 600 }}>{s.fails}</td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: s.failRate >= 50 ? 'var(--color-danger)' : s.failRate > 0 ? 'var(--color-warning)' : 'var(--color-success)' }}>
                        {s.failRate}%
                      </td>
                    </tr>
                  ))}
                  {stationStats.length === 0 && (
                    <tr><td colSpan={4} style={{ textAlign: 'center', color: '#9ca3af', padding: 20, fontSize: 13 }}>No data.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div style={{ fontSize: 11, color: '#9ca3af', textAlign: 'center', marginTop: 8 }}>
          Generated {new Date().toISOString().slice(0, 10)} · Royal Enfield Vendor Quality Dashboard
        </div>
      </main>

      <script dangerouslySetInnerHTML={{
        __html: `document.querySelector('button')&&document.querySelector('button[style*="navy"]')&&document.querySelector('button[style*="navy"]').addEventListener('click',function(){window.print();});`,
      }} />
    </>
  );
}
