import type { Kpis } from '@/lib/dashboard-queries';

export function KpiStrip({ kpis }: { kpis: Kpis }) {
  return (
    <div className="kpi-strip" style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
      <div className="kpi-card">Pass Rate<br /><strong>{Math.round(kpis.passRate * 100)}%</strong></div>
      <div className="kpi-card">Scored Readings<br /><strong>{kpis.totalReadings}</strong></div>
      <div className="kpi-card">Out of Limit<br /><strong>{kpis.outOfLimitCount}</strong></div>
    </div>
  );
}
