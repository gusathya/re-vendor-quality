import type { HeatmapCell } from '@/lib/dashboard-queries';

interface HeatmapGridProps {
  data: HeatmapCell[];
}

function cellBg(passes: number, total: number) {
  const r = passes / total;
  if (r >= 0.9) return '#dcfce7';
  if (r >= 0.7) return '#fef9c3';
  return '#fee2e2';
}
function cellFg(passes: number, total: number) {
  const r = passes / total;
  if (r >= 0.9) return '#166534';
  if (r >= 0.7) return '#92400e';
  return '#991b1b';
}

export function HeatmapGrid({ data }: HeatmapGridProps) {
  if (data.length === 0) {
    return <p style={{ color: '#9ca3af', fontSize: 13 }}>No scored data to display.</p>;
  }

  const stations = [...new Set(data.map((d) => d.stationName))].sort();
  const parameters = [...new Set(data.map((d) => d.parameterName))].sort();
  const lookup = new Map(data.map((d) => [`${d.stationName}||${d.parameterName}`, d]));

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ borderCollapse: 'collapse', fontSize: 11, minWidth: 400 }}>
        <thead>
          <tr>
            <th style={{ padding: '7px 12px', background: 'var(--color-navy-primary)', color: 'white', textAlign: 'left', whiteSpace: 'nowrap', minWidth: 130 }}>
              Station ↓ / Param →
            </th>
            {parameters.map((p) => (
              <th key={p} title={p} style={{ padding: '7px 8px', background: 'var(--color-navy-primary)', color: 'white', textAlign: 'center', maxWidth: 90, fontSize: 10, fontWeight: 600, letterSpacing: '0.04em' }}>
                <div style={{ maxWidth: 88, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p}</div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {stations.map((station) => (
            <tr key={station}>
              <td style={{ padding: '6px 12px', fontWeight: 600, whiteSpace: 'nowrap', background: '#f8fafc', borderBottom: '1px solid #e5e7eb', fontSize: 11 }}>
                {station}
              </td>
              {parameters.map((param) => {
                const cell = lookup.get(`${station}||${param}`);
                if (!cell) {
                  return (
                    <td key={param} style={{ padding: '6px 8px', textAlign: 'center', background: '#f9fafb', borderBottom: '1px solid #e5e7eb', color: '#d1d5db' }}>
                      —
                    </td>
                  );
                }
                const rate = Math.round((cell.passes / cell.total) * 100);
                return (
                  <td key={param} title={`${cell.passes}/${cell.total} pass`} style={{
                    padding: '6px 8px',
                    textAlign: 'center',
                    background: cellBg(cell.passes, cell.total),
                    color: cellFg(cell.passes, cell.total),
                    borderBottom: '1px solid #e5e7eb',
                    fontWeight: 700,
                  }}>
                    {rate}%
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <p style={{ fontSize: 11, color: '#9ca3af', marginTop: 8 }}>
        Green ≥ 90% · Yellow 70–89% · Red &lt; 70% · Hover cell for raw counts
      </p>
    </div>
  );
}
