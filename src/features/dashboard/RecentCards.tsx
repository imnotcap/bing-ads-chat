/** Overblik → "Til i dag": a short list of the planning cards to start on (recentCards.ts). */
import { motion } from 'motion/react';
import { useMemo, useState } from 'react';
import { ArrowRight, Sparkles } from '@/components/icons';
import { fadeUp } from '@/components/motion';
import { Button } from '@/components/ui/button';
import { CardDialog } from '@/features/board/CardDialog';
import { LabelPill, PriorityTag } from '@/features/board/parts';
import { startChat } from '@/features/chat/startChat';
import { fmtRelative } from '@/lib/format';
import { cn } from '@/lib/utils';
import { AGENT_BOARD, fmtDue, useBoard } from '@/stores/board';
import { useUi } from '@/stores/ui';
import { RECENT_DAYS, todayCards } from './recentCards';

export function RecentCards() {
  const boards = useBoard((s) => s.boards);
  const cards = useBoard((s) => s.cards);
  const members = useBoard((s) => s.members);
  const meId = useBoard((s) => s.meId);
  const go = useUi((s) => s.go);
  const openBoard = useUi((s) => s.openBoard);
  const [open, setOpen] = useState<string | null>(null);
  const { cards: list, total } = useMemo(() => todayCards({ boards, cards, members }, meId, new Date(), 5), [boards, cards, members, meId]);
  if (!boards.length) return null;

  const seeAll = () => (boards.some((b) => b.id === AGENT_BOARD) ? openBoard(AGENT_BOARD) : go('board'));
  return (
    <motion.section variants={fadeUp} className="card flex flex-col p-5">
      <div className="mb-3 flex items-center gap-2">
        <h2 className="text-[14.5px] font-semibold tracking-[-0.01em] text-ink">Til i dag</h2>
        {total > 0 && <span className="rounded-full bg-line-2 px-2 py-0.5 text-[11.5px] font-medium text-muted">{total}</span>}
        <span className="text-[12.5px] text-muted">Forfaldne kort og nye kort fra de seneste {RECENT_DAYS} dage</span>
        <Button variant="ghost" size="xs" className="ml-auto" onClick={seeAll}>
          Se planlægningen <ArrowRight />
        </Button>
      </div>
      {list.length ? (
        <ul className="grid gap-1.5">
          {list.map(({ card, boardTitle, urgent }) => {
            const board = boards.find((b) => b.id === card.boardId);
            const labels = board?.labels.filter((l) => card.labelIds.includes(l.id)).slice(0, 2) ?? [];
            return (
              <li key={card.id}>
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => setOpen(card.id)}
                  onKeyDown={(e) => e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), setOpen(card.id))}
                  className="group flex min-w-0 items-center gap-3 rounded-xl border border-line px-3 py-2 text-left transition-colors hover:bg-line-2/60 focus-visible:outline-2 focus-visible:outline-brand"
                >
                  {card.priority ? <PriorityTag priority={card.priority} showLabel={false} className="shrink-0" /> : <span className="w-3.5 shrink-0" />}
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13.5px] font-medium text-ink">{card.title}</div>
                    <div className="mt-0.5 flex min-w-0 items-center gap-1.5 text-[12px] text-muted">
                      <span className="truncate">{boardTitle}</span>
                      <span aria-hidden>·</span>
                      <span className="shrink-0">{fmtRelative(card.createdAt)}</span>
                      {card.due && (
                        <span className={cn('shrink-0 font-medium', urgent ? 'text-negative' : 'text-muted')}>
                          · {urgent ? 'Forfalden' : 'Forfalder'} {fmtDue(card.due)}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="hidden shrink-0 items-center gap-1 sm:flex">
                    {labels.map((l) => (
                      <LabelPill key={l.id} label={l} />
                    ))}
                  </div>
                  {card.ask && (
                    <Button
                      variant="secondary"
                      size="xs"
                      className="shrink-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        go('chat');
                        startChat(card.ask!, [], { fresh: true });
                      }}
                    >
                      <Sparkles /> Bed assistenten
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="rounded-xl border border-dashed border-line px-4 py-5 text-center text-[13px] text-muted">
          Intet nyt eller forfaldent. Agenterne lægger nye kort på planlægningen hver hverdag fra kl. 7.
        </p>
      )}
      <CardDialog cardId={open} onClose={() => setOpen(null)} />
    </motion.section>
  );
}
