/**
 * Indstillinger → Brugere: who has an account in the app. Admins let new people in,
 * make others admin and remove people; everyone can see the list.
 */
import { Check, Loader2, LogOut, MoreHorizontal, Shield, ShieldOff, UserMinus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from '@/components/notifications/toast';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/controls';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/overlays';
import { fmtRelative } from '@/lib/format';
import { cn, errorMessage } from '@/lib/utils';
import { isAdmin, useAccount } from '@/stores/account';
import { listUsers, removeUser, signOut, updateUser } from '@/workspace/account';
import type { WorkspaceUser } from '@/workspace/types';

export function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '')).toUpperCase() || '?';
}

function UserRow({ user, me, admin, onChange }: { user: WorkspaceUser; me: boolean; admin: boolean; onChange: (users: WorkspaceUser[]) => void }) {
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const act = async (fn: () => Promise<WorkspaceUser[]>, done: string) => {
    setBusy(true);
    try {
      onChange(await fn());
      toast.success(done, { transient: true });
    } catch (e) {
      toast.error('Det lykkedes ikke', { description: errorMessage(e) });
    } finally {
      setBusy(false);
      setConfirm(false);
    }
  };
  const pending = user.status === 'pending';

  return (
    <div className="flex items-center gap-3 border-b border-line-2 py-3 last:border-0">
      <span className={cn('grid size-9 shrink-0 place-items-center rounded-full text-[12px] font-semibold text-white', pending ? 'bg-subtle' : 'bg-brand')}>{initials(user.name)}</span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-[14px] font-medium text-ink">{user.name}</span>
          {me && <span className="text-[12px] text-muted">(dig)</span>}
          {user.role === 'admin' && <Badge tone="brand">Administrator</Badge>}
          {pending && <Badge tone="warning">Venter</Badge>}
        </div>
        <div className="truncate text-[12.5px] text-muted">
          {user.email} · {pending ? `bad om adgang ${fmtRelative(user.createdAt)}` : `sidst aktiv ${fmtRelative(user.lastSeenAt)}`}
        </div>
      </div>
      {admin && pending && (
        <Button size="sm" variant="gradient" disabled={busy} onClick={() => void act(() => updateUser(user.id, { status: 'active' }), `${user.name} har fået adgang`)}>
          {busy ? <Loader2 className="animate-spin" /> : <Check />} Giv adgang
        </Button>
      )}
      {admin &&
        !me &&
        (confirm ? (
          <span className="flex items-center gap-1.5 text-[12.5px] text-muted">
            Fjern?
            <Button size="xs" variant="destructive" disabled={busy} onClick={() => void act(() => removeUser(user.id), `${user.name} er fjernet`)}>
              Fjern
            </Button>
            <Button size="xs" variant="ghost" onClick={() => setConfirm(false)}>
              Fortryd
            </Button>
          </span>
        ) : (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button type="button" aria-label={`Handlinger for ${user.name}`} className="grid size-8 place-items-center rounded-lg text-muted hover:bg-line-2 hover:text-ink">
                {busy ? <Loader2 className="size-4 animate-spin" /> : <MoreHorizontal className="size-4" />}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[220px]">
              {!pending &&
                (user.role === 'admin' ? (
                  <DropdownMenuItem onSelect={() => void act(() => updateUser(user.id, { role: 'member' }), `${user.name} er ikke længere administrator`)}>
                    <ShieldOff /> Fjern som administrator
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem onSelect={() => void act(() => updateUser(user.id, { role: 'admin' }), `${user.name} er nu administrator`)}>
                    <Shield /> Gør til administrator
                  </DropdownMenuItem>
                ))}
              {!pending && <DropdownMenuSeparator />}
              <DropdownMenuItem onSelect={() => setConfirm(true)} className="text-negative">
                <UserMinus /> Fjern fra appen
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ))}
    </div>
  );
}

export function UsersTab() {
  const me = useAccount((s) => s.user);
  const admin = isAdmin(me);
  const [users, setUsers] = useState<WorkspaceUser[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listUsers().then(setUsers, (e: unknown) => setError(errorMessage(e)));
  }, []);

  const pending = users?.filter((u) => u.status === 'pending') ?? [];
  const active = users?.filter((u) => u.status === 'active') ?? [];

  return (
    <div>
      <section className="border-b border-line py-7 first:pt-1">
        <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-ink">Din konto</h2>
        <p className="mt-1 text-[13px] leading-relaxed text-muted">
          Du er logget ind med Microsoft. Appen bruger kun dit navn og din e-mail, din Outlook-kalender (påmindelser, du selv opretter) og mails fra dig til dig selv (opfølgninger).
        </p>
        <div className="mt-4 flex items-center gap-3 rounded-xl border border-line px-3.5 py-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-brand text-[12px] font-semibold text-white">{initials(me?.name ?? '')}</span>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[14px] font-medium text-ink">{me?.name}</div>
            <div className="truncate text-[12.5px] text-muted">
              {me?.email} · {admin ? 'Administrator' : 'Medlem'}
            </div>
          </div>
          <Button size="sm" variant="secondary" onClick={() => void signOut()}>
            <LogOut /> Log ud
          </Button>
        </div>
      </section>

      <section className="py-7">
        <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-ink">Brugere</h2>
        <p className="mt-1 text-[13px] leading-relaxed text-muted">
          Alle med adgang ser og ændrer de samme forbindelser, kampagner og tavler. Kolleger med en inventarland.dk-adresse kommer ind med det samme; andre skal godkendes af en
          administrator.
        </p>
        {error && <p className="mt-4 rounded-xl bg-negative-bg px-3.5 py-2.5 text-[12.5px] text-negative">{error}</p>}
        {!users && !error && <Loader2 className="mt-4 size-5 animate-spin text-muted" />}
        {pending.length > 0 && (
          <div className="mt-4 rounded-2xl border border-warning/30 bg-warning-bg/40 px-4">
            {pending.map((u) => (
              <UserRow key={u.id} user={u} me={u.id === me?.id} admin={admin} onChange={setUsers} />
            ))}
          </div>
        )}
        {active.length > 0 && (
          <div className="mt-4 rounded-2xl border border-line px-4">
            {active.map((u) => (
              <UserRow key={u.id} user={u} me={u.id === me?.id} admin={admin} onChange={setUsers} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
