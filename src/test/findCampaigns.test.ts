import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getTool, type ToolContext } from '@/ai/tools';
import { matchByName, nameScore } from '@/ai/tools/find';
import { CampaignCache, FRESH_MS } from '@/bing/campaignCache';
import { DemoBackend } from '@/bing/demo/backend';
import { buildReportRequest } from '@/bing/reports';
import type { Campaign } from '@/bing/types';
import { DEFAULT_SPEND_RULES } from '@/stores/settings';

function ctx(): ToolContext {
  return { backend: new DemoBackend(0), accountId: '1000001', currency: 'DKK', rules: DEFAULT_SPEND_RULES, defaultPreset: 'last30', memo: new Map() };
}

const camp = (id: string, name: string) => ({ id, name, status: 'Active', type: 'Search', dailyBudget: 10, sharedBudgetId: null, bidStrategy: { type: 'EnhancedCpc', targetCpa: null, targetRoas: null, maxCpc: null }, languages: [] }) as Campaign;

describe('finding campaigns by name', () => {
  beforeEach(() => DemoBackend.reset());

  it('matches every word in any order, ignoring case and separators', () => {
    expect(nameScore('butiksinventar exact', 'Butiksinventar | Exact')).toBe(100);
    expect(nameScore('Sækkevogne', 'Search | Transport & Løft | Sækkevogne')).toBeGreaterThanOrEqual(60);
    expect(nameScore('sækkevogne', 'Search | Transport & Løft | Stiger')).toBe(0);
    const found = matchByName([camp('1', 'Butiksinventar | Phrase'), camp('2', 'Butiksinventar | Exact'), camp('3', 'Lagerreoler')], 'Butiksinventar Exact', 60);
    expect(found.map((c) => c.id)).toEqual(['2']);
  });

  it('finds campaigns and ad groups with their ids in one call', async () => {
    const tool = getTool('find_campaigns_and_ad_groups')!;
    if (tool.kind === 'write') throw new Error('unexpected');
    const out = await tool.run(tool.schema.parse({ query: 'kontorstole' }), ctx());
    const r = out.result as { campaigns: { id: string; name: string }[]; adGroups: { campaignId: string }[] };
    expect(r.campaigns[0]).toMatchObject({ id: '102', name: 'Kontorstole – Generisk' });
    expect(r.adGroups.length).toBeGreaterThan(0);
    expect(r.adGroups.every((g) => g.campaignId)).toBe(true);
  });

  it('list_campaigns returns a limited, searchable list with the total', async () => {
    const tool = getTool('list_campaigns')!;
    if (tool.kind === 'write') throw new Error('unexpected');
    const out = await tool.run(tool.schema.parse({ limit: 2 }), ctx());
    const r = out.result as { totalMatching: number; campaigns: unknown[]; note?: string };
    expect(r.campaigns).toHaveLength(2);
    expect(r.totalMatching).toBeGreaterThan(2);
    expect(r.note).toMatch(/Showing 2 of/);
    const searched = await tool.run(tool.schema.parse({ search: 'hæve sænkeborde', includeMetrics: false }), ctx());
    expect((searched.result as { campaigns: { id: string }[] }).campaigns.map((c) => c.id)).toEqual(['103']);
  });
});

describe('report columns', () => {
  it('always sends measures with custom columns (NoMeasureSelected)', () => {
    const req = buildReportRequest('1', { kind: 'campaign', range: { from: '2026-10-01', to: '2026-10-07' }, aggregation: 'Daily', columns: ['CampaignName', 'CampaignStatus'] });
    expect(req.Columns).toEqual(['TimePeriod', 'CampaignName', 'CampaignStatus', 'Impressions', 'Clicks', 'Spend', 'Conversions', 'Revenue']);
  });
});

describe('campaign cache', () => {
  it('reads a recent snapshot, and asks Microsoft when it is old or after a change', async () => {
    const list = [camp('1', 'A')];
    let snapshot: { fetchedAt: number | null; campaigns: Campaign[] } = { fetchedAt: Date.now() - 60_000, campaigns: list };
    const store = { read: vi.fn(async () => snapshot), write: vi.fn(async () => {}) };
    const fetchFresh = vi.fn(async () => [camp('2', 'B')]);
    const cache = new CampaignCache(store, fetchFresh);

    expect(await cache.get('9')).toBe(list);
    expect(fetchFresh).not.toHaveBeenCalled();

    snapshot = { fetchedAt: Date.now() - FRESH_MS - 1, campaigns: list };
    const [a, b] = await Promise.all([cache.get('9'), cache.get('9')]);
    expect(a[0]!.id).toBe('2');
    expect(b[0]!.id).toBe('2');
    expect(fetchFresh).toHaveBeenCalledTimes(1);

    snapshot = { fetchedAt: Date.now(), campaigns: list };
    cache.changed();
    await cache.get('9');
    expect(fetchFresh).toHaveBeenCalledTimes(2);
    cache.saved('9', list);
    expect(store.write).toHaveBeenCalledWith('9', expect.any(Number), list);
    expect(await cache.get('9')).toBe(list);
  });
});

describe('responsive search ad pins', () => {
  beforeEach(() => DemoBackend.reset());

  it('puts the keyword alone first, pinned to position 1, and keeps the pins the user picks', async () => {
    const { applyEdits } = await import('@/ai/approvals');
    const tool = getTool('create_responsive_search_ad')!;
    if (tool.kind !== 'write') throw new Error('unexpected');
    const c = ctx();
    const input = tool.schema.parse({
      campaignId: '102',
      adGroupId: '1020',
      keywordHeadline: 'Kontorstole',
      headlines: ['Ergonomiske stole til kontoret', 'Hurtig levering i hele landet', 'Stort udvalg af kontorstole'],
      descriptions: ['Find den rigtige kontorstol til din arbejdsdag.', 'Fri fragt over 500 kr. og 30 dages returret.'],
      finalUrl: 'https://example.com/kontorstole',
      reason: 'Ny annonce',
    });
    const planned = await tool.plan(input, c);
    const lines = planned.plan!.changes;
    expect(lines[0]).toMatchObject({ after: 'Kontorstole', pin: { value: '1' } });
    expect(lines[0]!.pin!.locked).toBeTruthy();
    expect(lines[1]!.pin).toMatchObject({ path: ['headlinePins', 0], value: '' });

    // The user pins headline 3 to position 2 on the card (the model sent no pins at all).
    const edited = tool.schema.parse(applyEdits(input, [{ path: lines[2]!.pin!.path!, value: '2' }]));
    const exec = await (await tool.plan(edited, c)).execute();
    const r = exec.result as { adId: string; pinnedHeadlines: { headline: string; position: number }[] };
    expect(r.pinnedHeadlines).toEqual([
      { headline: 'Kontorstole', position: 1 },
      { headline: 'Hurtig levering i hele landet', position: 2 },
    ]);
    const ad = (await c.backend.listAds(c.accountId, '1020')).find((a) => a.id === r.adId)!;
    expect(ad.headlines[0]).toBe('Kontorstole');
    expect(ad.headlinePins).toEqual([1, null, 2, null]);
  });
});
