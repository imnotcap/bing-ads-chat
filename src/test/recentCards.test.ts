import { describe, expect, it } from 'vitest';
import type { Board, BoardData, Card } from '@/board/model';
import { todayCards } from '@/features/dashboard/recentCards';

const NOW = new Date(2026, 10, 23, 9, 0);
const DAY = 86_400_000;

function card(id: string, extra: Partial<Card> = {}): Card {
  return { id, boardId: 'b1', listId: 'todo', title: id, description: '', labelIds: [], memberIds: [], due: null, done: false, checklist: [], activity: [], cover: null, archived: false, createdAt: NOW.getTime() - DAY, ...extra };
}

function data(cards: Card[], board: Partial<Board> = {}): BoardData {
  const b: Board = {
    id: 'b1',
    title: 'Agenter',
    accent: 'purple',
    labels: [],
    createdAt: 0,
    lists: [
      { id: 'todo', title: 'Nyt', cardIds: cards.filter((c) => c.listId === 'todo').map((c) => c.id) },
      { id: 'done', title: 'Færdig', cardIds: cards.filter((c) => c.listId === 'done').map((c) => c.id) },
    ],
    ...board,
  } as Board;
  return { boards: [b], cards: Object.fromEntries(cards.map((c) => [c.id, c])), members: [] };
}

describe('Overblik → Til i dag', () => {
  it('shows due cards first, then the newest from the last week', () => {
    const d = data([
      card('old', { createdAt: NOW.getTime() - 20 * DAY }),
      card('newest', { createdAt: NOW.getTime() - 60_000 }),
      card('yesterday'),
      card('overdue-low', { createdAt: NOW.getTime() - 30 * DAY, due: '2026-11-20', priority: 'low' }),
      card('due-today-high', { createdAt: NOW.getTime() - 30 * DAY, due: '2026-11-23', priority: 'high' }),
      card('due-later', { createdAt: NOW.getTime() - 30 * DAY, due: '2026-12-01' }),
    ]);
    const { cards, total } = todayCards(d, 'me', NOW);
    expect(cards.map((c) => c.card.id)).toEqual(['due-today-high', 'overdue-low', 'newest', 'yesterday']);
    expect(cards.filter((c) => c.urgent).map((c) => c.card.id)).toEqual(['due-today-high', 'overdue-low']);
    expect(total).toBe(4);
  });

  it('leaves out done, archived and finished cards, and boards the user cannot see', () => {
    const d = data([card('done', { done: true }), card('archived', { archived: true }), card('in-done-list', { listId: 'done' }), card('open')]);
    expect(todayCards(d, 'me', NOW).cards.map((c) => c.card.id)).toEqual(['open']);
    const hidden = data([card('secret')], { ownerId: 'someone-else', sharedWith: [] });
    expect(todayCards(hidden, 'me', NOW).total).toBe(0);
  });

  it('shows at most the limit, and counts the rest', () => {
    const d = data(Array.from({ length: 9 }, (_, i) => card(`c${i}`, { createdAt: NOW.getTime() - i * 60_000 })));
    const r = todayCards(d, 'me', NOW, 6);
    expect(r.cards).toHaveLength(6);
    expect(r.total).toBe(9);
  });
});
