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
import { fmtMoney, fmtNumber } from '@/lib/format';
import { dimensionLabel, type DListingNode, type ItemStats, type ShownItems } from './detail';

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

export type MirrorAction = 'add_bid' | 'add_exclude' | 'to_bid' | 'to_exclude' | 'rebid' | 'remove' | 'else_bid' | 'else_exclude' | 'all' | 'collapse';

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
  /** This row's own bid (Google's for the item); none = the group's bid. */
  bid?: number | null;
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
  /** Performance Max listing groups: no bids at all (Microsoft sets them). */
  noBids?: boolean;
  /** Item ids Google excludes that Microsoft has not shown in this ad group: left alone – excluding them changes nothing. */
  unshown: string[];
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

/** A product worth keeping although Google leaves it out: it converts, at least at the kept ROAS. */
export function performsWell(s: ItemStats | undefined, keepRoas: number): boolean {
  if (!s || s.conversions <= 0) return false;
  return s.spend <= 0 || s.revenue / s.spend >= keepRoas;
}

/** "90 dage: 12 klik, 165 kr., 0 konv." */
export function statsText(s: ItemStats, currency = 'DKK'): string {
  const roas = s.spend > 0 && s.conversions > 0 ? `, ROAS ${fmtNumber(s.revenue / s.spend, 1)}` : '';
  return `90 dage: ${fmtNumber(s.clicks)} klik, ${fmtMoney(s.spend, currency)}, ${fmtNumber(s.conversions, s.conversions % 1 ? 1 : 0)} konv.${roas}`;
}

const rowKey = (bingAdGroupId: string, action: MirrorAction, itemId: string) => `${bingAdGroupId}|${action}|${itemId.toLowerCase()}`;

/**
 * Per Google ad group: its Microsoft counterpart (same or nearly the same name) and the
 * rows that would make Microsoft's tree like Google's. With `shown` (the products Microsoft
 * showed), an item Google excludes is only excluded in Microsoft when it showed there.
 */
export function planMirror(
  google: DListingNode[],
  bing: DListingNode[],
  bingGroups: { id: string; name: string; cpcBid?: number | null }[],
  shown: ShownItems | null = null,
  opts: { keepRoas?: number; currency?: string } = {},
): MirrorGroup[] {
  const googleByGroup = new Map<string, DListingNode[]>();
  for (const n of google) googleByGroup.set(n.group, [...(googleByGroup.get(n.group) ?? []), n]);
  const used = new Map<string, string>();
  const out: MirrorGroup[] = [];

  for (const [googleGroup, gNodes] of googleByGroup) {
    const g = shapeOf(gNodes);
    const name = counterparts(googleGroup, bingGroups.map((b) => b.name))[0];
    const bg = name ? bingGroups.find((b) => b.name === name) : undefined;
    const base = { googleGroup, bingGroup: bg?.name ?? null, bingAdGroupId: bg?.id ?? null, convert: false, rows: [] as MirrorRow[], unshown: [] as string[], google: g };
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
    const row = (action: MirrorAction, itemId: string, label: string, defaultOff = false, node?: DListingNode, rowBid?: number | null): MirrorRow => ({
      key: rowKey(bg.id, action, itemId),
      action,
      itemId,
      label,
      defaultOff,
      ...(node ? { bingNodeId: node.id, bingNodeExcluded: node.excluded } : {}),
      ...(rowBid ? { bid: rowBid } : {}),
    });
    const kr = (v: number) => fmtMoney(v, opts.currency ?? 'DKK', 2);

    if (g.kind === 'all') {
      if (b.kind === 'all') out.push({ ...group, status: 'same' });
      else if (b.kind === 'none') out.push({ ...group, rows: [row('all', '', 'Byd på alle produkter, som i Google (gruppen har ingen produktgrupper i Microsoft)')] });
      else out.push({ ...group, rows: [row('collapse', '', 'Fjern opdelingen efter varenummer, og byd på alle produkter som i Google – Microsofts bud pr. varenummer forsvinder', true)] });
      continue;
    }

    // Google is split by item id.
    const rows: MirrorRow[] = [];
    const unshown: string[] = [];
    const showsHere = shown?.byGroup.get(bg.id);
    const items = [...g.items.values()].sort((x, y) => (x.raw ?? x.value).localeCompare(y.raw ?? y.value, 'da'));
    for (const item of items) {
      const id = item.raw || item.value;
      const there = b.kind === 'ids' ? b.items.get(item.value) : undefined;
      const wouldExclude = item.excluded && (!there || !there.excluded);
      if (wouldExclude && shown && !showsHere?.has(item.value)) {
        unshown.push(id);
        continue;
      }
      const gBid = item.excluded ? null : (item.bid ?? null);
      if (!there) {
        // Already excluded through Microsoft's own excluded "everything else": nothing changes.
        if (item.excluded && b.kind === 'ids' && b.other.excluded) continue;
        rows.push(row(item.excluded ? 'add_exclude' : 'add_bid', id, item.excluded ? `Udeluk varenummer ${id}` : `Byd på varenummer ${id}${gBid ? ` – ${kr(gBid)} som i Google` : ''}`, false, undefined, gBid));
      } else if (there.excluded !== item.excluded)
        rows.push(row(item.excluded ? 'to_exclude' : 'to_bid', id, item.excluded ? `Udeluk varenummer ${id} (bydes på i Microsoft)` : `Byd på varenummer ${id} (udelukket i Microsoft)${gBid ? ` – ${kr(gBid)} som i Google` : ''}`, false, there, gBid));
      else if (!item.excluded && gBid && there.bid && Math.abs(gBid - there.bid) >= 0.005)
        rows.push(row('rebid', id, `Bud på ${id}: ${kr(there.bid)} → ${kr(gBid)} som i Google`, false, there, gBid));
    }
    if (b.kind === 'ids')
      for (const [value, node] of b.items) {
        if (g.items.has(value)) continue;
        const id = node.raw || value;
        if (!g.other.excluded) {
          rows.push(row('remove', id, `Fjern varenummer ${id} (ikke opdelt i Google – falder ind under "alt andet")`, true, node));
          continue;
        }
        // Not in Google, where "everything else" is excluded: excluded there too. Already excluded here – nothing to do.
        if (node.excluded) continue;
        const stats = shown?.stats?.get(`${bg.id}|${value}`);
        const keep = performsWell(stats, opts.keepRoas ?? 1);
        rows.push(
          row(
            'to_exclude',
            id,
            keep
              ? `${id} er ikke i Google (hører under udelukket "alt andet"), men klarer sig godt her: ${statsText(stats!, opts.currency)} – beholdes, medmindre du sætter flueben`
              : `Udeluk ${id} – ikke i Google (hører under udelukket "alt andet"). ${stats ? statsText(stats, opts.currency) : `Ikke vist de seneste ${90} dage`}`,
            keep,
            node,
          ),
        );
      }
    const bingOtherExcluded = b.kind === 'ids' ? b.other.excluded : false;
    // Only exclusions that changed nothing differed: splitting "Alle produkter" for none of them is no change.
    const nothingToSplit = b.kind !== 'ids' && !rows.length && !g.other.excluded;
    const gOtherBid = g.other.excluded ? null : (g.other.bid ?? null);
    if (!nothingToSplit && (b.kind !== 'ids' || g.other.excluded !== bingOtherExcluded))
      rows.push(
        row(
          g.other.excluded ? 'else_exclude' : 'else_bid',
          '',
          g.other.excluded ? '"Alt andet": udeluk, så kun de nævnte varenumre vises (som i Google)' : `"Alt andet": byd på resten af produkterne (som i Google${gOtherBid ? `, ${kr(gOtherBid)}` : ''})`,
          false,
          b.kind === 'ids' ? b.other : undefined,
          gOtherBid,
        ),
      );
    else if (b.kind === 'ids' && !g.other.excluded && !b.other.excluded && gOtherBid && b.other.bid && Math.abs(gOtherBid - b.other.bid) >= 0.005)
      rows.push(row('else_bid', '', `"Alt andet": bud ${kr(b.other.bid)} → ${kr(gOtherBid)} som i Google`, false, b.other, gOtherBid));
    if (!rows.length) out.push({ ...group, status: 'same', unshown });
    else out.push({ ...group, convert: b.kind !== 'ids', rows, unshown });
  }
  return out;
}

/* --------------------------- a change the user asks for --------------------------- */

export interface EditRequest {
  /** Item ids to exclude. */
  exclude?: string[];
  /** Item ids to bid on (as their own product group). */
  include?: string[];
  /** Item ids whose own product group goes – they fall under "everything else". */
  remove?: string[];
  /** The bid for items bid on; default the bid the group's items use most. */
  bid?: number | null;
  /** Item ids (or "alt andet" for everything else) whose bid becomes `bid`. */
  setBid?: string[];
  /** Performance Max: listing groups without bids. */
  noBids?: boolean;
}

/**
 * One Microsoft ad group's product groups changed as the user asked ("udeluk 2515012108 i
 * Flipover"): the same rows and actions as the Google mirror, without Google. `notes` says
 * what needed no change (already excluded, not its own group …).
 */
export function planEdit(nodes: DListingNode[], group: { id: string; name: string; cpcBid?: number | null }, req: EditRequest): MirrorGroup & { notes: string[] } {
  const b = shapeOf(nodes);
  const notes: string[] = [];
  const base = {
    googleGroup: group.name,
    bingGroup: group.name,
    bingAdGroupId: group.id,
    convert: b.kind === 'all' || b.kind === 'none',
    unshown: [] as string[],
    google: { kind: 'none' } as TreeShape,
    bing: b,
    bid: req.noBids ? null : (req.bid ?? bidOf(b, group.cpcBid)),
    noBids: !!req.noBids,
    notes,
  };
  if (b.kind === 'other') return { ...base, status: 'unsupported', reason: `Produkttræet i "${group.name}" ${b.why} – ret det i Microsoft Advertising.`, rows: [] };
  const rows: MirrorRow[] = [];
  const seen = new Set<string>();
  const row = (action: MirrorAction, itemId: string, label: string, node?: DListingNode): MirrorRow => ({
    key: rowKey(group.id, action, itemId),
    action,
    itemId,
    label,
    defaultOff: false,
    ...(node ? { bingNodeId: node.id, bingNodeExcluded: node.excluded } : {}),
  });
  const ids = (list: string[] | undefined) =>
    (list ?? [])
      .map((x) => x.trim())
      .filter((x) => x && !seen.has(x.toLowerCase()) && seen.add(x.toLowerCase()));
  const nodeOf = (id: string) => (b.kind === 'ids' ? b.items.get(id.toLowerCase()) : undefined);

  for (const id of ids(req.exclude)) {
    const there = nodeOf(id);
    if (there?.excluded) notes.push(`${there.raw || id} er allerede udelukket.`);
    else if (there) rows.push(row('to_exclude', there.raw || id, `Udeluk ${there.raw || id}`, there));
    else rows.push(row('add_exclude', id, `Udeluk ${id}`));
  }
  for (const id of ids(req.include)) {
    const there = nodeOf(id);
    if (there && !there.excluded) notes.push(`${there.raw || id} bydes der allerede på.`);
    else if (there) rows.push(row('to_bid', there.raw || id, `Byd på ${there.raw || id} (udelukket i dag)`, there));
    else rows.push(row('add_bid', id, `Byd på ${id}`));
  }
  for (const id of ids(req.remove)) {
    const there = nodeOf(id);
    if (!there) notes.push(`${id} er ikke sin egen produktgruppe – intet at fjerne.`);
    else rows.push(row('remove', there.raw || id, `Fjern ${there.raw || id} – falder under "alt andet" (${b.kind === 'ids' && b.other.excluded ? 'udelukket' : 'bydes på'})`, there));
  }
  if (req.setBid?.length) {
    if (req.noBids) notes.push('Performance Max har ingen bud pr. varenummer – Microsoft byder selv.');
    else if (!req.bid) notes.push('Angiv det nye bud.');
    else
      for (const raw of req.setBid) {
        const id = raw.trim();
        if (/^(alt andet|everything else|\*)$/i.test(id)) {
          if (b.kind === 'ids' && !b.other.excluded) rows.push(row('else_bid', '', `"Alt andet": bud ${req.bid}`, b.other));
          else if (b.kind === 'all' && !b.root.excluded) notes.push('Gruppen byder på alle produkter som ét – skift annoncegruppens standardbud med update_ad_groups.');
          else notes.push('"Alt andet" er udelukket – intet bud at ændre.');
          continue;
        }
        const there = nodeOf(id);
        if (!there) notes.push(`${id} er ikke sin egen produktgruppe – byd på den med include.`);
        else if (there.excluded) notes.push(`${there.raw || id} er udelukket – byd på den med include.`);
        else if (there.bid === req.bid) notes.push(`${there.raw || id} har allerede bud ${req.bid}.`);
        else rows.push(row('rebid', there.raw || id, `Bud på ${there.raw || id}: ${there.bid ?? '–'} → ${req.bid}`, there));
      }
  }
  // "Alle produkter" can only be split: switching or removing needs the item's own group.
  const usable = base.convert ? rows.filter((r) => r.action === 'add_bid' || r.action === 'add_exclude') : rows;
  return { ...base, status: usable.length ? 'changes' : 'same', rows: usable };
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
  // A bid is needed for every unit bid on that has no bid of its own (Google's), and for a new "everything else".
  const bidRow = (r: MirrorRow) => ['add_bid', 'to_bid', 'rebid', 'else_bid', 'all', 'collapse'].includes(r.action);
  const convertElse = group.convert && !rows.some((r) => r.action === 'else_exclude') && !rows.find((r) => r.action === 'else_bid')?.bid;
  const needsBid = !group.noBids && (rows.some((r) => bidRow(r) && !r.bid) || convertElse);
  if (needsBid && !group.bid) throw new Error(`"${group.bingGroup}" har intet bud at gå ud fra – sæt et standardbud på annoncegruppen først.`);
  const unit = (parentId: string | number, attribute: string | null, excluded: boolean, bid?: number | null): PartitionAction => ({
    action: 'Add',
    adGroupId,
    parentId,
    kind: 'unit',
    operand: ITEM,
    attribute,
    excluded,
    ...(excluded || group.noBids ? {} : { bid: bid || group.bid }),
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
    for (const r of adds) actions.push(unit(-1, r.itemId, r.action === 'add_exclude', r.bid));
    // Unticked, "everything else" keeps what the group does today: bid on.
    const elseRow = rows.find((r) => r.action === 'else_bid' || r.action === 'else_exclude');
    actions.push(unit(-1, null, elseRow?.action === 'else_exclude', elseRow?.bid));
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
        adds.push(unit(parent, r.itemId, r.action === 'add_exclude', r.bid));
        remaining++;
        break;
      case 'to_bid':
      case 'to_exclude':
      case 'rebid':
        // A unit cannot change between bid on and excluded: it is replaced (a new bid the same way).
        deletes.push({ action: 'Delete', adGroupId, id: r.bingNodeId!, excluded: !!r.bingNodeExcluded });
        adds.push(unit(parent, r.itemId, r.action === 'to_exclude', r.bid));
        break;
      case 'remove':
        deletes.push({ action: 'Delete', adGroupId, id: r.bingNodeId!, excluded: !!r.bingNodeExcluded });
        remaining--;
        break;
      case 'else_bid':
      case 'else_exclude':
        deletes.push({ action: 'Delete', adGroupId, id: r.bingNodeId!, excluded: !!r.bingNodeExcluded });
        adds.push(unit(parent, null, r.action === 'else_exclude', r.bid));
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
      else if (r.action === 'rebid') ok = !!node && !node.excluded && Math.abs((node.bid ?? 0) - (r.bid ?? group.bid ?? 0)) < 0.005;
      else if (r.action === 'remove') ok = !node;
      else if (r.action === 'else_bid') ok = !after.other.excluded && (!r.bid || Math.abs((after.other.bid ?? 0) - r.bid) < 0.005);
      else if (r.action === 'else_exclude') ok = after.other.excluded;
    }
    (ok ? confirmed : missing).push(r.label);
  }
  return { confirmed, missing };
}

/* ------------------------- the audit: what actually differs ------------------------- */

/** What applies to an item in one tree: its own unit, "everything else", or "Alle produkter". */
export interface ItemState {
  via: 'own' | 'else' | 'all';
  excluded: boolean;
  bid: number | null;
}

export type ItemDiffKind = 'exclude' | 'bid_on' | 'bid';

export interface ItemDiff {
  /** The item id as Google writes it ('' = all other products). */
  itemId: string;
  kind: ItemDiffKind;
  google: ItemState;
  bing: ItemState;
}

export interface GroupDiff {
  googleGroup: string | null;
  bingGroup: string | null;
  /** missing: only in Google · extra: only in Microsoft · unsupported: a tree split another way. */
  status: 'compared' | 'missing' | 'extra' | 'unsupported';
  reason?: string;
  googleStatus?: string;
  bingStatus?: string;
  diffs: ItemDiff[];
  /** Items that end up the same on both sides (also when one side gets there via "alt andet"). */
  same: number;
}

const near = (a: number | null, b: number | null) => a === null || b === null || Math.abs(a - b) < 0.005;

function stateOf(shape: TreeShape, value: string): ItemState | null {
  if (shape.kind === 'all') return { via: 'all', excluded: shape.root.excluded, bid: shape.root.bid ?? null };
  if (shape.kind !== 'ids') return null;
  const own = value ? shape.items.get(value) : undefined;
  if (own) return { via: 'own', excluded: own.excluded, bid: own.bid ?? null };
  return { via: 'else', excluded: shape.other.excluded, bid: shape.other.bid ?? null };
}

/** How one item differs, if it does: excluded on one side only, or bid on both at different bids (when both say a bid). */
function differs(g: ItemState, b: ItemState): ItemDiffKind | null {
  if (g.excluded && !b.excluded) return 'exclude';
  if (!g.excluded && b.excluded) return 'bid_on';
  if (!g.excluded && !near(g.bid, b.bid)) return 'bid';
  return null;
}

/**
 * The audit of a Shopping campaign's product groups, per ad group: which ad groups exist on
 * one side only, and for every item id either side names – and for all other products – what
 * actually applies (bid, or excluded; via its own product group, "alt andet" or "Alle
 * produkter"). Only real differences count: an item excluded through "alt andet" on one side
 * and on its own on the other is the same.
 */
export function compareProductTrees(google: DListingNode[], bing: DListingNode[]): GroupDiff[] {
  const byGroup = (nodes: DListingNode[]) => {
    const m = new Map<string, DListingNode[]>();
    for (const n of nodes) m.set(n.group, [...(m.get(n.group) ?? []), n]);
    return m;
  };
  const gGroups = byGroup(google);
  const bGroups = byGroup(bing);
  const used = new Set<string>();
  const out: GroupDiff[] = [];

  for (const [googleGroup, gNodes] of gGroups) {
    const name = counterparts(googleGroup, [...bGroups.keys()].filter((n) => !used.has(n)))[0];
    const googleStatus = gNodes[0]?.groupStatus;
    if (!name) {
      out.push({ googleGroup, bingGroup: null, status: 'missing', googleStatus, diffs: [], same: 0 });
      continue;
    }
    used.add(name);
    const bNodes = bGroups.get(name)!;
    const base = { googleGroup, bingGroup: name, googleStatus, bingStatus: bNodes[0]?.groupStatus, diffs: [] as ItemDiff[], same: 0 };
    const g = shapeOf(gNodes);
    const b = shapeOf(bNodes);
    if (g.kind === 'other' || b.kind === 'other' || g.kind === 'none' || b.kind === 'none') {
      const why = g.kind === 'other' ? `Googles træ ${g.why}` : b.kind === 'other' ? `Microsofts træ ${b.why}` : 'en af siderne har ingen produktgrupper';
      out.push({ ...base, status: 'unsupported', reason: `${why} – sammenlign i hånden.` });
      continue;
    }
    // Every item either side names, then all the other products.
    const values = new Map<string, string>();
    for (const shape of [g, b]) if (shape.kind === 'ids') for (const [v, n] of shape.items) if (!values.has(v)) values.set(v, n.raw || v);
    if (g.kind === 'ids') for (const [v, n] of g.items) values.set(v, n.raw || v);
    for (const [value, raw] of [...values, ['', ''] as const]) {
      const gs = stateOf(g, value)!;
      const bs = stateOf(b, value)!;
      const kind = differs(gs, bs);
      if (kind) base.diffs.push({ itemId: raw, kind, google: gs, bing: bs });
      else base.same++;
    }
    out.push({ ...base, status: 'compared' });
  }
  for (const [bingGroup, bNodes] of bGroups) if (!used.has(bingGroup)) out.push({ googleGroup: null, bingGroup, status: 'extra', bingStatus: bNodes[0]?.groupStatus, diffs: [], same: 0 });
  return out;
}

/** "Bud 40,05 kr." / "Udelukket", and how ("via Alt andet", "Alle produkter"). */
export function stateText(s: ItemState, currency = 'DKK'): { text: string; sub?: string } {
  const text = s.excluded ? 'Udelukket' : s.bid !== null ? `Bud ${fmtMoney(s.bid, currency, 2)}` : 'Bydes på';
  return { text, ...(s.via === 'else' ? { sub: 'via "Alt andet"' } : s.via === 'all' ? { sub: 'via "Alle produkter"' } : {}) };
}
