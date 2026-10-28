/**
 * The connections everyone in the app shares, stored in the workspace on Cloudflare:
 * the AI keys and the Microsoft Advertising keys. Anyone signed in may change them.
 */
import { BUILTIN_MS } from '@/bing/credentials';
import { DEMO_ACCOUNTS } from '@/bing/demo/seed';
import type { MsAccess } from '@/bing/client';
import type { CampaignStore } from '@/bing/campaignCache';
import { deleteSecret, getSecret } from '@/lib/platform';
import { queryClient } from '@/lib/queryClient';
import { useAccount } from '@/stores/account';
import { useConnection } from '@/stores/connection';
import { api } from './api';
import { type InventarlandView, type SharedKeyName, type WorkspaceInfo } from './types';

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

/** The campaigns of the connected account, cached in the workspace (bing/campaignCache.ts). */
export const campaignStore: CampaignStore = {
  read: (accountId) => api(`/workspace/ads/campaigns?account=${encodeURIComponent(accountId)}`),
  write: async (accountId, fetchedAt, campaigns) => {
    await api('/workspace/ads/campaigns', { method: 'PUT', body: JSON.stringify({ accountId, fetchedAt, campaigns }) });
  },
};

export const ERROR_105 =
  'Microsoft Advertising afviste nøglerne (fejl 105): developer tokenet er forkert eller ikke aktivt, ' +
  'eller refresh tokenet tilhører en Microsoft-bruger uden adgang til annoncekontiene.';

export interface AdsKeysInput {
  accountId: string;
  customerId: string;
  developerToken: string;
  clientId: string;
  /** Empty keeps the stored one; null removes it. */
  clientSecret: string | null;
  refreshToken: string;
  tenant: string;
}

/**
 * Connects the workspace's Microsoft Advertising with typed-in keys (like Inventarland
 * Dashboard – no sign-in in the app). Cloudflare tests them before saving; empty
 * secret fields keep the stored ones. Everyone in the app then works on the same accounts.
 */
export async function saveSharedAds(input: AdsKeysInput): Promise<{ name: string; accounts: number }> {
  const info = await api<WorkspaceInfo>('/workspace/ads', { method: 'PUT', body: JSON.stringify(input) });
  applyWorkspace(info);
  // The chosen Konto-ID becomes the account the app opens on.
  if (info.ads.accountId) useConnection.getState().set({ accountId: info.ads.accountId });
  goLive();
  return { name: info.ads.accountName ?? 'Microsoft-bruger', accounts: info.ads.accounts ?? 0 };
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

/* ------------------------- Google Ads (audit, read only) ------------------------- */

/**
 * Connects the Google Ads account the audit compares with – read only. Either the way
 * Inventarland Dashboard does it (OAuth client + refresh token) or with a service account's
 * JSON key. The secrets are sent once, checked against Google and kept on Cloudflare only;
 * empty ones keep what is stored. Administrators only.
 */
export async function connectGoogleAudit(opts: {
  method: 'oauth' | 'service_account';
  key?: string;
  clientId?: string;
  clientSecret?: string;
  refreshToken?: string;
  customerId: string;
  loginCustomerId?: string;
}) {
  applyWorkspace(await api<WorkspaceInfo>('/workspace/google', { method: 'PUT', body: JSON.stringify(opts) }));
}

export async function disconnectGoogleAudit() {
  applyWorkspace(await api<WorkspaceInfo>('/workspace/google', { method: 'DELETE' }));
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
