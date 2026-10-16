/**
 * The back of a card (as in Trello): title, list, labels, members, due date,
 * description, checklist and the comment/activity feed, with actions on the right.
 */
import { AnimatePresence, motion } from 'motion/react';
import {
  Archive,
  ArrowRight,
  CalendarCheck,
  CalendarDays,
  CalendarPlus,
  Loader2,
  CheckSquare,
  CircleCheck,
  Copy,
  Flag,
  Hand,
  MessageSquare,
  Palette,
  Plus,
  Sparkles,
  SquareKanban,
  Tag,
  Text,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { Dialog as DialogPrimitive } from 'radix-ui';
import { useEffect, useState } from 'react';
import { EASE } from '@/components/motion';
import { toast } from '@/components/notifications/toast';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from '@/components/ui/overlays';
import { startChat } from '@/features/chat/startChat';
import { cn, errorMessage } from '@/lib/utils';
import { addOutlookEvent, outlookAvailable } from '@/bing/outlook';
import { openExternal } from '@/lib/platform';
import { useChat } from '@/stores/chat';
import { LABEL_COLORS, dueState, fmtDue, useBoard, type Card } from '@/stores/board';
import { useUi } from '@/stores/ui';
import { Avatar, ColorGrid, FadeIn, LabelPicker, LabelPill, MemberPicker, Pop, PriorityPicker, PriorityTag } from './parts';

function timeAgo(ts: number) {
  const s = Math.round((Date.now() - ts) / 1000);
  if (s < 60) return 'lige nu';
  if (s < 3600) return `for ${Math.round(s / 60)} min. siden`;
  if (s < 86_400) return `for ${Math.round(s / 3600)} t. siden`;
  return new Date(ts).toLocaleDateString('da-DK', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function SideButton({ icon: Icon, children, className, ...rest }: React.ComponentProps<'button'> & { icon: typeof Tag }) {
  return (
    <button
      type="button"
      {...rest}
      className={cn('flex h-8 w-full items-center gap-2 rounded-lg bg-line-2 px-2.5 text-left text-[12.5px] font-medium text-ink-2 transition-colors hover:bg-[#ebebf0] hover:text-ink', className)}
    >
      <Icon className="size-3.5 shrink-0 text-muted" />
      {children}
    </button>
  );
}

function Section({ icon: Icon, title, action, children }: { icon: typeof Tag; title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="mt-6">
      <div className="mb-2 flex items-center gap-2.5">
        <Icon className="size-4 text-muted" />
        <h3 className="flex-1 text-[14px] font-semibold text-ink">{title}</h3>
        {action}
      </div>
      <div className="pl-[26px]">{children}</div>
    </section>
  );
}

function Description({ card }: { card: Card }) {
  const updateCard = useBoard((s) => s.updateCard);
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(card.description);
  useEffect(() => setText(card.description), [card.description]);
  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className={cn(
          'w-full whitespace-pre-wrap rounded-xl px-3 py-2.5 text-left text-[13.5px] leading-relaxed transition-colors',
          card.description ? 'text-ink-2 hover:bg-line-2' : 'min-h-16 bg-line-2 text-subtle hover:bg-[#ebebf0]',
        )}
      >
        {card.description || 'Tilføj en mere detaljeret beskrivelse …'}
      </button>
    );
  }
  return (
    <div className="grid gap-2">
      <textarea
        autoFocus
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={5}
        placeholder="Hvad skal der gøres, og hvorfor?"
        className="w-full resize-y rounded-xl border border-brand/40 px-3 py-2.5 text-[13.5px] leading-relaxed outline-none ring-4 ring-brand/10"
      />
      <div className="flex gap-2">
        <Button
          size="sm"
          variant="gradient"
          onClick={() => {
            updateCard(card.id, { description: text.trim() });
            setEditing(false);
          }}
        >
          Gem
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            setText(card.description);
            setEditing(false);
          }}
        >
          Annullér
        </Button>
      </div>
    </div>
  );
}

function Checklist({ card }: { card: Card }) {
  const add = useBoard((s) => s.addCheckItem);
  const update = useBoard((s) => s.updateCheckItem);
  const remove = useBoard((s) => s.removeCheckItem);
  const [adding, setAdding] = useState(false);
  const [text, setText] = useState('');
  const [hideDone, setHideDone] = useState(false);
  const done = card.checklist.filter((i) => i.done).length;
  const pct = card.checklist.length ? Math.round((done / card.checklist.length) * 100) : 0;
  const items = hideDone ? card.checklist.filter((i) => !i.done) : card.checklist;
  return (
    <Section
      icon={CheckSquare}
      title="Tjekliste"
      action={
        done > 0 && (
          <Button size="xs" variant="ghost" onClick={() => setHideDone((v) => !v)}>
            {hideDone ? `Vis færdige (${done})` : 'Skjul færdige'}
          </Button>
        )
      }
    >
      <div className="mb-3 flex items-center gap-2.5">
        <span className="w-9 text-[11.5px] tabular text-muted">{pct} %</span>
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-line-2">
          <motion.div className={cn('h-full rounded-full', pct === 100 ? 'bg-positive' : 'bg-brand')} animate={{ width: `${pct}%` }} transition={{ duration: 0.5, ease: EASE }} />
        </div>
      </div>
      <div className="grid gap-0.5">
        <AnimatePresence initial={false}>
          {items.map((i) => (
            <motion.div
              key={i.id}
              layout
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="group flex items-center gap-2.5 rounded-lg px-1.5 py-1 hover:bg-line-2"
            >
              <input type="checkbox" checked={i.done} onChange={(e) => update(card.id, i.id, { done: e.target.checked })} className="size-4 accent-[var(--color-brand)]" />
              <input
                value={i.text}
                onChange={(e) => update(card.id, i.id, { text: e.target.value })}
                className={cn('min-w-0 flex-1 bg-transparent text-[13.5px] outline-none', i.done ? 'text-muted line-through' : 'text-ink-2')}
              />
              <button type="button" aria-label="Slet punkt" onClick={() => remove(card.id, i.id)} className="grid size-6 place-items-center rounded-md text-subtle opacity-0 hover:text-negative group-hover:opacity-100">
                <X className="size-3.5" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
      {adding ? (
        <div className="mt-2 grid gap-2">
          <input
            autoFocus
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && text.trim()) {
                add(card.id, text);
                setText('');
              }
              if (e.key === 'Escape') setAdding(false);
            }}
            placeholder="Tilføj et punkt"
            className="h-9 rounded-lg border border-brand/40 px-3 text-[13.5px] outline-none ring-4 ring-brand/10"
          />
          <div className="flex gap-2">
            <Button
              size="xs"
              variant="gradient"
              onClick={() => {
                if (text.trim()) add(card.id, text);
                setText('');
              }}
            >
              Tilføj
            </Button>
            <Button size="xs" variant="ghost" onClick={() => setAdding(false)}>
              Luk
            </Button>
          </div>
        </div>
      ) : (
        <Button size="xs" variant="secondary" className="mt-2" onClick={() => setAdding(true)}>
          <Plus /> Tilføj et punkt
        </Button>
      )}
    </Section>
  );
}

function Activity({ card }: { card: Card }) {
  const members = useBoard((s) => s.members);
  const addComment = useBoard((s) => s.addComment);
  const [text, setText] = useState('');
  const [showEvents, setShowEvents] = useState(true);
  const meId = useBoard((s) => s.meId);
  const me = members.find((m) => m.id === meId) ?? { id: meId, name: 'Mig', color: '#6d5cf6' };
  const feed = [...card.activity].reverse().filter((a) => showEvents || a.kind === 'comment');
  const send = () => {
    if (!text.trim()) return;
    addComment(card.id, text);
    setText('');
  };
  return (
    <Section
      icon={MessageSquare}
      title="Kommentarer og aktivitet"
      action={
        <Button size="xs" variant="ghost" onClick={() => setShowEvents((v) => !v)}>
          {showEvents ? 'Skjul detaljer' : 'Vis detaljer'}
        </Button>
      }
    >
      <div className="-ml-[26px] flex gap-2.5">
        <Avatar member={me} size={28} />
        <div className="min-w-0 flex-1">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) send();
            }}
            rows={text ? 3 : 1}
            placeholder="Skriv en kommentar …"
            className="w-full resize-none rounded-xl border border-line px-3 py-2 text-[13.5px] outline-none transition-[border-color,box-shadow] focus:border-brand/50 focus:ring-4 focus:ring-brand/10"
          />
          {text && (
            <Button size="xs" variant="gradient" className="mt-1.5" onClick={send}>
              Gem <span className="text-white/70">Ctrl ↵</span>
            </Button>
          )}
        </div>
      </div>
      <div className="-ml-[26px] mt-4 grid gap-3">
        {feed.map((a) => {
          const m = members.find((x) => x.id === a.memberId) ?? { id: a.memberId, name: 'Tidligere medlem', color: '#a4a4b0' };
          return (
            <FadeIn key={a.id} k={a.id}>
              <div className="flex gap-2.5">
                <Avatar member={m} size={28} />
                <div className="min-w-0 flex-1 pt-0.5 text-[13px]">
                  {a.kind === 'comment' ? (
                    <>
                      <div>
                        <span className="font-semibold text-ink">{m.name}</span> <span className="text-[11.5px] text-subtle">{timeAgo(a.ts)}</span>
                      </div>
                      <div className="mt-1 whitespace-pre-wrap rounded-xl border border-line bg-white px-3 py-2 leading-relaxed text-ink-2 shadow-[0_1px_2px_rgb(18_18_22/0.04)]">{a.text}</div>
                    </>
                  ) : (
                    <div className="text-ink-2">
                      <span className="font-semibold text-ink">{m.name}</span> {a.text}
                      <div className="text-[11.5px] text-subtle">{timeAgo(a.ts)}</div>
                    </div>
                  )}
                </div>
              </div>
            </FadeIn>
          );
        })}
      </div>
    </Section>
  );
}

function OutlookButton({ card }: { card: Card }) {
  const [busy, setBusy] = useState(false);
  if (!outlookAvailable()) return null;
  if (card.outlook) {
    return (
      <SideButton icon={CalendarCheck} onClick={() => card.outlook?.webLink && void openExternal(card.outlook.webLink)} className="bg-teal-50 text-teal hover:bg-teal-50 hover:text-teal [&_svg]:text-teal">
        I Outlook {card.outlook.at.slice(11, 16)}
      </SideButton>
    );
  }
  return (
    <SideButton
      icon={busy ? Loader2 : CalendarPlus}
      className={cn(busy && '[&_svg]:animate-spin')}
      onClick={async () => {
        if (!card.due) return toast('Sæt først en forfaldsdato', { description: 'Påmindelsen lægges kl. 9 på forfaldsdatoen.' });
        setBusy(true);
        try {
          const ev = await addOutlookEvent({ subject: card.title, body: card.description || card.title, date: card.due, time: '09:00', minutes: 30, reminderMinutes: 15 });
          useBoard.getState().updateCard(card.id, { outlook: { eventId: ev.id, webLink: ev.webLink, at: `${card.due}T09:00` } });
          toast.success('Påmindelse lagt i Outlook', { description: `${fmtDue(card.due)} kl. 9.00` });
        } catch (e) {
          toast.error('Kunne ikke lægge den i Outlook', { description: errorMessage(e) });
        } finally {
          setBusy(false);
        }
      }}
    >
      Outlook-påmindelse
    </SideButton>
  );
}

export function CardDialog({ cardId, onClose }: { cardId: string | null; onClose: () => void }) {
  const card = useBoard((s) => (cardId ? s.cards[cardId] : undefined));
  const board = useBoard((s) => s.boards.find((b) => b.id === card?.boardId));
  const members = useBoard((s) => s.members);
  const st = useBoard.getState;
  const [title, setTitle] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  useEffect(() => {
    if (card) setTitle(card.title);
    setConfirmDelete(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cardId]);

  const open = !!card && !!board;
  const list = board?.lists.find((l) => l.id === card?.listId);
  const labels = board && card ? board.labels.filter((l) => card.labelIds.includes(l.id)) : [];
  const cardMembers = card ? members.filter((m) => card.memberIds.includes(m.id)) : [];
  const meId = useBoard((s) => s.meId);
  const claimed = !!card?.memberIds.includes(meId);
  const due = card ? dueState(card) : 'none';

  return (
    <DialogPrimitive.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <AnimatePresence>
        {open && card && board && (
          <DialogPrimitive.Portal forceMount>
            <DialogPrimitive.Overlay asChild forceMount>
              <motion.div className="fixed inset-0 z-50 bg-[#121216]/30 backdrop-blur-[3px]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} />
            </DialogPrimitive.Overlay>
            <DialogPrimitive.Content asChild forceMount aria-describedby={undefined}>
              <motion.div
                className="fixed left-1/2 top-[6vh] z-50 flex max-h-[88vh] w-[min(820px,calc(100vw-32px))] flex-col overflow-hidden rounded-3xl border border-black/[0.05] bg-surface shadow-pop outline-none"
                initial={{ opacity: 0, scale: 0.97, x: '-50%', y: 14 }}
                animate={{ opacity: 1, scale: 1, x: '-50%', y: 0 }}
                exit={{ opacity: 0, scale: 0.98, x: '-50%', y: 8, transition: { duration: 0.15 } }}
                transition={{ duration: 0.3, ease: EASE }}
              >
                {card.cover && <div className="h-20 shrink-0" style={{ background: `linear-gradient(120deg, ${LABEL_COLORS[card.cover].solid}, ${LABEL_COLORS[card.cover].soft})` }} />}
                <DialogPrimitive.Close aria-label="Luk" className="absolute right-4 top-4 z-10 grid size-8 place-items-center rounded-lg bg-white/80 text-muted backdrop-blur transition-colors hover:bg-line-2 hover:text-ink">
                  <X className="size-4" />
                </DialogPrimitive.Close>

                <div className="flex min-h-0 flex-1 gap-6 overflow-y-auto px-7 pb-7 pt-6">
                  {/* Main column */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start gap-2.5">
                      <button
                        type="button"
                        aria-label={card.done ? 'Markér som ikke færdig' : 'Markér som færdig'}
                        onClick={() => st().updateCard(card.id, { done: !card.done })}
                        className="mt-1.5 shrink-0"
                      >
                        <CircleCheck className={cn('size-5 transition-colors', card.done ? 'fill-positive text-white' : 'text-subtle hover:text-positive')} />
                      </button>
                      <DialogPrimitive.Title asChild>
                        <textarea
                          value={title}
                          onChange={(e) => setTitle(e.target.value.replace(/\n/g, ''))}
                          onBlur={() => st().updateCard(card.id, { title: title.trim() || card.title })}
                          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), (e.target as HTMLTextAreaElement).blur())}
                          rows={1}
                          className="field-sizing-content mr-8 min-w-0 flex-1 resize-none rounded-lg px-1.5 py-0.5 text-[20px] font-semibold leading-snug tracking-[-0.01em] text-ink outline-none focus:bg-white focus:ring-2 focus:ring-brand/30"
                        />
                      </DialogPrimitive.Title>
                    </div>
                    <div className="ml-[38px] mt-1 flex items-center gap-1 text-[12.5px] text-muted">
                      i listen
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button type="button" className="rounded-md bg-line-2 px-1.5 py-0.5 font-medium text-ink-2 hover:bg-[#ebebf0]">
                            {list?.title}
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="w-[220px]">
                          <DropdownMenuLabel>Flyt til liste</DropdownMenuLabel>
                          {board.lists.map((l) => (
                            <DropdownMenuItem
                              key={l.id}
                              disabled={l.id === card.listId}
                              onSelect={() => st().moveCard(card.id, l.id, l.cardIds.length)}
                            >
                              <ArrowRight /> {l.title}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>

                    <div className="ml-[38px] mt-5 flex flex-wrap gap-x-6 gap-y-4">
                      {cardMembers.length > 0 && (
                        <div>
                          <div className="mb-1.5 text-[11.5px] font-semibold text-muted">Medlemmer</div>
                          <div className="flex items-center gap-1">
                            {cardMembers.map((m) => (
                              <Avatar key={m.id} member={m} size={30} />
                            ))}
                            <Pop
                              title="Medlemmer"
                              trigger={
                                <button type="button" aria-label="Tilføj medlem" className="grid size-[30px] place-items-center rounded-full bg-line-2 text-muted hover:bg-[#ebebf0] hover:text-ink">
                                  <Plus className="size-4" />
                                </button>
                              }
                            >
                              <MemberPicker selected={card.memberIds} onToggle={(id) => st().toggleMember(card.id, id)} />
                            </Pop>
                          </div>
                        </div>
                      )}
                      {labels.length > 0 && (
                        <div>
                          <div className="mb-1.5 text-[11.5px] font-semibold text-muted">Etiketter</div>
                          <div className="flex flex-wrap items-center gap-1">
                            {labels.map((l) => (
                              <LabelPill key={l.id} label={l} className="h-[30px] px-3 text-[12.5px]" />
                            ))}
                            <Pop
                              title="Etiketter"
                              trigger={
                                <button type="button" aria-label="Tilføj etiket" className="grid size-[30px] place-items-center rounded-md bg-line-2 text-muted hover:bg-[#ebebf0] hover:text-ink">
                                  <Plus className="size-4" />
                                </button>
                              }
                            >
                              <LabelPicker board={board} selected={card.labelIds} onToggle={(id) => st().toggleLabel(card.id, id)} />
                            </Pop>
                          </div>
                        </div>
                      )}
                      {card.priority && (
                        <div>
                          <div className="mb-1.5 text-[11.5px] font-semibold text-muted">Prioritet</div>
                          <Pop
                            title="Prioritet"
                            trigger={
                              <button type="button" className="flex h-[30px] items-center rounded-md bg-line-2 px-2.5 hover:bg-[#ebebf0]">
                                <PriorityTag priority={card.priority} />
                              </button>
                            }
                          >
                            <PriorityPicker value={card.priority} onChange={(p) => st().updateCard(card.id, { priority: p })} />
                          </Pop>
                        </div>
                      )}
                      {card.due && (
                        <div>
                          <div className="mb-1.5 text-[11.5px] font-semibold text-muted">Forfaldsdato</div>
                          <div className="flex h-[30px] items-center gap-2 rounded-md bg-line-2 px-2.5 text-[12.5px] font-medium text-ink-2">
                            <input type="checkbox" checked={card.done} onChange={(e) => st().updateCard(card.id, { done: e.target.checked })} className="size-3.5 accent-[var(--color-positive)]" />
                            {fmtDue(card.due)}
                            {due === 'overdue' && <span className="rounded bg-negative px-1.5 text-[11px] text-white">Forfalden</span>}
                            {due === 'soon' && <span className="rounded bg-warning-bg px-1.5 text-[11px] text-warning">Snart</span>}
                            {due === 'done' && <span className="rounded bg-positive px-1.5 text-[11px] text-white">Færdig</span>}
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="ml-3">
                      <Section icon={Text} title="Beskrivelse">
                        <Description card={card} />
                      </Section>
                      {card.checklist.length > 0 && <Checklist card={card} />}
                      <Activity card={card} />
                    </div>
                  </div>

                  {/* Actions */}
                  <aside className="mt-12 grid w-[176px] shrink-0 content-start gap-1.5">
                    <div className="mb-0.5 text-[11.5px] font-semibold text-muted">Tilføj til kortet</div>
                    <SideButton
                      icon={Hand}
                      onClick={() => st().toggleMember(card.id, meId)}
                      className={cn(claimed && 'bg-brand-50 text-brand hover:bg-brand-100 hover:text-brand [&_svg]:text-brand')}
                    >
                      {claimed ? 'Du har taget den' : 'Tag opgaven'}
                    </SideButton>
                    <Pop title="Medlemmer" trigger={<SideButton icon={Users}>Medlemmer</SideButton>}>
                      <MemberPicker selected={card.memberIds} onToggle={(id) => st().toggleMember(card.id, id)} />
                    </Pop>
                    <Pop title="Etiketter" trigger={<SideButton icon={Tag}>Etiketter</SideButton>}>
                      <LabelPicker board={board} selected={card.labelIds} onToggle={(id) => st().toggleLabel(card.id, id)} />
                    </Pop>
                    <SideButton
                      icon={CheckSquare}
                      onClick={() => {
                        if (!card.checklist.length) st().addCheckItem(card.id, 'Første punkt');
                      }}
                    >
                      Tjekliste
                    </SideButton>
                    <Pop title="Forfaldsdato" trigger={<SideButton icon={CalendarDays}>Forfaldsdato</SideButton>}>
                      <div className="grid gap-2.5">
                        <input
                          type="date"
                          value={card.due ?? ''}
                          onChange={(e) => st().updateCard(card.id, { due: e.target.value || null })}
                          className="h-9 rounded-lg border border-line px-2.5 text-[13px] outline-none focus:border-brand/50 focus:ring-4 focus:ring-brand/10"
                        />
                        <div className="flex flex-wrap gap-1.5">
                          {[
                            ['I dag', 0],
                            ['I morgen', 1],
                            ['Om en uge', 7],
                          ].map(([label, days]) => (
                            <Button
                              key={label}
                              size="xs"
                              variant="secondary"
                              onClick={() => {
                                const d = new Date();
                                d.setDate(d.getDate() + Number(days));
                                st().updateCard(card.id, { due: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` });
                              }}
                            >
                              {label}
                            </Button>
                          ))}
                        </div>
                        {card.due && (
                          <Button size="xs" variant="ghost" onClick={() => st().updateCard(card.id, { due: null })}>
                            Fjern dato
                          </Button>
                        )}
                      </div>
                    </Pop>
                    <Pop title="Prioritet" trigger={<SideButton icon={Flag}>Prioritet</SideButton>}>
                      <PriorityPicker value={card.priority ?? null} onChange={(p) => st().updateCard(card.id, { priority: p })} />
                    </Pop>
                    <Pop title="Cover" trigger={<SideButton icon={Palette}>Cover</SideButton>}>
                      <div className="grid gap-2.5">
                        <ColorGrid value={card.cover} onChange={(c) => st().updateCard(card.id, { cover: c })} />
                        {card.cover && (
                          <Button size="xs" variant="ghost" onClick={() => st().updateCard(card.id, { cover: null })}>
                            Fjern cover
                          </Button>
                        )}
                      </div>
                    </Pop>

                    <OutlookButton card={card} />

                    <div className="mb-0.5 mt-4 text-[11.5px] font-semibold text-muted">Handlinger</div>
                    {card.source && (
                      <SideButton
                        icon={MessageSquare}
                        onClick={() => {
                          const conv = useChat.getState().conversations.find((c) => c.id === card.source!.conversationId);
                          if (!conv) return toast.error('Samtalen findes ikke længere');
                          onClose();
                          useChat.getState().select(conv.id);
                          useUi.getState().go('chat');
                        }}
                      >
                        Gå til samtalen
                      </SideButton>
                    )}
                    <SideButton
                      icon={Sparkles}
                      className="bg-brand-50 text-brand hover:bg-brand-100 hover:text-brand [&_svg]:text-brand"
                      onClick={() => {
                        onClose();
                        useUi.getState().go('chat');
                        startChat(
                          `Hjælp mig med denne opgave fra planlægningstavlen:\n\n**${card.title}**${card.description ? `\n${card.description}` : ''}${
                            card.checklist.length ? `\n\nTjekliste:\n${card.checklist.map((i) => `- [${i.done ? 'x' : ' '}] ${i.text}`).join('\n')}` : ''
                          }`,
                        );
                      }}
                    >
                      Spørg assistenten
                    </SideButton>
                    <SideButton icon={CircleCheck} onClick={() => st().updateCard(card.id, { done: !card.done })}>
                      {card.done ? 'Genåbn' : 'Markér som færdig'}
                    </SideButton>
                    <SideButton
                      icon={Copy}
                      onClick={() => {
                        st().copyCard(card.id);
                        toast.success('Kortet er kopieret');
                      }}
                    >
                      Kopiér
                    </SideButton>
                    <SideButton
                      icon={Archive}
                      onClick={() => {
                        st().archiveCard(card.id);
                        onClose();
                        toast('Kortet er arkiveret', { description: 'Find det under "Arkiv" i tavlens menu.' });
                      }}
                    >
                      Arkivér
                    </SideButton>
                    {confirmDelete ? (
                      <div className="grid gap-1.5 rounded-lg bg-negative-bg p-2">
                        <span className="text-[12px] text-negative">Slettes permanent.</span>
                        <div className="flex gap-1.5">
                          <Button
                            size="xs"
                            variant="destructive"
                            onClick={() => {
                              st().deleteCard(card.id);
                              onClose();
                            }}
                          >
                            Slet
                          </Button>
                          <Button size="xs" variant="ghost" onClick={() => setConfirmDelete(false)}>
                            Fortryd
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <SideButton icon={Trash2} onClick={() => setConfirmDelete(true)} className="hover:bg-negative-bg hover:text-negative [&:hover_svg]:text-negative">
                        Slet
                      </SideButton>
                    )}
                    <div className="mt-4 flex items-center gap-1.5 text-[11.5px] text-subtle">
                      <SquareKanban className="size-3.5" /> {board.title}
                    </div>
                  </aside>
                </div>
              </motion.div>
            </DialogPrimitive.Content>
          </DialogPrimitive.Portal>
        )}
      </AnimatePresence>
    </DialogPrimitive.Root>
  );
}
