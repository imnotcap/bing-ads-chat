import { describe, expect, it } from 'vitest';
import { applyOp, boardAccess, dataFor, mayApply, visibleBoards, type Board, type BoardData, type BoardOp, type Card, type OpInput } from '@/board/model';

let n = 0;
const op = (input: OpInput, actor: string): BoardOp => ({ ...input, id: `op${++n}`, actor, ts: 1 } as BoardOp);

const board = (id: string, extra: Partial<Board> = {}): Board => ({ id, title: id, accent: 'purple', labels: [], lists: [{ id: `${id}-l`, title: 'To do', cardIds: [`${id}-c`] }], createdAt: 1, ...extra });
const card = (boardId: string): Card => ({
  id: `${boardId}-c`, boardId, listId: `${boardId}-l`, title: 'x', description: '', labelIds: [], memberIds: [], due: null, done: false, checklist: [], activity: [], cover: null, archived: false, createdAt: 1,
});

const data: BoardData = {
  boards: [board('alle'), board('anna', { ownerId: 'u_anna' }), board('udvalgt', { ownerId: 'u_anna', sharedWith: ['u_bo'] })],
  cards: { 'alle-c': card('alle'), 'anna-c': card('anna'), 'udvalgt-c': card('udvalgt') },
  members: [],
};

describe('who can see a board', () => {
  it('knows the three kinds', () => {
    expect(data.boards.map(boardAccess)).toEqual(['everyone', 'private', 'selected']);
  });

  it('sends each person only their boards and cards', () => {
    expect(dataFor(data, 'u_anna').boards.map((b) => b.id)).toEqual(['alle', 'anna', 'udvalgt']);
    expect(dataFor(data, 'u_bo').boards.map((b) => b.id)).toEqual(['alle', 'udvalgt']);
    const carl = dataFor(data, 'u_carl');
    expect(carl.boards.map((b) => b.id)).toEqual(['alle']);
    expect(Object.keys(carl.cards)).toEqual(['alle-c']);
    expect(visibleBoards(data.boards, 'u_anna')[0]!.id).toBe('anna');
  });

  it('lets only people with access change a board, and only the owner change who has access', () => {
    expect(mayApply(op({ type: 'updateCard', cardId: 'anna-c', patch: { title: 'hej' } }, 'u_carl'), data, 'u_carl')).toBe(false);
    expect(mayApply(op({ type: 'updateCard', cardId: 'udvalgt-c', patch: { title: 'hej' } }, 'u_bo'), data, 'u_bo')).toBe(true);
    expect(mayApply(op({ type: 'renameList', boardId: 'anna', listId: 'anna-l', title: 'x' }, 'u_bo'), data, 'u_bo')).toBe(false);
    expect(mayApply(op({ type: 'setBoardAccess', boardId: 'udvalgt', ownerId: 'u_bo', sharedWith: [] }, 'u_bo'), data, 'u_bo')).toBe(false);
    expect(mayApply(op({ type: 'setBoardAccess', boardId: 'udvalgt', ownerId: 'u_anna', sharedWith: ['u_bo', 'u_carl'] }, 'u_anna'), data, 'u_anna')).toBe(true);
    // A board for everyone can be made private by anyone – it becomes theirs.
    expect(mayApply(op({ type: 'setBoardAccess', boardId: 'alle', ownerId: 'u_carl', sharedWith: [] }, 'u_carl'), data, 'u_carl')).toBe(true);
    expect(mayApply(op({ type: 'setBoardAccess', boardId: 'alle', ownerId: 'u_anna', sharedWith: [] }, 'u_carl'), data, 'u_carl')).toBe(false);
    // Nobody creates a private board in someone else's name.
    expect(mayApply(op({ type: 'createBoard', board: board('ny', { ownerId: 'u_anna' }) }, 'u_carl'), data, 'u_carl')).toBe(false);
  });

  it('changes who can see a board', () => {
    let d = applyOp(data, op({ type: 'setBoardAccess', boardId: 'alle', ownerId: 'u_carl', sharedWith: ['u_bo', 'u_carl'] }, 'u_carl'));
    expect(d.boards[0]).toMatchObject({ ownerId: 'u_carl', sharedWith: ['u_bo'] });
    d = applyOp(d, op({ type: 'setBoardAccess', boardId: 'alle', ownerId: null, sharedWith: [] }, 'u_carl'));
    expect(d.boards[0]!.ownerId).toBeUndefined();
    expect(d.boards[0]!.sharedWith).toBeUndefined();
  });
});
