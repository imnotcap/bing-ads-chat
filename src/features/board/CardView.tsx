/**
 * The front of a card in two styles (switch in the board header):
 * - simple: the title and a row of icons
 * - detailed: description, labels, date and priority, the checklist and the people
 */
import { AnimatePresence, motion } from 'motion/react';
import { Archive, CalendarDays, Check, CheckSquare, Circle, CircleCheck, CircleDashed, Copy, Hand, MessageSquare, MoreVertical, PanelTop, Text } from 'lucide-react';
import { EASE } from '@/components/motion';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger, Tooltip } from '@/components/ui/overlays';
import { cn } from '@/lib/utils';
import { LABEL_COLORS, dueState, fmtDue, useBoard, type Board, type Card } from '@/stores/board';
import { Avatar, LabelPill, PriorityTag } from './parts';

export type CardStyle = 'simple' | 'detailed';

const DUE_TEXT = {
  overdue: 'text-negative',
  soon: 'text-warning',
  done: 'text-positive',
  later: 'text-muted',
  none: 'text-muted',
} as const;

const stop = (e: React.SyntheticEvent) => e.stopPropagation();

function CardMenu({ card, onOpen }: { card: Card; onOpen?: () => void }) {
  const st = useBoard.getState;
  const meId = useBoard((s) => s.meId);
  const claimed = card.memberIds.includes(meId);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Korthandlinger"
          onPointerDown={stop}
          onClick={stop}
          className="-mr-1.5 -mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg text-subtle transition-colors hover:bg-line-2 hover:text-ink data-[state=open]:bg-line-2 data-[state=open]:text-ink"
        >
          <MoreVertical className="size-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[210px]" onClick={stop}>
        <DropdownMenuItem onSelect={onOpen}>
          <PanelTop /> Åbn kortet
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => st().toggleMember(card.id, meId)}>
          <Hand /> {claimed ? 'Slip opgaven' : 'Tag opgaven'}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => st().updateCard(card.id, { done: !card.done })}>
          <CircleCheck /> {card.done ? 'Genåbn' : 'Markér som færdig'}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => st().copyCard(card.id)}>
          <Copy /> Kopiér
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => st().archiveCard(card.id)}>
          <Archive /> Arkivér
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function DoneToggle({ card, alwaysVisible }: { card: Card; alwaysVisible?: boolean }) {
  return (
    <button
      type="button"
      aria-label={card.done ? 'Markér som ikke færdig' : 'Markér som færdig'}
      onPointerDown={stop}
      onClick={(e) => {
        e.stopPropagation();
        useBoard.getState().updateCard(card.id, { done: !card.done });
      }}
      className={cn('mt-px shrink-0 transition-colors', !alwaysVisible && !card.done && 'w-0 overflow-hidden opacity-0 group-hover/card:w-[18px] group-hover/card:opacity-100')}
    >
      {card.done ? (
        <CircleCheck className="size-[18px] fill-positive text-white" />
      ) : alwaysVisible ? (
        <CircleDashed className="size-[18px] text-subtle hover:text-positive" />
      ) : (
        <Circle className="size-[18px] text-subtle hover:text-positive" />
      )}
    </button>
  );
}

function People({ card, size = 24 }: { card: Card; size?: number }) {
  const members = useBoard((s) => s.members);
  const people = members.filter((m) => card.memberIds.includes(m.id));
  if (!people.length) return null;
  return (
    <span className="flex -space-x-1.5">
      {people.slice(0, 4).map((m) => (
        <Avatar key={m.id} member={m} size={size} ring />
      ))}
      {people.length > 4 && (
        <span className="grid place-items-center rounded-full bg-line-2 text-[10px] font-semibold text-muted ring-2 ring-white" style={{ width: size, height: size }}>
          +{people.length - 4}
        </span>
      )}
    </span>
  );
}

function ClaimButton({ card }: { card: Card }) {
  const meId = useBoard((s) => s.meId);
  return (
    <button
      type="button"
      onPointerDown={stop}
      onClick={(e) => {
        e.stopPropagation();
        useBoard.getState().toggleMember(card.id, meId);
      }}
      className="inline-flex h-6 items-center gap-1 rounded-full border border-dashed border-black/15 px-2 text-[11.5px] font-medium text-subtle opacity-0 transition-[opacity,color,border-color] hover:border-brand/40 hover:text-brand group-hover/card:opacity-100"
    >
      <Hand className="size-3" /> Tag den
    </button>
  );
}

function SimpleCard({ card }: { card: Card }) {
  const checkDone = card.checklist.filter((i) => i.done).length;
  const comments = card.activity.filter((a) => a.kind === 'comment').length;
  const due = dueState(card);
  const hasMeta = card.priority || card.due || card.description || card.checklist.length > 0 || comments > 0 || card.memberIds.length > 0;
  return (
    <div className="px-3 py-2.5">
      <div className="flex items-start gap-1.5">
        <DoneToggle card={card} />
        <span className={cn('min-w-0 flex-1 text-[13.5px] font-medium leading-snug', card.done ? 'text-muted line-through decoration-black/20' : 'text-ink')}>{card.title}</span>
      </div>
      {hasMeta && (
        <div className="mt-2 flex items-center gap-2.5 text-[12px] text-muted">
          {card.priority && <PriorityTag priority={card.priority} showLabel={false} />}
          {card.due && (
            <span className={cn('inline-flex items-center gap-1 font-medium', DUE_TEXT[due])}>
              <CalendarDays className="size-3.5" /> {fmtDue(card.due)}
            </span>
          )}
          {card.description && (
            <Tooltip content="Har en beskrivelse">
              <Text className="size-3.5" />
            </Tooltip>
          )}
          {card.checklist.length > 0 && (
            <span className={cn('inline-flex items-center gap-1 tabular', checkDone === card.checklist.length && 'text-positive')}>
              <CheckSquare className="size-3.5" /> {checkDone}/{card.checklist.length}
            </span>
          )}
          {comments > 0 && (
            <span className="inline-flex items-center gap-1 tabular">
              <MessageSquare className="size-3.5" /> {comments}
            </span>
          )}
          <span className="ml-auto">
            <People card={card} size={22} />
          </span>
        </div>
      )}
    </div>
  );
}

function DetailedCard({ card, board, onOpen }: { card: Card; board: Board; onOpen?: () => void }) {
  const labels = board.labels.filter((l) => card.labelIds.includes(l.id));
  const checkDone = card.checklist.filter((i) => i.done).length;
  const comments = card.activity.filter((a) => a.kind === 'comment').length;
  const due = dueState(card);
  const shown = card.checklist.slice(0, 4);
  return (
    <div className="p-3.5">
      <div className="flex items-start gap-2">
        <DoneToggle card={card} alwaysVisible />
        <span className={cn('min-w-0 flex-1 text-[14px] font-semibold leading-snug tracking-[-0.005em]', card.done ? 'text-muted' : 'text-ink')}>{card.title}</span>
        <CardMenu card={card} onOpen={onOpen} />
      </div>

      {card.description && <p className="mt-1.5 line-clamp-2 text-[12.5px] leading-relaxed text-muted">{card.description}</p>}

      {labels.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {labels.map((l) => (
            <LabelPill key={l.id} label={l} />
          ))}
        </div>
      )}

      {(card.due || card.priority) && (
        <div className="mt-3 flex items-center justify-between text-[12px]">
          {card.due ? (
            <span className={cn('inline-flex items-center gap-1.5 font-medium', DUE_TEXT[due])}>
              <CalendarDays className="size-3.5" /> {fmtDue(card.due)}
              {due === 'overdue' && <span className="font-normal">· forfalden</span>}
            </span>
          ) : (
            <span />
          )}
          {card.priority && <PriorityTag priority={card.priority} />}
        </div>
      )}

      {card.checklist.length > 0 && (
        <div className="mt-3">
          <div className="mb-1.5 flex items-center justify-between text-[12px]">
            <span className="font-semibold text-ink-2">Opgaver</span>
            <span className={cn('tabular', checkDone === card.checklist.length ? 'text-positive' : 'text-subtle')}>
              {checkDone}/{card.checklist.length}
            </span>
          </div>
          <ul className="grid gap-1">
            {shown.map((i) => (
              <li key={i.id}>
                <button
                  type="button"
                  onPointerDown={stop}
                  onClick={(e) => {
                    e.stopPropagation();
                    useBoard.getState().updateCheckItem(card.id, i.id, { done: !i.done });
                  }}
                  className="group/item flex w-full items-center gap-2 rounded-md text-left text-[12.5px]"
                >
                  {i.done ? (
                    <Check className="size-3.5 shrink-0 text-positive" strokeWidth={2.6} />
                  ) : (
                    <Circle className="size-3.5 shrink-0 text-subtle group-hover/item:text-positive" />
                  )}
                  <span className={cn('min-w-0 flex-1 truncate', i.done ? 'text-subtle line-through decoration-black/20' : 'text-ink-2')}>{i.text}</span>
                </button>
              </li>
            ))}
          </ul>
          {card.checklist.length > shown.length && <div className="mt-1 pl-[22px] text-[12px] text-subtle">+{card.checklist.length - shown.length} mere</div>}
        </div>
      )}

      {(card.memberIds.length > 0 || comments > 0) && (
        <div className="-mx-3.5 mt-3.5 flex items-center gap-2 border-t border-black/[0.05] px-3.5 pt-3">
          {card.memberIds.length ? <People card={card} /> : <ClaimButton card={card} />}
          {comments > 0 && (
            <span className="ml-auto inline-flex items-center gap-1 text-[12px] text-muted tabular">
              <MessageSquare className="size-3.5" /> {comments}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

export function CardView({
  card,
  board,
  variant,
  dragging,
  overlay,
  onOpen,
}: {
  card: Card;
  board: Board;
  variant: CardStyle;
  dragging?: boolean;
  overlay?: boolean;
  onOpen?: () => void;
}) {
  return (
    <div className="relative">
      <div
        onClick={onOpen}
        className={cn(
          'group/card relative cursor-pointer overflow-hidden border border-black/[0.06] bg-white text-left shadow-[0_1px_2px_rgb(18_18_22/0.05)] transition-[box-shadow,border-color,opacity,transform] duration-200',
          variant === 'detailed' ? 'rounded-2xl' : 'rounded-xl',
          'hover:border-black/[0.1] hover:shadow-[0_8px_24px_-12px_rgb(18_18_22/0.22)]',
          dragging && 'opacity-0',
          overlay && 'rotate-[2.5deg] cursor-grabbing shadow-[0_22px_48px_-16px_rgb(18_18_22/0.4)]',
        )}
      >
        {card.cover && <div className={variant === 'detailed' ? 'h-10' : 'h-6'} style={{ background: `linear-gradient(120deg, ${LABEL_COLORS[card.cover].solid}, ${LABEL_COLORS[card.cover].soft})` }} />}
        {variant === 'detailed' ? <DetailedCard card={card} board={board} onOpen={onOpen} /> : <SimpleCard card={card} />}
      </div>
      <AnimatePresence>
        {dragging && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15, ease: EASE }}
            className={cn(
              'absolute inset-0 grid place-items-center border-2 border-dashed border-black/[0.12] bg-black/[0.02] text-[12.5px] text-subtle',
              variant === 'detailed' ? 'rounded-2xl' : 'rounded-xl',
            )}
          >
            Slip her …
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
