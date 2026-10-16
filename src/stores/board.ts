/**
 * Planning boards (Trello-style): boards with lists, cards, labels, members,
 * checklists, due dates and an activity log per card. Stored locally on this PC.
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { uid } from '@/lib/utils';

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

export const ME = 'me';

type CardPatch = Partial<Pick<Card, 'title' | 'description' | 'due' | 'done' | 'cover' | 'labelIds' | 'memberIds' | 'checklist'>>;

interface BoardState {
  boards: Board[];
  cards: Record<string, Card>;
  members: Member[];
  createBoard: (title: string) => string;
  updateBoard: (boardId: string, patch: Partial<Pick<Board, 'title' | 'accent'>>) => void;
  deleteBoard: (boardId: string) => void;
  addList: (boardId: string, title: string) => void;
  renameList: (boardId: string, listId: string, title: string) => void;
  deleteList: (boardId: string, listId: string) => void;
  moveList: (boardId: string, from: number, to: number) => void;
  sortList: (boardId: string, listId: string, by: 'due' | 'title' | 'created') => void;
  addCard: (boardId: string, listId: string, title: string, opts?: { top?: boolean; description?: string; labelIds?: string[] }) => string;
  updateCard: (cardId: string, patch: CardPatch) => void;
  /** Moves a card to a list at an index (also used live while dragging). */
  moveCard: (cardId: string, toListId: string, toIndex: number) => void;
  copyCard: (cardId: string) => void;
  archiveCard: (cardId: string) => void;
  restoreCard: (cardId: string) => void;
  deleteCard: (cardId: string) => void;
  archiveDone: (boardId: string, listId: string) => void;
  toggleLabel: (cardId: string, labelId: string) => void;
  toggleMember: (cardId: string, memberId: string) => void;
  addCheckItem: (cardId: string, text: string) => void;
  updateCheckItem: (cardId: string, itemId: string, patch: Partial<Omit<ChecklistItem, 'id'>>) => void;
  removeCheckItem: (cardId: string, itemId: string) => void;
  addComment: (cardId: string, text: string) => void;
  /** Records the move between lists after a drag ends. */
  logMove: (cardId: string, fromListId: string) => void;
  addLabel: (boardId: string, name: string, color: LabelColor) => string;
  updateLabel: (boardId: string, labelId: string, patch: Partial<Omit<BoardLabel, 'id'>>) => void;
  deleteLabel: (boardId: string, labelId: string) => void;
  addMember: (name: string, role?: string) => void;
  updateMember: (memberId: string, patch: Partial<Omit<Member, 'id'>>) => void;
  removeMember: (memberId: string) => void;
}

const DEFAULT_LABELS = (): BoardLabel[] => [
  { id: uid('lb_'), name: 'Betalt', color: 'purple' },
  { id: uid('lb_'), name: 'SEO', color: 'green' },
  { id: uid('lb_'), name: 'Indhold', color: 'yellow' },
  { id: uid('lb_'), name: 'Analyse', color: 'blue' },
  { id: uid('lb_'), name: 'Haster', color: 'red' },
];

function newCard(boardId: string, listId: string, title: string, extra: Partial<Card> = {}): Card {
  const id = uid('c_');
  return {
    id,
    boardId,
    listId,
    title,
    description: '',
    labelIds: [],
    memberIds: [],
    due: null,
    done: false,
    checklist: [],
    activity: [{ id: uid('a_'), ts: Date.now(), memberId: ME, kind: 'event', text: 'oprettede kortet' }],
    cover: null,
    archived: false,
    createdAt: Date.now(),
    ...extra,
  };
}

function isoDay(offset: number) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** The first board, with a few example cards so the board isn't empty on day one. */
function seed() {
  const boardId = uid('b_');
  const labels = DEFAULT_LABELS();
  const [paid, seo, content, analysis, urgent] = labels.map((l) => l.id) as [string, string, string, string, string];
  const lists: BoardList[] = ['Idéer', 'To do', 'I gang', 'Til review', 'Færdig'].map((title) => ({ id: uid('l_'), title, cardIds: [] }));
  const cards: Card[] = [];
  const add = (listIndex: number, title: string, extra: Partial<Card> = {}) => {
    const list = lists[listIndex]!;
    const card = newCard(boardId, list.id, title, extra);
    list.cardIds.push(card.id);
    cards.push(card);
  };
  add(0, 'Test nye annoncetekster til sommerkampagnen', { labelIds: [paid, content] });
  add(0, 'Blogindlæg: guide til at vælge den rigtige størrelse', { labelIds: [seo, content] });
  add(1, 'Titel-optimér de nye kampagner', {
    labelIds: [paid],
    due: isoDay(2),
    description: 'Gennemgå titlerne på de nye kampagner, så de matcher søgeordene og produktnavnene.',
    checklist: [
      { id: uid('ci_'), text: 'Hent søgetermer fra de sidste 30 dage', done: true },
      { id: uid('ci_'), text: 'Skriv nye titler', done: false },
      { id: uid('ci_'), text: 'Godkend i chatten', done: false },
    ],
  });
  add(1, 'Tilføj negative søgeord på brand-kampagnen', { labelIds: [paid, urgent], due: isoDay(-1) });
  add(1, 'Tjek meta-titler på kategorisiderne', { labelIds: [seo] });
  add(2, 'Månedsrapport til ledelsen', { labelIds: [analysis], memberIds: [ME], due: isoDay(5), cover: 'blue' });
  add(3, 'Ny landingsside til efterårskollektionen', { labelIds: [content, seo] });
  add(4, 'Opsæt konverteringssporing', { labelIds: [analysis, paid], done: true });
  const board: Board = { id: boardId, title: 'Marketingplan', accent: 'purple', lists, labels, createdAt: Date.now() };
  return { boards: [board], cards: Object.fromEntries(cards.map((c) => [c.id, c])) };
}

const initial = seed();

export const useBoard = create<BoardState>()(
  persist(
    (set, get) => {
      const patchCard = (cardId: string, fn: (c: Card) => Partial<Card>) =>
        set((s) => {
          const c = s.cards[cardId];
          return c ? { cards: { ...s.cards, [cardId]: { ...c, ...fn(c) } } } : s;
        });
      const patchBoard = (boardId: string, fn: (b: Board) => Partial<Board>) =>
        set((s) => ({ boards: s.boards.map((b) => (b.id === boardId ? { ...b, ...fn(b) } : b)) }));
      const event = (text: string, memberId = ME): CardActivity => ({ id: uid('a_'), ts: Date.now(), memberId, kind: 'event', text });
      const listTitle = (c: Card, listId = c.listId) => get().boards.find((b) => b.id === c.boardId)?.lists.find((l) => l.id === listId)?.title ?? '';

      return {
        ...initial,
        members: [{ id: ME, name: 'Mig', color: MEMBER_COLORS[0]! }],

        createBoard: (title) => {
          const id = uid('b_');
          const lists = ['To do', 'I gang', 'Færdig'].map((t) => ({ id: uid('l_'), title: t, cardIds: [] }));
          const accents: LabelColor[] = ['purple', 'teal', 'blue', 'pink', 'orange', 'green'];
          set((s) => ({
            boards: [...s.boards, { id, title: title.trim() || 'Ny tavle', accent: accents[s.boards.length % accents.length]!, lists, labels: DEFAULT_LABELS(), createdAt: Date.now() }],
          }));
          return id;
        },
        updateBoard: (boardId, patch) => patchBoard(boardId, () => patch),
        deleteBoard: (boardId) =>
          set((s) => ({
            boards: s.boards.filter((b) => b.id !== boardId),
            cards: Object.fromEntries(Object.entries(s.cards).filter(([, c]) => c.boardId !== boardId)),
          })),

        addList: (boardId, title) => patchBoard(boardId, (b) => ({ lists: [...b.lists, { id: uid('l_'), title: title.trim() || 'Ny liste', cardIds: [] }] })),
        renameList: (boardId, listId, title) => patchBoard(boardId, (b) => ({ lists: b.lists.map((l) => (l.id === listId ? { ...l, title: title.trim() || l.title } : l)) })),
        deleteList: (boardId, listId) =>
          set((s) => ({
            boards: s.boards.map((b) => (b.id === boardId ? { ...b, lists: b.lists.filter((l) => l.id !== listId) } : b)),
            cards: Object.fromEntries(Object.entries(s.cards).filter(([, c]) => c.listId !== listId)),
          })),
        moveList: (boardId, from, to) =>
          patchBoard(boardId, (b) => {
            const lists = [...b.lists];
            const [moved] = lists.splice(from, 1);
            if (moved) lists.splice(to, 0, moved);
            return { lists };
          }),
        sortList: (boardId, listId, by) =>
          patchBoard(boardId, (b) => ({
            lists: b.lists.map((l) => {
              if (l.id !== listId) return l;
              const cards = get().cards;
              const key = (id: string) => {
                const c = cards[id];
                if (!c) return '';
                return by === 'due' ? (c.due ?? '9999') : by === 'title' ? c.title.toLowerCase() : String(c.createdAt).padStart(15, '0');
              };
              return { ...l, cardIds: [...l.cardIds].sort((a, z) => key(a).localeCompare(key(z), 'da')) };
            }),
          })),

        addCard: (boardId, listId, title, opts = {}) => {
          const card = newCard(boardId, listId, title.trim(), { description: opts.description ?? '', labelIds: opts.labelIds ?? [] });
          set((s) => ({
            cards: { ...s.cards, [card.id]: card },
            boards: s.boards.map((b) =>
              b.id === boardId ? { ...b, lists: b.lists.map((l) => (l.id === listId ? { ...l, cardIds: opts.top ? [card.id, ...l.cardIds] : [...l.cardIds, card.id] } : l)) } : b,
            ),
          }));
          return card.id;
        },
        updateCard: (cardId, patch) =>
          patchCard(cardId, (c) => {
            const log: CardActivity[] = [];
            if (patch.done !== undefined && patch.done !== c.done) log.push(event(patch.done ? 'markerede kortet som færdigt' : 'genåbnede kortet'));
            if (patch.due !== undefined && patch.due !== c.due) log.push(event(patch.due ? `satte forfaldsdato til ${patch.due.split('-').reverse().join('.')}` : 'fjernede forfaldsdatoen'));
            return { ...patch, activity: [...c.activity, ...log] };
          }),
        moveCard: (cardId, toListId, toIndex) =>
          set((s) => {
            const card = s.cards[cardId];
            if (!card) return s;
            const boards = s.boards.map((b) => {
              if (b.id !== card.boardId) return b;
              return {
                ...b,
                lists: b.lists.map((l) => {
                  let ids = l.cardIds.filter((id) => id !== cardId);
                  if (l.id === toListId) {
                    ids = [...ids];
                    ids.splice(Math.max(0, Math.min(toIndex, ids.length)), 0, cardId);
                  }
                  return ids.length === l.cardIds.length && l.id !== toListId ? l : { ...l, cardIds: ids };
                }),
              };
            });
            return { boards, cards: card.listId === toListId ? s.cards : { ...s.cards, [cardId]: { ...card, listId: toListId } } };
          }),
        logMove: (cardId, fromListId) => {
          const c = get().cards[cardId];
          if (!c || c.listId === fromListId) return;
          patchCard(cardId, () => ({ activity: [...c.activity, event(`flyttede kortet fra ${listTitle(c, fromListId)} til ${listTitle(c)}`)] }));
        },
        copyCard: (cardId) => {
          const c = get().cards[cardId];
          if (!c) return;
          const copy: Card = {
            ...c,
            id: uid('c_'),
            title: `${c.title} (kopi)`,
            checklist: c.checklist.map((i) => ({ ...i, id: uid('ci_') })),
            activity: [event('kopierede kortet')],
            createdAt: Date.now(),
          };
          set((s) => ({
            cards: { ...s.cards, [copy.id]: copy },
            boards: s.boards.map((b) =>
              b.id === c.boardId
                ? { ...b, lists: b.lists.map((l) => (l.id === c.listId ? { ...l, cardIds: l.cardIds.flatMap((id) => (id === cardId ? [id, copy.id] : [id])) } : l)) }
                : b,
            ),
          }));
        },
        archiveCard: (cardId) =>
          set((s) => {
            const c = s.cards[cardId];
            if (!c) return s;
            return {
              cards: { ...s.cards, [cardId]: { ...c, archived: true, activity: [...c.activity, event('arkiverede kortet')] } },
              boards: s.boards.map((b) => (b.id === c.boardId ? { ...b, lists: b.lists.map((l) => ({ ...l, cardIds: l.cardIds.filter((id) => id !== cardId) })) } : b)),
            };
          }),
        restoreCard: (cardId) =>
          set((s) => {
            const c = s.cards[cardId];
            if (!c) return s;
            const board = s.boards.find((b) => b.id === c.boardId);
            const listId = board?.lists.some((l) => l.id === c.listId) ? c.listId : board?.lists[0]?.id;
            if (!board || !listId) return s;
            return {
              cards: { ...s.cards, [cardId]: { ...c, listId, archived: false, activity: [...c.activity, event('gendannede kortet')] } },
              boards: s.boards.map((b) => (b.id === c.boardId ? { ...b, lists: b.lists.map((l) => (l.id === listId ? { ...l, cardIds: [...l.cardIds, cardId] } : l)) } : b)),
            };
          }),
        deleteCard: (cardId) =>
          set((s) => {
            const c = s.cards[cardId];
            if (!c) return s;
            const { [cardId]: _removed, ...cards } = s.cards;
            void _removed;
            return {
              cards,
              boards: s.boards.map((b) => (b.id === c.boardId ? { ...b, lists: b.lists.map((l) => ({ ...l, cardIds: l.cardIds.filter((id) => id !== cardId) })) } : b)),
            };
          }),
        archiveDone: (boardId, listId) => {
          const list = get().boards.find((b) => b.id === boardId)?.lists.find((l) => l.id === listId);
          for (const id of list?.cardIds ?? []) if (get().cards[id]?.done) get().archiveCard(id);
        },

        toggleLabel: (cardId, labelId) =>
          patchCard(cardId, (c) => ({ labelIds: c.labelIds.includes(labelId) ? c.labelIds.filter((x) => x !== labelId) : [...c.labelIds, labelId] })),
        toggleMember: (cardId, memberId) =>
          patchCard(cardId, (c) => {
            const on = c.memberIds.includes(memberId);
            const name = get().members.find((m) => m.id === memberId)?.name ?? 'Et medlem';
            const text = memberId === ME ? (on ? 'forlod kortet' : 'tog kortet') : on ? `fjernede ${name}` : `tildelte kortet til ${name}`;
            return { memberIds: on ? c.memberIds.filter((x) => x !== memberId) : [...c.memberIds, memberId], activity: [...c.activity, event(text)] };
          }),

        addCheckItem: (cardId, text) => patchCard(cardId, (c) => ({ checklist: [...c.checklist, { id: uid('ci_'), text: text.trim(), done: false }] })),
        updateCheckItem: (cardId, itemId, patch) => patchCard(cardId, (c) => ({ checklist: c.checklist.map((i) => (i.id === itemId ? { ...i, ...patch } : i)) })),
        removeCheckItem: (cardId, itemId) => patchCard(cardId, (c) => ({ checklist: c.checklist.filter((i) => i.id !== itemId) })),
        addComment: (cardId, text) =>
          patchCard(cardId, (c) => ({ activity: [...c.activity, { id: uid('a_'), ts: Date.now(), memberId: ME, kind: 'comment', text: text.trim() }] })),

        addLabel: (boardId, name, color) => {
          const id = uid('lb_');
          patchBoard(boardId, (b) => ({ labels: [...b.labels, { id, name: name.trim(), color }] }));
          return id;
        },
        updateLabel: (boardId, labelId, patch) => patchBoard(boardId, (b) => ({ labels: b.labels.map((l) => (l.id === labelId ? { ...l, ...patch } : l)) })),
        deleteLabel: (boardId, labelId) =>
          set((s) => ({
            boards: s.boards.map((b) => (b.id === boardId ? { ...b, labels: b.labels.filter((l) => l.id !== labelId) } : b)),
            cards: Object.fromEntries(Object.entries(s.cards).map(([id, c]) => [id, c.labelIds.includes(labelId) ? { ...c, labelIds: c.labelIds.filter((x) => x !== labelId) } : c])),
          })),

        addMember: (name, role) =>
          set((s) => ({ members: [...s.members, { id: uid('m_'), name: name.trim(), role: role?.trim() || undefined, color: MEMBER_COLORS[s.members.length % MEMBER_COLORS.length]! }] })),
        updateMember: (memberId, patch) => set((s) => ({ members: s.members.map((m) => (m.id === memberId ? { ...m, ...patch } : m)) })),
        removeMember: (memberId) =>
          set((s) =>
            memberId === ME
              ? s
              : {
                  members: s.members.filter((m) => m.id !== memberId),
                  cards: Object.fromEntries(Object.entries(s.cards).map(([id, c]) => [id, c.memberIds.includes(memberId) ? { ...c, memberIds: c.memberIds.filter((x) => x !== memberId) } : c])),
                },
          ),
      };
    },
    { name: 'bac.board', version: 1 },
  ),
);

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

/** Open cards claimed by me across all boards (badge in the sidebar). */
export function myOpenCards(s: Pick<BoardState, 'cards'>, boardId?: string) {
  return Object.values(s.cards).filter((c) => !c.archived && !c.done && c.memberIds.includes(ME) && (!boardId || c.boardId === boardId)).length;
}
