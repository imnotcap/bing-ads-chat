/**
 * Report definitions for the Microsoft Advertising Reporting API v13 and the
 * normalisation of its CSV rows into ReportRow objects.
 * Docs: https://learn.microsoft.com/advertising/guides/request-download-report
 */
import { derive } from './metrics';
import type { ReportKind, ReportRow, ReportSpec } from './types';

const METRIC_COLUMNS = ['Impressions', 'Clicks', 'Spend', 'Conversions', 'Revenue'];

interface ReportDef {
  type: string;
  dimensions: string[];
  /** Aggregation override (hour of day / day of week are aggregations in Microsoft's model). */
  aggregation?: string;
  /** Reports that only accept account scope. */
  accountScopeOnly?: boolean;
}

export const REPORT_DEFS: Record<ReportKind, ReportDef> = {
  account: { type: 'AccountPerformanceReportRequest', dimensions: ['AccountName'], accountScopeOnly: true },
  device: { type: 'AccountPerformanceReportRequest', dimensions: ['DeviceType'], accountScopeOnly: true },
  hourofday: { type: 'AccountPerformanceReportRequest', dimensions: [], aggregation: 'HourOfDay', accountScopeOnly: true },
  dayofweek: { type: 'AccountPerformanceReportRequest', dimensions: [], aggregation: 'DayOfWeek', accountScopeOnly: true },
  campaign: { type: 'CampaignPerformanceReportRequest', dimensions: ['CampaignId', 'CampaignName', 'CampaignStatus'] },
  adgroup: { type: 'AdGroupPerformanceReportRequest', dimensions: ['CampaignId', 'CampaignName', 'AdGroupId', 'AdGroupName', 'Status'] },
  keyword: {
    type: 'KeywordPerformanceReportRequest',
    dimensions: ['CampaignId', 'CampaignName', 'AdGroupId', 'AdGroupName', 'KeywordId', 'Keyword', 'BidMatchType', 'QualityScore', 'CurrentMaxCpc'],
  },
  searchterm: {
    type: 'SearchQueryPerformanceReportRequest',
    dimensions: ['CampaignId', 'CampaignName', 'AdGroupId', 'AdGroupName', 'SearchQuery', 'Keyword'],
  },
  ad: { type: 'AdPerformanceReportRequest', dimensions: ['CampaignName', 'AdGroupId', 'AdGroupName', 'AdId', 'AdTitle', 'AdType'] },
  geo: { type: 'GeographicPerformanceReportRequest', dimensions: ['Country', 'State', 'City'], accountScopeOnly: true },
  agegender: { type: 'AgeGenderAudienceReportRequest', dimensions: ['AgeGroup', 'Gender'], accountScopeOnly: true },
};

function msDate(iso: string) {
  const [y, m, d] = iso.split('-').map(Number);
  return { Day: d, Month: m, Year: y };
}

/** Builds the ReportRequest body for GenerateReport/Submit. */
export function buildReportRequest(accountId: string, spec: ReportSpec): Record<string, unknown> {
  const def = REPORT_DEFS[spec.kind];
  const aggregation = def.aggregation ?? spec.aggregation;
  const withTime = aggregation !== 'Summary';
  const columns = spec.columns?.length ? spec.columns : [...(withTime ? ['TimePeriod'] : []), ...def.dimensions, ...METRIC_COLUMNS];
  const account = Number(accountId);
  const scope: Record<string, unknown> = { AccountIds: [account] };
  if (spec.campaignIds?.length && !def.accountScopeOnly) {
    scope.AccountIds = null;
    scope.Campaigns = spec.campaignIds.map((id) => ({ AccountId: account, CampaignId: Number(id) }));
  }
  return {
    Type: def.type,
    ReportName: `XavierOS – ${spec.kind}`,
    Aggregation: aggregation,
    Columns: columns,
    ExcludeColumnHeaders: false,
    ExcludeReportFooter: true,
    ExcludeReportHeader: true,
    Format: 'Csv',
    FormatVersion: '2.0',
    ReturnOnlyCompleteData: false,
    Scope: scope,
    Time: {
      CustomDateRangeStart: msDate(spec.range.from),
      CustomDateRangeEnd: msDate(spec.range.to),
      ReportTimeZone: 'BrusselsCopenhagenMadridParis',
    },
  };
}

export function toNumber(v: string | undefined): number {
  if (!v) return 0;
  const n = Number(v.replace(/[%,\s]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

/** Accepts "2026-10-07" or "10/7/2026" (format depends on report locale). */
export function normalizeReportDate(value: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(value);
  if (m) return `${m[3]}-${m[1]?.padStart(2, '0')}-${m[2]?.padStart(2, '0')}`;
  return value;
}

const DIMENSION_MAP: Record<string, keyof ReportRow> = {
  CampaignId: 'campaignId',
  CampaignName: 'campaignName',
  CampaignStatus: 'campaignStatus',
  AdGroupId: 'adGroupId',
  AdGroupName: 'adGroupName',
  KeywordId: 'keywordId',
  Keyword: 'keyword',
  BidMatchType: 'matchType',
  SearchQuery: 'searchTerm',
  AdId: 'adId',
  AdTitle: 'adTitle',
  DeviceType: 'device',
  Country: 'country',
  State: 'region',
  City: 'city',
  AgeGroup: 'ageGroup',
  Gender: 'gender',
};

const NUMERIC_DIMENSIONS: Record<string, keyof ReportRow> = {
  QualityScore: 'qualityScore',
  CurrentMaxCpc: 'currentMaxCpc',
};

/** Converts raw CSV rows (keyed by Microsoft column names) into ReportRows. */
export function normalizeReportRows(kind: ReportKind, raw: Record<string, string>[]): ReportRow[] {
  return raw.map((r) => {
    const row: ReportRow = {};
    for (const [col, value] of Object.entries(r)) {
      if (col === 'TimePeriod') {
        if (kind === 'hourofday') row.hour = toNumber(value);
        else if (kind === 'dayofweek') row.dayOfWeek = value;
        else row.date = normalizeReportDate(value);
      } else if (DIMENSION_MAP[col]) {
        row[DIMENSION_MAP[col]] = value as never;
      } else if (NUMERIC_DIMENSIONS[col]) {
        row[NUMERIC_DIMENSIONS[col]] = (value === '' || value === '--' ? null : toNumber(value)) as never;
      } else if (!METRIC_COLUMNS.includes(col)) {
        // Extra (advanced) columns are passed through untouched.
        row[col] = value;
      }
    }
    Object.assign(
      row,
      derive({
        impressions: toNumber(r.Impressions),
        clicks: toNumber(r.Clicks),
        spend: toNumber(r.Spend),
        conversions: toNumber(r.Conversions),
        revenue: toNumber(r.Revenue),
      }),
    );
    return row;
  });
}
