import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getTool, type ToolContext } from '@/ai/tools';
import { DemoBackend } from '@/bing/demo/backend';
import type { AdsBackend, PartitionAction, ProductTreeNode } from '@/bing/types';
import type { DListingNode, NegativeDetail } from '@/features/audit/detail';
import { DEFAULT_SPEND_RULES } from '@/stores/settings';

/* Google is faked at the one module the tools read it through – there is nothing there that could write. */
const google = vi.hoisted(() => ({ connected: true, match: '9001' as string | null | undefined, products: [] as unknown[], negatives: { negatives: [], adGroups: [] } as unknown }));
vi.mock('@/ai/googleSource', () => ({
  requireGoogle: () => {
    if (!google.connected) throw new Error('Google Ads er ikke forbundet til XavierOS.');
  },
  googleCampaigns: async () => ({
    fetchedAt: 0,
    account: { customerId: '1234567890', name: 'Google', currency: 'DKK', timeZone: 'Europe/Copenhagen' },
    campaigns: [
      { id: '9001', name: 'Shopping – Alle produkter', status: 'ENABLED', channel: 'SHOPPING', dailyBudget: 500, sharedBudget: false, bidStrategy: 'MAXIMIZE_CONVERSION_VALUE', portfolio: false, targetRoas: 6, targetCpa: null, metrics: {} },
    ],
  }),
  googleDetail: async (_id: string, part: string) => ({ fetchedAt: 0, data: part === 'products' ? google.products : part === 'negatives' ? google.negatives : [] }),
  auditGoogleMatch: async () => google.match,
}));

/* ---------------- Microsoft's product tree for ad group 1040, held in memory ---------------- */

let tree: ProductTreeNode[] = [];
let calls: PartitionAction[][] = [];
/** The item ids Microsoft showed in ad group 1040 over the last 90 days. */
let shown: string[] = [];

function backend() {
  const b: AdsBackend = new DemoBackend(0);
  b.listProductPartitions = async (_account: string, adGroupId: string, name: string) => tree.filter((n) => n.groupId === adGroupId).map((n) => ({ ...n, group: name }));
  b.applyProductPartitionActions = async (_account: string, actions: PartitionAction[]) => {
    calls.push(actions);
    const temp = new Map<number, string>();
    let next = 5000 + tree.length;
    const below = (id: string): string[] => tree.filter((n) => n.parentId === id).flatMap((c) => [c.id, ...below(c.id)]);
    for (const a of actions) {
      if (a.action === 'Delete') {
        const gone = new Set([a.id, ...below(a.id)]);
        tree = tree.filter((n) => !gone.has(n.id));
      } else {
        const id = String(next++);
        if (a.tempId !== undefined) temp.set(a.tempId, id);
        const parentId = a.parentId === null ? null : typeof a.parentId === 'number' && a.parentId < 0 ? temp.get(a.parentId)! : String(a.parentId);
        tree.push({ id, parentId, group: '', groupId: a.adGroupId, unit: a.kind === 'unit', excluded: a.excluded, operand: a.operand, attribute: a.attribute ?? '', bid: a.bid ?? null });
      }
    }
    return { succeeded: actions.length, failed: [] } as never;
  };
  b.shownProducts = async () => shown.map((itemId) => ({ itemId, adGroupId: '1040', impressions: 10 }));
  return b;
}

function ctx(): ToolContext {
  return { backend: backend(), accountId: '1000001', currency: 'DKK', rules: DEFAULT_SPEND_RULES, defaultPreset: 'last30', memo: new Map() };
}

const gnode = (id: string, parentId: string | null, raw: string, o: Partial<DListingNode> = {}): DListingNode => ({
  id,
  parentId,
  group: 'Alle produkter',
  unit: true,
  excluded: false,
  dim: parentId ? 'id' : 'all',
  value: raw.toLowerCase(),
  raw,
  bid: 3,
  ...o,
});

const read = (name: string) => {
  const tool = getTool(name)!;
  if (tool.kind === 'write') throw new Error('unexpected');
  return tool;
};
const write = (name: string) => {
  const tool = getTool(name)!;
  if (tool.kind !== 'write') throw new Error('unexpected');
  return tool;
};

beforeEach(() => {
  DemoBackend.reset();
  google.connected = true;
  google.match = '9001';
  // Google: split by item id – SKU-1 bid on, SKU-2 excluded, everything else bid on.
  google.products = [gnode('g0', null, '', { unit: false, bid: null }), gnode('g1', 'g0', 'SKU-1'), gnode('g2', 'g0', 'SKU-2', { excluded: true }), gnode('g3', 'g0', '')];
  google.negatives = { negatives: [{ text: 'gratis', matchType: 'phrase', level: 'campaign' }], adGroups: ['Alle produkter'] } satisfies NegativeDetail;
  // Microsoft: one "Alle produkter" unit.
  tree = [{ id: '1', parentId: null, group: 'Alle produkter', groupId: '1040', unit: true, excluded: false, operand: 'All', attribute: '', bid: 2.2 }];
  calls = [];
  shown = ['SKU-1', 'SKU-2'];
});

describe('compare_with_google', () => {
  it('reads the matched Google campaign and lists what Microsoft lacks', async () => {
    const tool = read('compare_with_google');
    const out = await tool.run(tool.schema.parse({ campaignId: '104' }), ctx());
    const r = out.result as { google: { id: string; howMatched: string }; productGroups: { adGroups: { status: string; splitsMicrosoftAllProducts: boolean }[] }; negativeKeywords?: unknown; rules: string };
    expect(r.google.id).toBe('9001');
    expect(r.google.howMatched).toMatch(/Audit/);
    expect(r.productGroups.adGroups[0]).toMatchObject({ status: 'changes', splitsMicrosoftAllProducts: true });
    // Shopping: product groups only – no negative keywords or search terms.
    expect(r.negativeKeywords).toBeUndefined();
    expect(r.rules).toMatch(/never suggest changing it/);
    // The setup on both sides, as facts the assistant judges from.
    const setup = (out.result as { setup: { facts: string[]; assess: string } }).setup;
    expect(setup.facts[0]).toMatch(/budstrategi/);
    expect(setup.assess).toMatch(/Change nothing until the user says yes/);
    // Reading never writes anything to Microsoft either.
    expect(calls).toEqual([]);
  });

  it('says so when Google is not connected', async () => {
    google.connected = false;
    const tool = read('compare_with_google');
    await expect(tool.run(tool.schema.parse({ campaignId: '104' }), ctx())).rejects.toThrow(/ikke forbundet/);
  });

  it('respects "no counterpart" chosen on the audit page', async () => {
    google.match = null;
    const tool = read('compare_with_google');
    await expect(tool.run(tool.schema.parse({ campaignId: '104' }), ctx())).rejects.toThrow(/ikke har en modpart/);
  });
});

describe('match_product_groups_to_google', () => {
  it('plans a grouped card and makes Microsoft’s tree like Google’s', async () => {
    const tool = write('match_product_groups_to_google');
    const c = ctx();
    const { plan: p, execute } = await tool.plan(tool.schema.parse({ campaignId: '104', reason: 'Som i Google' }), c);
    const plan = p!;
    expect(plan.pick).toMatchObject({ skipPath: ['skip'], group: 'group' });
    expect(plan.changes.every((l) => l.pickKey && l.cells?.group === 'Alle produkter')).toBe(true);
    expect(plan.changes.map((l) => l.after)).toEqual(expect.arrayContaining(['SKU-1', 'SKU-2']));
    expect(plan.notes!.join(' ')).toMatch(/Google ændres ikke/);
    const done = await execute();
    expect((done.result as { outcome: string }).outcome).toBe('confirmed');
    expect(done.changes).toHaveLength(plan.changes.length);
    // One call for the one ad group; the item ids keep Google's spelling.
    expect(calls).toHaveLength(1);
    const units = tree.filter((n) => n.parentId);
    expect(units.map((n) => [n.attribute, n.excluded]).sort()).toEqual([['', false], ['SKU-1', false], ['SKU-2', true]]);
  });

  it('leaves out what the user ticks off', async () => {
    const tool = write('match_product_groups_to_google');
    const first = await tool.plan(tool.schema.parse({ campaignId: '104', reason: 'x' }), ctx());
    const sku2 = first.plan!.changes.find((l) => l.after === 'SKU-2')!.pickKey!;
    const { plan: p, execute } = await tool.plan(tool.schema.parse({ campaignId: '104', reason: 'x', skip: [sku2] }), ctx());
    const plan = p!;
    expect(plan.changes.some((l) => l.after === 'SKU-2')).toBe(false);
    await execute();
    expect(tree.some((n) => n.attribute === 'SKU-2')).toBe(false);
    expect(tree.some((n) => n.attribute === 'SKU-1')).toBe(true);
  });

  it('refuses Performance Max and campaigns without product groups', async () => {
    const tool = write('match_product_groups_to_google');
    const c = ctx();
    const pmax = (await c.backend.listCampaigns(c.accountId)).find((x) => x.type === 'PerformanceMax');
    if (pmax) await expect(tool.plan(tool.schema.parse({ campaignId: pmax.id, reason: 'x' }), c)).rejects.toThrow(/Performance Max/);
    await expect(tool.plan(tool.schema.parse({ campaignId: '102', reason: 'x' }), c)).rejects.toThrow(/kun i Shopping/);
  });

  it('leaves out an exclusion of a product Microsoft never showed – it would change nothing', async () => {
    shown = ['SKU-1'];
    const tool = write('match_product_groups_to_google');
    const { plan: p, execute } = await tool.plan(tool.schema.parse({ campaignId: '104', reason: 'x' }), ctx());
    const plan = p!;
    expect(plan.changes.some((l) => l.after === 'SKU-2')).toBe(false);
    expect(plan.notes!.join(' ')).toMatch(/1 varenummer, som Google udelukker, er ikke med/);
    await execute();
    expect(tree.some((n) => n.attribute === 'SKU-2')).toBe(false);
    expect(tree.some((n) => n.attribute === 'SKU-1')).toBe(true);
  });

  it('excludes it anyway when the user asks for it', async () => {
    shown = ['SKU-1'];
    const tool = write('match_product_groups_to_google');
    const { plan } = await tool.plan(tool.schema.parse({ campaignId: '104', reason: 'x', includeUnshown: true }), ctx());
    expect(plan!.changes.some((l) => l.after === 'SKU-2')).toBe(true);
  });

  it('keeps every exclusion, and says why, when it cannot read what Microsoft showed', async () => {
    const c = ctx();
    c.backend.shownProducts = async () => {
      throw new Error('Rapporten blev ikke klar');
    };
    const tool = write('match_product_groups_to_google');
    const { plan } = await tool.plan(tool.schema.parse({ campaignId: '104', reason: 'x' }), c);
    expect(plan!.changes.some((l) => l.after === 'SKU-2')).toBe(true);
    expect(plan!.notes!.join(' ')).toMatch(/Kunne ikke tjekke.*Rapporten blev ikke klar/);
  });

  it('uses the bid the user names for items it starts bidding on, and checks it against the bid ceiling', async () => {
    const tool = write('match_product_groups_to_google');
    const { plan: p, execute } = await tool.plan(tool.schema.parse({ campaignId: '104', reason: 'x', bid: 10.05 }), ctx());
    const plan = p!;
    expect(plan.newBids).toEqual([10.05]);
    expect(plan.notes!.join(' ')).toMatch(/nye bud 10,05\s?kr\. \(det bud, der blev bedt om\)/);
    await execute();
    expect(tree.find((n) => n.attribute === 'SKU-1')!.bid).toBe(10.05);
    expect(tree.find((n) => n.attribute === 'SKU-2')!.excluded).toBe(true);
  });

  it('takes a bid per ad group from the card', async () => {
    const tool = write('match_product_groups_to_google');
    const first = (await tool.plan(tool.schema.parse({ campaignId: '104', reason: 'x' }), ctx())).plan!;
    expect(first.pick?.groupBid).toMatchObject({ idCell: 'groupId', path: ['bids'] });
    expect(first.changes[0]!.cells?.groupId).toBe('1040');
    const { plan, execute } = await tool.plan(tool.schema.parse({ campaignId: '104', reason: 'x', bids: { '1040': 12.5 } }), ctx());
    expect(plan!.newBids).toEqual([12.5]);
    await execute();
    expect(tree.find((n) => n.attribute === 'SKU-1')!.bid).toBe(12.5);
  });

  it('has nothing to do when Microsoft already matches', async () => {
    const tool = write('match_product_groups_to_google');
    const first = await tool.plan(tool.schema.parse({ campaignId: '104', reason: 'x' }), ctx());
    await first.execute();
    await expect(tool.plan(tool.schema.parse({ campaignId: '104', reason: 'x' }), ctx())).rejects.toThrow(/Ingen produktgrupper at rette/);
  });
});

describe('list_product_groups', () => {
  it('reads Microsoft\'s tree per ad group, without the raw API', async () => {
    tree = [
      { id: '1', parentId: null, group: '', groupId: '1040', unit: false, excluded: false, operand: 'All', attribute: '', bid: null },
      { id: '2', parentId: '1', group: '', groupId: '1040', unit: true, excluded: true, operand: 'Id', attribute: 'SKU-9', bid: null },
      { id: '3', parentId: '1', group: '', groupId: '1040', unit: true, excluded: false, operand: 'Id', attribute: '', bid: 4 },
    ];
    const tool = read('list_product_groups');
    const out = await tool.run(tool.schema.parse({ campaignId: '104' }), ctx());
    const g = (out.result as { adGroups: { tree: string; items: unknown[]; everythingElse: unknown }[] }).adGroups[0]!;
    expect(g.tree).toBe('by item id');
    expect(g.items).toEqual([{ itemId: 'SKU-9', excluded: true }]);
    expect(g.everythingElse).toEqual({ bid: 4 });
  });
});

describe('edit_product_groups', () => {
  it('excludes the item ids the user names, on one card, and reads the tree back', async () => {
    // Microsoft: SKU-1 and SKU-2 bid on, "everything else" excluded.
    tree = [
      { id: '1', parentId: null, group: '', groupId: '1040', unit: false, excluded: false, operand: 'All', attribute: '', bid: null },
      { id: '2', parentId: '1', group: '', groupId: '1040', unit: true, excluded: false, operand: 'Id', attribute: 'SKU-1', bid: 20 },
      { id: '3', parentId: '1', group: '', groupId: '1040', unit: true, excluded: false, operand: 'Id', attribute: 'SKU-2', bid: 32.63 },
      { id: '4', parentId: '1', group: '', groupId: '1040', unit: true, excluded: true, operand: 'Id', attribute: '', bid: null },
    ];
    const tool = write('edit_product_groups');
    const { plan: p, execute } = await tool.plan(tool.schema.parse({ campaignId: '104', adGroupId: '1040', exclude: ['SKU-2'], reason: 'Brugeren bad om det' }), ctx());
    const plan = p!;
    expect(plan.changes.map((l) => [l.after, l.cells?.kind])).toEqual([['SKU-2', 'Udeluk']]);
    expect(plan.pick?.skipPath).toEqual(['skip']);
    const done = await execute();
    expect((done.result as { outcome: string }).outcome).toBe('confirmed');
    expect(calls).toHaveLength(1);
    expect(tree.find((n) => n.attribute === 'SKU-2')!.excluded).toBe(true);
    expect(tree.find((n) => n.attribute === 'SKU-1')!.id).toBe('2'); // untouched
  });

  it('warns before excluding a product that converts', async () => {
    tree = [{ id: '1', parentId: null, group: '', groupId: '1040', unit: true, excluded: false, operand: 'All', attribute: '', bid: 2.2 }];
    const c = ctx();
    c.backend.shownProducts = async () => [{ itemId: 'SKU-5', adGroupId: '1040', impressions: 900, clicks: 30, spend: 150, conversions: 2, revenue: 1200 }];
    const tool = write('edit_product_groups');
    const { plan } = await tool.plan(tool.schema.parse({ campaignId: '104', adGroupId: '1040', exclude: ['SKU-5'], reason: 'x' }), c);
    expect(plan!.notes!.join(' ')).toMatch(/byder i dag på alle produkter/);
    expect(plan!.notes!.join(' ')).toMatch(/SKU-5 har konverteret: 90 dage: 30 klik, 150\s?kr\., 2 konv\., ROAS 8 – den klarer sig godt/);
  });

  it('says when there is nothing to change', async () => {
    tree = [
      { id: '1', parentId: null, group: '', groupId: '1040', unit: false, excluded: false, operand: 'All', attribute: '', bid: null },
      { id: '2', parentId: '1', group: '', groupId: '1040', unit: true, excluded: true, operand: 'Id', attribute: 'SKU-1', bid: null },
      { id: '3', parentId: '1', group: '', groupId: '1040', unit: true, excluded: false, operand: 'Id', attribute: '', bid: 1 },
    ];
    const tool = write('edit_product_groups');
    await expect(tool.plan(tool.schema.parse({ campaignId: '104', adGroupId: '1040', exclude: ['SKU-1'], reason: 'x' }), ctx())).rejects.toThrow(/Intet at ændre.*SKU-1 er allerede udelukket/);
  });
});
