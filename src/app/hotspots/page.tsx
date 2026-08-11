import { getDb } from '@/lib/db/client';
import { getKpis, getStationHotspots, getParameterHotspots } from '@/lib/dashboard-queries';
import { requireVendorSession } from '@/lib/require-vendor-session';
import { KpiStrip } from '@/components/KpiStrip';
import { DashboardTabs } from '@/components/DashboardTabs';

export default async function HotspotsPage() {
  const vendorSession = await requireVendorSession();
  if (!vendorSession) return <main className="section">Sign in as a vendor user to see the dashboard.</main>;

  const db = getDb();
  const kpis = getKpis(db, vendorSession.vendorId, {});
  const stations = getStationHotspots(db, vendorSession.vendorId);
  const params = getParameterHotspots(db, vendorSession.vendorId);

  return (
    <main className="section">
      <h1><span className="accent-bar" />Vendor Dashboard</h1>
      <KpiStrip kpis={kpis} />
      <DashboardTabs />
      <div style={{ display: 'flex', gap: 24 }}>
        <div>
          <h2>Most-failed stations</h2>
          <ol>{stations.map((s) => <li key={s.stationName}>{s.stationName} — {s.failCount}</li>)}</ol>
        </div>
        <div>
          <h2>Most-failed parameters</h2>
          <ol>{params.map((p) => <li key={p.parameterName}>{p.parameterName} — {p.failCount}</li>)}</ol>
        </div>
      </div>
    </main>
  );
}
