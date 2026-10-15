/**
 * Notifications in the app's own style (replaces the plain sonner popups):
 * a compact card with a tone icon, title, description and an optional action.
 * Every notification is also kept in the history (bell in the top bar), and –
 * when the window is hidden in the tray or unfocused – shown as a Windows
 * notification.
 *
 * Same call style as sonner: toast('…'), toast.success('…', { description, action }).
 */
import { AlertTriangle, ArrowDownToLine, Check, Info, RefreshCw, X, XCircle } from 'lucide-react';
import { motion } from 'motion/react';
import type { ReactNode } from 'react';
import { toast as sonner } from 'sonner';
import { isTauri } from '@/lib/platform';
import { cn } from '@/lib/utils';
import { useNotifications, type NotificationTone } from '@/stores/notifications';

export interface ToastOptions {
  description?: ReactNode;
  /** Ignored – all notifications show for 1 second (kept for call-site compatibility). */
  duration?: number;
  action?: { label: string; onClick: () => void };
  /** Keep out of the history (for trivial confirmations like "Kopieret"). */
  transient?: boolean;
  /** Also show a Windows notification when the app isn't in front. */
  native?: boolean;
}

const TONE: Record<NotificationTone, { icon: typeof Check; className: string }> = {
  success: { icon: Check, className: 'bg-positive-bg text-positive' },
  error: { icon: XCircle, className: 'bg-negative-bg text-negative' },
  warning: { icon: AlertTriangle, className: 'bg-warning-bg text-warning' },
  info: { icon: Info, className: 'bg-brand-50 text-brand' },
  update: { icon: ArrowDownToLine, className: 'bg-brand-50 text-brand' },
  sync: { icon: RefreshCw, className: 'bg-brand-50 text-brand' },
};

export function NotificationIcon({ tone, className }: { tone: NotificationTone; className?: string }) {
  const t = TONE[tone];
  return (
    <span className={cn('grid size-7 shrink-0 place-items-center rounded-full', t.className, className)}>
      <t.icon className="size-3.5" strokeWidth={2.4} />
    </span>
  );
}

function Card({ id, tone, title, opts }: { id: string | number; tone: NotificationTone; title: ReactNode; opts: ToastOptions }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -8, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
      className="group pointer-events-auto flex w-[356px] items-start gap-3 rounded-2xl border border-black/[0.06] bg-white/95 p-3.5 pr-3 font-sans shadow-pop backdrop-blur-xl"
    >
      <NotificationIcon tone={tone} />
      <div className="min-w-0 flex-1 pt-0.5">
        <div className="text-[13.5px] font-semibold leading-snug text-ink">{title}</div>
        {opts.description && <div className="mt-0.5 text-[12.5px] leading-relaxed text-muted">{opts.description}</div>}
        {opts.action && (
          <button
            type="button"
            onClick={() => {
              opts.action!.onClick();
              sonner.dismiss(id);
            }}
            className="mt-2 rounded-lg bg-ink px-2.5 py-1 text-[12px] font-medium text-white transition-colors hover:bg-ink-2"
          >
            {opts.action.label}
          </button>
        )}
      </div>
      <button
        type="button"
        aria-label="Luk"
        onClick={() => sonner.dismiss(id)}
        className="grid size-6 shrink-0 place-items-center rounded-md text-subtle opacity-0 transition-opacity hover:bg-line-2 hover:text-ink group-hover:opacity-100"
      >
        <X className="size-3.5" />
      </button>
    </motion.div>
  );
}

const TOAST_MS = 1000;

const plain = (node: ReactNode) => (typeof node === 'string' || typeof node === 'number' ? String(node) : undefined);

/** Windows notification when the user can't see the app (hidden in the tray, minimised or in another window). */
async function nativeNotify(title: string, body?: string) {
  if (!isTauri || (document.visibilityState === 'visible' && document.hasFocus())) return;
  try {
    const n = await import('@tauri-apps/plugin-notification');
    let granted = await n.isPermissionGranted();
    if (!granted) granted = (await n.requestPermission()) === 'granted';
    if (granted) n.sendNotification({ title, body });
  } catch {
    // Notifications unavailable – the in-app history still has it.
  }
}

function show(tone: NotificationTone, title: ReactNode, opts: ToastOptions = {}) {
  const text = plain(title);
  if (text && !opts.transient) {
    useNotifications.getState().push({ title: text, description: plain(opts.description), tone });
  }
  if (text && (opts.native ?? (tone === 'error' || tone === 'update' || tone === 'warning'))) void nativeNotify(text, plain(opts.description));
  // Short and out of the way: 1 second (hovering keeps it open); everything stays in the bell.
  return sonner.custom((id) => <Card id={id} tone={tone} title={title} opts={opts} />, { duration: TOAST_MS });
}

type ToastFn = ((title: ReactNode, opts?: ToastOptions) => string | number) & {
  success: (title: ReactNode, opts?: ToastOptions) => string | number;
  error: (title: ReactNode, opts?: ToastOptions) => string | number;
  warning: (title: ReactNode, opts?: ToastOptions) => string | number;
  info: (title: ReactNode, opts?: ToastOptions) => string | number;
  update: (title: ReactNode, opts?: ToastOptions) => string | number;
  sync: (title: ReactNode, opts?: ToastOptions) => string | number;
  dismiss: (id?: string | number) => void;
};

export const toast = Object.assign((title: ReactNode, opts?: ToastOptions) => show('info', title, opts), {
  success: (title: ReactNode, opts?: ToastOptions) => show('success', title, opts),
  error: (title: ReactNode, opts?: ToastOptions) => show('error', title, opts),
  warning: (title: ReactNode, opts?: ToastOptions) => show('warning', title, opts),
  info: (title: ReactNode, opts?: ToastOptions) => show('info', title, opts),
  update: (title: ReactNode, opts?: ToastOptions) => show('update', title, opts),
  sync: (title: ReactNode, opts?: ToastOptions) => show('sync', title, opts),
  dismiss: (id?: string | number) => void sonner.dismiss(id),
}) as ToastFn;

/** Exposed for code that only needs to send a Windows notification. */
export { nativeNotify };
