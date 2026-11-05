/**
 * Microsoft Advertising API v13 – REST/JSON transport.
 *
 * Every operation is `<METHOD> https://<host>/<Service>/v13/<Entity>/<Verb>` with the
 * headers Authorization, DeveloperToken, CustomerId and CustomerAccountId. Polymorphic
 * objects (bidding schemes, ads, search parameters) carry a `Type` discriminator.
 * Docs: https://learn.microsoft.com/advertising/guides/migrate-to-rest
 */
import { msFetch } from '@/lib/platform';
import { extractErrorMessages, isThrottled } from './msErrors';
import type { MsService } from './types';

export { extractErrorMessages };

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

export interface MsAccess {
  accessToken: string;
  /** ms since epoch */
  expiresAt: number;
  developerToken: string;
}

export interface MsCredentials {
  /** A current access token + developer token. `fresh` asks for a new token (the last one was rejected). */
  getAccess: (fresh: boolean) => Promise<MsAccess>;
}

export interface CallOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: unknown;
  accountId?: string;
  customerId?: string;
  signal?: AbortSignal;
}

export class MsAdsClient {
  private access: MsAccess | null = null;
  private stale = false;
  private pending: Promise<MsAccess> | null = null;

  constructor(private readonly creds: MsCredentials) {}

  private async current(): Promise<MsAccess> {
    if (this.access && !this.stale && this.access.expiresAt > Date.now() + 60_000) return this.access;
    this.pending ??= (async () => {
      try {
        this.access = await this.creds.getAccess(this.stale);
        this.stale = false;
        return this.access;
      } finally {
        this.pending = null;
      }
    })();
    return this.pending;
  }

  async call<T = unknown>(service: MsService, path: string, opts: CallOptions = {}): Promise<T> {
    return this.request<T>(`${SERVICE_URLS[service]}/${path.replace(/^\/+/, '')}`, opts, 'bearer');
  }

  /**
   * Microsoft Merchant Center's Content API (product catalogue and offer status): the
   * same sign-in, but the token goes in an AuthenticationToken header.
   * Docs: https://learn.microsoft.com/advertising/shopping-content/manage-products
   */
  async content<T = unknown>(url: string, opts: CallOptions = {}): Promise<T> {
    return this.request<T>(url, { method: 'GET', ...opts }, 'token');
  }

  private async request<T>(url: string, opts: CallOptions, auth: 'bearer' | 'token'): Promise<T> {
    const access = await this.current();
    const headers: Record<string, string> = {
      ...(auth === 'bearer' ? { Authorization: `Bearer ${access.accessToken}` } : { AuthenticationToken: access.accessToken }),
      DeveloperToken: access.developerToken,
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
      const throttled = isThrottled(res.status, messages);
      if (throttled && attempt < 2) {
        await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
        lastError = json;
        continue;
      }
      if (res.status === 401) this.stale = true;
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
