/**
 * Connection tests for the department's data sources (src/workspace/connectors.ts):
 * each one makes a small, read-only call to the real API and returns a label for
 * the account it reached. Secrets only live here, in the Worker.
 *
 * Based on Inventarland Dashboard's providers (apps/worker/src/providers), which
 * already talk to Google Ads, Meta, Daisycon, Magento and GA4 for Inventarland.
 */
import { connectorDef, type ConnectorDef, type ConnectorId, type ConnectorStatus, type ConnectorSummary } from '../../src/workspace/connectors';

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

/** One stored connection (Durable Object storage key `conn:<id>`). */
export interface ConnState {
  config: Record<string, string>;
  secrets: Record<string, string>;
  status: ConnectorStatus;
  accountLabel: string | null;
  lastError: string | null;
  connectedBy: string | null;
  connectedAt: number | null;
  checkedAt: number | null;
}

export interface TestContext {
  config: Record<string, string>;
  secrets: Record<string, string>;
  fetch: FetchLike;
  /** Keeps rotated credentials (refresh tokens). */
  save: (patch: Record<string, string>) => Promise<void>;
  now?: number;
}

export class ConnectorError extends Error {
  constructor(
    message: string,
    /** 'auth': the login stopped working – needs new credentials or a new login. */
    readonly kind: 'auth' | 'config' | 'api' = 'api',
  ) {
    super(message);
  }
}

export const emptyState = (): ConnState => ({ config: {}, secrets: {}, status: 'not_connected', accountLabel: null, lastError: null, connectedBy: null, connectedAt: null, checkedAt: null });

export function toSummary(id: ConnectorId, s: ConnState | undefined): ConnectorSummary {
  const state = s ?? emptyState();
  return {
    id,
    status: state.status,
    accountLabel: state.accountLabel,
    config: state.config,
    secretsSet: Object.keys(state.secrets).filter((k) => state.secrets[k]),
    lastError: state.lastError,
    connectedBy: state.connectedBy,
    connectedAt: state.connectedAt,
    checkedAt: state.checkedAt,
  };
}

/**
 * New values on top of the stored ones: empty config fields are cleared, secrets are
 * only replaced when a new value is given. Throws when a required field is missing.
 */
export function mergeInput(def: ConnectorDef, state: ConnState, input: { config?: Record<string, unknown>; secrets?: Record<string, unknown> }) {
  const config: Record<string, string> = {};
  const secrets = { ...state.secrets };
  for (const f of def.fields) {
    const raw = (f.secret ? input.secrets : input.config)?.[f.key];
    const value = typeof raw === 'string' ? raw.trim().slice(0, 20_000) : undefined;
    if (f.secret) {
      if (value) secrets[f.key] = value;
    } else if (value) config[f.key] = value;
    else if (value === undefined && state.config[f.key]) config[f.key] = state.config[f.key]!;
  }
  const missing = def.fields.filter((f) => f.required && !(f.secret ? secrets[f.key] : config[f.key])).map((f) => f.label);
  if (missing.length) throw new ConnectorError(`Udfyld: ${missing.join(', ')}.`, 'config');
  return { config, secrets };
}

/* --------------------------------- helpers --------------------------------- */

const need = (values: Record<string, string>, key: string, name: string) => {
  const v = values[key]?.trim();
  if (!v) throw new ConnectorError(`${name}: "${key}" mangler.`, 'config');
  return v;
};

async function call<T>(ctx: TestContext, name: string, url: string, init: RequestInit = {}): Promise<T> {
  let res: Response;
  try {
    res = await ctx.fetch(url, { ...init, headers: { Accept: 'application/json', ...init.headers }, signal: AbortSignal.timeout(25_000) });
  } catch {
    throw new ConnectorError(`${name} kunne ikke kontaktes. Tjek adressen.`);
  }
  const text = await res.text();
  if (!res.ok) throw httpError(name, res.status, text);
  try {
    return (text ? JSON.parse(text) : {}) as T;
  } catch {
    throw new ConnectorError(`${name} svarede ikke med JSON. Tjek adressen.`, 'config');
  }
}

/** The API's own (non-secret) error text in a short Danish message. */
export function httpError(name: string, status: number, body: string): ConnectorError {
  let detail = '';
  try {
    const j = JSON.parse(body) as Record<string, unknown>;
    const e = j.error as Record<string, unknown> | string | undefined;
    const errors = j.errors as { detail?: string; message?: string }[] | undefined;
    detail = String(
      (typeof e === 'object' && e ? (e.message ?? e.error_description ?? e.status) : undefined) ??
        j.error_description ??
        (typeof e === 'string' ? e : undefined) ??
        errors?.[0]?.detail ??
        errors?.[0]?.message ??
        j.message ??
        '',
    ).slice(0, 200);
  } catch {
    /* not JSON */
  }
  const suffix = detail ? ` (${detail})` : ` (HTTP ${status})`;
  if (status === 401 || /invalid_grant|expired/i.test(detail)) return new ConnectorError(`${name} afviste login – nøglen er forkert eller udløbet${suffix}.`, 'auth');
  if (status === 403) return new ConnectorError(`${name} afviste adgangen – tjek rettighederne${suffix}.`, 'auth');
  if (status === 404) return new ConnectorError(`${name}: kontoen eller adressen findes ikke${suffix}.`, 'config');
  if (status === 429) return new ConnectorError(`${name} begrænser antallet af forespørgsler lige nu – prøv igen om lidt.`);
  return new ConnectorError(`${name} svarede med en fejl${suffix}.`);
}

const b64url = (bytes: Uint8Array) => {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
const b64urlJson = (v: unknown) => b64url(new TextEncoder().encode(JSON.stringify(v)));

/** Access token for a Google service account (signed JWT → token), e.g. GA4 and Search Console. */
export async function googleServiceToken(ctx: TestContext, name: string, json: string, scope: string): Promise<{ token: string; email: string }> {
  let sa: { client_email?: string; private_key?: string };
  try {
    sa = JSON.parse(json) as typeof sa;
  } catch {
    throw new ConnectorError(`${name}: nøglen er ikke en gyldig JSON-fil.`, 'config');
  }
  if (!sa.client_email || !sa.private_key) throw new ConnectorError(`${name}: JSON-filen mangler client_email eller private_key.`, 'config');
  let key: CryptoKey;
  try {
    const der = Uint8Array.from(atob(sa.private_key.replace(/-----(BEGIN|END) PRIVATE KEY-----/g, '').replace(/\s+/g, '')), (c) => c.charCodeAt(0));
    key = await crypto.subtle.importKey('pkcs8', der, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  } catch {
    throw new ConnectorError(`${name}: den private nøgle i JSON-filen kan ikke læses.`, 'config');
  }
  const iat = Math.floor((ctx.now ?? Date.now()) / 1000);
  const unsigned = `${b64urlJson({ alg: 'RS256', typ: 'JWT' })}.${b64urlJson({ iss: sa.client_email, scope, aud: 'https://oauth2.googleapis.com/token', iat, exp: iat + 3600 })}`;
  const signature = new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(unsigned)));
  const res = await call<{ access_token?: string }>(ctx, name, 'https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${unsigned}.${b64url(signature)}` }).toString(),
  });
  if (!res.access_token) throw new ConnectorError(`${name}: Google udstedte ikke et token.`, 'auth');
  return { token: res.access_token, email: sa.client_email };
}

/** OAuth refresh-token grant; keeps a rotated refresh token. */
async function refreshToken(ctx: TestContext, name: string, url: string, form: Record<string, string>): Promise<string> {
  const res = await call<{ access_token?: string; refresh_token?: string }>(ctx, name, url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'refresh_token', ...form }).toString(),
  }).catch((e: unknown) => {
    throw e instanceof ConnectorError ? new ConnectorError(e.message, 'auth') : e;
  });
  if (!res.access_token) throw new ConnectorError(`${name}: login gav intet access token.`, 'auth');
  if (res.refresh_token && res.refresh_token !== form.refresh_token) await ctx.save({ refreshToken: res.refresh_token });
  return res.access_token;
}

/** RFC 3986 percent-encoding (OAuth 1.0a). */
const rfc3986 = (v: string) => encodeURIComponent(v).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);

/** OAuth 1.0a HMAC-SHA1 header – Magento integrations sign every request. */
export async function oauth1Header(method: string, url: string, c: { consumerKey: string; consumerSecret: string; token: string; tokenSecret: string }, nonce = crypto.randomUUID().replace(/-/g, ''), timestamp = Math.floor(Date.now() / 1000)) {
  const oauth: Record<string, string> = {
    oauth_consumer_key: c.consumerKey,
    oauth_nonce: nonce,
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: String(timestamp),
    oauth_token: c.token,
    oauth_version: '1.0',
  };
  const u = new URL(url);
  const params = [...u.searchParams.entries(), ...Object.entries(oauth)].map(([k, v]) => [rfc3986(k), rfc3986(v)] as const);
  params.sort(([ak, av], [bk, bv]) => (ak < bk ? -1 : ak > bk ? 1 : av < bv ? -1 : av > bv ? 1 : 0));
  const base = `${method.toUpperCase()}&${rfc3986(`${u.protocol}//${u.host}${u.pathname}`)}&${rfc3986(params.map(([k, v]) => `${k}=${v}`).join('&'))}`;
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(`${rfc3986(c.consumerSecret)}&${rfc3986(c.tokenSecret)}`), { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']);
  let sig = '';
  for (const b of new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(base)))) sig += String.fromCharCode(b);
  return `OAuth ${Object.entries({ ...oauth, oauth_signature: btoa(sig) })
    .map(([k, v]) => `${k}="${rfc3986(v)}"`)
    .join(', ')}`;
}

/** LinkedIn versions are YYYYMM and live about a year – three months back is always supported. */
export function linkedinVersion(configured: string | undefined, now = Date.now()) {
  if (configured && /^\d{6}$/.test(configured.trim())) return configured.trim();
  const d = new Date(now);
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() - 3);
  return `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

/* ---------------------------------- Daisycon ---------------------------------- */

const DAISYCON_TOKEN = 'https://login.daisycon.com/oauth/access-token';

export async function pkcePair() {
  const verifier = b64url(crypto.getRandomValues(new Uint8Array(64)));
  const challenge = b64url(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))));
  return { verifier, challenge };
}

export function daisyconAuthorizeUrl(clientId: string, challenge: string, state: string, redirectUri: string) {
  return `https://login.daisycon.com/oauth/authorize?${new URLSearchParams({ response_type: 'code', client_id: clientId, redirect_uri: redirectUri, code_challenge: challenge, code_challenge_method: 'S256', state })}`;
}

/** The one-time code from Daisycon's page → refresh token. A PKCE app is a public client, so a secret is retried without. */
export async function daisyconExchange(fetchFn: FetchLike, input: { clientId: string; clientSecret?: string; code: string; verifier: string; redirectUri: string }): Promise<string> {
  const form: Record<string, string> = { grant_type: 'authorization_code', code: input.code, client_id: input.clientId, redirect_uri: input.redirectUri, code_verifier: input.verifier };
  const post = async (fields: Record<string, string>) => {
    const res = await fetchFn(DAISYCON_TOKEN, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' }, body: new URLSearchParams(fields).toString() });
    return { res, body: (await res.json().catch(() => ({}))) as { refresh_token?: string; error?: string; error_description?: string; message?: string } };
  };
  let { res, body } = await post(input.clientSecret ? { ...form, client_secret: input.clientSecret } : form);
  if (input.clientSecret && body.error === 'invalid_client') ({ res, body } = await post(form));
  if (res.ok && body.refresh_token) return body.refresh_token;
  throw new ConnectorError(`Daisycon afviste koden (${body.error_description ?? body.message ?? body.error ?? `HTTP ${res.status}`}). En kode kan kun bruges én gang – start forfra.`, 'auth');
}

/* ----------------------------------- tests ----------------------------------- */

type Tester = (ctx: TestContext) => Promise<string>;

const digits = (v: string) => v.replace(/\D/g, '');
const GOOGLE_ADS_VERSION = 'v25';
const DAISYCON_API = 'https://services.daisycon.com';

export const TESTERS: Record<ConnectorId, Tester> = {
  async google_ads(ctx) {
    const name = 'Google Ads';
    const token = await refreshToken(ctx, name, 'https://oauth2.googleapis.com/token', {
      client_id: need(ctx.secrets, 'clientId', name),
      client_secret: need(ctx.secrets, 'clientSecret', name),
      refresh_token: need(ctx.secrets, 'refreshToken', name),
    });
    const customer = digits(need(ctx.config, 'customerId', name));
    const headers: Record<string, string> = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
    if (ctx.config.loginCustomerId) headers['login-customer-id'] = digits(ctx.config.loginCustomerId);
    // Like Inventarland: the configured version first, then v25 and three newer ones – Google
    // sunsets versions, and a 404 HTML page means "try a newer one".
    const start = ctx.config.apiVersion?.trim() || GOOGLE_ADS_VERSION;
    const base = Math.max(Number(/^v(\d+)$/.exec(start)?.[1] ?? 0), Number(GOOGLE_ADS_VERSION.slice(1)));
    const versions = [...new Set([start, ...Array.from({ length: 4 }, (_, i) => `v${base + i}`)])];
    const tried: string[] = [];
    for (const v of versions) {
      const res = await ctx.fetch(`https://googleads.googleapis.com/${v}/customers/${customer}/googleAds:searchStream`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ query: 'SELECT customer.descriptive_name, customer.currency_code FROM customer LIMIT 1' }),
      });
      const text = await res.text();
      if (res.status === 404 && !/^\s*[[{]/.test(text)) {
        tried.push(v);
        continue;
      }
      if (!res.ok) throw httpError(name, res.status, text);
      const c = (JSON.parse(text) as { results?: { customer?: { descriptiveName?: string; currencyCode?: string } }[] }[])[0]?.results?.[0]?.customer;
      return `${c?.descriptiveName ?? `Kunde ${ctx.config.customerId}`}${c?.currencyCode ? ` (${c.currencyCode})` : ''}`;
    }
    throw new ConnectorError(`${name}: ingen af API-versionerne ${tried.join(', ')} svarer. Opdatér feltet "API-version" (eller lad det stå tomt).`, 'config');
  },

  async meta_ads(ctx) {
    const name = 'Meta Ads';
    const raw = need(ctx.config, 'adAccountId', name);
    const account = raw.startsWith('act_') ? raw : `act_${digits(raw)}`;
    const acc = await call<{ name?: string; currency?: string; account_status?: number }>(
      ctx,
      name,
      `https://graph.facebook.com/${ctx.config.apiVersion?.trim() || 'v23.0'}/${account}?fields=name,currency,account_status`,
      { headers: { Authorization: `Bearer ${need(ctx.secrets, 'accessToken', name)}` } },
    );
    if (acc.account_status !== undefined && acc.account_status !== 1) throw new ConnectorError(`${name}: annoncekontoen er ikke aktiv (status ${acc.account_status}).`, 'config');
    return `${acc.name ?? account}${acc.currency ? ` (${acc.currency})` : ''}`;
  },

  async linkedin_ads(ctx) {
    const name = 'LinkedIn Ads';
    let token = need(ctx.secrets, 'accessToken', name);
    const { clientId, clientSecret, refreshToken: refresh } = ctx.secrets;
    if (clientId && clientSecret && refresh) {
      token = await refreshToken(ctx, name, 'https://www.linkedin.com/oauth/v2/accessToken', { client_id: clientId, client_secret: clientSecret, refresh_token: refresh });
      await ctx.save({ accessToken: token });
    }
    const acc = await call<{ name?: string; currency?: string; status?: string }>(ctx, name, `https://api.linkedin.com/rest/adAccounts/${digits(need(ctx.config, 'adAccountId', name))}`, {
      headers: { Authorization: `Bearer ${token}`, 'LinkedIn-Version': linkedinVersion(ctx.config.apiVersion, ctx.now), 'X-Restli-Protocol-Version': '2.0.0' },
    });
    return `${acc.name ?? `Annoncekonto ${ctx.config.adAccountId}`}${acc.currency ? ` (${acc.currency})` : ''}`;
  },

  async daisycon(ctx) {
    const name = 'Daisycon';
    if (!ctx.secrets.refreshToken) throw new ConnectorError('Næsten færdig: klik "Log ind hos Daisycon" for at afslutte forbindelsen.', 'auth');
    const form: Record<string, string> = { client_id: need(ctx.secrets, 'clientId', name), refresh_token: ctx.secrets.refreshToken };
    let token: string;
    try {
      token = await refreshToken(ctx, name, DAISYCON_TOKEN, ctx.secrets.clientSecret ? { ...form, client_secret: ctx.secrets.clientSecret } : form);
    } catch (e) {
      if (!ctx.secrets.clientSecret) throw e;
      token = await refreshToken(ctx, name, DAISYCON_TOKEN, form);
    }
    const id = need(ctx.config, 'advertiserId', name);
    const api = (ctx.config.apiBaseUrl?.trim() || DAISYCON_API).replace(/\/+$/, '');
    const list = await call<{ id?: number | string; name?: string }[]>(ctx, name, `${api}/advertisers`, { headers: { Authorization: `Bearer ${token}` } });
    const match = Array.isArray(list) ? list.find((a) => String(a.id) === id) : undefined;
    if (!match) throw new ConnectorError(`${name}: annoncør-ID ${id} findes ikke på denne bruger.`, 'config');
    return String(match.name ?? `Annoncør ${id}`);
  },

  async search_console(ctx) {
    const name = 'Search Console';
    const site = need(ctx.config, 'siteUrl', name);
    const { token, email } = await googleServiceToken(ctx, name, need(ctx.secrets, 'serviceAccount', name), 'https://www.googleapis.com/auth/webmasters.readonly');
    try {
      const res = await call<{ siteUrl?: string; permissionLevel?: string }>(ctx, name, `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(site)}`, { headers: { Authorization: `Bearer ${token}` } });
      return `${res.siteUrl ?? site}${res.permissionLevel ? ` · ${res.permissionLevel.replace('site', '').toLowerCase()}` : ''}`;
    } catch (e) {
      if (e instanceof ConnectorError && e.kind !== 'api') throw new ConnectorError(`${name}: ${email} har ikke adgang til ${site}. Tilføj den som bruger på ejendommen.`, 'auth');
      throw e;
    }
  },

  async ga4(ctx) {
    const name = 'Google Analytics 4';
    const property = digits(need(ctx.config, 'propertyId', name));
    const { token } = await googleServiceToken(ctx, name, need(ctx.secrets, 'serviceAccount', name), 'https://www.googleapis.com/auth/analytics.readonly');
    const res = await call<{ rows?: { metricValues?: { value?: string }[] }[] }>(ctx, name, `https://analyticsdata.googleapis.com/v1beta/properties/${property}:runReport`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ dateRanges: [{ startDate: '7daysAgo', endDate: 'yesterday' }], metrics: [{ name: 'sessions' }] }),
    });
    const sessions = Number(res.rows?.[0]?.metricValues?.[0]?.value ?? 0);
    return `Property ${property} · ${sessions.toLocaleString('da-DK')} besøg sidste 7 dage`;
  },

  async ahrefs(ctx) {
    const name = 'Ahrefs';
    // Free endpoint – uses no API units.
    const res = await call<{ limits_and_usage?: { subscription?: string; units_limit_workspace?: number; units_usage_workspace?: number } }>(
      ctx,
      name,
      'https://api.ahrefs.com/v3/subscription-info/limits-and-usage',
      { headers: { Authorization: `Bearer ${need(ctx.secrets, 'apiKey', name)}` } },
    );
    const l = res.limits_and_usage;
    return `Ahrefs ${l?.subscription ?? ''}${l?.units_limit_workspace ? ` · ${(l.units_usage_workspace ?? 0).toLocaleString('da-DK')} af ${l.units_limit_workspace.toLocaleString('da-DK')} units brugt` : ''}`.trim();
  },

  async serper(ctx) {
    const name = 'Serper';
    const res = await call<{ searchParameters?: unknown; credits?: number }>(ctx, name, 'https://google.serper.dev/search', {
      method: 'POST',
      headers: { 'X-API-KEY': need(ctx.secrets, 'apiKey', name), 'Content-Type': 'application/json' },
      body: JSON.stringify({ q: 'inventarland', gl: 'dk', hl: 'da', num: 1 }),
    });
    if (!res.searchParameters) throw new ConnectorError(`${name} svarede uventet.`);
    return 'Serper (Google-søgning)';
  },

  async magento(ctx) {
    // Same requests as Inventarland: the orders (the real permission check), then the store's
    // currency (optional – integrations often only have access to sales).
    const name = 'Magento';
    const raw = need(ctx.config, 'baseUrl', name).replace(/\/+$/, '');
    if (!/^https:\/\//i.test(raw)) throw new ConnectorError(`${name}: adressen skal starte med https://`, 'config');
    const store = ctx.config.storeCode?.trim();
    const api = store ? `${raw}/rest/${encodeURIComponent(store)}/V1` : `${raw}/rest/V1`;
    const creds = {
      consumerKey: need(ctx.secrets, 'consumerKey', name),
      consumerSecret: need(ctx.secrets, 'consumerSecret', name),
      token: need(ctx.secrets, 'accessToken', name),
      tokenSecret: need(ctx.secrets, 'accessTokenSecret', name),
    };
    const get = async <T>(url: string) => call<T>(ctx, name, url, { headers: { Accept: 'application/json', Authorization: await oauth1Header('GET', url, creds) } });
    const res = await get<{ total_count?: number }>(`${api}/orders?searchCriteria[pageSize]=1&searchCriteria[currentPage]=1&fields=total_count`);
    let currency: string | undefined;
    try {
      const stores = await get<{ code?: string; base_currency_code?: string }[]>(`${api}/store/storeConfigs`);
      currency = (stores.find((x) => x.code === (store || 'default')) ?? stores[0])?.base_currency_code;
    } catch (e) {
      if (!(e instanceof ConnectorError && e.kind !== 'api')) throw e;
    }
    const orders = res.total_count !== undefined ? ` · ${res.total_count.toLocaleString('da-DK')} ordrer` : '';
    return `${new URL(raw).host}${currency ? ` (${currency})` : ''}${orders}`;
  },

  async klaviyo(ctx) {
    const name = 'Klaviyo';
    const res = await call<{ data?: { attributes?: { contact_information?: { organization_name?: string }; preferred_currency?: string } }[] }>(ctx, name, 'https://a.klaviyo.com/api/accounts/', {
      headers: { Authorization: `Klaviyo-API-Key ${need(ctx.secrets, 'apiKey', name)}`, revision: ctx.config.revision?.trim() || '2025-07-15' },
    });
    const a = res.data?.[0]?.attributes;
    return `${a?.contact_information?.organization_name ?? 'Klaviyo-konto'}${a?.preferred_currency ? ` (${a.preferred_currency})` : ''}`;
  },

  async pim(ctx) {
    const name = 'PIM';
    const base = need(ctx.config, 'baseUrl', name).replace(/\/+$/, '');
    if (!/^https:\/\//i.test(base)) throw new ConnectorError(`${name}: adressen skal starte med https://`, 'config');
    const path = ctx.config.testPath?.trim() || '/';
    const header = ctx.config.headerName?.trim() || 'Authorization';
    const key = need(ctx.secrets, 'apiKey', name);
    let res: Response;
    try {
      res = await ctx.fetch(`${base}${path.startsWith('/') ? path : `/${path}`}`, { headers: { Accept: 'application/json', [header]: header.toLowerCase() === 'authorization' ? `Bearer ${key}` : key } });
    } catch {
      throw new ConnectorError(`${name} kunne ikke kontaktes. Tjek adressen.`);
    }
    if (!res.ok) throw httpError(name, res.status, await res.text());
    return `${new URL(base).host} (Chainbox)`;
  },
};

/** Runs a connection's test and returns its new state. */
export async function runTest(id: ConnectorId, state: ConnState, fetchFn: FetchLike, now = Date.now()): Promise<{ state: ConnState; ok: boolean; message: string }> {
  const def = connectorDef(id);
  const secrets = { ...state.secrets };
  const ctx: TestContext = { config: state.config, secrets, fetch: fetchFn, now, save: async (patch) => void Object.assign(secrets, patch) };
  try {
    const label = await TESTERS[id](ctx);
    return { state: { ...state, secrets, status: 'connected', accountLabel: label, lastError: null, checkedAt: now }, ok: true, message: `Forbindelsen til ${def.name} virker.` };
  } catch (e) {
    const err = e instanceof ConnectorError ? e : new ConnectorError(`Forbindelsen til ${def.name} kunne ikke testes.`);
    const status: ConnectorStatus = err.kind === 'auth' ? 'needs_login' : 'error';
    return { state: { ...state, secrets, status, lastError: err.message, checkedAt: now }, ok: false, message: err.message };
  }
}
