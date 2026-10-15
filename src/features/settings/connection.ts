/** Connecting and disconnecting Claude and Microsoft Advertising. */
import Anthropic from '@anthropic-ai/sdk';
import { createLiveBackend, resetBackendCache } from '@/bing/backend';
import { effectiveClientId, effectiveDeveloperToken } from '@/bing/credentials';
import { signInInteractive } from '@/bing/oauth';
import { DEMO_ACCOUNTS } from '@/bing/demo/seed';
import { deleteSecret, getSecret, setSecret } from '@/lib/platform';
import { queryClient } from '@/lib/queryClient';
import { friendlyError } from '@/ai/agent';
import { useConnection } from '@/stores/connection';
import { useSettings } from '@/stores/settings';

export async function saveAnthropicKey(key: string): Promise<void> {
  const k = key.trim();
  if (!k.startsWith('sk-ant-')) throw new Error('Nøglen ser forkert ud – en Claude API-nøgle starter med "sk-ant-".');
  await testAnthropicKey(k);
  await setSecret('anthropic_api_key', k);
  useConnection.getState().set({ hasAnthropicKey: true });
}

export async function testAnthropicKey(key?: string): Promise<string> {
  const apiKey = key ?? (await getSecret('anthropic_api_key'));
  if (!apiKey) throw new Error('Der er ingen nøgle at teste.');
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true, maxRetries: 1 });
  try {
    const model = await client.models.retrieve(useSettings.getState().ai.model);
    return model.display_name;
  } catch (e) {
    throw new Error(friendlyError(e));
  }
}

export async function removeAnthropicKey() {
  await deleteSecret('anthropic_api_key');
  useConnection.getState().set({ hasAnthropicKey: false });
}

export async function saveMicrosoftSettings(opts: { developerToken?: string; clientId: string; tenant: string; clientSecret?: string }) {
  if (opts.developerToken !== undefined) {
    if (opts.developerToken.trim()) await setSecret('ms_developer_token', opts.developerToken.trim());
    else await deleteSecret('ms_developer_token');
  }
  if (opts.clientSecret !== undefined) {
    if (opts.clientSecret.trim()) await setSecret('ms_client_secret', opts.clientSecret.trim());
    else await deleteSecret('ms_client_secret');
  }
  const has = !!(await effectiveDeveloperToken());
  useConnection.getState().set({ msClientId: opts.clientId.trim(), msTenant: opts.tenant.trim() || 'common', hasDeveloperToken: has });
}

/** Loads user + accounts with the stored credentials and switches to live mode. */
async function activateLive() {
  const { msClientId, msTenant } = useConnection.getState();
  resetBackendCache();
  const backend = await createLiveBackend(msClientId, msTenant);
  const me = await backend.whoAmI();
  const accounts = await backend.listAccounts();
  if (!accounts.length) throw new Error('Login lykkedes, men brugeren har ingen annoncekonti i Microsoft Advertising.');
  const { accountId, set, bump } = useConnection.getState();
  set({
    mode: 'live',
    msUserName: me.name,
    accounts,
    accountId: accounts.some((a) => a.id === accountId) ? accountId : accounts[0]!.id,
    hasMsRefreshToken: true,
  });
  bump();
  void queryClient.invalidateQueries();
  return { name: me.name, accounts: accounts.length };
}

export async function signInMicrosoft(): Promise<{ name: string; accounts: number }> {
  const { msTenant } = useConnection.getState();
  const clientId = effectiveClientId();
  if (!clientId) throw new Error('Indtast først Application (client) ID.');
  if (!(await effectiveDeveloperToken())) throw new Error('Indtast først dit developer token.');
  const clientSecret = await getSecret('ms_client_secret');
  const tokens = await signInInteractive({ clientId, tenant: msTenant || 'common', clientSecret });
  if (!tokens.refresh_token) throw new Error('Microsoft returnerede intet refresh token. Tjek at app-registreringen tillader "offline_access".');
  await setSecret('ms_refresh_token', tokens.refresh_token);
  return activateLive();
}

export async function applyManualRefreshToken(token: string) {
  if (!token.trim()) throw new Error('Indsæt et refresh token.');
  await setSecret('ms_refresh_token', token.trim());
  return activateLive();
}

export async function reconnectLive() {
  return activateLive();
}

export async function disconnectMicrosoft() {
  await deleteSecret('ms_refresh_token');
  resetBackendCache();
  useConnection.getState().set({ mode: 'demo', msUserName: null, accounts: DEMO_ACCOUNTS, accountId: DEMO_ACCOUNTS[0]!.id, hasMsRefreshToken: false });
  useConnection.getState().bump();
  void queryClient.invalidateQueries();
}

export function switchToDemo() {
  resetBackendCache();
  useConnection.getState().set({ mode: 'demo', accounts: DEMO_ACCOUNTS, accountId: DEMO_ACCOUNTS[0]!.id });
  useConnection.getState().bump();
  void queryClient.invalidateQueries();
}
