import { auth } from '@/lib/auth';
import { getDb } from '@/lib/db/client';
import { getManualChecksForVendor } from '@/lib/db/manual-checks';
import Link from 'next/link';

export default async function InspectionsPage() {
  const session = await auth();
  if (!session?.user?.vendorId) return <main className="section">Sign in as a vendor user to view checks.</main>;

  const checks = getManualChecksForVendor(getDb(), session.user.vendorId);

  return (
    <main className="section">
      <h1>
        <span className="accent-bar" />
        Manual Check Log
      </h1>
      <Link href="/inspections/new">Log a new check</Link>
      <table>
        <thead>
          <tr>
            <th>Checked At</th>
            <th>Value</th>
            <th>Score</th>
          </tr>
        </thead>
        <tbody>
          {checks.map((c) => (
            <tr key={c.id} className={c.score === 'fail' ? 'out-of-limit' : ''}>
              <td>{c.checkedAt}</td>
              <td>{c.value}</td>
              <td>{c.score}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
