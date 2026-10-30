/**
 * One Microsoft Advertising campaign's insides, in the shape the audit compares
 * (detail.ts): read with the app's own Microsoft connection, one part at a time when the
 * part is opened – and never more than four calls at once.
 */
import { getBackend } from '@/bing/backend';
import type { AdGroup, AdsBackend, ProductTreeNode } from '@/bing/types';
import type { DateRange } from '@/lib/format';
import { bingDimension, type CampaignStructure, type DAd, type DAdGroup, type DListingNode, type DNegative, type DSearchTerm, type MatchKind, type NegativeDetail } from './detail';

const lower = (v: string | null | undefined) => (v ?? '').trim().toLowerCase();
const kind = (m: string): MatchKind => (/^exact$/i.test(m) ? 'exact' : /^phrase$/i.test(m) ? 'phrase' : 'broad');

/** Runs `fn` over `items`, at most `limit` at a time, in order. */
async function pool<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i]!);
      }
    }),
  );
  return out;
}

const groupsOf = (list: AdGroup[]): DAdGroup[] => list.filter((g) => g.status !== 'Deleted').map((g) => ({ id: g.id, name: g.name, status: lower(g.status) }));

async function adGroups(b: AdsBackend, accountId: string, campaignId: string) {
  return (await b.listAdGroups(accountId, campaignId)).filter((g) => g.status !== 'Deleted');
}

export async function bingStructure(accountId: string, campaignId: string, backend?: AdsBackend): Promise<CampaignStructure> {
  const b = backend ?? (await getBackend());
  const groups = await adGroups(b, accountId, campaignId);
  const keywords = (await pool(groups, 4, (g) => b.listKeywords(accountId, g.id))).flat();
  return {
    adGroups: groupsOf(groups),
    keywords: keywords.filter((k) => k.status !== 'Deleted').map((k) => ({ adGroupId: k.adGroupId, text: lower(k.text), matchType: kind(k.matchType), status: lower(k.status) })),
  };
}

export async function bingNegatives(accountId: string, campaignId: string, backend?: AdsBackend): Promise<NegativeDetail> {
  const b = backend ?? (await getBackend());
  const out: DNegative[] = [];
  for (const n of await b.listNegativeKeywords(accountId, 'Campaign', campaignId, campaignId)) out.push({ text: lower(n.text), matchType: kind(n.matchType), level: 'campaign' });
  const groups = await adGroups(b, accountId, campaignId);
  const perGroup = await pool(groups, 4, (g) => b.listNegativeKeywords(accountId, 'AdGroup', g.id, campaignId));
  groups.forEach((g, i) => {
    for (const n of perGroup[i]!) out.push({ text: lower(n.text), matchType: kind(n.matchType), level: 'adgroup', adGroupName: g.name });
  });
  if (b.listNegativeKeywordLists)
    for (const list of await b.listNegativeKeywordLists(accountId, campaignId))
      for (const n of list.keywords) out.push({ text: lower(n.text), matchType: kind(n.matchType), level: 'list', listName: list.name });
  return { negatives: out.filter((n) => n.text), adGroups: groups.map((g) => g.name) };
}

/** A tree node in the shared shape; Microsoft's unit/subdivision worked out from the tree when it did not say. */
export function toListingNodes(nodes: ProductTreeNode[]): DListingNode[] {
  const parents = new Set(nodes.map((n) => n.parentId).filter(Boolean));
  return nodes.map((n) => ({
    id: n.id,
    parentId: n.parentId,
    group: n.group,
    unit: n.unit ?? !parents.has(n.id),
    excluded: n.excluded,
    dim: n.parentId ? bingDimension(n.operand) : 'all',
    value: lower(n.attribute),
    raw: n.attribute,
    groupId: n.groupId,
    bid: n.bid ?? null,
  }));
}

export class NotAvailable extends Error {}

export async function bingProducts(accountId: string, campaignId: string, pmax: boolean, backend?: AdsBackend): Promise<DListingNode[]> {
  const b = backend ?? (await getBackend());
  if (pmax) {
    if (!b.listAssetGroupListingGroups) throw new NotAvailable('Listinggrupper kan kun læses fra den rigtige konto (ikke demo).');
    return toListingNodes(await b.listAssetGroupListingGroups(accountId, campaignId));
  }
  if (!b.listProductPartitions) throw new NotAvailable('Produktgrupper kan kun læses fra den rigtige konto (ikke demo).');
  const groups = await adGroups(b, accountId, campaignId);
  return toListingNodes((await pool(groups, 4, (g) => b.listProductPartitions!(accountId, g.id, g.name))).flat());
}

export async function bingSearchTerms(accountId: string, campaignId: string, range: DateRange, backend?: AdsBackend): Promise<DSearchTerm[]> {
  const b = backend ?? (await getBackend());
  const rows = await b.runReport(accountId, { kind: 'searchterm', range, aggregation: 'Summary', campaignIds: [campaignId] });
  const byTerm = new Map<string, DSearchTerm>();
  for (const r of rows) {
    const term = lower(r.searchTerm);
    if (!term) continue;
    const t = byTerm.get(term) ?? { term, impressions: 0, clicks: 0, spend: 0, conversions: 0, revenue: 0 };
    byTerm.set(term, {
      term,
      impressions: t.impressions + (r.impressions ?? 0),
      clicks: t.clicks + (r.clicks ?? 0),
      spend: t.spend + (r.spend ?? 0),
      conversions: t.conversions + (r.conversions ?? 0),
      revenue: t.revenue + (r.revenue ?? 0),
    });
  }
  return [...byTerm.values()].sort((a, b) => b.clicks - a.clicks);
}

export async function bingAds(accountId: string, campaignId: string, backend?: AdsBackend): Promise<{ adGroups: DAdGroup[]; ads: DAd[] }> {
  const b = backend ?? (await getBackend());
  const groups = await adGroups(b, accountId, campaignId);
  const ads = (await pool(groups, 4, (g) => b.listAds(accountId, g.id))).flat();
  return {
    adGroups: groupsOf(groups),
    ads: ads.map((a) => ({ adGroupId: a.adGroupId, status: lower(a.status), type: a.type, headlines: a.headlines, descriptions: a.descriptions, finalUrls: a.finalUrls })),
  };
}
