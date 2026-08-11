import { getDb } from '@/lib/db/client';
import { getStationHotspots, getParameterHotspots, getHeatmapData } from '@/lib/dashboard-queries';
import { requireVendorSession } from '@/lib/require-vendor-session';
import { DashboardShell } from '@/components/DashboardShell';
import { HotspotChart } from '@/components/charts/HotspotChart';
import { HeatmapGrid } from '@/components/HeatmapGrid';

export default async function HotspotsPage() {
  const vendorSession = await requireVendorSession();
  if (!vendorSession) return <main className="section">Sign in as a vendor user to see the dashboard.</main>;

  const db = getDb();
  const { vendorId } = vendorSession;
  const stations = getStationHotspots(db, vendorId);
  const params = getParameterHotspots(db, vendorId);
  const heatmap = getHeatmapData(db, vendorId);

  return (
    <DashboardShell vendorId={vendorId}>
      <div className="grid-2" style={{ marginBottom: 24 }}>
        <div className="chart-card">
          <div className="chart-title">Most-Failed Stations</div>
          <HotspotChart data={stations.map((s) => ({ name: s.stationName, failCount: s.failCount }))} />
        </div>
        <div className="chart-card">
          <div className="chart-title">Most-Failed Parameters</div>
          <HotspotChart data={params.map((p) => ({ name: p.parameterName, failCount: p.failCount }))} />
        </div>
      </div>

      <div className="chart-card">
        <div className="chart-title">Pass Rate Heatmap — Station × Parameter</div>
        <HeatmapGrid data={heatmap} />
      </div>
    </DashboardShell>
  );
}
