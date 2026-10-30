/**
 * Makes a Shopping campaign's product groups in Microsoft Advertising like Google's: the
 * same item ids bid on or excluded under each ad group, and the same "everything else".
 * Google is only read; every change is to Microsoft, after approval.
 *
 * Supported – because they can be mirrored exactly – are the two shapes Shopping ad groups
 * almost always have:
 * - "all": the whole tree is one unit ("Alle produkter").
 * - "ids": "Alle produkter" split by item id, one level deep, with an "everything else".
 * Anything else (split by brand or product type, more levels) is reported as such and left
 * alone: guessing at a tree is how products silently stop showing.
 *
 * Pure functions: the planning (what differs, per ad group) and the actions Microsoft gets.
 */
import type { PartitionAction } from '@/bing/types';
import { counterparts } from './compare';
import { dimensionLabel, type DListingNode } from './detail';

/* ----------------------------------- shapes ----------------------------------- */

export type TreeShape =
  | { kind: 'none' }
  | { kind: 'all'; root: DListingNode }
  | { kind: 'ids'; root: DListingNode; items: Map<string, DListingNode>; other: DListingNode }
  | { kind: 'other'; why: string };

/** What one ad group's product tree looks like. */
export function shapeOf(nodes: DListingNode[]): TreeShape {
  const roots = nodes.filter((n) => !n.parentId);
  if (!roots.length) return { kind: 'none' };
  if (roots.length > 1) return { kind: 'other', why: 'har flere rødder' };
  const root = roots[0]!;
  if (root.unit) return { kind: 'all', root };
  const children = nodes.filter((n) => n.parentId === root.id);
  const deeper = children.find((c) => !c.unit);
  if (deeper) return { kind: 'other', why: `er opdelt i flere niveauer (${dimensionLabel(deeper.dim)} og videre)` };
  const dims = [...new Set(children.map((c) => c.dim))];
  if (dims.length !== 1 || dims[0] !== 'id') return { kind: 'other', why: `er opdelt efter ${dims.map(dimensionLabel).join(' og ') || 'intet'}, ikke varenummer` };
  const other = children.find((c) => c.value === '');
  if (!other) return { kind: 'other', why: 'mangler "alt andet"' };
  const items = new Map(children.filter((c) => c.value !== '').map((c) => [c.value, c]));
  return { kind: 'ids', root, items, other };
}

/* ----------------------------------- planning ----------------------------------- */

export type MirrorAction = 'add_bid' | 'add_exclude' | 'to_bid' | 'to_exclude' | 'remove' | 'else_bid' | 'else_exclude' | 'all' | 'collapse';

export interface MirrorRow {
  /** Stable across re-plans: what the user ticks off is remembered by it. */
  key: string;
  action: MirrorAction;
  /** The item id as Google writes it ('' for "everything else" and whole-tree rows). */
  itemId: string;
  label: string;
  /** Rows that take something away (removing an item, undoing the split) start unticked. */
  defaultOff: boolean;
  bingNodeId?: string;
  bingNodeExcluded?: boolean;
}

export interface MirrorGroup {
  googleGroup: string;
  bingGroup: string | null;
  bingAdGroupId: string | null;
  status: 'changes' | 'same' | 'unsupported' | 'missing';
  reason?: string;
  /** Microsoft's "Alle produkter" (or no tree) is split by item id first. */
  convert: boolean;
  /** The bid new units get: what the ad group's units already bid most often. */
  bid: number | null;
  rows: MirrorRow[];
  google: TreeShape;
  bing: TreeShape;
}

/** The bid new units get: the most common bid of the group's units, else its "everything else", root or default bid. */
function bidOf(shape: TreeShape, fallback: number | null | undefined): number | null {
  if (shape.kind === 'ids') {
    const bids = [...shape.items.values(), shape.other].filter((n) => !n.excluded && n.bid).map((n) => n.bid!);
    if (bids.length) {
      const count = new Map<number, number>();
      for (const b of bids) count.set(b, (count.get(b) ?? 0) + 1);
      return [...count].sort((a, b) => b[1] - a[1] || b[0] - a[0])[0]![0];
    }
  }
  if (shape.kind === 'all' && shape.root.bid) return shape.root.bid;
  return fallback ?? null;
}

const rowKey = (bingAdGroupId: string, action: MirrorAction, itemId: string) => `${bingAdGroupId}|${action}|${itemId.toLowerCase()}`;

/**
 * Per Google ad group: its Microsoft counterpart (same or nearly the same name) and the
 * rows that would make Microsoft's tree like Google's.
 */
export function planMirror(google: DListingNode[], bing: DListingNode[], bingGroups: { id: string; name: string; cpcBid?: number | null }[]): MirrorGroup[] {
  const googleByGroup = new Map<string, DListingNode[]>();
  for (const n of google) googleByGroup.set(n.group, [...(googleByGroup.get(n.group) ?? []), n]);
  const used = new Map<string, string>();
  const out: MirrorGroup[] = [];

  for (const [googleGroup, gNodes] of googleByGroup) {
    const g = shapeOf(gNodes);
    const name = counterparts(googleGroup, bingGroups.map((b) => b.name))[0];
    const bg = name ? bingGroups.find((b) => b.name === name) : undefined;
    const base = { googleGroup, bingGroup: bg?.name ?? null, bingAdGroupId: bg?.id ?? null, convert: false, rows: [] as MirrorRow[], google: g };
    if (!bg) {
      out.push({ ...base, status: 'missing', reason: 'Ingen annoncegruppe med samme eller næsten samme navn i Microsoft.', bid: null, bing: { kind: 'none' } });
      continue;
    }
    const b = shapeOf(bing.filter((n) => n.groupId === bg.id));
    const bid = bidOf(b, bg.cpcBid);
    const group: MirrorGroup = { ...base, status: 'changes', bid, bing: b };
    if (used.has(bg.id)) {
      out.push({ ...group, status: 'unsupported', reason: `Microsoft-gruppen "${bg.name}" er allerede parret med Googles "${used.get(bg.id)}".` });
      continue;
    }
    used.set(bg.id, googleGroup);
    if (g.kind === 'other') {
      out.push({ ...group, status: 'unsupported', reason: `Googles produkttræ ${g.why} – det spejles ikke automatisk.` });
      continue;
    }
    if (g.kind === 'none') {
      out.push({ ...group, status: 'unsupported', reason: 'Google har ingen produktgrupper i annoncegruppen.' });
      continue;
    }
    if (b.kind === 'other') {
      out.push({ ...group, status: 'unsupported', reason: `Microsofts produkttræ ${b.why} – det ændres ikke automatisk.` });
      continue;
    }
    const row = (action: MirrorAction, itemId: string, label: string, defaultOff = false, node?: DListingNode): MirrorRow => ({
      key: rowKey(bg.id, action, itemId),
      action,
      itemId,
      label,
      defaultOff,
      ...(node ? { bingNodeId: node.id, bingNodeExcluded: node.excluded } : {}),
    });

    if (g.kind === 'all') {
      if (b.kind === 'all') out.push({ ...group, status: 'same' });
      else if (b.kind === 'none') out.push({ ...group, rows: [row('all', '', 'Byd på alle produkter, som i Google (gruppen har ingen produktgrupper i Microsoft)')] });
      else out.push({ ...group, rows: [row('collapse', '', 'Fjern opdelingen efter varenummer, og byd på alle produkter som i Google – Microsofts bud pr. varenummer forsvinder', true)] });
      continue;
    }

    // Google is split by item id.
    const rows: MirrorRow[] = [];
    const items = [...g.items.values()].sort((x, y) => (x.raw ?? x.value).localeCompare(y.raw ?? y.value, 'da'));
    for (const item of items) {
      const id = item.raw || item.value;
      const there = b.kind === 'ids' ? b.items.get(item.value) : undefined;
      if (!there) rows.push(row(item.excluded ? 'add_exclude' : 'add_bid', id, item.excluded ? `Udeluk varenummer ${id}` : `Byd på varenummer ${id}`));
      else if (there.excluded !== item.excluded)
        rows.push(row(item.excluded ? 'to_exclude' : 'to_bid', id, item.excluded ? `Udeluk varenummer ${id} (bydes på i Microsoft)` : `Byd på varenummer ${id} (udelukket i Microsoft)`, false, there));
    }
    if (b.kind === 'ids')
      for (const [value, node] of b.items)
        if (!g.items.has(value)) rows.push(row('remove', node.raw || value, `Fjern varenummer ${node.raw || value} (ikke opdelt i Google – falder ind under "alt andet")`, true, node));
    const bingOtherExcluded = b.kind === 'ids' ? b.other.excluded : false;
    if (b.kind !== 'ids' || g.other.excluded !== bingOtherExcluded)
      rows.push(
        row(
          g.other.excluded ? 'else_exclude' : 'else_bid',
          '',
          g.other.excluded ? '"Alt andet": udeluk, så kun de nævnte varenumre vises (som i Google)' : '"Alt andet": byd på resten af produkterne (som i Google)',
          false,
          b.kind === 'ids' ? b.other : undefined,
        ),
      );
    if (!rows.length) out.push({ ...group, status: 'same' });
    else out.push({ ...group, convert: b.kind !== 'ids', rows });
  }
  return out;
}

/* ----------------------------------- actions ----------------------------------- */

const ITEM = 'Id';

/**
 * The actions for one ad group, with only the chosen rows. Throws (in Danish) when the
 * result could not be a valid tree – nothing is sent then.
 */
export function buildActions(group: MirrorGroup, chosen: Set<string>): PartitionAction[] {
  const adGroupId = group.bingAdGroupId;
  if (!adGroupId || group.status !== 'changes') return [];
  const rows = group.rows.filter((r) => chosen.has(r.key));
  if (!rows.length) return [];
  const b = group.bing;
  const needsBid = rows.some((r) => ['add_bid', 'to_bid', 'else_bid', 'all', 'collapse'].includes(r.action)) || group.convert;
  if (needsBid && !group.bid) throw new Error(`"${group.bingGroup}" har intet bud at gå ud fra – sæt et standardbud på annoncegruppen først.`);
  const unit = (parentId: string | number, attribute: string | null, excluded: boolean): PartitionAction => ({
    action: 'Add',
    adGroupId,
    parentId,
    kind: 'unit',
    operand: ITEM,
    attribute,
    excluded,
    ...(excluded ? {} : { bid: group.bid }),
  });

  // The whole tree as one unit (Google bids on all products).
  if (rows.some((r) => r.action === 'all' || r.action === 'collapse')) {
    const actions: PartitionAction[] = [];
    // Deleting the root takes its whole tree with it.
    if (b.kind === 'ids' || b.kind === 'all') actions.push({ action: 'Delete', adGroupId, id: b.root.id, excluded: b.root.excluded });
    actions.push({ action: 'Add', adGroupId, parentId: null, kind: 'unit', operand: 'All', attribute: null, excluded: false, bid: group.bid });
    return actions;
  }

  // "Alle produkter" (or no tree) → split by item id: a new root with the chosen items and "everything else".
  if (group.convert) {
    const adds = rows.filter((r) => r.action === 'add_bid' || r.action === 'add_exclude');
    if (!adds.length) return [];
    const actions: PartitionAction[] = [];
    if (b.kind === 'all') actions.push({ action: 'Delete', adGroupId, id: b.root.id, excluded: b.root.excluded });
    actions.push({ action: 'Add', adGroupId, tempId: -1, parentId: null, kind: 'subdivision', operand: 'All', attribute: null, excluded: false });
    for (const r of adds) actions.push(unit(-1, r.itemId, r.action === 'add_exclude'));
    // Unticked, "everything else" keeps what the group does today: bid on.
    const elseRow = rows.find((r) => r.action === 'else_bid' || r.action === 'else_exclude');
    actions.push(unit(-1, null, elseRow?.action === 'else_exclude'));
    return actions;
  }

  // Already split by item id: change the items one by one.
  if (b.kind !== 'ids') return [];
  const parent = b.root.id;
  const deletes: PartitionAction[] = [];
  const adds: PartitionAction[] = [];
  let remaining = b.items.size;
  for (const r of rows) {
    switch (r.action) {
      case 'add_bid':
      case 'add_exclude':
        adds.push(unit(parent, r.itemId, r.action === 'add_exclude'));
        remaining++;
        break;
      case 'to_bid':
      case 'to_exclude':
        // A unit cannot change between bid on and excluded: it is replaced.
        deletes.push({ action: 'Delete', adGroupId, id: r.bingNodeId!, excluded: !!r.bingNodeExcluded });
        adds.push(unit(parent, r.itemId, r.action === 'to_exclude'));
        break;
      case 'remove':
        deletes.push({ action: 'Delete', adGroupId, id: r.bingNodeId!, excluded: !!r.bingNodeExcluded });
        remaining--;
        break;
      case 'else_bid':
      case 'else_exclude':
        deletes.push({ action: 'Delete', adGroupId, id: r.bingNodeId!, excluded: !!r.bingNodeExcluded });
        adds.push(unit(parent, null, r.action === 'else_exclude'));
        break;
    }
  }
  if (remaining < 1) throw new Error(`"${group.bingGroup}" ville stå uden ét eneste varenummer – fjern ikke dem alle, eller byd på alle produkter i stedet.`);
  return [...deletes, ...adds];
}

/** After the change: what the read-back must show for each chosen row. */
export function verifyMirror(group: MirrorGroup, chosen: Set<string>, after: TreeShape): { confirmed: string[]; missing: string[] } {
  const confirmed: string[] = [];
  const missing: string[] = [];
  for (const r of group.rows.filter((x) => chosen.has(x.key))) {
    let ok = false;
    if (r.action === 'all' || r.action === 'collapse') ok = after.kind === 'all' && !after.root.excluded;
    else if (after.kind === 'ids') {
      const node = after.items.get(r.itemId.toLowerCase());
      if (r.action === 'add_bid' || r.action === 'to_bid') ok = !!node && !node.excluded;
      else if (r.action === 'add_exclude' || r.action === 'to_exclude') ok = !!node && node.excluded;
      else if (r.action === 'remove') ok = !node;
      else if (r.action === 'else_bid') ok = !after.other.excluded;
      else if (r.action === 'else_exclude') ok = after.other.excluded;
    }
    (ok ? confirmed : missing).push(r.label);
  }
  return { confirmed, missing };
}
