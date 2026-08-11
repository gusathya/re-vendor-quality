import { auth } from '@/lib/auth';
import { getDb } from '@/lib/db/client';
import { getAllVendors } from '@/lib/db/vendors';
import { redirect } from 'next/navigation';
import { saveFolderUrl } from './actions';

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user) redirect('/login');

  const isAdmin = session.user.role === 'admin';
  const db = getDb();
  const vendors = isAdmin
    ? getAllVendors(db)
    : session.user.vendorId
      ? [{ id: session.user.vendorId, name: '', processName: '', folderUrl: null }]
      : [];

  const allVendors = getAllVendors(db);

  return (
    <main className="section">
      <h1><span className="accent-bar" />Settings</h1>

      <div className="card" style={{ maxWidth: 640 }}>
        <h2>Vendor File Folder Links</h2>
        <p style={{ fontSize: 13, color: '#6b7280', marginTop: 0, marginBottom: 20 }}>
          Link each vendor to their Google Drive, SharePoint, or any folder URL.
          The link appears as a &quot;View Files&quot; button on their dashboard.
          {!isAdmin && ' Contact an admin to update this setting.'}
        </p>

        {allVendors.map((vendor) => (
          <form key={vendor.id} action={saveFolderUrl} style={{ marginBottom: 24, paddingBottom: 24, borderBottom: '1px solid var(--color-card-border)' }}>
            <input type="hidden" name="vendorId" value={vendor.id} />
            <div style={{ marginBottom: 10 }}>
              <label>{vendor.name}</label>
              <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 8 }}>{vendor.processName}</div>
              <input
                type="url"
                name="folderUrl"
                defaultValue={vendor.folderUrl ?? ''}
                placeholder="https://drive.google.com/drive/folders/..."
                disabled={!isAdmin}
                style={{ opacity: isAdmin ? 1 : 0.6 }}
              />
            </div>
            {isAdmin && (
              <button type="submit" style={{ padding: '7px 16px', fontSize: 11 }}>Save Link</button>
            )}
          </form>
        ))}

        {allVendors.length === 0 && (
          <p style={{ color: '#9ca3af', fontSize: 13 }}>No vendors found. Run the seed script to create demo data.</p>
        )}
      </div>
    </main>
  );
}
