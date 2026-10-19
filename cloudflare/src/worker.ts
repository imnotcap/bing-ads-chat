/**
 * XavierOS on Cloudflare Workers (Free plan):
 * - Static files (download page, installer, update feed) from ./public.
 * - /api/…: the department's shared workspace (workspace.ts) – accounts via
 *   Microsoft login, the shared Microsoft Advertising and AI connections, and the
 *   planning boards. One Durable Object holds it all.
 */
import { DurableObject } from 'cloudflare:workers';
import type { PublicConfig } from '../../src/workspace/types';
import { CORS, json, Workspace, type Env } from './workspace';

export { Workspace };

/**
 * Planning boards shared with invite codes before the workspace existed. No longer
 * reachable; kept so the stored data isn't deleted (the apps bring those boards into
 * the workspace the first time they connect).
 */
export class TeamBoard extends DurableObject<Env> {}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(req);
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });

    if (url.pathname === '/api/config') {
      const config: PublicConfig = {
        clientId: (env.MS_CLIENT_ID ?? '').split(',')[0]?.trim() || null,
        tenant: env.MS_TENANT?.trim() || 'common',
        devLogin: env.DEV_LOGIN === '1',
      };
      return json(config);
    }

    const stub = env.WORKSPACE.get(env.WORKSPACE.idFromName('main'));
    const res = await stub.fetch(req);
    if (res.status === 101) return res;
    const headers = new Headers(res.headers);
    for (const [k, v] of Object.entries(CORS)) headers.set(k, v);
    return new Response(res.body, { status: res.status, headers });
  },

  /** Every night: test the data sources again (wrangler.jsonc → triggers). */
  async scheduled(_event: ScheduledController, env: Env, ctx: ExecutionContext) {
    const stub = env.WORKSPACE.get(env.WORKSPACE.idFromName('main'));
    ctx.waitUntil(stub.fetch('https://workspace/internal/check-connections', { method: 'POST' }).then((r) => r.text()));
  },
};
