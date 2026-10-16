/**
 * Shares the planning boards with the team through the Cloudflare Worker
 * (cloudflare/src/worker.ts). Ops made on this PC are sent in small batches; the
 * Worker orders them and tells every open app over a WebSocket that something
 * changed, and the apps fetch the new ops. A team is joined with an invite code
 * (team id + secret); the secret is the key to the team's boards.
 */
import { useEffect } from 'react';
import { uid } from '@/lib/utils';
import { LOCAL_ME, MEMBER_COLORS, isBoardData, remapMember, useBoard, type BoardData, type BoardOp } from '@/stores/board';

export const SITE_URL = ((import.meta.env.VITE_SITE_URL as string | undefined) || 'https://bing-ads-chat.casperjohansen.workers.dev').replace(/\/$/, '');

export class TeamError extends Error {
  constructor(
    message: string,
    public status = 0,
  ) {
    super(message);
  }
}

async function api<T>(path: string, init: RequestInit & { secret?: string } = {}): Promise<T> {
  const { secret, ...rest } = init;
  let res: Response;
  try {
    res = await fetch(`${SITE_URL}/api${path}`, {
      ...rest,
      headers: { 'Content-Type': 'application/json', ...(secret ? { Authorization: `Bearer ${secret}` } : {}), ...rest.headers },
    });
  } catch {
    throw new TeamError('Kunne ikke nå serveren. Tjek internetforbindelsen.');
  }
  const body = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) {
    const msg = res.status === 401 || res.status === 404 ? 'Invitationskoden er ikke gyldig (teamet findes ikke, eller koden er forkert).' : (body.error ?? `Serveren svarede ${res.status}.`);
    throw new TeamError(msg, res.status);
  }
  return body;
}

/* ------------------------------- invite codes ------------------------------- */

export function inviteCode(team: { id: string; secret: string }) {
  return `bac-${team.id}-${team.secret}`;
}

export function parseInvite(code: string): { id: string; secret: string } | null {
  const m = code.trim().match(/^bac-([a-z0-9]{8,40})-([a-z0-9]{20,80})$/i);
  return m ? { id: m[1]!.toLowerCase(), secret: m[2]!.toLowerCase() } : null;
}

/* --------------------------------- team setup --------------------------------- */

function withMe(data: BoardData, meId: string, name: string, role: string): BoardData {
  const exists = data.members.some((m) => m.id === meId);
  const me = { id: meId, name: name.trim() || 'Mig', role: role.trim() || undefined, color: data.members.find((m) => m.id === meId)?.color ?? MEMBER_COLORS[data.members.length % MEMBER_COLORS.length]! };
  return { ...data, members: exists ? data.members.map((m) => (m.id === meId ? me : m)) : [...data.members, me] };
}

/** Turns this PC's boards into a new team and returns the invite code. */
export async function createTeam(teamName: string, myName: string, role: string) {
  const s = useBoard.getState();
  const meId = uid('m_');
  // The local "Mig" becomes a real member, so teammates can tell people apart.
  const data = withMe(remapMember({ boards: s.boards, cards: s.cards, members: s.members }, s.meId === LOCAL_ME ? LOCAL_ME : s.meId, meId), meId, myName, role);
  const res = await api<{ teamId: string; secret: string; version: number }>('/teams', { method: 'POST', body: JSON.stringify({ name: teamName.trim() || 'Team', data }) });
  useBoard.getState().setTeam({ id: res.teamId, secret: res.secret, name: teamName.trim() || 'Team', version: res.version }, data, meId);
  connect();
  return inviteCode({ id: res.teamId, secret: res.secret });
}

/** Joins a team: its boards replace the ones on this PC. */
export async function joinTeam(code: string, myName: string, role: string) {
  const invite = parseInvite(code);
  if (!invite) throw new TeamError('Koden ligner ikke en invitationskode. Den starter med "bac-".');
  const res = await api<{ name: string; version: number; data: BoardData }>(`/teams/${invite.id}/state`, { secret: invite.secret });
  if (!isBoardData(res.data)) throw new TeamError('Teamets tavler kunne ikke læses.');
  const meId = uid('m_');
  const store = useBoard.getState();
  store.setTeam({ ...invite, name: res.name, version: res.version }, res.data, meId);
  store.dispatch({ type: 'addMember', member: withMe(EMPTY, meId, myName, role).members[0]! });
  connect();
  flush();
}

const EMPTY: BoardData = { boards: [], cards: {}, members: [] };

/** Stops sharing on this PC; the boards stay here as a local copy. */
export function leaveTeam() {
  disconnect();
  const s = useBoard.getState();
  s.setTeam(null, { boards: s.boards, cards: s.cards, members: s.members }, s.meId);
}

/* ------------------------------------ sync ------------------------------------ */

let socket: WebSocket | null = null;
let retry = 0;
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let flushing = false;
let pulling: Promise<void> | null = null;
/** Ops the server has confirmed; dropped from "pending" by the next pull. */
let acked: string[] = [];

function team() {
  return useBoard.getState().team;
}

export function pull(): Promise<void> {
  if (pulling) return pulling;
  const t = team();
  if (!t) return Promise.resolve();
  pulling = (async () => {
    try {
      const res = await api<{ version: number; ops?: BoardOp[]; data?: BoardData }>(`/teams/${t.id}/changes?since=${t.version}`, { secret: t.secret });
      const store = useBoard.getState();
      if (store.team?.id !== t.id) return;
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
  const t = team();
  if (!t || flushing) return;
  const batch = useBoard.getState().pending.filter((p) => !acked.includes(p.id)).slice(0, 100);
  if (!batch.length) return;
  flushing = true;
  void api<{ version: number; accepted: string[]; duplicates: string[] }>(`/teams/${t.id}/ops`, { method: 'POST', secret: t.secret, body: JSON.stringify({ ops: batch }) })
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
  if (e instanceof TeamError && (e.status === 401 || e.status === 404)) {
    store.setStatus('error', e.message);
    disconnect();
  } else store.setStatus('offline', e instanceof Error ? e.message : String(e));
}

export function connect() {
  const t = team();
  if (!t || socket) return;
  if (retryTimer) clearTimeout(retryTimer);
  useBoard.getState().setStatus('connecting');
  const ws = new WebSocket(`${SITE_URL.replace(/^http/, 'ws')}/api/teams/${t.id}/socket`, ['bac', t.secret]);
  socket = ws;
  ws.onopen = () => {
    retry = 0;
    useBoard.getState().setStatus('online');
    void pull().then(flush);
  };
  ws.onmessage = (e) => {
    try {
      const msg = JSON.parse(String(e.data)) as { type: string; version?: number };
      if ((msg.type === 'changed' || msg.type === 'hello') && (msg.version ?? 0) > (team()?.version ?? 0)) void pull();
    } catch {
      /* "pong" */
    }
  };
  ws.onclose = () => {
    if (socket !== ws) return;
    socket = null;
    const store = useBoard.getState();
    if (!store.team || store.status === 'error') return;
    store.setStatus('offline', 'Forbindelsen til teamet er afbrudt – prøver igen …');
    const delay = Math.min(30_000, 1000 * 2 ** retry++);
    retryTimer = setTimeout(connect, delay);
  };
}

export function disconnect() {
  if (retryTimer) clearTimeout(retryTimer);
  const ws = socket;
  socket = null;
  ws?.close();
}

/** Keeps a team's boards in sync while the app runs (mounted once in App.tsx). */
export function useBoardSync() {
  useEffect(() => {
    if (team()) connect();
    let pendingCount = useBoard.getState().pending.length;
    const unsub = useBoard.subscribe((s, prev) => {
      if (s.team && !prev.team) connect();
      if (!s.team && prev.team) disconnect();
      if (s.team && s.pending.length > pendingCount) scheduleFlush();
      pendingCount = s.pending.length;
    });
    const onFocus = () => team() && void pull().then(flush);
    window.addEventListener('focus', onFocus);
    const keepAlive = setInterval(() => {
      if (!team()) return;
      if (socket?.readyState === WebSocket.OPEN) socket.send('ping');
      void pull().then(flush);
    }, 30_000);
    return () => {
      unsub();
      window.removeEventListener('focus', onFocus);
      clearInterval(keepAlive);
      disconnect();
    };
  }, []);
}
