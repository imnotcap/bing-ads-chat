import { describe, expect, it } from 'vitest';
import { DemoBackend } from '@/bing/demo/backend';
import { aggregateProducts, buildProductReportRequest, campaignsLabel, offerIdOf, productStatuses, relevantProducts, worthShowing } from '@/bing/products';

const row = (id: string, campaignId: string, m: { spend: number; revenue: number; conversions?: number; impressions?: number }, extra: Record<string, string> = {}) => ({
  MerchantProductId: id,
  Title: `Produkt ${id}`,
  Brand: 'Stålværk',
  Price: '3498.75',
  ProductCategory1: 'Opbevaring',
  CampaignId: campaignId,
  CampaignName: `Kampagne ${campaignId}`,
  AdGroupId: `${campaignId}0`,
  AdGroupName: 'Alle produkter',
  Impressions: String(m.impressions ?? 100),
  Clicks: '10',
  Spend: String(m.spend),
  Conversions: String(m.conversions ?? (m.revenue > 0 ? 1 : 0)),
  Revenue: String(m.revenue),
  ...extra,
});

describe('aggregateProducts', () => {
  it('sums a product over its campaigns and keeps each placement', () => {
    const [p] = aggregateProducts([row('A1', '1', { spend: 100, revenue: 900 }), row('A1', '2', { spend: 50, revenue: 0 })], []);
    expect(p!.metrics.spend).toBe(150);
    expect(p!.metrics.revenue).toBe(900);
    expect(p!.placements.map((x) => x.campaignId)).toEqual(['1', '2']);
    expect(p!.price).toBe(3498.75);
    expect(p!.category).toBe('Opbevaring');
  });

  it('uses the asset group for Performance Max rows', () => {
    const [p] = aggregateProducts([row('B1', '7', { spend: 10, revenue: 50 }, { AdGroupId: '', AdGroupName: '', AssetGroupId: '77', AssetGroupName: 'Bestsellere' })], []);
    expect(p!.placements[0]).toMatchObject({ adGroupId: '77', adGroupName: 'Bestsellere' });
  });

  it('adds the period before', () => {
    const [p] = aggregateProducts([row('A1', '1', { spend: 100, revenue: 900 })], [{ MerchantProductId: 'A1', Impressions: '50', Clicks: '5', Spend: '40', Conversions: '2', Revenue: '400' }]);
    expect(p!.previous.revenue).toBe(400);
  });
});

describe('which products are shown', () => {
  it('leaves out products that never sold, keeps those that stopped selling', () => {
    const all = aggregateProducts(
      [row('sells', '1', { spend: 10, revenue: 500 }), row('never', '1', { spend: 80, revenue: 0, impressions: 5000 }), row('stopped', '1', { spend: 20, revenue: 0 })],
      [{ MerchantProductId: 'stopped', Spend: '30', Revenue: '600', Conversions: '1' }],
    );
    expect(relevantProducts(all).map((p) => p.id)).toEqual(['sells', 'stopped']);
    expect(worthShowing({ metrics: { impressions: 9, clicks: 1, spend: 5, conversions: 0, revenue: 0 }, previous: { impressions: 0, clicks: 0, spend: 0, conversions: 0, revenue: 0 } })).toBe(false);
  });
});

describe('productStatuses', () => {
  const [p] = aggregateProducts([row('SKU1', '1', { spend: 10, revenue: 50 }), row('SKU1', '2', { spend: 10, revenue: 50 })], []);

  it('counts the campaigns it showed in out of the active product campaigns', () => {
    const [s] = productStatuses([p!], new Map([['sku1', { title: null, imageUrl: 'https://x/img.jpg', link: 'https://x', price: null, availability: 'in stock' }]]), new Map(), 156);
    expect(s!.status).toMatchObject({ status: 'ok', servingCampaigns: 2, totalCampaigns: 156 });
    expect(campaignsLabel(s!.status)).toBe('Vist i 2 af 156 kampagner');
    expect(s!.imageUrl).toBe('https://x/img.jpg');
  });

  it('reports Merchant Center issues, stock and missing catalogue', () => {
    expect(productStatuses([p!], new Map(), new Map([['sku1', { status: 'disapproved' as const, issues: ['GTIN mangler'] }]]), 2)[0]!.status).toMatchObject({ status: 'disapproved', issues: ['GTIN mangler'] });
    expect(productStatuses([p!], new Map([['sku1', { title: null, imageUrl: null, link: null, price: null, availability: 'out of stock' }]]), null, 2)[0]!.status!.status).toBe('outofstock');
    expect(productStatuses([p!], new Map(), null, 2)[0]!.status!.status).toBe('notincatalog');
    expect(productStatuses([p!], null, null, null)[0]!.status!.status).toBe('unknown');
  });

  it('matches Content API ids to report offer ids', () => {
    expect(offerIdOf('online:da:DK:SKU1')).toBe('sku1');
  });
});

describe('product report request', () => {
  it('asks for asset groups too, so Performance Max rows are not dropped', () => {
    const req = buildProductReportRequest('123', { from: '2026-09-01', to: '2026-09-30' }, true) as { Type: string; Columns: string[] };
    expect(req.Type).toBe('ProductDimensionPerformanceReportRequest');
    expect(req.Columns).toEqual(expect.arrayContaining(['MerchantProductId', 'AssetGroupId', 'Revenue']));
    const prev = buildProductReportRequest('123', { from: '2026-08-01', to: '2026-08-31' }, false) as { Columns: string[] };
    expect(prev.Columns).not.toContain('CampaignName');
  });
});

describe('demo products', () => {
  it('has a long tail that is filtered away', async () => {
    const backend = new DemoBackend(0);
    const all = await backend.productPerformance('1000001', { from: '2026-09-01', to: '2026-09-30' });
    const shown = relevantProducts(all);
    expect(all.length).toBeGreaterThan(200);
    expect(shown.length).toBeLessThan(all.length / 2);
    expect(shown.every(worthShowing)).toBe(true);
    expect(shown.some((p) => p.status?.issues.length)).toBe(true);
  });
});
