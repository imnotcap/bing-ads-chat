/**
 * Overblik → "Til i dag": the planning cards worth starting on – due today or overdue first,
 * then the ones put on the boards in the last week (agent cards included), newest first.
 * Only boards the user can see, and only cards still open (not done, archived or in a
 * "Færdig" list).
 */
import { canSeeBoard, dueState, type BoardData, type Card } from '@/board/model';

export const RECENT_DAYS = 7;
const DONE_LIST = /^(færdig|done|udført|afsluttet)/i;

export interface TodayCard {
  card: Card;
  boardTitle: string;
  /** Due today or earlier. */
  urgent: boolean;
}

export function todayCards(data: BoardData, meId: string, now = new Date(), limit = 6): { cards: TodayCard[]; total: number } {
  const since = now.getTime() - RECENT_DAYS * 86_400_000;
  const out: TodayCard[] = [];
  for (const board of data.boards) {
    if (!canSeeBoard(board, meId)) continue;
    for (const list of board.lists) {
      if (DONE_LIST.test(list.title.trim())) continue;
      for (const id of list.cardIds) {
        const card = data.cards[id];
        if (!card || card.done || card.archived) continue;
        const due = dueState(card, now);
        const urgent = due === 'overdue' || (due === 'soon' && card.due! <= isoDay(now));
        if (!urgent && card.createdAt < since) continue;
        out.push({ card, boardTitle: board.title, urgent });
      }
    }
  }
  out.sort((a, b) => Number(b.urgent) - Number(a.urgent) || (a.urgent ? rank(a.card) - rank(b.card) : 0) || b.card.createdAt - a.card.createdAt);
  return { cards: out.slice(0, limit), total: out.length };
}

const RANK = { highest: 0, high: 1, medium: 2, low: 3 } as const;
const rank = (c: Card) => (c.priority ? RANK[c.priority] : 2);

function isoDay(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
