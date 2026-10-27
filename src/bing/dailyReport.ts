/**
 * The account's numbers day by day – what the daily overview and the dashboard are built
 * from. Shared by the app and the Cloudflare Worker, which fetches the report on its own
 * and keeps it (cloudflare/src/adsDaily.ts), so nothing here may use the app's `@/` path
 * alias.
 *
 * Only the five measures that add up are kept. Everything else – CTR, CPC, conversion
 * rate, cost per conversion, ROAS – is worked out from their sums, which is the only way
 * a week or a month comes out right: averaging seven daily ROAS figures does not give the
 * week's ROAS.
 */
import { eachDay, type DateRange } from '../lib/format';
import { msDate, normalizeReportDate, toNumber } from './reportBasics';

export interface DayMetrics {
  /** ISO date, a Danish calendar day (the report runs in Copenhagen time). */
  day: string;
  impressions: number;
  clicks: number;
  spend: number;
  conversions: number;
  revenue: number;
}

/**
 * The same report the app has always asked Microsoft for (reports.ts, kind "account",
 * aggregation "Daily"), written out so the Worker can send it. A test holds the two equal.
 */
export function buildDailyAccountRequest(accountId: string, range: DateRange): Record<string, unknown> {
  return {
    Type: 'AccountPerformanceReportRequest',
    ReportName: 'XavierOS – account',
    Aggregation: 'Daily',
    Columns: ['TimePeriod', 'AccountName', 'Impressions', 'Clicks', 'Spend', 'Conversions', 'Revenue'],
    ExcludeColumnHeaders: false,
    ExcludeReportFooter: true,
    ExcludeReportHeader: true,
    Format: 'Csv',
    FormatVersion: '2.0',
    ReturnOnlyCompleteData: false,
    Scope: { AccountIds: [Number(accountId)] },
    Time: {
      CustomDateRangeStart: msDate(range.from),
      CustomDateRangeEnd: msDate(range.to),
      ReportTimeZone: 'BrusselsCopenhagenMadridParis',
    },
  };
}

/** How far back an account is kept: 13 months, so a month can be set against the same month a year before. */
export const DAILY_HISTORY_DAYS = 395;

/** What the workspace answers for an account's days (cloudflare/src/adsDaily.ts). */
export interface DailyView {
  accountId: string;
  /** Today in Copenhagen – the app marks it (and the running week and month) as not final. */
  today: string;
  days: DayMetrics[];
  /** The first and last stored day (every day in between is stored). */
  coverage: DateRange | null;
  /** When the newest of the returned days was read from Microsoft (ms). */
  fetchedAt: number | null;
  /** A report is on its way – ask again in a moment. */
  syncing: boolean;
  /** Why the last sync failed, if it did. */
  error: string | null;
  /** Weekdays 8–16: the numbers are kept up to date on their own. */
  office: boolean;
}

const empty = (day: string): DayMetrics => ({ day, impressions: 0, clicks: 0, spend: 0, conversions: 0, revenue: 0 });

/**
 * The report's rows as one entry for every day of the range. A day Microsoft has no row
 * for had no traffic, and is kept as zeros: that is an answer, where a missing day would
 * look like a day nobody has fetched yet.
 */
export function dailyFromRows(raw: Record<string, string>[], range: DateRange): DayMetrics[] {
  const days = new Map(eachDay(range.from, range.to).map((d) => [d, empty(d)]));
  for (const r of raw) {
    const m = days.get(normalizeReportDate(r.TimePeriod ?? ''));
    if (!m) continue;
    m.impressions += toNumber(r.Impressions);
    m.clicks += toNumber(r.Clicks);
    m.spend += toNumber(r.Spend);
    m.conversions += toNumber(r.Conversions);
    m.revenue += toNumber(r.Revenue);
  }
  return [...days.values()];
}
