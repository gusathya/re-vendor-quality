'use client';

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer,
} from 'recharts';
import type { LoadTimelinePoint } from '@/lib/dashboard-queries';

interface LoadTimelineChartProps {
  data: LoadTimelinePoint[];
}

export function LoadTimelineChart({ data }: LoadTimelineChartProps) {
  if (data.length === 0) return null;

  return (
    <ResponsiveContainer width="100%" height={230}>
      <BarChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
        <XAxis dataKey="loadNumber" tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
        <Tooltip
          contentStyle={{ fontSize: 12, borderRadius: 6, border: '1px solid #e5e7eb' }}
        />
        <Legend iconSize={10} wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="passes" stackId="a" fill="#16a34a" name="Pass" />
        <Bar dataKey="fails" stackId="a" fill="#dc2626" name="Fail" radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
