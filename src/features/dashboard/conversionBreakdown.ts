/**
 * Dagligt overblik → click the conversions of a day, week or month: which products they came
 * from. Microsoft's product report covers Shopping and Performance Max only – a conversion
 * from a search ad has no product – so what the products don't explain is shown per
 * campaign from the campaign report.
 *
 * The product is the one the customer clicked on; Microsoft does not report what was bought.
 */
import type { ProductPerformance, ReportRow } from '@/bing/types';

export interface ConvertedProduct {
  id: string;
  title: string;
  conversions: number;
  revenue: number;
  spend: number;
  /** "Kampagne › Annoncegruppe" where it converted, largest first. */
  where: string[];
}

export interface CampaignRest {
  campaignId: string;
  campaignName: string;
  conversions: number;
  revenue: number;
}

export interface ConversionBreakdown {
  products: ConvertedProduct[];
  productConversions: number;
  /** Conversions without a product (search ads …), per campaign. */
  rest: CampaignRest[];
  restConversions: number;
}

const EPS = 0.005;

export function conversionBreakdown(products: ProductPerformance[], campaigns: ReportRow[]): ConversionBreakdown {
  const byCampaign = new Map<string, { conversions: number; revenue: number }>();
  const list: ConvertedProduct[] = [];
  for (const p of products) {
    if (p.metrics.conversions <= EPS) continue;
    const placements = p.placements.filter((x) => x.metrics.conversions > EPS).sort((a, b) => b.metrics.conversions - a.metrics.conversions);
    for (const x of p.placements) {
      const t = byCampaign.get(x.campaignId) ?? { conversions: 0, revenue: 0 };
      byCampaign.set(x.campaignId, { conversions: t.conversions + x.metrics.conversions, revenue: t.revenue + x.metrics.revenue });
    }
    list.push({
      id: p.id,
      title: p.title,
      conversions: p.metrics.conversions,
      revenue: p.metrics.revenue,
      spend: p.metrics.spend,
      where: placements.map((x) => (x.adGroupName ? `${x.campaignName} › ${x.adGroupName}` : x.campaignName)),
    });
  }
  list.sort((a, b) => b.conversions - a.conversions || b.revenue - a.revenue);

  const rest: CampaignRest[] = [];
  for (const r of campaigns) {
    if (!r.campaignId) continue;
    const fromProducts = byCampaign.get(r.campaignId) ?? { conversions: 0, revenue: 0 };
    const left = (r.conversions ?? 0) - fromProducts.conversions;
    if (left > EPS) rest.push({ campaignId: r.campaignId, campaignName: r.campaignName ?? r.campaignId, conversions: left, revenue: Math.max(0, (r.revenue ?? 0) - fromProducts.revenue) });
  }
  rest.sort((a, b) => b.conversions - a.conversions);
  const sum = (xs: { conversions: number }[]) => xs.reduce((n, x) => n + x.conversions, 0);
  return { products: list, productConversions: sum(list), rest, restConversions: sum(rest) };
}
