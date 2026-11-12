/**
 * Watched products (Produkter → Overvågede): a list the team shares (Worker), and their
 * numbers for a short period read again every few minutes – Microsoft (impressions, clicks,
 * spend, conversions, revenue) and the shop's own sales (Inventarland: units, revenue).
 */
import { useMutation, useQuery } from '@tanstack/react-query';
import { getBackend } from '@/bing/backend';
import type { Metrics } from '@/bing/types';
import { addDays, today } from '@/lib/format';
import { queryClient } from '@/lib/queryClient';
import { useConnection } from '@/stores/connection';
import { changeWatchlist, getWatchlist, inventarland, type WatchItem } from '@/workspace/shared';

export const LIVE_MS = 5 * 60_000;

export type LivePeriod = 'today' | 'yesterday' | 'last7' | 'since';

export function periodRange(p: LivePeriod, since: string): { from: string; to: string } {
  const t = today();
  if (p === 'yesterday') return { from: addDays(t, -1), to: addDays(t, -1) };
  if (p === 'last7') return { from: addDays(t, -6), to: t };
  if (p === 'since') return { from: since <= t ? since : t, to: t };
  return { from: t, to: t };
}

export function useWatchlist() {
  return useQuery({ queryKey: ['watchlist'], queryFn: getWatchlist, staleTime: 60_000, refetchInterval: LIVE_MS });
}

export function useWatchChange() {
  return useMutation({
    mutationFn: changeWatchlist,
    onSuccess: (items) => queryClient.setQueryData(['watchlist'], items),
  });
}

export interface LiveRow {
  item: WatchItem;
  title: string;
  ms: Metrics | null;
  shop: { units: number; revenue: number } | null;
}

const EMPTY: Metrics = { impressions: 0, clicks: 0, spend: 0, conversions: 0, revenue: 0 };

/** Pure: the watched items with the numbers found for them (missing = nothing in the period). */
export function liveRows(items: WatchItem[], ms: Map<string, { title: string; metrics: Metrics }> | null, shop: Map<string, { name: string; units: number; revenue: number }> | null): LiveRow[] {
  return items.map((item) => {
    const k = item.id.toLowerCase();
    const m = ms?.get(k);
    const s = shop?.get(k);
    return { item, title: item.title || m?.title || s?.name || item.id, ms: ms ? (m?.metrics ?? EMPTY) : null, shop: shop ? (s ? { units: s.units, revenue: s.revenue } : { units: 0, revenue: 0 }) : null };
  });
}

/** Microsoft's product numbers for the period – refreshed every 5 minutes while shown. */
export function useLiveMicrosoft(range: { from: string; to: string }, enabled: boolean) {
  const { accountId, mode } = useConnection();
  return useQuery({
    queryKey: ['watch-ms', mode, accountId, range.from, range.to],
    enabled: enabled && !!accountId,
    refetchInterval: LIVE_MS,
    refetchIntervalInBackground: false,
    staleTime: LIVE_MS - 15_000,
    retry: 1,
    queryFn: async ({ signal }) => {
      const backend = await getBackend();
      if (!backend.productMetrics) throw new Error('Produkttal findes ikke for denne forbindelse.');
      return backend.productMetrics(accountId!, range, signal);
    },
  });
}

/** The shop's own sales per SKU (Inventarland) for the period. */
export function useLiveShop(range: { from: string; to: string }, enabled: boolean) {
  return useQuery({
    queryKey: ['watch-shop', range.from, range.to],
    enabled,
    refetchInterval: LIVE_MS,
    refetchIntervalInBackground: false,
    staleTime: LIVE_MS - 15_000,
    retry: 1,
    queryFn: async () => {
      const res = await inventarland<{ products: { sku: string; name: string; units: number; revenue: number }[] }>('products', { from: range.from, to: range.to, compare: 'previous' });
      return new Map(res.products.map((p) => [p.sku.toLowerCase(), { name: p.name, units: p.units, revenue: p.revenue }]));
    },
  });
}
