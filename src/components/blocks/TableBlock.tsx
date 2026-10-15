import { ArrowDown, ArrowUp } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { VisualColumn } from '@/ai/visuals';
import { cn } from '@/lib/utils';
import { formatValue } from './format';

const NUMERIC = new Set(['money', 'number', 'decimal', 'percent', 'ratio']);

export function TableBlock({
  columns,
  rows,
  currency,
  maxHeight = 360,
  total,
  dense,
}: {
  columns: VisualColumn[];
  rows: Record<string, unknown>[];
  currency: string;
  maxHeight?: number;
  total?: number;
  dense?: boolean;
}) {
  const [sort, setSort] = useState<{ key: string; dir: 1 | -1 } | null>(null);
  const sorted = useMemo(() => {
    if (!sort) return rows;
    return [...rows].sort((a, b) => {
      const av = a[sort.key];
      const bv = b[sort.key];
      if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * sort.dir;
      return String(av ?? '').localeCompare(String(bv ?? ''), 'da') * sort.dir;
    });
  }, [rows, sort]);

  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-surface">
      <div className="overflow-auto" style={{ maxHeight }} data-selectable>
        <table className="w-full border-separate border-spacing-0 text-[13px]">
          <thead className="sticky top-0 z-10">
            <tr>
              {columns.map((c) => {
                const numeric = NUMERIC.has(c.format ?? '');
                const active = sort?.key === c.key;
                return (
                  <th
                    key={c.key}
                    className={cn(
                      'cursor-pointer select-none whitespace-nowrap border-b border-line bg-[#f8f9fc] px-3 font-semibold text-muted transition-colors hover:text-ink',
                      dense ? 'py-1.5 text-[11px]' : 'py-2 text-[11.5px]',
                      numeric ? 'text-right' : 'text-left',
                    )}
                    onClick={() => setSort((s) => (s?.key === c.key ? (s.dir === -1 ? { key: c.key, dir: 1 } : null) : { key: c.key, dir: -1 }))}
                  >
                    <span className={cn('inline-flex items-center gap-1', numeric && 'flex-row-reverse')}>
                      {c.label}
                      {active && (sort.dir === -1 ? <ArrowDown className="size-3" /> : <ArrowUp className="size-3" />)}
                    </span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {sorted.map((r, i) => (
              <tr key={i} className="transition-colors hover:bg-brand-50/40">
                {columns.map((c) => {
                  const numeric = NUMERIC.has(c.format ?? '');
                  return (
                    <td
                      key={c.key}
                      className={cn(
                        'border-b border-line-2 px-3 text-ink-2',
                        dense ? 'py-1.5' : 'py-2',
                        numeric ? 'whitespace-nowrap text-right tabular' : 'max-w-[280px] truncate',
                      )}
                      title={numeric ? undefined : String(r[c.key] ?? '')}
                    >
                      {formatValue(r[c.key], c.format, currency)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {total !== undefined && total > rows.length && (
        <div className="border-t border-line bg-[#f8f9fc] px-3 py-1.5 text-[11.5px] text-muted">
          Viser {rows.length} af {total} rækker
        </div>
      )}
    </div>
  );
}
