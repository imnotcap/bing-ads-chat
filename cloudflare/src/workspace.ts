/**
 * The department's shared workspace – one Durable Object for the whole app:
 * - Accounts: people sign in with Microsoft (the app sends the ID token, we check it
 *   in auth.ts). The first person becomes admin; people from ALLOWED_DOMAINS get in
 *   at once, everyone else waits until an admin lets them in.
 * - Shared connections: the Microsoft Advertising keys (developer token, app
 *   registration, refresh token – typed in, see microsoftAds.ts) and the AI keys.
 *   Everyone in the app uses – and may change – the same ones. The Advertising
 *   refresh token never leaves Cloudflare: the app asks for a short-lived access
 *   token instead.
 * - Planning boards: every op in order, with a WebSocket ping to all open apps.
 * - Inventarland: read-only views of Inventarland's API (webshop sales, other ad
 *   channels), fetched with a shared Inventarland user whose password stays here.
 * - Budget and limits per branch (src/ai/branchLimits.ts): only the changed fields.
 * - Playbooks ("træning", src/ai/playbooks.ts): each branch's guidelines as the team
 *   changed them – the defaults live in the app, only the changes are stored here.
 * - Data sources (connectors.ts): Google Ads, Meta, LinkedIn, Daisycon, Search
 *   Console, GA4, Ahrefs, Serper, Magento, Klaviyo and the PIM – credentials kept
 *   here, tested against the real API when saved and again every night.
 */
import { DurableObject } from 'cloudflare:workers';
import { applyOp, boardOfOp, canSeeBoard, dataFor, isBoardData, mayApply, memberIdOf, type BoardData, type BoardOp } from '../../src/board/model';
import { INVENTARLAND_URL, INVENTARLAND_VIEWS, type AdsAccess, type CompanyInfo, type Invitation, type Role, type InventarlandView, type SharedKeyName, type WorkspaceInfo, type WorkspaceUser } from '../../src/workspace/types';
import { LIMIT_BRANCH_IDS, cleanLimits, isLimitBranchId, type StoredLimits } from '../../src/ai/branchLimits';
import { BRANCH_IDS, MAX_SECTION_CHARS, SECTION_IDS, cleanSections, defaultPlaybook, isBranchId, type PlaybookSections, type SectionId, type StoredPlaybook } from '../../src/ai/playbooks';
import { CONNECTOR_IDS, DAISYCON_REDIRECT_URI, connectorDef, isConnectorId, type ConnectorId, type ConnectorSaveResult } from '../../src/workspace/connectors';
import { AuthError, type MicrosoftIdentity } from './auth';
import { AdsKeyError, adsProbe, adsRefresh, mergeAdsKeys, type AdsKeys } from './microsoftAds';
import { clearCampaigns, initAdsCache, readCampaigns, writeCampaigns } from './adsCache';
import { clearProducts, initProductCache, readProducts, writeProducts } from './productCache';
import { allPurchases, billingState, buyPack, initBilling, recordUsage } from './billing';
import type { Directory } from './directory';
import { PLANS, includedUsage, isPlanId } from '../../src/workspace/plans';
import { ConnectorError, daisyconAuthorizeUrl, daisyconExchange, emptyState, mergeInput, pkcePair, runTest, toSummary, type ConnState } from './connectors';

export interface Env {
  ASSETS: { fetch: (req: Request) => Promise<Response> };
  WORKSPACE: DurableObjectNamespace<Workspace>;
  DIRECTORY: DurableObjectNamespace<Directory>;
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

interface AdsConnection extends AdsKeys {
  accountName: string;
  /** How many ad accounts the user behind the keys had when they were saved. */
  accounts?: number;
  connectedBy: string;
  connectedAt: number;
  error: string | null;
}

type Keys = Partial<Record<SharedKeyName, { value: string; by: string; at: number }>>;

/** A read-only Inventarland user the workspace signs in with; its session is kept here too. */
interface InventarlandConnection {
  url: string;
  email: string;
  password: string;
  token: string | null;
  connectedBy: string;
  connectedAt: number;
  error: string | null;
}

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

const pad = (v: number) => `op:${String(v).padStart(12, '0')}`;
const hint = (v: string) => v.slice(-4);

export class Workspace extends DurableObject<Env> {
  private boardMeta: BoardMeta = { version: 0 };
  private boards: BoardData | null = null;
  private adsToken: { value: string; expiresAt: number } | null = null;
  private adsPending: Promise<string> | null = null;
  private invCache = new Map<string, { at: number; body: string }>();

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping', 'pong'));
    void this.ctx.blockConcurrencyWhile(async () => {
      initAdsCache(this.ctx.storage.sql);
      initProductCache(this.ctx.storage.sql);
      initBilling(this.ctx.storage.sql);
      this.boardMeta = (await this.ctx.storage.get<BoardMeta>('boards:meta')) ?? { version: 0 };
      this.boards = (await this.ctx.storage.get<BoardData>('boards:data')) ?? null;
    });
  }

  async fetch(req: Request): Promise<Response> {
    const url = new URL(req.url);
    const path = url.pathname.replace(/^\/api/, '');
    try {
      // From the Worker's weekday schedule only (requests from outside always start with /api).
      if (url.pathname === '/internal/check-connections') return json(await this.checkConnections());
      // From the Worker after the register of companies (directory.ts) has approved the person.
      if (url.pathname === '/internal/sign-in') {
        const body = (await req.json()) as { who: MicrosoftIdentity; role: Role | null; companyId: string };
        return this.signIn(body.who, body.role, body.companyId);
      }
      if (url.pathname === '/internal/knows') {
        const { email } = (await req.json()) as { email: string };
        return json({ known: (await this.users()).some((u) => u.email.toLowerCase() === email.toLowerCase()) });
      }
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
    // Signing in happens in the Worker (worker.ts → directory.ts → /internal/sign-in).

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

    if (path === '/me' && method === 'PATCH') {
      const { name } = (await req.json()) as { name?: string };
      const clean = (name ?? '').trim().replace(/\s+/g, ' ').slice(0, 80);
      if (clean.length < 2) return fail('Skriv dit navn.', 400);
      const next = { ...user, name: clean };
      await this.ctx.storage.put(`user:${user.id}`, next);
      return json({ user: next });
    }

    /* ------------------------------ the company ------------------------------ */
    if (path === '/company' && method === 'GET') return json(await this.company());
    if (path === '/company' && method === 'PATCH') {
      if (user.role !== 'admin') return fail('Kun administratorer kan ændre virksomheden.', 403);
      const body = (await req.json()) as { name?: string; domains?: string[] };
      return this.directory('/update', { name: body.name, domains: body.domains });
    }
    if (path === '/company/plan' && method === 'PUT') {
      if (user.role !== 'admin') return fail('Kun administratorer kan skifte abonnement.', 403);
      const { plan } = (await req.json()) as { plan?: string };
      if (!isPlanId(plan)) return fail('Ukendt abonnement.', 400);
      const people = (await this.users()).filter((u) => u.status === 'active').length;
      if (people > PLANS[plan].maxSeats) return fail(`${PLANS[plan].name} er til ${PLANS[plan].maxSeats} person – fjern medarbejdere først, eller behold Teams.`, 409);
      const res = await this.directory('/update', { plan });
      this.companyCache = null;
      return res;
    }
    if (path === '/team/invites' && (method === 'GET' || method === 'POST' || method === 'DELETE')) {
      if (user.role !== 'admin') return fail('Kun administratorer kan invitere.', 403);
      if (method === 'GET') return this.directory('/invites', {});
      const body = (await req.json()) as { email?: string; role?: Role };
      if (method === 'DELETE') return this.directory('/uninvite', { email: body.email });
      const company = await this.company();
      const people = (await this.users()).filter((u) => u.status === 'active').length;
      const invited = ((await (await this.directory('/invites', {})).json()) as { invites: Invitation[] }).invites.length;
      if (people + invited >= PLANS[company.plan].maxSeats) return fail(`${PLANS[company.plan].name} har plads til ${PLANS[company.plan].maxSeats} – skift til Teams for at invitere flere.`, 409);
      return this.directory('/invite', { email: body.email, role: body.role === 'admin' ? 'admin' : 'member', invitedBy: user.name });
    }

    /* ----------------------- subscription and usage pool ----------------------- */
    if (path.startsWith('/billing')) {
      const company = await this.company();
      const people = (await this.users()).filter((u) => u.status === 'active');
      const state = () => json(billingState(this.ctx.storage.sql, company.plan, people));
      if (path === '/billing' && method === 'GET') return state();
      if (path === '/billing/usage' && method === 'POST') {
        const cost = Number(((await req.json()) as { costUsd?: number }).costUsd);
        if (!Number.isFinite(cost) || cost < 0 || cost > 50) return fail('Ugyldigt forbrug.', 400);
        recordUsage(this.ctx.storage, includedUsage(company.plan, people.length), user.id, cost);
        return state();
      }
      if (path === '/billing/packs' && method === 'POST') {
        if (user.role !== 'admin') return fail('Kun administratorer kan købe ekstra forbrug til virksomheden.', 403);
        buyPack(this.ctx.storage, user.id);
        return state();
      }
      if (path === '/billing/purchases' && method === 'GET') {
        if (user.role !== 'admin') return fail('Kun administratorer kan se købene.', 403);
        const names = new Map((await this.users()).map((u) => [u.id, u.name]));
        return json({ purchases: allPurchases(this.ctx.storage.sql, names) });
      }
    }

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
      // Keys typed in like in Inventarland Dashboard; empty secrets keep the stored ones.
      // Tested before they're saved, so a typo never breaks a working connection.
      const body = (await req.json()) as Partial<Record<keyof AdsKeys, string | null>>;
      const old = await this.ctx.storage.get<AdsConnection>('ads');
      try {
        const keys = mergeAdsKeys(old, body);
        const probe = await adsProbe((input, init) => fetch(input, init), keys);
        const ads: AdsConnection = { ...keys, refreshToken: probe.refreshToken, accountName: probe.name.slice(0, 120), accounts: probe.accounts, connectedBy: user.name, connectedAt: Date.now(), error: null };
        await this.ctx.storage.put('ads', ads);
        this.adsToken = { value: probe.accessToken, expiresAt: Date.now() + probe.expiresIn * 1000 };
        clearCampaigns(this.ctx.storage.sql);
        clearProducts(this.ctx.storage.sql);
      } catch (e) {
        if (e instanceof AdsKeyError) return fail(e.message, 400);
        throw e;
      }
      return json(await this.info());
    }
    if (path === '/workspace/ads' && method === 'DELETE') {
      await this.ctx.storage.delete('ads');
      this.adsToken = null;
      clearCampaigns(this.ctx.storage.sql);
      clearProducts(this.ctx.storage.sql);
      return json(await this.info());
    }
    // The campaigns of the connected account, cached here (adsCache.ts).
    if (path === '/workspace/ads/campaigns' && (method === 'GET' || method === 'PUT')) {
      const ads = await this.ctx.storage.get<AdsConnection>('ads');
      if (!ads) return fail('Microsoft Advertising er ikke forbundet.', 409);
      if (method === 'GET') {
        const accountId = url.searchParams.get('account') ?? '';
        if (ads.accountId && accountId !== ads.accountId) return fail('Kun den forbundne konto kan hentes.', 403);
        return json(readCampaigns(this.ctx.storage.sql, accountId));
      }
      const body = (await req.json()) as { accountId?: string; fetchedAt?: number; campaigns?: unknown };
      const accountId = String(body.accountId ?? '');
      if (ads.accountId && accountId !== ads.accountId) return fail('Kun den forbundne konto kan gemmes.', 403);
      const error = writeCampaigns(this.ctx.storage, accountId, Number(body.fetchedAt), body.campaigns);
      return error ? fail(error, 400) : json({ ok: true });
    }
    // The product overview of the connected account, cached here (productCache.ts).
    if (path === '/workspace/ads/products' && (method === 'GET' || method === 'PUT')) {
      const ads = await this.ctx.storage.get<AdsConnection>('ads');
      if (!ads) return fail('Microsoft Advertising er ikke forbundet.', 409);
      if (method === 'GET') {
        const accountId = url.searchParams.get('account') ?? '';
        if (ads.accountId && accountId !== ads.accountId) return fail('Kun den forbundne konto kan hentes.', 403);
        return json(readProducts(this.ctx.storage.sql, accountId, url.searchParams.get('period') ?? ''));
      }
      const body = (await req.json()) as { accountId?: string; period?: string; fetchedAt?: number; scanned?: number; products?: unknown };
      const accountId = String(body.accountId ?? '');
      if (ads.accountId && accountId !== ads.accountId) return fail('Kun den forbundne konto kan gemmes.', 403);
      const error = writeProducts(this.ctx.storage, accountId, String(body.period ?? ''), Number(body.fetchedAt), Number(body.scanned), body.products);
      return error ? fail(error, 400) : json({ ok: true });
    }
    if (path === '/workspace/ads/token' && method === 'POST') {
      const ads = await this.ctx.storage.get<AdsConnection>('ads');
      if (!ads) return fail('Microsoft Advertising er ikke forbundet. Forbind den under Indstillinger → Forbindelser.', 409);
      const accessToken = await this.adsAccessToken(url.searchParams.has('fresh'));
      const body: AdsAccess = { accessToken, expiresAt: this.adsToken?.expiresAt ?? Date.now() + 600_000, developerToken: ads.developerToken };
      return json(body);
    }

    /* ------------------------------- data sources ------------------------------- */
    if (path === '/connections' && method === 'GET') {
      const rows = await this.ctx.storage.get<ConnState>(CONNECTOR_IDS.map((id) => `conn:${id}`));
      return json({ connectors: CONNECTOR_IDS.map((id) => toSummary(id, rows.get(`conn:${id}`))) });
    }
    const cm = path.match(/^\/connections\/([a-z0-9_]+)(\/test|\/login\/start|\/login\/complete)?$/);
    if (cm && isConnectorId(cm[1]!)) return this.connectionRoute(req, cm[1], cm[2] ?? '', user);

    /* ------------------------- budget and limits per branch ------------------------- */
    if (path === '/limits' && method === 'GET') {
      const rows = await this.ctx.storage.get<StoredLimits>(LIMIT_BRANCH_IDS.map((id) => `limits:${id}`));
      return json({ limits: Object.fromEntries(LIMIT_BRANCH_IDS.map((id) => [id, rows.get(`limits:${id}`) ?? null])) });
    }
    const lm = path.match(/^\/limits\/([a-z0-9_]+)$/);
    if (lm && isLimitBranchId(lm[1]!) && method === 'PUT') {
      // Only the changed fields are sent, and merged here – two people editing different
      // limits at the same time don't overwrite each other.
      const body = (await req.json()) as { values?: unknown };
      const key = `limits:${lm[1]}`;
      const stored = (await this.ctx.storage.get<StoredLimits>(key)) ?? { values: {}, updatedBy: null, updatedAt: null };
      const next: StoredLimits = { values: { ...stored.values, ...cleanLimits(body.values) }, updatedBy: user.name, updatedAt: Date.now() };
      await this.ctx.storage.put(key, next);
      return json({ limits: next });
    }

    /* --------------------------- playbooks ("træning") --------------------------- */
    if (path === '/playbooks' && method === 'GET') {
      const rows = await this.ctx.storage.get<StoredPlaybook>(BRANCH_IDS.map((id) => `playbook:${id}`));
      return json({ playbooks: Object.fromEntries(BRANCH_IDS.map((id) => [id, rows.get(`playbook:${id}`) ?? null])) });
    }
    const pb = path.match(/^\/playbooks\/([a-z0-9_]+)$/);
    if (pb && isBranchId(pb[1]!) && method === 'PUT') {
      // sections: whole sections (null = back to the default); append: one line added to a
      // section (what the chat proposes and the user approves) – appended here, so two
      // people adding at the same time don't overwrite each other.
      const body = (await req.json()) as { sections?: unknown; append?: { section?: string; text?: string } };
      const key = `playbook:${pb[1]}`;
      const stored = (await this.ctx.storage.get<StoredPlaybook>(key)) ?? { sections: {}, updatedBy: null, updatedAt: null };
      const sections: Partial<PlaybookSections> = { ...stored.sections };
      for (const [id, v] of Object.entries(cleanSections(body.sections)) as [SectionId, string | null][]) {
        if (v === null) delete sections[id];
        else sections[id] = v;
      }
      const append = body.append;
      if (append) {
        const id = append.section as SectionId;
        const text = (append.text ?? '').trim().slice(0, 1000);
        if (!SECTION_IDS.includes(id) || !text) return fail('Ugyldig tilføjelse.', 400);
        const current = sections[id] ?? defaultPlaybook(pb[1])[id];
        const line = /^[-*\d]/.test(text) ? text : `- ${text}`;
        sections[id] = `${current.trimEnd()}${current.trim() ? '\n' : ''}${line}`.slice(-MAX_SECTION_CHARS);
      }
      const next: StoredPlaybook = { sections, updatedBy: user.name, updatedAt: Date.now() };
      await this.ctx.storage.put(key, next);
      return json({ playbook: next });
    }

    /* ------------------------------- Inventarland ------------------------------- */
    if (path === '/workspace/inventarland' && method === 'PUT') {
      const body = (await req.json()) as { url?: string; email?: string; password?: string };
      const url = (body.url?.trim() || INVENTARLAND_URL).replace(/\/+$/, '');
      if (!/^https:\/\/[a-z0-9.-]+(:\d+)?$/i.test(url) && !/^http:\/\/localhost(:\d+)?$/.test(url)) return fail('Adressen skal være fx https://inventarland-api….workers.dev', 400);
      const email = body.email?.trim().toLowerCase() ?? '';
      if (!email.includes('@') || !body.password) return fail('Skriv e-mail og adgangskode til Inventarland-brugeren.', 400);
      const conn: InventarlandConnection = { url, email, password: body.password, token: null, connectedBy: user.name, connectedAt: Date.now(), error: null };
      conn.token = await this.inventarlandLogin(conn);
      await this.ctx.storage.put('inventarland', conn);
      this.invCache.clear();
      return json(await this.info());
    }
    if (path === '/workspace/inventarland' && method === 'DELETE') {
      await this.ctx.storage.delete('inventarland');
      this.invCache.clear();
      return json(await this.info());
    }
    const im = path.match(/^\/inventarland\/([a-z]+)$/);
    if (im && method === 'GET') {
      if (!(INVENTARLAND_VIEWS as readonly string[]).includes(im[1]!)) return fail('Ikke fundet.', 404);
      return this.inventarland(im[1] as InventarlandView, url.searchParams);
    }

    /* --------------------------------- boards --------------------------------- */
    if (path.startsWith('/boards/')) return this.boardRoute(req, url, path.slice('/boards/'.length), user);

    return fail('Ikke fundet.', 404);
  }

  /* ------------------------------- accounts ------------------------------- */

  /** The register of companies has approved the person (member, invited or by domain). */
  private async signIn(who: MicrosoftIdentity, role: Role | null, companyId: string): Promise<Response> {
    if (!(await this.ctx.storage.get<string>('companyId'))) await this.ctx.storage.put('companyId', companyId);
    const id = (await sha256(`${who.tid}:${who.oid}`)).slice(0, 24);
    const now = Date.now();
    let user = await this.ctx.storage.get<WorkspaceUser>(`user:${id}`);
    if (user) user = { ...user, email: who.email, lastSeenAt: now, status: 'active' };
    else {
      const first = !(await this.ctx.storage.list({ prefix: 'user:', limit: 1 })).size;
      user = { id, email: who.email, name: who.name, role: first ? 'admin' : (role ?? 'member'), status: 'active', createdAt: now, lastSeenAt: now };
    }
    // The company id leads the token, so the Worker knows which workspace it belongs to.
    const session = `${companyId}.s_${randomToken(40)}`;
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

  private companyCache: { at: number; value: CompanyInfo } | null = null;

  /** This workspace's company (from the register, kept for a minute). */
  private async company(): Promise<CompanyInfo> {
    if (this.companyCache && Date.now() - this.companyCache.at < 60_000) return this.companyCache.value;
    const res = await this.directory('/company', {});
    if (!res.ok) throw new AuthError('Virksomheden findes ikke.', 404);
    const value = (await res.json()) as CompanyInfo;
    this.companyCache = { at: Date.now(), value };
    return value;
  }

  /** A call to the register of companies about this company. */
  private async directory(path: string, body: Record<string, unknown>): Promise<Response> {
    const companyId = (await this.ctx.storage.get<string>('companyId')) ?? 'main';
    const stub = this.env.DIRECTORY.get(this.env.DIRECTORY.idFromName('directory'));
    const res = await stub.fetch(`https://directory${path}?company=${encodeURIComponent(companyId)}`, { method: 'POST', body: JSON.stringify({ ...body, companyId }) });
    if (path === '/update') this.companyCache = null;
    return new Response(res.body, { status: res.status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...CORS } });
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
      await this.directory('/removed', { email: target.email });
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
    const [ads, keys, inv] = await Promise.all([
      this.ctx.storage.get<AdsConnection>('ads'),
      this.ctx.storage.get<Keys>('keys'),
      this.ctx.storage.get<InventarlandConnection>('inventarland'),
    ]);
    const keyInfo = (k?: { value: string; by: string; at: number }) => (k ? { hint: hint(k.value), by: k.by, at: k.at } : null);
    return {
      ads: {
        connected: !!ads,
        accountName: ads?.accountName || null,
        clientId: ads?.clientId ?? null,
        tenant: ads?.tenant ?? 'common',
        hasDeveloperToken: !!ads?.developerToken,
        hasClientSecret: !!ads?.clientSecret,
        hasRefreshToken: !!ads?.refreshToken,
        accountId: ads?.accountId ?? null,
        customerId: ads?.customerId ?? null,
        accounts: ads?.accounts ?? null,
        connectedBy: ads?.connectedBy ?? null,
        connectedAt: ads?.connectedAt ?? null,
        error: ads?.error ?? null,
      },
      keys: { anthropic: keyInfo(keys?.anthropic), google: keyInfo(keys?.google) },
      inventarland: {
        connected: !!inv,
        url: inv?.url ?? INVENTARLAND_URL,
        email: inv?.email ?? null,
        connectedBy: inv?.connectedBy ?? null,
        connectedAt: inv?.connectedAt ?? null,
        error: inv?.error ?? null,
      },
    };
  }

  /** A Microsoft Advertising access token from the shared sign-in (refreshed here). */
  private adsAccessToken(fresh: boolean): Promise<string> {
    if (!fresh && this.adsToken && this.adsToken.expiresAt > Date.now() + 120_000) return Promise.resolve(this.adsToken.value);
    this.adsPending ??= (async () => {
      try {
        const ads = await this.ctx.storage.get<AdsConnection>('ads');
        if (!ads) throw new AuthError('Microsoft Advertising er ikke forbundet.', 409);
        let token: Awaited<ReturnType<typeof adsRefresh>>;
        try {
          token = await adsRefresh((input, init) => fetch(input, init), ads);
        } catch (e) {
          if (!(e instanceof AdsKeyError)) throw e;
          if (e.kind === 'auth') {
            const error = `${e.message} Ret det under Indstillinger → Forbindelser → Microsoft Advertising.`;
            await this.ctx.storage.put('ads', { ...ads, error });
            throw new AuthError(error, 409);
          }
          throw new AuthError(e.message, 502);
        }
        // Microsoft rotates refresh tokens – keep the newest one.
        const current = await this.ctx.storage.get<AdsConnection>('ads');
        if (current && current.refreshToken === ads.refreshToken) {
          await this.ctx.storage.put('ads', { ...current, refreshToken: token.refreshToken, error: null });
        }
        this.adsToken = { value: token.accessToken, expiresAt: Date.now() + token.expiresIn * 1000 };
        return token.accessToken;
      } finally {
        this.adsPending = null;
      }
    })();
    return this.adsPending;
  }

  /* ------------------------------- data sources ------------------------------- */

  private async connectionRoute(req: Request, id: ConnectorId, action: string, user: WorkspaceUser): Promise<Response> {
    const key = `conn:${id}`;
    const def = connectorDef(id);
    const state = (await this.ctx.storage.get<ConnState>(key)) ?? emptyState();
    const reply = async (next: ConnState, ok: boolean, message: string) => {
      await this.ctx.storage.put(key, next);
      const body: ConnectorSaveResult = { connector: toSummary(id, next), ok, message };
      return json(body);
    };
    const test = async (s: ConnState) => {
      const r = await runTest(id, s, (input, init) => fetch(input, init));
      return reply(r.state, r.ok, r.message);
    };

    if (req.method === 'PUT' && !action) {
      const body = (await req.json()) as { config?: Record<string, unknown>; secrets?: Record<string, unknown> };
      let merged: { config: Record<string, string>; secrets: Record<string, string> };
      try {
        merged = mergeInput(def, state, body);
      } catch (e) {
        if (e instanceof ConnectorError) return fail(e.message, 400);
        throw e;
      }
      const next: ConnState = { ...state, ...merged, connectedBy: user.name, connectedAt: state.connectedAt ?? Date.now() };
      // Daisycon: the refresh token comes from the login that follows.
      if (def.oauth && !next.secrets.refreshToken) return reply({ ...next, status: 'needs_login', lastError: null }, false, `Gemt. Klik "Log ind hos ${def.name}" for at afslutte.`);
      return test(next);
    }
    if (req.method === 'POST' && action === '/test') {
      if (state.status === 'not_connected') return fail(`${def.name} er ikke sat op endnu.`, 409);
      return test(state);
    }
    if (req.method === 'DELETE' && !action) {
      await this.ctx.storage.delete([key, `oauth:${id}`]);
      return json({ connector: toSummary(id, undefined), ok: true, message: `${def.name} er afbrudt.` } satisfies ConnectorSaveResult);
    }
    if (req.method === 'POST' && action === '/login/start' && id === 'daisycon') {
      if (!state.secrets.clientId) return fail('Gem først client ID.', 400);
      const { verifier, challenge } = await pkcePair();
      const stateToken = randomToken(24);
      await this.ctx.storage.put(`oauth:${id}`, { verifier, state: stateToken, expires: Date.now() + 10 * 60_000 });
      return json({ url: daisyconAuthorizeUrl(state.secrets.clientId, challenge, stateToken, DAISYCON_REDIRECT_URI) });
    }
    if (req.method === 'POST' && action === '/login/complete' && id === 'daisycon') {
      const { code } = (await req.json()) as { code?: string };
      const pending = await this.ctx.storage.get<{ verifier: string; expires: number }>(`oauth:${id}`);
      await this.ctx.storage.delete(`oauth:${id}`);
      if (!pending || pending.expires < Date.now()) return fail('Login er udløbet eller ikke startet – klik "Log ind hos Daisycon" igen.', 400);
      // Daisycon's page may show the whole redirect URL – take the code from it.
      const raw = (code ?? '').trim();
      const cleaned = raw.includes('code=') ? (new URL(raw, 'https://x').searchParams.get('code') ?? raw) : raw;
      try {
        const refreshToken = await daisyconExchange((input, init) => fetch(input, init), {
          clientId: state.secrets.clientId ?? '',
          clientSecret: state.secrets.clientSecret,
          code: cleaned,
          verifier: pending.verifier,
          redirectUri: DAISYCON_REDIRECT_URI,
        });
        return test({ ...state, secrets: { ...state.secrets, refreshToken }, connectedBy: user.name });
      } catch (e) {
        if (e instanceof ConnectorError) return fail(e.message, 400);
        throw e;
      }
    }
    return fail('Ikke fundet.', 404);
  }

  /** Weekday mornings: tests every saved connection again (keeps refresh tokens alive, shows broken ones). */
  private async checkConnections() {
    const results: Record<string, string> = {};
    // Microsoft Advertising: a refresh keeps the token alive (it lapses after 90 unused days).
    if (await this.ctx.storage.get('ads')) results.microsoft_ads = await this.adsAccessToken(true).then(() => 'ok', (e: unknown) => (e instanceof Error ? e.message : 'fejl'));
    for (const id of CONNECTOR_IDS) {
      const state = await this.ctx.storage.get<ConnState>(`conn:${id}`);
      if (!state || state.status === 'not_connected' || (state.status === 'needs_login' && !state.secrets.refreshToken && connectorDef(id).oauth)) continue;
      if (connectorDef(id).paidTest) continue;
      const r = await runTest(id, state, (input, init) => fetch(input, init));
      await this.ctx.storage.put(`conn:${id}`, r.state);
      results[id] = r.ok ? 'ok' : r.state.status;
    }
    return results;
  }

  /* ------------------------------- Inventarland ------------------------------- */

  /** Signs in to Inventarland's API (POST /api/v1/auth/login) and returns the session token. */
  private async inventarlandLogin(conn: Pick<InventarlandConnection, 'url' | 'email' | 'password'>): Promise<string> {
    let res: Response;
    try {
      res = await fetch(`${conn.url}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: conn.email, password: conn.password, deviceName: 'XavierOS (Cloudflare)' }),
      });
    } catch {
      throw new AuthError('Kunne ikke nå Inventarlands API. Tjek adressen.', 502);
    }
    const body = (await res.json().catch(() => ({}))) as { token?: string; error?: { message?: string } };
    if (!res.ok || !body.token) throw new AuthError(`Inventarland afviste login: ${body.error?.message ?? `HTTP ${res.status}`}`, res.status === 401 || res.status === 429 ? 409 : 502);
    return body.token;
  }

  /** One read-only view from Inventarland (kept 5 minutes – the data is daily totals). */
  private async inventarland(view: InventarlandView, params: URLSearchParams): Promise<Response> {
    const conn = await this.ctx.storage.get<InventarlandConnection>('inventarland');
    if (!conn) return fail('Inventarland er ikke forbundet. Forbind det under Indstillinger → Forbindelser.', 409);
    const query = new URLSearchParams();
    for (const k of ['from', 'to', 'compare', 'granularity', 'provider']) {
      const v = params.get(k);
      if (v) query.set(k, v.slice(0, 40));
    }
    const target = `${conn.url}/api/v1/${view}?${query}`;
    const hit = this.invCache.get(target);
    if (hit && Date.now() - hit.at < 300_000) return new Response(hit.body, { headers: { 'Content-Type': 'application/json', ...CORS } });

    const call = (token: string | null) => fetch(target, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
    let token = conn.token;
    let res = await call(token).catch(() => null);
    if (res?.status === 401) {
      // Sessions there last 30 days (90 at most): sign in again.
      try {
        token = await this.inventarlandLogin(conn);
      } catch (e) {
        const error = e instanceof Error ? e.message : String(e);
        await this.ctx.storage.put('inventarland', { ...conn, token: null, error });
        throw e;
      }
      await this.ctx.storage.put('inventarland', { ...conn, token, error: null });
      res = await call(token).catch(() => null);
    }
    if (!res) return fail('Kunne ikke nå Inventarlands API.', 502);
    const text = await res.text();
    if (!res.ok) {
      let message = `Inventarland svarede ${res.status}.`;
      try {
        message = (JSON.parse(text) as { error?: { message?: string } }).error?.message ?? message;
      } catch {
        /* not JSON */
      }
      return fail(`Inventarland: ${message}`, res.status === 400 ? 400 : 502);
    }
    if (this.invCache.size > 60) this.invCache.clear();
    this.invCache.set(target, { at: Date.now(), body: text });
    return new Response(text, { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...CORS } });
  }

  /* --------------------------------- boards --------------------------------- */

  private async boardRoute(req: Request, url: URL, action: string, user: WorkspaceUser): Promise<Response> {
    const version = this.boardMeta.version;
    // Everyone gets only the boards they may see (private and selected boards stay with their people).
    const memberId = memberIdOf(user.id);
    const mine = (d: BoardData | null) => (d ? dataFor(d, memberId) : null);
    switch (action) {
      case 'socket': {
        if (req.headers.get('Upgrade') !== 'websocket') return fail('Forventede en WebSocket.', 426);
        const pair = new WebSocketPair();
        this.ctx.acceptWebSocket(pair[1], [user.id]);
        pair[1].send(JSON.stringify({ type: 'hello', version }));
        return new Response(null, { status: 101, webSocket: pair[0], headers: { 'Sec-WebSocket-Protocol': 'bac' } });
      }
      case 'state':
        return json({ version, data: mine(this.boards) });
      case 'seed': {
        // The first app to connect brings its boards (e.g. a team shared with invite codes before).
        if (req.method !== 'POST') return fail('Brug POST.', 405);
        if (this.boards) return json({ version, data: mine(this.boards), seeded: false });
        const text = await req.text();
        if (text.length > MAX_DATA) return fail('Tavlerne er for store.', 413);
        const body = JSON.parse(text || '{}') as { data?: unknown };
        if (!isBoardData(body.data)) return fail('Mangler tavlerne.', 400);
        this.boards = body.data;
        this.boardMeta = { version: version + 1 };
        await this.ctx.storage.put({ 'boards:meta': this.boardMeta, 'boards:data': this.boards });
        this.broadcast();
        return json({ version: this.boardMeta.version, data: mine(this.boards), seeded: true });
      }
      case 'changes': {
        const since = Number(url.searchParams.get('since') ?? 0);
        if (!(since >= 0) || since >= version) return json({ version, ops: [] });
        // Too far behind (or the ops are gone): send everything.
        if (version - since > KEEP_OPS || !this.boards) return json({ version, data: mine(this.boards) });
        const rows = await this.ctx.storage.list<BoardOp>({ start: pad(since + 1), end: pad(version + 1) });
        if (rows.size !== version - since) return json({ version, data: mine(this.boards) });
        const all = [...rows.values()];
        // Who can see a board changed: send what this person sees now instead of the ops.
        if (all.some((o) => o.type === 'setBoardAccess')) return json({ version, data: mine(this.boards) });
        const current = this.boards;
        const visible = all.filter((o) => {
          const boardId = boardOfOp(o, current);
          if (!boardId) return true;
          const board = current.boards.find((b) => b.id === boardId) ?? (o.type === 'createBoard' ? o.board : undefined);
          return board ? canSeeBoard(board, memberId) : o.type === 'deleteBoard';
        });
        return json({ version, ops: visible });
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
        for (const sent of ops) {
          if (!sent || typeof sent.id !== 'string' || typeof sent.type !== 'string' || sent.id.length > 80) continue;
          if (accepted.includes(sent.id) || (await this.ctx.storage.get(`seen:${sent.id}`))) {
            duplicates.push(sent.id);
            continue;
          }
          // Changes are made in the sender's name, and only on boards they may see.
          const op = { ...sent, actor: memberId } as BoardOp;
          if (!mayApply(op, data, memberId)) {
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
