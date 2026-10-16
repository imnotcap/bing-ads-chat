import { describe, expect, it } from 'vitest';
import { applyOp, remapMember, type BoardData, type BoardOp, type Card, type OpInput } from '@/board/model';

let n = 0;
const op = (input: OpInput, actor = 'a'): BoardOp => ({ ...input, id: `op${++n}`, actor, ts: 1_700_000_000_000 + n } as BoardOp);

function card(id: string, listId: string): Card {
  return { id, boardId: 'b', listId, title: id, description: '', labelIds: [], memberIds: [], due: null, done: false, checklist: [], activity: [], cover: null, archived: false, createdAt: 1 };
}

function base(): BoardData {
  return {
    boards: [
      {
        id: 'b',
        title: 'Plan',
        accent: 'purple',
        labels: [{ id: 'seo', name: 'SEO', color: 'green' }],
        lists: [
          { id: 'todo', title: 'To do', cardIds: ['c1', 'c2'] },
          { id: 'doing', title: 'I gang', cardIds: [] },
        ],
        createdAt: 1,
      },
    ],
    cards: { c1: card('c1', 'todo'), c2: card('c2', 'todo') },
    members: [
      { id: 'a', name: 'Anna', color: '#000' },
      { id: 'j', name: 'Jonas', color: '#111' },
    ],
  };
}

const run = (d: BoardData, ops: BoardOp[]) => ops.reduce(applyOp, d);

describe('board ops', () => {
  it('moves a card between lists and logs it', () => {
    const d = run(base(), [op({ type: 'moveCard', cardId: 'c1', toListId: 'doing', toIndex: 0 })]);
    expect(d.boards[0]!.lists.map((l) => l.cardIds)).toEqual([['c2'], ['c1']]);
    expect(d.cards.c1!.listId).toBe('doing');
    expect(d.cards.c1!.activity.at(-1)!.text).toBe('flyttede kortet fra To do til I gang');
  });

  it('reorders within a list without a log entry', () => {
    const d = run(base(), [op({ type: 'moveCard', cardId: 'c1', toListId: 'todo', toIndex: 1 })]);
    expect(d.boards[0]!.lists[0]!.cardIds).toEqual(['c2', 'c1']);
    expect(d.cards.c1!.activity).toHaveLength(0);
  });

  it('claiming is idempotent and names the actor', () => {
    const claim = op({ type: 'setMember', cardId: 'c1', memberId: 'j', on: true }, 'j');
    const d = run(base(), [claim, claim]);
    expect(d.cards.c1!.memberIds).toEqual(['j']);
    expect(d.cards.c1!.activity.map((a) => a.text)).toEqual(['tog kortet']);
  });

  it('gives every device the same result for the same ops (optimistic + server order)', () => {
    // Anna and Jonas change the board at the same time; the server orders Jonas first.
    const anna = [op({ type: 'moveCard', cardId: 'c2', toListId: 'doing', toIndex: 0 }, 'a'), op({ type: 'addComment', cardId: 'c2', text: 'Starter nu' }, 'a')];
    const jonas = [op({ type: 'setLabel', cardId: 'c2', labelId: 'seo', on: true }, 'j'), op({ type: 'updateCard', cardId: 'c1', patch: { done: true } }, 'j')];
    const server = run(base(), [...jonas, ...anna]);
    // Anna saw her own ops first, then rebased them on the server's order.
    const annaView = run(run(base(), jonas), anna);
    expect(annaView).toEqual(server);
    expect(server.cards.c2!.labelIds).toEqual(['seo']);
    expect(server.cards.c2!.listId).toBe('doing');
  });

  it('ignores ops on things that are gone', () => {
    const d = run(base(), [op({ type: 'deleteCard', cardId: 'c1' }), op({ type: 'updateCard', cardId: 'c1', patch: { title: 'x' } }), op({ type: 'moveCard', cardId: 'c1', toListId: 'doing', toIndex: 0 })]);
    expect(d.cards.c1).toBeUndefined();
    expect(d.boards[0]!.lists.flatMap((l) => l.cardIds)).toEqual(['c2']);
  });

  it('archives done cards and restores them', () => {
    let d = run(base(), [op({ type: 'updateCard', cardId: 'c2', patch: { done: true } }), op({ type: 'archiveDone', boardId: 'b', listId: 'todo' })]);
    expect(d.boards[0]!.lists[0]!.cardIds).toEqual(['c1']);
    expect(d.cards.c2!.archived).toBe(true);
    d = applyOp(d, op({ type: 'restoreCard', cardId: 'c2' }));
    expect(d.boards[0]!.lists[0]!.cardIds).toEqual(['c1', 'c2']);
  });

  it('moves lists by id', () => {
    const d = run(base(), [op({ type: 'moveList', boardId: 'b', listId: 'doing', toIndex: 0 })]);
    expect(d.boards[0]!.lists.map((l) => l.id)).toEqual(['doing', 'todo']);
  });

  it('remaps the local member to a team member id', () => {
    const d = remapMember(run(base(), [op({ type: 'setMember', cardId: 'c1', memberId: 'a', on: true }, 'a')]), 'a', 'm_x');
    expect(d.members[0]!.id).toBe('m_x');
    expect(d.cards.c1!.memberIds).toEqual(['m_x']);
    expect(d.cards.c1!.activity[0]!.memberId).toBe('m_x');
  });
});
