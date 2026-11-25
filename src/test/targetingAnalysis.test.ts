import { describe, expect, it } from 'vitest';
import type { CampaignTargets, ReportRow } from '@/bing/types';
import {
  applyScheduleSuggestion,
  fromHourMap,
  regionKey,
  scheduleAdjustment,
  segmentsOf,
  sourceOf,
  suggestAdjustments,
  targetLevels,
  toHourMap,
  tooManyBlocks,
  weekGrid,
  weekdayOf,
} from '@/features/targeting/analysis';
import { changesOf, draftOf } from '@/features/targeting/changes';

const EMPTY: CampaignTargets = { devices: [], schedule: [], locations: [], ages: [], genders: [] };
const row = (o: Partial<ReportRow>): ReportRow => ({ impressions: 1000, clicks: 100, spend: 500, conversions: 5, revenue: 2500, ...o });

describe('where the targeting lives', () => {
  it('tells campaign level from ad group level, per kind', () => {
    const campaign: CampaignTargets = { ...EMPTY, schedule: [{ id: 's1', day: 'Monday', from: 8, to: 16, adjustment: 0 }], devices: [{ id: 'd1', device: 'Smartphones', adjustment: -50 }] };
    const own: CampaignTargets = { ...EMPTY, schedule: [{ id: 's2', day: 'Monday', from: 0, to: 24, adjustment: 10 }] };
    const levels = targetLevels(campaign, [
      { id: 'g1', name: 'Kontorstole', targets: own },
      { id: 'g2', name: 'Borde', targets: EMPTY },
    ]);
    expect(levels.schedule).toEqual({ campaign: true, groups: [{ id: 'g1', name: 'Kontorstole' }] });
    expect(levels.device).toEqual({ campaign: true, groups: [] });
    expect(levels.location).toEqual({ campaign: false, groups: [] });
    // An ad group's own schedule replaces the campaign's; its devices come from the campaign.
    expect(sourceOf('schedule', campaign, own)).toBe('adgroup');
    expect(sourceOf('device', campaign, own)).toBe('campaign');
    expect(sourceOf('location', campaign, own)).toBe('none');
  });
});

describe('the ad schedule as a week grid', () => {
  it('turns blocks into hours and back – hours without a block show no ads', () => {
    const blocks = [
      { day: 'Monday' as const, from: 6, to: 9, adjustment: -25 },
      { day: 'Monday' as const, from: 9, to: 16, adjustment: 0 },
      { day: 'Tuesday' as const, from: 0, to: 24, adjustment: 0 },
    ];
    const map = toHourMap(blocks);
    expect(map.days.Monday.slice(5, 10)).toEqual([null, -25, -25, -25, 0]);
    expect(map.days.Wednesday.every((v) => v === null)).toBe(true);
    expect(fromHourMap(map)).toEqual(blocks);
    // No schedule at all: every hour at 0 %, and saved untouched it stays without one.
    expect(toHourMap([]).days.Sunday[3]).toBe(0);
    expect(fromHourMap(toHourMap([]))).toEqual([]);
  });

  it('knows Microsoft\'s 7 blocks a day', () => {
    const map = toHourMap([{ day: 'Monday', from: 0, to: 24, adjustment: 0 }]);
    map.days.Monday = map.days.Monday.map((_, h) => (h % 3 ? 0 : 10));
    expect(tooManyBlocks(fromHourMap(map))).toEqual(['Monday']);
  });

  it('sums the hourly report per weekday and hour', () => {
    expect(weekdayOf('2026-11-23')).toBe('Monday');
    const g = weekGrid([row({ date: '2026-11-23', hour: 9 }), row({ date: '2026-11-30', hour: 9 }), row({ date: '2026-11-24', hour: 22 })]);
    expect(g.Monday[9]!.spend).toBe(1000);
    expect(g.Tuesday[22]!.spend).toBe(500);
  });
});

describe('where the money goes and what to lower', () => {
  it('suggests lowering a segment that earns less and raising one that earns more – in steps of 20 points', () => {
    const segs = segmentsOf('device', [
      row({ device: 'Computer', clicks: 1000, spend: 5000, conversions: 50, revenue: 50_000 }),
      row({ device: 'Smartphone', clicks: 1000, spend: 5000, conversions: 40, revenue: 10_000 }),
      row({ device: 'Tablet', clicks: 50, spend: 200, conversions: 1, revenue: 500 }),
    ]);
    expect(segs.map((s) => s.key)).toEqual(['Computers', 'Smartphones', 'Tablets']);
    const s = suggestAdjustments(segs, (x) => (x.key === 'Smartphones' ? -10 : 0));
    // Mobile: a third of the campaign's ROAS → down 20 (one step); computer: well above → up 20. Tablet: too little data.
    expect(s.map((x) => [x.key, x.current, x.suggested])).toEqual([
      ['Smartphones', -10, -30],
      ['Computers', 0, 20],
    ]);
  });

  it('cuts 20 points where 300 clicks bought nothing', () => {
    const segs = segmentsOf('age', [row({ ageGroup: '18-24', clicks: 400, spend: 900, conversions: 0, revenue: 0 }), row({ ageGroup: '35-49', clicks: 2000, conversions: 60, revenue: 60_000, spend: 9000 })]);
    expect(suggestAdjustments(segs, () => null)[0]).toMatchObject({ key: 'EighteenToTwentyFour', suggested: -20 });
  });

  it('reads the schedule by hour block and by weekday, and applies a suggestion to the grid', () => {
    const rows = [row({ date: '2026-11-23', hour: 2, clicks: 400, spend: 2000, conversions: 0, revenue: 0 }), row({ date: '2026-11-23', hour: 10, clicks: 2000, spend: 8000, conversions: 80, revenue: 80_000 })];
    const segs = segmentsOf('schedule', rows);
    expect(segs.map((s) => s.key).sort()).toEqual(['day:Monday', 'hours:0-6', 'hours:9-12']);
    const map = toHourMap([]);
    const night = suggestAdjustments(segs, (s) => scheduleAdjustment(map, s.key)).find((s) => s.key === 'hours:0-6')!;
    expect(night).toMatchObject({ suggested: -20 });
    const after = applyScheduleSuggestion(map, night);
    expect(after.days.Friday.slice(0, 7)).toEqual([-20, -20, -20, -20, -20, -20, 0]);
    expect(after.none).toBe(false);
  });

  it('matches regions in Danish and English', () => {
    expect(regionKey('Hovedstaden')).toBe(regionKey('Capital Region of Denmark|Denmark'));
    expect(regionKey('Sjælland')).toBe(regionKey('Region Zealand'));
  });
});

describe('what is sent to Microsoft', () => {
  const now: CampaignTargets = {
    devices: [{ id: 'd1', device: 'Smartphones', adjustment: -50 }],
    schedule: [
      { id: 's1', day: 'Monday', from: 8, to: 16, adjustment: 0 },
      { id: 's2', day: 'Monday', from: 16, to: 20, adjustment: -25 },
    ],
    locations: [
      { id: 'l1', locationId: '59', name: 'Denmark', adjustment: 0 },
      { id: 'l2', locationId: '9101', name: 'Capital Region of Denmark|Denmark', adjustment: 0 },
    ],
    ages: [],
    genders: [],
  };

  it('nothing when nothing changed', () => {
    const r = changesOf(now, draftOf(now), '');
    expect(r.changes).toEqual({ add: [], update: [], delete: [] });
    expect(r.lines).toEqual([]);
  });

  it('devices as all three, schedule block by block, ages, and removed locations', () => {
    const d = draftOf(now);
    d.devices.Tablets = -20;
    d.schedule.days.Monday[18] = 10; // splits 16–20 into 16–18, 18–19, 19–20
    d.ages.EighteenToTwentyFour = -30;
    d.locations = d.locations.filter((l) => l.id !== 'l2');
    const r = changesOf(now, d, '');
    expect(r.changes.add).toEqual(
      expect.arrayContaining([
        { kind: 'device', device: 'Computers', adjustment: 0 },
        { kind: 'device', device: 'Tablets', adjustment: -20 },
        { kind: 'age', age: 'EighteenToTwentyFour', adjustment: -30 },
        { kind: 'schedule', day: 'Monday', from: 16, to: 18, adjustment: -25 },
        { kind: 'schedule', day: 'Monday', from: 18, to: 19, adjustment: 10 },
        { kind: 'schedule', day: 'Monday', from: 19, to: 20, adjustment: -25 },
      ]),
    );
    expect(r.changes.delete.sort()).toEqual(['l2', 's2']);
    // 8–16 is unchanged and keeps its id.
    expect(r.changes.update).toEqual([]);
    expect(r.lines.map((l) => l.field)).toEqual(expect.arrayContaining(['Enhed · Tablet', 'Alder · 18–24', 'Lokation · Capital Region of Denmark', 'Tidsplan · Mandag']));
    expect(r.errors).toEqual([]);
  });
});

describe('the assistant\'s targeting tools on the demo account', () => {
  it('review_targeting sees where the money goes and which level the schedule lives on', async () => {
    const { DemoBackend } = await import('@/bing/demo/backend');
    const { getTool } = await import('@/ai/tools');
    const { DEFAULT_SPEND_RULES } = await import('@/stores/settings');
    const backend = new DemoBackend(0);
    const ctx = { backend, accountId: '1000001', currency: 'DKK', rules: DEFAULT_SPEND_RULES, defaultPreset: 'last30' as const, memo: new Map() };
    const c = (await backend.listCampaigns('1000001')).find((x) => x.type === 'Search')!;
    const g = (await backend.listAdGroups('1000001', c.id))[0]!;
    await backend.applyTargets('1000001', { campaignId: c.id, adGroupId: g.id }, { delete: [], update: [], add: [{ kind: 'schedule', day: 'Monday', from: 8, to: 16, adjustment: 0 }] });
    const tool = getTool('review_targeting')!;
    if (tool.kind !== 'read') throw new Error('unexpected');
    const out = (await tool.run(tool.schema.parse({ campaignId: c.id }), ctx)) as { result: { levels: Record<string, { adGroupsWithOwn?: string[] }>; devices: { segment: string }[]; spend: number } };
    expect(out.result.levels.schedule!.adGroupsWithOwn).toEqual([`${g.name} (id ${g.id})`]);
    expect(out.result.devices.map((d) => d.segment)).toContain('Mobil');
    expect(out.result.spend).toBeGreaterThan(0);
    const one = (await tool.run(tool.schema.parse({ campaignId: c.id, adGroupId: g.id }), ctx)) as { result: { levels: Record<string, string> } };
    expect(one.result.levels.schedule).toMatch(/own/);
    expect(one.result.levels.device).toMatch(/not set|inherited/);
  });

  it('set_campaign_targeting sets an ad group\'s own schedule – read back from the ad group', async () => {
    const { DemoBackend } = await import('@/bing/demo/backend');
    const { getTool } = await import('@/ai/tools');
    const { DEFAULT_SPEND_RULES } = await import('@/stores/settings');
    const backend = new DemoBackend(0);
    const ctx = { backend, accountId: '1000001', currency: 'DKK', rules: DEFAULT_SPEND_RULES, defaultPreset: 'last30' as const, memo: new Map() };
    const c = (await backend.listCampaigns('1000001')).find((x) => x.type === 'Search')!;
    const g = (await backend.listAdGroups('1000001', c.id))[0]!;
    const tool = getTool('set_campaign_targeting')!;
    if (tool.kind !== 'write') throw new Error('unexpected');
    const planned = await tool.plan(tool.schema.parse({ campaignId: c.id, adGroupId: g.id, schedule: [{ days: ['Monday'], from: 0, to: 24, adjustment: 0 }], reason: 'x' }), ctx);
    expect(planned.plan!.title).toContain(g.name);
    expect(planned.plan!.notes!.join(' ')).toMatch(/erstatter kampagnens/);
    const exec = await planned.execute();
    expect(exec.summary).toMatch(/Bekræftet/);
    expect((await backend.getTargets('1000001', { campaignId: c.id, adGroupId: g.id })).schedule).toHaveLength(1);
    expect((await backend.getTargets('1000001', { campaignId: c.id })).schedule.some((b) => b.day === 'Monday' && b.to === 24 && b.from === 0)).toBe(false);
  });
});

describe('the reports behind the page', () => {
  it('reads Microsoft\'s hourly time period ("date|hour") and asks per ad group in the campaign', async () => {
    const { normalizeReportRows, buildReportRequest } = await import('@/bing/reports');
    const [r] = normalizeReportRows('adgrouphourly', [{ TimePeriod: '2026-11-02|13', AdGroupId: '5', Impressions: '10', Clicks: '2', Spend: '4', Conversions: '1', Revenue: '100' }]);
    expect(r).toMatchObject({ date: '2026-11-02', hour: 13, adGroupId: '5', spend: 4 });
    const req = buildReportRequest('42', { kind: 'adgrouphourly', range: { from: '2026-10-01', to: '2026-10-30' }, aggregation: 'Summary', campaignIds: ['9'] }) as { Aggregation: string; Columns: string[]; Type: string; Scope: { Campaigns: unknown[] } };
    expect(req).toMatchObject({ Type: 'AdGroupPerformanceReportRequest', Aggregation: 'Hourly', Scope: { Campaigns: [{ AccountId: 42, CampaignId: 9 }] } });
    expect(req.Columns).toContain('TimePeriod');
    expect(buildReportRequest('42', { kind: 'adgroupagegender', range: { from: '2026-10-01', to: '2026-10-30' }, aggregation: 'Summary', campaignIds: ['9'] })).toMatchObject({ Type: 'AgeGenderAudienceReportRequest' });
  });
});
