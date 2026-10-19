/**
 * A change proposed by the assistant: what changes (before → after), why, which
 * spending rules apply, and Godkend/Afvis while it waits for the user.
 */
import { AnimatePresence, motion } from 'motion/react';
import { Ban, Check, CheckCircle2, Clock, Loader2, Plus, ShieldAlert, ShieldCheck, Undo2, X, XCircle } from 'lucide-react';
import { useState } from 'react';
import { toast } from '@/components/notifications/toast';
import { answerApproval } from '@/ai/approvals';
import { undoActivity } from '@/ai/agent';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/controls';
import { EASE } from '@/components/motion';
import { fmtMoney } from '@/lib/format';
import { cn, errorMessage } from '@/lib/utils';
import { useActivity } from '@/stores/activity';
import type { ToolPart } from '@/stores/chat';

function cell(v: string | number | null | undefined, currency: string) {
  if (v === null || v === undefined || v === '') return <span className="text-subtle">–</span>;
  if (typeof v === 'number') return <span className="tabular">{fmtMoney(v, currency)}</span>;
  return v;
}

const STATUS = {
  awaiting_approval: { label: 'Afventer din godkendelse', tone: 'warning' as const, icon: Clock },
  running: { label: 'Udfører …', tone: 'brand' as const, icon: Loader2 },
  done: { label: 'Gennemført', tone: 'positive' as const, icon: CheckCircle2 },
  rejected: { label: 'Afvist', tone: 'neutral' as const, icon: XCircle },
  blocked: { label: 'Blokeret af forbrugsregler', tone: 'negative' as const, icon: Ban },
  error: { label: 'Fejlede', tone: 'negative' as const, icon: XCircle },
  stopped: { label: 'Stoppet', tone: 'neutral' as const, icon: X },
  streaming: { label: 'Forbereder …', tone: 'brand' as const, icon: Loader2 },
};

/** Inline editor for a proposed value (titles, ad copy, keywords) with a character counter. */
function EditableValue({ value, original, maxLength, onChange }: { value: string; original: string; maxLength?: number; onChange: (v: string) => void }) {
  const len = value.trim().length;
  const over = maxLength !== undefined && len > maxLength;
  const dirty = value.trim() !== original;
  return (
    <div className="relative">
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        spellCheck
        className={cn(
          'h-8 w-full rounded-lg border bg-surface px-2.5 pr-12 text-[13px] font-medium text-ink outline-none transition-[border-color,box-shadow]',
          over ? 'border-negative/60 ring-2 ring-negative/10' : dirty ? 'border-brand/50 ring-2 ring-brand/10' : 'border-line hover:border-black/15 focus:border-brand/50 focus:ring-2 focus:ring-brand/10',
        )}
        aria-label="Ret værdi"
      />
      {maxLength !== undefined && (
        <span className={cn('pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[11px] tabular', over ? 'text-negative' : 'text-subtle')}>
          {len}/{maxLength}
        </span>
      )}
    </div>
  );
}

const fmtNumber = (v: number) => v.toLocaleString('da-DK', { maximumFractionDigits: 1 });

export interface ManualItem {
  text: string;
  matchType: 'Exact' | 'Phrase';
}

/** The tag of a pick table row, e.g. the match type: same width, centred in its own column. */
function Tag({ children, muted }: { children: React.ReactNode; muted?: boolean }) {
  return <span className={cn('inline-block min-w-[52px] rounded-md bg-line-2 px-1.5 py-px text-center text-[11px] font-medium', muted ? 'text-subtle' : 'text-muted')}>{children}</span>;
}

/** The last row of a pick table: the user types their own item and picks its match type. */
function AddRow({ label, span, existing, onAdd }: { label: string; span: number; existing: string[]; onAdd: (item: ManualItem) => void }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [matchType, setMatchType] = useState<ManualItem['matchType']>('Phrase');
  const clean = text.trim().replace(/\s+/g, ' ');
  const duplicate = existing.some((t) => t.toLowerCase() === clean.toLowerCase());
  const add = () => {
    if (!clean || duplicate || clean.length > 100) return;
    onAdd({ text: clean, matchType });
    setText('');
  };
  if (!open) {
    return (
      <tr className="border-t border-line-2">
        <td colSpan={span} className="p-0">
          <button type="button" onClick={() => setOpen(true)} className="flex w-full items-center gap-1.5 px-3 py-2 text-left text-[13px] font-medium text-brand transition-colors hover:bg-brand-50">
            <Plus className="size-3.5" /> {label}
          </button>
        </td>
      </tr>
    );
  }
  return (
    <tr className="border-t border-line-2 bg-brand-50/40">
      <td colSpan={span} className="px-3 py-2">
        <div className="flex flex-wrap items-center gap-2">
          <input
            autoFocus
            value={text}
            maxLength={100}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') add();
              if (e.key === 'Escape') setOpen(false);
            }}
            placeholder="Skriv et negativt søgeord og tryk Enter"
            aria-label="Manuelt negativt søgeord"
            className="h-8 min-w-[200px] flex-1 rounded-lg border border-line bg-surface px-2.5 text-[13px] outline-none focus:border-brand/50 focus:ring-2 focus:ring-brand/10"
          />
          <div className="flex h-8 rounded-lg border border-line bg-surface p-0.5" role="radiogroup" aria-label="Match">
            {(['Phrase', 'Exact'] as const).map((m) => (
              <button
                key={m}
                type="button"
                role="radio"
                aria-checked={matchType === m}
                onClick={() => setMatchType(m)}
                className={cn('rounded-md px-2 text-[12px] font-medium transition-colors', matchType === m ? 'bg-ink text-white' : 'text-muted hover:text-ink')}
              >
                {m}
              </button>
            ))}
          </div>
          <Button size="sm" variant="secondary" disabled={!clean || duplicate} onClick={add}>
            <Plus /> Tilføj
          </Button>
        </div>
        {duplicate && <div className="mt-1 text-[12px] text-warning">Det søgeord er allerede på listen.</div>}
      </td>
    </tr>
  );
}

/**
 * A plan with ChangePlan.pick: every row has a tick box, so the user chooses which of the
 * proposed items (e.g. negative keywords) are carried out, and can add their own at the end.
 */
function PickTable({
  part,
  currency,
  excluded,
  setExcluded,
  manual,
  setManual,
}: {
  part: ToolPart;
  currency: string;
  excluded: Set<number>;
  setExcluded: (next: Set<number>) => void;
  manual: ManualItem[];
  setManual: (next: ManualItem[]) => void;
}) {
  const plan = part.plan!;
  const pick = plan.pick!;
  const waiting = part.status === 'awaiting_approval';
  // Columns with nothing to say in any row (empty, or 0 everywhere) are left out.
  const columns = pick.columns.filter((col) => plan.changes.some((c) => ![null, undefined, '', 0].includes(c.cells?.[col.key])));
  const total = plan.changes.length;
  const chosen = total - excluded.size;
  const span = (waiting ? 1 : 0) + 1 + (pick.tag ? 1 : 0) + columns.length;
  const toggle = (i: number) => {
    const next = new Set(excluded);
    if (next.has(i)) next.delete(i);
    else next.add(i);
    setExcluded(next);
  };
  const value = (v: string | number | null | undefined, format?: 'money' | 'number') => {
    if (v === null || v === undefined || v === '') return <span className="text-subtle">–</span>;
    if (typeof v === 'number') return <span className="tabular">{format === 'money' ? fmtMoney(v, currency) : fmtNumber(v)}</span>;
    return v;
  };

  return (
    <div className="mx-4 overflow-hidden rounded-xl border border-line">
      <div className="max-h-[460px] overflow-auto">
        <table className="w-full text-[13px]" data-selectable>
          <thead className="sticky top-0 z-[1] bg-[#fafafb]">
            <tr className="text-left text-[11.5px] font-semibold text-muted">
              {waiting && (
                <th className="w-9 py-1.5 pl-3">
                  <input
                    type="checkbox"
                    aria-label={chosen === total ? 'Fravælg alle' : 'Vælg alle'}
                    checked={chosen === total}
                    ref={(el) => {
                      if (el) el.indeterminate = chosen > 0 && chosen < total;
                    }}
                    onChange={() => setExcluded(chosen === total ? new Set(plan.changes.map((_, i) => i)) : new Set())}
                    className="size-4 accent-[var(--color-brand)]"
                  />
                </th>
              )}
              <th className="w-full min-w-[200px] px-3 py-1.5">Negativt søgeord</th>
              {pick.tag && <th className="px-2 py-1.5 text-center">Match</th>}
              {columns.map((col) => (
                <th key={col.key} className={cn('whitespace-nowrap px-3 py-1.5', col.format && 'text-right')}>
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {plan.changes.map((c, i) => {
              // After approval the plan holds only the rows that were carried out.
              const off = waiting && excluded.has(i);
              const tag = pick.tag ? c.cells?.[pick.tag] : null;
              const note = pick.note ? c.cells?.[pick.note] : null;
              return (
                <tr
                  key={i}
                  onClick={(e) => waiting && !(e.target as HTMLElement).closest('input') && toggle(i)}
                  className={cn('border-t border-line-2 transition-colors', waiting && 'cursor-pointer hover:bg-line-2/50', off && 'text-subtle')}
                >
                  {waiting && (
                    <td className="py-1.5 pl-3">
                      <input type="checkbox" checked={!off} onChange={() => toggle(i)} aria-label={`Medtag ${String(c.after ?? '')}`} className="size-4 accent-[var(--color-brand)]" />
                    </td>
                  )}
                  <td className="px-3 py-1.5">
                    <div className={cn('font-medium [overflow-wrap:anywhere]', off ? 'text-subtle line-through decoration-black/20' : 'text-ink')}>{String(c.after ?? '')}</div>
                    {note && <div className={cn('mt-0.5 text-[12px] leading-snug', off ? 'text-subtle' : 'text-muted')}>{note}</div>}
                  </td>
                  {pick.tag && <td className="px-2 py-1.5 text-center">{tag ? <Tag muted={off}>{tag}</Tag> : null}</td>}
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={cn(
                        'px-3 py-1.5',
                        col.format ? 'whitespace-nowrap text-right' : 'min-w-[120px] max-w-[180px] text-[12.5px] leading-snug [overflow-wrap:anywhere]',
                        !off && col.key === 'target' && 'text-ink-2',
                      )}
                      title={typeof c.cells?.[col.key] === 'string' ? String(c.cells[col.key]) : undefined}
                    >
                      {value(c.cells?.[col.key], col.format)}
                    </td>
                  ))}
                </tr>
              );
            })}
            {waiting &&
              manual.map((m, i) => (
                <tr key={`manual-${m.text}`} className="border-t border-line-2 bg-brand-50/40">
                  <td className="py-1.5 pl-3">
                    <input type="checkbox" checked onChange={() => setManual(manual.filter((_, j) => j !== i))} aria-label={`Fjern ${m.text}`} className="size-4 accent-[var(--color-brand)]" />
                  </td>
                  <td className="px-3 py-1.5">
                    <div className="font-medium text-ink [overflow-wrap:anywhere]">{m.text}</div>
                    <div className="mt-0.5 text-[12px] text-muted">{pick.add?.note}</div>
                  </td>
                  {pick.tag && (
                    <td className="px-2 py-1.5 text-center">
                      <Tag>{m.matchType}</Tag>
                    </td>
                  )}
                  {columns.map((col) => (
                    <td key={col.key} className={cn('px-3 py-1.5', col.format ? 'text-right' : 'text-[12.5px] text-ink-2')}>
                      {pick.add?.cells?.[col.key] ?? <span className="text-subtle">–</span>}
                    </td>
                  ))}
                </tr>
              ))}
            {waiting && pick.add && (
              <AddRow
                label={pick.add.label}
                span={span}
                existing={[...plan.changes.map((c) => String(c.after ?? '')), ...manual.map((m) => m.text)]}
                onAdd={(item) => setManual([...manual, item])}
              />
            )}
          </tbody>
        </table>
      </div>
      {waiting && (
        <div className="flex items-center gap-3 border-t border-line bg-[#fafafb] px-3 py-1.5 text-[12px] text-muted">
          <span className="font-medium text-ink-2">
            {chosen + manual.length} af {total + manual.length} valgt
          </span>
          <button type="button" className="hover:text-ink" onClick={() => setExcluded(new Set())}>
            Vælg alle
          </button>
          <button type="button" className="hover:text-ink" onClick={() => setExcluded(new Set(plan.changes.map((_, i) => i)))}>
            Fravælg alle
          </button>
        </div>
      )}
    </div>
  );
}

export function ApprovalCard({ part, currency }: { part: ToolPart; currency: string }) {
  const plan = part.plan!;
  const [note, setNote] = useState('');
  const [showNote, setShowNote] = useState(false);
  const entry = useActivity((s) => (part.activityId ? s.entries.find((e) => e.id === part.activityId) : undefined));
  const waiting = part.status === 'awaiting_approval';
  const s = STATUS[part.status];
  const hasBefore = plan.changes.some((c) => c.before !== undefined);
  const budgetDelta = plan.dailyBudgetDelta;
  const [edits, setEdits] = useState<Record<number, string>>({});
  const [excluded, setExcluded] = useState<Set<number>>(new Set());
  const [manual, setManual] = useState<ManualItem[]>([]);
  const chosen = plan.changes.length - excluded.size + manual.length;
  const editable = waiting && plan.changes.some((c) => c.edit);
  // Corrections on rows that were ticked off don't count.
  const changed = Object.entries(edits).filter(([i, v]) => !excluded.has(Number(i)) && v.trim() !== String(plan.changes[Number(i)]?.after ?? ''));
  const editCount = changed.length;
  const invalid = Object.entries(edits).some(([i, v]) => {
    if (excluded.has(Number(i))) return false;
    const max = plan.changes[Number(i)]?.edit?.maxLength;
    return !v.trim() || (max !== undefined && v.trim().length > max);
  });
  const approve = () =>
    answerApproval(part.id, {
      approved: true,
      edits: changed.map(([i, v]) => ({ path: plan.changes[Number(i)]!.edit!.path, value: v.trim() })),
      excluded: plan.pick ? [...excluded] : undefined,
      added: plan.pick?.add && manual.length ? manual : undefined,
    });

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8, scale: 0.99 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.35, ease: EASE }}
      className={cn('relative overflow-hidden rounded-2xl border bg-surface transition-[border-color,box-shadow]', waiting ? 'border-brand/35 shadow-glow' : 'border-line')}
    >
      <div className="flex items-start gap-3 px-4 pb-3 pt-4">
        <span className={cn('mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg', part.status === 'blocked' ? 'bg-negative-bg text-negative' : 'bg-brand-50 text-brand')}>
          {part.status === 'blocked' ? <ShieldAlert className="size-4" /> : <ShieldCheck className="size-4" />}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="text-[14.5px] font-medium text-ink">{plan.title}</h4>
            <Badge tone={s.tone}>
              <s.icon className={cn('size-3', (part.status === 'running' || part.status === 'streaming') && 'animate-spin')} />
              {s.label}
            </Badge>
          </div>
          {plan.reason && <p className="mt-1 text-[13px] leading-relaxed text-muted">{plan.reason}</p>}
        </div>
      </div>

      {plan.pick ? (
        <PickTable part={part} currency={currency} excluded={excluded} setExcluded={setExcluded} manual={manual} setManual={setManual} />
      ) : (
        <div className="mx-4 overflow-hidden rounded-xl border border-line">
          <table className="w-full text-[13px]" data-selectable>
            <thead>
              <tr className="bg-[#fafafb] text-left text-[11.5px] font-semibold text-muted">
                <th className="px-3 py-1.5">Ændring</th>
                {hasBefore && <th className="px-3 py-1.5">Før</th>}
                <th className="px-3 py-1.5">{hasBefore ? 'Efter' : 'Værdi'}</th>
              </tr>
            </thead>
            <tbody>
              {plan.changes.slice(0, 40).map((c, i) => (
                <tr key={i} className="border-t border-line-2">
                  <td className="max-w-[260px] truncate px-3 py-1.5 text-ink-2" title={c.field}>
                    {c.field}
                  </td>
                  {hasBefore && <td className="px-3 py-1.5 text-muted line-through decoration-black/20">{cell(c.before, currency)}</td>}
                  {waiting && c.edit ? (
                    <td className="px-2 py-1">
                      <EditableValue
                        value={edits[i] ?? String(c.after ?? '')}
                        original={String(c.after ?? '')}
                        maxLength={c.edit.maxLength}
                        onChange={(v) => setEdits((e) => ({ ...e, [i]: v }))}
                      />
                    </td>
                  ) : (
                    <td className="max-w-[320px] truncate px-3 py-1.5 font-medium text-ink" title={typeof c.after === 'string' ? c.after : undefined}>
                      {cell(c.after, currency)}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          {plan.changes.length > 40 && <div className="border-t border-line bg-[#fafafb] px-3 py-1 text-[11.5px] text-muted">+ {plan.changes.length - 40} flere</div>}
        </div>
      )}

      <div className="grid gap-1.5 px-4 pt-3 text-[12.5px]">
        {budgetDelta !== 0 && (
          <div className={cn('font-medium', budgetDelta > 0 ? 'text-warning' : 'text-positive')}>
            Samlet aktivt dagsbudget {budgetDelta > 0 ? 'stiger' : 'falder'} med {fmtMoney(Math.abs(budgetDelta), currency)}
          </div>
        )}
        {part.decision?.reasons.map((r) => (
          <div key={r} className={cn('flex items-start gap-1.5', part.decision?.verdict === 'block' ? 'text-negative' : 'text-muted')}>
            <span className="mt-[7px] size-1 shrink-0 rounded-full bg-current" />
            {r}
          </div>
        ))}
        {plan.notes?.map((n) => (
          <div key={n} className="text-muted">
            {n}
          </div>
        ))}
        {part.error && <div className="rounded-lg bg-negative-bg px-2.5 py-1.5 text-negative">{part.error}</div>}
        {part.summary && part.status === 'done' && <div className="text-positive">{part.summary}</div>}
      </div>

      <div className="px-4 pb-4 pt-3">
        <AnimatePresence initial={false}>
          {waiting && showNote && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
              <input
                autoFocus
                value={note}
                onChange={(e) => setNote(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && answerApproval(part.id, { approved: false, note: note.trim() || undefined })}
                placeholder="Hvorfor? (valgfrit – assistenten får besked)"
                className="mb-2.5 h-9 w-full rounded-xl border border-line px-3 text-[13px] outline-none focus:border-brand/50 focus:ring-4 focus:ring-brand/10"
              />
            </motion.div>
          )}
        </AnimatePresence>
        {waiting ? (
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="positive" disabled={invalid || (!!plan.pick && chosen === 0)} onClick={approve}>
              <Check />{' '}
              {plan.pick
                ? plan.pick.approveLabel.replace('{n}', String(chosen))
                : editCount
                  ? `Godkend med ${editCount} rettelse${editCount === 1 ? '' : 'r'}`
                  : 'Godkend'}
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => (showNote ? answerApproval(part.id, { approved: false, note: note.trim() || undefined }) : setShowNote(true))}
            >
              <X /> {showNote ? 'Afvis' : 'Afvis …'}
            </Button>
            <span className="ml-auto text-[11.5px] text-subtle">
              {plan.pick
                ? 'Fjern fluebenet ved dem, der ikke skal med.'
                : editable
                  ? 'Du kan rette værdierne, før du godkender.'
                  : 'Ændringen sendes først, når du godkender.'}
            </span>
          </div>
        ) : (
          part.status === 'done' &&
          entry?.undo && (
            <Button
              size="xs"
              variant="ghost"
              disabled={entry.undone}
              onClick={async () => {
                try {
                  await undoActivity(entry.id);
                  toast.success('Ændringen er fortrudt');
                } catch (e) {
                  toast.error('Kunne ikke fortryde', { description: errorMessage(e) });
                }
              }}
            >
              <Undo2 /> {entry.undone ? 'Fortrudt' : 'Fortryd'}
            </Button>
          )
        )}
      </div>
    </motion.div>
  );
}
