import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getDb } from '@/lib/db/client';
import { getVendorLoads } from '@/lib/admin-queries';
import { draftBatchRejectedEmail } from '@/lib/email-templates';
import { getResubmissionDiff } from '@/lib/vendor-queries';
import Link from 'next/link';
import { pushLoadReport } from './actions';

function StatusChip({ status }: { status: string }) {
  const cfg: Record<string, { bg: string; color: string; label: string }> = {
    draft:    { bg: '#f1f5f9', color: '#475569', label: 'Draft' },
    pending:  { bg: '#fef3c7', color: '#92400e', label: 'Pending Review' },
    approved: { bg: '#dcfce7', color: '#166534', label: 'Approved' },
    rejected: { bg: '#fee2e2', color: '#991b1b', label: 'Rejected' },
  };
  const s = cfg[status] ?? cfg.draft;
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

export default async function LoadsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await auth();
  if (!session?.user) redirect('/login');

  const vendorId = session.user.vendorId;
  if (!vendorId) redirect('/admin');

  const resolvedParams = await searchParams;
  const submitId = typeof resolvedParams.submit === 'string' ? resolvedParams.submit : null;
  const viewRejectionId = typeof resolvedParams.rejectedLoad === 'string' ? resolvedParams.rejectedLoad : null;

  const db = getDb();
  const loads = getVendorLoads(db, vendorId);
  const rejectedLoad = viewRejectionId ? loads.find((l) => l.id === viewRejectionId) : null;
  const submitLoad = submitId ? loads.find((l) => l.id === submitId) : null;
  const resubmitDiff = submitLoad ? getResubmissionDiff(db, submitLoad.id, vendorId) : null;

  // Build draft rejection email if viewing a rejected load
  let rejectionEmail: string | null = null;
  if (rejectedLoad && rejectedLoad.pushStatus === 'rejected' && rejectedLoad.reviewNote) {
    const vendorUser = db
      .prepare("SELECT email FROM users WHERE vendor_id = ? AND role = 'vendor' LIMIT 1")
      .get(vendorId) as { email: string } | undefined;
    const vendor = db.prepare('SELECT name, vendor_code FROM vendors WHERE id = ?').get(vendorId) as { name: string; vendor_code: string | null } | undefined;
    rejectionEmail = draftBatchRejectedEmail({
      vendorEmail: vendorUser?.email ?? '[vendor email]',
      vendorName: vendor?.name ?? 'Vendor',
      vendorCode: vendor?.vendor_code ?? '—',
      loadNumber: rejectedLoad.loadNumber,
      rejectedOn: rejectedLoad.reviewedAt?.slice(0, 10) ?? '—',
      reviewNote: rejectedLoad.reviewNote,
    });
  }

  const isResubmit = submitLoad?.pushStatus === 'rejected';

  return (
    <main className="section">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <h1 style={{ margin: 0 }}><span className="accent-bar" />My Batches</h1>
        <Link
          href="/loads/new"
          style={{
            background: 'var(--color-navy-primary)',
            color: 'white',
            padding: '8px 18px',
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
      </div>

      {/* Submit to RE modal */}
      {submitLoad && (submitLoad.pushStatus === 'draft' || submitLoad.pushStatus === 'rejected') && (
        <div style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 100,
        }}>
          <div style={{
            background: 'var(--color-card-bg)',
            borderRadius: 12,
            padding: 28,
            maxWidth: 520,
            width: '90vw',
            boxShadow: '0 20px 40px rgba(0,0,0,0.25)',
          }}>
            <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--color-text-heading)', marginBottom: 6 }}>
              {isResubmit ? 'Re-Submit' : 'Submit'} Batch to RE Approval — Load {submitLoad.loadNumber}
            </div>
            <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 18 }}>
              {isResubmit && (
                <span style={{ color: 'var(--color-warning)', fontWeight: 600 }}>
                  Previously rejected.{' '}
                </span>
              )}
              This batch will be sent to Royal Enfield for review.
            </div>

            {/* Re-submission diff — #5 */}
            {resubmitDiff && (resubmitDiff.improved > 0 || resubmitDiff.regressed > 0) && (
              <div style={{
                background: 'var(--color-bg-page)',
                border: '1px solid var(--color-card-border)',
                borderRadius: 8,
                padding: '10px 14px',
                marginBottom: 16,
                fontSize: 12,
              }}>
                <div style={{ fontWeight: 600, marginBottom: 6, color: 'var(--color-text-heading)' }}>
                  vs. previous batch (Load {resubmitDiff.previousLoadNumber}):
                </div>
                <div style={{ display: 'flex', gap: 16 }}>
                  {resubmitDiff.improved > 0 && (
                    <span style={{ color: 'var(--color-success)', fontWeight: 700 }}>
                      ↑ {resubmitDiff.improved} improved
                    </span>
                  )}
                  {resubmitDiff.regressed > 0 && (
                    <span style={{ color: 'var(--color-danger)', fontWeight: 700 }}>
                      ↓ {resubmitDiff.regressed} regressed
                    </span>
                  )}
                </div>
              </div>
            )}

            <form action={pushLoadReport}>
              <input type="hidden" name="loadId" value={submitLoad.id} />
              <label style={{ display: 'block', marginBottom: 16 }}>
                <span style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>
                  Submission comments (required)
                </span>
                <textarea
                  name="pushNote"
                  required
                  rows={4}
                  placeholder={isResubmit
                    ? 'Describe what was corrected since the last rejection...'
                    : 'Add any comments or notes for the Royal Enfield review team...'}
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    padding: '10px 12px',
                    borderRadius: 6,
                    border: '1px solid var(--color-card-border)',
                    background: 'var(--color-bg-page)',
                    color: 'var(--color-text-body)',
                    fontSize: 13,
                    fontFamily: 'inherit',
                    resize: 'vertical',
                  }}
                />
              </label>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <a
                  href="/loads"
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
                    padding: '8px 20px',
                    borderRadius: 6,
                    fontSize: 13,
                    background: isResubmit ? 'var(--color-warning)' : 'var(--color-navy-primary)',
                    color: 'white',
                    border: 'none',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    fontWeight: 600,
                  }}
                >
                  {isResubmit ? 'Re-Submit to RE Approval' : 'Submit to RE Approval'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Rejection detail panel — #4 */}
      {rejectedLoad && (
        <div className="card" style={{ marginBottom: 24, borderLeft: '4px solid var(--color-danger)' }}>
          <div style={{ fontWeight: 700, color: 'var(--color-danger)', marginBottom: 8 }}>
            Rejection Notice — Load {rejectedLoad.loadNumber}
          </div>
          <p style={{ margin: '0 0 4px', fontSize: 13 }}>
            <strong>RE Reason:</strong> {rejectedLoad.reviewNote}
          </p>
          <p style={{ margin: '0 0 12px', fontSize: 12, color: '#6b7280' }}>
            Rejected on {rejectedLoad.reviewedAt?.slice(0, 10) ?? '—'}
          </p>
          {rejectedLoad.pushNote && (
            <p style={{ margin: '0 0 12px', fontSize: 13 }}>
              <strong>Your submission note:</strong> {rejectedLoad.pushNote}
            </p>
          )}
          <p style={{ margin: '0 0 8px', fontSize: 12, color: '#6b7280' }}>
            Please correct the issues and re-submit for approval.
          </p>
          {rejectionEmail && (
            <>
              <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 6, color: 'var(--color-text-heading)' }}>
                Draft notification email from Royal Enfield:
              </div>
              <pre style={{
                background: 'var(--color-bg-page)',
                border: '1px solid var(--color-card-border)',
                borderRadius: 6,
                padding: '12px 14px',
                fontSize: 12,
                fontFamily: 'monospace',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                margin: 0,
                color: 'var(--color-text-body)',
              }}>
                {rejectionEmail}
              </pre>
            </>
          )}
        </div>
      )}

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Batch #</th>
                <th>Part</th>
                <th>Uploaded</th>
                <th style={{ textAlign: 'right' }}>Readings</th>
                <th style={{ textAlign: 'right' }}>Pass Rate</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loads.map((load) => {
                const rate = load.total > 0 ? Math.round((load.passes / load.total) * 100) : null;
                const canSubmit = load.pushStatus === 'draft' || load.pushStatus === 'rejected';
                const isRejected = load.pushStatus === 'rejected';

                return (
                  <tr
                    key={load.id}
                    style={{ opacity: load.pushStatus === 'draft' ? 0.85 : 1 }}
                  >
                    <td><strong>{load.loadNumber}</strong></td>
                    <td style={{ color: '#6b7280', fontSize: 12 }}>{load.partNumber ?? '—'}</td>
                    <td style={{ color: '#6b7280', fontSize: 12 }}>{load.uploadedAt.slice(0, 16)}</td>
                    <td style={{ textAlign: 'right' }}>{load.total}</td>
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
                    <td>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        {canSubmit && (
                          <a
                            href={`/loads?submit=${load.id}`}
                            style={{
                              background: isRejected ? 'var(--color-warning)' : 'var(--color-navy-primary)',
                              color: 'white',
                              border: 'none',
                              borderRadius: 6,
                              padding: '4px 12px',
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
                            {isRejected ? 'Re-Submit' : 'Submit to RE'}
                          </a>
                        )}
                        {isRejected && (
                          <Link
                            href={`/loads?rejectedLoad=${load.id}`}
                            style={{
                              fontSize: 11,
                              color: 'var(--color-danger)',
                              textDecoration: 'underline',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            View Rejection
                          </Link>
                        )}
                        {load.pushStatus === 'pending' && (
                          <span style={{ fontSize: 11, color: '#9ca3af' }}>
                            Submitted {load.pushedAt?.slice(0, 10)}
                          </span>
                        )}
                        {load.pushStatus === 'approved' && (
                          <>
                            <span style={{ fontSize: 11, color: 'var(--color-success)' }}>
                              Approved {load.reviewedAt?.slice(0, 10)}
                            </span>
                            <Link
                              href={`/loads/${load.id}/certificate`}
                              style={{ fontSize: 11, color: 'var(--color-nav-active-text)', textDecoration: 'underline', whiteSpace: 'nowrap' }}
                            >
                              Certificate
                            </Link>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {loads.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', color: '#9ca3af', padding: 32 }}>
                    No batches uploaded yet.{' '}
                    <Link href="/loads/new" style={{ color: 'var(--color-navy-primary)' }}>Upload your first batch</Link>.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <p style={{ fontSize: 11, color: '#9ca3af', marginTop: 12 }}>
        Draft batches are only visible to you. Submit a batch with comments to send it to Royal Enfield for approval.
      </p>
    </main>
  );
}
