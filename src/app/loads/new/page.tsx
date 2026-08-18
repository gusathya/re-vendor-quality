import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getDb } from '@/lib/db/client';
import { getAllVendors, getVendorById } from '@/lib/db/vendors';
import { uploadLoadReport } from './actions';

export default async function NewLoadPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await auth();
  if (!session?.user) redirect('/login');

  const resolvedParams = await searchParams;
  const error = typeof resolvedParams.error === 'string' ? resolvedParams.error : null;

  const db = getDb();
  const role = session.user.role;
  const sessionVendorId = session.user.vendorId ?? null;

  // Vendor role: lock to their own vendor only.
  // Admin/customer: show all vendors sorted by category then name.
  let vendors;
  if (role === 'vendor' && sessionVendorId) {
    const v = getVendorById(db, sessionVendorId);
    vendors = v ? [v] : [];
  } else {
    vendors = getAllVendors(db);
  }

  return (
    <main className="section">
      <h1>
        <span className="accent-bar" />
        Upload Batch
      </h1>
      {error && (
        <div style={{
          background: 'var(--color-danger-bg, #fee2e2)',
          border: '1px solid var(--color-danger)',
          borderRadius: 8,
          padding: '12px 16px',
          marginBottom: 20,
          color: 'var(--color-danger)',
          fontSize: 13,
        }}>
          <strong>Upload failed:</strong> {error}
        </div>
      )}

      <form action={uploadLoadReport}>
        <label>
          Vendor
          <select name="vendorName" required>
            {vendors.length === 0 && (
              <option value="" disabled>No vendors found</option>
            )}
            {vendors.map((v) => (
              <option key={v.id} value={v.name}>
                {v.categoryName ? `[${v.categoryName}] ` : ''}{v.name}{v.vendorCode ? ` (${v.vendorCode})` : ''}
              </option>
            ))}
          </select>
        </label>
        <label>
          Load report file (.xls / .xlsx)
          <input type="file" name="loadFile" accept=".xls,.xlsx" required />
        </label>
        <button type="submit">Upload &amp; Score</button>
      </form>
    </main>
  );
}
