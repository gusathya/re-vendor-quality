import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getDb } from '@/lib/db/client';
import { getAllVendors, getVendorById } from '@/lib/db/vendors';
import { uploadLoadReport } from './actions';

export default async function NewLoadPage() {
  const session = await auth();
  if (!session?.user) redirect('/login');

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
        Upload Load Report
      </h1>
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
          Load report file (.xls)
          <input type="file" name="loadFile" accept=".xls" required />
        </label>
        <button type="submit">Upload &amp; Score</button>
      </form>
    </main>
  );
}
