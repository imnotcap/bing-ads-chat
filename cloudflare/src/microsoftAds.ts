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

/** Fills in what was left empty from the stored connection (secrets are never shown again). */
export function mergeAdsKeys(old: Partial<AdsKeys> | undefined, input: Partial<Record<keyof AdsKeys, string | null>>): AdsKeys {
  const pick = (key: keyof AdsKeys) => input[key]?.trim() || old?.[key] || '';
  const keys: AdsKeys = {
    developerToken: pick('developerToken'),
    clientId: pick('clientId'),
    clientSecret: input.clientSecret === null ? '' : pick('clientSecret'),
    refreshToken: pick('refreshToken'),
    tenant: input.tenant?.trim() || 'common',
  };
  const missing = [
    !keys.developerToken && 'Developer token',
    !keys.clientId && 'Application (client) ID',
    !keys.refreshToken && 'Refresh token',
  ].filter(Boolean);
  if (missing.length) throw new AdsKeyError(`Udfyld: ${missing.join(', ')}.`);
  if (!keys.clientSecret) delete keys.clientSecret;
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
  if (body.error === 'invalid_grant') throw new AdsKeyError(`Refresh tokenet er udløbet eller tilbagekaldt – indsæt et nyt. (${reason})`, 'auth');
  if (body.error === 'invalid_client' || body.error === 'unauthorized_client') throw new AdsKeyError(`Microsoft afviste app-registreringen – tjek client ID, client secret og tenant. (${reason})`, 'auth');
  throw new AdsKeyError(`Microsoft afviste refresh tokenet. (${reason})`, res.status === 400 || res.status === 401 ? 'auth' : 'other');
}

async function customer<T>(fetchFn: FetchLike, keys: AdsKeys, accessToken: string, path: string, body: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetchFn(`${CUSTOMER}/${path}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, DeveloperToken: keys.developerToken, 'Content-Type': 'application/json', Accept: 'application/json' },
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

/** Tests the keys: who they sign in as and how many ad accounts that user has. */
export async function adsProbe(fetchFn: FetchLike, keys: AdsKeys) {
  const token = await adsRefresh(fetchFn, keys);
  type Json = Record<string, unknown>;
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
