import { getSecret, setSecret } from '@/lib/platform';
import { effectiveClientId, effectiveDeveloperToken } from './credentials';
import { useConnection } from '@/stores/connection';
import { DemoBackend } from './demo/backend';
import { LiveBackend } from './live';
import type { AdsBackend } from './types';

let cached: { key: string; backend: AdsBackend } | null = null;

/** Builds a LiveBackend from the stored credentials (refresh token, developer token). */
export async function createLiveBackend(clientId: string, tenant: string): Promise<LiveBackend> {
  const developerToken = await effectiveDeveloperToken();
  clientId = effectiveClientId(clientId);
  if (!developerToken) throw new Error('Mangler Microsoft Advertising developer token. Indtast det under Indstillinger → Forbindelser.');
  if (!clientId) throw new Error('Mangler Application (client) ID. Indtast det under Indstillinger → Forbindelser.');
  const clientSecret = await getSecret('ms_client_secret');
  return new LiveBackend({
    oauth: { clientId, tenant, clientSecret },
    developerToken,
    getRefreshToken: () => getSecret('ms_refresh_token'),
    saveRefreshToken: (t) => setSecret('ms_refresh_token', t),
  });
}

/** The backend for the current connection mode (demo or live). */
export async function getBackend(): Promise<AdsBackend> {
  const { mode, msClientId, msTenant, revision } = useConnection.getState();
  const key = `${mode}:${msClientId}:${msTenant}:${revision}`;
  if (cached?.key === key) return cached.backend;
  const backend = mode === 'demo' ? new DemoBackend() : await createLiveBackend(msClientId, msTenant);
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
