/**
 * The department's shared workspace – one Durable Object for the whole app:
 * - Accounts: people sign in with Microsoft (the app sends the ID token, we check it
 *   in auth.ts). The first person becomes admin; people from ALLOWED_DOMAINS get in
 *   at once, everyone else waits until an admin lets them in.
 * - Shared connections: the Microsoft Advertising sign-in (refresh token + developer
 *   token) and the AI keys. Everyone in the app uses – and may change – the same ones.
 *   The Advertising refresh token never leaves Cloudflare: the app asks for a
 *   short-lived access token instead.
 * - Planning boards: every op in order, with a WebSocket ping to all open apps.
 */
import { DurableObject } from 'cloudflare:workers';
import { applyOp, isBoardData, type BoardData, type BoardOp } from '../../src/board/model';
import { ADS_SCOPE, type AdsAccess, type SharedKeyName, type WorkspaceInfo, type WorkspaceUser } from '../../src/workspace/types';
import { AuthError, verifyMicrosoftIdToken, type MicrosoftIdentity } from './auth';

export interface Env {
  ASSETS: { fetch: (req: Request) => Promise<Response> };
  WORKSPACE: DurableObjectNamespace<Workspace>;
  /** Comma-separated Application (client) IDs whose Microsoft logins are accepted. */
  MS_CLIENT_ID?: string;
  MS_TENANT?: string;
  /** Comma-separated e-mail domains that get in without approval, e.g. "inventarland.dk". */
  ALLOWED_DOMAINS?: string;
  /** "1" only in local development (.dev.vars): sign in with just an e-mail address. */
  DEV_LOGIN?: string;
}

interface Session {
  userId: string;
  expires: number;
}

interface AdsConnection {
  refreshToken: string;
  developerToken: string;
  clientId: string;
  tenant: string;
  accountName: string;
  connectedBy: string;
  connectedAt: number;
  error: string | null;
}

type Keys = Partial<Record<SharedKeyName, { value: string; by: string; at: number }>>;

interface BoardMeta {
  version: number;
}

const SESSION_DAYS = 90;
const MAX_DATA = 1_500_000; // characters of board JSON
const MAX_BATCH = 200;
const KEEP_OPS = 2000;

export const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
  'Access-Control-Max-Age': '86400',
};

export function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...CORS } });
}

const fail = (error: string, status: number) => json({ error }, status);

function randomToken(bytes: number) {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz234567';
  return Array.from(crypto.getRandomValues(new Uint8Array(bytes)), (b) => alphabet[b & 31]).join('');
}

async function sha256(text: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

const list = (v?: string) =>
  (v ?? '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

const pad = (v: number) => `op:${String(v).padStart(12, '0')}`;
const hint = (v: string) => v.slice(-4);

export class Workspace extends DurableObject<Env> {
  private boardMeta: BoardMeta = { version: 0 };
  private boards: BoardData | null = null;
  private adsToken: { value: string; expiresAt: number } | null = null;
  private adsPending: Promise<string> | null = null;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping', 'pong'));
    void this.ctx.blockConcurrencyWhile(async () => {
      this.boardMeta = (await this.ctx.storage.get<BoardMeta>('boards:meta')) ?? { version: 0 };
      this.boards = (await this.ctx.storage.get<BoardData>('boards:data')) ?? null;
    });
  }

  async fetch(req: Request): Promise<Response> {
    const url = new URL(req.url);
    const path = url.pathname.replace(/^\/api/, '');
    try {
      return await this.route(req, url, path);
    } catch (e) {
      if (e instanceof AuthError) return fail(e.message, e.status);
      if (e instanceof SyntaxError) return fail('Ugyldig forespørgsel.', 400);
      throw e;
    }
  }

  private async route(req: Request, url: URL, path: string): Promise<Response> {
    const method = req.method;

    /* ------------------------------ signing in ------------------------------ */
    if (path === '/auth/session' && method === 'POST') {
      const { idToken } = (await req.json()) as { idToken?: string };
      if (!idToken) return fail('Mangler login-bevis.', 400);
      const clientIds = list(this.env.MS_CLIENT_ID);
      if (!clientIds.length) return fail('Cloudflare-workeren mangler MS_CLIENT_ID.', 500);
      return this.signIn(await verifyMicrosoftIdToken(idToken, { clientIds }));
    }
    if (path === '/auth/dev' && method === 'POST') {
      if (this.env.DEV_LOGIN !== '1') return fail('Ikke fundet.', 404);
      const body = (await req.json()) as { email?: string; name?: string };
      const email = (body.email ?? '').trim().toLowerCase();
      if (!email.includes('@')) return fail('Skriv en e-mailadresse.', 400);
      return this.signIn({ oid: `dev:${email}`, tid: 'dev', email, name: (body.name ?? '').trim() || email.split('@')[0]! });
    }

    // Everything else needs a session (a header, or the WebSocket protocol list).
    const protocols = (req.headers.get('Sec-WebSocket-Protocol') ?? '').split(',').map((p) => p.trim());
    const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '') ?? (protocols[0] === 'bac' ? protocols[1] : undefined);
    const auth = token ? await this.sessionUser(token) : null;
    if (!auth) return fail('Du er ikke logget ind.', 401);
    const { user, hash } = auth;

    if (path === '/me' && method === 'GET') {
      if (Date.now() - user.lastSeenAt > 3600_000) await this.ctx.storage.put(`user:${user.id}`, { ...user, lastSeenAt: Date.now() });
      return json({ user });
    }
    if (path === '/auth/logout' && method === 'POST') {
      await this.ctx.storage.delete(`session:${hash}`);
      return json({ ok: true });
    }
    if (user.status !== 'active') return fail('En administrator skal give dig adgang først.', 403);

    /* --------------------------------- people --------------------------------- */
    if (path === '/users' && method === 'GET') return json({ users: await this.users() });
    const um = path.match(/^\/users\/([a-z0-9]+)$/);
    if (um && (method === 'PATCH' || method === 'DELETE')) {
      if (user.role !== 'admin') return fail('Kun administratorer kan ændre brugere.', 403);
      return this.changeUser(um[1]!, method === 'DELETE' ? null : ((await req.json()) as Partial<Pick<WorkspaceUser, 'role' | 'status'>>));
    }

    /* --------------------------- shared connections --------------------------- */
    if (path === '/workspace' && method === 'GET') return json(await this.info());
    if (path === '/workspace/keys' && method === 'GET') {
      const keys = (await this.ctx.storage.get<Keys>('keys')) ?? {};
      return json({ anthropic: keys.anthropic?.value ?? null, google: keys.google?.value ?? null });
    }
    if (path === '/workspace/keys' && method === 'PUT') {
      const body = (await req.json()) as Partial<Record<SharedKeyName, string | null>>;
      const keys = (await this.ctx.storage.get<Keys>('keys')) ?? {};
      for (const name of ['anthropic', 'google'] as const) {
        if (!(name in body)) continue;
        const v = body[name]?.trim();
        if (v) keys[name] = { value: v.slice(0, 400), by: user.name, at: Date.now() };
        else delete keys[name];
      }
      await this.ctx.storage.put('keys', keys);
      return json(await this.info());
    }
    if (path === '/workspace/ads' && method === 'PUT') {
      const body = (await req.json()) as { refreshToken?: string; developerToken?: string; clientId?: string; tenant?: string; accountName?: string };
      const old = await this.ctx.storage.get<AdsConnection>('ads');
      const developerToken = body.developerToken?.trim() || old?.developerToken || '';
      if (!body.refreshToken || !body.clientId) return fail('Mangler Microsoft-login.', 400);
      if (!developerToken) return fail('Mangler developer token.', 400);
      const ads: AdsConnection = {
        refreshToken: body.refreshToken,
        developerToken,
        clientId: body.clientId.trim(),
        tenant: body.tenant?.trim() || 'common',
        accountName: (body.accountName ?? '').trim().slice(0, 120),
        connectedBy: user.name,
        connectedAt: Date.now(),
        error: null,
      };
      await this.ctx.storage.put('ads', ads);
      this.adsToken = null;
      return json(await this.info());
    }
    if (path === '/workspace/ads' && method === 'PATCH') {
      const body = (await req.json()) as { developerToken?: string };
      const ads = await this.ctx.storage.get<AdsConnection>('ads');
      if (!ads) return fail('Microsoft Advertising er ikke forbundet.', 409);
      if (body.developerToken?.trim()) await this.ctx.storage.put('ads', { ...ads, developerToken: body.developerToken.trim() });
      return json(await this.info());
    }
    if (path === '/workspace/ads' && method === 'DELETE') {
      await this.ctx.storage.delete('ads');
      this.adsToken = null;
      return json(await this.info());
    }
    if (path === '/workspace/ads/token' && method === 'POST') {
      const ads = await this.ctx.storage.get<AdsConnection>('ads');
      if (!ads) return fail('Microsoft Advertising er ikke forbundet. Forbind den under Indstillinger → Forbindelser.', 409);
      const accessToken = await this.adsAccessToken(url.searchParams.has('fresh'));
      const body: AdsAccess = { accessToken, expiresAt: this.adsToken?.expiresAt ?? Date.now() + 600_000, developerToken: ads.developerToken };
      return json(body);
    }

    /* --------------------------------- boards --------------------------------- */
    if (path.startsWith('/boards/')) return this.boardRoute(req, url, path.slice('/boards/'.length), user);

    return fail('Ikke fundet.', 404);
  }

  /* ------------------------------- accounts ------------------------------- */

  private async signIn(who: MicrosoftIdentity): Promise<Response> {
    const id = (await sha256(`${who.tid}:${who.oid}`)).slice(0, 24);
    const now = Date.now();
    let user = await this.ctx.storage.get<WorkspaceUser>(`user:${id}`);
    if (user) user = { ...user, email: who.email, name: who.name, lastSeenAt: now };
    else {
      const first = !(await this.ctx.storage.list({ prefix: 'user:', limit: 1 })).size;
      const domain = who.email.split('@')[1] ?? '';
      const allowed = first || list(this.env.ALLOWED_DOMAINS).includes(domain);
      user = { id, email: who.email, name: who.name, role: first ? 'admin' : 'member', status: allowed ? 'active' : 'pending', createdAt: now, lastSeenAt: now };
    }
    const session = `s_${randomToken(40)}`;
    await this.ctx.storage.put({ [`user:${id}`]: user, [`session:${await sha256(session)}`]: { userId: id, expires: now + SESSION_DAYS * 86400_000 } satisfies Session });
    return json({ session, user });
  }

  private async sessionUser(token: string): Promise<{ user: WorkspaceUser; hash: string } | null> {
    const hash = await sha256(token);
    const s = await this.ctx.storage.get<Session>(`session:${hash}`);
    if (!s) return null;
    const user = await this.ctx.storage.get<WorkspaceUser>(`user:${s.userId}`);
    if (!user || s.expires < Date.now()) {
      await this.ctx.storage.delete(`session:${hash}`);
      return null;
    }
    // Sliding expiry: used sessions stay valid.
    if (s.expires - Date.now() < (SESSION_DAYS - 7) * 86400_000) await this.ctx.storage.put(`session:${hash}`, { ...s, expires: Date.now() + SESSION_DAYS * 86400_000 });
    return { user, hash };
  }

  private async users(): Promise<WorkspaceUser[]> {
    const rows = await this.ctx.storage.list<WorkspaceUser>({ prefix: 'user:' });
    return [...rows.values()].sort((a, b) => a.createdAt - b.createdAt);
  }

  private async changeUser(id: string, patch: Partial<Pick<WorkspaceUser, 'role' | 'status'>> | null): Promise<Response> {
    const target = await this.ctx.storage.get<WorkspaceUser>(`user:${id}`);
    if (!target) return fail('Brugeren findes ikke.', 404);
    const admins = (await this.users()).filter((u) => u.role === 'admin' && u.status === 'active');
    const losesAdmin = target.role === 'admin' && (patch === null || patch.role === 'member' || patch.status === 'pending');
    if (losesAdmin && admins.length <= 1) return fail('Der skal være mindst én administrator.', 409);

    if (patch === null) {
      await this.ctx.storage.delete(`user:${id}`);
      await this.dropSessions(id);
    } else {
      const next: WorkspaceUser = {
        ...target,
        ...(patch.role === 'admin' || patch.role === 'member' ? { role: patch.role } : {}),
        ...(patch.status === 'active' || patch.status === 'pending' ? { status: patch.status } : {}),
      };
      await this.ctx.storage.put(`user:${id}`, next);
      if (next.status !== 'active') await this.dropSessions(id, true);
    }
    return json({ users: await this.users() });
  }

  /** Signs a person out everywhere (or only closes their live connections). */
  private async dropSessions(userId: string, socketsOnly = false) {
    if (!socketsOnly) {
      const sessions = await this.ctx.storage.list<Session>({ prefix: 'session:' });
      const mine = [...sessions].filter(([, s]) => s.userId === userId).map(([k]) => k);
      if (mine.length) await this.ctx.storage.delete(mine);
    }
    for (const ws of this.ctx.getWebSockets(userId)) {
      try {
        ws.close(4003, 'Ingen adgang');
      } catch {
        /* already closed */
      }
    }
  }

  /* --------------------------- shared connections --------------------------- */

  private async info(): Promise<WorkspaceInfo> {
    const [ads, keys] = await Promise.all([this.ctx.storage.get<AdsConnection>('ads'), this.ctx.storage.get<Keys>('keys')]);
    const keyInfo = (k?: { value: string; by: string; at: number }) => (k ? { hint: hint(k.value), by: k.by, at: k.at } : null);
    return {
      ads: {
        connected: !!ads,
        accountName: ads?.accountName || null,
        clientId: ads?.clientId ?? null,
        tenant: ads?.tenant ?? 'common',
        hasDeveloperToken: !!ads?.developerToken,
        connectedBy: ads?.connectedBy ?? null,
        connectedAt: ads?.connectedAt ?? null,
        error: ads?.error ?? null,
      },
      keys: { anthropic: keyInfo(keys?.anthropic), google: keyInfo(keys?.google) },
    };
  }

  /** A Microsoft Advertising access token from the shared sign-in (refreshed here). */
  private adsAccessToken(fresh: boolean): Promise<string> {
    if (!fresh && this.adsToken && this.adsToken.expiresAt > Date.now() + 120_000) return Promise.resolve(this.adsToken.value);
    this.adsPending ??= (async () => {
      try {
        const ads = await this.ctx.storage.get<AdsConnection>('ads');
        if (!ads) throw new AuthError('Microsoft Advertising er ikke forbundet.', 409);
        const res = await fetch(`https://login.microsoftonline.com/${encodeURIComponent(ads.tenant || 'common')}/oauth2/v2.0/token`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ client_id: ads.clientId, grant_type: 'refresh_token', refresh_token: ads.refreshToken, scope: ADS_SCOPE }),
        });
        const body = (await res.json().catch(() => ({}))) as { access_token?: string; refresh_token?: string; expires_in?: number; error?: string; error_description?: string };
        if (!res.ok || !body.access_token) {
          const reason = body.error_description?.split('\r\n')[0] ?? body.error ?? `HTTP ${res.status}`;
          if (body.error === 'invalid_grant') {
            const error = `Microsoft-login for annoncekontoen er udløbet eller tilbagekaldt – forbind igen under Indstillinger → Forbindelser. (${reason})`;
            await this.ctx.storage.put('ads', { ...ads, error });
            throw new AuthError(error, 409);
          }
          throw new AuthError(`Microsoft-login fejlede: ${reason}`, 502);
        }
        // Microsoft rotates refresh tokens – keep the newest one.
        const current = await this.ctx.storage.get<AdsConnection>('ads');
        if (current && current.refreshToken === ads.refreshToken) {
          await this.ctx.storage.put('ads', { ...current, refreshToken: body.refresh_token || current.refreshToken, error: null });
        }
        this.adsToken = { value: body.access_token, expiresAt: Date.now() + (body.expires_in ?? 3600) * 1000 };
        return body.access_token;
      } finally {
        this.adsPending = null;
      }
    })();
    return this.adsPending;
  }

  /* --------------------------------- boards --------------------------------- */

  private async boardRoute(req: Request, url: URL, action: string, user: WorkspaceUser): Promise<Response> {
    const version = this.boardMeta.version;
    switch (action) {
      case 'socket': {
        if (req.headers.get('Upgrade') !== 'websocket') return fail('Forventede en WebSocket.', 426);
        const pair = new WebSocketPair();
        this.ctx.acceptWebSocket(pair[1], [user.id]);
        pair[1].send(JSON.stringify({ type: 'hello', version }));
        return new Response(null, { status: 101, webSocket: pair[0], headers: { 'Sec-WebSocket-Protocol': 'bac' } });
      }
      case 'state':
        return json({ version, data: this.boards });
      case 'seed': {
        // The first app to connect brings its boards (e.g. a team shared with invite codes before).
        if (req.method !== 'POST') return fail('Brug POST.', 405);
        if (this.boards) return json({ version, data: this.boards, seeded: false });
        const text = await req.text();
        if (text.length > MAX_DATA) return fail('Tavlerne er for store.', 413);
        const body = JSON.parse(text || '{}') as { data?: unknown };
        if (!isBoardData(body.data)) return fail('Mangler tavlerne.', 400);
        this.boards = body.data;
        this.boardMeta = { version: version + 1 };
        await this.ctx.storage.put({ 'boards:meta': this.boardMeta, 'boards:data': this.boards });
        this.broadcast();
        return json({ version: this.boardMeta.version, data: this.boards, seeded: true });
      }
      case 'changes': {
        const since = Number(url.searchParams.get('since') ?? 0);
        if (!(since >= 0) || since >= version) return json({ version, ops: [] });
        // Too far behind (or the ops are gone): send everything.
        if (version - since > KEEP_OPS) return json({ version, data: this.boards });
        const rows = await this.ctx.storage.list<BoardOp>({ start: pad(since + 1), end: pad(version + 1) });
        if (rows.size !== version - since) return json({ version, data: this.boards });
        return json({ version, ops: [...rows.values()] });
      }
      case 'ops': {
        if (req.method !== 'POST') return fail('Brug POST.', 405);
        if (!this.boards) return fail('Tavlerne er ikke klar endnu.', 409);
        const body = (await req.json().catch(() => null)) as { ops?: BoardOp[] } | null;
        const ops = Array.isArray(body?.ops) ? body.ops.slice(0, MAX_BATCH) : [];
        const accepted: string[] = [];
        const duplicates: string[] = [];
        let data = this.boards;
        let next = version;
        const writes: Record<string, unknown> = {};
        for (const op of ops) {
          if (!op || typeof op.id !== 'string' || typeof op.type !== 'string' || op.id.length > 80) continue;
          if (accepted.includes(op.id) || (await this.ctx.storage.get(`seen:${op.id}`))) {
            duplicates.push(op.id);
            continue;
          }
          let applied: BoardData;
          try {
            applied = applyOp(data, op);
          } catch {
            continue;
          }
          next += 1;
          data = applied;
          accepted.push(op.id);
          writes[pad(next)] = op;
          writes[`seen:${op.id}`] = next;
        }
        if (!accepted.length) return json({ version, accepted, duplicates });
        if (JSON.stringify(data).length > MAX_DATA) return fail('Tavlerne er blevet for store. Arkivér eller slet gamle kort.', 413);

        this.boards = data;
        this.boardMeta = { version: next };
        await this.ctx.storage.put({ ...writes, 'boards:meta': this.boardMeta, 'boards:data': data });
        // Forget ops (and their ids) that are older than what we keep.
        const old = next - KEEP_OPS;
        if (old > 0) {
          const stale = await this.ctx.storage.list<BoardOp>({ start: pad(Math.max(1, old - MAX_BATCH)), end: pad(old + 1) });
          if (stale.size) await this.ctx.storage.delete([...stale.keys(), ...[...stale.values()].map((o) => `seen:${o.id}`)]);
        }
        this.broadcast();
        return json({ version: next, accepted, duplicates });
      }
    }
    return fail('Ikke fundet.', 404);
  }

  private broadcast() {
    const msg = JSON.stringify({ type: 'changed', version: this.boardMeta.version });
    for (const ws of this.ctx.getWebSockets()) {
      try {
        ws.send(msg);
      } catch {
        /* closed */
      }
    }
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
