import { describe, expect, it } from 'vitest';
import { bringAlong, isUntouchedExample } from '@/board/sync';
import { LOCAL_ME, remapMember, type BoardData, type Card } from '@/stores/board';

function card(id: string, boardId: string, listId: string, actor = LOCAL_ME, extra: Partial<Card> = {}): Card {
  return {
    id,
    boardId,
    listId,
    title: id,
    description: '',
    labelIds: [],
    memberIds: [],
    due: null,
    done: false,
    checklist: [],
    activity: [{ id: `${id}-a`, ts: 1, memberId: actor, kind: 'event', text: 'oprettede kortet' }],
    cover: null,
    archived: false,
    createdAt: 1,
    ...extra,
  };
}

const board = (id: string, title: string, cardIds: string[], ownerId?: string) => ({
  id,
  title,
  ownerId,
  accent: 'purple' as const,
  labels: [],
  lists: [{ id: `${id}-l`, title: 'To do', cardIds }],
  createdAt: 1,
});

/** A PC with the untouched example board, a personal board and a board of its own. */
function local(): BoardData {
  return {
    boards: [board('ex', 'Marketingplan', ['e1', 'e2']), board('mine', 'Min planlægning', ['p1'], LOCAL_ME), board('seo', 'SEO-plan', ['s1'])],
    cards: {
      e1: card('e1', 'ex', 'ex-l'),
      e2: card('e2', 'ex', 'ex-l'),
      p1: card('p1', 'mine', 'mine-l', LOCAL_ME, { memberIds: [LOCAL_ME] }),
      s1: card('s1', 'seo', 'seo-l'),
    },
    members: [{ id: LOCAL_ME, name: 'Mig', color: '#000' }],
  };
}

const shared: BoardData = { boards: [board('team', 'Marketingplan', ['t1'])], cards: { t1: card('t1', 'team', 'team-l', 'u_1') }, members: [{ id: 'u_1', name: 'Casper', color: '#111' }] };

describe('joining the workspace', () => {
  it('recognises the untouched example board, but not a changed one', () => {
    const d = local();
    expect(isUntouchedExample(d, 'ex')).toBe(true);
    expect(isUntouchedExample(d, 'mine')).toBe(false);
    const moved = { ...d, cards: { ...d.cards, e1: { ...d.cards.e1!, activity: [...d.cards.e1!.activity, { id: 'x', ts: 2, memberId: LOCAL_ME, kind: 'event' as const, text: 'flyttede kortet' }] } } };
    expect(isUntouchedExample(moved, 'ex')).toBe(false);
  });

  it('brings own and personal boards along, leaves the example board behind', () => {
    const d = local();
    const skip = new Set(d.boards.filter((b) => isUntouchedExample(d, b.id)).map((b) => b.id));
    const ops = bringAlong(remapMember(d, LOCAL_ME, 'u_2'), shared, skip);
    const boards = ops.flatMap((o) => (o.type === 'createBoard' ? [o.board] : []));
    expect(boards.map((b) => b.id)).toEqual(['mine', 'seo']);
    expect(boards.find((b) => b.id === 'mine')?.ownerId).toBe('u_2');
    // Lists start empty; the cards are added one by one.
    expect(boards.every((b) => b.lists.every((l) => l.cardIds.length === 0))).toBe(true);
    expect(ops.flatMap((o) => (o.type === 'addCard' ? [o.card.id] : []))).toEqual(['p1', 's1']);
    expect(ops.filter((o) => o.type === 'addMember')).toHaveLength(1);
  });

  it('skips boards and cards the workspace already has', () => {
    const d = local();
    const already: BoardData = { ...shared, boards: [...shared.boards, board('seo', 'SEO-plan', ['s1'])], cards: { ...shared.cards, s1: card('s1', 'seo', 'seo-l') } };
    const ops = bringAlong(d, already, new Set(['ex']));
    expect(ops.flatMap((o) => (o.type === 'createBoard' ? [o.board.id] : []))).toEqual(['mine']);
  });
});
