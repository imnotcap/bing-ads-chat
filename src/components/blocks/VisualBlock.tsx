import type { VisualSpec } from '@/ai/visuals';
import { ChartBlock } from './ChartBlock';
import { KpiGrid } from './KpiGrid';
import { TableBlock } from './TableBlock';

export function VisualBlock({ visual, currency }: { visual: VisualSpec; currency: string }) {
  // Follow-up suggestions are interactive and rendered by the chat itself.
  if (visual.type === 'suggestions') return null;
  return (
    <div className="grid gap-2.5">
      {visual.title && <div className="text-[13px] font-semibold text-ink">{visual.title}</div>}
      {visual.type === 'kpis' && <KpiGrid items={visual.items} currency={currency} />}
      {visual.type === 'chart' && (
        <div className="rounded-2xl border border-line bg-surface p-3 pt-4">
          <ChartBlock chart={visual.chart} data={visual.data} xKey={visual.xKey} series={visual.series} currency={currency} />
          {visual.series.length > 1 && (
            <div className="mt-2 flex flex-wrap gap-3 px-2 text-[12px] text-muted">
              {visual.series.map((s, i) => (
                <span key={s.key} className="inline-flex items-center gap-1.5">
                  <span className="size-2 rounded-full" style={{ background: ['#6d5cf6', '#14b8a6', '#8b5cf6', '#f59e0b'][i % 4] }} />
                  {s.label}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
      {visual.type === 'table' && <TableBlock columns={visual.columns} rows={visual.rows} currency={currency} />}
    </div>
  );
}
