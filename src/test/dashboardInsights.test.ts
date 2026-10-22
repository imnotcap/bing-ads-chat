import { describe, expect, it } from 'vitest';
import { derive } from '@/bing/metrics';
import type { Campaign } from '@/bing/types';
import { buildInsights } from '@/features/dashboard/insights';
import type { CampaignRow } from '@/hooks/useAdsData';

const m = (spend: number, revenue: number, conversions = 1) => derive({ impressions: 1000, clicks: 100, spend, revenue, conversions });
const camp = (id: string, name: string, spend: number, revenue: number): CampaignRow => ({ id, name, status: 'Active', type: 'Search', metrics: { ...m(spend, revenue) } }) as unknown as CampaignRow & Campaign;

describe('buildInsights', () => {
  it('reads the period out with the campaign that drove it', () => {
    const pages = buildInsights({
      totals: m(1000, 12000, 10),
      previous: m(1100, 10000, 10),
      daily: [
        { date: '2026-10-19', revenue: 2000 },
        { date: '2026-10-20', revenue: 6000 },
        { date: '2026-10-21', revenue: 4000 },
      ],
      campaigns: [camp('1', 'Kontorstole', 500, 9000), camp('2', 'Brand', 500, 3000)],
      previousCampaigns: [camp('1', 'Kontorstole', 500, 6000), camp('2', 'Brand', 600, 4000)],
      alerts: [],
      currency: 'DKK',
      granularity: 'week',
      current: true,
    });
    expect(pages[0]!.text).toContain('steg 20 %');
    expect(pages[0]!.text).toContain('drevet af Kontorstole');
    expect(pages[0]!.text).toContain('Tirsdag var ugens stærkeste dag');
    expect(pages[0]!.chips.map((c) => c.tone)).toEqual(['up', 'down']);
  });

  it('speaks of a past week in the past', () => {
    const [page] = buildInsights({ totals: m(10, 100), previous: m(10, 100), daily: [], campaigns: [], previousCampaigns: [], alerts: [], currency: 'DKK', granularity: 'week', current: false });
    expect(page!.text).toContain('i ugen');
  });
});
