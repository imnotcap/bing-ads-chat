/**
 * The account's numbers day by day – for the daily overview and the dashboard's charts.
 *
 * Read from the workspace on Cloudflare, which keeps 13 months of days and fetches from
 * Microsoft on its own (cloudflare/src/adsDaily.ts): the app shows what is stored at once
 * and never waits on a report, and everyone in the company shares the same fetches. In
 * demo mode – and against a Worker from before the store – the days come straight from
 * the backend, as before.
 */
import { getBackend } from '@/bing/backend';
import { DAILY_HISTORY_DAYS, type DailyView, type DayMetrics } from '@/bing/dailyReport';
import type { ReportRow } from '@/bing/types';
import { addDays, eachDay, today, type DateRange } from '@/lib/format';
import { autoRefreshAllowed } from '@/lib/refreshPolicy';
import { useConnection } from '@/stores/connection';
import { ApiError, api } from './api';

/** The 13 months the workspace keeps – one request that the overview and the charts all read from. */
export const historyRange = (ref = today()): DateRange => ({ from: addDays(ref, -DAILY_HISTORY_DAYS), to: ref });

/** A Daily report from the backend as one entry per day of the range (zeros where it had no row). */
export function daysFromReport(rows: ReportRow[], range: DateRange): DayMetrics[] {
  const byDay = new Map(eachDay(range.from, range.to).map((day) => [day, { day, impressions: 0, clicks: 0, spend: 0, conversions: 0, revenue: 0 }]));
  for (const r of rows) {
    const d = r.date ? byDay.get(r.date) : undefined;
    if (!d) continue;
    d.impressions += r.impressions ?? 0;
    d.clicks += r.clicks ?? 0;
    d.spend += r.spend ?? 0;
    d.conversions += r.conversions ?? 0;
    d.revenue += r.revenue ?? 0;
  }
  return [...byDay.values()];
}

/**
 * The days of a range. `refresh` is the Opdatér button: the Worker fetches today again
 * (at most every 5 minutes) and the answer says it is on its way (`syncing`).
 */
export async function loadDaily(accountId: string, range: DateRange, { refresh = false, signal }: { refresh?: boolean; signal?: AbortSignal } = {}): Promise<DailyView> {
  const backend = await getBackend();
  const live = backend.mode === 'live' && useConnection.getState().mode === 'live';
  if (live) {
    const q = new URLSearchParams({ account: accountId, from: range.from, to: range.to });
    try {
      return await api<DailyView>(`/workspace/ads/daily${refresh ? '/refresh' : ''}?${q}`, { method: refresh ? 'POST' : 'GET', signal });
    } catch (e) {
      // Only a Worker without the route falls back; every other answer is the real one.
      if (!(e instanceof ApiError && e.status === 404)) throw e;
    }
  }
  const rows = await backend.runReport(accountId, { kind: 'account', range, aggregation: 'Daily' }, signal);
  const days = daysFromReport(rows, range);
  return { accountId, today: today(), days, coverage: days.length ? range : null, fetchedAt: Date.now(), syncing: false, error: null, office: autoRefreshAllowed() };
}
