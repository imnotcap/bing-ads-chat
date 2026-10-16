/**
 * The connections everyone in the app shares, stored in the workspace on Cloudflare:
 * the AI keys and the Microsoft Advertising sign-in. Anyone signed in may change them.
 */
import { BUILTIN_MS } from '@/bing/credentials';
import { DEMO_ACCOUNTS } from '@/bing/demo/seed';
import { LiveBackend } from '@/bing/live';
import { MsApiError, type MsAccess } from '@/bing/client';
import { signInInteractive } from '@/bing/oauth';
import { deleteSecret, getSecret } from '@/lib/platform';
import { queryClient } from '@/lib/queryClient';
import { useAccount } from '@/stores/account';
import { useConnection } from '@/stores/connection';
import { api, loadConfig } from './api';
import { ADS_SCOPE, type InventarlandView, type SharedKeyName, type WorkspaceInfo } from './types';

/* --------------------------------- overview --------------------------------- */

/** Latest overview of the shared connections; also switches between demo and live data. */
export async function refreshWorkspace(): Promise<WorkspaceInfo> {
  const info = await api<WorkspaceInfo>('/workspace');
  applyWorkspace(info);
  return info;
}

function applyWorkspace(info: WorkspaceInfo) {
  useAccount.getState().set({ workspace: info });
  const c = useConnection.getState();
  c.set({ hasAnthropicKey: !!info.keys.anthropic, msUserName: info.ads.accountName });
  if (info.ads.connected && c.mode === 'demo' && !c.preferDemo) goLive();
  else if (!info.ads.connected && c.mode === 'live') goDemo(false);
}

function changed() {
  useConnection.getState().bump();
  void queryClient.invalidateQueries();
}

/** Work on the shared Microsoft Advertising account (accounts load in useBootstrap). */
export function goLive() {
  useConnection.getState().set({ mode: 'live', preferDemo: false });
  changed();
}

/** Work on the demo account. `chosen`: the user asked for it (stay on demo). */
export function goDemo(chosen = true) {
  useConnection.getState().set({ mode: 'demo', accounts: DEMO_ACCOUNTS, accountId: DEMO_ACCOUNTS[0]!.id, ...(chosen ? { preferDemo: true } : {}) });
  changed();
}

/* --------------------------------- AI keys --------------------------------- */

let keys: { at: number; value: Promise<Record<SharedKeyName, string | null>> } | null = null;

/** A shared AI key (kept in memory for 10 minutes). */
export async function sharedKey(name: SharedKeyName): Promise<string | null> {
  if (!keys || Date.now() - keys.at > 600_000) {
    const value = api<Record<SharedKeyName, string | null>>('/workspace/keys');
    keys = { at: Date.now(), value };
    value.catch(() => {
      if (keys?.value === value) keys = null;
    });
  }
  return (await keys.value)[name];
}

export async function saveSharedKey(name: SharedKeyName, value: string | null) {
  keys = null;
  applyWorkspace(await api<WorkspaceInfo>('/workspace/keys', { method: 'PUT', body: JSON.stringify({ [name]: value }) }));
}

/* ---------------------------- Microsoft Advertising ---------------------------- */

/** A Microsoft Advertising access token from the workspace's shared sign-in. */
export function adsAccess(fresh: boolean): Promise<MsAccess> {
  return api<MsAccess>(`/workspace/ads/token${fresh ? '?fresh=1' : ''}`, { method: 'POST' });
}

const ERROR_105 =
  'Microsoft godkendte login, men Microsoft Advertising afviste det (fejl 105). Det skyldes næsten altid én af to ting: ' +
  '1) Der blev logget ind med en anden Microsoft-konto end den, der bruges på ads.microsoft.com – prøv igen og vælg den rigtige konto. ' +
  '2) Developer tokenet er forkert eller ikke aktivt – tjek det på developers.ads.microsoft.com.';

/** Loads who the shared sign-in is and its ad accounts, and switches to live data. */
async function loadAccounts(backend: LiveBackend) {
  const me = await backend.whoAmI().catch((e: unknown) => {
    if (e instanceof MsApiError && (e.status === 401 || /\(105\)/.test(e.message))) throw new Error(ERROR_105);
    throw e;
  });
  const accounts = await backend.listAccounts();
  if (!accounts.length) throw new Error('Login lykkedes, men brugeren har ingen annoncekonti i Microsoft Advertising.');
  return { me, accounts };
}

/**
 * Connects the workspace's Microsoft Advertising account: someone signs in with the
 * Microsoft user that has access on ads.microsoft.com, and everyone in the app uses it.
 */
export async function connectSharedAds(opts: { developerToken?: string; clientId?: string; tenant?: string } = {}): Promise<{ name: string; accounts: number }> {
  const config = await loadConfig();
  const clientId = opts.clientId?.trim() || config.clientId || BUILTIN_MS.clientId;
  const tenant = opts.tenant?.trim() || config.tenant || 'common';
  if (!clientId) throw new Error('Appen mangler et Application (client) ID. Det sættes som MS_CLIENT_ID (se docs/RELEASE.md).');
  let developerToken = opts.developerToken?.trim() || BUILTIN_MS.developerToken;
  if (!developerToken && useAccount.getState().workspace?.ads.connected) developerToken = (await adsAccess(false).catch(() => null))?.developerToken ?? '';
  if (!developerToken) throw new Error('Indtast developer token fra Microsoft Advertising.');

  const tokens = await signInInteractive({ clientId, tenant }, ADS_SCOPE);
  if (!tokens.refresh_token) throw new Error('Microsoft returnerede intet refresh token. Tjek at app-registreringen tillader "offline_access".');
  // Check the sign-in works before everyone starts using it.
  const probe = new LiveBackend({ getAccess: async () => ({ accessToken: tokens.access_token, expiresAt: Date.now() + (tokens.expires_in ?? 3600) * 1000, developerToken }) });
  const { me, accounts } = await loadAccounts(probe);

  applyWorkspace(
    await api<WorkspaceInfo>('/workspace/ads', {
      method: 'PUT',
      body: JSON.stringify({ refreshToken: tokens.refresh_token, developerToken, clientId, tenant, accountName: me.name }),
    }),
  );
  const { accountId, set } = useConnection.getState();
  set({ accounts, accountId: accounts.some((a) => a.id === accountId) ? accountId : accounts[0]!.id, msUserName: me.name });
  goLive();
  return { name: me.name, accounts: accounts.length };
}

export async function setSharedDeveloperToken(developerToken: string) {
  if (!developerToken.trim()) throw new Error('Indtast et developer token.');
  applyWorkspace(await api<WorkspaceInfo>('/workspace/ads', { method: 'PATCH', body: JSON.stringify({ developerToken: developerToken.trim() }) }));
  changed();
}

/** Disconnects Microsoft Advertising for everyone (back to demo data). */
export async function disconnectSharedAds() {
  applyWorkspace(await api<WorkspaceInfo>('/workspace/ads', { method: 'DELETE' }));
}

/* --------------------------------- Inventarland --------------------------------- */

/**
 * Connects Inventarland's API with a read-only Inventarland user (webshop sales and
 * the other ad channels). The password is checked and kept on Cloudflare only.
 */
export async function connectInventarland(opts: { url?: string; email: string; password: string }) {
  applyWorkspace(await api<WorkspaceInfo>('/workspace/inventarland', { method: 'PUT', body: JSON.stringify(opts) }));
}

export async function disconnectInventarland() {
  applyWorkspace(await api<WorkspaceInfo>('/workspace/inventarland', { method: 'DELETE' }));
}

/** One read-only view from Inventarland's API (passed on by the workspace). */
export function inventarland<T>(view: InventarlandView, params: Record<string, string | undefined>): Promise<T> {
  const query = new URLSearchParams(Object.entries(params).filter((e): e is [string, string] => !!e[1]));
  return api<T>(`/inventarland/${view}?${query}`);
}

/* ------------------------------ moving old keys ------------------------------ */

/**
 * Before connections were shared, each PC kept its own Claude/Gemini key and
 * Microsoft Advertising sign-in in Windows Credential Manager. The first time, those
 * move to the workspace (if it doesn't have one yet) and are removed from the PC.
 */
export async function moveLocalConnections() {
  const info = useAccount.getState().workspace;
  if (!info) return;
  const read = (name: Parameters<typeof getSecret>[0]) => getSecret(name).catch(() => null);
  for (const [name, secret] of [
    ['anthropic', 'anthropic_api_key'],
    ['google', 'google_api_key'],
  ] as const) {
    const local = await read(secret);
    if (!local) continue;
    if (!info.keys[name]) await saveSharedKey(name, local);
    await deleteSecret(secret).catch(() => {});
  }

  const c = useConnection.getState();
  const refreshToken = await read('ms_refresh_token');
  let moved = !refreshToken || info.ads.connected;
  if (refreshToken && !info.ads.connected) {
    const developerToken = (await read('ms_developer_token')) || BUILTIN_MS.developerToken;
    const clientId = c.legacyMs?.clientId || BUILTIN_MS.clientId;
    if (developerToken && clientId) {
      applyWorkspace(
        await api<WorkspaceInfo>('/workspace/ads', {
          method: 'PUT',
          body: JSON.stringify({ refreshToken, developerToken, clientId, tenant: c.legacyMs?.tenant || 'common', accountName: c.msUserName ?? '' }),
        }),
      );
      moved = true;
    }
  }
  if (moved) {
    if (refreshToken) for (const name of ['ms_refresh_token', 'ms_developer_token', 'ms_client_secret'] as const) await deleteSecret(name).catch(() => {});
    if (c.legacyMs) c.set({ legacyMs: null });
  }
}
