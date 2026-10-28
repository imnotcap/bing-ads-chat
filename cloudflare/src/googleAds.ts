/**
 * Google Ads – READ ONLY. The audit compares the Microsoft Advertising campaigns with the
 * Google Ads account, and Google is only ever read: the app changes Microsoft, never Google.
 *
 * That is held three ways:
 * 1. The service account is added in Google Ads with "Kun læseadgang" (Read only).
 * 2. Every request to Google goes through `readOnlyFetch`, which lets through exactly two
 *    things – the token exchange and a GAQL `googleAds:searchStream` whose query is a
 *    SELECT – and throws before anything is sent for every other address (`:mutate`,
 *    `campaigns:mutate`, `customers:createCustomerClient` …). GAQL itself cannot change
 *    anything.
 * 3. The assistant gets no Google tools; the app reads through the workspace's routes.
 *
 * Signing in: the service account's JSON key signs a JWT (RS256, WebCrypto), which Google's
 * token endpoint swaps for an access token with the `adwords` scope. No developer token:
 * Google retired it on 9 September 2026 – access follows the Google Cloud project the
 * service account belongs to (the Google Ads API must be enabled there).
 *
 * No imports from the app (the Worker is bundled without the `@/` alias).
 */

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
export const ADWORDS_SCOPE = 'https://www.googleapis.com/auth/adwords';
const API_HOST = 'https://googleads.googleapis.com';

/** The newest version known to work first; Google sunsets versions about a year after release. */
export const GOOGLE_ADS_VERSIONS = ['v25', 'v26', 'v27', 'v28', 'v24', 'v23'];

export class GoogleAdsError extends Error {
  constructor(
    message: string,
    readonly kind: 'key' | 'auth' | 'access' | 'api' | 'blocked',
  ) {
    super(message);
    this.name = 'GoogleAdsError';
  }
}

/* --------------------------------- the key --------------------------------- */

/** What is kept of the JSON key – enough to sign in, nothing else. */
export interface ServiceAccountKey {
  clientEmail: string;
  privateKey: string;
  privateKeyId: string | null;
  projectId: string | null;
}

/**
 * The one service account the audit may sign in with – the team's own `gsc-chat` in its
 * `search-console-mcp-…` project. Any other account's key is refused when it is saved and
 * again on every sign-in (`googleAccessToken`).
 */
export const ALLOWED_SERVICE_ACCOUNT = /^gsc-chat@search-console-mcp-[a-z0-9-]+\.iam\.gserviceaccount\.com$/;
export const ALLOWED_SERVICE_ACCOUNT_LABEL = 'gsc-chat@search-console-mcp-….iam.gserviceaccount.com';

export function assertAllowedServiceAccount(email: string): void {
  if (!ALLOWED_SERVICE_ACCOUNT.test(email))
    throw new GoogleAdsError(`Kun service-kontoen ${ALLOWED_SERVICE_ACCOUNT_LABEL} kan forbindes – nøglen er til ${email}.`, 'key');
}

/** Reads a service account's JSON key file (as downloaded from Google Cloud); only the allowed account's. */
export function parseServiceAccountKey(text: string): ServiceAccountKey {
  let raw: Record<string, unknown>;
  try {
    raw = JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new GoogleAdsError('Nøglefilen er ikke gyldig JSON. Vælg den .json-fil, Google Cloud gav dig, da nøglen blev oprettet.', 'key');
  }
  if (raw.type !== 'service_account') throw new GoogleAdsError('Filen er ikke en nøgle til en service-konto (feltet "type" skal være "service_account").', 'key');
  const clientEmail = typeof raw.client_email === 'string' ? raw.client_email.trim() : '';
  const privateKey = typeof raw.private_key === 'string' ? raw.private_key : '';
  if (!/^[^@\s]+@[^@\s]+\.iam\.gserviceaccount\.com$/.test(clientEmail)) throw new GoogleAdsError('Nøglefilen mangler service-kontoens e-mail (client_email).', 'key');
  if (!privateKey.includes('BEGIN PRIVATE KEY')) throw new GoogleAdsError('Nøglefilen mangler den private nøgle (private_key).', 'key');
  assertAllowedServiceAccount(clientEmail);
  return {
    clientEmail,
    privateKey,
    privateKeyId: typeof raw.private_key_id === 'string' ? raw.private_key_id : null,
    projectId: typeof raw.project_id === 'string' ? raw.project_id : null,
  };
}

/* ------------------------------ the read-only gate ------------------------------ */

const SEARCH_URL = /^https:\/\/googleads\.googleapis\.com\/v\d{2}\/customers\/\d{10}\/googleAds:searchStream$/;

/**
 * Throws unless the request only reads: a POST to the token endpoint, or a GAQL SELECT
 * sent to `googleAds:searchStream` of one customer. Everything else is refused here,
 * before it leaves the Worker.
 */
export function assertReadOnly(url: string, init?: RequestInit): void {
  const method = (init?.method ?? 'GET').toUpperCase();
  if (url === GOOGLE_TOKEN_URL && method === 'POST') return;
  if (SEARCH_URL.test(url) && method === 'POST') {
    let query = '';
    try {
      query = String((JSON.parse(String(init?.body ?? '')) as { query?: unknown }).query ?? '');
    } catch {
      /* falls through to the refusal */
    }
    if (/^\s*SELECT\s/i.test(query)) return;
  }
  throw new GoogleAdsError(`Blokeret: appen må kun læse fra Google Ads (${method} ${url.split('?')[0]}).`, 'blocked');
}

/** The only way out to Google: checks every request with `assertReadOnly` first. */
export function readOnlyFetch(fetchFn: FetchLike): FetchLike {
  return async (url, init) => {
    assertReadOnly(url, init);
    return fetchFn(url, init);
  };
}

/* --------------------------------- signing in --------------------------------- */

const b64url = (bytes: Uint8Array) => {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
const b64urlText = (text: string) => b64url(new TextEncoder().encode(text));

function pemToDer(pem: string): ArrayBuffer {
  const body = pem.replace(/-----(BEGIN|END) PRIVATE KEY-----/g, '').replace(/\\n/g, '').replace(/\s+/g, '');
  const bin = atob(body);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out.buffer;
}

/** The signed JWT Google swaps for an access token (valid one hour). */
export async function signAssertion(key: ServiceAccountKey, nowMs: number): Promise<string> {
  const iat = Math.floor(nowMs / 1000);
  const header = { alg: 'RS256', typ: 'JWT', ...(key.privateKeyId ? { kid: key.privateKeyId } : {}) };
  const claims = { iss: key.clientEmail, scope: ADWORDS_SCOPE, aud: GOOGLE_TOKEN_URL, iat, exp: iat + 3600 };
  const input = `${b64urlText(JSON.stringify(header))}.${b64urlText(JSON.stringify(claims))}`;
  let signing: CryptoKey;
  try {
    signing = await crypto.subtle.importKey('pkcs8', pemToDer(key.privateKey), { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  } catch {
    throw new GoogleAdsError('Den private nøgle i filen kan ikke læses. Hent en ny nøgle til service-kontoen i Google Cloud.', 'key');
  }
  const sig = new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', signing, new TextEncoder().encode(input)));
  return `${input}.${b64url(sig)}`;
}

export interface GoogleToken {
  value: string;
  expiresAt: number;
}

export async function googleAccessToken(fetchFn: FetchLike, key: ServiceAccountKey, nowMs: number): Promise<GoogleToken> {
  assertAllowedServiceAccount(key.clientEmail);
  const res = await readOnlyFetch(fetchFn)(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: await signAssertion(key, nowMs) }).toString(),
  });
  const body = (await res.json().catch(() => ({}))) as { access_token?: string; expires_in?: number; error?: string; error_description?: string };
  if (!res.ok || !body.access_token) {
    const why = body.error_description ?? body.error ?? `HTTP ${res.status}`;
    throw new GoogleAdsError(`Google afviste service-kontoens nøgle (${why}). Er nøglen slettet i Google Cloud, så hent en ny.`, 'auth');
  }
  return { value: body.access_token, expiresAt: nowMs + (body.expires_in ?? 3600) * 1000 };
}

/* ---------------------------------- reading ---------------------------------- */

export const digits = (v: string | null | undefined) => (v ?? '').replace(/\D/g, '');

/** Google's error as one line, with what to do for the errors a new setup meets. */
export function explainGoogleError(status: number, text: string): GoogleAdsError {
  let message = '';
  let reason = '';
  try {
    const body = JSON.parse(text) as unknown;
    const err = (Array.isArray(body) ? body[0] : body) as { error?: { message?: string; status?: string; details?: { errors?: { errorCode?: Record<string, string>; message?: string }[] }[] } };
    const first = err.error?.details?.flatMap((d) => d.errors ?? [])[0];
    message = first?.message ?? err.error?.message ?? '';
    reason = Object.values(first?.errorCode ?? {})[0] ?? err.error?.status ?? '';
  } catch {
    message = text.slice(0, 200);
  }
  const said = message ? ` Google: "${message.trim()}"` : '';
  if (/SERVICE_DISABLED|has not been used in project|is disabled/i.test(`${reason} ${message}`))
    return new GoogleAdsError(`Google Ads API er ikke slået til i service-kontoens Google Cloud-projekt. Slå "Google Ads API" til under APIs & Services, og prøv igen.${said}`, 'access');
  if (/USER_PERMISSION_DENIED|CUSTOMER_NOT_FOUND|NOT_ADS_USER/i.test(reason) || status === 403)
    return new GoogleAdsError(`Service-kontoen har ikke adgang til Google Ads-kontoen. Tilføj dens e-mail under Administrator → Adgang og sikkerhed med "Kun læseadgang" – og angiv administratorkontoens (MCC) ID, hvis adgangen går gennem den.${said}`, 'access');
  if (status === 401) return new GoogleAdsError(`Google afviste adgangen (401).${said}`, 'auth');
  return new GoogleAdsError(`Google Ads svarede ${status}.${said}`, 'api');
}

export interface ReaderOptions {
  /** The Google Ads account (10 digits, dashes allowed). */
  customerId: string;
  /** The manager account (MCC) the access goes through, if any. */
  loginCustomerId?: string | null;
  /** The API version that answered last time. */
  version?: string | null;
}

/**
 * Reads one Google Ads account with GAQL. `rows` runs a SELECT and returns the rows of all
 * batches; the version that answers is kept in `version` (for the caller to store).
 */
export class GoogleAdsReader {
  version: string | null;
  private readonly fetchFn: FetchLike;

  constructor(
    fetchFn: FetchLike,
    private readonly token: () => Promise<string>,
    private readonly opts: ReaderOptions,
  ) {
    this.fetchFn = readOnlyFetch(fetchFn);
    this.version = opts.version ?? null;
  }

  async rows<T>(query: string): Promise<T[]> {
    const customer = digits(this.opts.customerId);
    if (customer.length !== 10) throw new GoogleAdsError('Google Ads-kundenummeret skal have 10 cifre (fx 123-456-7890).', 'api');
    const headers: Record<string, string> = { Authorization: `Bearer ${await this.token()}`, 'Content-Type': 'application/json' };
    const login = digits(this.opts.loginCustomerId);
    if (login) headers['login-customer-id'] = login;
    const versions = [...new Set([...(this.version ? [this.version] : []), ...GOOGLE_ADS_VERSIONS])];
    for (const v of versions) {
      const res = await this.fetchFn(`${API_HOST}/${v}/customers/${customer}/googleAds:searchStream`, { method: 'POST', headers, body: JSON.stringify({ query }) });
      const text = await res.text();
      // A version Google has not released (or has sunset) answers with an HTML 404 page.
      if (res.status === 404 && !/^\s*[[{]/.test(text)) continue;
      if (!res.ok) throw explainGoogleError(res.status, text);
      this.version = v;
      const batches = JSON.parse(text) as { results?: T[] }[];
      return batches.flatMap((b) => b.results ?? []);
    }
    throw new GoogleAdsError(`Ingen af Google Ads API-versionerne ${versions.join(', ')} svarer.`, 'api');
  }
}

/* ------------------------------ what the audit reads ------------------------------ */

export interface GoogleAccount {
  customerId: string;
  name: string;
  currency: string;
  timeZone: string;
}

export interface GoogleMetrics {
  impressions: number;
  clicks: number;
  spend: number;
  conversions: number;
  revenue: number;
}

export interface GoogleCampaign {
  id: string;
  name: string;
  /** ENABLED, PAUSED … (REMOVED campaigns are left out). */
  status: string;
  /** SEARCH, SHOPPING, PERFORMANCE_MAX, DISPLAY, VIDEO, DEMAND_GEN … */
  channel: string;
  /** Daily budget in the account's currency; null when the budget is not daily. */
  dailyBudget: number | null;
  sharedBudget: boolean;
  /** MAXIMIZE_CONVERSION_VALUE, TARGET_ROAS, MANUAL_CPC … */
  bidStrategy: string;
  /** Set when the campaign uses a portfolio strategy (its targets live there). */
  portfolio: boolean;
  /** 3.5 = 350 %. */
  targetRoas: number | null;
  targetCpa: number | null;
  metrics: GoogleMetrics;
}

const micros = (v: unknown) => (v === undefined || v === null || v === '' ? null : Number(v) / 1_000_000);
const num = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);

export async function readAccount(reader: GoogleAdsReader, customerId: string): Promise<GoogleAccount> {
  const [row] = await reader.rows<{ customer?: { descriptiveName?: string; currencyCode?: string; timeZone?: string } }>(
    'SELECT customer.descriptive_name, customer.currency_code, customer.time_zone FROM customer LIMIT 1',
  );
  return { customerId: digits(customerId), name: row?.customer?.descriptiveName ?? `Kunde ${customerId}`, currency: row?.customer?.currencyCode ?? '', timeZone: row?.customer?.timeZone ?? '' };
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;

interface CampaignRow {
  campaign?: {
    id?: string;
    name?: string;
    status?: string;
    advertisingChannelType?: string;
    biddingStrategyType?: string;
    biddingStrategy?: string;
    targetRoas?: { targetRoas?: number };
    maximizeConversionValue?: { targetRoas?: number };
    targetCpa?: { targetCpaMicros?: string };
    maximizeConversions?: { targetCpaMicros?: string };
  };
  campaignBudget?: { amountMicros?: string; explicitlyShared?: boolean; period?: string };
  metrics?: { impressions?: string; clicks?: string; costMicros?: string; conversions?: number; conversionsValue?: number };
}

/**
 * The account's campaigns (not removed) with their setup, and their numbers for the period.
 * Two queries: a campaign without traffic in the period has no metrics row, but must
 * still be listed.
 */
export async function readCampaigns(reader: GoogleAdsReader, from: string, to: string): Promise<GoogleCampaign[]> {
  if (!DATE.test(from) || !DATE.test(to)) throw new GoogleAdsError('Ugyldig periode.', 'api');
  const setup = await reader.rows<CampaignRow>(
    `SELECT campaign.id, campaign.name, campaign.status, campaign.advertising_channel_type, campaign.bidding_strategy_type, campaign.bidding_strategy, campaign.target_roas.target_roas, campaign.maximize_conversion_value.target_roas, campaign.target_cpa.target_cpa_micros, campaign.maximize_conversions.target_cpa_micros, campaign_budget.amount_micros, campaign_budget.explicitly_shared, campaign_budget.period FROM campaign WHERE campaign.status != 'REMOVED'`,
  );
  const stats = await reader.rows<CampaignRow>(
    `SELECT campaign.id, metrics.impressions, metrics.clicks, metrics.cost_micros, metrics.conversions, metrics.conversions_value FROM campaign WHERE campaign.status != 'REMOVED' AND segments.date BETWEEN '${from}' AND '${to}'`,
  );
  const byId = new Map(stats.map((r) => [String(r.campaign?.id ?? ''), r.metrics ?? {}]));
  return setup
    .map((r): GoogleCampaign => {
      const c = r.campaign ?? {};
      const m = byId.get(String(c.id ?? '')) ?? {};
      const roas = c.targetRoas?.targetRoas ?? c.maximizeConversionValue?.targetRoas;
      const cpa = micros(c.targetCpa?.targetCpaMicros ?? c.maximizeConversions?.targetCpaMicros);
      return {
        id: String(c.id ?? ''),
        name: c.name ?? '',
        status: c.status ?? 'UNKNOWN',
        channel: c.advertisingChannelType ?? 'UNKNOWN',
        dailyBudget: r.campaignBudget?.period && r.campaignBudget.period !== 'DAILY' ? null : micros(r.campaignBudget?.amountMicros),
        sharedBudget: !!r.campaignBudget?.explicitlyShared,
        bidStrategy: c.biddingStrategyType ?? 'UNKNOWN',
        portfolio: !!c.biddingStrategy,
        targetRoas: roas ? roas : null,
        targetCpa: cpa ? cpa : null,
        metrics: { impressions: num(m.impressions), clicks: num(m.clicks), spend: (micros(m.costMicros) ?? 0), conversions: num(m.conversions), revenue: num(m.conversionsValue) },
      };
    })
    .filter((c) => c.id)
    .sort((a, b) => b.metrics.spend - a.metrics.spend);
}
