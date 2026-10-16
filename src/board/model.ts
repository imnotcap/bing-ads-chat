/**
 * Planning boards – the data model and every change as an operation ("op").
 *
 * The same pure `applyOp` runs in the app (optimistically, for instant feedback) and
 * in the Cloudflare Worker (cloudflare/src/worker.ts), which keeps the team's copy
 * and hands every op to all teammates in the same order. Ops carry their own ids and
 * timestamps so applying one gives the same result everywhere.
 *
 * Keep this file free of app imports: the Worker bundles it on its own.
 */

export type LabelColor = 'green' | 'yellow' | 'orange' | 'red' | 'purple' | 'blue' | 'teal' | 'pink' | 'gray';

export const LABEL_COLORS: Record<LabelColor, { solid: string; soft: string; text: string; name: string }> = {
  green: { solid: '#22a06b', soft: '#e3f6ec', text: '#11643f', name: 'Grøn' },
  yellow: { solid: '#e2b203', soft: '#fdf5d8', text: '#7a5d00', name: 'Gul' },
  orange: { solid: '#f08a24', soft: '#fff0e1', text: '#8a4508', name: 'Orange' },
  red: { solid: '#e5484d', soft: '#fdeaea', text: '#9b1c20', name: 'Rød' },
  purple: { solid: '#6d5cf6', soft: '#efecff', text: '#4532c7', name: 'Lilla' },
  blue: { solid: '#3b82f6', soft: '#e6f0ff', text: '#1d4fb8', name: 'Blå' },
  teal: { solid: '#14b8a6', soft: '#e0f7f4', text: '#0d6d63', name: 'Turkis' },
  pink: { solid: '#ec4899', soft: '#fde8f3', text: '#9d1c5c', name: 'Pink' },
  gray: { solid: '#8b8b98', soft: '#f0f0f3', text: '#4a4a55', name: 'Grå' },
};

export const MEMBER_COLORS = ['#6d5cf6', '#14b8a6', '#f08a24', '#ec4899', '#3b82f6', '#22a06b', '#e5484d', '#8b5cf6'];

export interface BoardLabel {
  id: string;
  name: string;
  color: LabelColor;
}

export interface Member {
  id: string;
  name: string;
  /** Team or role, e.g. "SEO". */
  role?: string;
  color: string;
}

export interface ChecklistItem {
  id: string;
  text: string;
  done: boolean;
}

export interface CardActivity {
  id: string;
  ts: number;
  memberId: string;
  kind: 'comment' | 'event';
  text: string;
}

export interface Card {
  id: string;
  boardId: string;
  listId: string;
  title: string;
  description: string;
  labelIds: string[];
  memberIds: string[];
  /** yyyy-mm-dd */
  due: string | null;
  done: boolean;
  checklist: ChecklistItem[];
  activity: CardActivity[];
  cover: LabelColor | null;
  archived: boolean;
  createdAt: number;
}

export interface BoardList {
  id: string;
  title: string;
  cardIds: string[];
}

export interface Board {
  id: string;
  title: string;
  accent: LabelColor;
  lists: BoardList[];
  labels: BoardLabel[];
  createdAt: number;
}

export interface BoardData {
  boards: Board[];
  cards: Record<string, Card>;
  members: Member[];
}

export type CardPatch = Partial<Pick<Card, 'title' | 'description' | 'due' | 'done' | 'cover'>>;

type OpBody =
  | { type: 'createBoard'; board: Board }
  | { type: 'updateBoard'; boardId: string; patch: Partial<Pick<Board, 'title' | 'accent'>> }
  | { type: 'deleteBoard'; boardId: string }
  | { type: 'addList'; boardId: string; list: BoardList }
  | { type: 'renameList'; boardId: string; listId: string; title: string }
  | { type: 'deleteList'; boardId: string; listId: string }
  | { type: 'moveList'; boardId: string; listId: string; toIndex: number }
  | { type: 'sortList'; boardId: string; listId: string; by: 'due' | 'title' | 'created' }
  | { type: 'addCard'; card: Card; top?: boolean }
  | { type: 'updateCard'; cardId: string; patch: CardPatch }
  | { type: 'moveCard'; cardId: string; toListId: string; toIndex: number }
  | { type: 'copyCard'; cardId: string; newId: string }
  | { type: 'archiveCard'; cardId: string }
  | { type: 'restoreCard'; cardId: string }
  | { type: 'deleteCard'; cardId: string }
  | { type: 'archiveDone'; boardId: string; listId: string }
  | { type: 'setLabel'; cardId: string; labelId: string; on: boolean }
  | { type: 'setMember'; cardId: string; memberId: string; on: boolean }
  | { type: 'addCheckItem'; cardId: string; item: ChecklistItem }
  | { type: 'updateCheckItem'; cardId: string; itemId: string; patch: Partial<Omit<ChecklistItem, 'id'>> }
  | { type: 'removeCheckItem'; cardId: string; itemId: string }
  | { type: 'addComment'; cardId: string; text: string }
  | { type: 'addLabel'; boardId: string; label: BoardLabel }
  | { type: 'updateLabel'; boardId: string; labelId: string; patch: Partial<Omit<BoardLabel, 'id'>> }
  | { type: 'deleteLabel'; boardId: string; labelId: string }
  | { type: 'addMember'; member: Member }
  | { type: 'updateMember'; memberId: string; patch: Partial<Omit<Member, 'id'>> }
  | { type: 'removeMember'; memberId: string };

/** One change. `id` is unique (also used to drop duplicates), `actor` is the member who made it. */
export type BoardOp = OpBody & { id: string; actor: string; ts: number };
export type OpInput = OpBody;

export const EMPTY_DATA: BoardData = { boards: [], cards: {}, members: [] };

/* -------------------------------- helpers -------------------------------- */

function mapBoard(d: BoardData, boardId: string, fn: (b: Board) => Board): BoardData {
  return { ...d, boards: d.boards.map((b) => (b.id === boardId ? fn(b) : b)) };
}

function mapLists(b: Board, fn: (l: BoardList) => BoardList): Board {
  return { ...b, lists: b.lists.map(fn) };
}

function withoutCard(b: Board, cardId: string): Board {
  return b.lists.some((l) => l.cardIds.includes(cardId)) ? mapLists(b, (l) => (l.cardIds.includes(cardId) ? { ...l, cardIds: l.cardIds.filter((id) => id !== cardId) } : l)) : b;
}

function insertAt<T>(arr: T[], index: number, item: T): T[] {
  const next = [...arr];
  next.splice(Math.max(0, Math.min(index, next.length)), 0, item);
  return next;
}

const fmtDate = (iso: string) => iso.split('-').reverse().join('.');

/* -------------------------------- reducer -------------------------------- */

/** Applies one op. Ops that refer to something that no longer exists change nothing. */
export function applyOp(d: BoardData, op: BoardOp): BoardData {
  let seq = 0;
  const event = (text: string): CardActivity => ({ id: `${op.id}:${seq++}`, ts: op.ts, memberId: op.actor, kind: 'event', text });
  const card = 'cardId' in op ? d.cards[op.cardId] : undefined;
  const setCard = (c: Card): BoardData => ({ ...d, cards: { ...d.cards, [c.id]: c } });
  const listTitle = (c: Card, listId: string) => d.boards.find((b) => b.id === c.boardId)?.lists.find((l) => l.id === listId)?.title ?? '';
  const memberName = (id: string) => d.members.find((m) => m.id === id)?.name ?? 'et medlem';

  switch (op.type) {
    case 'createBoard':
      return d.boards.some((b) => b.id === op.board.id) ? d : { ...d, boards: [...d.boards, op.board] };
    case 'updateBoard':
      return mapBoard(d, op.boardId, (b) => ({ ...b, ...op.patch, title: op.patch.title?.trim() || b.title }));
    case 'deleteBoard':
      return {
        ...d,
        boards: d.boards.filter((b) => b.id !== op.boardId),
        cards: Object.fromEntries(Object.entries(d.cards).filter(([, c]) => c.boardId !== op.boardId)),
      };

    case 'addList':
      return mapBoard(d, op.boardId, (b) => (b.lists.some((l) => l.id === op.list.id) ? b : { ...b, lists: [...b.lists, op.list] }));
    case 'renameList':
      return mapBoard(d, op.boardId, (b) => mapLists(b, (l) => (l.id === op.listId ? { ...l, title: op.title.trim() || l.title } : l)));
    case 'deleteList':
      return {
        ...mapBoard(d, op.boardId, (b) => ({ ...b, lists: b.lists.filter((l) => l.id !== op.listId) })),
        cards: Object.fromEntries(Object.entries(d.cards).filter(([, c]) => c.listId !== op.listId)),
      };
    case 'moveList':
      return mapBoard(d, op.boardId, (b) => {
        const list = b.lists.find((l) => l.id === op.listId);
        if (!list) return b;
        return { ...b, lists: insertAt(b.lists.filter((l) => l.id !== op.listId), op.toIndex, list) };
      });
    case 'sortList':
      return mapBoard(d, op.boardId, (b) =>
        mapLists(b, (l) => {
          if (l.id !== op.listId) return l;
          const key = (id: string) => {
            const c = d.cards[id];
            if (!c) return '';
            return op.by === 'due' ? (c.due ?? '9999') : op.by === 'title' ? c.title.toLowerCase() : String(c.createdAt).padStart(15, '0');
          };
          return { ...l, cardIds: [...l.cardIds].sort((a, z) => key(a).localeCompare(key(z), 'da')) };
        }),
      );

    case 'addCard': {
      if (d.cards[op.card.id]) return d;
      const c = op.card;
      return {
        ...mapBoard(d, c.boardId, (b) => mapLists(b, (l) => (l.id === c.listId ? { ...l, cardIds: op.top ? [c.id, ...l.cardIds] : [...l.cardIds, c.id] } : l))),
        cards: { ...d.cards, [c.id]: c },
      };
    }
    case 'updateCard': {
      if (!card) return d;
      const log: CardActivity[] = [];
      const p = op.patch;
      if (p.done !== undefined && p.done !== card.done) log.push(event(p.done ? 'markerede kortet som færdigt' : 'genåbnede kortet'));
      if (p.due !== undefined && p.due !== card.due) log.push(event(p.due ? `satte forfaldsdato til ${fmtDate(p.due)}` : 'fjernede forfaldsdatoen'));
      return setCard({ ...card, ...p, title: p.title !== undefined ? p.title.trim() || card.title : card.title, activity: [...card.activity, ...log] });
    }
    case 'moveCard': {
      if (!card || card.archived) return d;
      const board = d.boards.find((b) => b.id === card.boardId);
      if (!board?.lists.some((l) => l.id === op.toListId)) return d;
      const moved = mapLists(withoutCard(board, card.id), (l) => (l.id === op.toListId ? { ...l, cardIds: insertAt(l.cardIds, op.toIndex, card.id) } : l));
      const next = { ...d, boards: d.boards.map((b) => (b.id === board.id ? moved : b)) };
      if (card.listId === op.toListId) return next;
      const activity = [...card.activity, event(`flyttede kortet fra ${listTitle(card, card.listId)} til ${listTitle(card, op.toListId)}`)];
      return { ...next, cards: { ...d.cards, [card.id]: { ...card, listId: op.toListId, activity } } };
    }
    case 'copyCard': {
      if (!card || d.cards[op.newId]) return d;
      const copy: Card = {
        ...card,
        id: op.newId,
        title: `${card.title} (kopi)`,
        checklist: card.checklist.map((i, n) => ({ ...i, id: `${op.newId}:ci${n}` })),
        activity: [event('kopierede kortet')],
        createdAt: op.ts,
      };
      return {
        ...mapBoard(d, card.boardId, (b) => mapLists(b, (l) => (l.id === card.listId ? { ...l, cardIds: l.cardIds.flatMap((id) => (id === card.id ? [id, copy.id] : [id])) } : l))),
        cards: { ...d.cards, [copy.id]: copy },
      };
    }
    case 'archiveCard':
      if (!card || card.archived) return d;
      return {
        ...mapBoard(d, card.boardId, (b) => withoutCard(b, card.id)),
        cards: { ...d.cards, [card.id]: { ...card, archived: true, activity: [...card.activity, event('arkiverede kortet')] } },
      };
    case 'restoreCard': {
      if (!card || !card.archived) return d;
      const board = d.boards.find((b) => b.id === card.boardId);
      const listId = board?.lists.some((l) => l.id === card.listId) ? card.listId : board?.lists[0]?.id;
      if (!board || !listId) return d;
      return {
        ...mapBoard(d, board.id, (b) => mapLists(b, (l) => (l.id === listId ? { ...l, cardIds: [...l.cardIds, card.id] } : l))),
        cards: { ...d.cards, [card.id]: { ...card, listId, archived: false, activity: [...card.activity, event('gendannede kortet')] } },
      };
    }
    case 'deleteCard': {
      if (!card) return d;
      const { [card.id]: _removed, ...cards } = d.cards;
      void _removed;
      return { ...mapBoard(d, card.boardId, (b) => withoutCard(b, card.id)), cards };
    }
    case 'archiveDone': {
      const list = d.boards.find((b) => b.id === op.boardId)?.lists.find((l) => l.id === op.listId);
      let next = d;
      for (const id of list?.cardIds ?? []) if (d.cards[id]?.done) next = applyOp(next, { ...op, id: `${op.id}:${id}`, type: 'archiveCard', cardId: id });
      return next;
    }

    case 'setLabel':
      if (!card || card.labelIds.includes(op.labelId) === op.on) return d;
      return setCard({ ...card, labelIds: op.on ? [...card.labelIds, op.labelId] : card.labelIds.filter((x) => x !== op.labelId) });
    case 'setMember': {
      if (!card || card.memberIds.includes(op.memberId) === op.on) return d;
      const self = op.memberId === op.actor;
      const text = self ? (op.on ? 'tog kortet' : 'slap kortet') : op.on ? `tildelte kortet til ${memberName(op.memberId)}` : `fjernede ${memberName(op.memberId)} fra kortet`;
      return setCard({
        ...card,
        memberIds: op.on ? [...card.memberIds, op.memberId] : card.memberIds.filter((x) => x !== op.memberId),
        activity: [...card.activity, event(text)],
      });
    }

    case 'addCheckItem':
      if (!card || card.checklist.some((i) => i.id === op.item.id)) return d;
      return setCard({ ...card, checklist: [...card.checklist, op.item] });
    case 'updateCheckItem':
      if (!card) return d;
      return setCard({ ...card, checklist: card.checklist.map((i) => (i.id === op.itemId ? { ...i, ...op.patch } : i)) });
    case 'removeCheckItem':
      if (!card) return d;
      return setCard({ ...card, checklist: card.checklist.filter((i) => i.id !== op.itemId) });
    case 'addComment':
      if (!card || !op.text.trim()) return d;
      return setCard({ ...card, activity: [...card.activity, { id: op.id, ts: op.ts, memberId: op.actor, kind: 'comment', text: op.text.trim() }] });

    case 'addLabel':
      return mapBoard(d, op.boardId, (b) => (b.labels.some((l) => l.id === op.label.id) ? b : { ...b, labels: [...b.labels, op.label] }));
    case 'updateLabel':
      return mapBoard(d, op.boardId, (b) => ({ ...b, labels: b.labels.map((l) => (l.id === op.labelId ? { ...l, ...op.patch } : l)) }));
    case 'deleteLabel':
      return {
        ...mapBoard(d, op.boardId, (b) => ({ ...b, labels: b.labels.filter((l) => l.id !== op.labelId) })),
        cards: Object.fromEntries(Object.entries(d.cards).map(([id, c]) => [id, c.labelIds.includes(op.labelId) ? { ...c, labelIds: c.labelIds.filter((x) => x !== op.labelId) } : c])),
      };

    case 'addMember':
      return d.members.some((m) => m.id === op.member.id) ? d : { ...d, members: [...d.members, op.member] };
    case 'updateMember':
      return { ...d, members: d.members.map((m) => (m.id === op.memberId ? { ...m, ...op.patch } : m)) };
    case 'removeMember':
      return {
        ...d,
        members: d.members.filter((m) => m.id !== op.memberId),
        cards: Object.fromEntries(Object.entries(d.cards).map(([id, c]) => [id, c.memberIds.includes(op.memberId) ? { ...c, memberIds: c.memberIds.filter((x) => x !== op.memberId) } : c])),
      };
  }
  return d;
}

/** Replaces one member id everywhere (used when local boards become a team's). */
export function remapMember(d: BoardData, from: string, to: string): BoardData {
  const swap = (id: string) => (id === from ? to : id);
  return {
    boards: d.boards,
    members: d.members.map((m) => ({ ...m, id: swap(m.id) })),
    cards: Object.fromEntries(
      Object.entries(d.cards).map(([id, c]) => [id, { ...c, memberIds: c.memberIds.map(swap), activity: c.activity.map((a) => ({ ...a, memberId: swap(a.memberId) })) }]),
    ),
  };
}

/** Rough check that a value from the network is a board data set. */
export function isBoardData(v: unknown): v is BoardData {
  const d = v as BoardData;
  return !!d && Array.isArray(d.boards) && Array.isArray(d.members) && typeof d.cards === 'object' && d.cards !== null;
}

/* ------------------------------- presentation ------------------------------- */

export function initialsOf(name: string) {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '?';
}

/** Due-date state for the badge colour. */
export function dueState(card: Pick<Card, 'due' | 'done'>, today = new Date()): 'none' | 'done' | 'overdue' | 'soon' | 'later' {
  if (!card.due) return 'none';
  if (card.done) return 'done';
  const t = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const [y, m, d] = card.due.split('-').map(Number) as [number, number, number];
  const due = new Date(y, m - 1, d).getTime();
  if (due < t) return 'overdue';
  if (due - t <= 86_400_000) return 'soon';
  return 'later';
}

export function fmtDue(due: string) {
  const [y, m, d] = due.split('-').map(Number) as [number, number, number];
  return new Date(y, m - 1, d).toLocaleDateString('da-DK', { day: 'numeric', month: 'short' });
}
