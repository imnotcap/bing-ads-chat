/**
 * Read-only tools on Inventarland's data (the webshop's real sales from Magento and
 * the other ad channels: Google Ads, Meta, Daisycon), fetched through the workspace
 * from Inventarland's API on Cloudflare. Amounts are DKK; change fields there are
 * percent (12.5 = +12,5 %).
 */
import { z } from 'zod';
import { round } from '@/lib/utils';
import { inventarland } from '@/workspace/shared';
import { PERIOD_DESCRIPTION, defineRead, memo, resolvePeriod, type ToolContext } from './context';

const CHANNELS = { google_ads: 'Google Ads', microsoft_ads: 'Microsoft Ads', meta: 'Meta Ads', daisycon: 'Daisycon' } as const;
type Channel = keyof typeof CHANNELS;

interface Meta {
  isDemo: boolean;
  lastSyncedAt: string | null;
  range: { from: string; to: string };
  compareRange: { from: string; to: string } | null;
}

interface AdMetrics {
  spend: number;
  revenue: number;
  roas: number | null;
  conversions: number;
  clicks: number;
  impressions: number;
  ctr: number | null;
  cpc: number | null;
  cpa: number | null;
}

interface SalesKpis {
  revenue: number;
  orders: number;
  aov: number | null;
  refunds: number;
  conversionRate: number | null;
  discount: number;
  units: number;
}

interface TopProduct {
  sku: string;
  name: string;
  units: number;
  revenue: number;
}

interface ProductRow extends TopProduct {
  avgPrice: number | null;
  share: number;
  changePct: number | null;
}

/** Percent from Inventarland (12.5) → the fraction the KPI tiles expect (0.125). */
const frac = (pct: number | null | undefined) => (pct === null || pct === undefined ? null : round(pct / 100, 4));

function query(input: { period?: string }, ctx: ToolContext) {
  const period = resolvePeriod(input.period, ctx);
  return { period, params: { from: period.from, to: period.to, compare: 'previous' } };
}

/** What the model should know about where the numbers come from. */
function source(meta: Meta) {
  return {
    source: 'Inventarland (synkroniseres hver halve time på hverdage)',
    lastSyncedAt: meta.lastSyncedAt,
    compareRange: meta.compareRange,
    ...(meta.isDemo ? { warning: 'Inventarland viser demo-data – ingen kanaler er forbundet der endnu. Brug ikke tallene til beslutninger.' } : {}),
  };
}

export const INVENTARLAND_TOOL_NAMES = new Set(['get_shop_sales', 'get_shop_products', 'get_channel_comparison']);

export const inventarlandTools = [
  defineRead({
    name: 'get_shop_sales',
    kind: 'read',
    description:
      "The webshop's real sales from Magento (via Inventarland) for a period vs. the previous period: revenue, orders, average order value, refunds, units, daily series, sales by weekday and the top products. Use it to judge advertising against actual sales (e.g. Microsoft Ads spend as a share of shop revenue, or whether a drop in conversions is also a drop in sales) – Microsoft's own conversion revenue only covers tracked ad clicks. Change fields are percent.",
    schema: z.object({ period: z.string().optional().describe(PERIOD_DESCRIPTION) }),
    label: () => 'Henter webshoppens salg',
    async run(input, ctx) {
      const { period, params } = query(input, ctx);
      const res = await memo(ctx, `inv:sales:${period.from}:${period.to}`, () =>
        inventarland<{
          meta: Meta;
          kpis: SalesKpis;
          previousKpis: SalesKpis | null;
          changes: Record<string, number | null>;
          series: { date: string; revenue: number; orders: number; refunds: number }[];
          weekdays: { weekday: number; revenue: number; orders: number }[];
          topProducts: TopProduct[];
        }>('sales', params),
      );
      const k = res.kpis;
      return {
        result: { period, currency: 'DKK', ...source(res.meta), kpis: k, previousKpis: res.previousKpis, changesPct: res.changes, daily: res.series, weekdays: res.weekdays, topProducts: res.topProducts.slice(0, 10) },
        summary: `${period.label} · ${Math.round(k.orders)} ordrer${res.meta.isDemo ? ' (demo-data)' : ''}`,
        visual: {
          type: 'kpis',
          title: `Webshop · ${period.label}`,
          items: [
            { label: 'Omsætning', value: k.revenue, format: 'money', change: frac(res.changes.revenue) },
            { label: 'Ordrer', value: k.orders, format: 'number', change: frac(res.changes.orders) },
            { label: 'Gns. ordre', value: k.aov, format: 'money', change: frac(res.changes.aov) },
            { label: 'Refusioner', value: k.refunds, format: 'money', change: frac(res.changes.refunds), invert: true },
          ],
        },
        preview: {
          columns: [
            { key: 'name', label: 'Produkt' },
            { key: 'units', label: 'Stk.', format: 'number' },
            { key: 'revenue', label: 'Omsætning', format: 'money' },
          ],
          rows: res.topProducts.slice(0, 10).map((p) => ({ name: p.name, units: p.units, revenue: p.revenue })),
        },
      };
    },
  }),

  defineRead({
    name: 'get_shop_products',
    kind: 'read',
    description:
      "Products sold in the webshop (Magento via Inventarland) for a period: SKU, name, units, revenue, average price, share of revenue and change vs. the previous period (percent). Use it to find best sellers worth advertising, products that are growing or falling, and to write ads or keywords for products that actually sell.",
    schema: z.object({
      period: z.string().optional().describe(PERIOD_DESCRIPTION),
      search: z.string().optional().describe('Only products whose name or SKU contains this text.'),
      limit: z.number().int().min(1).max(100).optional().describe('Max rows (default 25), sorted by revenue.'),
    }),
    label: (i) => (i.search ? `Finder produkter: ${i.search}` : 'Henter produktsalg'),
    async run(input, ctx) {
      const { period, params } = query(input, ctx);
      const res = await memo(ctx, `inv:products:${period.from}:${period.to}`, () => inventarland<{ meta: Meta; products: ProductRow[] }>('products', params));
      const q = input.search?.trim().toLowerCase();
      const rows = res.products
        .filter((p) => !q || p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, input.limit ?? 25);
      return {
        result: { period, currency: 'DKK', ...source(res.meta), totalProducts: res.products.length, products: rows },
        summary: `${period.label} · ${rows.length} produkter`,
        preview: {
          columns: [
            { key: 'name', label: 'Produkt' },
            { key: 'units', label: 'Stk.', format: 'number' },
            { key: 'revenue', label: 'Omsætning', format: 'money' },
            { key: 'share', label: 'Andel', format: 'percent' },
          ],
          rows: rows.map((p) => ({ name: p.name, units: p.units, revenue: p.revenue, share: p.share })),
        },
      };
    },
  }),

  defineRead({
    name: 'get_channel_comparison',
    kind: 'read',
    description:
      'Compare the ad channels the business uses (Google Ads, Microsoft Ads, Meta Ads and Daisycon affiliate) for a period, from Inventarland: spend, revenue, ROAS, conversions, clicks, CPC and CPA per channel plus totals and change vs. the previous period (percent). With `channel` set it also lists that channel\'s campaigns. Use it to put Microsoft Ads in context (share of spend, ROAS vs. Google) and to spot budget that would work harder elsewhere. Revenue is each platform\'s own attributed revenue, so channels can overlap.',
    schema: z.object({
      period: z.string().optional().describe(PERIOD_DESCRIPTION),
      channel: z.enum(['google_ads', 'microsoft_ads', 'meta', 'daisycon']).optional().describe("Also list this channel's campaigns."),
    }),
    label: (i) => (i.channel ? `Sammenligner kanaler · ${CHANNELS[i.channel]}` : 'Sammenligner kanaler'),
    async run(input, ctx) {
      const { period, params } = query(input, ctx);
      const [res, campaigns] = await Promise.all([
        memo(ctx, `inv:channels:${period.from}:${period.to}`, () =>
          inventarland<{ meta: Meta; totals: AdMetrics; changes: Record<string, number | null>; providers: (AdMetrics & { provider: Channel; revenueChangePct: number | null })[] }>(
            'channels',
            params,
          ),
        ),
        input.channel
          ? memo(ctx, `inv:campaigns:${input.channel}:${period.from}:${period.to}`, () =>
              inventarland<{ campaigns: (AdMetrics & { id: string; name: string; status: string; revenueChangePct: number | null })[] }>('campaigns', { ...params, provider: input.channel }),
            )
          : null,
      ]);
      const rows = res.providers.map((p) => ({ channel: CHANNELS[p.provider] ?? p.provider, ...p }));
      return {
        result: {
          period,
          currency: 'DKK',
          ...source(res.meta),
          totals: res.totals,
          changesPct: res.changes,
          channels: rows,
          ...(campaigns ? { campaigns: campaigns.campaigns.sort((a, b) => b.spend - a.spend).slice(0, 40) } : {}),
        },
        summary: `${period.label} · ${rows.length} kanaler${campaigns ? ` · ${campaigns.campaigns.length} kampagner` : ''}`,
        visual: {
          type: 'table',
          title: `Kanaler · ${period.label}`,
          columns: [
            { key: 'channel', label: 'Kanal' },
            { key: 'spend', label: 'Forbrug', format: 'money' },
            { key: 'revenue', label: 'Omsætning', format: 'money' },
            { key: 'roas', label: 'ROAS', format: 'ratio' },
            { key: 'cpa', label: 'CPA', format: 'money' },
          ],
          rows: rows.map((r) => ({ channel: r.channel, spend: r.spend, revenue: r.revenue, roas: r.roas, cpa: r.cpa })),
        },
      };
    },
  }),
];
