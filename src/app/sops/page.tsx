import Link from 'next/link';
import { getDb } from '@/lib/db/client';
import { auth } from '@/lib/auth';

export default async function SopsPage() {
  const session = await auth();
  const role = session?.user?.role;
  const vendorId = session?.user?.vendorId ?? null;

  const db = getDb();
  const docs =
    role === 'vendor' && vendorId
      ? (db
          .prepare(
            `SELECT d.id, d.status, d.uploaded_at AS uploadedAt, v.name AS vendorName
             FROM sop_documents d JOIN vendors v ON v.id = d.vendor_id
             WHERE d.vendor_id = ? ORDER BY d.uploaded_at DESC`,
          )
          .all(vendorId) as { id: string; status: string; uploadedAt: string; vendorName: string }[])
      : (db
          .prepare(
            `SELECT d.id, d.status, d.uploaded_at AS uploadedAt, v.name AS vendorName
             FROM sop_documents d JOIN vendors v ON v.id = d.vendor_id ORDER BY d.uploaded_at DESC`,
          )
          .all() as { id: string; status: string; uploadedAt: string; vendorName: string }[]);

  return (
    <main className="section">
      <h1>
        <span className="accent-bar" />
        SOP Library
      </h1>
      <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
        {role !== 'customer' && <Link href="/sops/new">Feed a new SOP</Link>}
        {role === 'vendor' && (
          <a href="/api/sops/download" style={{ fontSize: 13, color: 'var(--color-nav-active-text)', textDecoration: 'none', border: '1px solid var(--color-card-border)', borderRadius: 6, padding: '5px 14px' }}>
            ↓ Download Active SOP (.xlsx)
          </a>
        )}
      </div>
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
