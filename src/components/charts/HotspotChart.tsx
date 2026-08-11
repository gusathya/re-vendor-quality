'use client';

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from 'recharts';

interface HotspotChartProps {
  data: { name: string; failCount: number }[];
}

const COLORS = ['#dc2626', '#ea580c', '#f59e0b', '#facc15'];

export function HotspotChart({ data }: HotspotChartProps) {
  if (data.length === 0) {
    return <p style={{ color: '#9ca3af', fontSize: 13, margin: 0 }}>No failures recorded yet.</p>;
  }

  const maxFails = Math.max(...data.map((d) => d.failCount));

  return (
    <ResponsiveContainer width="100%" height={Math.max(140, data.length * 44)}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 4, right: 32, left: 8, bottom: 4 }}
      >
        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
        <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
        <YAxis type="category" dataKey="name" width={160} tick={{ fontSize: 11 }} />
        <Tooltip
          contentStyle={{ fontSize: 12, borderRadius: 6, border: '1px solid #e5e7eb' }}
          formatter={(v: unknown) => [`${v} failures`, 'Fail count']}
        />
        <Bar dataKey="failCount" radius={[0, 4, 4, 0]}>
          {data.map((entry, i) => {
            const ratio = entry.failCount / maxFails;
            const color = ratio > 0.75 ? COLORS[0] : ratio > 0.5 ? COLORS[1] : ratio > 0.25 ? COLORS[2] : COLORS[3];
            return <Cell key={i} fill={color} />;
          })}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
