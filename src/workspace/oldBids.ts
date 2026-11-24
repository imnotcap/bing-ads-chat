/**
 * Old product bids: when the app excludes an item in an ad group (edit_product_groups,
 * apply_stock_sheet, match_product_groups_to_google …), the bid it had there is saved – for
 * the whole team on Cloudflare (cloudflare/src/workspace.ts → /workspace/oldbids), or in this
 * PC's storage without a workspace (demo). Re-activating the item later gives it that bid back
 * instead of the group's usual one.
 */
import type { MirrorGroup } from '@/features/audit/productMirror';
import { useAccount } from '@/stores/account';
import { api } from './api';

/** ad group id → item id (lower case) → bid. */
export type OldBidMap = Map<string, Map<string, number>>;

export interface OldBid {
  adGroupId: string;
  itemId: string;
  bid: number;
}

const LOCAL = (accountId: string) => `bac.oldbids.${accountId}`;
const shared = () => !!useAccount.getState().workspace;

function readLocal(accountId: string): Record<string, Record<string, { bid: number; at: number }>> {
  try {
    return JSON.parse(localStorage.getItem(LOCAL(accountId)) ?? '{}');
  } catch {
    return {};
  }
}

function toMap(raw: Record<string, Record<string, { bid: number }>>): OldBidMap {
  return new Map(Object.entries(raw).map(([g, items]) => [g, new Map(Object.entries(items).map(([id, v]) => [id.toLowerCase(), v.bid]))]));
}

export async function loadOldBids(accountId: string): Promise<OldBidMap> {
  if (shared()) {
    try {
      return toMap((await api<{ bids: Record<string, Record<string, { bid: number }>> }>(`/workspace/oldbids?account=${encodeURIComponent(accountId)}`)).bids);
    } catch {
      /* the Worker may be older than old bids – this PC's own copy below */
    }
  }
  return toMap(readLocal(accountId));
}

/** Saves the bids (never throws: a lost old bid only means the group's bid is used later). */
export async function saveOldBids(accountId: string, bids: OldBid[]): Promise<void> {
  if (!bids.length) return;
  // This PC's copy always – also the fallback when the Worker can't be reached.
  try {
    const all = readLocal(accountId);
    for (const b of bids) (all[b.adGroupId] ??= {})[b.itemId.toLowerCase()] = { bid: b.bid, at: Date.now() };
    localStorage.setItem(LOCAL(accountId), JSON.stringify(all));
  } catch {
    /* private window */
  }
  if (shared()) await api('/workspace/oldbids', { method: 'POST', body: JSON.stringify({ account: accountId, bids }) }).catch(() => undefined);
}

export const oldBidOf = (map: OldBidMap, adGroupId: string, itemId: string): number | null => map.get(adGroupId)?.get(itemId.toLowerCase()) ?? null;

/**
 * The bids the chosen rows of a group take away by excluding: an item bid on as its own
 * product group keeps its own bid; an item that showed under "Alle produkter" / "alt andet"
 * keeps that bid. Performance Max has no bids.
 */
export function exclusionBids(group: MirrorGroup, chosen: Set<string>): OldBid[] {
  const adGroupId = group.bingAdGroupId;
  if (!adGroupId || group.noBids) return [];
  const b = group.bing;
  const out: OldBid[] = [];
  for (const r of group.rows) {
    if (!chosen.has(r.key) || !r.itemId) continue;
    let bid: number | null | undefined = null;
    if (r.action === 'to_exclude' && b.kind === 'ids') bid = b.items.get(r.itemId.toLowerCase())?.bid;
    else if (r.action === 'add_exclude') bid = b.kind === 'ids' ? (b.other.excluded ? null : b.other.bid) : b.kind === 'all' && !b.root.excluded ? b.root.bid : null;
    else continue;
    const value = bid ?? (r.action === 'add_exclude' ? group.bid : null);
    if (value && value > 0) out.push({ adGroupId, itemId: r.itemId, bid: value });
  }
  return out;
}
