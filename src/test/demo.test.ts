import { beforeEach, describe, expect, it } from 'vitest';
import { DemoBackend } from '@/bing/demo/backend';
import { presetRange } from '@/lib/format';

const ACC = '1000001';

describe('DemoBackend', () => {
  beforeEach(() => DemoBackend.reset());

  it('lists the demo structure', async () => {
    const b = new DemoBackend(0);
    const campaigns = await b.listCampaigns(ACC);
    expect(campaigns.length).toBeGreaterThan(5);
    const groups = await b.listAdGroups(ACC, '102');
    expect(groups.map((g) => g.name)).toContain('Ergonomiske kontorstole');
    const kws = await b.listKeywords(ACC, '1020');
    expect(kws.some((k) => k.text === 'kontorstol')).toBe(true);
  });

  it('produces deterministic, consistent reports', async () => {
    const b = new DemoBackend(0);
    const range = presetRange('last30');
    const a = await b.runReport(ACC, { kind: 'campaign', range, aggregation: 'Summary' });
    const again = await b.runReport(ACC, { kind: 'campaign', range, aggregation: 'Summary' });
    expect(a).toEqual(again);
    const account = await b.runReport(ACC, { kind: 'account', range, aggregation: 'Summary' });
    const sum = a.reduce((s, r) => s + (r.spend ?? 0), 0);
    expect(account[0]?.spend).toBeCloseTo(sum, 0);
    expect(sum).toBeGreaterThan(10_000);
  });

  it('caps the budget-limited campaign at its daily budget', async () => {
    const b = new DemoBackend(0);
    const range = presetRange('yesterday');
    const rows = await b.runReport(ACC, { kind: 'campaign', range, aggregation: 'Daily', campaignIds: ['103'] });
    expect(rows[0]?.spend ?? 0).toBeLessThanOrEqual(400.01);
    expect(rows[0]?.spend ?? 0).toBeGreaterThan(350);
  });

  it('finds wasteful search terms', async () => {
    const b = new DemoBackend(0);
    const rows = await b.runReport(ACC, { kind: 'searchterm', range: presetRange('last30'), aggregation: 'Summary' });
    const used = rows.find((r) => r.searchTerm === 'brugt kontorstol');
    expect(used?.spend).toBeGreaterThan(0);
    expect(used?.conversions).toBe(0);
  });

  it('applies and persists changes', async () => {
    const b = new DemoBackend(0);
    await b.updateCampaigns(ACC, [{ campaignId: '103', dailyBudget: 500 }]);
    await b.addNegativeKeywords(ACC, 'Campaign', '102', [{ text: 'brugt', matchType: 'Phrase' }]);
    const reloaded = new DemoBackend(0);
    expect((await reloaded.listCampaigns(ACC)).find((c) => c.id === '103')?.dailyBudget).toBe(500);
    expect(await reloaded.listNegativeKeywords(ACC, 'Campaign', '102')).toEqual([expect.objectContaining({ text: 'brugt' })]);
  });

  it('splits device/geo reports without losing totals', async () => {
    const b = new DemoBackend(0);
    const range = presetRange('last7');
    const [acc, dev, geo] = await Promise.all([
      b.runReport(ACC, { kind: 'account', range, aggregation: 'Summary' }),
      b.runReport(ACC, { kind: 'device', range, aggregation: 'Summary' }),
      b.runReport(ACC, { kind: 'geo', range, aggregation: 'Summary' }),
    ]);
    const total = acc[0]?.spend ?? 0;
    expect(dev.reduce((s, r) => s + (r.spend ?? 0), 0)).toBeCloseTo(total, 0);
    expect(geo.reduce((s, r) => s + (r.spend ?? 0), 0)).toBeCloseTo(total, 0);
    expect(dev.reduce((s, r) => s + (r.conversions ?? 0), 0)).toBeCloseTo(acc[0]?.conversions ?? 0, 0);
  });
});
