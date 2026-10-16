/**
 * Who can see a board: everyone in the app, selected colleagues, or only you. Chosen
 * when a board is made ("Ny tavle") and changed in the board's menu by its owner.
 * The Cloudflare Worker only sends people the boards they may see.
 */
import { Check, Lock, Users, UsersRound, type LucideIcon } from 'lucide-react';
import { useState } from 'react';
import { create } from 'zustand';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/input';
import { Dialog, Tooltip } from '@/components/ui/overlays';
import { cn } from '@/lib/utils';
import { boardAccess, useBoard, type Board, type BoardAccess } from '@/stores/board';
import { useUi } from '@/stores/ui';
import { Avatar } from './parts';

const OPTIONS: { value: BoardAccess; label: string; text: string; icon: LucideIcon }[] = [
  { value: 'everyone', label: 'Alle', text: 'Alle i appen kan se og ændre den', icon: Users },
  { value: 'selected', label: 'Udvalgte', text: 'Kun dig og de kolleger, du vælger', icon: UsersRound },
  { value: 'private', label: 'Kun mig', text: 'Privat – ingen andre kan se den', icon: Lock },
];

export interface AccessValue {
  access: BoardAccess;
  sharedWith: string[];
}

/** Colleagues who can be given access: members with an account, except you. */
function useColleagues() {
  const members = useBoard((s) => s.members);
  const meId = useBoard((s) => s.meId);
  const linked = useBoard((s) => !!s.team);
  return members.filter((m) => m.id !== meId && (!linked || m.id.startsWith('u_')));
}

export function AccessPicker({ value, onChange, compact = false }: { value: AccessValue; onChange: (v: AccessValue) => void; compact?: boolean }) {
  const colleagues = useColleagues();
  return (
    <div className="grid gap-2.5">
      <div role="radiogroup" aria-label="Hvem kan se tavlen" className={cn('grid gap-1.5', compact ? 'grid-cols-3' : 'sm:grid-cols-3')}>
        {OPTIONS.map((o) => {
          const active = value.access === o.value;
          return (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onChange({ ...value, access: o.value })}
              className={cn(
                'flex min-w-0 flex-col items-start gap-1 rounded-xl border text-left transition-[border-color,background-color]',
                compact ? 'px-2 py-1.5' : 'px-3 py-2.5',
                active ? 'border-brand/40 bg-brand-50/70' : 'border-line bg-white hover:border-black/10',
              )}
            >
              <span className={cn('flex items-center gap-1.5 text-[13px] font-semibold', active ? 'text-brand' : 'text-ink')}>
                <o.icon className="size-3.5 shrink-0" /> {o.label}
              </span>
              {!compact && <span className="text-[12px] leading-snug text-muted">{o.text}</span>}
            </button>
          );
        })}
      </div>
      {value.access === 'selected' && (
        <div className="grid gap-1 rounded-xl border border-line p-1.5">
          {colleagues.length === 0 ? (
            <p className="px-1.5 py-1 text-[12px] text-muted">Ingen kolleger endnu. De kommer på listen, når de har logget ind i appen.</p>
          ) : (
            <div className="grid max-h-[180px] gap-0.5 overflow-y-auto">
              {colleagues.map((m) => {
                const on = value.sharedWith.includes(m.id);
                return (
                  <button
                    key={m.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() => onChange({ ...value, sharedWith: on ? value.sharedWith.filter((x) => x !== m.id) : [...value.sharedWith, m.id] })}
                    className="flex min-w-0 items-center gap-2 rounded-lg px-1.5 py-1 text-left text-[13px] hover:bg-line-2"
                  >
                    <Avatar member={m} size={22} />
                    <span className="min-w-0 flex-1 truncate text-ink-2">{m.name}</span>
                    <span className={cn('grid size-4 shrink-0 place-items-center rounded border', on ? 'border-brand bg-brand text-white' : 'border-line')}>{on && <Check className="size-3" strokeWidth={3} />}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** Owner and people for an access choice (no owner = everyone). */
export function toBoardAccess(v: AccessValue, meId: string): { ownerId: string | null; sharedWith: string[] } {
  if (v.access === 'everyone') return { ownerId: null, sharedWith: [] };
  return { ownerId: meId, sharedWith: v.access === 'selected' ? v.sharedWith : [] };
}

export const useNewBoardDialog = create<{ open: boolean; setOpen: (open: boolean) => void }>((set) => ({ open: false, setOpen: (open) => set({ open }) }));

export function NewBoardDialog() {
  const open = useNewBoardDialog((s) => s.open);
  const setOpen = useNewBoardDialog((s) => s.setOpen);
  const createBoard = useBoard((s) => s.createBoard);
  const meId = useBoard((s) => s.meId);
  const openBoard = useUi((s) => s.openBoard);
  const [title, setTitle] = useState('');
  const [access, setAccess] = useState<AccessValue>({ access: 'everyone', sharedWith: [] });
  const close = () => {
    setOpen(false);
    setTitle('');
    setAccess({ access: 'everyone', sharedWith: [] });
  };
  const submit = () => {
    if (!title.trim() || (access.access === 'selected' && !access.sharedWith.length)) return;
    openBoard(createBoard(title, toBoardAccess(access, meId)));
    close();
  };
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => (o ? setOpen(true) : close())}
      title="Ny tavle"
      className="w-[min(520px,calc(100vw-32px))]"
      footer={
        <>
          <Button variant="secondary" onClick={close}>
            Annullér
          </Button>
          <Button variant="gradient" disabled={!title.trim() || (access.access === 'selected' && !access.sharedWith.length)} onClick={submit}>
            Opret tavle
          </Button>
        </>
      }
    >
      <form
        className="grid gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <Field label="Navn" htmlFor="board-title">
          <Input id="board-title" autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Fx SEO-plan" />
        </Field>
        <div>
          <div className="mb-1.5 text-[13px] font-medium text-ink">Hvem kan se tavlen?</div>
          <AccessPicker value={access} onChange={setAccess} />
          {access.access === 'selected' && !access.sharedWith.length && <p className="mt-1.5 text-[12px] text-muted">Vælg mindst én kollega – eller vælg “Kun mig”.</p>}
        </div>
      </form>
    </Dialog>
  );
}

/** "Kun for dig" / "Dig + 2" next to the board's title. */
export function AccessBadge({ board }: { board: Board }) {
  const members = useBoard((s) => s.members);
  const meId = useBoard((s) => s.meId);
  const kind = boardAccess(board);
  if (kind === 'everyone') return null;
  const owner = members.find((m) => m.id === board.ownerId);
  const people = (board.sharedWith ?? []).map((id) => members.find((m) => m.id === id)?.name ?? 'en kollega');
  const mine = board.ownerId === meId;
  const tip =
    kind === 'private'
      ? 'Privat tavle. Ingen andre kan se den.'
      : `Kun ${mine ? 'dig' : (owner?.name ?? 'ejeren')} og ${people.join(', ')} kan se tavlen.`;
  return (
    <Tooltip content={tip}>
      <span className="inline-flex items-center gap-1 text-[12px] text-muted">
        {kind === 'private' ? <Lock className="size-3" /> : <UsersRound className="size-3" />}
        {kind === 'private' ? 'Kun for dig' : `${mine ? 'Dig' : (owner?.name.split(' ')[0] ?? 'Ejer')} + ${people.length}`}
      </span>
    </Tooltip>
  );
}

/** In the board's menu: who can see it (the owner – or anyone, while it's for everyone – can change it). */
export function BoardAccessSection({ board }: { board: Board }) {
  const meId = useBoard((s) => s.meId);
  const members = useBoard((s) => s.members);
  const setBoardAccess = useBoard((s) => s.setBoardAccess);
  const canChange = !board.ownerId || board.ownerId === meId;
  // "Udvalgte" with nobody picked yet stays a draft (it would otherwise mean "Kun mig").
  const [draft, setDraft] = useState<AccessValue | null>(null);
  const value: AccessValue = draft ?? { access: boardAccess(board), sharedWith: board.sharedWith ?? [] };
  return (
    <div>
      <div className="mb-1.5 text-[11.5px] font-semibold text-muted">Hvem kan se tavlen</div>
      {canChange ? (
        <AccessPicker
          compact
          value={value}
          onChange={(v) => {
            if (v.access === 'selected' && !v.sharedWith.length) return setDraft(v);
            setDraft(null);
            const next = toBoardAccess(v, meId);
            setBoardAccess(board.id, next.ownerId, next.sharedWith);
          }}
        />
      ) : (
        <p className="text-[12px] text-muted">Delt med dig af {members.find((m) => m.id === board.ownerId)?.name ?? 'en kollega'}. Kun ejeren kan ændre, hvem der kan se den.</p>
      )}
    </div>
  );
}
