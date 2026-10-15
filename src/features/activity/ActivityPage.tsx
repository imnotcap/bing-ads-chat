import { AnimatePresence, motion } from 'motion/react';
import { Ban, Bot, CheckCircle2, ChevronRight, MessageSquare, ShieldAlert, Trash2, Undo2, User, XCircle } from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { undoActivity } from '@/ai/agent';
import { AnimatedList } from '@/components/reactbits';
import { EASE, pageTransition } from '@/components/motion';
import { Button } from '@/components/ui/button';
import { Badge, Segmented } from '@/components/ui/controls';
import { Dialog } from '@/components/ui/overlays';
import { fmtMoney } from '@/lib/format';
import { cn, errorMessage } from '@/lib/utils';
import { useActivity, type ActivityEntry } from '@/stores/activity';
import { useChat } from '@/stores/chat';
import { useConnection, useCurrentAccount } from '@/stores/connection';
import { useUi } from '@/stores/ui';

const STATUS = {
  success: { label: 'Gennemført', tone: 'positive' as const, icon: CheckCircle2 },
  failed: { label: 'Fejlede', tone: 'negative' as const, icon: XCircle },
  rejected: { label: 'Afvist af dig', tone: 'neutral' as const, icon: XCircle },
  blocked: { label: 'Blokeret', tone: 'warning' as const, icon: Ban },
};

const SOURCE = {
  assistant: { label: 'Assistent', icon: Bot, cls: 'bg-violet-50 text-violet' },
  user: { label: 'Dig', icon: User, cls: 'bg-brand-50 text-brand' },
  budgetvagt: { label: 'Budgetvagt', icon: ShieldAlert, cls: 'bg-warning-bg text-warning' },
};

function Entry({ e, currency }: { e: ActivityEntry; currency: string }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const select = useChat((s) => s.select);
  const exists = useChat((s) => (e.conversationId ? s.conversations.some((c) => c.id === e.conversationId) : false));
  const go = useUi((s) => s.go);
  const s = STATUS[e.status];
  const src = SOURCE[e.source];
  return (
    <div className="card overflow-hidden">
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex w-full items-center gap-3 px-4 py-3 text-left">
        <span className={cn('grid size-9 shrink-0 place-items-center rounded-xl', src.cls)}>
          <src.icon className="size-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[14px] font-semibold text-ink">{e.summary}</span>
          <span className="block text-[12px] text-muted">
            {src.label} · {new Date(e.ts).toLocaleString('da-DK', { dateStyle: 'medium', timeStyle: 'short' })} · {e.changes.length} ændring{e.changes.length === 1 ? '' : 'er'}
            {e.mode === 'demo' && ' · demo'}
          </span>
        </span>
        {e.undone && <Badge>Fortrudt</Badge>}
        <Badge tone={s.tone}>
          <s.icon className="size-3" /> {s.label}
        </Badge>
        <ChevronRight className={cn('size-4 text-subtle transition-transform', open && 'rotate-90')} />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} transition={{ duration: 0.25, ease: EASE }} className="overflow-hidden">
            <div className="border-t border-line px-4 pb-4 pt-3">
              {e.error && <p className="mb-3 rounded-xl bg-negative-bg px-3 py-2 text-[12.5px] text-negative">{e.error}</p>}
              <table className="w-full text-[13px]" data-selectable>
                <tbody>
                  {e.changes.map((c, i) => (
                    <tr key={i} className="border-b border-line-2 last:border-0">
                      <td className="py-1.5 pr-3 text-ink-2">{c.field}</td>
                      <td className="py-1.5 pr-3 text-muted line-through decoration-black/20">{typeof c.before === 'number' ? fmtMoney(c.before, currency) : (c.before ?? '')}</td>
                      <td className="py-1.5 font-medium text-ink">{typeof c.after === 'number' ? fmtMoney(c.after, currency) : (c.after ?? '')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="mt-3 flex gap-2">
                {e.undo && e.status === 'success' && (
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={e.undone || busy}
                    onClick={async () => {
                      setBusy(true);
                      try {
                        await undoActivity(e.id);
                        toast.success('Ændringen er fortrudt');
                      } catch (err) {
                        toast.error('Kunne ikke fortryde', { description: errorMessage(err) });
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    <Undo2 /> {e.undone ? 'Fortrudt' : 'Fortryd ændringen'}
                  </Button>
                )}
                {exists && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      select(e.conversationId!);
                      go('chat');
                    }}
                  >
                    <MessageSquare /> Gå til samtalen
                  </Button>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function ActivityPage() {
  const entries = useActivity((s) => s.entries);
  const clear = useActivity((s) => s.clear);
  const accountId = useConnection((s) => s.accountId);
  const mode = useConnection((s) => s.mode);
  const account = useCurrentAccount();
  const [filter, setFilter] = useState<'all' | ActivityEntry['status']>('all');
  const [scope, setScope] = useState<'account' | 'all'>('account');
  const [confirm, setConfirm] = useState(false);
  const list = useMemo(
    () => entries.filter((e) => (filter === 'all' || e.status === filter) && (scope === 'all' || (e.accountId === accountId && e.mode === mode))),
    [entries, filter, scope, accountId, mode],
  );

  return (
    <motion.div {...pageTransition} className="flex h-full min-w-0 flex-1 flex-col overflow-hidden">
      <header className="flex shrink-0 flex-wrap items-center gap-3 px-8 pb-4 pt-7">
        <div className="mr-auto">
          <h1 className="text-[26px] font-medium tracking-[-0.03em] text-ink">Aktivitet</h1>
          <p className="text-[13px] text-muted">Alle ændringer foretaget gennem appen – af dig, assistenten eller budgetvagten.</p>
        </div>
        <Segmented
          layoutId="activity-scope"
          size="sm"
          value={scope}
          onChange={setScope}
          options={[
            { value: 'account', label: account?.name ?? 'Denne konto' },
            { value: 'all', label: 'Alle konti' },
          ]}
        />
        <Button size="sm" variant="ghost" onClick={() => setConfirm(true)} disabled={!entries.length}>
          <Trash2 /> Ryd log
        </Button>
      </header>
      <div className="px-8 pb-3">
        <Segmented
          layoutId="activity-filter"
          size="sm"
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'all', label: 'Alle' },
            { value: 'success', label: 'Gennemført' },
            { value: 'rejected', label: 'Afvist' },
            { value: 'blocked', label: 'Blokeret' },
            { value: 'failed', label: 'Fejlede' },
          ]}
        />
      </div>
      <div className="flex-1 overflow-y-auto px-8 pb-10">
        {list.length === 0 ? (
          <div className="mt-16 text-center">
            <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-white shadow-card">
              <ShieldAlert className="size-6 text-subtle" />
            </div>
            <p className="mt-4 text-[14px] font-medium text-ink">Ingen ændringer endnu</p>
            <p className="mt-1 text-[13px] text-muted">Når assistenten eller du ændrer noget på kontoen, kan du se og fortryde det her.</p>
          </div>
        ) : (
          <AnimatedList items={list} getKey={(e) => e.id} className="grid max-w-[920px] gap-2.5" renderItem={(e) => <Entry e={e} currency={account?.currency ?? 'DKK'} />} />
        )}
      </div>
      <Dialog
        open={confirm}
        onOpenChange={setConfirm}
        title="Ryd aktivitetsloggen?"
        description="Loggen slettes fra denne computer. Ændringerne på kontoen påvirkes ikke, men kan ikke længere fortrydes herfra."
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirm(false)}>
              Annullér
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                clear();
                setConfirm(false);
              }}
            >
              Ryd log
            </Button>
          </>
        }
      />
    </motion.div>
  );
}
