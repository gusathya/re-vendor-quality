import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getDb } from '@/lib/db/client';
import { getVendorLoads } from '@/lib/admin-queries';
import { draftBatchRejectedEmail } from '@/lib/email-templates';
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
  const viewRejectionId = typeof resolvedParams.rejectedLoad === 'string' ? resolvedParams.rejectedLoad : null;

  const db = getDb();
  const loads = getVendorLoads(db, vendorId);
  const rejectedLoad = viewRejectionId ? loads.find((l) => l.id === viewRejectionId) : null;

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

  return (
    <main className="section">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <h1 style={{ margin: 0 }}><span className="accent-bar" />My Load Reports</h1>
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
          + Upload New Load
        </Link>
      </div>

      {/* Rejection detail panel */}
      {rejectedLoad && (
        <div className="card" style={{ marginBottom: 24, borderLeft: '4px solid var(--color-danger)' }}>
          <div style={{ fontWeight: 700, color: 'var(--color-danger)', marginBottom: 8 }}>
            Rejection Notice — Load {rejectedLoad.loadNumber}
          </div>
          <p style={{ margin: '0 0 12px', fontSize: 13 }}>
            <strong>Reason:</strong> {rejectedLoad.reviewNote}
          </p>
          <p style={{ margin: '0 0 8px', fontSize: 12, color: '#6b7280' }}>
            Please correct the issues and re-push the batch for approval.
          </p>

          {rejectionEmail && (
            <>
              <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 6, color: 'var(--color-text-heading)' }}>
                Draft notification email from Royal Enfield:
              </div>
              <pre style={{
                background: '#f8fafc',
                border: '1px solid var(--color-card-border)',
                borderRadius: 6,
                padding: '12px 14px',
                fontSize: 12,
                fontFamily: 'monospace',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                margin: 0,
                color: '#334155',
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
                <th>Load #</th>
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
                const canPush = load.pushStatus === 'draft' || load.pushStatus === 'rejected';
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
                        {canPush && (
                          <form action={pushLoadReport} style={{ margin: 0 }}>
                            <input type="hidden" name="loadId" value={load.id} />
                            <button
                              type="submit"
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
                              }}
                            >
                              {isRejected ? 'Re-Push' : 'Push to RE'}
                            </button>
                          </form>
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
                            Pushed {load.pushedAt?.slice(0, 10)}
                          </span>
                        )}
                        {load.pushStatus === 'approved' && (
                          <span style={{ fontSize: 11, color: 'var(--color-success)' }}>
                            Approved {load.reviewedAt?.slice(0, 10)}
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {loads.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', color: '#9ca3af', padding: 32 }}>
                    No loads uploaded yet.{' '}
                    <Link href="/loads/new" style={{ color: 'var(--color-navy-primary)' }}>Upload your first load</Link>.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <p style={{ fontSize: 11, color: '#9ca3af', marginTop: 12 }}>
        Draft loads are only visible to you and the admin. Push a batch to submit it to Royal Enfield for approval.
      </p>
    </main>
  );
}
