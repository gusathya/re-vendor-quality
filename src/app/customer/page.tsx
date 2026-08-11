import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getDb } from '@/lib/db/client';
import { getPushedLoads } from '@/lib/admin-queries';
import { draftBatchRejectedEmail } from '@/lib/email-templates';
import { approveLoadReport, rejectLoadReport } from './actions';

function StatusChip({ status }: { status: string }) {
  const cfg: Record<string, { bg: string; color: string; label: string }> = {
    pending:  { bg: '#fef3c7', color: '#92400e', label: 'Pending Review' },
    approved: { bg: '#dcfce7', color: '#166534', label: 'Approved' },
    rejected: { bg: '#fee2e2', color: '#991b1b', label: 'Rejected' },
  };
  const s = cfg[status] ?? { bg: '#f1f5f9', color: '#475569', label: status };
  return (
    <span style={{
      display: 'inline-block',
      padding: '2px 10px',
      borderRadius: 12,
      fontSize: 11,
      fontWeight: 700,
      background: s.bg,
      color: s.color,
      letterSpacing: '0.04em',
      textTransform: 'uppercase',
    }}>
      {s.label}
    </span>
  );
}

export default async function CustomerPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await auth();
  if (!session?.user) redirect('/login');
  if (session.user.role !== 'customer' && session.user.role !== 'admin') redirect('/');

  const resolvedParams = await searchParams;
  const rejectId = typeof resolvedParams.reject === 'string' ? resolvedParams.reject : null;
  const emailLoadId = typeof resolvedParams.emailLoadId === 'string' ? resolvedParams.emailLoadId : null;

  const db = getDb();
  const loads = getPushedLoads(db);

  // Draft email for a just-rejected load
  let rejectionDraftEmail: string | null = null;
  if (emailLoadId) {
    const load = loads.find((l) => l.id === emailLoadId);
    if (load && load.pushStatus === 'rejected' && load.reviewNote) {
      rejectionDraftEmail = draftBatchRejectedEmail({
        vendorEmail: load.vendorEmail ?? '[vendor email]',
        vendorName: load.vendorName,
        vendorCode: load.vendorCode ?? '—',
        loadNumber: load.loadNumber,
        rejectedOn: load.reviewedAt?.slice(0, 10) ?? '—',
        reviewNote: load.reviewNote,
      });
    }
  }

  const pending = loads.filter((l) => l.pushStatus === 'pending');
  const reviewed = loads.filter((l) => l.pushStatus !== 'pending');

  return (
    <main className="section">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <h1 style={{ margin: 0 }}>
          <span className="accent-bar" />
          Royal Enfield — Batch Review Portal
        </h1>
        {session.user.role === 'admin' && (
          <span style={{ fontSize: 12, color: '#6b7280', border: '1px solid var(--color-card-border)', borderRadius: 6, padding: '4px 12px' }}>
            Viewing as Admin
          </span>
        )}
      </div>

      {/* Draft email after rejection */}
      {rejectionDraftEmail && (
        <div className="card" style={{ marginBottom: 24, borderLeft: '4px solid var(--color-danger)' }}>
          <div style={{ fontWeight: 700, color: 'var(--color-danger)', marginBottom: 10 }}>
            Batch Rejected — Draft Notification Email
          </div>
          <p style={{ fontSize: 12, color: '#6b7280', marginTop: 0, marginBottom: 10 }}>
            Copy this text to send to the vendor via email. The app does not send email automatically.
          </p>
          <pre style={{
            background: '#f8fafc',
            border: '1px solid var(--color-card-border)',
            borderRadius: 6,
            padding: '14px 16px',
            fontSize: 12,
            fontFamily: 'monospace',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            margin: 0,
            color: '#334155',
          }}>
            {rejectionDraftEmail}
          </pre>
        </div>
      )}

      {/* Reject modal */}
      {rejectId && (() => {
        const load = loads.find((l) => l.id === rejectId && l.pushStatus === 'pending');
        if (!load) return null;
        return (
          <div style={{
            position: 'fixed', inset: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 100,
          }}>
            <div style={{
              background: 'white',
              borderRadius: 12,
              padding: 28,
              maxWidth: 500,
              width: '90vw',
              boxShadow: '0 20px 40px rgba(0,0,0,0.15)',
            }}>
              <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--color-text-heading)', marginBottom: 8 }}>
                Reject Batch — Load {load.loadNumber}
              </div>
              <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 16 }}>
                {load.vendorCode ? `[${load.vendorCode}] ` : ''}{load.vendorName}
              </div>
              <form action={rejectLoadReport}>
                <input type="hidden" name="loadId" value={load.id} />
                <label style={{ display: 'block', marginBottom: 14 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>
                    Rejection reason (required)
                  </span>
                  <textarea
                    name="reviewNote"
                    required
                    rows={4}
                    placeholder="Describe the specific out-of-limit parameters or issues that must be corrected before re-submission..."
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      padding: '10px 12px',
                      borderRadius: 6,
                      border: '1px solid var(--color-card-border)',
                      fontSize: 13,
                      fontFamily: 'inherit',
                      resize: 'vertical',
                    }}
                  />
                </label>
                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                  <a
                    href="/customer"
                    style={{
                      padding: '8px 18px',
                      borderRadius: 6,
                      fontSize: 13,
                      border: '1px solid var(--color-card-border)',
                      color: 'var(--color-text-body)',
                      textDecoration: 'none',
                      display: 'inline-block',
                    }}
                  >
                    Cancel
                  </a>
                  <button
                    type="submit"
                    style={{
                      padding: '8px 18px',
                      borderRadius: 6,
                      fontSize: 13,
                      background: 'var(--color-danger)',
                      color: 'white',
                      border: 'none',
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                    }}
                  >
                    Confirm Rejection
                  </button>
                </div>
              </form>
            </div>
          </div>
        );
      })()}

      {/* KPI strip */}
      <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', marginBottom: 24 }}>
        <div className="kpi-card navy">
          <div className="kpi-card-label">Pending</div>
          <div className="kpi-card-value">{pending.length}</div>
          <div className="kpi-card-sub">awaiting review</div>
        </div>
        <div className="kpi-card green">
          <div className="kpi-card-label">Approved</div>
          <div className="kpi-card-value">{loads.filter((l) => l.pushStatus === 'approved').length}</div>
          <div className="kpi-card-sub">batches</div>
        </div>
        <div className="kpi-card red">
          <div className="kpi-card-label">Rejected</div>
          <div className="kpi-card-value">{loads.filter((l) => l.pushStatus === 'rejected').length}</div>
          <div className="kpi-card-sub">batches</div>
        </div>
      </div>

      {/* Pending for review */}
      {pending.length > 0 && (
        <div style={{ marginBottom: 32 }}>
          <h2 style={{ marginBottom: 12 }}>Awaiting Review</h2>
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Vendor</th>
                    <th>Load #</th>
                    <th>Part</th>
                    <th>Pushed</th>
                    <th style={{ textAlign: 'right' }}>Pass Rate</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pending.map((load) => {
                    const rate = load.total > 0 ? Math.round((load.passes / load.total) * 100) : null;
                    return (
                      <tr key={load.id}>
                        <td>
                          <div style={{ fontWeight: 600 }}>{load.vendorName}</div>
                          {load.vendorCode && (
                            <div style={{ fontSize: 11, color: '#9ca3af', fontFamily: 'Share Tech, monospace' }}>{load.vendorCode}</div>
                          )}
                        </td>
                        <td><strong>{load.loadNumber}</strong></td>
                        <td style={{ color: '#6b7280', fontSize: 12 }}>{load.partNumber ?? '—'}</td>
                        <td style={{ color: '#6b7280', fontSize: 12 }}>{load.pushedAt?.slice(0, 16) ?? '—'}</td>
                        <td style={{ textAlign: 'right' }}>
                          {rate !== null ? (
                            <span style={{
                              fontWeight: 700,
                              color: rate >= 90 ? 'var(--color-success)' : rate >= 70 ? 'var(--color-warning)' : 'var(--color-danger)',
                            }}>
                              {rate}%
                            </span>
                          ) : '—'}
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: 8 }}>
                            <form action={approveLoadReport} style={{ margin: 0 }}>
                              <input type="hidden" name="loadId" value={load.id} />
                              <button
                                type="submit"
                                style={{
                                  background: 'var(--color-success)',
                                  color: 'white',
                                  border: 'none',
                                  borderRadius: 6,
                                  padding: '5px 14px',
                                  fontSize: 11,
                                  fontFamily: 'Share Tech, monospace',
                                  textTransform: 'uppercase',
                                  letterSpacing: '0.05em',
                                  cursor: 'pointer',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                Approve
                              </button>
                            </form>
                            <a
                              href={`/customer?reject=${load.id}`}
                              style={{
                                background: 'var(--color-danger)',
                                color: 'white',
                                border: 'none',
                                borderRadius: 6,
                                padding: '5px 14px',
                                fontSize: 11,
                                fontFamily: 'Share Tech, monospace',
                                textTransform: 'uppercase',
                                letterSpacing: '0.05em',
                                cursor: 'pointer',
                                whiteSpace: 'nowrap',
                                textDecoration: 'none',
                                display: 'inline-block',
                              }}
                            >
                              Reject
                            </a>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* History */}
      <div>
        <h2 style={{ marginBottom: 12 }}>Review History</h2>
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Vendor</th>
                  <th>Load #</th>
                  <th>Part</th>
                  <th>Pushed</th>
                  <th>Reviewed</th>
                  <th style={{ textAlign: 'right' }}>Pass Rate</th>
                  <th>Status</th>
                  <th>Note</th>
                </tr>
              </thead>
              <tbody>
                {reviewed.map((load) => {
                  const rate = load.total > 0 ? Math.round((load.passes / load.total) * 100) : null;
                  return (
                    <tr key={load.id}>
                      <td>
                        <div style={{ fontWeight: 600 }}>{load.vendorName}</div>
                        {load.vendorCode && (
                          <div style={{ fontSize: 11, color: '#9ca3af', fontFamily: 'Share Tech, monospace' }}>{load.vendorCode}</div>
                        )}
                      </td>
                      <td><strong>{load.loadNumber}</strong></td>
                      <td style={{ color: '#6b7280', fontSize: 12 }}>{load.partNumber ?? '—'}</td>
                      <td style={{ color: '#6b7280', fontSize: 12 }}>{load.pushedAt?.slice(0, 10) ?? '—'}</td>
                      <td style={{ color: '#6b7280', fontSize: 12 }}>{load.reviewedAt?.slice(0, 10) ?? '—'}</td>
                      <td style={{ textAlign: 'right' }}>
                        {rate !== null ? (
                          <span style={{
                            fontWeight: 700,
                            color: rate >= 90 ? 'var(--color-success)' : rate >= 70 ? 'var(--color-warning)' : 'var(--color-danger)',
                          }}>
                            {rate}%
                          </span>
                        ) : '—'}
                      </td>
                      <td><StatusChip status={load.pushStatus} /></td>
                      <td style={{ color: '#6b7280', fontSize: 12, maxWidth: 200 }}>
                        {load.reviewNote ?? '—'}
                      </td>
                    </tr>
                  );
                })}
                {reviewed.length === 0 && (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', color: '#9ca3af', padding: 24 }}>
                      No reviewed batches yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </main>
  );
}
