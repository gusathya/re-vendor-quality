import type { Kpis } from '@/lib/dashboard-queries';

export function KpiStrip({ kpis }: { kpis: Kpis }) {
  const passRate = Math.round(kpis.passRate * 100);
  const passRateColor = passRate >= 90 ? 'var(--color-success)' : passRate >= 70 ? 'var(--color-warning)' : 'var(--color-danger)';
  const passRateClass = passRate >= 90 ? 'green' : passRate >= 70 ? '' : 'red';

  return (
    <div className="kpi-grid">
      <div className={`kpi-card ${passRateClass}`}>
        <div className="kpi-card-label">Pass Rate</div>
        <div className="kpi-card-value" style={{ color: passRateColor }}>{passRate}%</div>
        <div className="kpi-card-sub">of scored readings</div>
      </div>
      <div className={`kpi-card ${kpis.outOfLimitCount === 0 ? 'green' : 'red'}`}>
        <div className="kpi-card-label">Out of Limit</div>
        <div className="kpi-card-value" style={{ color: kpis.outOfLimitCount === 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>
          {kpis.outOfLimitCount}
        </div>
        <div className="kpi-card-sub">failed readings</div>
      </div>
      <div className="kpi-card navy">
        <div className="kpi-card-label">Scored Readings</div>
        <div className="kpi-card-value">{kpis.totalReadings}</div>
        <div className="kpi-card-sub">across all loads</div>
      </div>
    </div>
  );
}
