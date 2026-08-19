import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getDb } from '@/lib/db/client';
import { getBatchEvents } from '@/lib/vendor-queries';
import Link from 'next/link';

interface BatchDetail {
  id: string;
  loadNumber: string;
  partNumber: string | null;
  pushStatus: string;
  pushedAt: string | null;
  pushNote: string | null;
  reviewedAt: string | null;
  reviewNote: string | null;
  uploadedAt: string;
  vendorName: string;
  vendorCode: string | null;
}

interface BatchReading {
  stationNo: number;
  stationName: string;
  parameterName: string;
  value: number | null;
  dipTimeSeconds: number | null;
  score: string;
  minValue: number | null;
  maxValue: number | null;
  unit: string | null;
}

export default async function BatchReviewDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect('/login');

  const { id } = await params;
  const role = session.user.role;
  const db = getDb();

  const load = db
    .prepare(
      `SELECT
         lr.id,
         lr.load_number  AS loadNumber,
         lr.part_number  AS partNumber,
         lr.push_status  AS pushStatus,
         lr.pushed_at    AS pushedAt,
         lr.push_note    AS pushNote,
         lr.reviewed_at  AS reviewedAt,
         lr.review_note  AS reviewNote,
         lr.uploaded_at  AS uploadedAt,
         v.name          AS vendorName,
         v.vendor_code   AS vendorCode
       FROM load_reports lr
       JOIN vendors v ON v.id = lr.vendor_id
       WHERE lr.id = ?`,
    )
    .get(id) as BatchDetail | undefined;

  if (!load) redirect('/customer');

  // Access control
  if (role === 'vendor') {
    const owns = db
      .prepare('SELECT 1 FROM load_reports WHERE id = ? AND vendor_id = ?')
      .get(id, session.user.vendorId ?? '');
    if (!owns) redirect('/loads');
  } else if (role === 'customer' || role === 'admin') {
    if (load.pushStatus === 'draft') redirect('/customer');
  } else {
    redirect('/');
  }

  const readings = db
    .prepare(
      `SELECT
         r.station_no        AS stationNo,
         r.station_name      AS stationName,
         r.parameter_name    AS parameterName,
         r.value,
         r.dip_time_seconds  AS dipTimeSeconds,
         r.score,
         p.min_value         AS minValue,
         p.max_value         AS maxValue,
         p.unit
       FROM load_readings r
       LEFT JOIN sop_parameters p ON p.id = r.sop_parameter_id
       WHERE r.load_report_id = ?
       ORDER BY r.station_no, r.id`,
    )
    .all(id) as BatchReading[];

  const scored = readings.filter((r) => r.score !== 'unscored');
  const passes = scored.filter((r) => r.score === 'pass').length;
  const fails = scored.filter((r) => r.score === 'fail').length;
  const passRate = scored.length > 0 ? Math.round((passes / scored.length) * 100) : null;

  const events = getBatchEvents(db, id);
  const backHref = role === 'vendor' ? '/loads' : '/customer';

  return (
    <main className="section">
      <div style={{ marginBottom: 18 }}>
        <Link
          href={backHref}
          style={{
            fontSize: 13,
            color: 'var(--color-nav-active-text)',
            textDecoration: 'none',
          }}
        >
          ← Back to {role === 'vendor' ? 'My Batches' : 'Batch Review'}
        </Link>
      </div>

      <h1 style={{ margin: '0 0 4px' }}>
        <span className="accent-bar" />
        Load {load.loadNumber} — Batch Parameters
      </h1>
      <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 24 }}>
        {load.vendorCode ? `[${load.vendorCode}] ` : ''}{load.vendorName}
        {load.partNumber ? ` · Part ${load.partNumber}` : ''}
        {load.pushedAt ? ` · Submitted ${load.pushedAt.slice(0, 10)}` : ` · Uploaded ${load.uploadedAt.slice(0, 10)}`}
      </div>

      {/* KPI strip */}
      <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', marginBottom: 24 }}>
        <div className={`kpi-card ${passRate !== null && passRate >= 90 ? 'green' : passRate !== null && passRate >= 70 ? 'navy' : 'red'}`}>
          <div className="kpi-card-label">Pass Rate</div>
          <div className="kpi-card-value">{passRate !== null ? `${passRate}%` : '—'}</div>
          <div className="kpi-card-sub">{scored.length} scored readings</div>
        </div>
        <div className="kpi-card green">
          <div className="kpi-card-label">Passes</div>
          <div className="kpi-card-value">{passes}</div>
          <div className="kpi-card-sub">within limits</div>
        </div>
        <div className="kpi-card red">
          <div className="kpi-card-label">Fails</div>
          <div className="kpi-card-value">{fails}</div>
          <div className="kpi-card-sub">out of limit</div>
        </div>
      </div>

      {/* Vendor submission comment */}
      {load.pushNote && (
        <div
          className="card"
          style={{ marginBottom: 20, borderLeft: '4px solid var(--color-navy-primary)' }}
        >
          <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 6, color: 'var(--color-text-heading)' }}>
            Vendor Submission Comment
          </div>
          <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6 }}>{load.pushNote}</p>
        </div>
      )}

      {/* RE review note if already reviewed */}
      {load.reviewNote && (
        <div
          className="card"
          style={{
            marginBottom: 20,
            borderLeft: `4px solid ${load.pushStatus === 'approved' ? 'var(--color-success)' : 'var(--color-danger)'}`,
          }}
        >
          <div style={{
            fontWeight: 700,
            fontSize: 13,
            marginBottom: 6,
            color: load.pushStatus === 'approved' ? 'var(--color-success)' : 'var(--color-danger)',
          }}>
            {load.pushStatus === 'approved' ? 'RE Approval Note' : 'RE Rejection Reason'}
          </div>
          <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6 }}>{load.reviewNote}</p>
        </div>
      )}

      {/* Readings table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{
          padding: '14px 18px',
          borderBottom: '1px solid var(--color-card-border)',
          fontWeight: 700,
          fontSize: 14,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <span>Batch Parameters vs. SOP Limits</span>
          {fails > 0 && (
            <span style={{
              fontSize: 11,
              background: 'rgba(239,68,68,0.1)',
              color: 'var(--color-danger)',
              padding: '2px 10px',
              borderRadius: 10,
              fontWeight: 700,
              letterSpacing: '0.04em',
            }}>
              {fails} FAIL{fails !== 1 ? 'S' : ''} HIGHLIGHTED
            </span>
          )}
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th style={{ width: 48 }}>Stn #</th>
                <th>Station / Process</th>
                <th>Parameter</th>
                <th style={{ textAlign: 'right' }}>Measured</th>
                <th style={{ textAlign: 'right' }}>SOP Min</th>
                <th style={{ textAlign: 'right' }}>SOP Max</th>
                <th>Unit</th>
                <th style={{ textAlign: 'center' }}>Result</th>
              </tr>
            </thead>
            <tbody>
              {readings.map((r, i) => (
                <tr
                  key={i}
                  style={{
                    background: r.score === 'fail'
                      ? 'rgba(239,68,68,0.07)'
                      : undefined,
                  }}
                >
                  <td style={{ color: '#9ca3af', fontSize: 12, textAlign: 'center' }}>{r.stationNo}</td>
                  <td style={{ fontSize: 12 }}>{r.stationName}</td>
                  <td style={{ fontSize: 12 }}>{r.parameterName}</td>
                  <td style={{
                    textAlign: 'right',
                    fontWeight: 600,
                    fontFamily: 'Share Tech, monospace',
                    color: r.score === 'fail' ? 'var(--color-danger)' : r.score === 'pass' ? 'var(--color-success)' : undefined,
                  }}>
                    {r.value !== null
                      ? r.value
                      : r.dipTimeSeconds !== null
                        ? `${r.dipTimeSeconds}s`
                        : '—'}
                  </td>
                  <td style={{ textAlign: 'right', color: '#9ca3af', fontSize: 12 }}>
                    {r.minValue !== null ? r.minValue : '—'}
                  </td>
                  <td style={{ textAlign: 'right', color: '#9ca3af', fontSize: 12 }}>
                    {r.maxValue !== null ? r.maxValue : '—'}
                  </td>
                  <td style={{ color: '#9ca3af', fontSize: 12 }}>{r.unit ?? '—'}</td>
                  <td style={{ textAlign: 'center' }}>
                    {r.score === 'pass' && (
                      <span style={{ color: 'var(--color-success)', fontWeight: 700, fontSize: 11, letterSpacing: '0.05em' }}>PASS</span>
                    )}
                    {r.score === 'fail' && (
                      <span style={{ color: 'var(--color-danger)', fontWeight: 700, fontSize: 11, letterSpacing: '0.05em' }}>FAIL</span>
                    )}
                    {r.score === 'unscored' && (
                      <span style={{ color: '#9ca3af', fontSize: 11 }}>—</span>
                    )}
                  </td>
                </tr>
              ))}
              {readings.length === 0 && (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', color: '#9ca3af', padding: 24 }}>
                    No readings recorded for this batch.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Audit trail — #16 */}
      {events.length > 0 && (
        <div className="card" style={{ marginTop: 24 }}>
          <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 14, color: 'var(--color-text-heading)' }}>
            Batch Activity Log
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {events.map((ev, i) => {
              const iconMap: Record<string, { icon: string; color: string }> = {
                uploaded:    { icon: '↑', color: '#6b7280' },
                submitted:   { icon: '→', color: 'var(--color-navy-primary)' },
                resubmitted: { icon: '↺', color: 'var(--color-warning)' },
                approved:    { icon: '✓', color: 'var(--color-success)' },
                rejected:    { icon: '✗', color: 'var(--color-danger)' },
              };
              const { icon, color } = iconMap[ev.eventType] ?? { icon: '·', color: '#9ca3af' };
              return (
                <div key={ev.id} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', paddingBottom: i < events.length - 1 ? 12 : 0, marginBottom: i < events.length - 1 ? 12 : 0, borderBottom: i < events.length - 1 ? '1px solid var(--color-card-border)' : 'none' }}>
                  <div style={{ width: 28, height: 28, borderRadius: '50%', background: `${color}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color, flexShrink: 0 }}>
                    {icon}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-heading)', textTransform: 'capitalize' }}>
                      {ev.eventType}
                      {ev.actorEmail && <span style={{ fontWeight: 400, color: '#6b7280' }}> by {ev.actorEmail}</span>}
                    </div>
                    {ev.note && (
                      <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2, lineHeight: 1.5 }}>{ev.note}</div>
                    )}
                  </div>
                  <div style={{ fontSize: 11, color: '#9ca3af', whiteSpace: 'nowrap', flexShrink: 0 }}>
                    {ev.createdAt.slice(0, 16)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </main>
  );
}
