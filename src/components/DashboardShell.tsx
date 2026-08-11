import type { ReactNode } from 'react';
import { getDb } from '@/lib/db/client';
import { getKpis, type DashboardFilters } from '@/lib/dashboard-queries';
import { getVendorById } from '@/lib/db/vendors';
import { KpiStrip } from '@/components/KpiStrip';
import { DashboardTabs } from '@/components/DashboardTabs';

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
  const vendor = getVendorById(db, vendorId);

  return (
    <main className="section">
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 4 }}>
        <h1 style={{ marginBottom: 0 }}>
          <span className="accent-bar" />
          Vendor Dashboard
          {vendor && (
            <span style={{ fontSize: 12, fontWeight: 400, color: '#6b7280', marginLeft: 12, textTransform: 'none', letterSpacing: 0 }}>
              {vendor.name} — {vendor.processName}
            </span>
          )}
        </h1>
        {vendor?.folderUrl && (
          <a
            href={vendor.folderUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '7px 14px',
              background: 'var(--color-navy-primary)',
              color: 'white',
              borderRadius: 6,
              fontSize: 12,
              fontFamily: 'Share Tech, monospace',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              textDecoration: 'none',
              whiteSpace: 'nowrap',
              flexShrink: 0,
            }}
          >
            📁 View Files
          </a>
        )}
      </div>
      <div style={{ marginBottom: 20 }} />
      <KpiStrip kpis={kpis} />
      <DashboardTabs />
      {children}
    </main>
  );
}
