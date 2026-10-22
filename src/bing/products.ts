/**
 * Products (Shopping / Performance Max): Microsoft's product report rows turned into one
 * ProductPerformance per product, and the rule for which products are worth showing.
 * An account can have thousands of products (Inventarland ~9,000) – most never sell, so
 * only products that earned something in the period or the one before are kept.
 */
import type { DateRange } from '@/lib/format';
import { EMPTY_METRICS, addMetrics } from './metrics';
import { msDate, toNumber } from './reports';
import type { Metrics, ProductPerformance, ProductPlacement, ProductStatus } from './types';

/**
 * Columns of ProductDimensionPerformanceReportRequest for the period itself: one row per
 * product × campaign × ad group (asset group for Performance Max – without the asset
 * group columns Microsoft drops the Performance Max rows).
 * Docs: https://learn.microsoft.com/advertising/reporting-service/productdimensionperformancereportcolumn
 */
export const PRODUCT_COLUMNS = [
  'MerchantProductId',
  'Title',
  'Brand',
  'Price',
  'ProductType1',
  'ProductCategory1',
  'ProductCategory2',
  'CampaignId',
  'CampaignName',
  'CampaignType',
  'AdGroupId',
  'AdGroupName',
  'AssetGroupId',
  'AssetGroupName',
];

export const PRODUCT_METRIC_COLUMNS = ['Impressions', 'Clicks', 'Spend', 'Conversions', 'Revenue'];

/** The product report for a period; `detailed` false = only product id and metrics (the period before). */
export function buildProductReportRequest(accountId: string, range: DateRange, detailed: boolean): Record<string, unknown> {
  return {
    Type: 'ProductDimensionPerformanceReportRequest',
    ReportName: `XavierOS – produkter${detailed ? '' : ' (forrige periode)'}`,
    Aggregation: 'Summary',
    Columns: [...(detailed ? PRODUCT_COLUMNS : ['MerchantProductId']), ...PRODUCT_METRIC_COLUMNS],
    ExcludeColumnHeaders: false,
    ExcludeReportFooter: true,
    ExcludeReportHeader: true,
    Format: 'Csv',
    FormatVersion: '2.0',
    ReturnOnlyCompleteData: false,
    Scope: { AccountIds: [Number(accountId)] },
    Time: { CustomDateRangeStart: msDate(range.from), CustomDateRangeEnd: msDate(range.to), ReportTimeZone: 'BrusselsCopenhagenMadridParis' },
  };
}

function metricsOf(r: Record<string, string>): Metrics {
  return {
    impressions: toNumber(r.Impressions),
    clicks: toNumber(r.Clicks),
    spend: toNumber(r.Spend),
    conversions: toNumber(r.Conversions),
    revenue: toNumber(r.Revenue),
  };
}

const text = (v: string | undefined) => {
  const t = (v ?? '').trim();
  return t && t !== '--' ? t : null;
};

/**
 * Turns the report rows of the period (one row per product × campaign × ad group) and
 * of the period before (any granularity) into one entry per product.
 */
export function aggregateProducts(current: Record<string, string>[], previous: Record<string, string>[]): ProductPerformance[] {
  const byId = new Map<string, ProductPerformance>();
  const placements = new Map<string, Map<string, ProductPlacement>>();
  const get = (r: Record<string, string>): ProductPerformance | null => {
    const id = text(r.MerchantProductId);
    if (!id) return null;
    let p = byId.get(id);
    if (!p) {
      p = {
        id,
        title: text(r.Title) ?? id,
        brand: text(r.Brand),
        category: [r.ProductCategory1, r.ProductCategory2].map(text).filter(Boolean).join(' › ') || null,
        productType: text(r.ProductType1),
        price: text(r.Price) ? toNumber(r.Price) : null,
        imageUrl: null,
        link: null,
        metrics: { ...EMPTY_METRICS },
        previous: { ...EMPTY_METRICS },
        placements: [],
        status: null,
      };
      byId.set(id, p);
    } else {
      // A later row may carry details the first one lacked.
      if (p.title === id && text(r.Title)) p.title = text(r.Title)!;
      p.brand ??= text(r.Brand);
      if (p.price === null && text(r.Price)) p.price = toNumber(r.Price);
    }
    return p;
  };

  for (const r of current) {
    const p = get(r);
    if (!p) continue;
    const m = metricsOf(r);
    p.metrics = addMetrics(p.metrics, m);
    const campaignId = text(r.CampaignId);
    if (!campaignId) continue;
    // Performance Max has asset groups instead of ad groups.
    const groupId = text(r.AdGroupId) ?? text(r.AssetGroupId);
    const groupName = text(r.AdGroupName) ?? text(r.AssetGroupName);
    const key = `${campaignId}|${groupId ?? ''}`;
    let mine = placements.get(p.id);
    if (!mine) placements.set(p.id, (mine = new Map()));
    const existing = mine.get(key);
    if (existing) existing.metrics = addMetrics(existing.metrics, m);
    else
      mine.set(key, {
        campaignId,
        campaignName: text(r.CampaignName) ?? campaignId,
        adGroupId: groupId,
        adGroupName: groupName,
        metrics: m,
      });
  }
  for (const r of previous) {
    const p = get(r);
    if (p) p.previous = addMetrics(p.previous, metricsOf(r));
  }
  for (const p of byId.values()) {
    p.placements = [...(placements.get(p.id)?.values() ?? [])].sort((a, b) => b.metrics.spend - a.metrics.spend);
  }
  return [...byId.values()];
}

/**
 * Worth showing: the product earned something in the period or the one before (so one
 * that stopped selling still shows as a drop). Products that never sold are left out.
 */
export function worthShowing(p: Pick<ProductPerformance, 'metrics' | 'previous'>): boolean {
  return p.metrics.revenue > 0 || p.previous.revenue > 0 || p.metrics.conversions > 0 || p.previous.conversions > 0;
}

export function relevantProducts(all: ProductPerformance[]): ProductPerformance[] {
  return all.filter(worthShowing).sort((a, b) => b.metrics.revenue - a.metrics.revenue || b.metrics.spend - a.metrics.spend);
}

export const STATUS_LABELS: Record<string, string> = {
  ok: 'Godkendt',
  warning: 'Advarsel',
  disapproved: 'Afvist',
  outofstock: 'Udsolgt',
  notincatalog: 'Ikke i kataloget',
  unknown: 'Ukendt',
};

/** "Vist i 2 af 156 kampagner" – Microsoft has no API for its own "eligible in" count. */
export function campaignsLabel(s: ProductStatus | null): string | null {
  if (!s || s.servingCampaigns === null || s.totalCampaigns === null) return null;
  return `Vist i ${s.servingCampaigns} af ${s.totalCampaigns} kampagner`;
}

export function statusLabel(s: ProductStatus | null): string {
  return STATUS_LABELS[s?.status ?? 'unknown'] ?? s?.status ?? 'Ukendt';
}

export interface CatalogOffer {
  title: string | null;
  imageUrl: string | null;
  link: string | null;
  price: number | null;
  /** "in stock", "out of stock", "preorder" */
  availability: string | null;
}

/**
 * The status of each product: Merchant Center issues where Microsoft gives them, else
 * out of stock / not in the catalogue / approved; and how many of the active Shopping
 * and Performance Max campaigns it showed in.
 */
export function productStatuses(
  products: ProductPerformance[],
  catalog: Map<string, CatalogOffer> | null,
  issues: Map<string, { status: 'warning' | 'disapproved'; issues: string[] }> | null,
  activeProductCampaigns: number | null,
): ProductPerformance[] {
  return products.map((p) => {
    const offer = catalog?.get(p.id.toLowerCase()) ?? null;
    const found = issues?.get(p.id.toLowerCase()) ?? null;
    const status = found?.status ?? (!catalog ? 'unknown' : !offer ? 'notincatalog' : offer.availability === 'out of stock' ? 'outofstock' : 'ok');
    const serving = new Set(p.placements.filter((x) => x.metrics.impressions > 0).map((x) => x.campaignId)).size;
    return {
      ...p,
      title: p.title === p.id && offer?.title ? offer.title : p.title,
      imageUrl: offer?.imageUrl ?? p.imageUrl,
      link: offer?.link ?? p.link,
      price: p.price ?? offer?.price ?? null,
      status: {
        status,
        servingCampaigns: serving,
        totalCampaigns: activeProductCampaigns === null ? null : Math.max(activeProductCampaigns, serving),
        issues: found?.issues ?? [],
      },
    };
  });
}

/** Content API product ids are "channel:language:country:offerId"; reports carry the offer id. */
export const offerIdOf = (id: string) => (id.split(':').pop() ?? id).toLowerCase();
