/** Bell in the top bar: the history of notifications (updates, sync, errors …). */
import { Bell, CheckCheck, Trash2 } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { Popover } from 'radix-ui';
import { useState } from 'react';
import { fmtRelative } from '@/lib/format';
import { cn } from '@/lib/utils';
import { useNotifications } from '@/stores/notifications';
import { Tooltip } from '../ui/overlays';
import { NotificationIcon } from './toast';

export function NotificationBell() {
  const items = useNotifications((s) => s.items);
  const markAllRead = useNotifications((s) => s.markAllRead);
  const clear = useNotifications((s) => s.clear);
  const [open, setOpen] = useState(false);
  const unread = items.filter((i) => !i.read).length;

  return (
    <Popover.Root
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) markAllRead();
      }}
    >
      <Tooltip content="Notifikationer" side="bottom">
        <Popover.Trigger asChild>
          <button
            type="button"
            aria-label={unread ? `Notifikationer (${unread} nye)` : 'Notifikationer'}
            className="relative grid size-8 place-items-center rounded-lg text-muted outline-none transition-colors hover:bg-line-2 hover:text-ink data-[state=open]:bg-line-2 data-[state=open]:text-ink"
          >
            <Bell className="size-4" />
            <AnimatePresence>
              {unread > 0 && (
                <motion.span
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  exit={{ scale: 0 }}
                  className="absolute right-1 top-1 grid min-w-[15px] place-items-center rounded-full border-2 border-surface bg-brand px-[3px] text-[9px] font-bold leading-[11px] text-white"
                >
                  {unread > 9 ? '9+' : unread}
                </motion.span>
              )}
            </AnimatePresence>
          </button>
        </Popover.Trigger>
      </Tooltip>
      <AnimatePresence>
        {open && (
          <Popover.Portal forceMount>
            <Popover.Content forceMount align="end" sideOffset={8} collisionPadding={12} className="z-50 outline-none">
              <motion.div
                initial={{ opacity: 0, y: -6, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -4, scale: 0.98, transition: { duration: 0.12 } }}
                transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                className="w-[380px] origin-top-right overflow-hidden rounded-2xl border border-line bg-white shadow-pop"
              >
                <div className="flex items-center justify-between border-b border-line px-4 py-3">
                  <span className="text-[14px] font-semibold text-ink">Notifikationer</span>
                  <div className="flex items-center gap-0.5">
                    <button type="button" title="Markér alle som læst" onClick={markAllRead} className="grid size-7 place-items-center rounded-md text-muted hover:bg-line-2 hover:text-ink">
                      <CheckCheck className="size-4" />
                    </button>
                    <button type="button" title="Ryd" onClick={clear} className="grid size-7 place-items-center rounded-md text-muted hover:bg-line-2 hover:text-ink">
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                </div>
                <div className="max-h-[420px] overflow-y-auto p-1.5">
                  {items.length === 0 ? (
                    <div className="grid place-items-center gap-2 px-6 py-10 text-center">
                      <Bell className="size-6 text-subtle" />
                      <div className="text-[13px] text-muted">Ingen notifikationer endnu.</div>
                      <div className="text-[12px] text-subtle">Opdateringer, synkroniseringer og fejl vises her.</div>
                    </div>
                  ) : (
                    items.map((n) => (
                      <div key={n.id} className={cn('flex gap-3 rounded-xl px-2.5 py-2.5', !n.read && 'bg-brand-50/60')}>
                        <NotificationIcon tone={n.tone} />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-baseline gap-2">
                            <span className="min-w-0 flex-1 text-[13px] font-medium leading-snug text-ink">{n.title}</span>
                            <span className="shrink-0 text-[11px] text-subtle">{fmtRelative(n.ts)}</span>
                          </div>
                          {n.description && <div className="mt-0.5 text-[12px] leading-relaxed text-muted">{n.description}</div>}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </motion.div>
            </Popover.Content>
          </Popover.Portal>
        )}
      </AnimatePresence>
    </Popover.Root>
  );
}
