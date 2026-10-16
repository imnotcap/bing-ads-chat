/**
 * Keeps the planning boards in sync with the department's workspace on Cloudflare
 * (cloudflare/src/workspace.ts). Everyone signed in to the app shares the same
 * boards. Ops made on this PC are sent in small batches; the Worker orders them and
 * tells every open app over a WebSocket that something changed, and the apps fetch
 * the new ops.
 *
 * The first time a PC connects, its boards come along: into an empty workspace as
 * the starting point, otherwise as new boards next to the shared ones (except the
 * untouched example board).
 */
import { useEffect } from 'react';
import { api, ApiError, openSocket } from '@/workspace/api';
import { useAccount } from '@/stores/account';
import { LOCAL_ME, MEMBER_COLORS, isBoardData, remapMember, useBoard, type BoardData, type BoardOp, type OpInput } from '@/stores/board';
import { uid } from '@/lib/utils';

/** Member id of a workspace user on the boards. */
export const memberIdOf = (userId: string) => `u_${userId}`;

const EXAMPLE_TITLE = 'Marketingplan';

/** The example board every PC starts with, never changed (checked before member ids are remapped). */
export function isUntouchedExample(d: BoardData, boardId: string) {
  const board = d.boards.find((b) => b.id === boardId);
  if (!board || board.ownerId || board.title !== EXAMPLE_TITLE) return false;
  const cards = Object.values(d.cards).filter((c) => c.boardId === boardId);
  return cards.length > 0 && cards.every((c) => c.activity.length === 1 && c.activity[0]!.memberId === LOCAL_ME);
}

/** Ops that add this PC's own boards to the workspace's (`skip`: boards to leave behind). */
export function bringAlong(local: BoardData, shared: BoardData, skip: Set<string>): OpInput[] {
  const ops: OpInput[] = [];
  const known = new Set([...shared.boards.map((b) => b.id), ...skip]);
  const memberIds = new Set<string>();
  for (const board of local.boards) {
    if (known.has(board.id)) continue;
    ops.push({ type: 'createBoard', board: { ...board, lists: board.lists.map((l) => ({ ...l, cardIds: [] })) } });
    for (const list of board.lists) {
      for (const id of list.cardIds) {
        const card = local.cards[id];
        if (!card || shared.cards[id]) continue;
        ops.push({ type: 'addCard', card });
        card.memberIds.forEach((m) => memberIds.add(m));
      }
    }
  }
  const sharedMembers = new Set(shared.members.map((m) => m.id));
  const members = local.members.filter((m) => memberIds.has(m.id) && !sharedMembers.has(m.id));
  return [...members.map((member): OpInput => ({ type: 'addMember', member })), ...ops];
}

function withOp(input: OpInput, actor: string): BoardOp {
  return { ...input, id: uid('op_'), actor, ts: Date.now() } as BoardOp;
}

/* ------------------------------------ sync ------------------------------------ */

let socket: WebSocket | null = null;
let retry = 0;
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let flushing = false;
let pulling: Promise<void> | null = null;
let starting: Promise<void> | null = null;
/** Ops the server has confirmed; dropped from "pending" by the next pull. */
let acked: string[] = [];

const linked = () => useBoard.getState().team;
const me = () => useAccount.getState().user;

/** Links this PC's boards to the workspace (first connect) and adds the user as a member. */
function start(): Promise<void> {
  starting ??= (async () => {
    const user = me();
    if (!user) return;
    const meId = memberIdOf(user.id);
    const store = useBoard.getState();
    if (store.team?.userId === user.id) return;

    const state = await api<{ version: number; data: BoardData | null }>('/boards/state');
    const mine: BoardData = { boards: store.boards, cards: store.cards, members: store.members };
    const examples = new Set(mine.boards.filter((b) => isUntouchedExample(mine, b.id)).map((b) => b.id));
    const local = remapMember(mine, store.meId, meId);
    // Linked before by someone else on this PC: start from the workspace's boards only.
    const own = !store.team;
    let { version, data } = state;
    let bring = own;
    if (!data) {
      const seeded = await api<{ version: number; data: BoardData; seeded: boolean }>('/boards/seed', { method: 'POST', body: JSON.stringify({ data: own ? local : { boards: [], cards: {}, members: [] } }) });
      ({ version, data } = seeded);
      bring = own && !seeded.seeded;
    }
    if (!isBoardData(data)) throw new ApiError('Tavlerne kunne ikke læses.');
    const pending = bring ? bringAlong(local, data, examples).map((o) => withOp(o, meId)) : [];
    useBoard.getState().setTeam({ version, userId: user.id }, data, meId, pending);
    ensureMember();
  })().finally(() => {
    starting = null;
  });
  return starting;
}

/** The signed-in user is a member on the boards, with the name from their Microsoft account. */
function ensureMember() {
  const user = me();
  const s = useBoard.getState();
  if (!user || !s.team) return;
  const meId = memberIdOf(user.id);
  const existing = s.members.find((m) => m.id === meId);
  if (!existing) s.dispatch({ type: 'addMember', member: { id: meId, name: user.name, color: MEMBER_COLORS[s.members.length % MEMBER_COLORS.length]! } });
  else if (existing.name !== user.name) s.dispatch({ type: 'updateMember', memberId: meId, patch: { name: user.name } });
}

export function pull(): Promise<void> {
  if (pulling) return pulling;
  const t = linked();
  if (!t) return Promise.resolve();
  pulling = (async () => {
    try {
      const res = await api<{ version: number; ops?: BoardOp[]; data?: BoardData }>(`/boards/changes?since=${t.version}`);
      const store = useBoard.getState();
      if (store.team?.userId !== t.userId) return;
      if (res.data && isBoardData(res.data)) {
        store.resetConfirmed(res.data, res.version);
        store.applyRemote([], res.version, acked);
      } else store.applyRemote(res.ops ?? [], res.version, acked);
      acked = [];
      if (socket?.readyState === WebSocket.OPEN) store.setStatus('online');
    } catch (e) {
      handleError(e);
    } finally {
      pulling = null;
    }
  })();
  return pulling;
}

export function flush() {
  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = null;
  if (!linked() || flushing) return;
  const batch = useBoard.getState().pending.filter((p) => !acked.includes(p.id)).slice(0, 100);
  if (!batch.length) return;
  flushing = true;
  void api<{ version: number; accepted: string[]; duplicates: string[] }>('/boards/ops', { method: 'POST', body: JSON.stringify({ ops: batch }) })
    .then(async (res) => {
      acked.push(...res.accepted, ...res.duplicates);
      await pull();
    })
    .catch(handleError)
    .finally(() => {
      flushing = false;
      if (useBoard.getState().pending.some((p) => !acked.includes(p.id))) scheduleFlush(1500);
    });
}

function scheduleFlush(ms = 250) {
  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = setTimeout(flush, ms);
}

function handleError(e: unknown) {
  const store = useBoard.getState();
  if (e instanceof ApiError && (e.status === 401 || e.status === 403)) {
    store.setStatus('error', e.message);
    disconnect();
  } else store.setStatus('offline', e instanceof Error ? e.message : String(e));
}

export async function connect() {
  if (socket || useAccount.getState().status !== 'ready') return;
  if (retryTimer) clearTimeout(retryTimer);
  useBoard.getState().setStatus('connecting');
  try {
    await start();
  } catch (e) {
    handleError(e);
    if (!(e instanceof ApiError && (e.status === 401 || e.status === 403))) retryTimer = setTimeout(() => void connect(), Math.min(30_000, 1000 * 2 ** retry++));
    return;
  }
  if (socket) return;
  const ws = await openSocket('/boards/socket');
  if (!ws || socket) {
    ws?.close();
    return;
  }
  socket = ws;
  ws.onopen = () => {
    retry = 0;
    useBoard.getState().setStatus('online');
    void pull().then(flush);
  };
  ws.onmessage = (e) => {
    try {
      const msg = JSON.parse(String(e.data)) as { type: string; version?: number };
      if ((msg.type === 'changed' || msg.type === 'hello') && (msg.version ?? 0) > (linked()?.version ?? 0)) void pull();
    } catch {
      /* "pong" */
    }
  };
  ws.onclose = (e) => {
    if (socket !== ws) return;
    socket = null;
    const store = useBoard.getState();
    if (!store.team || store.status === 'error') return;
    if (e.code === 4003) {
      store.setStatus('error', 'Du har ikke længere adgang til arbejdsområdet.');
      return;
    }
    store.setStatus('offline', 'Forbindelsen er afbrudt – prøver igen …');
    retryTimer = setTimeout(() => void connect(), Math.min(30_000, 1000 * 2 ** retry++));
  };
}

export function disconnect() {
  if (retryTimer) clearTimeout(retryTimer);
  const ws = socket;
  socket = null;
  ws?.close();
}

/** Keeps the boards in sync while the app runs and someone is signed in (mounted once in App.tsx). */
export function useBoardSync() {
  useEffect(() => {
    if (useAccount.getState().status === 'ready') void connect();
    const unsubAccount = useAccount.subscribe((s, prev) => {
      if (s.status === 'ready' && (prev.status !== 'ready' || s.user?.id !== prev.user?.id)) {
        disconnect();
        void connect();
      }
      if (s.status !== 'ready' && prev.status === 'ready') disconnect();
    });
    let pendingCount = useBoard.getState().pending.length;
    const unsub = useBoard.subscribe((s) => {
      if (s.team && s.pending.length > pendingCount) scheduleFlush();
      pendingCount = s.pending.length;
    });
    const onFocus = () => linked() && void pull().then(flush);
    window.addEventListener('focus', onFocus);
    const keepAlive = setInterval(() => {
      if (!linked() || useAccount.getState().status !== 'ready') return;
      if (socket?.readyState === WebSocket.OPEN) socket.send('ping');
      else if (!socket) void connect();
      void pull().then(flush);
    }, 30_000);
    return () => {
      unsubAccount();
      unsub();
      window.removeEventListener('focus', onFocus);
      clearInterval(keepAlive);
      disconnect();
    };
  }, []);
}
