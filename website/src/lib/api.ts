/**
 * The website talks to the same Worker API as the app (/api on this origin). The
 * session from signing in here is kept in this browser only.
 */
import { useSyncExternalStore } from 'react';
import type { WorkspaceUser } from '@/workspace/types';

const KEY = 'xos_site_session';

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status = 0,
  ) {
    super(message);
  }
}

function read(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

let session = read();
const listeners = new Set<() => void>();

export function setSession(value: string | null) {
  session = value;
  try {
    if (value) localStorage.setItem(KEY, value);
    else localStorage.removeItem(KEY);
  } catch {
    // Private window: signed in until the tab closes.
  }
  listeners.forEach((l) => l());
}

export const hasSession = () => !!session;

export function useSignedIn(): boolean {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => !!session,
  );
}

export async function api<T>(path: string, init: RequestInit & { auth?: boolean } = {}): Promise<T> {
  const { auth = true, ...rest } = init;
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      ...rest,
      headers: { 'Content-Type': 'application/json', ...(auth && session ? { Authorization: `Bearer ${session}` } : {}), ...rest.headers },
    });
  } catch {
    throw new ApiError('Kunne ikke nå serveren. Tjek internetforbindelsen.');
  }
  const body = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) {
    if (auth && res.status === 401) setSession(null);
    throw new ApiError(body.error ?? `Serveren svarede ${res.status}.`, res.status);
  }
  return body;
}

export const getMe = () => api<{ user: WorkspaceUser }>('/me').then((r) => r.user);

export async function signOut() {
  await api('/auth/logout', { method: 'POST' }).catch(() => {});
  setSession(null);
}
