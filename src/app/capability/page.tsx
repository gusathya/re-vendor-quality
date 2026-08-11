import { getDb } from '@/lib/db/client';
import { getParameterCapability } from '@/lib/dashboard-queries';
import { requireVendorSession } from '@/lib/require-vendor-session';
import { DashboardShell } from '@/components/DashboardShell';

const TRACKED_PARAMETERS = ['Temperature', 'Act. Current'];

// No searchParams here (same as Hotspots) — this page has no filterable state of its own.
export default async function CapabilityPage() {
  const vendorSession = await requireVendorSession();
  if (!vendorSession) return <main className="section">Sign in as a vendor user to see the dashboard.</main>;

  const { vendorId } = vendorSession;
  const db = getDb();
  const results = TRACKED_PARAMETERS.map((name) => getParameterCapability(db, vendorId, name));

  return (
    <DashboardShell vendorId={vendorId}>
      <h2>Process capability</h2>
      <table>
        <thead>
          <tr>
            <th>Parameter</th>
            <th>Samples</th>
            <th>Avg. distance from nearest limit</th>
          </tr>
        </thead>
        <tbody>
          {results.map((r) => (
            <tr key={r.parameterName} className={r.avgDistanceFromLimit !== null && r.avgDistanceFromLimit < 0 ? 'out-of-limit' : ''}>
              <td>{r.parameterName}</td>
              <td>{r.sampleCount}</td>
              <td>{r.avgDistanceFromLimit === null ? 'No scored data yet' : r.avgDistanceFromLimit.toFixed(1)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p>Positive = average headroom inside the limit. Negative = averaging outside the limit.</p>
    </DashboardShell>
  );
}
