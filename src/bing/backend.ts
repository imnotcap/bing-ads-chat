import { adsAccess } from '@/workspace/shared';
import { useConnection } from '@/stores/connection';
import { DemoBackend } from './demo/backend';
import { LiveBackend } from './live';
import type { AdsBackend } from './types';

let cached: { key: string; backend: AdsBackend } | null = null;

/** Microsoft Advertising through the workspace's shared sign-in (tokens come from Cloudflare). */
export function createLiveBackend(): LiveBackend {
  return new LiveBackend({ getAccess: adsAccess });
}

/** The backend for the current connection mode (demo or live). */
export async function getBackend(): Promise<AdsBackend> {
  const { mode, revision } = useConnection.getState();
  const key = `${mode}:${revision}`;
  if (cached?.key === key) return cached.backend;
  const backend = mode === 'demo' ? new DemoBackend() : createLiveBackend();
  cached = { key, backend };
  return backend;
}

export function resetBackendCache() {
  cached = null;
}

/** Account id in use; throws a helpful message when none is selected. */
export function requireAccountId(): string {
  const { accountId } = useConnection.getState();
  if (!accountId) throw new Error('Ingen annoncekonto er valgt. Vælg en konto i menuen nederst til venstre.');
  return accountId;
}
