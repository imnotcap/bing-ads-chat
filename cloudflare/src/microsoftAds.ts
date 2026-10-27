/**
 * The shared Microsoft Advertising connection, set up with keys instead of a sign-in
 * in the app (like Inventarland Dashboard): developer token, the app registration's
 * client ID (+ secret for a "web" registration), a refresh token and the tenant.
 * Saving tests it: refresh → GetUser → the user's ad accounts.
 */
import { ADS_SCOPE } from '../../src/workspace/types';
import type { FetchLike } from './connectors';

const CUSTOMER = 'https://clientcenter.api.bingads.microsoft.com/CustomerManagement/v13';

export interface AdsKeys {
  developerToken: string;
  clientId: string;
  clientSecret?: string;
  refreshToken: string;
  tenant: string;
  /** Like Inventarland: the ad account (Konto-ID) and its customer (Kunde-ID). */
  accountId?: string;
  customerId?: string;
}

export class AdsKeyError extends Error {
  constructor(
    message: string,
    /** 'auth': the stored keys no longer work and someone has to enter new ones. */
    readonly kind: 'auth' | 'other' = 'other',
  ) {
    super(message);
  }
}

/**
 * Fills in what was left empty from the stored connection (secrets are never shown again).
 * Whitespace is removed: none of these values contain any, and a token copied from a
 * wrapped text box often picks up spaces or line breaks.
 */
export function mergeAdsKeys(old: Partial<AdsKeys> | undefined, input: Partial<Record<keyof AdsKeys, string | null>>): AdsKeys {
  const clean = (v: string | null | undefined) => (v ?? '').replace(/\s+/g, '');
  const pick = (key: keyof AdsKeys) => clean(input[key]) || old?.[key] || '';
  // Konto-ID and Kunde-ID are settings, not secrets: what is sent replaces what was stored.
  const setting = (key: 'accountId' | 'customerId') => (key in input ? clean(input[key]) : (old?.[key] ?? ''));
  const keys: AdsKeys = {
    developerToken: pick('developerToken'),
    clientId: pick('clientId'),
    clientSecret: input.clientSecret === null ? '' : pick('clientSecret'),
    refreshToken: pick('refreshToken'),
    tenant: clean(input.tenant) || 'common',
    accountId: setting('accountId'),
    customerId: setting('customerId'),
  };
  const missing = [
    !keys.developerToken && 'Developer token',
    !keys.clientId && 'OAuth client ID',
    !keys.refreshToken && 'OAuth refresh token',
  ].filter(Boolean);
  if (missing.length) throw new AdsKeyError(`Udfyld: ${missing.join(', ')}.`);
  for (const [key, label] of [['accountId', 'Konto-ID'], ['customerId', 'Kunde-ID']] as const) {
    if (keys[key] && !/^\d+$/.test(keys[key]!)) throw new AdsKeyError(`${label} skal være et tal (fx 187654321) – ikke kontonummeret med bogstaver (fx F149XXXX).`);
  }
  if (!!keys.accountId !== !!keys.customerId) throw new AdsKeyError('Udfyld både Konto-ID og Kunde-ID (eller ingen af dem).');
  for (const key of ['clientSecret', 'accountId', 'customerId'] as const) if (!keys[key]) delete keys[key];
  return keys;
}

/** A new access token. Microsoft rotates refresh tokens, so the newest one comes back too. */
export async function adsRefresh(fetchFn: FetchLike, keys: AdsKeys): Promise<{ accessToken: string; refreshToken: string; expiresIn: number }> {
  const form: Record<string, string> = { client_id: keys.clientId, grant_type: 'refresh_token', refresh_token: keys.refreshToken, scope: ADS_SCOPE };
  if (keys.clientSecret) form.client_secret = keys.clientSecret;
  let res: Response;
  try {
    res = await fetchFn(`https://login.microsoftonline.com/${encodeURIComponent(keys.tenant || 'common')}/oauth2/v2.0/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(form),
    });
  } catch {
    throw new AdsKeyError('Microsoft kunne ikke kontaktes – prøv igen om lidt.');
  }
  const body = (await res.json().catch(() => ({}))) as { access_token?: string; refresh_token?: string; expires_in?: number; error?: string; error_description?: string };
  if (res.ok && body.access_token) return { accessToken: body.access_token, refreshToken: body.refresh_token || keys.refreshToken, expiresIn: body.expires_in ?? 3600 };
  const reason = body.error_description?.split(/\r?\n/)[0] ?? body.error ?? `HTTP ${res.status}`;
  if (body.error === 'invalid_grant')
    throw new AdsKeyError(
      `Microsoft afviste refresh tokenet: det er ufuldstændigt, udstedt til et andet OAuth client ID, eller udløbet. Brug præcis samme client ID, client secret og tenant, som tokenet blev hentet med – fx de samme værdier som i Inventarland. (${reason})`,
      'auth',
    );
  if (body.error === 'invalid_client' || body.error === 'unauthorized_client') throw new AdsKeyError(`Microsoft afviste app-registreringen – tjek client ID, client secret og tenant. (${reason})`, 'auth');
  throw new AdsKeyError(`Microsoft afviste refresh tokenet. (${reason})`, res.status === 400 || res.status === 401 ? 'auth' : 'other');
}

async function customer<T>(fetchFn: FetchLike, keys: AdsKeys, accessToken: string, path: string, body: unknown, account = false): Promise<T> {
  const headers: Record<string, string> = { Authorization: `Bearer ${accessToken}`, DeveloperToken: keys.developerToken, 'Content-Type': 'application/json', Accept: 'application/json' };
  // Like Inventarland: the account's own headers when the test asks for that account.
  if (account && keys.accountId && keys.customerId) Object.assign(headers, { CustomerId: keys.customerId, CustomerAccountId: keys.accountId });
  let res: Response;
  try {
    res = await fetchFn(`${CUSTOMER}/${path}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
  } catch {
    throw new AdsKeyError('Microsoft Advertising kunne ikke kontaktes – prøv igen om lidt.');
  }
  const text = await res.text();
  if (res.ok) return JSON.parse(text || '{}') as T;
  let errors: { Code?: number; Message?: string }[] = [];
  try {
    const j = JSON.parse(text) as { Errors?: typeof errors; OperationErrors?: typeof errors };
    errors = [...(j.Errors ?? []), ...(j.OperationErrors ?? [])];
  } catch {
    /* not JSON */
  }
  const detail = errors.map((e) => `${e.Message ?? 'Fejl'}${e.Code ? ` (${e.Code})` : ''}`).join(' · ') || `HTTP ${res.status}`;
  if (errors.some((e) => e.Code === 105 || e.Code === 106) || res.status === 401)
    throw new AdsKeyError(
      `Microsoft Advertising afviste nøglerne: developer tokenet er forkert, eller refresh tokenet tilhører en Microsoft-bruger uden adgang til annoncekontiene. (${detail})`,
      'auth',
    );
  throw new AdsKeyError(`Microsoft Advertising svarede med en fejl. (${detail})`);
}

/**
 * Every ad account the keys can see, with the customer it belongs to – the CustomerId a
 * report for that account has to be sent with. The same two calls as the test below.
 */
export async function adsAccountCustomers(fetchFn: FetchLike, keys: AdsKeys, accessToken: string): Promise<Map<string, string>> {
  const me = await customer<{ User?: { Id?: number | string } }>(fetchFn, keys, accessToken, 'User/Query', { UserId: null });
  const res = await customer<{ Accounts?: Record<string, unknown>[] }>(fetchFn, keys, accessToken, 'Accounts/Search', {
    Predicates: [{ Field: 'UserId', Operator: 'Equals', Value: String(me.User?.Id ?? '') }],
    Ordering: null,
    PageInfo: { Index: 0, Size: 1000 },
    ReturnAdditionalFields: null,
  });
  const out = new Map<string, string>();
  for (const a of res.Accounts ?? []) {
    const id = String(a.Id ?? '');
    const parent = String(a.ParentCustomerId ?? '');
    if (/^\d+$/.test(id) && /^\d+$/.test(parent)) out.set(id, parent);
  }
  return out;
}

/**
 * Tests the keys. With Konto-ID and Kunde-ID it reads that account (Account/Query – the
 * same test as Inventarland Dashboard); without, who the keys sign in as and their accounts.
 */
export async function adsProbe(fetchFn: FetchLike, keys: AdsKeys) {
  const token = await adsRefresh(fetchFn, keys);
  type Json = Record<string, unknown>;
  if (keys.accountId && keys.customerId) {
    const res = await customer<{ Account?: { Name?: string; CurrencyCode?: string } }>(fetchFn, keys, token.accessToken, 'Account/Query', { AccountId: Number(keys.accountId) }, true);
    if (!res.Account) throw new AdsKeyError(`Nøglerne virker, men konto ${keys.accountId} kunne ikke læses – tjek Konto-ID og Kunde-ID.`);
    const name = `${res.Account.Name ?? 'Microsoft Ads-konto'}${res.Account.CurrencyCode ? ` (${res.Account.CurrencyCode})` : ''}`;
    return { ...token, name, accounts: 1 };
  }
  const me = await customer<{ User?: { Id?: number | string; UserName?: string; Name?: { FirstName?: string; LastName?: string } } }>(fetchFn, keys, token.accessToken, 'User/Query', { UserId: null });
  const user = me.User ?? {};
  const name = [user.Name?.FirstName, user.Name?.LastName].filter(Boolean).join(' ') || user.UserName || 'Microsoft-bruger';
  const res = await customer<{ Accounts?: Json[] }>(fetchFn, keys, token.accessToken, 'Accounts/Search', {
    Predicates: [{ Field: 'UserId', Operator: 'Equals', Value: String(user.Id ?? '') }],
    Ordering: null,
    PageInfo: { Index: 0, Size: 1000 },
    ReturnAdditionalFields: null,
  });
  const accounts = res.Accounts?.length ?? 0;
  if (!accounts) throw new AdsKeyError(`Nøglerne virker, men ${name} har ingen annoncekonti i Microsoft Advertising.`);
  return { ...token, name, accounts };
}
