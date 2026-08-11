'use client';

import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, ResponsiveContainer,
} from 'recharts';

interface TrendPoint {
  loadNumber: string;
  value: number | null;
  score: string;
  minValue: number | null;
  maxValue: number | null;
}

interface TrendChartProps {
  data: TrendPoint[];
  parameterName: string;
}

interface DotProps {
  cx?: number;
  cy?: number;
  payload?: { score: string };
  index?: number;
}

function ScoreDot(props: DotProps) {
  const { cx = 0, cy = 0, payload, index = 0 } = props;
  const color = payload?.score === 'pass' ? '#16a34a' : '#dc2626';
  return <circle key={index} cx={cx} cy={cy} r={5} fill={color} stroke="white" strokeWidth={2} />;
}

export function TrendChart({ data, parameterName }: TrendChartProps) {
  const chartData = data
    .filter((d) => d.value !== null)
    .map((d) => ({ load: d.loadNumber, value: d.value, score: d.score }));

  // Use the first available limit values as reference lines.
  const minVal = data.find((d) => d.minValue != null)?.minValue ?? null;
  const maxVal = data.find((d) => d.maxValue != null)?.maxValue ?? null;

  if (chartData.length === 0) {
    return <p style={{ color: '#9ca3af', fontSize: 13 }}>No scored data yet for {parameterName}.</p>;
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={chartData} margin={{ top: 12, right: 32, left: 0, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
        <XAxis dataKey="load" tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 11 }} />
        <Tooltip
          contentStyle={{ fontSize: 12, borderRadius: 6, border: '1px solid #e5e7eb' }}
          formatter={(v: unknown, _: unknown, props: { payload?: { score: string } }) => [
            `${v}`,
            props?.payload?.score === 'pass' ? '✅ Pass' : '❌ Fail',
          ]}
        />
        {minVal != null && (
          <ReferenceLine
            y={minVal}
            stroke="#dc2626"
            strokeDasharray="5 3"
            label={{ value: `Min ${minVal}`, fontSize: 10, fill: '#dc2626', position: 'insideBottomLeft' }}
          />
        )}
        {maxVal != null && (
          <ReferenceLine
            y={maxVal}
            stroke="#dc2626"
            strokeDasharray="5 3"
            label={{ value: `Max ${maxVal}`, fontSize: 10, fill: '#dc2626', position: 'insideTopLeft' }}
          />
        )}
        <Line
          type="monotone"
          dataKey="value"
          name={parameterName}
          stroke="#1B2A4A"
          strokeWidth={2}
          dot={<ScoreDot />}
          activeDot={{ r: 7 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
