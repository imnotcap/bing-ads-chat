/**
 * The planning boards are shared with everyone signed in to the app (the
 * department's workspace on Cloudflare). This dialog shows the connection.
 */
import { Users } from 'lucide-react';
import { create } from 'zustand';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/overlays';
import { cn } from '@/lib/utils';
import { useAccount } from '@/stores/account';
import { boardAccess, useBoard, type Board, type SyncStatus } from '@/stores/board';

export const useShareDialog = create<{ open: boolean; setOpen: (open: boolean) => void }>((set) => ({ open: false, setOpen: (open) => set({ open }) }));

const STATUS: Record<SyncStatus, { label: string; dot: string }> = {
  local: { label: 'Ikke forbundet endnu', dot: 'bg-subtle' },
  connecting: { label: 'Forbinder …', dot: 'bg-warning animate-pulse' },
  online: { label: 'Synkroniseret', dot: 'bg-positive' },
  offline: { label: 'Offline – gemmer dine ændringer', dot: 'bg-warning' },
  error: { label: 'Ingen adgang', dot: 'bg-negative' },
};

export function StatusDot({ status, className }: { status: SyncStatus; className?: string }) {
  return <span className={cn('size-2 shrink-0 rounded-full', STATUS[status].dot, className)} />;
}

export function ShareDialog() {
  const open = useShareDialog((s) => s.open);
  const setOpen = useShareDialog((s) => s.setOpen);
  const status = useBoard((s) => s.status);
  const detail = useBoard((s) => s.statusDetail);
  const members = useBoard((s) => s.members.length);
  const pending = useBoard((s) => s.pending.length);
  const offline = useAccount((s) => s.offline);

  return (
    <Dialog
      open={open}
      onOpenChange={setOpen}
      title="Delt med afdelingen"
      description="Alle, der er logget ind i appen, arbejder på de samme tavler og kort. Tavlerne gemmes på jeres Cloudflare og opdateres for alle med det samme."
      className="w-[min(480px,calc(100vw-32px))]"
      footer={
        <Button variant="secondary" onClick={() => setOpen(false)}>
          Luk
        </Button>
      }
    >
      <div className="grid gap-3">
        <div className="flex items-center gap-3 rounded-xl border border-line px-3.5 py-3">
          <span className="grid size-9 place-items-center rounded-lg bg-brand-50 text-brand">
            <Users className="size-4" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-[14px] font-semibold text-ink">Fælles planlægning</div>
            <div className="flex items-center gap-1.5 text-[12px] text-muted">
              <StatusDot status={status} /> {STATUS[status].label} · {members} {members === 1 ? 'medlem' : 'medlemmer'}
              {pending > 0 && status !== 'online' && ` · ${pending} ændring${pending === 1 ? '' : 'er'} venter`}
            </div>
          </div>
        </div>
        {(status === 'error' || offline) && detail && <p className="rounded-xl bg-negative-bg px-3.5 py-2.5 text-[12.5px] text-negative">{detail}</p>}
        <p className="text-[12.5px] leading-relaxed text-muted">
          En tavle kan være for alle, for udvalgte kolleger eller kun for dig – det vælges, når tavlen laves, og ændres i tavlens menu. Private tavler sendes kun til de personer, der må se dem. Nye kolleger kommer med, når de logger ind i appen med Microsoft.
        </p>
      </div>
    </Dialog>
  );
}

/** The sync status button in the board header. */
export function ShareButton({ board }: { board?: Board }) {
  const status = useBoard((s) => s.status);
  const setOpen = useShareDialog((s) => s.setOpen);
  return (
    <Button size="sm" variant="secondary" onClick={() => setOpen(true)} title={STATUS[status].label}>
      <StatusDot status={status} /> {!board || boardAccess(board) === 'everyone' ? 'Delt med afdelingen' : STATUS[status].label}
    </Button>
  );
}
