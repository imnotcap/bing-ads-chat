/** Read-only tools: account structure, performance, reports and research. */
import { z } from 'zod';
import { change, derive, sumMetrics } from '@/bing/metrics';
import { getSpendStatus } from '@/bing/spend';
import type { ReportKind, ReportRow } from '@/bing/types';
import { previousRange } from '@/lib/format';
import { round } from '@/lib/utils';
import { useActivity } from '@/stores/activity';
import type { VisualColumn } from '../visuals';
import {
  PERIOD_DESCRIPTION,
  compact,
  defineRead,
  getAdGroups,
  getCampaign,
  getCampaigns,
  getKeywords,
  getReport,
  resolvePeriod,
  statusLabel,
} from './context';

const METRIC_COLS: VisualColumn[] = [
  { key: 'spend', label: 'Forbrug', format: 'money' },
  { key: 'clicks', label: 'Klik', format: 'number' },
  { key: 'conversions', label: 'Konv.', format: 'decimal' },
  { key: 'cpa', label: 'CPA', format: 'money' },
  { key: 'roas', label: 'ROAS', format: 'ratio' },
];

const metricFields = (r: Partial<ReportRow> | undefined) =>
  r
    ? {
        impressions: r.impressions,
        clicks: r.clicks,
        spend: r.spend,
        conversions: r.conversions,
        revenue: r.revenue,
        ctr: r.ctr,
        cpc: r.cpc,
        cpa: r.cpa,
        roas: r.roas,
        convRate: r.convRate,
      }
    : { impressions: 0, clicks: 0, spend: 0, conversions: 0, revenue: 0 };

const SORT_KEYS = ['spend', 'clicks', 'impressions', 'conversions', 'revenue', 'ctr', 'cpc', 'cpa', 'roas', 'convRate'] as const;

function sortRows<T extends object>(rows: T[], key: string, dir: 'asc' | 'desc'): T[] {
  const sign = dir === 'asc' ? 1 : -1;
  return [...rows].sort((a, b) => {
    const av = (a as Record<string, unknown>)[key];
    const bv = (b as Record<string, unknown>)[key];
    const an = typeof av === 'number' ? av : null;
    const bn = typeof bv === 'number' ? bv : null;
    if (an === null && bn === null) return 0;
    if (an === null) return 1;
    if (bn === null) return -1;
    return (an - bn) * sign;
  });
}

const withMetrics = z.boolean().optional().describe('Include performance metrics for the period (default true).');

export const readTools = [
  defineRead({
    name: 'list_accounts',
    kind: 'read',
    description: 'List the Microsoft Advertising accounts the user can access, and which one is selected in the app.',
    schema: z.object({}),
    label: () => 'Henter annoncekonti',
    async run(_input, ctx) {
      const accounts = await ctx.backend.listAccounts();
      return {
        result: accounts.map((a) => ({ ...a, selected: a.id === ctx.accountId })),
        summary: `${accounts.length} konti`,
        preview: {
          columns: [
            { key: 'name', label: 'Konto' },
            { key: 'id', label: 'ID' },
            { key: 'currency', label: 'Valuta' },
          ],
          rows: accounts.map((a) => ({ name: a.name, id: a.id, currency: a.currency })),
        },
      };
    },
  }),

  defineRead({
    name: 'get_performance_overview',
    kind: 'read',
    description:
      'Account-level KPIs for a period compared with the previous period of equal length, a daily trend and the top campaigns. The app automatically shows KPI tiles and a trend chart to the user – summarise the insights instead of repeating every number.',
    schema: z.object({ period: z.string().optional().describe(PERIOD_DESCRIPTION) }),
    label: () => 'Henter overblik',
    async run(input, ctx) {
      const period = resolvePeriod(input.period, ctx);
      const prev = previousRange(period);
      const [daily, previous, campaigns] = await Promise.all([
        getReport(ctx, { kind: 'account', range: period, aggregation: 'Daily' }),
        getReport(ctx, { kind: 'account', range: prev, aggregation: 'Summary' }),
        getReport(ctx, { kind: 'campaign', range: period, aggregation: 'Summary' }),
      ]);
      const cur = derive(sumMetrics(daily));
      const pre = derive(sumMetrics(previous));
      const keys = ['spend', 'clicks', 'impressions', 'conversions', 'revenue', 'ctr', 'cpc', 'cpa', 'roas'] as const;
      const changes = Object.fromEntries(keys.map((k) => [k, change(cur[k], pre[k])]));
      const top = [...campaigns].sort((a, b) => (b.spend ?? 0) - (a.spend ?? 0)).slice(0, 10);
      return {
        result: {
          period,
          previousPeriod: prev,
          currency: ctx.currency,
          totals: cur,
          previousTotals: pre,
          change: changes,
          daily: daily.map((d) => ({ date: d.date, spend: d.spend, clicks: d.clicks, conversions: d.conversions, revenue: d.revenue })),
          topCampaigns: top.map((c) => compact({ campaignId: c.campaignId, name: c.campaignName, status: c.campaignStatus, ...metricFields(c) })),
        },
        summary: `${period.label} · ${top.length} kampagner`,
        visual: {
          type: 'kpis',
          title: `Overblik · ${period.label}`,
          items: [
            { label: 'Forbrug', value: cur.spend, format: 'money', change: changes.spend, invert: true },
            { label: 'Klik', value: cur.clicks, format: 'number', change: changes.clicks },
            { label: 'Konverteringer', value: cur.conversions, format: 'decimal', change: changes.conversions },
            { label: 'CPA', value: cur.cpa, format: 'money', change: changes.cpa, invert: true },
            { label: 'Omsætning', value: cur.revenue, format: 'money', change: changes.revenue },
            { label: 'ROAS', value: cur.roas, format: 'ratio', change: changes.roas },
          ],
        },
        preview: {
          columns: [{ key: 'name', label: 'Kampagne' }, ...METRIC_COLS],
          rows: top.map((c) => ({ name: c.campaignName ?? '', ...metricFields(c) })),
        },
      };
    },
  }),

  defineRead({
    name: 'list_campaigns',
    kind: 'read',
    description: 'List campaigns with id, status, type, daily budget and bid strategy, optionally with performance metrics for a period. Sorted by spend.',
    schema: z.object({
      period: z.string().optional().describe(PERIOD_DESCRIPTION),
      includeMetrics: withMetrics,
      status: z.enum(['all', 'active', 'paused']).optional().describe('Filter by status (default all, deleted are never shown).'),
    }),
    label: () => 'Henter kampagner',
    async run(input, ctx) {
      const period = resolvePeriod(input.period, ctx);
      const campaigns = (await getCampaigns(ctx)).filter((c) =>
        input.status === 'active' ? c.status === 'Active' : input.status === 'paused' ? c.status !== 'Active' : true,
      );
      const metrics = input.includeMetrics === false ? null : await getReport(ctx, { kind: 'campaign', range: period, aggregation: 'Summary' });
      const byId = new Map((metrics ?? []).map((r) => [r.campaignId, r]));
      const rows = campaigns.map((c) => ({
        ...compact({
          id: c.id,
          name: c.name,
          status: c.status,
          type: c.type,
          dailyBudget: c.dailyBudget,
          sharedBudget: c.sharedBudgetId ? true : undefined,
          bidStrategy: c.bidStrategy.type,
          targetCpa: c.bidStrategy.targetCpa,
          targetRoas: c.bidStrategy.targetRoas,
          maxCpc: c.bidStrategy.maxCpc,
        }),
        ...(metrics ? metricFields(byId.get(c.id)) : {}),
      }));
      const sorted = metrics ? sortRows(rows, 'spend', 'desc') : rows;
      return {
        result: { period: metrics ? period : undefined, currency: ctx.currency, campaigns: sorted },
        summary: `${campaigns.length} kampagner`,
        preview: {
          columns: [
            { key: 'name', label: 'Kampagne' },
            { key: 'statusLabel', label: 'Status' },
            { key: 'dailyBudget', label: 'Dagsbudget', format: 'money' },
            ...(metrics ? METRIC_COLS : []),
          ],
          rows: sorted.map((r) => ({ ...r, statusLabel: statusLabel(r.status as string) })),
        },
      };
    },
  }),

  defineRead({
    name: 'list_ad_groups',
    kind: 'read',
    description: 'List the ad groups in a campaign with status, CPC bid and (optionally) metrics for a period.',
    schema: z.object({
      campaignId: z.string().describe('Campaign id'),
      period: z.string().optional().describe(PERIOD_DESCRIPTION),
      includeMetrics: withMetrics,
    }),
    label: () => 'Henter annoncegrupper',
    async run(input, ctx) {
      const period = resolvePeriod(input.period, ctx);
      const campaign = await getCampaign(ctx, input.campaignId);
      const groups = await getAdGroups(ctx, campaign.id);
      const metrics =
        input.includeMetrics === false ? null : await getReport(ctx, { kind: 'adgroup', range: period, aggregation: 'Summary', campaignIds: [campaign.id] });
      const byId = new Map((metrics ?? []).map((r) => [r.adGroupId, r]));
      const rows = groups.map((g) => ({ ...compact({ id: g.id, name: g.name, status: g.status, cpcBid: g.cpcBid }), ...(metrics ? metricFields(byId.get(g.id)) : {}) }));
      return {
        result: { campaign: { id: campaign.id, name: campaign.name }, period: metrics ? period : undefined, adGroups: metrics ? sortRows(rows, 'spend', 'desc') : rows },
        summary: `${groups.length} annoncegrupper i ${campaign.name}`,
        preview: {
          columns: [{ key: 'name', label: 'Annoncegruppe' }, { key: 'cpcBid', label: 'CPC-bud', format: 'money' }, ...(metrics ? METRIC_COLS : [])],
          rows,
        },
      };
    },
  }),

  defineRead({
    name: 'list_keywords',
    kind: 'read',
    description:
      'List keywords (text, match type, status, bid, quality score) for an ad group – or for all ad groups in a campaign when only campaignId is given – with optional metrics for a period.',
    schema: z.object({
      campaignId: z.string().describe('Campaign id'),
      adGroupId: z.string().optional().describe('Ad group id. Omit to list keywords of every ad group in the campaign.'),
      period: z.string().optional().describe(PERIOD_DESCRIPTION),
      includeMetrics: withMetrics,
      limit: z.number().int().min(1).max(500).optional().describe('Max rows (default 100), sorted by spend.'),
    }),
    label: () => 'Henter søgeord',
    async run(input, ctx) {
      const period = resolvePeriod(input.period, ctx);
      const campaign = await getCampaign(ctx, input.campaignId);
      const groups = (await getAdGroups(ctx, campaign.id)).filter((g) => !input.adGroupId || g.id === String(input.adGroupId));
      if (input.adGroupId && !groups.length) throw new Error(`Annoncegruppe ${input.adGroupId} findes ikke i kampagne ${campaign.id}.`);
      const lists = await Promise.all(groups.map((g) => getKeywords(ctx, g.id).then((k) => k.map((x) => ({ ...x, adGroupName: g.name })))));
      const keywords = lists.flat();
      const metrics =
        input.includeMetrics === false ? null : await getReport(ctx, { kind: 'keyword', range: period, aggregation: 'Summary', campaignIds: [campaign.id] });
      const byId = new Map((metrics ?? []).map((r) => [r.keywordId, r]));
      let rows = keywords.map((k) => {
        const m = byId.get(k.id);
        return {
          ...compact({
            id: k.id,
            adGroupId: k.adGroupId,
            adGroupName: k.adGroupName,
            text: k.text,
            matchType: k.matchType,
            status: k.status,
            bid: k.bid,
            qualityScore: k.qualityScore ?? m?.qualityScore,
          }),
          ...(metrics ? metricFields(m) : {}),
        };
      });
      if (metrics) rows = sortRows(rows, 'spend', 'desc');
      const limit = input.limit ?? 100;
      return {
        result: { campaign: { id: campaign.id, name: campaign.name }, period: metrics ? period : undefined, totalKeywords: rows.length, keywords: rows.slice(0, limit) },
        summary: `${keywords.length} søgeord`,
        preview: {
          columns: [
            { key: 'text', label: 'Søgeord' },
            { key: 'matchType', label: 'Match' },
            { key: 'bid', label: 'Bud', format: 'money' },
            ...(metrics ? METRIC_COLS : []),
          ],
          rows: rows.slice(0, 100),
          total: rows.length,
        },
      };
    },
  }),

  defineRead({
    name: 'list_ads',
    kind: 'read',
    description: 'List ads (headlines, descriptions, final URL, status) in an ad group, or in all ad groups of a campaign, with optional metrics.',
    schema: z.object({
      campaignId: z.string(),
      adGroupId: z.string().optional(),
      period: z.string().optional().describe(PERIOD_DESCRIPTION),
      includeMetrics: withMetrics,
    }),
    label: () => 'Henter annoncer',
    async run(input, ctx) {
      const period = resolvePeriod(input.period, ctx);
      const campaign = await getCampaign(ctx, input.campaignId);
      const groups = (await getAdGroups(ctx, campaign.id)).filter((g) => !input.adGroupId || g.id === String(input.adGroupId));
      const ads = (await Promise.all(groups.map((g) => ctx.backend.listAds(ctx.accountId, g.id).then((a) => a.map((x) => ({ ...x, adGroupName: g.name })))))).flat();
      const metrics =
        input.includeMetrics === false ? null : await getReport(ctx, { kind: 'ad', range: period, aggregation: 'Summary', campaignIds: [campaign.id] });
      const byId = new Map((metrics ?? []).map((r) => [r.adId, r]));
      const rows = ads.map((a) => ({
        ...compact({ id: a.id, adGroupId: a.adGroupId, adGroupName: a.adGroupName, type: a.type, status: a.status, path1: a.path1, path2: a.path2 }),
        headlines: a.headlines,
        descriptions: a.descriptions,
        finalUrls: a.finalUrls,
        ...(metrics ? metricFields(byId.get(a.id)) : {}),
      }));
      return {
        result: { campaign: { id: campaign.id, name: campaign.name }, period: metrics ? period : undefined, ads: rows },
        summary: `${ads.length} annoncer`,
        preview: {
          columns: [{ key: 'headline', label: 'Overskrifter' }, { key: 'adGroupName', label: 'Annoncegruppe' }, ...(metrics ? METRIC_COLS.slice(0, 3) : [])],
          rows: rows.map((r) => ({ ...r, headline: r.headlines.slice(0, 3).join(' | '), headlines: undefined, descriptions: undefined, finalUrls: undefined })),
        },
      };
    },
  }),

  defineRead({
    name: 'list_negative_keywords',
    kind: 'read',
    description: 'List negative keywords on a campaign (omit adGroupId) or on an ad group.',
    schema: z.object({ campaignId: z.string(), adGroupId: z.string().optional() }),
    label: () => 'Henter negative søgeord',
    async run(input, ctx) {
      const campaign = await getCampaign(ctx, input.campaignId);
      const entityType = input.adGroupId ? 'AdGroup' : 'Campaign';
      const negatives = await ctx.backend.listNegativeKeywords(ctx.accountId, entityType, input.adGroupId ?? campaign.id);
      return {
        result: { level: entityType, campaign: campaign.name, negatives },
        summary: `${negatives.length} negative søgeord`,
        preview: { columns: [{ key: 'text', label: 'Negativt søgeord' }, { key: 'matchType', label: 'Match' }], rows: negatives.map((n) => ({ ...n })) },
      };
    },
  }),

  defineRead({
    name: 'run_report',
    kind: 'read',
    description: `Run a performance report. Kinds: account, campaign, adgroup, keyword, searchterm (actual search queries – use for finding waste and negative keyword candidates), ad, geo (country/region/city), device, agegender, hourofday, dayofweek.
Rows contain dimensions plus impressions, clicks, spend, conversions, revenue, ctr, cpc, cpa, roas, convRate. Use filters and limit to keep results focused.`,
    schema: z.object({
      kind: z.enum(['account', 'campaign', 'adgroup', 'keyword', 'searchterm', 'ad', 'geo', 'device', 'agegender', 'hourofday', 'dayofweek']),
      period: z.string().optional().describe(PERIOD_DESCRIPTION),
      aggregation: z.enum(['Summary', 'Daily', 'Weekly', 'Monthly']).optional().describe('Default Summary. hourofday/dayofweek are always summarised.'),
      campaignIds: z.array(z.string()).optional().describe('Limit to these campaigns (campaign, adgroup, keyword, searchterm and ad reports).'),
      sortBy: z.enum(SORT_KEYS).optional().describe('Default spend.'),
      sortDirection: z.enum(['asc', 'desc']).optional(),
      limit: z.number().int().min(1).max(1000).optional().describe('Max rows returned (default 100).'),
      minClicks: z.number().optional(),
      minSpend: z.number().optional(),
      onlyWithoutConversions: z.boolean().optional().describe('Only rows with spend but zero conversions.'),
      columns: z
        .array(z.string())
        .optional()
        .describe('Advanced, live accounts only: raw Microsoft Advertising report column names replacing the defaults (e.g. ImpressionSharePercent, ImpressionLostToBudgetPercent).'),
    }),
    label: (i) => `Kører rapport: ${REPORT_LABELS[i.kind as ReportKind] ?? i.kind}`,
    async run(input, ctx) {
      const period = resolvePeriod(input.period, ctx);
      const aggregation = input.aggregation ?? 'Summary';
      let rows = await getReport(ctx, { kind: input.kind, range: period, aggregation, campaignIds: input.campaignIds, columns: input.columns });
      const totals = derive(sumMetrics(rows));
      if (input.minClicks) rows = rows.filter((r) => (r.clicks ?? 0) >= input.minClicks!);
      if (input.minSpend) rows = rows.filter((r) => (r.spend ?? 0) >= input.minSpend!);
      if (input.onlyWithoutConversions) rows = rows.filter((r) => (r.spend ?? 0) > 0 && !(r.conversions ?? 0));
      if (aggregation === 'Summary' || input.sortBy) rows = sortRows(rows, input.sortBy ?? 'spend', input.sortDirection ?? 'desc');
      // The team's limit per query (Budget og grænser → Data): summaries, never everything.
      const limit = Math.min(input.limit ?? 100, ctx.rules.maxRows ?? 200);
      const dims = DIMENSION_COLUMNS[input.kind as ReportKind] ?? [];
      const out = rows.slice(0, limit).map((r) => compact(r as Record<string, unknown>));
      return {
        result: {
          kind: input.kind,
          period,
          aggregation,
          currency: ctx.currency,
          totalRows: rows.length,
          totalsAllRows: totals,
          rows: out,
          ...(rows.length > limit ? { note: `Showing ${limit} of ${rows.length} rows (team limit ${ctx.rules.maxRows ?? 200} per query) – filter or sort to see others.` } : {}),
        },
        summary: `${rows.length} rækker · ${period.label}`,
        preview: {
          columns: [...(aggregation !== 'Summary' ? [{ key: 'date', label: 'Periode', format: 'date' as const }] : []), ...dims, ...METRIC_COLS],
          rows: rows.slice(0, 100),
          total: rows.length,
        },
      };
    },
  }),

  defineRead({
    name: 'get_keyword_ideas',
    kind: 'read',
    description: 'Keyword research via Microsoft Advertising Ad Insight: ideas with average monthly searches, competition and suggested bid, from seed queries and/or a landing page URL.',
    schema: z.object({
      queries: z.array(z.string()).max(20).describe('Seed keywords'),
      url: z.string().optional().describe('Landing page URL to get ideas from'),
      language: z.string().optional().describe('Language name as Microsoft expects, e.g. Danish (default), English, German, Swedish'),
      limit: z.number().int().min(1).max(200).optional(),
    }),
    label: () => 'Finder søgeordsidéer',
    async run(input, ctx) {
      const ideas = await ctx.backend.keywordIdeas(ctx.accountId, { queries: input.queries, url: input.url, language: input.language, limit: input.limit });
      return {
        result: { ideas },
        summary: `${ideas.length} idéer`,
        preview: {
          columns: [
            { key: 'keyword', label: 'Søgeord' },
            { key: 'monthlySearches', label: 'Søgninger/md.', format: 'number' },
            { key: 'competition', label: 'Konkurrence' },
            { key: 'suggestedBid', label: 'Foreslået bud', format: 'money' },
          ],
          rows: ideas.map((i) => ({ ...i })),
        },
      };
    },
  }),

  defineRead({
    name: 'get_budget_opportunities',
    kind: 'read',
    description: 'Microsoft Advertising budget recommendations for campaigns limited by budget (suggested budget and estimated extra clicks/conversions).',
    schema: z.object({ campaignId: z.string().optional() }),
    label: () => 'Henter budgetanbefalinger',
    async run(input, ctx) {
      const opps = await ctx.backend.budgetOpportunities(ctx.accountId, input.campaignId);
      const campaigns = await getCampaigns(ctx);
      const rows = opps.map((o) => ({ ...o, campaignName: o.campaignName ?? campaigns.find((c) => c.id === o.campaignId)?.name }));
      return {
        result: { currency: ctx.currency, opportunities: rows },
        summary: rows.length ? `${rows.length} kampagner er begrænset af budget` : 'Ingen budgetanbefalinger',
        preview: {
          columns: [
            { key: 'campaignName', label: 'Kampagne' },
            { key: 'currentBudget', label: 'Nu', format: 'money' },
            { key: 'suggestedBudget', label: 'Foreslået', format: 'money' },
            { key: 'increaseInClicks', label: '+ Klik', format: 'number' },
          ],
          rows,
        },
      };
    },
  }),

  defineRead({
    name: 'get_spend_status',
    kind: 'read',
    description:
      "Month-to-date spend, the user's monthly budget and spending rules, the sum of active daily budgets and two month-end forecasts (run-rate and budgets fully used). Use before proposing budget increases.",
    schema: z.object({}),
    label: () => 'Tjekker forbrug og budget',
    async run(_input, ctx) {
      const s = await getSpendStatus(ctx.backend, ctx.accountId, ctx.rules.monthlyBudget);
      const r = ctx.rules;
      return {
        result: {
          currency: ctx.currency,
          ...s,
          monthToDateSpend: round(s.monthToDateSpend),
          forecastByRunRate: round(s.forecastByRunRate),
          forecastByBudgets: round(s.forecastByBudgets),
          spendingRules: {
            approval: 'every change needs the user’s approval',
            monthlyBudget: r.monthlyBudget,
            maxDailyBudgetPerCampaign: r.maxDailyBudgetPerCampaign,
            maxTotalDailyBudget: r.maxTotalDailyBudget,
            maxBudgetIncreasePct: r.maxBudgetIncreasePct,
            maxCpcBid: r.maxCpcBid,
            allowCreateCampaigns: r.allowCreateCampaigns,
            allowDelete: r.allowDelete,
            newEntitiesPaused: r.newEntitiesPaused,
            protectedCampaignIds: r.protectedCampaignIds,
          },
        },
        summary: r.monthlyBudget ? `${Math.round((s.shareOfMonthlyBudget ?? 0) * 100)} % af månedsbudgettet brugt` : 'Forbrug denne måned',
        visual: {
          type: 'kpis',
          title: 'Forbrug denne måned',
          items: [
            { label: 'Brugt indtil nu', value: s.monthToDateSpend, format: 'money' },
            { label: 'Prognose (tempo)', value: s.forecastByRunRate, format: 'money' },
            { label: 'Aktive dagsbudgetter', value: s.totalActiveDailyBudget, format: 'money' },
            ...(r.monthlyBudget ? [{ label: 'Månedsbudget', value: r.monthlyBudget, format: 'money' as const }] : []),
          ],
        },
      };
    },
  }),

  defineRead({
    name: 'get_change_history',
    kind: 'read',
    description: 'Recent changes made through this app (by the assistant, the user or the budget guard), newest first, including rejected and blocked proposals.',
    schema: z.object({ limit: z.number().int().min(1).max(100).optional() }),
    label: () => 'Henter ændringslog',
    async run(input, ctx) {
      const entries = useActivity
        .getState()
        .entries.filter((e) => e.accountId === ctx.accountId && e.mode === ctx.backend.mode)
        .slice(0, input.limit ?? 20)
        .map((e) => compact({ when: new Date(e.ts).toISOString(), source: e.source, status: e.status, summary: e.summary, changes: e.changes, error: e.error, undone: e.undone }));
      return { result: { entries }, summary: `${entries.length} ændringer` };
    },
  }),
];

export const REPORT_LABELS: Record<ReportKind, string> = {
  account: 'Konto',
  campaign: 'Kampagner',
  adgroup: 'Annoncegrupper',
  keyword: 'Søgeord',
  searchterm: 'Søgetermer',
  ad: 'Annoncer',
  geo: 'Geografi',
  device: 'Enheder',
  agegender: 'Alder og køn',
  hourofday: 'Time på dagen',
  dayofweek: 'Ugedag',
};

const DIMENSION_COLUMNS: Record<ReportKind, VisualColumn[]> = {
  account: [],
  campaign: [{ key: 'campaignName', label: 'Kampagne' }],
  adgroup: [
    { key: 'adGroupName', label: 'Annoncegruppe' },
    { key: 'campaignName', label: 'Kampagne' },
  ],
  keyword: [
    { key: 'keyword', label: 'Søgeord' },
    { key: 'matchType', label: 'Match' },
  ],
  searchterm: [
    { key: 'searchTerm', label: 'Søgeterm' },
    { key: 'keyword', label: 'Søgeord' },
    { key: 'campaignName', label: 'Kampagne' },
  ],
  ad: [{ key: 'adTitle', label: 'Annonce' }],
  geo: [
    { key: 'city', label: 'By' },
    { key: 'region', label: 'Region' },
  ],
  device: [{ key: 'device', label: 'Enhed' }],
  agegender: [
    { key: 'ageGroup', label: 'Alder' },
    { key: 'gender', label: 'Køn' },
  ],
  hourofday: [{ key: 'hour', label: 'Time' }],
  dayofweek: [{ key: 'dayOfWeek', label: 'Ugedag' }],
};
