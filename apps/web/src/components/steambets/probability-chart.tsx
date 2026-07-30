'use client';

import { useEffect, useRef, useState } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

const shape = [
  21, 24, 18, 23, 22, 31, 26, 34, 28, 33, 38, 47, 42, 51, 45, 53, 49,
  58, 55, 60, 66, 62, 57, 63, 59, 65, 72, 65, 54, 66, 52, 59, 44, 35, 39,
  34, 43, 46, 38, 32, 35, 31, 34, 31, 35, 33, 38, 36, 42, 51, 47, 57, 55,
];

const months = ['Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];

export function ProbabilityChart({
  value,
  compact = false,
  initialWidth = 680,
}: {
  value: number;
  compact?: boolean;
  initialWidth?: number;
}) {
  const height = compact ? 110 : 230;
  const chartRef = useRef<HTMLDivElement>(null);
  const [chartWidth, setChartWidth] = useState(initialWidth);

  useEffect(() => {
    const element = chartRef.current;
    if (!element) return;
    const sync = () => setChartWidth(Math.max(280, Math.floor(element.getBoundingClientRect().width)));
    sync();
    const observer = new ResizeObserver(sync);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const adjustment = value - shape[shape.length - 1];
  const data = shape.map((point, index) => ({
    label: months[Math.min(months.length - 1, Math.floor(index / 8))],
    value: Math.max(5, Math.min(95, Math.round(point + adjustment * (index / (shape.length - 1))))),
  }));

  return (
    <div ref={chartRef} className={compact ? 'sb-chart sb-chart--compact' : 'sb-chart'}>
      <LineChart width={chartWidth} height={height} data={data} margin={{ top: 8, right: 8, bottom: 0, left: 20 }}>
          <CartesianGrid stroke="#e7e9ed" strokeDasharray="3 3" vertical={false} />
          {!compact && (
            <XAxis
                dataKey="label"
                axisLine={{ stroke: '#dfe2e7' }}
                tickLine={false}
                tick={{ fill: '#697386', fontSize: 12 }}
                interval={7}
            />
          )}
          {!compact && (
            <YAxis
                axisLine={false}
                domain={[0, 100]}
                orientation="right"
                tickFormatter={(tick) => `${tick}%`}
                tickLine={false}
                ticks={[0, 25, 50, 75]}
                tick={{ fill: '#697386', fontSize: 12 }}
                width={44}
            />
          )}
          {!compact && (
            <Tooltip
                formatter={(tick) => [`${tick}%`, 'Chance']}
                labelFormatter={() => ''}
                contentStyle={{ border: '1px solid #e3e5e9', borderRadius: 8, fontSize: 12 }}
            />
          )}
          <Line
            type="monotone"
            dataKey="value"
            stroke="#1769ff"
            strokeWidth={compact ? 2 : 2.3}
            dot={false}
            activeDot={{ r: 4, fill: '#1769ff', stroke: '#fff', strokeWidth: 2 }}
          />
      </LineChart>
    </div>
  );
}
