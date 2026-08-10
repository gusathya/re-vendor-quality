import { getDraftParameters, activateSop } from './actions';
import { SopReviewTable } from '@/components/SopReviewTable';
import { getDb } from '@/lib/db/client';
import { getStationAliasesForVendor } from '@/lib/db/station-aliases';

// Next.js 16 passes route params as a Promise to Server Components, so it must be
// awaited before use (see next/dist/docs/01-app/01-getting-started/03-layouts-and-pages.md).
export default async function SopReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const doc = getDb()
    .prepare('SELECT vendor_id AS vendorId, status FROM sop_documents WHERE id = ?')
    .get(id) as { vendorId: string; status: string } | undefined;
  if (!doc) return <main className="section">SOP not found.</main>;

  const parameters = await getDraftParameters(id);

  // Pre-fill the alias column with whatever's already saved for this vendor, so a
  // reviewer re-opening a draft (or one they just activated) can see prior alias
  // decisions instead of re-typing them. Reverse-index by station_group_key: if a
  // group key has more than one alias mapped to it, the first one found wins for the
  // pre-fill (the alias column only shows one name per row anyway).
  const aliases = getStationAliasesForVendor(getDb(), doc.vendorId);
  const aliasByGroupKey: Record<string, string> = {};
  for (const alias of aliases) {
    if (!(alias.stationGroupKey in aliasByGroupKey)) {
      aliasByGroupKey[alias.stationGroupKey] = alias.loadReportStationName;
    }
  }

  return (
    <main className="section">
      <h1>
        <span className="accent-bar" />
        Review SOP — status: {doc.status}
      </h1>
      <SopReviewTable parameters={parameters} vendorId={doc.vendorId} aliasByGroupKey={aliasByGroupKey} />
      {doc.status === 'draft' && (
        <form
          action={async () => {
            'use server';
            await activateSop(id, doc.vendorId);
          }}
        >
          <button type="submit">Activate SOP</button>
        </form>
      )}
    </main>
  );
}
