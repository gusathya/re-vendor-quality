import type { ReactNode } from 'react';
import { getDb } from '@/lib/db/client';
import { getKpis, type DashboardFilters } from '@/lib/dashboard-queries';
import { KpiStrip } from '@/components/KpiStrip';
import { DashboardTabs } from '@/components/DashboardTabs';

// Shared wrapper for all 5 dashboard tab pages (Table, Trends, Hotspots, Compare, Capability):
// each one renders the same "<h1>Vendor Dashboard</h1> + KPI strip + tab nav" header around
// page-specific content. Extracted once this pattern was about to be copy-pasted a 5th time
// (Task 21). Auth is deliberately NOT this component's job — callers must call
// requireVendorSession() themselves first and pass the resolved vendorId, since several pages
// (Trends, Compare, Capability) need that vendorId for their OWN additional queries beyond just
// the KPI strip, not just for this shell.
export function DashboardShell({
  vendorId,
  filters = {},
  children,
}: {
  vendorId: string;
  filters?: DashboardFilters;
  children: ReactNode;
}) {
  const db = getDb();
  const kpis = getKpis(db, vendorId, filters);

  return (
    <main className="section">
      <h1>
        <span className="accent-bar" />
        Vendor Dashboard
      </h1>
      <KpiStrip kpis={kpis} />
      <DashboardTabs />
      {children}
    </main>
  );
}
