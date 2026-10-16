/**
 * Planning board (Trello-style): lists of cards that can be dragged between lists
 * and reordered, lists that can be reordered, filters, team and archive.
 */
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  closestCorners,
  pointerWithin,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { SortableContext, horizontalListSortingStrategy, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { motion } from 'motion/react';
import {
  Archive,
  ArrowDownUp,
  CalendarDays,
  CheckSquare,
  CircleCheck,
  Filter,
  Hand,
  MessageSquare,
  MoreHorizontal,
  Plus,
  RotateCcw,
  Search,
  SquareKanban,
  Text,
  Trash2,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { EASE, pageTransition } from '@/components/motion';
import { toast } from '@/components/notifications/toast';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/controls';
import { Dialog, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger, Tooltip } from '@/components/ui/overlays';
import { cn } from '@/lib/utils';
import { LABEL_COLORS, ME, dueState, fmtDue, useBoard, type Board, type BoardList, type Card } from '@/stores/board';
import { useUi } from '@/stores/ui';
import { CardDialog } from './CardDialog';
import { Avatar, ColorGrid, LabelPill, Pop } from './parts';

/* --------------------------------- filters --------------------------------- */

interface Filters {
  text: string;
  mine: boolean;
  members: string[];
  labels: string[];
  due: 'all' | 'overdue' | 'week' | 'none';
}

const NO_FILTERS: Filters = { text: '', mine: false, members: [], labels: [], due: 'all' };

function activeFilterCount(f: Filters) {
  return (f.text ? 1 : 0) + (f.mine ? 1 : 0) + f.members.length + f.labels.length + (f.due !== 'all' ? 1 : 0);
}

function matches(card: Card, f: Filters) {
  if (f.text && !`${card.title} ${card.description}`.toLowerCase().includes(f.text.toLowerCase())) return false;
  if (f.mine && !card.memberIds.includes(ME)) return false;
  if (f.members.length && !f.members.some((m) => card.memberIds.includes(m))) return false;
  if (f.labels.length && !f.labels.some((l) => card.labelIds.includes(l))) return false;
  if (f.due === 'none' && card.due) return false;
  if (f.due === 'overdue' && dueState(card) !== 'overdue') return false;
  if (f.due === 'week') {
    const s = dueState(card);
    if (!card.due || s === 'done') return false;
    const [y, m, d] = card.due.split('-').map(Number) as [number, number, number];
    if (new Date(y, m - 1, d).getTime() - Date.now() > 7 * 86_400_000) return false;
  }
  return true;
}

/* ---------------------------------- card ---------------------------------- */

const DUE_TONE = {
  overdue: 'bg-negative text-white',
  soon: 'bg-warning-bg text-warning',
  done: 'bg-positive text-white',
  later: 'text-muted',
  none: '',
} as const;

function CardView({ card, board, dragging, overlay, onOpen }: { card: Card; board: Board; dragging?: boolean; overlay?: boolean; onOpen?: () => void }) {
  const members = useBoard((s) => s.members);
  const st = useBoard.getState;
  const labels = board.labels.filter((l) => card.labelIds.includes(l.id));
  const cardMembers = members.filter((m) => card.memberIds.includes(m.id));
  const checkDone = card.checklist.filter((i) => i.done).length;
  const comments = card.activity.filter((a) => a.kind === 'comment').length;
  const due = dueState(card);
  const claimed = card.memberIds.includes(ME);

  return (
    <div
      onClick={onOpen}
      className={cn(
        'group/card relative cursor-pointer overflow-hidden rounded-xl border border-black/[0.05] bg-white text-left shadow-[0_1px_2px_rgb(18_18_22/0.06)] transition-[box-shadow,border-color,opacity]',
        'hover:border-brand/30 hover:shadow-[0_6px_18px_-8px_rgb(109_92_246/0.35)]',
        dragging && 'opacity-40',
        overlay && 'rotate-[3deg] cursor-grabbing border-brand/30 shadow-[0_18px_40px_-12px_rgb(18_18_22/0.35)]',
      )}
    >
      {card.cover && <div className="h-7" style={{ background: `linear-gradient(120deg, ${LABEL_COLORS[card.cover].solid}, ${LABEL_COLORS[card.cover].soft})` }} />}
      <div className="px-3 pb-2.5 pt-2.5">
        {labels.length > 0 && (
          <div className="mb-1.5 flex flex-wrap gap-1">
            {labels.map((l) => (
              <LabelPill key={l.id} label={l} className="h-5 text-[11px]" />
            ))}
          </div>
        )}
        <div className="flex items-start gap-1.5">
          <button
            type="button"
            aria-label={card.done ? 'Markér som ikke færdig' : 'Markér som færdig'}
            onClick={(e) => {
              e.stopPropagation();
              st().updateCard(card.id, { done: !card.done });
            }}
            className={cn(
              'mt-[1px] shrink-0 overflow-hidden transition-[width,opacity] duration-200',
              card.done ? 'w-4 opacity-100' : 'w-0 opacity-0 group-hover/card:w-4 group-hover/card:opacity-100',
            )}
          >
            <CircleCheck className={cn('size-4', card.done ? 'fill-positive text-white' : 'text-subtle hover:text-positive')} />
          </button>
          <span className={cn('min-w-0 flex-1 text-[13.5px] leading-snug', card.done ? 'text-muted' : 'text-ink')}>{card.title}</span>
        </div>

        {(card.due || card.description || card.checklist.length > 0 || comments > 0 || cardMembers.length > 0) && (
          <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11.5px] text-muted">
            {card.due && (
              <span className={cn('inline-flex h-5 items-center gap-1 rounded-md px-1.5 font-medium', DUE_TONE[due])}>
                <CalendarDays className="size-3" /> {fmtDue(card.due)}
              </span>
            )}
            {card.description && (
              <Tooltip content="Kortet har en beskrivelse">
                <Text className="size-3.5" />
              </Tooltip>
            )}
            {comments > 0 && (
              <span className="inline-flex items-center gap-1">
                <MessageSquare className="size-3.5" /> {comments}
              </span>
            )}
            {card.checklist.length > 0 && (
              <span className={cn('inline-flex h-5 items-center gap-1 rounded-md px-1.5', checkDone === card.checklist.length && 'bg-positive text-white')}>
                <CheckSquare className="size-3.5" /> {checkDone}/{card.checklist.length}
              </span>
            )}
            {cardMembers.length > 0 && (
              <span className="ml-auto flex -space-x-1.5">
                {cardMembers.slice(0, 4).map((m) => (
                  <Avatar key={m.id} member={m} size={22} ring />
                ))}
              </span>
            )}
          </div>
        )}
      </div>
      {!overlay && (
        <Tooltip content={claimed ? 'Slip opgaven' : 'Tag opgaven'}>
          <button
            type="button"
            aria-label={claimed ? 'Slip opgaven' : 'Tag opgaven'}
            onClick={(e) => {
              e.stopPropagation();
              st().toggleMember(card.id, ME);
            }}
            className={cn(
              'absolute right-1.5 grid size-7 place-items-center rounded-lg bg-white/90 text-muted opacity-0 shadow-sm ring-1 ring-black/5 backdrop-blur transition-opacity hover:text-brand group-hover/card:opacity-100',
              card.cover ? 'top-1' : 'top-1.5',
              claimed && 'text-brand',
            )}
          >
            <Hand className="size-3.5" />
          </button>
        </Tooltip>
      )}
    </div>
  );
}

function SortableCard({ card, board, onOpen }: { card: Card; board: Board; onOpen: (id: string) => void }) {
  const { setNodeRef, attributes, listeners, transform, transition, isDragging } = useSortable({ id: card.id, data: { type: 'card', listId: card.listId } });
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Translate.toString(transform), transition }} {...attributes} {...listeners} className="outline-none">
      <CardView card={card} board={board} dragging={isDragging} onOpen={() => onOpen(card.id)} />
    </div>
  );
}

/* ---------------------------------- lists ---------------------------------- */

function CardComposer({ board, list, onClose }: { board: Board; list: BoardList; onClose: () => void }) {
  const addCard = useBoard((s) => s.addCard);
  const [title, setTitle] = useState('');
  const submit = () => {
    if (!title.trim()) return onClose();
    addCard(board.id, list.id, title);
    setTitle('');
  };
  return (
    <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="grid gap-2">
      <textarea
        autoFocus
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            submit();
          }
          if (e.key === 'Escape') onClose();
        }}
        rows={2}
        placeholder="Skriv en titel til kortet …"
        className="w-full resize-none rounded-xl border border-brand/40 bg-white px-3 py-2 text-[13.5px] shadow-sm outline-none ring-4 ring-brand/10"
      />
      <div className="flex items-center gap-1.5">
        <Button size="xs" variant="gradient" onClick={submit}>
          Tilføj kort
        </Button>
        <Button size="icon-xs" variant="ghost" aria-label="Luk" onClick={onClose}>
          <X />
        </Button>
      </div>
    </motion.div>
  );
}

function ListHeader({ board, list, count, dragProps, onAddCard }: { board: Board; list: BoardList; count: number; dragProps: Record<string, unknown>; onAddCard: () => void }) {
  const st = useBoard.getState;
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(list.title);
  const [confirm, setConfirm] = useState(false);
  return (
    <div className="flex items-center gap-1 px-1.5 pb-2 pt-0.5" {...dragProps}>
      {editing ? (
        <input
          autoFocus
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onPointerDown={(e) => e.stopPropagation()}
          onBlur={() => {
            st().renameList(board.id, list.id, title);
            setEditing(false);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
            if (e.key === 'Escape') setEditing(false);
          }}
          className="h-7 min-w-0 flex-1 rounded-md border border-brand/40 bg-white px-2 text-[13.5px] font-semibold outline-none"
        />
      ) : (
        <button
          type="button"
          onClick={() => {
            setTitle(list.title);
            setEditing(true);
          }}
          className="flex h-7 min-w-0 flex-1 cursor-grab items-center gap-2 rounded-md px-1.5 text-left text-[13.5px] font-semibold text-ink active:cursor-grabbing"
        >
          <span className="truncate">{list.title}</span>
          <span className="rounded-full bg-black/[0.06] px-1.5 text-[11px] font-medium leading-[18px] text-muted tabular">{count}</span>
        </button>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label="Listehandlinger"
            onPointerDown={(e) => e.stopPropagation()}
            className="grid size-7 place-items-center rounded-lg text-muted transition-colors hover:bg-black/[0.06] hover:text-ink data-[state=open]:bg-black/[0.06]"
          >
            <MoreHorizontal className="size-4" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-[230px]">
          <DropdownMenuLabel>{list.title}</DropdownMenuLabel>
          <DropdownMenuItem onSelect={onAddCard}>
            <Plus /> Tilføj kort
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => st().sortList(board.id, list.id, 'due')}>
            <ArrowDownUp /> Sortér efter forfaldsdato
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => st().sortList(board.id, list.id, 'title')}>
            <ArrowDownUp /> Sortér alfabetisk
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => st().sortList(board.id, list.id, 'created')}>
            <ArrowDownUp /> Sortér efter oprettelse
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => st().archiveDone(board.id, list.id)}>
            <Archive /> Arkivér færdige kort
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setConfirm(true)} className="text-negative data-[highlighted]:bg-negative-bg data-[highlighted]:text-negative [&_svg]:!text-negative">
            <Trash2 /> Slet listen
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <Dialog
        open={confirm}
        onOpenChange={setConfirm}
        title={`Slet "${list.title}"?`}
        description={`Listen og dens ${list.cardIds.length} kort slettes permanent.`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirm(false)}>
              Annullér
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                st().deleteList(board.id, list.id);
                setConfirm(false);
              }}
            >
              Slet
            </Button>
          </>
        }
      />
    </div>
  );
}

/** The list as it follows the pointer while being dragged. */
function ListPreview({ board, list, cards, filters }: { board: Board; list: BoardList; cards: Record<string, Card>; filters: Filters }) {
  const visible = list.cardIds.map((id) => cards[id]).filter((c): c is Card => !!c && matches(c, filters));
  return (
    <div className="flex max-h-[70vh] w-[284px] rotate-[2deg] flex-col overflow-hidden rounded-2xl bg-[#f0f0f4] p-2 shadow-[0_18px_40px_-12px_rgb(18_18_22/0.35)]">
      <div className="flex h-7 items-center gap-2 px-3 pb-2 text-[13.5px] font-semibold text-ink">
        {list.title} <span className="rounded-full bg-black/[0.06] px-1.5 text-[11px] font-medium leading-[18px] text-muted">{visible.length}</span>
      </div>
      <div className="mt-2 grid gap-2">
        {visible.map((c) => (
          <CardView key={c.id} card={c} board={board} overlay />
        ))}
      </div>
    </div>
  );
}

function ListColumn({ board, list, cards, filters, onOpen }: { board: Board; list: BoardList; cards: Record<string, Card>; filters: Filters; onOpen: (id: string) => void }) {
  const { setNodeRef, attributes, listeners, transform, transition, isDragging } = useSortable({ id: list.id, data: { type: 'list' } });
  const [composing, setComposing] = useState(false);
  const visible = list.cardIds.map((id) => cards[id]).filter((c): c is Card => !!c && matches(c, filters));
  const filtered = visible.length !== list.cardIds.length;
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn(
        'flex max-h-full w-[284px] shrink-0 flex-col rounded-2xl bg-[#f0f0f4] p-2 transition-opacity',
        isDragging && 'opacity-40',
      )}
    >
      <ListHeader board={board} list={list} count={filtered ? visible.length : list.cardIds.length} dragProps={{ ...attributes, ...listeners }} onAddCard={() => setComposing(true)} />
      <div className="-mx-1 min-h-2 flex-1 overflow-y-auto px-1 pb-1">
        <SortableContext items={visible.map((c) => c.id)} strategy={verticalListSortingStrategy}>
          <div className="grid gap-2">
            {visible.map((c) => (
              <SortableCard key={c.id} card={c} board={board} onOpen={onOpen} />
            ))}
          </div>
        </SortableContext>
        {filtered && visible.length === 0 && <p className="px-2 py-3 text-center text-[12px] text-subtle">Ingen kort matcher filteret.</p>}
        {composing && (
          <div className="mt-2">
            <CardComposer board={board} list={list} onClose={() => setComposing(false)} />
          </div>
        )}
      </div>
      {!composing && (
        <button
          type="button"
          onClick={() => setComposing(true)}
          className="mt-1 flex h-8 items-center gap-2 rounded-lg px-2 text-[13px] font-medium text-muted transition-colors hover:bg-black/[0.05] hover:text-ink"
        >
          <Plus className="size-4" /> Tilføj et kort
        </button>
      )}
    </div>
  );
}

function AddList({ board }: { board: Board }) {
  const addList = useBoard((s) => s.addList);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const submit = () => {
    if (title.trim()) addList(board.id, title);
    setTitle('');
  };
  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-11 w-[284px] shrink-0 items-center gap-2 rounded-2xl border border-dashed border-black/10 bg-white/50 px-3.5 text-[13.5px] font-medium text-muted transition-colors hover:border-brand/40 hover:bg-white hover:text-brand"
      >
        <Plus className="size-4" /> Tilføj en liste
      </button>
    );
  }
  return (
    <div className="w-[284px] shrink-0 rounded-2xl bg-[#f0f0f4] p-2">
      <input
        autoFocus
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') submit();
          if (e.key === 'Escape') setOpen(false);
        }}
        placeholder="Navn på listen"
        className="h-9 w-full rounded-lg border border-brand/40 bg-white px-3 text-[13.5px] outline-none ring-4 ring-brand/10"
      />
      <div className="mt-2 flex items-center gap-1.5">
        <Button size="xs" variant="gradient" onClick={submit}>
          Tilføj liste
        </Button>
        <Button size="icon-xs" variant="ghost" aria-label="Luk" onClick={() => setOpen(false)}>
          <X />
        </Button>
      </div>
    </div>
  );
}

/* ---------------------------------- header ---------------------------------- */

function FilterPop({ board, filters, setFilters }: { board: Board; filters: Filters; setFilters: (f: Filters) => void }) {
  const members = useBoard((s) => s.members);
  const count = activeFilterCount(filters);
  const toggle = <K extends 'members' | 'labels'>(key: K, id: string) =>
    setFilters({ ...filters, [key]: filters[key].includes(id) ? filters[key].filter((x) => x !== id) : [...filters[key], id] });
  return (
    <Pop
      title="Filtrér kort"
      align="end"
      width="w-[300px]"
      trigger={
        <Button size="sm" variant={count ? 'gradient' : 'secondary'}>
          <Filter /> Filter{count ? ` · ${count}` : ''}
        </Button>
      }
    >
      <div className="grid gap-3.5">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-subtle" />
          <input
            autoFocus
            value={filters.text}
            onChange={(e) => setFilters({ ...filters, text: e.target.value })}
            placeholder="Søg i kort"
            className="h-8 w-full rounded-lg border border-line pl-8 pr-2 text-[13px] outline-none focus:border-brand/50 focus:ring-4 focus:ring-brand/10"
          />
        </div>
        <label className="flex items-center justify-between text-[13px] font-medium text-ink-2">
          Kun kort, jeg har taget
          <Switch checked={filters.mine} onCheckedChange={(v) => setFilters({ ...filters, mine: v })} />
        </label>
        <div>
          <div className="mb-1.5 text-[11.5px] font-semibold text-muted">Medlemmer</div>
          <div className="flex flex-wrap gap-1.5">
            {members.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => toggle('members', m.id)}
                className={cn('flex items-center gap-1.5 rounded-full border py-0.5 pl-0.5 pr-2.5 text-[12px]', filters.members.includes(m.id) ? 'border-brand bg-brand-50 text-brand' : 'border-line text-ink-2 hover:bg-line-2')}
              >
                <Avatar member={m} size={20} /> {m.name}
              </button>
            ))}
          </div>
        </div>
        <div>
          <div className="mb-1.5 text-[11.5px] font-semibold text-muted">Etiketter</div>
          <div className="flex flex-wrap gap-1.5">
            {board.labels.map((l) => (
              <button key={l.id} type="button" onClick={() => toggle('labels', l.id)} className={cn('rounded-md transition-[box-shadow,opacity]', filters.labels.includes(l.id) ? 'ring-2 ring-ink/70 ring-offset-1' : filters.labels.length ? 'opacity-50' : '')}>
                <LabelPill label={l} />
              </button>
            ))}
          </div>
        </div>
        <div>
          <div className="mb-1.5 text-[11.5px] font-semibold text-muted">Forfaldsdato</div>
          <div className="flex flex-wrap gap-1.5">
            {(
              [
                ['all', 'Alle'],
                ['overdue', 'Forfaldne'],
                ['week', 'Inden for en uge'],
                ['none', 'Uden dato'],
              ] as const
            ).map(([v, label]) => (
              <button
                key={v}
                type="button"
                onClick={() => setFilters({ ...filters, due: v })}
                className={cn('h-7 rounded-lg px-2.5 text-[12px] font-medium', filters.due === v ? 'bg-ink text-white' : 'bg-line-2 text-ink-2 hover:bg-[#ebebf0]')}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        {count > 0 && (
          <Button size="xs" variant="ghost" onClick={() => setFilters(NO_FILTERS)}>
            <RotateCcw /> Ryd filtre
          </Button>
        )}
      </div>
    </Pop>
  );
}

function TeamPop() {
  const members = useBoard((s) => s.members);
  const { addMember, updateMember, removeMember } = useBoard.getState();
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const add = () => {
    if (!name.trim()) return;
    addMember(name, role);
    setName('');
    setRole('');
  };
  return (
    <Pop
      title="Team"
      align="end"
      width="w-[320px]"
      trigger={
        <button type="button" className="flex items-center rounded-full p-0.5 transition-colors hover:bg-line-2" aria-label="Team">
          <span className="flex -space-x-2">
            {members.slice(0, 5).map((m) => (
              <Avatar key={m.id} member={m} size={28} ring />
            ))}
          </span>
          <span className="ml-1 grid size-7 place-items-center rounded-full bg-line-2 text-muted">
            <UserPlus className="size-3.5" />
          </span>
        </button>
      }
    >
      <div className="grid gap-1">
        {members.map((m) => (
          <div key={m.id} className="group flex items-center gap-2.5 rounded-lg px-1.5 py-1 hover:bg-line-2">
            <Avatar member={m} size={28} />
            <div className="min-w-0 flex-1">
              <input
                value={m.name}
                onChange={(e) => updateMember(m.id, { name: e.target.value })}
                aria-label="Navn"
                className="w-full truncate bg-transparent text-[13px] font-medium text-ink outline-none"
              />
              <input
                value={m.role ?? ''}
                onChange={(e) => updateMember(m.id, { role: e.target.value })}
                placeholder={m.id === ME ? 'Dig – skriv dit navn og din rolle' : 'Rolle, f.eks. SEO'}
                aria-label="Rolle"
                className="w-full truncate bg-transparent text-[11.5px] text-muted outline-none placeholder:text-subtle"
              />
            </div>
            {m.id !== ME && (
              <button type="button" aria-label={`Fjern ${m.name}`} onClick={() => removeMember(m.id)} className="grid size-6 place-items-center rounded-md text-subtle opacity-0 hover:text-negative group-hover:opacity-100">
                <X className="size-3.5" />
              </button>
            )}
          </div>
        ))}
        <div className="mt-2 grid gap-1.5 border-t border-line pt-3">
          <div className="text-[11.5px] font-semibold text-muted">Tilføj en kollega</div>
          <div className="flex gap-1.5">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && add()}
              placeholder="Navn"
              className="h-8 min-w-0 flex-1 rounded-lg border border-line px-2.5 text-[13px] outline-none focus:border-brand/50 focus:ring-4 focus:ring-brand/10"
            />
            <input
              value={role}
              onChange={(e) => setRole(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && add()}
              placeholder="Rolle"
              className="h-8 w-24 rounded-lg border border-line px-2.5 text-[13px] outline-none focus:border-brand/50 focus:ring-4 focus:ring-brand/10"
            />
          </div>
          <Button size="xs" variant="gradient" disabled={!name.trim()} onClick={add}>
            <UserPlus /> Tilføj
          </Button>
        </div>
      </div>
    </Pop>
  );
}

function BoardMenu({ board }: { board: Board }) {
  const cards = useBoard((s) => s.cards);
  const st = useBoard.getState;
  const go = useUi((s) => s.go);
  const openBoard = useUi((s) => s.openBoard);
  const [confirm, setConfirm] = useState(false);
  const archived = Object.values(cards).filter((c) => c.boardId === board.id && c.archived);
  return (
    <>
      <Pop
        title="Tavlens menu"
        align="end"
        width="w-[300px]"
        trigger={
          <Button size="icon-sm" variant="secondary" aria-label="Tavlens menu">
            <MoreHorizontal />
          </Button>
        }
      >
        <div className="grid gap-3.5">
          <div>
            <div className="mb-1.5 text-[11.5px] font-semibold text-muted">Farve</div>
            <ColorGrid value={board.accent} onChange={(c) => st().updateBoard(board.id, { accent: c })} />
          </div>
          <div>
            <div className="mb-1.5 flex items-center gap-1.5 text-[11.5px] font-semibold text-muted">
              <Archive className="size-3.5" /> Arkiv ({archived.length})
            </div>
            {archived.length === 0 ? (
              <p className="text-[12px] text-subtle">Ingen arkiverede kort.</p>
            ) : (
              <div className="grid max-h-[220px] gap-1 overflow-y-auto">
                {archived.map((c) => (
                  <div key={c.id} className="flex items-center gap-1.5 rounded-lg bg-line-2 py-1 pl-2.5 pr-1 text-[12.5px]">
                    <span className="min-w-0 flex-1 truncate text-ink-2">{c.title}</span>
                    <Tooltip content="Gendan">
                      <button type="button" aria-label="Gendan" onClick={() => st().restoreCard(c.id)} className="grid size-6 place-items-center rounded-md text-muted hover:bg-white hover:text-brand">
                        <RotateCcw className="size-3.5" />
                      </button>
                    </Tooltip>
                    <Tooltip content="Slet permanent">
                      <button type="button" aria-label="Slet permanent" onClick={() => st().deleteCard(c.id)} className="grid size-6 place-items-center rounded-md text-muted hover:bg-white hover:text-negative">
                        <Trash2 className="size-3.5" />
                      </button>
                    </Tooltip>
                  </div>
                ))}
              </div>
            )}
          </div>
          <Button size="xs" variant="ghost" className="justify-start text-negative hover:bg-negative-bg hover:text-negative" onClick={() => setConfirm(true)}>
            <Trash2 /> Slet tavlen
          </Button>
        </div>
      </Pop>
      <Dialog
        open={confirm}
        onOpenChange={setConfirm}
        title={`Slet tavlen "${board.title}"?`}
        description="Alle lister og kort på tavlen slettes permanent."
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirm(false)}>
              Annullér
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                st().deleteBoard(board.id);
                setConfirm(false);
                const next = useBoard.getState().boards[0];
                if (next) openBoard(next.id);
                else go('dashboard');
                toast('Tavlen er slettet');
              }}
            >
              Slet
            </Button>
          </>
        }
      />
    </>
  );
}

function BoardTitle({ board }: { board: Board }) {
  const updateBoard = useBoard((s) => s.updateBoard);
  const [title, setTitle] = useState(board.title);
  const [editing, setEditing] = useState(false);
  if (editing) {
    return (
      <input
        autoFocus
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onBlur={() => {
          updateBoard(board.id, { title: title.trim() || board.title });
          setEditing(false);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
          if (e.key === 'Escape') setEditing(false);
        }}
        className="h-9 w-[320px] rounded-lg border border-brand/40 bg-white px-2 text-[22px] font-semibold tracking-[-0.02em] outline-none ring-4 ring-brand/10"
      />
    );
  }
  return (
    <button
      type="button"
      onClick={() => {
        setTitle(board.title);
        setEditing(true);
      }}
      className="truncate rounded-lg px-2 py-0.5 text-left text-[22px] font-semibold tracking-[-0.02em] text-ink transition-colors hover:bg-line-2"
    >
      {board.title}
    </button>
  );
}

/* ----------------------------------- page ----------------------------------- */

function EmptyBoards() {
  const createBoard = useBoard((s) => s.createBoard);
  const openBoard = useUi((s) => s.openBoard);
  return (
    <motion.div {...pageTransition} className="grid flex-1 place-items-center p-8">
      <div className="max-w-sm text-center">
        <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-brand-50 text-brand">
          <SquareKanban className="size-7" />
        </div>
        <h1 className="mt-4 text-[20px] font-semibold text-ink">Planlæg jeres arbejde</h1>
        <p className="mt-1.5 text-[13.5px] leading-relaxed text-muted">Lav en tavle med lister og kort – træk opgaverne fra "To do" til "Færdig", tag dem, sæt datoer og etiketter.</p>
        <Button variant="gradient" className="mt-5" onClick={() => openBoard(createBoard('Marketingplan'))}>
          <Plus /> Opret en tavle
        </Button>
      </div>
    </motion.div>
  );
}

export function BoardPage() {
  const boardId = useUi((s) => s.boardId);
  const boards = useBoard((s) => s.boards);
  const board = boards.find((b) => b.id === boardId) ?? boards[0];
  if (!board) return <EmptyBoards />;
  return <BoardView key={board.id} board={board} />;
}

function BoardView({ board }: { board: Board }) {
  const cards = useBoard((s) => s.cards);
  const st = useBoard.getState;
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const [openCard, setOpenCard] = useState<string | null>(null);
  const [active, setActive] = useState<{ id: string; type: 'card' | 'list' } | null>(null);
  const snapshot = useRef<{ boards: Board[]; cards: Record<string, Card> } | null>(null);
  const fromList = useRef<string | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));

  const collision: CollisionDetection = (args) => {
    if (args.active.data.current?.type === 'list') {
      return closestCenter({ ...args, droppableContainers: args.droppableContainers.filter((c) => c.data.current?.type === 'list') });
    }
    const within = pointerWithin(args);
    // Prefer a card under the pointer; else the list under the pointer.
    const card = within.find((c) => args.droppableContainers.find((d) => d.id === c.id)?.data.current?.type === 'card');
    if (card) return [card];
    if (within.length) {
      const listId = within[0]!.id;
      const listCards = args.droppableContainers.filter((d) => d.data.current?.type === 'card' && d.data.current.listId === listId);
      if (listCards.length) return closestCorners({ ...args, droppableContainers: listCards });
      return within;
    }
    return closestCorners(args);
  };

  const listOf = (id: string) => board.lists.find((l) => l.id === id) ?? board.lists.find((l) => l.cardIds.includes(id));

  const onDragStart = (e: DragStartEvent) => {
    const type = e.active.data.current?.type as 'card' | 'list';
    setActive({ id: String(e.active.id), type });
    const s = useBoard.getState();
    snapshot.current = { boards: s.boards, cards: s.cards };
    fromList.current = type === 'card' ? (s.cards[String(e.active.id)]?.listId ?? null) : null;
  };

  const onDragOver = (e: DragOverEvent) => {
    const { active: a, over } = e;
    if (!over || a.data.current?.type !== 'card') return;
    const card = useBoard.getState().cards[String(a.id)];
    const target = listOf(String(over.id));
    if (!card || !target || target.id === card.listId) return;
    let index = target.cardIds.length;
    if (over.data.current?.type === 'card') {
      const overIndex = target.cardIds.indexOf(String(over.id));
      const below = a.rect.current.translated && a.rect.current.translated.top > over.rect.top + over.rect.height / 2;
      index = overIndex + (below ? 1 : 0);
    }
    st().moveCard(card.id, target.id, index);
  };

  const onDragEnd = (e: DragEndEvent) => {
    const { active: a, over } = e;
    setActive(null);
    if (!over) return;
    if (a.data.current?.type === 'list') {
      const from = board.lists.findIndex((l) => l.id === a.id);
      const to = board.lists.findIndex((l) => l.id === listOf(String(over.id))?.id);
      if (from >= 0 && to >= 0 && from !== to) st().moveList(board.id, from, to);
      return;
    }
    const cardId = String(a.id);
    const card = useBoard.getState().cards[cardId];
    const list = card && board.lists.find((l) => l.id === card.listId);
    if (card && list && over.data.current?.type === 'card' && over.id !== a.id) {
      const to = list.cardIds.indexOf(String(over.id));
      if (to >= 0) st().moveCard(cardId, list.id, to);
    }
    if (fromList.current) st().logMove(cardId, fromList.current);
  };

  const onDragCancel = () => {
    setActive(null);
    if (snapshot.current) useBoard.setState(snapshot.current);
  };

  const stats = useMemo(() => {
    const all = board.lists.flatMap((l) => l.cardIds.map((id) => cards[id])).filter((c): c is Card => !!c);
    return {
      total: all.length,
      overdue: all.filter((c) => dueState(c) === 'overdue').length,
      mine: all.filter((c) => c.memberIds.includes(ME) && !c.done).length,
      done: all.filter((c) => c.done).length,
    };
  }, [board, cards]);

  const activeCard = active?.type === 'card' ? cards[active.id] : undefined;
  const activeList = active?.type === 'list' ? board.lists.find((l) => l.id === active.id) : undefined;
  const accent = LABEL_COLORS[board.accent];

  return (
    <motion.div {...pageTransition} className="relative flex min-w-0 flex-1 flex-col overflow-hidden">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-56" style={{ background: `linear-gradient(180deg, ${accent.soft} 0%, transparent 100%)` }} />
      <header className="relative flex flex-wrap items-center gap-3 px-6 pb-4 pt-5">
        <span className="size-3.5 shrink-0 rounded-[5px]" style={{ background: accent.solid }} />
        <BoardTitle board={board} />
        <div className="flex flex-wrap items-center gap-1.5 text-[12px]">
          <span className="rounded-full bg-white/80 px-2.5 py-1 text-muted ring-1 ring-black/[0.05]">{stats.total} kort</span>
          {stats.mine > 0 && (
            <button
              type="button"
              onClick={() => setFilters({ ...filters, mine: !filters.mine })}
              className={cn('rounded-full px-2.5 py-1 font-medium ring-1 transition-colors', filters.mine ? 'bg-brand text-white ring-brand' : 'bg-brand-50 text-brand ring-brand/15 hover:bg-brand-100')}
            >
              {stats.mine} til dig
            </button>
          )}
          {stats.overdue > 0 && (
            <button
              type="button"
              onClick={() => setFilters({ ...filters, due: filters.due === 'overdue' ? 'all' : 'overdue' })}
              className={cn('rounded-full px-2.5 py-1 font-medium ring-1 transition-colors', filters.due === 'overdue' ? 'bg-negative text-white ring-negative' : 'bg-negative-bg text-negative ring-negative/15')}
            >
              {stats.overdue} forfaldne
            </button>
          )}
          {stats.done > 0 && <span className="rounded-full bg-positive-bg px-2.5 py-1 font-medium text-positive ring-1 ring-positive/15">{stats.done} færdige</span>}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <TeamPop />
          <span className="mx-1 h-5 w-px bg-line" />
          <Button size="sm" variant={filters.mine ? 'gradient' : 'secondary'} onClick={() => setFilters({ ...filters, mine: !filters.mine })}>
            <Users /> Mine kort
          </Button>
          <FilterPop board={board} filters={filters} setFilters={setFilters} />
          <BoardMenu board={board} />
        </div>
      </header>

      <div className="relative min-h-0 flex-1 overflow-x-auto overflow-y-hidden px-6 pb-5">
        <DndContext sensors={sensors} collisionDetection={collision} onDragStart={onDragStart} onDragOver={onDragOver} onDragEnd={onDragEnd} onDragCancel={onDragCancel}>
          <SortableContext items={board.lists.map((l) => l.id)} strategy={horizontalListSortingStrategy}>
            <motion.div className="flex h-full items-start gap-3" initial="hidden" animate="show" variants={{ hidden: {}, show: { transition: { staggerChildren: 0.05 } } }}>
              {board.lists.map((l) => (
                <motion.div key={l.id} className="flex max-h-full" variants={{ hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: EASE } } }}>
                  <ListColumn board={board} list={l} cards={cards} filters={filters} onOpen={setOpenCard} />
                </motion.div>
              ))}
              <AddList board={board} />
            </motion.div>
          </SortableContext>
          <DragOverlay dropAnimation={{ duration: 220, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' }}>
            {activeCard ? (
              <div className="w-[268px]">
                <CardView card={activeCard} board={board} overlay />
              </div>
            ) : activeList ? (
              <ListPreview board={board} list={activeList} cards={cards} filters={filters} />
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>

      <CardDialog cardId={openCard} onClose={() => setOpenCard(null)} />
    </motion.div>
  );
}
