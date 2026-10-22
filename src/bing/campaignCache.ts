/**
 * The campaigns of the connected account, shared through the workspace on Cloudflare
 * (cloudflare/src/adsCache.ts). Hundreds of campaigns take seconds to read from
 * Microsoft, so the app reads them from there and only asks Microsoft again when the
 * stored list is older than FRESH_MS (30 minutes) – or after the app changed something.
 */
import { autoRefreshAllowed } from '@/lib/refreshPolicy';
import type { Campaign } from './types';

export const FRESH_MS = 30 * 60_000;

export interface CampaignStore {
  read(accountId: string): Promise<{ fetchedAt: number | null; campaigns: Campaign[] }>;
  write(accountId: string, fetchedAt: number, campaigns: Campaign[]): Promise<void>;
}

export class CampaignCache {
  private stale = false;
  private pending = new Map<string, Promise<Campaign[]>>();

  constructor(
    private readonly store: CampaignStore,
    private readonly fetchFresh: (accountId: string) => Promise<Campaign[]>,
  ) {}

  /** After reading the campaigns from Microsoft: share them with the rest of the team. */
  saved(accountId: string, campaigns: Campaign[], fetchedAt = Date.now()) {
    this.stale = false;
    void this.store.write(accountId, fetchedAt, campaigns).catch(() => {});
  }

  changed() {
    this.stale = true;
  }

  async get(accountId: string): Promise<Campaign[]> {
    if (!this.stale) {
      const snap = await this.store.read(accountId).catch(() => null);
      // Outside weekdays 8–16 the stored list is used however old it is (lib/refreshPolicy.ts).
      if (snap?.fetchedAt && (Date.now() - snap.fetchedAt < FRESH_MS || !autoRefreshAllowed())) return snap.campaigns;
    }
    // One read from Microsoft at a time per account, however many tools ask.
    let p = this.pending.get(accountId);
    if (!p) {
      p = this.fetchFresh(accountId).finally(() => this.pending.delete(accountId));
      this.pending.set(accountId, p);
    }
    return p;
  }
}
