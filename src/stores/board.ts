/**
 * Planning boards (Trello-style). Every change is an op from board/model.ts:
 * - Alone on this PC, ops are applied straight away and saved locally.
 * - Shared with a team (board/sync.ts), ops are applied at once on top of the team's
 *   confirmed copy ("pending") and sent to the Cloudflare Worker, which orders them
 *   for everyone. What is shown = confirmed + pending (+ the card being dragged).
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { uid } from '@/lib/utils';
import {
  MEMBER_COLORS,
  applyOp,
  type Board,
  type BoardData,
  type BoardLabel,
  type BoardList,
  type BoardOp,
  type Card,
  type CardPatch,
  type ChecklistItem,
  type LabelColor,
  type Member,
  type OpInput,
} from '@/board/model';

export * from '@/board/model';

/** Member id of the user on this PC before a team is set up. */
export const LOCAL_ME = 'me';

export interface TeamInfo {
  id: string;
  secret: string;
  name: string;
  /** Last version of the team's boards this PC has. */
  version: number;
}

export type SyncStatus = 'local' | 'connecting' | 'online' | 'offline' | 'error';

interface BoardState extends BoardData {
  meId: string;
  confirmed: BoardData;
  pending: BoardOp[];
  /** Live position of the card being dragged (not sent until it is dropped). */
  preview: BoardOp | null;
  team: TeamInfo | null;
  status: SyncStatus;
  statusDetail: string | null;

  dispatch: (op: OpInput) => BoardOp;
  createBoard: (title: string) => string;
  updateBoard: (boardId: string, patch: Partial<Pick<Board, 'title' | 'accent'>>) => void;
  deleteBoard: (boardId: string) => void;
  addList: (boardId: string, title: string) => void;
  renameList: (boardId: string, listId: string, title: string) => void;
  deleteList: (boardId: string, listId: string) => void;
  moveList: (boardId: string, listId: string, toIndex: number) => void;
  sortList: (boardId: string, listId: string, by: 'due' | 'title' | 'created') => void;
  addCard: (boardId: string, listId: string, title: string, opts?: { top?: boolean; description?: string; labelIds?: string[] }) => string;
  updateCard: (cardId: string, patch: CardPatch) => void;
  moveCard: (cardId: string, toListId: string, toIndex: number) => void;
  previewMove: (cardId: string, toListId: string, toIndex: number) => void;
  clearPreview: () => void;
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
  addLabel: (boardId: string, name: string, color: LabelColor) => string;
  updateLabel: (boardId: string, labelId: string, patch: Partial<Omit<BoardLabel, 'id'>>) => void;
  deleteLabel: (boardId: string, labelId: string) => void;
  addMember: (name: string, role?: string) => void;
  updateMember: (memberId: string, patch: Partial<Omit<Member, 'id'>>) => void;
  removeMember: (memberId: string) => void;

  /* used by board/sync.ts */
  applyRemote: (ops: BoardOp[], version: number, drop?: string[]) => void;
  resetConfirmed: (data: BoardData, version: number) => void;
  setTeam: (team: TeamInfo | null, data: BoardData, meId: string, pending?: BoardOp[]) => void;
  setStatus: (status: SyncStatus, detail?: string | null) => void;
}

const DEFAULT_LABELS = (): BoardLabel[] => [
  { id: uid('lb_'), name: 'Betalt', color: 'purple' },
  { id: uid('lb_'), name: 'SEO', color: 'green' },
  { id: uid('lb_'), name: 'Indhold', color: 'yellow' },
  { id: uid('lb_'), name: 'Analyse', color: 'blue' },
  { id: uid('lb_'), name: 'Haster', color: 'red' },
];

function newCard(boardId: string, listId: string, title: string, memberId: string, extra: Partial<Card> = {}): Card {
  return {
    id: uid('c_'),
    boardId,
    listId,
    title,
    description: '',
    labelIds: [],
    memberIds: [],
    due: null,
    done: false,
    checklist: [],
    activity: [{ id: uid('a_'), ts: Date.now(), memberId, kind: 'event', text: 'oprettede kortet' }],
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
function seed(): BoardData {
  const boardId = uid('b_');
  const labels = DEFAULT_LABELS();
  const [paid, seo, content, analysis, urgent] = labels.map((l) => l.id) as [string, string, string, string, string];
  const lists: BoardList[] = ['Idéer', 'To do', 'I gang', 'Til review', 'Færdig'].map((title) => ({ id: uid('l_'), title, cardIds: [] }));
  const cards: Card[] = [];
  const add = (listIndex: number, title: string, extra: Partial<Card> = {}) => {
    const list = lists[listIndex]!;
    const card = newCard(boardId, list.id, title, LOCAL_ME, extra);
    list.cardIds.push(card.id);
    cards.push(card);
  };
  add(0, 'Test nye annoncetekster til sommerkampagnen', { labelIds: [paid, content] });
  add(0, 'Blogindlæg: guide til at vælge den rigtige størrelse', { labelIds: [seo, content] });
  add(1, 'Titel-optimér de nye kampagner', {
    labelIds: [paid],
    priority: 'high',
    due: isoDay(2),
    description: 'Gennemgå titlerne på de nye kampagner, så de matcher søgeordene og produktnavnene.',
    checklist: [
      { id: uid('ci_'), text: 'Hent søgetermer fra de sidste 30 dage', done: true },
      { id: uid('ci_'), text: 'Skriv nye titler', done: false },
      { id: uid('ci_'), text: 'Godkend i chatten', done: false },
    ],
  });
  add(1, 'Tilføj negative søgeord på brand-kampagnen', { labelIds: [paid, urgent], due: isoDay(-1), priority: 'highest', description: 'Brand-kampagnen betaler for søgninger på konkurrenternes navne. Tilføj dem som negative søgeord.' });
  add(1, 'Tjek meta-titler på kategorisiderne', {
    labelIds: [seo],
    priority: 'medium',
    checklist: [
      { id: uid('ci_'), text: 'Kontorstole', done: true },
      { id: uid('ci_'), text: 'Hæve-sænkeborde', done: false },
      { id: uid('ci_'), text: 'Belysning', done: false },
    ],
  });
  add(2, 'Månedsrapport til ledelsen', {
    labelIds: [analysis],
    memberIds: [LOCAL_ME],
    due: isoDay(5),
    priority: 'low',
    description: 'Forbrug, omsætning og ROAS for måneden, med de tre vigtigste læringer.',
  });
  add(3, 'Ny landingsside til efterårskollektionen', { labelIds: [content, seo] });
  add(4, 'Opsæt konverteringssporing', { labelIds: [analysis, paid], done: true });
  return {
    boards: [{ id: boardId, title: 'Marketingplan', accent: 'purple', lists, labels, createdAt: Date.now() }],
    cards: Object.fromEntries(cards.map((c) => [c.id, c])),
    members: [{ id: LOCAL_ME, name: 'Mig', color: MEMBER_COLORS[0]! }],
  };
}

type Core = Pick<BoardState, 'confirmed' | 'pending' | 'preview'>;

/** What is shown: the confirmed boards with this PC's unsent changes on top. */
function derive(s: Core): BoardData {
  let d = s.confirmed;
  for (const op of s.pending) d = applyOp(d, op);
  if (s.preview) d = applyOp(d, s.preview);
  return d;
}

const initial = seed();

export const useBoard = create<BoardState>()(
  persist(
    (set, get) => {
      /** Sets core fields and recomputes what is shown. */
      const commit = (patch: Partial<BoardState>) =>
        set((s) => {
          const next = { ...s, ...patch };
          return { ...patch, ...derive(next) };
        });
      const op = (input: OpInput) => get().dispatch(input);

      return {
        ...initial,
        confirmed: initial,
        pending: [],
        preview: null,
        meId: LOCAL_ME,
        team: null,
        status: 'local',
        statusDetail: null,

        dispatch: (input) => {
          const s = get();
          const full = { ...input, id: uid('op_'), actor: s.meId, ts: Date.now() } as BoardOp;
          if (s.team) commit({ pending: [...s.pending, full] });
          else commit({ confirmed: applyOp(s.confirmed, full) });
          return full;
        },

        createBoard: (title) => {
          const accents: LabelColor[] = ['purple', 'teal', 'blue', 'pink', 'orange', 'green'];
          const board: Board = {
            id: uid('b_'),
            title: title.trim() || 'Ny tavle',
            accent: accents[get().boards.length % accents.length]!,
            lists: ['To do', 'I gang', 'Færdig'].map((t) => ({ id: uid('l_'), title: t, cardIds: [] })),
            labels: DEFAULT_LABELS(),
            createdAt: Date.now(),
          };
          op({ type: 'createBoard', board });
          return board.id;
        },
        updateBoard: (boardId, patch) => void op({ type: 'updateBoard', boardId, patch }),
        deleteBoard: (boardId) => void op({ type: 'deleteBoard', boardId }),
        addList: (boardId, title) => void op({ type: 'addList', boardId, list: { id: uid('l_'), title: title.trim() || 'Ny liste', cardIds: [] } }),
        renameList: (boardId, listId, title) => void op({ type: 'renameList', boardId, listId, title }),
        deleteList: (boardId, listId) => void op({ type: 'deleteList', boardId, listId }),
        moveList: (boardId, listId, toIndex) => void op({ type: 'moveList', boardId, listId, toIndex }),
        sortList: (boardId, listId, by) => void op({ type: 'sortList', boardId, listId, by }),

        addCard: (boardId, listId, title, opts = {}) => {
          const card = newCard(boardId, listId, title.trim(), get().meId, { description: opts.description ?? '', labelIds: opts.labelIds ?? [] });
          op({ type: 'addCard', card, top: opts.top });
          return card.id;
        },
        updateCard: (cardId, patch) => void op({ type: 'updateCard', cardId, patch }),
        moveCard: (cardId, toListId, toIndex) => {
          commit({ preview: null });
          op({ type: 'moveCard', cardId, toListId, toIndex });
        },
        previewMove: (cardId, toListId, toIndex) =>
          commit({ preview: { type: 'moveCard', cardId, toListId, toIndex, id: 'preview', actor: get().meId, ts: Date.now() } }),
        clearPreview: () => commit({ preview: null }),
        copyCard: (cardId) => void op({ type: 'copyCard', cardId, newId: uid('c_') }),
        archiveCard: (cardId) => void op({ type: 'archiveCard', cardId }),
        restoreCard: (cardId) => void op({ type: 'restoreCard', cardId }),
        deleteCard: (cardId) => void op({ type: 'deleteCard', cardId }),
        archiveDone: (boardId, listId) => void op({ type: 'archiveDone', boardId, listId }),

        toggleLabel: (cardId, labelId) => {
          const c = get().cards[cardId];
          if (c) op({ type: 'setLabel', cardId, labelId, on: !c.labelIds.includes(labelId) });
        },
        toggleMember: (cardId, memberId) => {
          const c = get().cards[cardId];
          if (c) op({ type: 'setMember', cardId, memberId, on: !c.memberIds.includes(memberId) });
        },
        addCheckItem: (cardId, text) => void op({ type: 'addCheckItem', cardId, item: { id: uid('ci_'), text: text.trim(), done: false } }),
        updateCheckItem: (cardId, itemId, patch) => void op({ type: 'updateCheckItem', cardId, itemId, patch }),
        removeCheckItem: (cardId, itemId) => void op({ type: 'removeCheckItem', cardId, itemId }),
        addComment: (cardId, text) => void op({ type: 'addComment', cardId, text }),

        addLabel: (boardId, name, color) => {
          const label = { id: uid('lb_'), name: name.trim(), color };
          op({ type: 'addLabel', boardId, label });
          return label.id;
        },
        updateLabel: (boardId, labelId, patch) => void op({ type: 'updateLabel', boardId, labelId, patch }),
        deleteLabel: (boardId, labelId) => void op({ type: 'deleteLabel', boardId, labelId }),
        addMember: (name, role) =>
          void op({
            type: 'addMember',
            member: { id: uid('m_'), name: name.trim(), role: role?.trim() || undefined, color: MEMBER_COLORS[get().members.length % MEMBER_COLORS.length]! },
          }),
        updateMember: (memberId, patch) => void op({ type: 'updateMember', memberId, patch }),
        removeMember: (memberId) => {
          if (memberId !== get().meId) op({ type: 'removeMember', memberId });
        },

        applyRemote: (ops, version, drop = []) => {
          const s = get();
          if (!s.team) return;
          let confirmed = s.confirmed;
          for (const o of ops) confirmed = applyOp(confirmed, o);
          const done = new Set([...ops.map((o) => o.id), ...drop]);
          commit({ confirmed, pending: s.pending.filter((p) => !done.has(p.id)), team: { ...s.team, version } });
        },
        resetConfirmed: (data, version) => {
          const s = get();
          if (s.team) commit({ confirmed: data, team: { ...s.team, version } });
        },
        setTeam: (team, data, meId, pending = []) => commit({ team, confirmed: data, meId, pending, preview: null, status: team ? 'connecting' : 'local', statusDetail: null }),
        setStatus: (status, detail = null) => set({ status, statusDetail: detail }),
      };
    },
    {
      name: 'bac.board',
      version: 2,
      partialize: ({ confirmed, pending, meId, team }) => ({ confirmed, pending, meId, team }),
      // v2: changes became ops (shared with the team through Cloudflare).
      migrate: (persisted, version) => {
        if (version < 2) {
          const p = persisted as Partial<BoardData>;
          const data = p.boards && p.cards && p.members ? { boards: p.boards, cards: p.cards, members: p.members } : seed();
          return { confirmed: data, pending: [], meId: LOCAL_ME, team: null };
        }
        return persisted as BoardState;
      },
      merge: (persisted, current) => {
        const next = { ...current, ...(persisted as Partial<BoardState>) };
        return { ...next, ...derive(next), status: next.team ? 'connecting' : 'local' };
      },
    },
  ),
);

/** Open cards the user has taken (badge in the sidebar). */
export function myOpenCards(s: Pick<BoardState, 'cards' | 'meId'>, boardId?: string) {
  return Object.values(s.cards).filter((c) => !c.archived && !c.done && c.memberIds.includes(s.meId) && (!boardId || c.boardId === boardId)).length;
}
