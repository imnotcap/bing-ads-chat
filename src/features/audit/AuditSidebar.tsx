/**
 * The audit's checklist: every Microsoft Advertising campaign with its progress through
 * the steps, grouped by how far it is (I gang, Ikke startet, Færdige – paused campaigns on
 * their own), with its kind and its Google Ads counterpart. Picking a campaign opens it.
 */
import { AnimatePresence, motion } from 'motion/react';
import { useState } from 'react';
import { ChevronDown, CircleCheck, LayoutGrid, Loader2, Package, Search, Sparkles, UsersRound, type LucideIcon } from '@/components/icons';
import { EASE } from '@/components/motion';
import { Tooltip } from '@/components/ui/overlays';
import { cn } from '@/lib/utils';
import { useAuditUi } from './data';
import { groupOf, useAuditModel, type AuditGroup, type AuditRow } from './model';

/** `onGrey`: the bar sits on the grey of a picked row, where the usual grey track would vanish. */
function Bar({ done, total, className, onGrey = false }: { done: number; total: number; className?: string; onGrey?: boolean }) {
  const pct = total ? Math.round((done / total) * 100) : 0;
  return (
    <span className={cn('block h-1.5 overflow-hidden rounded-full', onGrey ? 'bg-surface' : 'bg-line-2', className)} role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
      <span className={cn('block h-full rounded-full transition-[width] duration-500', pct === 100 ? 'bg-positive' : 'bg-brand')} style={{ width: `${pct}%` }} />
    </span>
  );
}

const TYPE: Record<string, { icon: LucideIcon; label: string }> = {
  Search: { icon: Search, label: 'Søgning' },
  Shopping: { icon: Package, label: 'Shopping' },
  PerformanceMax: { icon: Sparkles, label: 'Performance Max' },
  Audience: { icon: UsersRound, label: 'Audience' },
};

/** The line under the name: what the campaign is held up against in Google. */
function matchLine(row: AuditRow, googleReady: boolean): { text: string; tone: 'set' | 'hint' | 'none' | 'warn' } | null {
  const id = row.audit?.googleId;
  if (id === null) return { text: 'Ingen modpart i Google', tone: 'none' };
  if (id) {
    if (row.google) return { text: `↔ ${row.google.name}`, tone: 'set' };
    return googleReady ? { text: 'Findes ikke længere i Google', tone: 'warn' } : { text: '↔ Matchet', tone: 'set' };
  }
  if (row.suggestion) return { text: `Forslag: ${row.suggestion.campaign.name}`, tone: 'hint' };
  return googleReady ? { text: 'Ingen modpart valgt', tone: 'none' } : null;
}

function CampaignItem({ row, active, googleReady, onSelect }: { row: AuditRow; active: boolean; googleReady: boolean; onSelect: () => void }) {
  const paused = row.bing.status !== 'Active';
  const type = TYPE[row.bing.type];
  const match = matchLine(row, googleReady);
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-current={active ? 'page' : undefined}
      className={cn('grid w-full grid-cols-[minmax(0,1fr)] gap-1 rounded-[10px] px-3 py-2 text-left transition-colors', active ? 'bg-line-2' : 'hover:bg-line-2/70')}
    >
      <span className="flex items-center gap-2">
        {type ? (
          <Tooltip content={type.label} side="right">
            <type.icon className={cn('size-3.5 shrink-0', paused ? 'text-subtle' : 'text-muted')} aria-label={type.label} />
          </Tooltip>
        ) : (
          <span className="size-3.5 shrink-0" />
        )}
        <span className={cn('min-w-0 flex-1 truncate text-[13px] font-medium', paused ? 'text-subtle' : 'text-ink')}>{row.bing.name}</span>
        {row.finished ? (
          <CircleCheck className="size-3.5 shrink-0 text-positive" aria-label="Færdig" />
        ) : (
          <span className="shrink-0 text-[11px] tabular text-subtle">
            {row.progress.done}/{row.progress.total}
          </span>
        )}
      </span>
      {match && (
        <span
          className={cn(
            'truncate pl-[22px] text-[11.5px]',
            match.tone === 'set' && 'text-muted',
            match.tone === 'hint' && 'italic text-subtle',
            match.tone === 'none' && 'text-subtle',
            match.tone === 'warn' && 'text-warning',
          )}
        >
          {match.text}
        </span>
      )}
      <Bar done={row.progress.done} total={row.progress.total} onGrey={active} className="ml-[22px] mt-0.5" />
    </button>
  );
}

const GROUPS: { id: AuditGroup; label: string; folded: boolean }[] = [
  { id: 'started', label: 'I gang', folded: false },
  { id: 'todo', label: 'Ikke startet', folded: false },
  { id: 'finished', label: 'Færdige', folded: true },
  { id: 'paused', label: 'Pausede', folded: true },
];

function Group({ label, rows, open, onToggle, selected, googleReady }: { label: string; rows: AuditRow[]; open: boolean; onToggle: () => void; selected: string | null; googleReady: boolean }) {
  const select = useAuditUi((s) => s.select);
  return (
    <section>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex h-8 w-full items-center gap-1.5 px-3 text-[11px] font-semibold uppercase tracking-[0.06em] text-subtle hover:text-ink-2"
      >
        <ChevronDown className={cn('size-3 transition-transform duration-200', !open && '-rotate-90')} />
        {label}
        <span className="font-medium tabular">· {rows.length}</span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="rows"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: EASE }}
            className="overflow-hidden"
          >
            <div className="grid grid-cols-[minmax(0,1fr)] gap-0.5 pb-2">
              {rows.map((r) => (
                <CampaignItem key={r.bing.id} row={r} active={selected === r.bing.id} googleReady={googleReady} onSelect={() => select(r.bing.id)} />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

export function AuditSidebar() {
  const { rows, totals, bing, google, googleConnected } = useAuditModel();
  const googleReady = googleConnected && !!google.data;
  const selected = useAuditUi((s) => s.selected);
  const select = useAuditUi((s) => s.select);
  const [query, setQuery] = useState('');
  // What the person folded or unfolded; the rest follows the defaults in GROUPS.
  const [toggled, setToggled] = useState<Partial<Record<AuditGroup, boolean>>>({});
  const q = query.trim().toLowerCase();
  const shown = q ? rows.filter((r) => r.bing.name.toLowerCase().includes(q)) : rows;
  const selectedGroup = rows.find((r) => r.bing.id === selected);

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
          GROUPS.map((g) => {
            const inGroup = shown.filter((r) => groupOf(r) === g.id);
            if (!inGroup.length) return null;
            // A search, or the open campaign, unfolds the group it is in.
            const open = q || (selectedGroup && groupOf(selectedGroup) === g.id) ? true : (toggled[g.id] ?? !g.folded);
            return (
              <Group
                key={g.id}
                label={g.label}
                rows={inGroup}
                open={!!open}
                onToggle={() => setToggled((t) => ({ ...t, [g.id]: !open }))}
                selected={selected}
                googleReady={googleReady}
              />
            );
          })
        ) : (
          <p className="px-3 py-2 text-[12.5px] text-muted">{q ? 'Ingen kampagner matcher.' : 'Ingen kampagner.'}</p>
        )}
      </div>
    </div>
  );
}
