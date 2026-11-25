import { describe, expect, it } from 'vitest';
import { brandCampaignIds, daysOf, withoutBrand } from '@/features/dashboard/daily';
import { conversionBreakdown } from '@/features/dashboard/conversionBreakdown';
import type { ProductPerformance } from '@/bing/types';

const day = (d: string, spend: number, conversions: number, revenue: number) => ({ day: d, impressions: spend * 10, clicks: spend / 5, spend, conversions, revenue });

describe('Dagligt overblik ekskl. brand', () => {
  it('finds the brand campaigns by name – or uses the ones the user chose', () => {
    const campaigns = [
      { id: '1', name: 'Brand – Nordlys', status: 'Active' },
      { id: '2', name: 'Kontorstole – Generisk', status: 'Active' },
      { id: '3', name: 'BRAND exact', status: 'Paused' },
      { id: '4', name: 'brand gammel', status: 'Deleted' },
    ];
    expect(brandCampaignIds(campaigns, undefined)).toEqual(['1', '3']);
    expect(brandCampaignIds(campaigns, ['2', '99'])).toEqual(['2']);
    expect(brandCampaignIds(campaigns, [])).toEqual([]);
  });

  it('sums the brand campaigns per day and takes them off the account, never below 0', () => {
    const brand = daysOf([
      { date: '2026-11-23', spend: 100, clicks: 20, impressions: 1000, conversions: 4, revenue: 4000 },
      { date: '2026-11-23', spend: 50, clicks: 10, impressions: 500, conversions: 1, revenue: 1000 },
      { date: '2026-11-24', spend: 30, clicks: 6, impressions: 300, conversions: 1, revenue: 900 },
    ]);
    expect(brand.map((d) => [d.day, d.spend, d.conversions])).toEqual([
      ['2026-11-23', 150, 5],
      ['2026-11-24', 30, 1],
    ]);
    const out = withoutBrand([day('2026-11-23', 1000, 10, 9000), day('2026-11-24', 20, 0.5, 500), day('2026-11-25', 400, 3, 2000)], brand);
    expect(out.map((d) => [d.day, d.spend, d.conversions, d.revenue])).toEqual([
      ['2026-11-23', 850, 5, 4000],
      ['2026-11-24', 0, 0, 0],
      ['2026-11-25', 400, 3, 2000],
    ]);
  });

  it('leaves brand campaigns out of the conversions popup too', () => {
    const m = (conversions: number, revenue: number) => ({ impressions: 100, clicks: 10, spend: 50, conversions, revenue });
    const p: ProductPerformance = {
      id: 'p1',
      title: 'Stol',
      brand: null,
      category: null,
      productType: null,
      price: null,
      imageUrl: null,
      link: null,
      metrics: m(3, 3000),
      previous: m(0, 0),
      placements: [
        { campaignId: 'brand', campaignName: 'Brand Shopping', adGroupId: null, adGroupName: null, metrics: m(2, 2000) },
        { campaignId: 'shop', campaignName: 'Shopping', adGroupId: null, adGroupName: null, metrics: m(1, 1000) },
      ],
      status: null,
    };
    const b = conversionBreakdown([p], [{ campaignId: 'brand', campaignName: 'Brand', conversions: 5, revenue: 5000 }, { campaignId: 'search', campaignName: 'Søg', conversions: 2, revenue: 800 }], new Set(['brand']));
    expect(b.products.map((x) => [x.id, x.conversions])).toEqual([['p1', 1]]);
    expect(b.rest.map((r) => r.campaignId)).toEqual(['search']);
  });
});
