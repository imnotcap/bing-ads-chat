/**
 * Talks to the department's workspace on Cloudflare (cloudflare/src/workspace.ts).
 * Every call carries this PC's session from the Microsoft login.
 */
import { BUILTIN_MS } from '@/bing/credentials';
import { deleteSecret, getSecret, setSecret } from '@/lib/platform';
import { useAccount } from '@/stores/account';
import type { PublicConfig } from './types';

export const SITE_URL = ((import.meta.env.VITE_SITE_URL as string | undefined) || 'https://bing-ads-chat.casperjohansen.workers.dev').replace(/\/$/, '');

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status = 0,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

let session: string | null | undefined;

export async function getSession(): Promise<string | null> {
  if (session === undefined) session = await getSecret('app_session').catch(() => null);
  return session;
}

export async function setSession(value: string | null) {
  session = value;
  if (value) await setSecret('app_session', value);
  else await deleteSecret('app_session').catch(() => {});
}

export async function api<T>(path: string, init: RequestInit & { auth?: boolean } = {}): Promise<T> {
  const { auth = true, ...rest } = init;
  const token = auth ? await getSession() : null;
  if (auth && !token) {
    useAccount.getState().signedOut();
    throw new ApiError('Du er ikke logget ind.', 401);
  }
  let res: Response;
  try {
    res = await fetch(`${SITE_URL}/api${path}`, {
      ...rest,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...rest.headers },
    });
  } catch {
    throw new ApiError('Kunne ikke nå serveren. Tjek internetforbindelsen.');
  }
  const body = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) {
    const message = body.error ?? `Serveren svarede ${res.status}.`;
    if (auth && res.status === 401) {
      await setSession(null);
      useAccount.getState().signedOut(message);
    } else if (auth && res.status === 403 && path !== '/users' && !path.startsWith('/users/')) {
      useAccount.getState().set({ status: 'pending' });
    }
    throw new ApiError(message, res.status);
  }
  return body;
}

/** Opens the workspace's live channel (planning boards). */
export async function openSocket(path: string): Promise<WebSocket | null> {
  const token = await getSession();
  return token ? new WebSocket(`${SITE_URL.replace(/^http/, 'ws')}/api${path}`, ['bac', token]) : null;
}

let config: Promise<PublicConfig> | null = null;

/** The app registration and sign-in options, from the Worker (falls back to what is built in). */
export function loadConfig(): Promise<PublicConfig> {
  config ??= api<PublicConfig>('/config', { auth: false }).catch((e: unknown) => {
    config = null;
    if (BUILTIN_MS.clientId) return { clientId: BUILTIN_MS.clientId, tenant: 'common', devLogin: false };
    throw e;
  });
  return config;
}
