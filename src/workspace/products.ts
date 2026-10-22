/**
 * The product overview for the Produkter page, the insights panel and the assistant.
 * Microsoft's product report for thousands of products is slow, so the result (only the
 * products worth showing, see bing/products.ts) is shared through the workspace on
 * Cloudflare (cloudflare/src/productCache.ts) and read from there while it is fresh.
 */
import { getBackend } from '@/bing/backend';
import { relevantProducts } from '@/bing/products';
import type { AdsBackend, ProductPerformance } from '@/bing/types';
import type { DateRange } from '@/lib/format';
import { useConnection } from '@/stores/connection';
import { api } from './api';

/** Product numbers change slowly; a few hours old is fine (Opdatér fetches anew). */
export const PRODUCTS_FRESH_MS = 6 * 3600_000;

export interface ProductOverview {
  products: ProductPerformance[];
  /** Products Microsoft reported before filtering. */
  scanned: number;
  fetchedAt: number;
  /** Read from the shared copy on Cloudflare instead of Microsoft. */
  cached: boolean;
}

interface Snapshot {
  fetchedAt: number | null;
  scanned: number;
  products: ProductPerformance[];
}

const periodKey = (range: DateRange) => `${range.from}_${range.to}`;
const pending = new Map<string, Promise<ProductOverview>>();

export async function loadProducts(
  accountId: string,
  range: DateRange,
  { force = false, signal, backend: given }: { force?: boolean; signal?: AbortSignal; backend?: AdsBackend } = {},
): Promise<ProductOverview> {
  const backend = given ?? (await getBackend());
  if (!backend.productPerformance) throw new Error('Produktdata findes ikke for denne forbindelse.');
  const live = backend.mode === 'live' && useConnection.getState().mode === 'live';
  const period = periodKey(range);

  if (live && !force) {
    const snap = await api<Snapshot>(`/workspace/ads/products?account=${encodeURIComponent(accountId)}&period=${period}`).catch(() => null);
    if (snap?.fetchedAt && Date.now() - snap.fetchedAt < PRODUCTS_FRESH_MS) {
      return { products: snap.products, scanned: snap.scanned, fetchedAt: snap.fetchedAt, cached: true };
    }
  }

  // One report at a time per account and period, however many places ask.
  const key = `${accountId}|${period}`;
  let p = pending.get(key);
  if (!p) {
    p = (async () => {
      const all = await backend.productPerformance!(accountId, range, signal);
      const products = relevantProducts(all);
      const fetchedAt = Date.now();
      if (live) {
        void api('/workspace/ads/products', { method: 'PUT', body: JSON.stringify({ accountId, period, fetchedAt, scanned: all.length, products }) }).catch(() => {});
      }
      return { products, scanned: all.length, fetchedAt, cached: false };
    })().finally(() => pending.delete(key));
    pending.set(key, p);
  }
  return p;
}
