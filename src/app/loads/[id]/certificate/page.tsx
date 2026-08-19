import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getDb } from '@/lib/db/client';

interface CertLoad {
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
  reviewerEmail: string | null;
}

export default async function CertificatePage({
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
         lr.id, lr.load_number AS loadNumber, lr.part_number AS partNumber,
         lr.push_status AS pushStatus, lr.pushed_at AS pushedAt,
         lr.push_note AS pushNote, lr.reviewed_at AS reviewedAt,
         lr.review_note AS reviewNote, lr.uploaded_at AS uploadedAt,
         v.name AS vendorName, v.vendor_code AS vendorCode,
         (SELECT email FROM users WHERE id = lr.reviewed_by LIMIT 1) AS reviewerEmail
       FROM load_reports lr JOIN vendors v ON v.id = lr.vendor_id WHERE lr.id = ?`,
    )
    .get(id) as CertLoad | undefined;

  if (!load || load.pushStatus !== 'approved') redirect('/loads');

  if (role === 'vendor') {
    const owns = db.prepare('SELECT 1 FROM load_reports WHERE id = ? AND vendor_id = ?').get(id, session.user.vendorId ?? '');
    if (!owns) redirect('/loads');
  } else if (role !== 'admin' && role !== 'customer') {
    redirect('/');
  }

  const scored = db
    .prepare(`SELECT COUNT(*) AS total, SUM(CASE WHEN score = 'pass' THEN 1 ELSE 0 END) AS passes
              FROM load_readings WHERE load_report_id = ? AND score != 'unscored'`)
    .get(id) as { total: number; passes: number };

  const passRate = scored.total > 0 ? Math.round((scored.passes / scored.total) * 100) : 0;
  const certDate = load.reviewedAt?.slice(0, 10) ?? load.uploadedAt.slice(0, 10);

  return (
    <>
      <style>{`
        @media print {
          body > header, body > nav, body > footer, .no-print { display: none !important; }
          main { padding: 0 !important; max-width: none !important; }
          .cert-page { border: 2px solid #1e3a5f !important; }
        }
      `}</style>

      <main className="section">
        <div className="no-print" style={{ marginBottom: 20, display: 'flex', gap: 12, alignItems: 'center' }}>
          <a href="/loads" style={{ fontSize: 13, color: 'var(--color-nav-active-text)', textDecoration: 'none' }}>
            ← Back to My Batches
          </a>
          <button
            onClick={() => {}}
            style={{
              marginLeft: 'auto',
              background: 'var(--color-navy-primary)',
              color: 'white',
              border: 'none',
              borderRadius: 6,
              padding: '8px 18px',
              fontSize: 13,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            {...{ onClick: 'window.print()' } as any}
          >
            Save as PDF
          </button>
        </div>

        <div className="cert-page" style={{
          maxWidth: 680,
          margin: '0 auto',
          border: '2px solid var(--color-navy-primary)',
          borderRadius: 12,
          padding: '40px 48px',
          background: 'var(--color-card-bg)',
        }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32 }}>
            <div>
              <div style={{
                background: 'var(--color-red-accent)',
                color: 'white',
                width: 48,
                height: 48,
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: 'Share Tech, monospace',
                fontWeight: 700,
                fontSize: 18,
                marginBottom: 8,
              }}>RE</div>
              <div style={{ fontFamily: 'Share Tech, monospace', fontSize: 14, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--color-text-heading)' }}>
                Royal Enfield
              </div>
              <div style={{ fontSize: 11, color: '#6b7280', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                Vendor Quality Division
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 11, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
                Certificate No.
              </div>
              <div style={{ fontFamily: 'Share Tech, monospace', fontWeight: 700, fontSize: 14, color: 'var(--color-text-heading)' }}>
                RE-VQ-{load.loadNumber}
              </div>
            </div>
          </div>

          {/* Title */}
          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#6b7280', marginBottom: 8 }}>
              Certificate of Quality Compliance
            </div>
            <div style={{ width: 80, height: 3, background: 'var(--color-red-accent)', margin: '0 auto 16px' }} />
            <p style={{ fontSize: 13, color: 'var(--color-text-body)', lineHeight: 1.7, margin: 0 }}>
              This certifies that the batch identified below has been reviewed by Royal Enfield
              and found to comply with the applicable Standard Operating Procedure (SOP) limits.
            </p>
          </div>

          {/* Details grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 24px', marginBottom: 28 }}>
            {[
              ['Vendor', load.vendorCode ? `[${load.vendorCode}] ${load.vendorName}` : load.vendorName],
              ['Batch / Load #', load.loadNumber],
              ['Part Number', load.partNumber ?? '—'],
              ['Date Submitted', load.pushedAt?.slice(0, 10) ?? '—'],
              ['Date Approved', certDate],
              ['Pass Rate', `${passRate}% (${scored.passes}/${scored.total} readings)`],
            ].map(([label, value]) => (
              <div key={label} style={{ borderBottom: '1px solid var(--color-card-border)', paddingBottom: 8 }}>
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#9ca3af', marginBottom: 3 }}>
                  {label}
                </div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-heading)' }}>{value}</div>
              </div>
            ))}
          </div>

          {/* Approval note */}
          {load.reviewNote && (
            <div style={{
              background: 'var(--color-bg-page)',
              border: '1px solid var(--color-card-border)',
              borderRadius: 6,
              padding: '10px 14px',
              marginBottom: 28,
            }}>
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#9ca3af', marginBottom: 4 }}>
                RE Approval Note
              </div>
              <div style={{ fontSize: 13, color: 'var(--color-text-body)', lineHeight: 1.6 }}>{load.reviewNote}</div>
            </div>
          )}

          {/* Pass rate indicator */}
          <div style={{ marginBottom: 32 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#9ca3af', marginBottom: 4 }}>
              <span>Pass Rate</span>
              <span style={{ fontWeight: 700, color: passRate >= 90 ? 'var(--color-success)' : 'var(--color-warning)' }}>{passRate}%</span>
            </div>
            <div style={{ background: 'var(--color-card-border)', borderRadius: 4, height: 10, overflow: 'hidden' }}>
              <div style={{
                width: `${passRate}%`,
                height: '100%',
                background: passRate >= 90 ? 'var(--color-success)' : passRate >= 70 ? 'var(--color-warning)' : 'var(--color-danger)',
                borderRadius: 4,
              }} />
            </div>
          </div>

          {/* Signature area */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, borderTop: '1px solid var(--color-card-border)', paddingTop: 24 }}>
            <div>
              <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#9ca3af', marginBottom: 24 }}>
                Approved By
              </div>
              <div style={{ borderBottom: '1px solid var(--color-card-border)', marginBottom: 6 }} />
              <div style={{ fontSize: 12, color: 'var(--color-text-body)' }}>{load.reviewerEmail ?? 'Royal Enfield Quality Team'}</div>
            </div>
            <div>
              <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#9ca3af', marginBottom: 24 }}>
                Date of Approval
              </div>
              <div style={{ borderBottom: '1px solid var(--color-card-border)', marginBottom: 6 }} />
              <div style={{ fontSize: 12, color: 'var(--color-text-body)' }}>{certDate}</div>
            </div>
          </div>

          <div style={{ textAlign: 'center', marginTop: 24, fontSize: 10, color: '#9ca3af' }}>
            This certificate is issued by the Royal Enfield Vendor Quality Dashboard system.
          </div>
        </div>
      </main>

      <script dangerouslySetInnerHTML={{
        __html: `
          document.querySelectorAll('button[onclick="window.print()"]').forEach(function(btn) {
            btn.removeAttribute('onclick');
            btn.addEventListener('click', function() { window.print(); });
          });
        `,
      }} />
    </>
  );
}
