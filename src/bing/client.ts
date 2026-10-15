/**
 * Microsoft Advertising API v13 – REST/JSON transport.
 *
 * Every operation is `<METHOD> https://<host>/<Service>/v13/<Entity>/<Verb>` with the
 * headers Authorization, DeveloperToken, CustomerId and CustomerAccountId. Polymorphic
 * objects (bidding schemes, ads, search parameters) carry a `Type` discriminator.
 * Docs: https://learn.microsoft.com/advertising/guides/migrate-to-rest
 */
import { msFetch } from '@/lib/platform';
import { refreshAccessToken, type OAuthConfig } from './oauth';
import type { MsService } from './types';

export const SERVICE_URLS: Record<MsService, string> = {
  campaign: 'https://campaign.api.bingads.microsoft.com/CampaignManagement/v13',
  reporting: 'https://reporting.api.bingads.microsoft.com/Reporting/v13',
  customer: 'https://clientcenter.api.bingads.microsoft.com/CustomerManagement/v13',
  adinsight: 'https://adinsight.api.bingads.microsoft.com/AdInsight/v13',
  bulk: 'https://bulk.api.bingads.microsoft.com/Bulk/v13',
  billing: 'https://clientcenter.api.bingads.microsoft.com/CustomerBilling/v13',
};

export class MsApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'MsApiError';
  }
}

/** Collects human readable messages from Microsoft's (nested) error payloads. */
export function extractErrorMessages(payload: unknown, out: string[] = [], depth = 0): string[] {
  if (!payload || depth > 6 || out.length >= 8) return out;
  if (Array.isArray(payload)) {
    for (const p of payload) extractErrorMessages(p, out, depth + 1);
    return out;
  }
  if (typeof payload === 'object') {
    const o = payload as Record<string, unknown>;
    const msg = typeof o.Message === 'string' ? o.Message : typeof o.message === 'string' ? o.message : null;
    const code = o.ErrorCode ?? o.Code ?? o.code;
    if (msg) {
      const line = code !== undefined && code !== null ? `${msg} (${String(code)})` : msg;
      if (!out.includes(line)) out.push(line);
    }
    for (const [k, v] of Object.entries(o)) {
      if (k !== 'Message' && k !== 'message' && v && typeof v === 'object') extractErrorMessages(v, out, depth + 1);
    }
  }
  return out;
}

export interface MsCredentials {
  oauth: OAuthConfig;
  developerToken: string;
  getRefreshToken: () => Promise<string | null>;
  saveRefreshToken: (token: string) => Promise<void>;
}

export interface CallOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: unknown;
  accountId?: string;
  customerId?: string;
  signal?: AbortSignal;
}

export class MsAdsClient {
  private token: { value: string; expiresAt: number } | null = null;
  private pending: Promise<string> | null = null;

  constructor(private readonly creds: MsCredentials) {}

  async accessToken(): Promise<string> {
    if (this.token && this.token.expiresAt > Date.now() + 60_000) return this.token.value;
    this.pending ??= (async () => {
      try {
        const refresh = await this.creds.getRefreshToken();
        if (!refresh) throw new Error('Microsoft Advertising er ikke forbundet. Log ind under Indstillinger → Forbindelser.');
        const res = await refreshAccessToken(this.creds.oauth, refresh);
        // Microsoft rotates refresh tokens – always keep the newest one.
        if (res.refresh_token && res.refresh_token !== refresh) await this.creds.saveRefreshToken(res.refresh_token);
        this.token = { value: res.access_token, expiresAt: Date.now() + (res.expires_in ?? 3600) * 1000 };
        return res.access_token;
      } finally {
        this.pending = null;
      }
    })();
    return this.pending;
  }

  async call<T = unknown>(service: MsService, path: string, opts: CallOptions = {}): Promise<T> {
    const url = `${SERVICE_URLS[service]}/${path.replace(/^\/+/, '')}`;
    const headers: Record<string, string> = {
      Authorization: `Bearer ${await this.accessToken()}`,
      DeveloperToken: this.creds.developerToken,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };
    if (opts.customerId) headers.CustomerId = opts.customerId;
    if (opts.accountId) headers.CustomerAccountId = opts.accountId;
    const method = opts.method ?? 'POST';

    let lastError: unknown;
    for (let attempt = 0; attempt < 3; attempt++) {
      const res = await msFetch(url, {
        method,
        headers,
        body: method === 'GET' ? undefined : JSON.stringify(opts.body ?? {}),
        signal: opts.signal,
      });
      const text = await res.text();
      let json: unknown = null;
      try {
        json = text ? JSON.parse(text) : null;
      } catch {
        json = text;
      }
      if (res.ok) return json as T;

      const messages = extractErrorMessages(json);
      const throttled = res.status === 429 || messages.some((m) => /\((117|207|4204)\)$/.test(m));
      if (throttled && attempt < 2) {
        await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
        lastError = json;
        continue;
      }
      if (res.status === 401) this.token = null;
      throw new MsApiError(
        `Microsoft Advertising (${res.status}): ${messages.join(' · ') || (typeof json === 'string' && json ? json.slice(0, 300) : res.statusText)}`,
        res.status,
        json,
      );
    }
    throw new MsApiError('Microsoft Advertising: for mange forespørgsler – prøv igen om lidt.', 429, lastError);
  }

  /** Downloads a binary resource (report ZIP) from a pre-signed URL. */
  async download(url: string, signal?: AbortSignal): Promise<ArrayBuffer> {
    const res = await msFetch(url, { method: 'GET', signal });
    if (!res.ok) throw new MsApiError(`Rapporten kunne ikke hentes (HTTP ${res.status}).`, res.status);
    return res.arrayBuffer();
  }
}
