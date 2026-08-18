import { getDraftParameters, activateSop } from './actions';
import { SopReviewTable } from '@/components/SopReviewTable';
import { getDb } from '@/lib/db/client';
import { getStationAliasesForVendor } from '@/lib/db/station-aliases';
import { getVendorById } from '@/lib/db/vendors';
import { auth } from '@/lib/auth';
import { draftNewSopEmail } from '@/lib/email-templates';

// Next.js 16 passes route params as a Promise to Server Components, so it must be
// awaited before use (see next/dist/docs/01-app/01-getting-started/03-layouts-and-pages.md).
export default async function SopReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const session = await auth();
  const role = session?.user?.role;
  const sessionVendorId = session?.user?.vendorId ?? null;

  const db = getDb();
  const doc = db
    .prepare('SELECT vendor_id AS vendorId, status, activated_at AS activatedAt FROM sop_documents WHERE id = ?')
    .get(id) as { vendorId: string; status: string; activatedAt: string | null } | undefined;
  if (!doc) return <main className="section">SOP not found.</main>;

  // Vendors may only view their own SOPs.
  if (role === 'vendor' && doc.vendorId !== sessionVendorId) {
    return <main className="section">Not found.</main>;
  }

  const canEdit = role === 'admin' || role === 'customer';

  const parameters = await getDraftParameters(id);

  // Pre-fill the alias column with whatever's already saved for this vendor, so a
  // reviewer re-opening a draft (or one they just activated) can see prior alias
  // decisions instead of re-typing them. Reverse-index by station_group_key: if a
  // group key has more than one alias mapped to it, the first one found wins for the
  // pre-fill (the alias column only shows one name per row anyway).
  const aliases = getStationAliasesForVendor(db, doc.vendorId);
  const aliasByGroupKey: Record<string, string> = {};
  for (const alias of aliases) {
    if (!(alias.stationGroupKey in aliasByGroupKey)) {
      aliasByGroupKey[alias.stationGroupKey] = alias.loadReportStationName;
    }
  }

  // Resolve vendor details and contact email for the email panel (customer role only).
  const vendor = getVendorById(db, doc.vendorId);
  const vendorUserRow = db
    .prepare("SELECT email FROM users WHERE vendor_id = ? AND role = 'vendor' LIMIT 1")
    .get(doc.vendorId) as { email: string } | undefined;
  const vendorEmail = vendorUserRow?.email ?? '';

  const emailDraft = role === 'customer' && vendor && vendorEmail
    ? draftNewSopEmail({
        vendorEmail,
        vendorName: vendor.name,
        vendorCode: vendor.vendorCode ?? '',
        processName: vendor.processName,
        sopId: id,
        effectiveDate: doc.activatedAt?.split('T')[0] ?? new Date().toISOString().split('T')[0],
      })
    : null;

  return (
    <main className="section">
      <h1>
        <span className="accent-bar" />
        Review SOP — {vendor?.name ?? doc.vendorId} — status: {doc.status}
      </h1>

      <SopReviewTable
        parameters={parameters}
        vendorId={doc.vendorId}
        aliasByGroupKey={aliasByGroupKey}
        readOnly={!canEdit}
        sopDocumentId={canEdit ? id : undefined}
      />

      {canEdit && doc.status === 'draft' && (
        <form
          action={async () => {
            'use server';
            await activateSop(id, doc.vendorId);
          }}
        >
          <button type="submit">Activate SOP</button>
        </form>
      )}

      {role === 'customer' && emailDraft && (
        <section style={{ marginTop: '2rem' }}>
          <h2>
            <span className="accent-bar" />
            Notify Vendor
          </h2>
          <p style={{ marginBottom: 8 }}>
            Vendor contact: <strong>{vendorEmail}</strong>
          </p>
          <label style={{ marginBottom: 6 }}>Draft email — select all and copy, then send manually:</label>
          <textarea
            readOnly
            defaultValue={emailDraft}
            rows={14}
            style={{
              width: '100%',
              fontFamily: 'monospace',
              fontSize: 12,
              padding: '12px 14px',
              borderRadius: 6,
              border: '1px solid var(--color-card-border)',
              background: 'var(--color-bg-page)',
              color: 'var(--color-text-body)',
              resize: 'vertical',
              lineHeight: 1.6,
            }}
          />
          <p style={{ marginTop: 6, fontSize: 12, color: '#6b7280' }}>
            Attach the SOP file before sending.
          </p>
        </section>
      )}
    </main>
  );
}
