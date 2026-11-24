/**
 * Several approval cards from one reply, shown as ONE: a line per change (title, what it
 * does) with a tick, each opening into its full card to correct values and rows, and one
 * Godkend / Afvis for all of them. Untouched cards are approved exactly as shown; a card
 * opened and edited sends its own corrections (ApprovalCard → batchApprovers). Unticked
 * changes are rejected, so the assistant knows they were left out on purpose.
 */
import { AnimatePresence, motion } from 'motion/react';
import { useMemo, useState } from 'react';
import { Ban, Check, CheckCircle2, ChevronDown, Clock, Layers, Loader2, X, XCircle } from '@/components/icons';
import { answerApproval } from '@/ai/approvals';
import { toast } from '@/components/notifications/toast';
import { EASE } from '@/components/motion';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { ToolPart } from '@/stores/chat';
import { ApprovalCard, batchApprovers, defaultApproval } from './ApprovalCard';
import { batchReasons, cardSummary } from './batchSummary';

const ICON: Partial<Record<ToolPart['status'], { icon: typeof Clock; cls: string }>> = {
  awaiting_approval: { icon: Clock, cls: 'text-warning' },
  running: { icon: Loader2, cls: 'animate-spin text-brand' },
  done: { icon: CheckCircle2, cls: 'text-positive' },
  rejected: { icon: XCircle, cls: 'text-subtle' },
  blocked: { icon: Ban, cls: 'text-negative' },
  error: { icon: XCircle, cls: 'text-negative' },
};

export function ApprovalBatch({ parts, currency }: { parts: ToolPart[]; currency: string }) {
  const [off, setOff] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState<string | null>(null);
  // Cards opened once stay mounted (hidden), so their corrections survive closing them.
  const [mounted, setMounted] = useState<Set<string>>(new Set());
  const waiting = parts.filter((p) => p.status === 'awaiting_approval');
  const chosen = waiting.filter((p) => !off.has(p.id));
  const rows = chosen.reduce((n, p) => n + (p.plan?.changes.length ?? 0), 0);
  const reasons = useMemo(() => batchReasons(waiting), [waiting]);
  const counts = {
    done: parts.filter((p) => p.status === 'done').length,
    rejected: parts.filter((p) => p.status === 'rejected').length,
    failed: parts.filter((p) => p.status === 'error' || p.status === 'blocked').length,
    running: parts.filter((p) => p.status === 'running').length,
  };

  const toggleOpen = (id: string) => {
    setMounted((m) => (m.has(id) ? m : new Set(m).add(id)));
    setOpen((o) => (o === id ? null : id));
  };

  const approveAll = () => {
    const held: string[] = [];
    for (const p of waiting) {
      if (off.has(p.id)) {
        answerApproval(p.id, { approved: false, note: 'Fravalgt i den samlede godkendelse.' });
        continue;
      }
      const fn = batchApprovers.get(p.id);
      if (fn) {
        if (!fn()) held.push(p.id);
      } else answerApproval(p.id, defaultApproval(p));
    }
    if (held.length) {
      setOpen(held[0]!);
      toast.warning(`${held.length} ${held.length === 1 ? 'ændring venter' : 'ændringer venter'} stadig`, { description: 'En værdi er ugyldig, eller ingen rækker er valgt – ret det og tryk Godkend igen.' });
    }
  };
  const rejectAll = () => {
    for (const p of waiting) answerApproval(p.id, { approved: false, note: 'Afvist samlet.' });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.99 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.35, ease: EASE }}
      className={cn('overflow-hidden rounded-2xl border bg-surface', waiting.length ? 'border-brand/35 shadow-glow' : 'border-line')}
    >
      <div className="flex items-start gap-3 px-4 pb-3 pt-4">
        <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand">
          <Layers className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <h4 className="text-[14.5px] font-medium text-ink">{parts.length} ændringer samlet</h4>
          <p className="mt-0.5 text-[12.5px] text-muted">
            {[
              waiting.length ? `${waiting.length} venter på dig` : '',
              counts.running ? `${counts.running} udføres` : '',
              counts.done ? `${counts.done} gennemført` : '',
              counts.rejected ? `${counts.rejected} afvist` : '',
              counts.failed ? `${counts.failed} fejlede` : '',
            ]
              .filter(Boolean)
              .join(' · ')}
            {waiting.length > 0 && ' – åbn en linje for at rette værdier eller fravælge rækker.'}
          </p>
        </div>
      </div>

      <ul className="mx-4 max-h-[560px] divide-y divide-line-2 overflow-y-auto rounded-xl border border-line">
        {parts.map((p) => {
          const st = ICON[p.status] ?? ICON.running!;
          const isWaiting = p.status === 'awaiting_approval';
          const isOpen = open === p.id;
          return (
            <li key={p.id}>
              <div className={cn('flex min-w-0 items-center gap-2.5 px-3 py-2 text-[13px]', isOpen && 'bg-[#fafafb]')}>
                {isWaiting ? (
                  <input
                    type="checkbox"
                    aria-label={`Medtag ${p.plan?.title ?? p.label}`}
                    checked={!off.has(p.id)}
                    onChange={() => setOff((o) => (o.has(p.id) ? new Set([...o].filter((x) => x !== p.id)) : new Set(o).add(p.id)))}
                    className="size-4 shrink-0 accent-[var(--color-brand,#6d5cf6)]"
                  />
                ) : (
                  <st.icon className={cn('size-4 shrink-0', st.cls)} />
                )}
                <button type="button" onClick={() => toggleOpen(p.id)} className="flex min-w-0 flex-1 items-center gap-2 text-left">
                  <span className={cn('min-w-0 shrink truncate font-medium', isWaiting && off.has(p.id) ? 'text-subtle line-through' : 'text-ink')}>{p.plan?.title ?? p.label}</span>
                  <span className="min-w-0 flex-1 truncate text-[12px] text-muted">{p.plan ? cardSummary(p.plan, currency) : ''}</span>
                  {p.decision?.verdict === 'approve' && p.decision.reasons.length > 0 && isWaiting && <span className="size-1.5 shrink-0 rounded-full bg-warning" title={p.decision.reasons.join(' ')} />}
                  <ChevronDown className={cn('size-4 shrink-0 text-subtle transition-transform', isOpen && 'rotate-180')} />
                </button>
              </div>
              {mounted.has(p.id) && (
                <div className={cn('border-t border-line-2 bg-[#fafafb] p-2', !isOpen && 'hidden')}>
                  <ApprovalCard part={p} currency={currency} inBatch />
                </div>
              )}
            </li>
          );
        })}
      </ul>

      <AnimatePresence initial={false}>
        {waiting.length > 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="grid gap-2 px-4 pb-4 pt-3">
            {reasons.map((r) => (
              <div key={r.text} className="flex items-start gap-1.5 text-[12.5px] text-muted">
                <span className="mt-[7px] size-1 shrink-0 rounded-full bg-current" />
                <span>
                  {r.text}
                  {r.count > 1 && <span className="text-subtle"> (i {r.count} af ændringerne)</span>}
                </span>
              </div>
            ))}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <Button size="sm" variant="positive" disabled={!chosen.length} onClick={approveAll}>
                <Check /> Godkend {chosen.length === waiting.length ? 'alle' : chosen.length} ({rows} {rows === 1 ? 'række' : 'rækker'})
              </Button>
              <Button size="sm" variant="secondary" onClick={rejectAll}>
                <X /> Afvis alle
              </Button>
              <span className="ml-auto text-[11.5px] text-subtle">{off.size ? `${waiting.filter((p) => off.has(p.id)).length} fravalgt – de afvises.` : 'Intet sendes, før du godkender.'}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      {!waiting.length && <div className="h-3" />}
    </motion.div>
  );
}
