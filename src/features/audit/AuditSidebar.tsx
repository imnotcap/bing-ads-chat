/**
 * The audit's checklist: every Microsoft Advertising campaign with its progress through
 * the steps, and the whole account's progress on top. Picking a campaign opens it.
 */
import { useState } from 'react';
import { CircleCheck, LayoutGrid, Loader2, Search } from '@/components/icons';
import { cn } from '@/lib/utils';
import { useAuditUi } from './data';
import { useAuditModel, type AuditRow } from './model';

function Bar({ done, total, className }: { done: number; total: number; className?: string }) {
  const pct = total ? Math.round((done / total) * 100) : 0;
  return (
    <span className={cn('block h-1.5 overflow-hidden rounded-full bg-line-2', className)} role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
      <span className={cn('block h-full rounded-full transition-[width] duration-500', pct === 100 ? 'bg-positive' : 'bg-brand')} style={{ width: `${pct}%` }} />
    </span>
  );
}

function CampaignItem({ row, active, onSelect }: { row: AuditRow; active: boolean; onSelect: () => void }) {
  const paused = row.bing.status !== 'Active';
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-current={active ? 'page' : undefined}
      className={cn('grid w-full gap-1.5 rounded-[10px] px-3 py-2 text-left transition-colors', active ? 'bg-line-2' : 'hover:bg-line-2/70')}
    >
      <span className="flex items-center gap-1.5">
        {row.finished && <CircleCheck className="size-3.5 shrink-0 text-positive" />}
        <span className={cn('min-w-0 flex-1 truncate text-[13px] font-medium', paused ? 'text-subtle' : 'text-ink')}>{row.bing.name}</span>
        <span className="shrink-0 text-[11px] tabular text-subtle">
          {row.progress.done}/{row.progress.total}
        </span>
      </span>
      <Bar done={row.progress.done} total={row.progress.total} />
    </button>
  );
}

export function AuditSidebar() {
  const { rows, totals, bing } = useAuditModel();
  const selected = useAuditUi((s) => s.selected);
  const select = useAuditUi((s) => s.select);
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();
  const shown = q ? rows.filter((r) => r.bing.name.toLowerCase().includes(q)) : rows;

  return (
    <div className="flex h-full flex-col">
      <div className="grid gap-3 px-3 pb-3 pt-4">
        <button
          type="button"
          onClick={() => select(null)}
          aria-current={selected === null ? 'page' : undefined}
          className={cn('flex h-9 items-center gap-2.5 rounded-[10px] px-3 text-[13.5px] font-medium transition-colors', selected === null ? 'bg-line-2 text-ink' : 'text-muted hover:bg-line-2 hover:text-ink')}
        >
          <LayoutGrid className="size-[17px]" /> Alle kampagner
        </button>
        <div className="grid gap-1.5 px-1">
          <div className="flex items-baseline justify-between text-[12px]">
            <span className="font-medium text-ink-2">Fremskridt</span>
            <span className="tabular text-muted">
              {totals.finished} af {totals.campaigns} færdige
            </span>
          </div>
          <Bar done={totals.done} total={totals.total} />
        </div>
        <label className="flex h-8 items-center gap-2 rounded-lg border border-line bg-surface px-2.5 text-[13px] focus-within:border-brand">
          <Search className="size-3.5 text-subtle" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Find kampagne" aria-label="Find kampagne" className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-subtle" />
        </label>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-4">
        {bing.isPending ? (
          <p className="flex items-center gap-2 px-3 py-2 text-[12.5px] text-muted">
            <Loader2 className="size-3.5 animate-spin" /> Henter kampagner …
          </p>
        ) : shown.length ? (
          <div className="grid gap-0.5">
            {shown.map((r) => (
              <CampaignItem key={r.bing.id} row={r} active={selected === r.bing.id} onSelect={() => select(r.bing.id)} />
            ))}
          </div>
        ) : (
          <p className="px-3 py-2 text-[12.5px] text-muted">{q ? 'Ingen kampagner matcher.' : 'Ingen kampagner.'}</p>
        )}
      </div>
    </div>
  );
}
