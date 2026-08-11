import { getDb } from '@/lib/db/client';
import { getParameterCapability, listScoredParameterNames } from '@/lib/dashboard-queries';
import { requireVendorSession } from '@/lib/require-vendor-session';
import { DashboardShell } from '@/components/DashboardShell';

export default async function CapabilityPage() {
  const vendorSession = await requireVendorSession();
  if (!vendorSession) return <main className="section">Sign in as a vendor user to see the dashboard.</main>;

  const { vendorId } = vendorSession;
  const db = getDb();
  const allParams = listScoredParameterNames(db, vendorId);
  const results = allParams.map((name) => getParameterCapability(db, vendorId, name));

  return (
    <DashboardShell vendorId={vendorId}>
      <h2>Process Capability</h2>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Parameter</th>
              <th>Samples</th>
              <th style={{ width: 220 }}>Avg. Headroom from Limit</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {results.map((r) => {
              const isOut = r.avgDistanceFromLimit !== null && r.avgDistanceFromLimit < 0;
              const isGood = r.avgDistanceFromLimit !== null && r.avgDistanceFromLimit >= 0;
              return (
                <tr key={r.parameterName} className={isOut ? 'out-of-limit' : ''}>
                  <td><strong>{r.parameterName}</strong></td>
                  <td>{r.sampleCount}</td>
                  <td>
                    {r.avgDistanceFromLimit === null ? (
                      <span style={{ color: '#9ca3af' }}>No scored data</span>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ fontWeight: 700, color: isOut ? 'var(--color-danger)' : 'var(--color-success)', minWidth: 48 }}>
                          {r.avgDistanceFromLimit > 0 ? '+' : ''}{r.avgDistanceFromLimit.toFixed(2)}
                        </span>
                        <div style={{ flex: 1, height: 8, background: '#f1f5f9', borderRadius: 4, overflow: 'hidden', maxWidth: 120 }}>
                          <div style={{
                            height: '100%',
                            width: isOut ? '100%' : `${Math.min(100, (r.avgDistanceFromLimit / 20) * 100)}%`,
                            background: isOut ? 'var(--color-danger)' : 'var(--color-success)',
                            borderRadius: 4,
                          }} />
                        </div>
                      </div>
                    )}
                  </td>
                  <td>
                    {r.avgDistanceFromLimit === null
                      ? <span className="badge badge-unscored">No data</span>
                      : isOut
                        ? <span className="badge badge-fail">Out of limit</span>
                        : <span className="badge badge-pass">In control</span>
                    }
                  </td>
                </tr>
              );
            })}
            {results.length === 0 && (
              <tr><td colSpan={4} style={{ textAlign: 'center', color: '#9ca3af', padding: 24 }}>Upload load reports to see capability data.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <p style={{ fontSize: 12, color: '#9ca3af', marginTop: 12 }}>
        Headroom = average distance of readings from their nearest SOP limit. Positive = inside limit. Negative = outside limit.
      </p>
    </DashboardShell>
  );
}
