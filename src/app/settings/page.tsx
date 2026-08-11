import { auth } from '@/lib/auth';
import { getDb } from '@/lib/db/client';
import { getAllVendors } from '@/lib/db/vendors';
import { getAllCategories } from '@/lib/db/vendor-categories';
import { redirect } from 'next/navigation';
import { saveFolderUrl, saveVendorMeta } from './actions';

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user) redirect('/login');
  if (session.user.role === 'customer') redirect('/customer');

  const isAdmin = session.user.role === 'admin';
  const db = getDb();
  const allVendors = isAdmin ? getAllVendors(db) : [];
  const categories = isAdmin ? getAllCategories(db) : [];

  // Vendor user: show read-only info for their own vendor
  const vendorForUser = !isAdmin && session.user.vendorId
    ? getAllVendors(db).find((v) => v.id === session.user.vendorId) ?? null
    : null;

  return (
    <main className="section">
      <h1><span className="accent-bar" />Settings</h1>

      {!isAdmin && (
        <div className="card" style={{ maxWidth: 640, marginBottom: 24 }}>
          <p style={{ fontSize: 13, color: '#6b7280', margin: 0 }}>
            Settings can only be modified by an admin. Contact your admin to update vendor details.
          </p>
          {vendorForUser && (
            <div style={{ marginTop: 16, fontSize: 13 }}>
              <div><strong>Vendor:</strong> {vendorForUser.name}</div>
              <div><strong>Process:</strong> {vendorForUser.processName}</div>
              {vendorForUser.vendorCode && <div><strong>Vendor Code:</strong> {vendorForUser.vendorCode}</div>}
              {vendorForUser.categoryName && <div><strong>Category:</strong> {vendorForUser.categoryName}</div>}
            </div>
          )}
        </div>
      )}

      {isAdmin && (
        <>
          {/* Vendor classification */}
          <div className="card" style={{ maxWidth: 680, marginBottom: 28 }}>
            <h2 style={{ marginTop: 0 }}>Vendor Classification</h2>
            <p style={{ fontSize: 13, color: '#6b7280', marginTop: 0, marginBottom: 20 }}>
              Assign a commodity category and a unique vendor code (e.g. UP-001) to each vendor.
              These appear on admin dashboards and draft email notifications.
            </p>

            {allVendors.map((vendor) => (
              <form key={vendor.id} action={saveVendorMeta} style={{ marginBottom: 24, paddingBottom: 24, borderBottom: '1px solid var(--color-card-border)' }}>
                <input type="hidden" name="vendorId" value={vendor.id} />
                <div style={{ fontWeight: 700, marginBottom: 12, color: 'var(--color-text-heading)' }}>
                  {vendor.name}
                  <span style={{ fontWeight: 400, fontSize: 12, color: '#9ca3af', marginLeft: 8 }}>{vendor.processName}</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                  <label>
                    Category
                    <select
                      name="categoryId"
                      defaultValue={vendor.categoryId ?? ''}
                      style={{ marginTop: 6 }}
                    >
                      <option value="">— Uncategorised —</option>
                      {categories.map((cat) => (
                        <option key={cat.id} value={cat.id}>{cat.name}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Vendor Code
                    <input
                      type="text"
                      name="vendorCode"
                      defaultValue={vendor.vendorCode ?? ''}
                      placeholder="e.g. UP-001"
                      style={{ marginTop: 6 }}
                    />
                  </label>
                </div>
                <button type="submit" style={{ padding: '7px 16px', fontSize: 11 }}>Save Classification</button>
              </form>
            ))}

            {allVendors.length === 0 && (
              <p style={{ color: '#9ca3af', fontSize: 13 }}>No vendors found. Run the seed script to create demo data.</p>
            )}
          </div>

          {/* Folder URL links */}
          <div className="card" style={{ maxWidth: 680 }}>
            <h2 style={{ marginTop: 0 }}>Vendor File Folder Links</h2>
            <p style={{ fontSize: 13, color: '#6b7280', marginTop: 0, marginBottom: 20 }}>
              Link each vendor to their Google Drive, SharePoint, or any folder URL.
              The link appears as a &quot;View Files&quot; button on their dashboard.
            </p>

            {allVendors.map((vendor) => (
              <form key={vendor.id} action={saveFolderUrl} style={{ marginBottom: 24, paddingBottom: 24, borderBottom: '1px solid var(--color-card-border)' }}>
                <input type="hidden" name="vendorId" value={vendor.id} />
                <div style={{ marginBottom: 10 }}>
                  <label>
                    {vendor.name}
                    <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 8 }}>{vendor.processName}</div>
                    <input
                      type="url"
                      name="folderUrl"
                      defaultValue={vendor.folderUrl ?? ''}
                      placeholder="https://drive.google.com/drive/folders/..."
                    />
                  </label>
                </div>
                <button type="submit" style={{ padding: '7px 16px', fontSize: 11 }}>Save Link</button>
              </form>
            ))}

            {allVendors.length === 0 && (
              <p style={{ color: '#9ca3af', fontSize: 13 }}>No vendors found.</p>
            )}
          </div>
        </>
      )}
    </main>
  );
}
