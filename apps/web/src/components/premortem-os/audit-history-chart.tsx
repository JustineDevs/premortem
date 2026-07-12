'use client';

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';
import { useEffect, useRef, useState } from 'react';

import { OsChartTooltip } from './chart-tooltip';

export interface AuditHistoryChartPoint {
  date: string;
  score: number;
  projectName: string;
  risks: number;
}

export function AuditHistoryChart({ data }: { data: AuditHistoryChartPoint[] }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [containerWidth, setContainerWidth] = useState(0);

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;

    const update = () => {
      const nextWidth = Math.round(node.getBoundingClientRect().width);
      setContainerWidth((current) => (current === nextWidth ? current : nextWidth));
    };

    update();

    const observer = new ResizeObserver(() => {
      update();
    });
    observer.observe(node);

    return () => {
      observer.disconnect();
    };
  }, []);

  return (
    <div ref={containerRef} className="relative z-10 h-60 w-full pt-4">
      {containerWidth > 0 ? (
        <LineChart
          width={Math.max(containerWidth, 320)}
          height={240}
          data={data}
          margin={{ top: 10, right: 30, left: 0, bottom: 24 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#F1EFE9" />
          <XAxis
            dataKey="date"
            stroke="#5C6560"
            tick={{ fill: '#5C6560', fontSize: 10 }}
            fontSize={10}
            fontFamily="JetBrains Mono, monospace"
          />
          <YAxis
            stroke="#5C6560"
            tick={{ fill: '#5C6560', fontSize: 10 }}
            fontSize={10}
            fontFamily="JetBrains Mono, monospace"
            domain={[0, 100]}
          />
          <Tooltip
            content={<OsChartTooltip />}
            wrapperStyle={{ zIndex: 50, outline: 'none' }}
            cursor={{
              stroke: '#064E3B',
              strokeWidth: 1,
              strokeDasharray: '4 4'
            }}
          />
          <Line
            type="monotone"
            dataKey="score"
            stroke="#064E3B"
            strokeWidth={2.5}
            activeDot={{
              r: 6,
              fill: '#064E3B',
              stroke: '#FAF8F5',
              strokeWidth: 2
            }}
            name="Compliance Rating"
          />
          <Legend
            verticalAlign="bottom"
            height={28}
            formatter={() => (
              <span className="text-[10px] font-mono text-[#5C6560]">Compliance Rating</span>
            )}
          />
        </LineChart>
      ) : null}
    </div>
  );
}
