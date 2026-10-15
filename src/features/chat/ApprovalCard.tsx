/**
 * A change proposed by the assistant: what changes (before → after), why, which
 * spending rules apply, and Godkend/Afvis while it waits for the user.
 */
import { AnimatePresence, motion } from 'motion/react';
import { Ban, Check, CheckCircle2, Clock, Loader2, ShieldAlert, ShieldCheck, Undo2, X, XCircle } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
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

export function ApprovalCard({ part, currency }: { part: ToolPart; currency: string }) {
  const plan = part.plan!;
  const [note, setNote] = useState('');
  const [showNote, setShowNote] = useState(false);
  const entry = useActivity((s) => (part.activityId ? s.entries.find((e) => e.id === part.activityId) : undefined));
  const waiting = part.status === 'awaiting_approval';
  const s = STATUS[part.status];
  const hasBefore = plan.changes.some((c) => c.before !== undefined);
  const budgetDelta = plan.dailyBudgetDelta;

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
                <td className="max-w-[320px] truncate px-3 py-1.5 font-medium text-ink" title={typeof c.after === 'string' ? c.after : undefined}>
                  {cell(c.after, currency)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {plan.changes.length > 40 && <div className="border-t border-line bg-[#fafafb] px-3 py-1 text-[11.5px] text-muted">+ {plan.changes.length - 40} flere</div>}
      </div>

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
            <Button size="sm" variant="positive" onClick={() => answerApproval(part.id, { approved: true })}>
              <Check /> Godkend
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => (showNote ? answerApproval(part.id, { approved: false, note: note.trim() || undefined }) : setShowNote(true))}
            >
              <X /> {showNote ? 'Afvis' : 'Afvis …'}
            </Button>
            <span className="ml-auto text-[11.5px] text-subtle">Ændringen sendes først, når du godkender.</span>
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
