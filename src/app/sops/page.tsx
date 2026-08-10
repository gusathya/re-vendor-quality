import Link from 'next/link';
import { getDb } from '@/lib/db/client';

export default function SopsPage() {
  const docs = getDb()
    .prepare(
      `SELECT d.id, d.status, d.uploaded_at AS uploadedAt, v.name AS vendorName
       FROM sop_documents d JOIN vendors v ON v.id = d.vendor_id ORDER BY d.uploaded_at DESC`,
    )
    .all() as { id: string; status: string; uploadedAt: string; vendorName: string }[];

  return (
    <main className="section">
      <h1>
        <span className="accent-bar" />
        SOP Library
      </h1>
      <Link href="/sops/new">Feed a new SOP</Link>
      <ul>
        {docs.map((d) => (
          <li key={d.id}>
            <Link href={`/sops/${d.id}`}>
              {d.vendorName} — {d.status} — {d.uploadedAt}
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
