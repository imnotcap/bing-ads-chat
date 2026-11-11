import { describe, expect, it } from 'vitest';
import { benchRoas, bidAdvice, buildActions, compareProductTrees, planEdit, planMirror, shapeOf, verifyMirror, type MirrorGroup } from '@/features/audit/productMirror';
import { listingGroupActionJson, partitionActionJson } from '@/bing/live';
import { bingDimension, type DListingNode, type ShownItems } from '@/features/audit/detail';
import type { PartitionAction } from '@/bing/types';

/* ------------------------------- building trees ------------------------------- */

const node = (id: string, parentId: string | null, dim: string, raw: string, o: Partial<DListingNode> = {}): DListingNode => ({
  id,
  parentId,
  group: 'Kontorstole',
  unit: true,
  excluded: false,
  dim,
  value: raw.toLowerCase(),
  raw,
  ...o,
});

/** Google: "Alle produkter" split by item id – SKU-1 and SKU-2 bid on, SKU-3 excluded, everything else excluded. */
const GOOGLE = [
  node('g0', null, 'all', '', { unit: false }),
  node('g1', 'g0', 'id', 'SKU-1'),
  node('g2', 'g0', 'id', 'SKU-2'),
  node('g3', 'g0', 'id', 'SKU-3', { excluded: true }),
  node('g4', 'g0', 'id', '', { excluded: true }),
];

const BING_GROUPS = [{ id: '500', name: 'Kontorstole', cpcBid: 0.4 }];
const bingNode = (id: string, parentId: string | null, dim: string, raw: string, o: Partial<DListingNode> = {}) => node(id, parentId, dim, raw, { groupId: '500', ...o });

/* -------- a simulator of Microsoft's product tree: applies actions, refuses an invalid tree -------- */

function simulate(before: DListingNode[], actions: PartitionAction[]): DListingNode[] {
  let nodes = before.map((n) => ({ ...n }));
  const temp = new Map<number, string>();
  let next = 1000;
  const descendants = (id: string): string[] => nodes.filter((n) => n.parentId === id).flatMap((c) => [c.id, ...descendants(c.id)]);
  for (const a of actions) {
    if (a.action === 'Delete') {
      const target = nodes.find((n) => n.id === a.id);
      if (!target) throw new Error(`Delete: ${a.id} findes ikke`);
      if (target.excluded !== a.excluded) throw new Error(`Delete: forkert type for ${a.id}`);
      const gone = new Set([a.id, ...descendants(a.id)]);
      nodes = nodes.filter((n) => !gone.has(n.id));
    } else {
      const id = String(next++);
      if (a.tempId !== undefined) temp.set(a.tempId, id);
      const parentId = a.parentId === null ? null : typeof a.parentId === 'number' && a.parentId < 0 ? temp.get(a.parentId)! : String(a.parentId);
      if (parentId && !nodes.some((n) => n.id === parentId)) throw new Error(`Add: forælder ${a.parentId} findes ikke`);
      if (a.kind === 'unit' && !a.excluded && !(a.bid && a.bid > 0)) throw new Error('Add: en enhed, der bydes på, mangler bud');
      nodes.push({
        id,
        parentId,
        group: 'Kontorstole',
        groupId: a.adGroupId,
        unit: a.kind === 'unit',
        excluded: a.excluded,
        dim: parentId ? bingDimension(a.operand) : 'all',
        value: (a.attribute ?? '').toLowerCase(),
        raw: a.attribute ?? '',
        bid: a.bid ?? null,
      });
    }
  }
  // Microsoft's rules for the tree after the call.
  const roots = nodes.filter((n) => !n.parentId);
  if (roots.length !== 1) throw new Error(`Træet har ${roots.length} rødder`);
  for (const parent of nodes.filter((n) => !n.unit)) {
    const kids = nodes.filter((n) => n.parentId === parent.id);
    if (new Set(kids.map((k) => k.dim)).size !== 1) throw new Error('Søskende er opdelt forskelligt');
    if (kids.filter((k) => k.value === '').length !== 1) throw new Error('En opdeling skal have præcis ét "alt andet"');
  }
  return nodes;
}

const all = (g: MirrorGroup) => new Set(g.rows.map((r) => r.key));
const defaults = (g: MirrorGroup) => new Set(g.rows.filter((r) => !r.defaultOff).map((r) => r.key));
const state = (nodes: DListingNode[]) => {
  const s = shapeOf(nodes);
  if (s.kind !== 'ids') return s.kind;
  return { items: Object.fromEntries([...s.items].map(([k, n]) => [k, n.excluded ? 'udelukket' : 'bud'])), else: s.other.excluded ? 'udelukket' : 'bud' };
};

/* ------------------------------------ tests ------------------------------------ */

describe('the shape of a product tree', () => {
  it('tells "Alle produkter", a split by item id, none and the rest apart', () => {
    expect(shapeOf([bingNode('1', null, 'all', '')]).kind).toBe('all');
    expect(shapeOf(GOOGLE).kind).toBe('ids');
    expect(shapeOf([]).kind).toBe('none');
    const byBrand = shapeOf([node('a', null, 'all', '', { unit: false }), node('b', 'a', 'brand', 'Acme'), node('c', 'a', 'brand', '')]);
    expect(byBrand).toEqual({ kind: 'other', why: 'er opdelt efter Mærke, ikke varenummer' });
    const deep = shapeOf([node('a', null, 'all', '', { unit: false }), node('b', 'a', 'brand', 'Acme', { unit: false }), node('c', 'b', 'id', 'SKU-1'), node('d', 'b', 'id', ''), node('e', 'a', 'brand', '')]);
    expect(deep.kind).toBe('other');
  });
});

describe('Microsoft has "Alle produkter" – split it like Google', () => {
  const bing = [bingNode('9', null, 'all', '', { bid: 0.8 })];
  const [g] = planMirror(GOOGLE, bing, BING_GROUPS);

  it('lists every item Google has, and "everything else"', () => {
    expect(g!.status).toBe('changes');
    expect(g!.convert).toBe(true);
    expect(g!.bid).toBe(0.8); // the root unit's bid
    expect(g!.rows.map((r) => [r.action, r.itemId])).toEqual([
      ['add_bid', 'SKU-1'],
      ['add_bid', 'SKU-2'],
      ['add_exclude', 'SKU-3'],
      ['else_exclude', ''],
    ]);
  });

  it('builds a valid tree that is the same as Google’s – item ids spelled as Google spells them', () => {
    const actions = buildActions(g!, all(g!));
    expect(actions[0]).toEqual({ action: 'Delete', adGroupId: '500', id: '9', excluded: false });
    const after = simulate(bing, actions);
    expect(state(after)).toEqual({ items: { 'sku-1': 'bud', 'sku-2': 'bud', 'sku-3': 'udelukket' }, else: 'udelukket' });
    expect(after.find((n) => n.value === 'sku-1')!.raw).toBe('SKU-1');
    expect(verifyMirror(g!, all(g!), shapeOf(after))).toEqual({ confirmed: g!.rows.map((r) => r.label), missing: [] });
  });

  it('keeps bidding on everything else when that row is ticked off', () => {
    const chosen = new Set(g!.rows.filter((r) => r.action !== 'else_exclude').map((r) => r.key));
    expect(state(simulate(bing, buildActions(g!, chosen)))).toMatchObject({ else: 'bud' });
  });

  it('does nothing when no item is chosen', () => {
    expect(buildActions(g!, new Set([g!.rows.at(-1)!.key]))).toEqual([]);
  });

  it('also builds a tree for an ad group without one', () => {
    const [none] = planMirror(GOOGLE, [], BING_GROUPS);
    expect(none!.bid).toBe(0.4); // the ad group's default bid
    const after = simulate([bingNode('x', null, 'all', '', { bid: 1 })].slice(0, 0), buildActions(none!, all(none!)));
    expect(state(after)).toEqual({ items: { 'sku-1': 'bud', 'sku-2': 'bud', 'sku-3': 'udelukket' }, else: 'udelukket' });
  });
});

describe('Microsoft is split by item id too – change only what differs', () => {
  const bing = [
    bingNode('10', null, 'all', '', { unit: false }),
    bingNode('11', '10', 'id', 'SKU-1', { bid: 1.2 }),
    bingNode('12', '10', 'id', 'SKU-2', { excluded: true }),
    bingNode('19', '10', 'id', 'SKU-9', { bid: 1.2 }),
    bingNode('18', '10', 'id', '', { bid: 0.5 }),
  ];
  const [g] = planMirror(GOOGLE, bing, BING_GROUPS);

  it('adds, switches, excludes what Google leaves out, and fixes "everything else"', () => {
    expect(g!.convert).toBe(false);
    expect(g!.bid).toBe(1.2); // the most common bid in the group
    expect(g!.rows.map((r) => [r.action, r.itemId, r.defaultOff])).toEqual([
      ['to_bid', 'SKU-2', false],
      ['add_exclude', 'SKU-3', false],
      // Not in Google, where "everything else" is excluded – and no results here: excluded, ticked.
      ['to_exclude', 'SKU-9', false],
      ['else_exclude', '', false],
    ]);
  });

  it('with the default choice: what Google shows, and SKU-9 excluded', () => {
    const after = simulate(bing, buildActions(g!, defaults(g!)));
    expect(state(after)).toEqual({ items: { 'sku-1': 'bud', 'sku-2': 'bud', 'sku-3': 'udelukket', 'sku-9': 'udelukket' }, else: 'udelukket' });
    expect(after.find((n) => n.id === '11')).toBeDefined(); // SKU-1 untouched – keeps its id and history
  });

  it('keeps an item Google leaves out when it does well here – unticked, with its numbers', () => {
    const shown: ShownItems = { from: '', to: '', all: new Set(['sku-9']), byGroup: new Map([['500', new Set(['sku-9'])]]), stats: new Map([['500|sku-9', { clicks: 40, spend: 200, conversions: 3, revenue: 1500 }]]) };
    const [kept] = planMirror(GOOGLE, bing, BING_GROUPS, shown, { keepRoas: 4 });
    const row = kept!.rows.find((r) => r.itemId === 'SKU-9')!;
    expect(row).toMatchObject({ action: 'to_exclude', defaultOff: true });
    expect(row.label).toMatch(/klarer sig godt her: 90 dage: 40 klik, 200\s?kr\., 3 konv\., ROAS 7,5 – beholdes/);
    // Under the ROAS to keep (7,5 < 10): excluded like the rest.
    const [strict] = planMirror(GOOGLE, bing, BING_GROUPS, shown, { keepRoas: 10 });
    expect(strict!.rows.find((r) => r.itemId === 'SKU-9')!.defaultOff).toBe(false);
  });

  it('refuses to leave a split without a single item', () => {
    const lonely = [bingNode('10', null, 'all', '', { unit: false }), bingNode('19', '10', 'id', 'SKU-9', { bid: 1 }), bingNode('18', '10', 'id', '', { bid: 1 })];
    const [one] = planMirror([node('g0', null, 'all', '', { unit: false }), node('g4', 'g0', 'id', 'SKU-7'), node('g5', 'g0', 'id', '')], lonely, BING_GROUPS);
    const onlyRemove = new Set(one!.rows.filter((r) => r.action === 'remove').map((r) => r.key));
    expect(() => buildActions(one!, onlyRemove)).toThrow(/uden ét eneste varenummer/);
  });

  it('says so when the trees are already alike', () => {
    const same = [
      bingNode('10', null, 'all', '', { unit: false }),
      bingNode('11', '10', 'id', 'sku-1', { bid: 1 }),
      bingNode('12', '10', 'id', 'SKU-2', { bid: 1 }),
      bingNode('13', '10', 'id', 'SKU-3', { excluded: true }),
      bingNode('18', '10', 'id', '', { excluded: true }),
    ];
    expect(planMirror(GOOGLE, same, BING_GROUPS)[0]!.status).toBe('same');
  });
});

describe('Google bids on all products', () => {
  const googleAll = [node('g0', null, 'all', '')];
  it('offers to undo Microsoft’s split – unticked to start with', () => {
    const bing = [bingNode('10', null, 'all', '', { unit: false }), bingNode('11', '10', 'id', 'SKU-1', { bid: 1 }), bingNode('18', '10', 'id', '', { excluded: true })];
    const [g] = planMirror(googleAll, bing, BING_GROUPS);
    expect(g!.rows.map((r) => [r.action, r.defaultOff])).toEqual([['collapse', true]]);
    expect(state(simulate(bing, buildActions(g!, all(g!))))).toBe('all');
  });
});

describe('what is left alone, and why', () => {
  it('a tree split by brand on either side, a missing ad group, and no bid', () => {
    const byBrand = [node('a', null, 'all', '', { unit: false }), node('b', 'a', 'brand', 'Acme'), node('c', 'a', 'brand', '')];
    expect(planMirror(byBrand, [], BING_GROUPS)[0]).toMatchObject({ status: 'unsupported', reason: expect.stringContaining('Mærke') });
    expect(planMirror(GOOGLE.map((n) => ({ ...n, group: 'Helt andet' })), [], BING_GROUPS)[0]!.status).toBe('missing');
    const [g] = planMirror(GOOGLE, [], [{ id: '500', name: 'Kontorstole', cpcBid: null }]);
    expect(() => buildActions(g!, all(g!))).toThrow(/intet bud/);
  });
});

describe('what Microsoft gets', () => {
  it('writes the actions as Microsoft’s REST API takes them', () => {
    expect(partitionActionJson({ action: 'Add', adGroupId: '500', tempId: -1, parentId: null, kind: 'subdivision', operand: 'All', attribute: null, excluded: false })).toEqual({
      Action: 'Add',
      AdGroupCriterion: {
        Type: 'BiddableAdGroupCriterion',
        Status: 'Active',
        AdGroupId: 500,
        Id: -1,
        Criterion: { Type: 'ProductPartition', Condition: { Operand: 'All', Attribute: null }, ParentCriterionId: null, PartitionType: 'Subdivision' },
        CriterionBid: null,
      },
    });
    expect(partitionActionJson({ action: 'Add', adGroupId: '500', parentId: -1, kind: 'unit', operand: 'Id', attribute: 'SKU-1', excluded: false, bid: 1.2 }).AdGroupCriterion).toMatchObject({
      Type: 'BiddableAdGroupCriterion',
      Criterion: { Condition: { Operand: 'Id', Attribute: 'SKU-1' }, ParentCriterionId: -1, PartitionType: 'Unit' },
      CriterionBid: { Type: 'FixedBid', Amount: 1.2 },
    });
    expect(partitionActionJson({ action: 'Add', adGroupId: '500', parentId: '77', kind: 'unit', operand: 'Id', attribute: null, excluded: true }).AdGroupCriterion).toEqual({
      Type: 'NegativeAdGroupCriterion',
      AdGroupId: 500,
      Criterion: { Type: 'ProductPartition', Condition: { Operand: 'Id', Attribute: null }, ParentCriterionId: 77, PartitionType: 'Unit' },
    });
    expect(partitionActionJson({ action: 'Delete', adGroupId: '500', id: '12', excluded: true })).toEqual({ Action: 'Delete', AdGroupCriterion: { Type: 'NegativeAdGroupCriterion', Id: 12, AdGroupId: 500 } });
  });
});

describe('products Microsoft never showed are not excluded – it would change nothing', () => {
  const shown = (ids: string[]): ShownItems => ({ from: '2026-08-04', to: '2026-11-01', all: new Set(ids), byGroup: new Map([['500', new Set(ids)]]) });

  it('leaves out an exclusion of an item Microsoft has not shown in the ad group', () => {
    const [g] = planMirror(GOOGLE, [bingNode('9', null, 'all', '', { bid: 0.8 })], BING_GROUPS, shown(['sku-1', 'sku-2']));
    expect(g!.rows.map((r) => [r.action, r.itemId])).toEqual([
      ['add_bid', 'SKU-1'],
      ['add_bid', 'SKU-2'],
      ['else_exclude', ''],
    ]);
    expect(g!.unshown).toEqual(['SKU-3']);
  });

  it('keeps an exclusion Microsoft has shown', () => {
    const [g] = planMirror(GOOGLE, [bingNode('9', null, 'all', '', { bid: 0.8 })], BING_GROUPS, shown(['sku-1', 'sku-2', 'sku-3']));
    expect(g!.rows.some((r) => r.action === 'add_exclude' && r.itemId === 'SKU-3')).toBe(true);
    expect(g!.unshown).toEqual([]);
  });

  it('does not split "Alle produkter" only for exclusions that change nothing', () => {
    const google = [node('g0', null, 'all', '', { unit: false }), node('g3', 'g0', 'id', 'SKU-3', { excluded: true }), node('g4', 'g0', 'id', '')];
    const [g] = planMirror(google, [bingNode('9', null, 'all', '', { bid: 0.8 })], BING_GROUPS, shown(['sku-1']));
    expect(g!.status).toBe('same');
    expect(g!.unshown).toEqual(['SKU-3']);
  });

  it('turns a bid into an exclusion only when the item showed', () => {
    const bing = [
      bingNode('b0', null, 'all', '', { unit: false }),
      bingNode('b1', 'b0', 'id', 'SKU-1', { bid: 1 }),
      bingNode('b2', 'b0', 'id', 'SKU-2', { bid: 1 }),
      bingNode('b3', 'b0', 'id', 'SKU-3', { bid: 1 }),
      bingNode('b4', 'b0', 'id', '', { excluded: true }),
    ];
    const [g] = planMirror(GOOGLE, bing, BING_GROUPS, shown(['sku-1', 'sku-2']));
    expect(g!.status).toBe('same');
    expect(g!.unshown).toEqual(['SKU-3']);
  });
});

describe('product groups the user asks for (edit_product_groups)', () => {
  const GROUP = { id: '500', name: 'Flipover', cpcBid: 0.4 };

  it('excludes items in a split ad group – the way Flipover looks in Microsoft', () => {
    // Microsoft: 2392164005, 2515012108, 2392163105, 2392163005 bid on; "everything else" excluded.
    const tree = [
      bingNode('1', null, 'all', '', { unit: false }),
      bingNode('2', '1', 'id', '2392164005', { bid: 20 }),
      bingNode('3', '1', 'id', '', { excluded: true }),
      bingNode('4', '1', 'id', '2515012108', { bid: 20 }),
      bingNode('5', '1', 'id', '2392163105', { bid: 20 }),
      bingNode('6', '1', 'id', '2392163005', { bid: 32.63 }),
    ];
    const g = planEdit(tree, GROUP, { exclude: ['2515012108', '2392163005'] });
    expect(g.status).toBe('changes');
    expect(g.rows.map((r) => [r.action, r.itemId])).toEqual([
      ['to_exclude', '2515012108'],
      ['to_exclude', '2392163005'],
    ]);
    const after = simulate(tree, buildActions(g, all(g)));
    expect(state(after)).toEqual({ items: { '2392164005': 'bud', '2392163105': 'bud', '2515012108': 'udelukket', '2392163005': 'udelukket' }, else: 'udelukket' });
  });

  it('says what needs no change, and adds what is not there yet', () => {
    const tree = [bingNode('1', null, 'all', '', { unit: false }), bingNode('2', '1', 'id', 'SKU-1', { excluded: true }), bingNode('3', '1', 'id', '', { bid: 1 })];
    const g = planEdit(tree, GROUP, { exclude: ['sku-1', 'SKU-7'], remove: ['SKU-8'] });
    expect(g.rows.map((r) => [r.action, r.itemId])).toEqual([['add_exclude', 'SKU-7']]);
    expect(g.notes).toEqual(['SKU-1 er allerede udelukket.', 'SKU-8 er ikke sin egen produktgruppe – intet at fjerne.']);
  });

  it('splits "Alle produkter" to exclude items – the rest keeps its bid', () => {
    const tree = [bingNode('9', null, 'all', '', { bid: 0.8 })];
    const g = planEdit(tree, GROUP, { exclude: ['SKU-1', 'SKU-2'] });
    expect(g).toMatchObject({ convert: true, bid: 0.8 });
    const after = simulate(tree, buildActions(g, all(g)));
    expect(state(after)).toEqual({ items: { 'sku-1': 'udelukket', 'sku-2': 'udelukket' }, else: 'bud' });
  });

  it('leaves a tree split some other way alone, and says why', () => {
    const tree = [bingNode('1', null, 'all', '', { unit: false }), bingNode('2', '1', 'brand', 'Acme', { bid: 1 }), bingNode('3', '1', 'brand', '', { bid: 1 })];
    expect(planEdit(tree, GROUP, { exclude: ['SKU-1'] })).toMatchObject({ status: 'unsupported', reason: expect.stringMatching(/opdelt efter mærke/i) });
  });
});

describe('bids and Performance Max (edit_product_groups)', () => {
  const GROUP = { id: '500', name: 'Flipover', cpcBid: 0.4 };
  const tree = () => [
    bingNode('1', null, 'all', '', { unit: false }),
    bingNode('2', '1', 'id', 'SKU-1', { bid: 20 }),
    bingNode('3', '1', 'id', 'SKU-2', { excluded: true }),
    bingNode('4', '1', 'id', '', { bid: 5 }),
  ];

  it('sets a new bid on items and on "alt andet" – and says what it cannot', () => {
    const g = planEdit(tree(), GROUP, { setBid: ['SKU-1', 'alt andet', 'SKU-2', 'SKU-9'], bid: 12 });
    expect(g.rows.map((r) => [r.action, r.itemId])).toEqual([
      ['rebid', 'SKU-1'],
      ['else_bid', ''],
    ]);
    expect(g.notes).toEqual(['SKU-2 er udelukket – byd på den med include.', 'SKU-9 er ikke sin egen produktgruppe – byd på den med include.']);
    const after = simulate(tree(), buildActions(g, all(g)));
    expect(after.find((n) => n.raw === 'SKU-1')!.bid).toBe(12);
    expect(after.find((n) => n.parentId && n.value === '')!.bid).toBe(12);
    expect(verifyMirror(g, all(g), shapeOf(after)).missing).toEqual([]);
  });

  it('Performance Max: excludes without any bid, and refuses bids', () => {
    const pmax = [bingNode('9', null, 'all', '', {})];
    const g = planEdit(pmax, GROUP, { exclude: ['SKU-1'], setBid: ['SKU-1'], bid: 5, noBids: true });
    expect(g).toMatchObject({ noBids: true, bid: null, convert: true });
    expect(g.notes).toContain('Performance Max har ingen bud pr. varenummer – Microsoft byder selv.');
    const actions = buildActions(g, all(g));
    expect(actions.every((a) => a.action === 'Delete' || a.bid === undefined)).toBe(true);
    expect(actions.filter((a) => a.action === 'Add').map((a) => (a.action === 'Add' ? [a.kind, a.attribute, a.excluded] : null))).toEqual([
      ['subdivision', null, false],
      ['unit', 'SKU-1', true],
      ['unit', null, false],
    ]);
  });
});

describe('what Microsoft gets for Performance Max', () => {
  it('sends listing groups without bids, with the asset group and Microsoft\'s own ids', () => {
    expect(listingGroupActionJson({ action: 'Delete', adGroupId: '77', id: '77~5', excluded: false })).toEqual({ Action: 'Delete', ListingGroup: { AssetGroupId: 77, Id: 5 } });
    expect(listingGroupActionJson({ action: 'Add', adGroupId: '77', tempId: -1, parentId: null, kind: 'subdivision', operand: 'All', attribute: null, excluded: false })).toEqual({
      Action: 'Add',
      ListingGroup: { AssetGroupId: 77, Id: -1, ParentListingGroupId: null, ListingGroupType: 'Subdivision', IsExcluded: false, Dimension: { Operand: 'All', Attribute: null } },
    });
    expect(listingGroupActionJson({ action: 'Add', adGroupId: '77', parentId: -1, kind: 'unit', operand: 'Id', attribute: 'SKU-1', excluded: true }).ListingGroup).toMatchObject({ ParentListingGroupId: -1, IsExcluded: true, Dimension: { Operand: 'Id', Attribute: 'SKU-1' } });
  });
});

describe('the audit of product groups – the Stabelstole campaign from the screenshots', () => {
  const n = (group: string, id: string, parentId: string | null, raw: string, o: Partial<DListingNode> = {}): DListingNode => ({
    id,
    parentId,
    group,
    unit: true,
    excluded: false,
    dim: parentId ? 'id' : 'all',
    value: raw.toLowerCase(),
    raw,
    ...o,
  });
  // Google: Oporto bids 40,05 on c065107708, excludes 2722150408 and c067805114, "alt andet" excluded.
  const google = [
    n('Stabelstole | Oporto', 'g0', null, '', { unit: false }),
    n('Stabelstole | Oporto', 'g1', 'g0', 'c065107708', { bid: 40.05 }),
    n('Stabelstole | Oporto', 'g2', 'g0', '', { excluded: true }),
    n('Stabelstole | Oporto', 'g3', 'g0', '2722150408', { excluded: true }),
    n('Stabelstole | Oporto', 'g4', 'g0', 'c067805114', { excluded: true }),
    n('Bistrostole', 'h0', null, '', { bid: 5 }),
  ];
  // Microsoft: 28,05 on c065107708, excludes 2722150408 and 2722220108, "everything else" excluded.
  const bing = [
    n('Stabelstole | Oporto', 'b0', null, '', { unit: false }),
    n('Stabelstole | Oporto', 'b1', 'b0', '2722150408', { excluded: true }),
    n('Stabelstole | Oporto', 'b2', 'b0', 'c065107708', { bid: 28.05 }),
    n('Stabelstole | Oporto', 'b3', 'b0', '', { excluded: true }),
    n('Stabelstole | Oporto', 'b4', 'b0', '2722220108', { excluded: true }),
  ];
  const result = compareProductTrees(google, bing);

  it('finds only the real difference in Oporto: the bid – the exclusions end up the same', () => {
    const oporto = result.find((r) => r.googleGroup === 'Stabelstole | Oporto')!;
    expect(oporto.status).toBe('compared');
    expect(oporto.diffs).toMatchObject([{ itemId: 'c065107708', label: 'c065107708', kind: 'bid', google: { via: 'own', excluded: false, bid: 40.05 }, bing: { via: 'own', excluded: false, bid: 28.05 } }]);
    // 2722150408, c067805114 (excluded via "alt andet" in Microsoft), 2722220108 (via "alt andet" in Google) and all others.
    expect(oporto.same).toBe(4);
  });

  it('reports an ad group Microsoft lacks', () => {
    expect(result.find((r) => r.googleGroup === 'Bistrostole')).toMatchObject({ status: 'missing', bingGroup: null });
  });

  it('catches excluded on one side and bid on on the other, through "alt andet" too', () => {
    const g = [n('A', 'g0', null, '', { unit: false }), n('A', 'g1', 'g0', 'X1', { bid: 10 }), n('A', 'g2', 'g0', '', { excluded: true })];
    const b = [n('A', 'b0', null, '', { unit: false }), n('A', 'b1', 'b0', 'X2', { bid: 10 }), n('A', 'b2', 'b0', '', { excluded: true })];
    const [a] = compareProductTrees(g, b);
    expect(a!.diffs.map((d) => [d.itemId, d.kind, d.google.via, d.bing.via])).toEqual([
      ['X1', 'bid_on', 'own', 'else'],
      ['X2', 'exclude', 'else', 'own'],
    ]);
  });

  const t = (group: string, id: string, parentId: string | null, dim: string, raw: string, o: Partial<DListingNode> = {}): DListingNode => ({ id, parentId, group, unit: true, excluded: false, dim: parentId ? dim : 'all', value: raw.toLowerCase(), raw, ...o });

  it('compares trees split by brand and then item id, at every level', () => {
    const g = [
      t('A', 'g0', null, 'all', '', { unit: false }),
      t('A', 'g1', 'g0', 'brand', 'Nike', { unit: false }),
      t('A', 'g2', 'g1', 'id', 'SKU1', { bid: 12 }),
      t('A', 'g3', 'g1', 'id', '', { bid: 8 }),
      t('A', 'g4', 'g0', 'brand', '', { excluded: true }),
    ];
    const b = [
      t('A', 'b0', null, 'all', '', { unit: false }),
      t('A', 'b1', 'b0', 'brand', 'nike', { bid: 8 }),
      t('A', 'b2', 'b0', 'brand', 'Adidas', { bid: 5 }),
      t('A', 'b3', 'b0', 'brand', '', { excluded: true }),
    ];
    const [a] = compareProductTrees(g, b);
    expect(a!.status).toBe('compared');
    expect(a!.splits).toBeDefined();
    expect(a!.diffs.map((d) => [d.label, d.kind, d.google.where, d.bing.where])).toEqual([
      ['Mærke: Nike › SKU1', 'bid', 'Mærke: Nike › SKU1', 'Mærke: nike'],
      ['Mærke: Adidas', 'exclude', 'Alt andet', 'Mærke: Adidas'],
    ]);
    // Nike's other products (8 kr. both sides) and all other brands (excluded both sides).
    expect(a!.same).toBe(2);
  });

  it("uses the ad group's default bid when a product group has none of its own", () => {
    const g = [t('A', 'g0', null, 'all', '', { groupBid: 6, bid: null })];
    const b = [t('A', 'b0', null, 'all', '', { bid: 6, groupBid: 1 })];
    const [a] = compareProductTrees(g, b);
    expect(a!.diffs).toEqual([]);
    expect(a!.defaultBid).toEqual({ google: 6, bing: 1 });
  });

  it('does not compare bids when Google bids automatically', () => {
    const [a] = compareProductTrees([t('A', 'g0', null, 'all', '', { bid: 6 })], [t('A', 'b0', null, 'all', '', { bid: 2 })], { bids: false });
    expect(a!.diffs).toEqual([]);
  });

  it('reports a Microsoft ad group with no product groups – it shows nothing', () => {
    const r = compareProductTrees([t('A', 'g0', null, 'all', '', { bid: 6 })], [], { bingGroups: [{ name: 'A', status: 'Active' }, { name: 'Z', status: 'Paused' }] });
    expect(r.map((x) => [x.googleGroup, x.bingGroup, x.status])).toEqual([
      ['A', 'A', 'empty'],
      [null, 'Z', 'extra'],
    ]);
  });

  it('pairs ad groups with the same name before alike names', () => {
    const g = [t('Stole sort', 'g0', null, 'all', '', { bid: 1 }), t('Stole', 'h0', null, 'all', '', { bid: 1 })];
    const b = [t('Stole', 'b0', null, 'all', '', { bid: 1 }), t('Stole sort', 'c0', null, 'all', '', { bid: 1 })];
    expect(compareProductTrees(g, b).map((x) => [x.googleGroup, x.bingGroup])).toEqual([
      ['Stole sort', 'Stole sort'],
      ['Stole', 'Stole'],
    ]);
  });

  it('leaves trees split by category to be checked by hand', () => {
    const g = [t('A', 'g0', null, 'all', '', { unit: false }), t('A', 'g1', 'g0', 'category1', '123'), t('A', 'g2', 'g0', 'category1', '')];
    const [a] = compareProductTrees(g, [t('A', 'b0', null, 'all', '')]);
    expect(a!.status).toBe('unsupported');
  });

  it('counts a product no product group covers as not shown', () => {
    const g = [t('A', 'g0', null, 'all', '', { bid: 3 })];
    const b = [t('A', 'b0', null, 'all', '', { unit: false }), t('A', 'b1', 'b0', 'id', 'X1', { bid: 3 })];
    const [a] = compareProductTrees(g, b);
    expect(a!.diffs.map((d) => [d.label, d.kind, d.bing.via])).toEqual([['Alle andre produkter', 'bid_on', 'none']]);
  });
});

describe('the fix for Oporto – only what really differs', () => {
  const n = (id: string, parentId: string | null, raw: string, o: Partial<DListingNode> = {}): DListingNode => ({ id, parentId, group: 'Oporto', unit: true, excluded: false, dim: parentId ? 'id' : 'all', value: raw.toLowerCase(), raw, ...o });
  const google = [n('g0', null, '', { unit: false }), n('g1', 'g0', 'c065107708', { bid: 40.05 }), n('g2', 'g0', '', { excluded: true }), n('g3', 'g0', '2722150408', { excluded: true }), n('g4', 'g0', 'c067805114', { excluded: true })];
  const bing = [n('b0', null, '', { unit: false }), n('b1', 'b0', '2722150408', { excluded: true }), n('b2', 'b0', 'c065107708', { bid: 28.05 }), n('b3', 'b0', '', { excluded: true }), n('b4', 'b0', '2722220108', { excluded: true })].map((x) => ({ ...x, groupId: '500' }));

  it('proposes the bid of 40,05 kr. as in Google, and no exclusion that "alt andet" already covers', () => {
    const [g] = planMirror(google, bing, [{ id: '500', name: 'Oporto', cpcBid: 5 }]);
    expect(g!.rows.map((r) => [r.action, r.itemId, r.bid])).toEqual([['rebid', 'c065107708', 40.05]]);
    const after = simulate(bing, buildActions(g!, all(g!)));
    expect(after.find((x) => x.raw === 'c065107708')!.bid).toBe(40.05);
    expect(verifyMirror(g!, all(g!), shapeOf(after)).missing).toEqual([]);
  });

  it('copies Google\'s bid for a new item, not the group\'s most common one', () => {
    const g2 = [...google, n('g5', 'g0', 'c070000001', { bid: 33.5 })];
    const [g] = planMirror(g2, bing, [{ id: '500', name: 'Oporto', cpcBid: 5 }]);
    expect(g!.rows.find((r) => r.itemId === 'c070000001')).toMatchObject({ action: 'add_bid', bid: 33.5 });
  });
});

describe('bid advice – Google\'s bid is a starting point, not a rule', () => {
  const st = (clicks: number, spend: number, conversions: number, revenue: number) => ({ clicks, spend, conversions, revenue });

  it('follows Google with too little data in Microsoft', () => {
    expect(bidAdvice(40, 28, st(4, 30, 0, 0), 5)).toMatchObject({ verdict: 'follow', bid: 40 });
    expect(bidAdvice(40, 28, undefined, 5).todo).toMatch(/^Hæv til 40,00/);
  });

  it('does not raise a product that gets clicks without sales', () => {
    expect(bidAdvice(40, 28, st(60, 900, 0, 0), 5)).toMatchObject({ verdict: 'keep', bid: 28 });
    expect(bidAdvice(20, 28, st(60, 900, 0, 0), 5)).toMatchObject({ verdict: 'follow', bid: 20 });
  });

  it('does not lower a product selling above target, and does not raise one below', () => {
    expect(bidAdvice(20, 28, st(80, 1000, 10, 8000), 5)).toMatchObject({ verdict: 'keep' });
    expect(bidAdvice(40, 28, st(80, 1000, 10, 8000), 5)).toMatchObject({ verdict: 'follow' });
    expect(bidAdvice(40, 28, st(80, 1000, 2, 2000), 5)).toMatchObject({ verdict: 'keep' });
    expect(bidAdvice(20, 28, st(80, 1000, 2, 2000), 5)).toMatchObject({ verdict: 'follow' });
  });

  it("judges against the campaign's own ROAS when there is no target", () => {
    const shown = { from: '', to: '', all: new Set<string>(), byGroup: new Map(), stats: new Map([['1|a', st(10, 100, 1, 400)], ['1|b', st(10, 100, 1, 200)]]) };
    expect(benchRoas(null, shown)).toBe(3);
    expect(benchRoas(4.5, shown)).toBe(4.5);
  });

  it('starts a rebid unticked when the advice is to keep Microsoft\'s bid', () => {
    const n = (id: string, parentId: string | null, raw: string, o: Partial<DListingNode> = {}): DListingNode => ({ id, parentId, group: 'A', unit: true, excluded: false, dim: parentId ? 'id' : 'all', value: raw.toLowerCase(), raw, ...o });
    const google = [n('g0', null, '', { unit: false }), n('g1', 'g0', 'X1', { bid: 40 }), n('g2', 'g0', '', { bid: 5 })];
    const bing = [n('b0', null, '', { unit: false }), n('b1', 'b0', 'X1', { bid: 28 }), n('b2', 'b0', '', { bid: 5 })].map((x) => ({ ...x, groupId: '7' }));
    const shown = { from: '', to: '', all: new Set(['x1']), byGroup: new Map([['7', new Set(['x1'])]]), stats: new Map([['7|x1', st(80, 1000, 2, 2000)]]) };
    const [g] = planMirror(google, bing, [{ id: '7', name: 'A', cpcBid: 5 }], shown, { targetRoas: 5 });
    const rebid = g!.rows.find((r) => r.action === 'rebid')!;
    expect(rebid.defaultOff).toBe(true);
    expect(rebid.label).toMatch(/behold/);
  });
});
