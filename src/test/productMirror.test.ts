import { describe, expect, it } from 'vitest';
import { buildActions, planMirror, shapeOf, verifyMirror, type MirrorGroup } from '@/features/audit/productMirror';
import { partitionActionJson } from '@/bing/live';
import { bingDimension, type DListingNode } from '@/features/audit/detail';
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

  it('adds, switches, offers to remove, and fixes "everything else"', () => {
    expect(g!.convert).toBe(false);
    expect(g!.bid).toBe(1.2); // the most common bid in the group
    expect(g!.rows.map((r) => [r.action, r.itemId, r.defaultOff])).toEqual([
      ['to_bid', 'SKU-2', false],
      ['add_exclude', 'SKU-3', false],
      ['remove', 'SKU-9', true],
      ['else_exclude', '', false],
    ]);
  });

  it('with the default choice: like Google, but SKU-9 is kept until someone ticks it', () => {
    const after = simulate(bing, buildActions(g!, defaults(g!)));
    expect(state(after)).toEqual({ items: { 'sku-1': 'bud', 'sku-2': 'bud', 'sku-3': 'udelukket', 'sku-9': 'bud' }, else: 'udelukket' });
    expect(after.find((n) => n.id === '11')).toBeDefined(); // SKU-1 untouched – keeps its id and history
  });

  it('with everything ticked: exactly Google’s tree', () => {
    const after = simulate(bing, buildActions(g!, all(g!)));
    expect(state(after)).toEqual({ items: { 'sku-1': 'bud', 'sku-2': 'bud', 'sku-3': 'udelukket' }, else: 'udelukket' });
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
