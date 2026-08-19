'use client';

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from 'recharts';
import type { BatchTrendPoint } from '@/lib/vendor-queries';

export function VendorBatchTrendChart({ data }: { data: BatchTrendPoint[] }) {
  if (data.length === 0) return <div style={{ color: '#9ca3af', fontSize: 13, padding: 24 }}>No batch data yet.</div>;

  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-card-border)" />
        <XAxis
          dataKey="loadNumber"
          tick={{ fontSize: 11, fill: 'var(--color-text-body)' }}
          tickLine={false}
        />
        <YAxis
          domain={[0, 100]}
          tickFormatter={(v) => `${v}%`}
          tick={{ fontSize: 11, fill: 'var(--color-text-body)' }}
          tickLine={false}
          width={40}
        />
        <Tooltip
          formatter={(v) => [`${v}%`, 'Pass Rate']}
          contentStyle={{
            background: 'var(--color-card-bg)',
            border: '1px solid var(--color-card-border)',
            borderRadius: 6,
            fontSize: 12,
          }}
        />
        <ReferenceLine y={90} stroke="var(--color-success)" strokeDasharray="4 2" label={{ value: '90% target', fontSize: 10, fill: 'var(--color-success)' }} />
        <Line
          type="monotone"
          dataKey="passRate"
          stroke="var(--color-navy-primary)"
          strokeWidth={2}
          dot={{ r: 4, fill: 'var(--color-navy-primary)' }}
          activeDot={{ r: 6 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
