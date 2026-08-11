'use client';

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer,
} from 'recharts';
import type { AdminTimelinePoint } from '@/lib/admin-queries';

interface AdminTimelineChartProps {
  data: AdminTimelinePoint[];
}

export function AdminTimelineChart({ data }: AdminTimelineChartProps) {
  if (data.length === 0) {
    return <p style={{ color: '#9ca3af', fontSize: 13 }}>No load data yet.</p>;
  }

  const chartData = data.map((d) => ({
    label: `${d.vendorName.split(' ')[0]} / ${d.loadNumber}`,
    passes: d.passes,
    fails: d.fails,
    vendor: d.vendorName,
    uploadedAt: d.uploadedAt,
  }));

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 32 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 9 }}
          angle={-35}
          textAnchor="end"
          interval={0}
        />
        <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
        <Tooltip
          contentStyle={{ fontSize: 12, borderRadius: 6, border: '1px solid #e5e7eb' }}
          labelFormatter={(label, payload) => {
            const item = payload?.[0]?.payload;
            return item ? `${item.vendor} — Load ${item.uploadedAt?.slice(0, 10)}` : label;
          }}
        />
        <Legend iconSize={10} wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="passes" stackId="a" fill="#16a34a" name="Pass" />
        <Bar dataKey="fails" stackId="a" fill="#dc2626" name="Fail" radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
