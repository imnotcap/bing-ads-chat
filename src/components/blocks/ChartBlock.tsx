import { useReducedMotionConfig } from 'motion/react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { ValueFormat, VisualColumn } from '@/ai/visuals';
import { fmtCompact } from '@/lib/format';
import { formatValue } from './format';

export const SERIES_COLORS = ['#4f6bf5', '#14b8a6', '#8b5cf6', '#f59e0b'];

function ChartTooltip({
  active,
  payload,
  label,
  series,
  currency,
  xFormat,
}: {
  active?: boolean;
  payload?: { dataKey: string; value: number; color: string }[];
  label?: string | number;
  series: VisualColumn[];
  currency: string;
  xFormat?: ValueFormat;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-black/[0.06] bg-white/95 px-3 py-2 text-[12px] shadow-pop backdrop-blur">
      <div className="mb-1 font-semibold text-ink">{formatValue(label, xFormat, currency)}</div>
      {payload.map((p) => {
        const s = series.find((x) => x.key === p.dataKey);
        return (
          <div key={p.dataKey} className="flex items-center gap-2 text-ink-2">
            <span className="size-2 rounded-full" style={{ background: p.color }} />
            <span>{s?.label ?? p.dataKey}</span>
            <span className="ml-auto pl-4 font-semibold tabular text-ink">{formatValue(p.value, s?.format, currency)}</span>
          </div>
        );
      })}
    </div>
  );
}

export function ChartBlock({
  chart,
  data,
  xKey,
  series,
  currency,
  height = 240,
}: {
  chart: 'line' | 'area' | 'bar';
  data: Record<string, unknown>[];
  xKey: string;
  series: VisualColumn[];
  currency: string;
  height?: number;
}) {
  const animate = !useReducedMotionConfig();
  const isDate = data.length > 0 && typeof data[0]?.[xKey] === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(String(data[0]?.[xKey]));
  const xFormat: ValueFormat | undefined = isDate ? 'date' : undefined;
  // Two very different scales (e.g. spend vs. clicks) get their own axis.
  const dual = series.length === 2 && series[0]?.format !== series[1]?.format;
  const common = {
    data,
    margin: { top: 8, right: dual ? 4 : 8, bottom: 0, left: 0 },
  };
  const axes = (
    <>
      <CartesianGrid vertical={false} stroke="#eef0f6" />
      <XAxis
        dataKey={xKey}
        tickLine={false}
        axisLine={false}
        tick={{ fontSize: 11, fill: '#8b90a6' }}
        tickFormatter={(v) => formatValue(v, xFormat, currency)}
        minTickGap={24}
      />
      <YAxis yAxisId="a" tickLine={false} axisLine={false} width={46} tick={{ fontSize: 11, fill: '#8b90a6' }} tickFormatter={(v: number) => fmtCompact(v)} />
      {dual && (
        <YAxis yAxisId="b" orientation="right" tickLine={false} axisLine={false} width={40} tick={{ fontSize: 11, fill: '#8b90a6' }} tickFormatter={(v: number) => fmtCompact(v)} />
      )}
      <Tooltip cursor={{ stroke: '#d8dcf0', fill: 'rgb(79 107 245 / 0.05)' }} content={<ChartTooltip series={series} currency={currency} xFormat={xFormat} />} />
    </>
  );
  const axisFor = (i: number) => (dual && i === 1 ? 'b' : 'a');

  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        {chart === 'bar' ? (
          <BarChart {...common} barCategoryGap="22%">
            {axes}
            {series.map((s, i) => (
              <Bar key={s.key} yAxisId={axisFor(i)} dataKey={s.key} fill={SERIES_COLORS[i % 4]} radius={[6, 6, 0, 0]} isAnimationActive={animate} maxBarSize={36} />
            ))}
          </BarChart>
        ) : chart === 'area' ? (
          <AreaChart {...common}>
            <defs>
              {series.map((s, i) => (
                <linearGradient key={s.key} id={`grad-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={SERIES_COLORS[i % 4]} stopOpacity={0.28} />
                  <stop offset="100%" stopColor={SERIES_COLORS[i % 4]} stopOpacity={0} />
                </linearGradient>
              ))}
            </defs>
            {axes}
            {series.map((s, i) => (
              <Area
                key={s.key}
                yAxisId={axisFor(i)}
                type="monotone"
                dataKey={s.key}
                stroke={SERIES_COLORS[i % 4]}
                strokeWidth={2.2}
                fill={`url(#grad-${s.key})`}
                isAnimationActive={animate}
                dot={false}
                activeDot={{ r: 4, strokeWidth: 2, stroke: '#fff' }}
              />
            ))}
          </AreaChart>
        ) : (
          <LineChart {...common}>
            {axes}
            {series.map((s, i) => (
              <Line
                key={s.key}
                yAxisId={axisFor(i)}
                type="monotone"
                dataKey={s.key}
                stroke={SERIES_COLORS[i % 4]}
                strokeWidth={2.2}
                dot={false}
                isAnimationActive={animate}
                activeDot={{ r: 4, strokeWidth: 2, stroke: '#fff' }}
              />
            ))}
          </LineChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}
