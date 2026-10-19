/** The messages waiting while the assistant answers (features/chat/queue.ts). */
import { Clock3, Paperclip, X, Zap } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { EASE } from '@/components/motion';
import { Tooltip } from '@/components/ui/overlays';
import { removeQueued, sendQueuedNow, useQueue } from './queue';

export function QueueList({ convId }: { convId: string | null }) {
  const queued = useQueue((s) => (convId ? s.byConv[convId] : undefined)) ?? [];
  if (!convId) return null;
  return (
    <AnimatePresence initial={false}>
      {queued.length > 0 && (
        <motion.ul
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 6 }}
          transition={{ duration: 0.2, ease: EASE }}
          className="mb-2 grid gap-1.5"
          aria-label="Beskeder i kø"
        >
          {queued.map((m, i) => (
            <motion.li
              key={m.id}
              layout
              className="flex min-w-0 items-center gap-2 rounded-xl border border-line bg-white/90 py-1.5 pl-3 pr-1.5 text-[13px] shadow-[0_2px_8px_-4px_rgb(18_18_22/0.12)] backdrop-blur"
            >
              <Clock3 className="size-3.5 shrink-0 text-subtle" />
              <span className="shrink-0 text-[12px] font-medium text-muted">{m.now ? 'Sendes nu' : i === 0 ? 'Næste' : `I kø ${i + 1}`}</span>
              <span className="min-w-0 flex-1 truncate text-ink-2">{m.text || 'Vedhæftede filer'}</span>
              {m.attachments.length > 0 && (
                <span className="flex shrink-0 items-center gap-0.5 text-[12px] text-muted">
                  <Paperclip className="size-3" />
                  {m.attachments.length}
                </span>
              )}
              {!m.now && (
                <Tooltip content="Afbryd det nuværende svar og send denne nu – assistenten husker det første spørgsmål">
                  <button
                    type="button"
                    onClick={() => sendQueuedNow(convId, m.id)}
                    className="flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-[12px] font-medium text-brand transition-colors hover:bg-brand-50"
                  >
                    <Zap className="size-3.5" /> Send nu
                  </button>
                </Tooltip>
              )}
              <Tooltip content="Fjern fra køen">
                <button
                  type="button"
                  onClick={() => removeQueued(convId, m.id)}
                  className="grid size-7 shrink-0 place-items-center rounded-lg text-muted transition-colors hover:bg-line-2 hover:text-ink"
                  aria-label="Fjern fra køen"
                >
                  <X className="size-3.5" />
                </button>
              </Tooltip>
            </motion.li>
          ))}
        </motion.ul>
      )}
    </AnimatePresence>
  );
}
