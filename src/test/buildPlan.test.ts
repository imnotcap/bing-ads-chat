import { beforeEach, describe, expect, it } from 'vitest';
import { getTool, type ToolContext } from '@/ai/tools';
import { DemoBackend } from '@/bing/demo/backend';
import type { AdsBackend, NewAdExtension } from '@/bing/types';
import { addDays, today } from '@/lib/format';
import { DEFAULT_SPEND_RULES } from '@/stores/settings';

const ctxOf = (backend: AdsBackend): ToolContext => ({ backend, accountId: '1000001', currency: 'DKK', rules: DEFAULT_SPEND_RULES, defaultPreset: 'last30', memo: new Map() });
const write = (name: string) => {
  const t = getTool(name)!;
  if (t.kind !== 'write') throw new Error('not a write tool');
  return t;
};

describe('a build plan like "Black Weeks 2026"', () => {
  beforeEach(() => DemoBackend.reset());

  it('creates ad groups that carry the period from birth, and reads it back', async () => {
    const backend = new DemoBackend(0);
    const tool = write('create_ad_group');
    const start = addDays(today(), 3);
    const end = addDays(today(), 16);
    const { plan, execute } = await tool.plan(tool.schema.parse({ campaignId: '101', adGroups: [{ name: 'BW Kontorstole', cpcBid: 4 }], startDate: start, endDate: end, skipStandardTargeting: true, reason: 'BW' }), ctxOf(backend));
    expect(plan!.changes.some((l) => l.field.startsWith('Periode'))).toBe(true);
    const done = await execute();
    expect((done.result as { outcome: string }).outcome).toBe('confirmed');
    const g = (await backend.listAdGroups('1000001', '101')).find((x) => x.name === 'BW Kontorstole')!;
    expect([g.startDate, g.endDate]).toEqual([start, end]);
  });

  it('adds sitelinks to ad groups and a promotion to the campaign, and checks they are attached', async () => {
    const made: NewAdExtension[] = [];
    const attached: { extensionId: string; entityId: string; level: string }[] = [];
    const demo = new DemoBackend(0);
    const backend = Object.assign(Object.create(Object.getPrototypeOf(demo)), demo, {
      addAdExtensions: async (_a: string, ext: NewAdExtension[]) => {
        made.push(...ext);
        return { ids: ext.map((_, i) => String(900 + i)) };
      },
      associateAdExtensions: async (_a: string, pairs: { extensionId: string; entityId: string }[], level: string) => {
        attached.push(...pairs.map((p) => ({ ...p, level })));
        return {};
      },
      listAdExtensionAssociations: async (_a: string, _k: string, level: string) => attached.filter((x) => x.level === level).map((x) => ({ ...x, text: '' })),
    }) as AdsBackend;
    const groups = await demo.listAdGroups('1000001', '101');
    const tool = write('add_sitelinks');
    const { plan, execute } = await tool.plan(
      tool.schema.parse({
        campaignId: '101',
        sitelinks: [{ text: 'Skriveborde', description1: 'Se Black Weeks-tilbud', description2: 'Gælder 16.–29. november', finalUrl: 'https://example.dk/skriveborde', adGroupIds: [groups[0]!.id] }],
        promotion: { item: 'Møbler og inventar', percentOff: 60, upTo: true, finalUrl: 'https://example.dk/bw' },
        startDate: addDays(today(), 3),
        endDate: addDays(today(), 16),
        reason: 'BW',
      }),
      ctxOf(backend),
    );
    expect(plan!.changes).toHaveLength(2);
    expect(String(plan!.changes[1]!.after)).toMatch(/^Op til 60 % på Møbler og inventar/);
    const done = await execute();
    expect((done.result as { outcome: string }).outcome).toBe('confirmed');
    expect(made[1]).toMatchObject({ kind: 'promotion', percentOff: 60, upTo: true, currency: 'DKK' });
    expect(attached.map((a) => a.level)).toEqual(['Campaign', 'AdGroup']);
  });

  it('refuses a sitelink with one description – Microsoft wants both or none', async () => {
    const tool = write('add_sitelinks');
    const demo = new DemoBackend(0);
    const backend = Object.assign(Object.create(Object.getPrototypeOf(demo)), demo, { addAdExtensions: async () => ({}), associateAdExtensions: async () => ({}), listAdExtensionAssociations: async () => [] }) as AdsBackend;
    await expect(tool.plan(tool.schema.parse({ campaignId: '101', sitelinks: [{ text: 'X', description1: 'kun én', finalUrl: 'https://example.dk' }], reason: 'x' }), ctxOf(backend))).rejects.toThrow(/begge beskrivelser/);
  });

  it('sets the location intent to presence and reads it back', async () => {
    let intent = 'PeopleInOrSearchingForOrViewingPages';
    const demo = new DemoBackend(0);
    const backend = Object.assign(Object.create(Object.getPrototypeOf(demo)), demo, {
      getLocationIntent: async () => ({ id: '1', intent }),
      setLocationIntent: async (_a: string, _c: string, i: string) => ((intent = i), {}),
    }) as AdsBackend;
    const tool = write('set_location_intent');
    const { execute } = await tool.plan(tool.schema.parse({ campaignId: '101', intent: 'presence', reason: 'Tilstedeværelse' }), ctxOf(backend));
    await execute();
    expect(intent).toBe('PeopleIn');
  });

  it('checks item ids against the catalogue, in any case, and suggests the closest for a missing letter', async () => {
    const demo = new DemoBackend(0);
    const backend = Object.assign(Object.create(Object.getPrototypeOf(demo)), demo, {
      catalogItems: async () => new Map([['c000558779', { id: 'c000558779', title: 'Kontorstol' }], ['2314431008', { id: '2314431008', title: 'Canadian Ergo' }]]),
    }) as AdsBackend;
    const t = getTool('check_item_ids')!;
    if (t.kind !== 'read') throw new Error('x');
    const out = (await t.run(t.schema.parse({ itemIds: ['2314431008', 'C000558779', 'X000558779', '9999'] }), ctxOf(backend))).result as { matched: number; notFoundItems: { id: string; closest?: string[] }[] };
    expect(out.matched).toBe(2);
    expect(out.notFoundItems).toEqual([{ id: 'X000558779', closest: ['c000558779'] }, { id: '9999' }]);
  });
});
