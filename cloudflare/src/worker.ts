/**
 * XavierOS on Cloudflare Workers:
 * - Static files from ./public: the download page, the installer and the update feed.
 * - The web app (./public/app, `pnpm build:web`): at / on the app's own domain
 *   (app.xavieros.dk), at /app/ everywhere. /download is the download page on every host.
 * - /__proxy: the web app's way to Microsoft Advertising, which sends no CORS headers.
 * - /api/…: each company's own workspace (workspace.ts) – people, the shared Microsoft
 *   Advertising and AI connections, boards and the AI-usage pool – and the register of
 *   companies (directory.ts), which routes a Microsoft sign-in to the right company.
 *   A session token starts with its company's id ("<company>.s_…"); older tokens
 *   without it belong to Inventarland's workspace ("main").
 */
import { DurableObject } from 'cloudflare:workers';
import { FORWARD_HEADERS, PROXY_ALLOW } from '../../src/lib/msProxy';
import { EXTRA_USAGE_PACK, PLANS } from '../../src/workspace/plans';
import type { NeedsCompany, PublicConfig, SessionResponse } from '../../src/workspace/types';
import { AuthError, verifyMicrosoftIdToken, type MicrosoftIdentity } from './auth';
import { Directory, LEGACY_COMPANY, type Lookup } from './directory';
import { CORS, json, Workspace, type Env } from './workspace';

export { Directory, Workspace };

/**
 * Planning boards shared with invite codes before the workspace existed. No longer
 * reachable; kept so the stored data isn't deleted (the apps bring those boards into
 * the workspace the first time they connect).
 */
export class TeamBoard extends DurableObject<Env> {}

const fail = (error: string, status: number) => json({ error }, status);

const directory = (env: Env) => env.DIRECTORY.get(env.DIRECTORY.idFromName('directory'));
const workspace = (env: Env, companyId: string) => env.WORKSPACE.get(env.WORKSPACE.idFromName(companyId));

/** The company a session token belongs to. */
export function companyOfToken(token: string | undefined): string {
  const m = token ? /^([a-z0-9]{4,32})\.s_/.exec(token) : null;
  return m ? m[1]! : LEGACY_COMPANY;
}

function tokenOf(req: Request): string | undefined {
  const protocols = (req.headers.get('Sec-WebSocket-Protocol') ?? '').split(',').map((p) => p.trim());
  return req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '') ?? (protocols[0] === 'bac' ? protocols[1] : undefined);
}

const list = (v?: string) =>
  (v ?? '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

/** After a Microsoft sign-in: the session in the person's company – or a ticket to create one. */
async function signIn(env: Env, who: MicrosoftIdentity): Promise<Response> {
  const found = (await (await directory(env).fetch('https://directory/lookup', { method: 'POST', body: JSON.stringify({ who }) })).json()) as Lookup;
  if ('ticket' in found) {
    const body: NeedsCompany = { needsCompany: true, email: who.email, name: who.name, ticket: found.ticket };
    return json(body);
  }
  const res = await workspace(env, found.companyId).fetch('https://workspace/internal/sign-in', {
    method: 'POST',
    body: JSON.stringify({ who, role: found.role, companyId: found.companyId }),
  });
  return json((await res.json()) as SessionResponse, res.status);
}

async function identity(req: Request, env: Env, url: URL): Promise<MicrosoftIdentity | Response> {
  if (url.pathname === '/api/auth/dev') {
    if (env.DEV_LOGIN !== '1') return fail('Ikke fundet.', 404);
    const body = (await req.json()) as { email?: string; name?: string };
    const email = (body.email ?? '').trim().toLowerCase();
    if (!email.includes('@')) return fail('Skriv en e-mailadresse.', 400);
    return { oid: `dev:${email}`, tid: 'dev', email, name: (body.name ?? '').trim() || email.split('@')[0]! };
  }
  const { idToken } = (await req.json()) as { idToken?: string };
  if (!idToken) return fail('Mangler login-bevis.', 400);
  const clientIds = list(env.MS_CLIENT_ID);
  if (!clientIds.length) return fail('Cloudflare-workeren mangler MS_CLIENT_ID.', 500);
  return verifyMicrosoftIdToken(idToken, { clientIds });
}

async function api(req: Request, env: Env, url: URL): Promise<Response> {
  const path = url.pathname;
  if (path === '/api/config') {
    const config: PublicConfig = {
      clientId: (env.MS_CLIENT_ID ?? '').split(',')[0]?.trim() || null,
      tenant: env.MS_TENANT?.trim() || 'common',
      devLogin: env.DEV_LOGIN === '1',
    };
    return json(config);
  }
  if (path === '/api/plans') return json({ plans: PLANS, pack: EXTRA_USAGE_PACK });

  if ((path === '/api/auth/session' || path === '/api/auth/dev') && req.method === 'POST') {
    const who = await identity(req, env, url);
    return who instanceof Response ? who : signIn(env, who);
  }

  // A new company: the person behind the ticket becomes its first admin.
  if (path === '/api/signup' && req.method === 'POST') {
    const res = await directory(env).fetch('https://directory/signup', { method: 'POST', body: await req.text() });
    if (!res.ok) return json(await res.json(), res.status);
    const { company, who } = (await res.json()) as { company: { id: string; name: string; plan: string }; who: MicrosoftIdentity };
    const setup = await workspace(env, company.id).fetch('https://workspace/internal/sign-in', {
      method: 'POST',
      body: JSON.stringify({ who, role: 'admin', companyId: company.id, setup: company }),
    });
    return json(await setup.json(), setup.status);
  }

  const res = await workspace(env, companyOfToken(tokenOf(req))).fetch(req);
  if (res.status === 101) return res;
  const headers = new Headers(res.headers);
  for (const [k, v] of Object.entries(CORS)) headers.set(k, v);
  return new Response(res.body, { status: res.status, headers });
}

/**
 * Passes a request from the web app on to an allow-listed Microsoft host – without the
 * browser's Origin, cookies or other headers – and hands back the answer. Only for pages
 * of this site (Sec-Fetch-Site), so it isn't an open relay for other websites.
 */
async function msProxy(req: Request, url: URL): Promise<Response> {
  const site = req.headers.get('Sec-Fetch-Site');
  if (site && site !== 'same-origin') return new Response('Forbidden', { status: 403 });
  const target = url.searchParams.get('url') ?? '';
  if (!PROXY_ALLOW.some((re) => re.test(target))) return new Response('Host not allowed', { status: 403 });
  const headers = new Headers();
  for (const name of FORWARD_HEADERS) {
    const v = req.headers.get(name);
    if (v !== null) headers.set(name, v);
  }
  const body = req.method === 'GET' || req.method === 'HEAD' ? undefined : await req.arrayBuffer();
  try {
    const upstream = await fetch(target, { method: req.method, headers, body });
    return new Response(upstream.body, {
      status: upstream.status,
      headers: { 'Content-Type': upstream.headers.get('Content-Type') ?? 'application/octet-stream', 'Cache-Control': 'no-store' },
    });
  } catch (e) {
    return new Response(String(e), { status: 502 });
  }
}

/** The app's own domain (app.xavieros.dk) – not workers.dev, where / stays the download page. */
const isAppHost = (host: string) => host.startsWith('app.');

function asset(req: Request, env: Env, url: URL, path: string): Promise<Response> {
  return env.ASSETS.fetch(new Request(new URL(path, url.origin), req));
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    if (url.pathname === '/__proxy') return msProxy(req, url);
    if (url.pathname === '/download') return asset(req, env, url, '/');
    // The web app at the root of its own domain (the login pop-up comes back here too).
    if (url.pathname === '/' && isAppHost(url.hostname)) return asset(req, env, url, '/app/');
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(req);
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
    try {
      return await api(req, env, url);
    } catch (e) {
      if (e instanceof AuthError) return fail(e.message, e.status);
      if (e instanceof SyntaxError) return fail('Ugyldig forespørgsel.', 400);
      throw e;
    }
  },

  /** Weekday mornings: test every company's data sources again (wrangler.jsonc → triggers). */
  async scheduled(_event: ScheduledController, env: Env, ctx: ExecutionContext) {
    const { ids } = (await (await directory(env).fetch('https://directory/companies')).json()) as { ids: string[] };
    for (const id of ids) ctx.waitUntil(workspace(env, id).fetch('https://workspace/internal/check-connections', { method: 'POST' }).then((r) => r.text()));
  },
};
