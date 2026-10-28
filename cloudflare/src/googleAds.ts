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
 * Signing in, two ways: the service account's JSON key signs a JWT (RS256, WebCrypto), which
 * Google's token endpoint swaps for an access token with the `adwords` scope – or, as in
 * Inventarland Dashboard, an OAuth client and a user's refresh token (`oauthAccessToken`). No developer token:
 * Google retired it on 9 September 2026 – access follows the Google Cloud project the
 * service account belongs to (the Google Ads API must be enabled there).
 *
 * No imports through the app's `@/` alias (the Worker is bundled without it).
 */
import type { CampaignStructure, DAd, DAdGroup, DListingNode, DNegative, DSearchTerm, DetailMetrics, MatchKind } from '../../src/features/audit/detail';

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

/* ------------------------- signing in the Inventarland way ------------------------- */

/**
 * The other way in – the same as Inventarland Dashboard: an OAuth client (id + secret)
 * from the Google Cloud project, and the refresh token of a Google user with access to
 * the Ads account. Google sees that user, with that user's rights – which is why the
 * read-only gate above matters just as much here.
 */
export interface OAuthCredentials {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
}

/** How the workspace signs in to Google Ads. */
export type GoogleAuth = { kind: 'service_account'; key: ServiceAccountKey } | { kind: 'oauth'; oauth: OAuthCredentials };

/** Who Google sees – also what a stored access token belongs to. */
export function authIdentity(auth: GoogleAuth): string {
  return auth.kind === 'service_account' ? auth.key.clientEmail : `oauth:${auth.oauth.clientId}:${auth.oauth.refreshToken.slice(-12)}`;
}

/** Google's answer to a refresh token, in plain Danish (as in Inventarland). */
export function oauthTokenError(status: number, body: string): GoogleAdsError {
  let code = '';
  let description = '';
  try {
    const j = JSON.parse(body) as { error?: string; error_description?: string };
    code = j.error ?? '';
    description = j.error_description ?? '';
  } catch {
    /* not JSON */
  }
  if (code === 'invalid_grant')
    return new GoogleAdsError(
      `Refresh-tokenet er udløbet eller tilbagekaldt${description ? ` (${description})` : ''}. Opret et nyt – og sæt Google Cloud-appens OAuth-skærm til "I produktion", ellers udløber tokens efter 7 dage.`,
      'auth',
    );
  if (code === 'invalid_client' || code === 'unauthorized_client') return new GoogleAdsError(`OAuth client ID/secret passer ikke sammen med refresh-tokenet (${code}).`, 'auth');
  return new GoogleAdsError(`Google-login fejlede (${code || `HTTP ${status}`}).`, 'auth');
}

export async function oauthAccessToken(fetchFn: FetchLike, oauth: OAuthCredentials, nowMs: number): Promise<GoogleToken> {
  const res = await readOnlyFetch(fetchFn)(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body: new URLSearchParams({ client_id: oauth.clientId, client_secret: oauth.clientSecret, refresh_token: oauth.refreshToken, grant_type: 'refresh_token' }).toString(),
  });
  const text = await res.text();
  if (!res.ok) throw oauthTokenError(res.status, text);
  const body = JSON.parse(text) as { access_token?: string; expires_in?: number };
  if (!body.access_token) throw new GoogleAdsError('Google gav intet adgangstoken.', 'auth');
  return { value: body.access_token, expiresAt: nowMs + (body.expires_in ?? 3600) * 1000 };
}

/** An access token, whichever way the workspace signs in. */
export function accessTokenFor(fetchFn: FetchLike, auth: GoogleAuth, nowMs: number): Promise<GoogleToken> {
  return auth.kind === 'service_account' ? googleAccessToken(fetchFn, auth.key, nowMs) : oauthAccessToken(fetchFn, auth.oauth, nowMs);
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

/* --------------------------- one campaign's insides (audit) --------------------------- */

const lower = (v: unknown) => String(v ?? '').trim().toLowerCase();
const matchKind = (v: unknown): MatchKind => (v === 'EXACT' ? 'exact' : v === 'PHRASE' ? 'phrase' : 'broad');
const statusWord = (v: unknown) => (v === 'ENABLED' ? 'active' : v === 'PAUSED' ? 'paused' : lower(v));
const idOf = (id: string) => {
  if (!/^\d{1,20}$/.test(id)) throw new GoogleAdsError('Ugyldigt kampagne-id.', 'api');
  return id;
};
const period = (from: string, to: string) => {
  if (!DATE.test(from) || !DATE.test(to)) throw new GoogleAdsError('Ugyldig periode.', 'api');
  return `segments.date BETWEEN '${from}' AND '${to}'`;
};

interface MetricsRow {
  impressions?: string;
  clicks?: string;
  costMicros?: string;
  conversions?: number;
  conversionsValue?: number;
}
const metricsOf = (m: MetricsRow | undefined): DetailMetrics => ({
  impressions: num(m?.impressions),
  clicks: num(m?.clicks),
  spend: micros(m?.costMicros) ?? 0,
  conversions: num(m?.conversions),
  revenue: num(m?.conversionsValue),
});

interface KeywordInfo {
  text?: string;
  matchType?: string;
}

/** Ad groups and keywords, with each keyword's numbers for the period. */
export async function readStructure(reader: GoogleAdsReader, campaignId: string, from: string, to: string): Promise<CampaignStructure> {
  const id = idOf(campaignId);
  const groups = await reader.rows<{ adGroup?: { id?: string; name?: string; status?: string } }>(
    `SELECT ad_group.id, ad_group.name, ad_group.status FROM ad_group WHERE campaign.id = ${id} AND ad_group.status != 'REMOVED'`,
  );
  const keywords = await reader.rows<{ adGroup?: { id?: string }; adGroupCriterion?: { criterionId?: string; status?: string; keyword?: KeywordInfo } }>(
    `SELECT ad_group.id, ad_group_criterion.criterion_id, ad_group_criterion.status, ad_group_criterion.keyword.text, ad_group_criterion.keyword.match_type FROM ad_group_criterion WHERE campaign.id = ${id} AND ad_group_criterion.type = 'KEYWORD' AND ad_group_criterion.negative = FALSE AND ad_group_criterion.status != 'REMOVED'`,
  );
  const stats = await reader.rows<{ adGroup?: { id?: string }; adGroupCriterion?: { criterionId?: string }; metrics?: MetricsRow }>(
    `SELECT ad_group.id, ad_group_criterion.criterion_id, metrics.impressions, metrics.clicks, metrics.cost_micros, metrics.conversions, metrics.conversions_value FROM keyword_view WHERE campaign.id = ${id} AND ${period(from, to)}`,
  );
  const byKey = new Map(stats.map((s) => [`${s.adGroup?.id}~${s.adGroupCriterion?.criterionId}`, s.metrics]));
  return {
    adGroups: groups.map((g) => ({ id: String(g.adGroup?.id ?? ''), name: g.adGroup?.name ?? '', status: statusWord(g.adGroup?.status) })).filter((g) => g.id),
    keywords: keywords
      .map((k) => ({
        adGroupId: String(k.adGroup?.id ?? ''),
        text: lower(k.adGroupCriterion?.keyword?.text),
        matchType: matchKind(k.adGroupCriterion?.keyword?.matchType),
        status: statusWord(k.adGroupCriterion?.status),
        metrics: metricsOf(byKey.get(`${k.adGroup?.id}~${k.adGroupCriterion?.criterionId}`)),
      }))
      .filter((k) => k.text),
  };
}

/** The campaign's negative keywords: on the campaign, on its ad groups, and in the shared lists it uses. */
export async function readNegatives(reader: GoogleAdsReader, campaignId: string): Promise<DNegative[]> {
  const id = idOf(campaignId);
  const out: DNegative[] = [];
  const onCampaign = await reader.rows<{ campaignCriterion?: { keyword?: KeywordInfo } }>(
    `SELECT campaign_criterion.keyword.text, campaign_criterion.keyword.match_type FROM campaign_criterion WHERE campaign.id = ${id} AND campaign_criterion.negative = TRUE AND campaign_criterion.type = 'KEYWORD'`,
  );
  for (const r of onCampaign) out.push({ text: lower(r.campaignCriterion?.keyword?.text), matchType: matchKind(r.campaignCriterion?.keyword?.matchType), level: 'campaign' });
  const onGroups = await reader.rows<{ adGroup?: { name?: string }; adGroupCriterion?: { keyword?: KeywordInfo } }>(
    `SELECT ad_group.name, ad_group_criterion.keyword.text, ad_group_criterion.keyword.match_type FROM ad_group_criterion WHERE campaign.id = ${id} AND ad_group_criterion.negative = TRUE AND ad_group_criterion.type = 'KEYWORD' AND ad_group_criterion.status != 'REMOVED'`,
  );
  for (const r of onGroups)
    out.push({ text: lower(r.adGroupCriterion?.keyword?.text), matchType: matchKind(r.adGroupCriterion?.keyword?.matchType), level: 'adgroup', adGroupName: r.adGroup?.name ?? '' });
  const lists = await reader.rows<{ sharedSet?: { id?: string; name?: string } }>(
    `SELECT shared_set.id, shared_set.name FROM campaign_shared_set WHERE campaign.id = ${id} AND campaign_shared_set.status = 'ENABLED' AND shared_set.type = 'NEGATIVE_KEYWORDS'`,
  );
  const names = new Map(lists.map((l) => [String(l.sharedSet?.id ?? ''), l.sharedSet?.name ?? '']));
  const ids = [...names.keys()].filter((k) => /^\d+$/.test(k));
  if (ids.length) {
    const items = await reader.rows<{ sharedSet?: { id?: string }; sharedCriterion?: { keyword?: KeywordInfo } }>(
      `SELECT shared_set.id, shared_criterion.keyword.text, shared_criterion.keyword.match_type FROM shared_criterion WHERE shared_set.id IN (${ids.join(', ')}) AND shared_criterion.type = 'KEYWORD'`,
    );
    for (const r of items)
      out.push({ text: lower(r.sharedCriterion?.keyword?.text), matchType: matchKind(r.sharedCriterion?.keyword?.matchType), level: 'list', listName: names.get(String(r.sharedSet?.id ?? '')) ?? '' });
  }
  return out.filter((n) => n.text);
}

interface CaseValue {
  productItemId?: { value?: string };
  productBrand?: { value?: string };
  productType?: { level?: string; value?: string };
  productCustomAttribute?: { index?: string; value?: string };
  productCategory?: { level?: string; categoryId?: string };
  productCondition?: { condition?: string };
  productChannel?: { channel?: string };
}

const digitOf = (v: unknown) => /(\d)$/.exec(String(v ?? ''))?.[1] ?? '';

/** Google's listing dimension → the shared one (detail.ts). No case value = the root. */
export function googleDimension(cv: CaseValue | undefined): { dim: string; value: string } {
  if (!cv || !Object.keys(cv).length) return { dim: 'all', value: '' };
  if (cv.productItemId) return { dim: 'id', value: lower(cv.productItemId.value) };
  if (cv.productBrand) return { dim: 'brand', value: lower(cv.productBrand.value) };
  if (cv.productType) return { dim: `type${digitOf(cv.productType.level) || '1'}`, value: lower(cv.productType.value) };
  if (cv.productCustomAttribute) return { dim: `label${String(Number(digitOf(cv.productCustomAttribute.index) || 0))}`, value: lower(cv.productCustomAttribute.value) };
  if (cv.productCategory) return { dim: `category${digitOf(cv.productCategory.level) || '1'}`, value: lower(cv.productCategory.categoryId) };
  if (cv.productCondition) return { dim: 'condition', value: lower(cv.productCondition.condition) };
  if (cv.productChannel) return { dim: 'channel', value: lower(cv.productChannel.channel) };
  return { dim: Object.keys(cv)[0]!.toLowerCase(), value: '' };
}

const CASE_FIELDS = (prefix: string) =>
  [
    'product_item_id.value',
    'product_brand.value',
    'product_type.level',
    'product_type.value',
    'product_custom_attribute.index',
    'product_custom_attribute.value',
    'product_category.level',
    'product_category.category_id',
    'product_condition.condition',
    'product_channel.channel',
  ]
    .map((f) => `${prefix}.case_value.${f}`)
    .join(', ');

/** The last part of a resource name, "customers/1/adGroupCriteria/2~3" → "2~3". */
const tail = (resource: unknown) => String(resource ?? '').split('/').pop() ?? '';

/**
 * The product tree: Shopping's product groups (per ad group), or for Performance Max the
 * listing groups of its asset groups. Excluded units are what the audit compares.
 */
export async function readListingGroups(reader: GoogleAdsReader, customerId: string, campaignId: string, pmax: boolean): Promise<DListingNode[]> {
  const id = idOf(campaignId);
  if (pmax) {
    const rows = await reader.rows<{ assetGroup?: { id?: string; name?: string }; assetGroupListingGroupFilter?: { id?: string; type?: string; parentListingGroupFilter?: string; caseValue?: CaseValue } }>(
      `SELECT asset_group.id, asset_group.name, asset_group_listing_group_filter.id, asset_group_listing_group_filter.type, asset_group_listing_group_filter.parent_listing_group_filter, ${CASE_FIELDS('asset_group_listing_group_filter')} FROM asset_group_listing_group_filter WHERE asset_group.campaign = 'customers/${digits(customerId)}/campaigns/${id}' AND asset_group.status != 'REMOVED'`,
    );
    return rows.map((r) => {
      const f = r.assetGroupListingGroupFilter ?? {};
      return {
        // "assetGroupId~filterId", as in the parent's resource name.
        id: `${r.assetGroup?.id}~${f.id}`,
        parentId: f.parentListingGroupFilter ? tail(f.parentListingGroupFilter) : null,
        group: r.assetGroup?.name ?? '',
        unit: f.type !== 'SUBDIVISION',
        excluded: f.type === 'UNIT_EXCLUDED',
        ...googleDimension(f.caseValue),
      };
    });
  }
  const rows = await reader.rows<{ adGroup?: { id?: string; name?: string }; adGroupCriterion?: { criterionId?: string; negative?: boolean; listingGroup?: { type?: string; parentAdGroupCriterion?: string; caseValue?: CaseValue } } }>(
    `SELECT ad_group.id, ad_group.name, ad_group_criterion.criterion_id, ad_group_criterion.negative, ad_group_criterion.listing_group.type, ad_group_criterion.listing_group.parent_ad_group_criterion, ${CASE_FIELDS('ad_group_criterion.listing_group')} FROM ad_group_criterion WHERE campaign.id = ${id} AND ad_group_criterion.type = 'LISTING_GROUP' AND ad_group_criterion.status != 'REMOVED'`,
  );
  return rows.map((r) => {
    const c = r.adGroupCriterion ?? {};
    const lg = c.listingGroup ?? {};
    return {
      id: `${r.adGroup?.id}~${c.criterionId}`,
      parentId: lg.parentAdGroupCriterion ? tail(lg.parentAdGroupCriterion) : null,
      group: r.adGroup?.name ?? '',
      unit: lg.type === 'UNIT',
      excluded: !!c.negative,
      ...googleDimension(lg.caseValue),
    };
  });
}

/** The search terms of the period, added up per term (the most clicked first, at most 1,000). */
export async function readSearchTerms(reader: GoogleAdsReader, campaignId: string, from: string, to: string): Promise<DSearchTerm[]> {
  const id = idOf(campaignId);
  const rows = await reader.rows<{ searchTermView?: { searchTerm?: string }; metrics?: MetricsRow }>(
    `SELECT search_term_view.search_term, metrics.impressions, metrics.clicks, metrics.cost_micros, metrics.conversions, metrics.conversions_value FROM search_term_view WHERE campaign.id = ${id} AND ${period(from, to)} AND metrics.impressions > 0 ORDER BY metrics.clicks DESC LIMIT 3000`,
  );
  const byTerm = new Map<string, DSearchTerm>();
  for (const r of rows) {
    const term = lower(r.searchTermView?.searchTerm);
    if (!term) continue;
    const m = metricsOf(r.metrics);
    const t = byTerm.get(term) ?? { term, impressions: 0, clicks: 0, spend: 0, conversions: 0, revenue: 0 };
    byTerm.set(term, { term, impressions: t.impressions + m.impressions, clicks: t.clicks + m.clicks, spend: t.spend + m.spend, conversions: t.conversions + m.conversions, revenue: t.revenue + m.revenue });
  }
  return [...byTerm.values()].sort((a, b) => b.clicks - a.clicks).slice(0, 1000);
}

/** The ads (not removed) with their texts and final URLs, and the ad groups they are in. */
export async function readAds(reader: GoogleAdsReader, campaignId: string): Promise<{ adGroups: DAdGroup[]; ads: DAd[] }> {
  const id = idOf(campaignId);
  const groups = await reader.rows<{ adGroup?: { id?: string; name?: string; status?: string } }>(
    `SELECT ad_group.id, ad_group.name, ad_group.status FROM ad_group WHERE campaign.id = ${id} AND ad_group.status != 'REMOVED'`,
  );
  const rows = await reader.rows<{
    adGroup?: { id?: string };
    adGroupAd?: { status?: string; ad?: { type?: string; finalUrls?: string[]; responsiveSearchAd?: { headlines?: { text?: string }[]; descriptions?: { text?: string }[] } } };
  }>(
    `SELECT ad_group.id, ad_group_ad.status, ad_group_ad.ad.type, ad_group_ad.ad.final_urls, ad_group_ad.ad.responsive_search_ad.headlines, ad_group_ad.ad.responsive_search_ad.descriptions FROM ad_group_ad WHERE campaign.id = ${id} AND ad_group_ad.status != 'REMOVED'`,
  );
  const texts = (v: { text?: string }[] | undefined) => (v ?? []).map((a) => String(a.text ?? '').trim()).filter(Boolean);
  return {
    adGroups: groups.map((g) => ({ id: String(g.adGroup?.id ?? ''), name: g.adGroup?.name ?? '', status: statusWord(g.adGroup?.status) })).filter((g) => g.id),
    ads: rows.map((r) => ({
      adGroupId: String(r.adGroup?.id ?? ''),
      status: statusWord(r.adGroupAd?.status),
      type: r.adGroupAd?.ad?.type ?? '',
      headlines: texts(r.adGroupAd?.ad?.responsiveSearchAd?.headlines),
      descriptions: texts(r.adGroupAd?.ad?.responsiveSearchAd?.descriptions),
      finalUrls: r.adGroupAd?.ad?.finalUrls ?? [],
    })),
  };
}
