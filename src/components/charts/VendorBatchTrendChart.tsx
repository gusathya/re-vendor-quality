'use client';

import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from 'recharts';
import type { MonthlyTrendPoint } from '@/lib/vendor-queries';

export function VendorBatchTrendChart({ data }: { data: MonthlyTrendPoint[] }) {
  if (data.length === 0) {
    return <div style={{ color: '#9ca3af', fontSize: 13, padding: 24 }}>No batch data yet.</div>;
  }

  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="passRateGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="var(--color-navy-primary)" stopOpacity={0.25} />
            <stop offset="95%" stopColor="var(--color-navy-primary)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-card-border)" />
        <XAxis
          dataKey="monthLabel"
          tick={{ fontSize: 11, fill: 'var(--color-text-body)' }}
          tickLine={false}
          interval={0}
          angle={-30}
          textAnchor="end"
          height={44}
        />
        <YAxis
          domain={[50, 100]}
          tickFormatter={(v) => `${v}%`}
          tick={{ fontSize: 11, fill: 'var(--color-text-body)' }}
          tickLine={false}
          width={40}
        />
        <Tooltip
          formatter={(v) => [`${v}%`, 'Pass Rate']}
          labelFormatter={(label, payload) => {
            const pt = payload?.[0]?.payload as MonthlyTrendPoint | undefined;
            return pt ? `${label} — ${pt.batchCount} batch${pt.batchCount !== 1 ? 'es' : ''}` : label;
          }}
          contentStyle={{
            background: 'var(--color-card-bg)',
            border: '1px solid var(--color-card-border)',
            borderRadius: 6,
            fontSize: 12,
          }}
        />
        <ReferenceLine
          y={90}
          stroke="var(--color-success)"
          strokeDasharray="4 2"
          label={{ value: '90%', fontSize: 10, fill: 'var(--color-success)', position: 'insideTopRight' }}
        />
        <Area
          type="monotone"
          dataKey="avgPassRate"
          stroke="var(--color-navy-primary)"
          strokeWidth={2}
          fill="url(#passRateGrad)"
          dot={{ r: 4, fill: 'var(--color-navy-primary)', strokeWidth: 0 }}
          activeDot={{ r: 6 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
