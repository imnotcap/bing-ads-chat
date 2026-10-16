/**
 * Bing Ads Chat on Cloudflare Workers (Free plan):
 * - Static files (download page, installer, update feed) from ./public.
 * - /api/teams/…: shared planning boards. One Durable Object per team keeps the
 *   boards and the latest changes (ops) in its own SQLite storage, puts every op in
 *   order and tells the team's open apps over WebSockets when something changed.
 *
 * A team is reached with its id and secret (the invite code). Only a SHA-256 hash
 * of the secret is stored.
 */
import { DurableObject } from 'cloudflare:workers';
import { applyOp, isBoardData, type BoardData, type BoardOp } from '../../src/board/model';

interface Env {
  ASSETS: { fetch: (req: Request) => Promise<Response> };
  TEAMS: DurableObjectNamespace<TeamBoard>;
}

interface Meta {
  hash: string;
  name: string;
  version: number;
  createdAt: number;
}

const MAX_DATA = 1_500_000; // characters of JSON per team
const MAX_BATCH = 200;
const KEEP_OPS = 2000;
const TEAM_ID = /^[a-z0-9]{8,40}$/;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
  'Access-Control-Max-Age': '86400',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...CORS } });
}

function randomId(bytes: number) {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz234567';
  const buf = crypto.getRandomValues(new Uint8Array(bytes));
  return Array.from(buf, (b) => alphabet[b & 31]).join('');
}

async function sha256(text: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

const pad = (v: number) => `op:${String(v).padStart(12, '0')}`;

export class TeamBoard extends DurableObject<Env> {
  private meta: Meta | null = null;
  private data: BoardData | null = null;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping', 'pong'));
    void this.ctx.blockConcurrencyWhile(async () => {
      this.meta = (await this.ctx.storage.get<Meta>('meta')) ?? null;
      this.data = (await this.ctx.storage.get<BoardData>('data')) ?? null;
    });
  }

  async fetch(req: Request): Promise<Response> {
    const url = new URL(req.url);
    const action = url.pathname.split('/').pop();

    if (action === 'init') {
      if (this.meta) return json({ error: 'Teamet findes allerede.' }, 409);
      const body = (await req.json()) as { hash: string; name: string; data: BoardData };
      this.meta = { hash: body.hash, name: body.name, version: 0, createdAt: Date.now() };
      this.data = body.data;
      await this.ctx.storage.put({ meta: this.meta, data: this.data });
      return json({ version: 0 });
    }

    // Everything else needs the team's secret (a header, or the WebSocket protocol list).
    const protocols = (req.headers.get('Sec-WebSocket-Protocol') ?? '').split(',').map((p) => p.trim());
    const secret = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '') ?? (protocols[0] === 'bac' ? protocols[1] : undefined);
    if (!this.meta || !this.data) return json({ error: 'Teamet findes ikke.' }, 404);
    if (!secret || (await sha256(secret)) !== this.meta.hash) return json({ error: 'Forkert invitationskode.' }, 401);

    switch (action) {
      case 'socket': {
        if (req.headers.get('Upgrade') !== 'websocket') return json({ error: 'Forventede en WebSocket.' }, 426);
        const pair = new WebSocketPair();
        this.ctx.acceptWebSocket(pair[1]);
        pair[1].send(JSON.stringify({ type: 'hello', version: this.meta.version }));
        return new Response(null, { status: 101, webSocket: pair[0], headers: { 'Sec-WebSocket-Protocol': 'bac' } });
      }
      case 'state':
        return json({ name: this.meta.name, version: this.meta.version, data: this.data });
      case 'changes': {
        const since = Number(url.searchParams.get('since') ?? 0);
        const version = this.meta.version;
        if (!(since >= 0) || since >= version) return json({ version, ops: [] });
        // Too far behind (or the ops are gone): send everything.
        if (version - since > KEEP_OPS) return json({ version, data: this.data });
        const rows = await this.ctx.storage.list<BoardOp>({ start: pad(since + 1), end: pad(version + 1) });
        if (rows.size !== version - since) return json({ version, data: this.data });
        return json({ version, ops: [...rows.values()] });
      }
      case 'ops': {
        if (req.method !== 'POST') return json({ error: 'Brug POST.' }, 405);
        const body = (await req.json().catch(() => null)) as { ops?: BoardOp[] } | null;
        const ops = Array.isArray(body?.ops) ? body.ops.slice(0, MAX_BATCH) : [];
        const accepted: string[] = [];
        const duplicates: string[] = [];
        let data = this.data;
        let version = this.meta.version;
        const writes: Record<string, unknown> = {};
        for (const op of ops) {
          if (!op || typeof op.id !== 'string' || typeof op.type !== 'string' || op.id.length > 80) continue;
          if (accepted.includes(op.id) || (await this.ctx.storage.get(`seen:${op.id}`))) {
            duplicates.push(op.id);
            continue;
          }
          let next: BoardData;
          try {
            next = applyOp(data, op);
          } catch {
            continue;
          }
          version += 1;
          data = next;
          accepted.push(op.id);
          writes[pad(version)] = op;
          writes[`seen:${op.id}`] = version;
        }
        if (!accepted.length) return json({ version: this.meta.version, accepted, duplicates });
        if (JSON.stringify(data).length > MAX_DATA) return json({ error: 'Tavlerne er blevet for store. Arkivér eller slet gamle kort.' }, 413);

        this.data = data;
        this.meta = { ...this.meta, version };
        await this.ctx.storage.put({ ...writes, meta: this.meta, data });
        // Forget ops (and their ids) that are older than what we keep.
        const old = version - KEEP_OPS;
        if (old > 0) {
          const stale = await this.ctx.storage.list<BoardOp>({ start: pad(Math.max(1, old - MAX_BATCH)), end: pad(old + 1) });
          if (stale.size) await this.ctx.storage.delete([...stale.keys(), ...[...stale.values()].map((o) => `seen:${o.id}`)]);
        }
        const msg = JSON.stringify({ type: 'changed', version });
        for (const ws of this.ctx.getWebSockets()) {
          try {
            ws.send(msg);
          } catch {
            /* closed */
          }
        }
        return json({ version, accepted, duplicates });
      }
    }
    return json({ error: 'Ukendt handling.' }, 404);
  }

  webSocketMessage(ws: WebSocket, message: string | ArrayBuffer) {
    if (message === 'ping') ws.send('pong');
  }

  webSocketClose(ws: WebSocket, code: number) {
    try {
      ws.close(code === 1005 ? 1000 : code, 'Lukket');
    } catch {
      /* already closed */
    }
  }
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(req);
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });

    // POST /api/teams – a new team with the boards from the app that creates it.
    if (url.pathname === '/api/teams' && req.method === 'POST') {
      const text = await req.text();
      if (text.length > MAX_DATA) return json({ error: 'Tavlerne er for store til at blive delt.' }, 413);
      const body = JSON.parse(text || '{}') as { name?: string; data?: unknown };
      if (!isBoardData(body.data)) return json({ error: 'Mangler tavlerne.' }, 400);
      const teamId = randomId(16);
      const secret = randomId(32);
      const stub = env.TEAMS.get(env.TEAMS.idFromName(teamId));
      const res = await stub.fetch('https://team/init', {
        method: 'POST',
        body: JSON.stringify({ hash: await sha256(secret), name: String(body.name ?? 'Team').slice(0, 80), data: body.data }),
      });
      if (!res.ok) return json({ error: 'Kunne ikke oprette teamet.' }, 500);
      return json({ teamId, secret, version: 0 });
    }

    // /api/teams/<id>/(state|changes|ops|socket)
    const m = url.pathname.match(/^\/api\/teams\/([^/]+)\/(state|changes|ops|socket)$/);
    if (!m || !TEAM_ID.test(m[1]!)) return json({ error: 'Ikke fundet.' }, 404);
    const stub = env.TEAMS.get(env.TEAMS.idFromName(m[1]!));
    const res = await stub.fetch(new Request(`https://team/${m[2]}${url.search}`, req));
    if (res.status === 101) return res;
    const headers = new Headers(res.headers);
    for (const [k, v] of Object.entries(CORS)) headers.set(k, v);
    return new Response(res.body, { status: res.status, headers });
  },
};
