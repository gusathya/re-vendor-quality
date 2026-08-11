'use client';

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer, Cell,
} from 'recharts';
import type { VendorStat } from '@/lib/admin-queries';

interface VendorComparisonChartProps {
  vendors: VendorStat[];
}

export function VendorComparisonChart({ vendors }: VendorComparisonChartProps) {
  if (vendors.length === 0) return <p style={{ color: '#9ca3af', fontSize: 13 }}>No vendor data yet.</p>;

  const data = vendors.map((v) => ({
    name: v.vendorName,
    passes: v.passes,
    fails: v.fails,
    passRate: Math.round(v.passRate * 100),
  }));

  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ top: 8, right: 24, left: 0, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
        <XAxis dataKey="name" tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
        <Tooltip
          contentStyle={{ fontSize: 12, borderRadius: 6, border: '1px solid #e5e7eb' }}
          formatter={(v: unknown, name: unknown) => [`${v}`, name === 'passes' ? 'Pass' : 'Fail']}
        />
        <Legend iconSize={10} wrapperStyle={{ fontSize: 12 }} formatter={(v) => v === 'passes' ? 'Pass' : 'Fail'} />
        <Bar dataKey="passes" stackId="a" fill="#16a34a" name="passes" />
        <Bar dataKey="fails" stackId="a" fill="#dc2626" name="fails" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

interface PassRateChartProps {
  vendors: VendorStat[];
}

export function PassRateChart({ vendors }: PassRateChartProps) {
  if (vendors.length === 0) return null;

  const data = vendors.map((v) => ({
    name: v.vendorName,
    passRate: Math.round(v.passRate * 100),
  }));

  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} margin={{ top: 8, right: 24, left: 0, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
        <XAxis dataKey="name" tick={{ fontSize: 11 }} />
        <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} unit="%" />
        <Tooltip
          contentStyle={{ fontSize: 12, borderRadius: 6 }}
          formatter={(v: unknown) => [`${v}%`, 'Pass Rate']}
        />
        <Bar dataKey="passRate" radius={[4, 4, 0, 0]}>
          {data.map((entry, i) => (
            <Cell
              key={i}
              fill={entry.passRate >= 90 ? '#16a34a' : entry.passRate >= 70 ? '#f59e0b' : '#dc2626'}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
