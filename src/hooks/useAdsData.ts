import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { getBackend } from '@/bing/backend';
import type { DailyView } from '@/bing/dailyReport';
import { derive, sumMetrics } from '@/bing/metrics';
import { getSpendStatus } from '@/bing/spend';
import type { Campaign, ReportRow } from '@/bing/types';
import { presetRange, previousRange, type DateRange } from '@/lib/format';
import { useConnection } from '@/stores/connection';
import { useSettings } from '@/stores/settings';
import { queryClient } from '@/lib/queryClient';
import { loadProducts } from '@/workspace/products';
import { historyRange, loadDaily } from '@/workspace/daily';

function useKeyBase() {
  const mode = useConnection((s) => s.mode);
  const accountId = useConnection((s) => s.accountId);
  const revision = useConnection((s) => s.revision);
  return { mode, accountId, revision, base: [mode, accountId, revision] as const };
}

export function useSelectedRange(): DateRange & { preset: ReturnType<typeof useSettings.getState>['datePreset'] } {
  const preset = useSettings((s) => s.datePreset);
  return { ...presetRange(preset), preset };
}

export interface CampaignRow extends Campaign {
  metrics: ReportRow | null;
}

export function useCampaigns(range: DateRange) {
  const { accountId, base } = useKeyBase();
  return useQuery({
    queryKey: ['campaigns', ...base, range.from, range.to],
    enabled: !!accountId,
    queryFn: async (): Promise<CampaignRow[]> => {
      const backend = await getBackend();
      const [campaigns, rows] = await Promise.all([
        backend.listCampaigns(accountId!),
        backend.runReport(accountId!, { kind: 'campaign', range, aggregation: 'Summary' }),
      ]);
      const byId = new Map(rows.map((r) => [r.campaignId, r]));
      return campaigns.map((c) => ({ ...c, metrics: byId.get(c.id) ?? null })).sort((a, b) => (b.metrics?.spend ?? 0) - (a.metrics?.spend ?? 0));
    },
  });
}

export function useAccountTrend(range: DateRange) {
  const { accountId, base } = useKeyBase();
  const history = useDailyHistory();
  const prev = previousRange(range);
  const stored = useMemo(() => {
    const daily = storedRows(history.data, range);
    const before = storedRows(history.data, prev);
    return daily && before ? { daily, totals: derive(sumMetrics(daily)), previous: derive(sumMetrics(before)) } : null;
    // Keyed on the dates, not on the range objects (new ones every render).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [history.data, range.from, range.to]);
  // Straight from Microsoft only until the store has the days (the very first load).
  const direct = useQuery({
    queryKey: ['trend', ...base, range.from, range.to],
    enabled: !!accountId && !history.isPending && !stored,
    queryFn: async () => {
      const backend = await getBackend();
      const [daily, previous] = await Promise.all([
        backend.runReport(accountId!, { kind: 'account', range, aggregation: 'Daily' }),
        backend.runReport(accountId!, { kind: 'account', range: prev, aggregation: 'Summary' }),
      ]);
      return { daily, totals: derive(sumMetrics(daily)), previous: derive(sumMetrics(previous)) };
    },
  });
  return { data: stored ?? direct.data, isFetching: history.isFetching || direct.isFetching, error: stored ? null : (direct.error ?? history.error) };
}

export function useSpendStatus() {
  const { accountId, base } = useKeyBase();
  const monthlyBudget = useSettings((s) => s.spend.monthlyBudget);
  return useQuery({
    queryKey: ['spend', ...base, monthlyBudget],
    enabled: !!accountId,
    queryFn: async () => getSpendStatus(await getBackend(), accountId!, monthlyBudget),
  });
}

/** Products worth showing in the period (shared cache on Cloudflare, see workspace/products.ts). */
export function useProducts(range: DateRange) {
  const { accountId, base } = useKeyBase();
  return useQuery({
    queryKey: ['products', ...base, range.from, range.to],
    enabled: !!accountId,
    queryFn: ({ signal }) => loadProducts(accountId!, range, { signal }),
  });
}

/** Fetches the products from Microsoft again (the Opdatér button). */
export async function refreshProducts(range: DateRange) {
  const { accountId, mode, revision } = useConnection.getState();
  if (!accountId) return;
  const fresh = await loadProducts(accountId, range, { force: true });
  queryClient.setQueryData(['products', mode, accountId, revision, range.from, range.to], fresh);
}

/**
 * The stored days of the last 13 months – one request that the daily overview and the
 * dashboard's charts all read from (workspace/daily.ts). While the Worker is fetching it
 * asks again every few seconds; that is the Worker, never Microsoft.
 */
export function useDailyHistory() {
  const { accountId, base } = useKeyBase();
  const range = historyRange();
  return useQuery({
    queryKey: ['daily', ...base, range.from, range.to],
    enabled: !!accountId,
    queryFn: ({ signal }) => loadDaily(accountId!, range, { signal }),
    refetchInterval: (q) => (q.state.data?.syncing ? 4_000 : false),
  });
}

/** Days further back than the 13 months (the daily overview stepped back): fetched once by the Worker, then kept. */
export function useDailyRange(range: DateRange, enabled: boolean) {
  const { accountId, base } = useKeyBase();
  return useQuery({
    queryKey: ['daily', ...base, range.from, range.to],
    enabled: !!accountId && enabled,
    queryFn: ({ signal }) => loadDaily(accountId!, range, { signal }),
    refetchInterval: (q) => (q.state.data?.syncing ? 4_000 : false),
  });
}

/**
 * The Opdatér buttons: the Worker fetches today again (at most every 5 minutes, also
 * outside office hours), and everything on screen is read again.
 */
export async function refreshAdsData() {
  const { accountId, mode, revision } = useConnection.getState();
  if (accountId) {
    const range = historyRange();
    const view = await loadDaily(accountId, range, { refresh: true }).catch(() => null);
    if (view) queryClient.setQueryData(['daily', mode, accountId, revision, range.from, range.to], view);
  }
  await queryClient.invalidateQueries();
}

/**
 * The stored days of a range as report rows – or null when the store does not reach back
 * to the range's start (not fetched yet). Days after the last stored one are simply not
 * there yet: outside office hours the numbers stay as they were last fetched.
 */
function storedRows(view: DailyView | undefined, range: DateRange): ReportRow[] | null {
  if (!view?.coverage || view.coverage.from > range.from) return null;
  return view.days.filter((d) => d.day >= range.from && d.day <= range.to).map((d) => ({ date: d.day, ...derive(d) }));
}

const byDate = (rows: ReportRow[]) => [...rows].sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''));

function periodTrend(daily: ReportRow[], before: ReportRow[], previous: DateRange) {
  const sameDays = before.filter((d) => (d.date ?? '') >= previous.from && (d.date ?? '') <= previous.to);
  return { daily: byDate(daily), previousDaily: byDate(before), totals: derive(sumMetrics(daily)), previous: derive(sumMetrics(sameDays)) };
}

/**
 * Day by day for a period and the whole period before (the dashboard's chart); the
 * totals compare with the same days of the period before (`previous`).
 */
export function usePeriodTrend(range: DateRange, previous: DateRange, previousFull: DateRange) {
  const { accountId, base } = useKeyBase();
  const history = useDailyHistory();
  const stored = useMemo(() => {
    const daily = storedRows(history.data, range);
    const before = storedRows(history.data, previousFull);
    return daily && before ? periodTrend(daily, before, previous) : null;
    // Keyed on the dates, not on the range objects (new ones every render).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [history.data, range.from, range.to, previous.from, previous.to, previousFull.from, previousFull.to]);
  // Straight from Microsoft only until the store has the days (the very first load).
  const direct = useQuery({
    queryKey: ['period-trend', ...base, range.from, range.to, previous.to, previousFull.from, previousFull.to],
    enabled: !!accountId && !history.isPending && !stored,
    queryFn: async () => {
      const backend = await getBackend();
      const [daily, before] = await Promise.all([
        backend.runReport(accountId!, { kind: 'account', range, aggregation: 'Daily' }),
        backend.runReport(accountId!, { kind: 'account', range: previousFull, aggregation: 'Daily' }),
      ]);
      return periodTrend(daily, before, previous);
    },
  });
  return { data: stored ?? direct.data, isFetching: history.isFetching || direct.isFetching, error: stored ? null : (direct.error ?? history.error) };
}
