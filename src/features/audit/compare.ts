/**
 * Holds one campaign's insides in Google Ads up against Microsoft Advertising (detail.ts)
 * and lists what differs – what Google does that Bing does not, first.
 *
 * - Products: excluded in Google but not in Bing (Shopping product groups, PMax listing groups).
 * - Negative keywords: in Google (campaign, ad group, shared lists) but not covering in Bing.
 * - Ad groups and keywords: groups paired by name; keywords missing, or with another match type.
 * - Search terms: converting in Google but unseen in Bing; paid for in Bing though Google excludes them.
 * - Ads: per ad group, headlines and landing pages Google uses that Bing does not.
 *
 * Pure functions – no imports through the `@/` alias.
 */
import type { CampaignStructure, DAd, DAdGroup, DListingNode, DNegative, DSearchTerm, DetailMetrics, MatchKind, NegativeDetail } from './detail';
import { nameScore } from './match';

/* ---------------------------------- helpers ---------------------------------- */

/** Lower case, single spaces, without the match type marks some exports carry ([x], "x", +x). */
export function normText(text: string): string {
  return text
    .toLowerCase()
    .replace(/^[\["]+|[\]"]+$/g, '')
    .replace(/(^|\s)\+/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

const normName = (name: string) => name.toLowerCase().replace(/\s+/g, ' ').trim();

export interface GroupPair {
  google: DAdGroup | null;
  bing: DAdGroup | null;
}

/** Pairs ad groups by name: the same name first, then the most alike (at least half the words). */
export function pairGroups(google: DAdGroup[], bing: DAdGroup[]): GroupPair[] {
  const left = new Set(bing);
  const pairs: GroupPair[] = [];
  const unpaired: DAdGroup[] = [];
  for (const g of google) {
    const same = [...left].find((b) => normName(b.name) === normName(g.name));
    if (same) {
      left.delete(same);
      pairs.push({ google: g, bing: same });
    } else unpaired.push(g);
  }
  for (const g of unpaired) {
    let best: DAdGroup | null = null;
    let score = 0.5;
    for (const b of left) {
      const s = nameScore(g.name, b.name);
      if (s >= score) [best, score] = [b, s];
    }
    if (best) left.delete(best);
    pairs.push({ google: g, bing: best });
  }
  for (const b of left) pairs.push({ google: null, bing: b });
  return pairs;
}

/* ---------------------------------- products ---------------------------------- */

export interface Condition {
  dim: string;
  value: string;
}

export interface Exclusion {
  group: string;
  /** From the top of the tree down to the excluded node (the root "all" left out); [] = everything. */
  path: Condition[];
}

/** The excluded units of a product tree, each with the conditions leading to it. */
export function exclusionsOf(nodes: DListingNode[]): Exclusion[] {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const out: Exclusion[] = [];
  for (const n of nodes) {
    if (!n.excluded || !n.unit) continue;
    const path: Condition[] = [];
    const seen = new Set<string>();
    for (let cur: DListingNode | undefined = n; cur && !seen.has(cur.id); cur = cur.parentId ? byId.get(cur.parentId) : undefined) {
      seen.add(cur.id);
      if (cur.dim !== 'all') path.unshift({ dim: cur.dim, value: cur.value });
    }
    out.push({ group: n.group, path });
  }
  return out;
}

const pathKey = (path: Condition[]) => path.map((c) => `${c.dim}=${c.value}`).join(' > ');

/** Google's category conditions name a category by number, Microsoft's by name – they cannot be matched up. */
const comparable = (path: Condition[]) => !path.some((c) => c.dim.startsWith('category'));

export interface ExclusionGap {
  path: Condition[];
  /** The ad groups / asset groups it is excluded in. */
  groups: string[];
  /** False when the platforms name it differently (product categories): check by hand. */
  comparable: boolean;
}

export interface ExclusionComparison {
  missingInBing: ExclusionGap[];
  onlyInBing: ExclusionGap[];
  /** Google exclusions Bing also has (the same, or a broader one). */
  covered: number;
  googleTotal: number;
}

function grouped(list: Exclusion[]): ExclusionGap[] {
  const byKey = new Map<string, ExclusionGap>();
  for (const e of list) {
    const k = pathKey(e.path);
    const gap = byKey.get(k) ?? { path: e.path, groups: [], comparable: comparable(e.path) };
    if (e.group && !gap.groups.includes(e.group)) gap.groups.push(e.group);
    byKey.set(k, gap);
  }
  return [...byKey.values()];
}

/**
 * Bing covers a Google exclusion when it excludes the same thing or something broader:
 * every condition of Bing's exclusion is among Google's (across ad groups).
 */
export function compareExclusions(google: DListingNode[], bing: DListingNode[]): ExclusionComparison {
  const g = grouped(exclusionsOf(google));
  const b = grouped(exclusionsOf(bing));
  const has = (path: Condition[], c: Condition) => path.some((p) => p.dim === c.dim && p.value === c.value);
  const covers = (broad: Condition[], narrow: Condition[]) => broad.every((c) => has(narrow, c));
  const missingInBing = g.filter((ge) => !b.some((be) => covers(be.path, ge.path)));
  const onlyInBing = b.filter((be) => !g.some((ge) => covers(ge.path, be.path)));
  return { missingInBing, onlyInBing, covered: g.length - missingInBing.length, googleTotal: g.length };
}

/* -------------------------------- negative keywords -------------------------------- */

export interface NegativeGap {
  text: string;
  matchType: MatchKind;
  /** Where Google has it: "Kampagne", "Liste: …", "Annoncegruppe: …". */
  sources: string[];
  /** What to add in Bing (Bing has no broad negatives: phrase is the nearest). */
  suggested: 'exact' | 'phrase';
  /**
   * Where it belongs in Microsoft: the Bing ad group that matches the Google ad group it is
   * on (`group`), or the campaign. `null` group + `onAdGroup`: it is on a Google ad group
   * that has no counterpart in Microsoft – the person decides where it goes.
   */
  target: { kind: 'campaign' } | { kind: 'adgroup'; group: string | null };
}

export interface NegativeComparison {
  missingInBing: NegativeGap[];
  onlyInBing: NegativeGap[];
  covered: number;
  /** Of the covered ones: Google's broad, several-word negatives, which Microsoft only has as phrase (it has no broad negatives). */
  weaker: number;
  googleTotal: number;
}

function sourceOf(n: DNegative): string {
  if (n.level === 'list') return `Liste: ${n.listName || 'uden navn'}`;
  if (n.level === 'adgroup') return `Annoncegruppe: ${n.adGroupName || 'uden navn'}`;
  return 'Kampagne';
}

/** Does a Bing negative of `bing` match type stop at least what Google's `google` one does (same text)? */
function coversMatch(google: MatchKind, bing: MatchKind): boolean {
  if (google === 'exact') return true; // any Bing negative with the same text stops the exact query
  return bing === 'phrase' || bing === 'broad';
}

/** Google broad, several words – Microsoft's phrase only stops the words in that order. */
const weakerThanGoogle = (google: DNegative, bing: DNegative) => google.matchType === 'broad' && bing.matchType !== 'broad' && normText(google.text).includes(' ');

/** The names of the Bing ad groups a Google ad group stands for: the same name, else the alike ones. */
export function counterparts(googleGroup: string, bingGroups: string[]): string[] {
  const same = bingGroups.filter((b) => normName(b) === normName(googleGroup));
  if (same.length) return same;
  return bingGroups
    .map((b) => ({ b, score: nameScore(googleGroup, b) }))
    .filter((x) => x.score >= 0.5)
    .sort((a, b) => b.score - a.score)
    .map((x) => x.b);
}

export function compareNegatives(google: NegativeDetail, bing: NegativeDetail): NegativeComparison {
  const key = (n: DNegative) => `${normText(n.text)}|${n.matchType}`;
  const targetOf = (n: DNegative): NegativeGap['target'] => (n.level === 'adgroup' ? { kind: 'adgroup', group: counterparts(n.adGroupName ?? '', bing.adGroups)[0] ?? null } : { kind: 'campaign' });
  const merge = (list: DNegative[]) => {
    const byKey = new Map<string, NegativeGap>();
    for (const n of list) {
      const k = key(n);
      const gap = byKey.get(k) ?? { text: normText(n.text), matchType: n.matchType, sources: [], suggested: n.matchType === 'exact' ? 'exact' : 'phrase', target: targetOf(n) };
      const src = sourceOf(n);
      if (!gap.sources.includes(src)) gap.sources.push(src);
      byKey.set(k, gap);
    }
    return byKey;
  };
  // Which Bing negative stops it: one on the campaign or in a list stops it everywhere; one on an
  // ad group only there – in the ad group that stands for Google's (not only the one with the same name).
  const coveredBy = (g: DNegative): DNegative | null => {
    const groups = g.level === 'adgroup' ? counterparts(g.adGroupName ?? '', bing.adGroups).map(normName) : [];
    return (
      bing.negatives.find(
        (b) => normText(b.text) === normText(g.text) && coversMatch(g.matchType, b.matchType) && (b.level !== 'adgroup' || (g.level === 'adgroup' && groups.includes(normName(b.adGroupName ?? '')))),
      ) ?? null
    );
  };
  const googleHas = (b: DNegative) => google.negatives.some((g) => normText(g.text) === normText(b.text));
  const missing = google.negatives.filter((g) => !coveredBy(g));
  const all = merge(google.negatives);
  const missingKeys = merge(missing);
  const weakKeys = new Set(google.negatives.filter((g) => !missing.includes(g) && weakerThanGoogle(g, coveredBy(g)!)).map(key));
  return {
    missingInBing: [...missingKeys.values()],
    onlyInBing: [...merge(bing.negatives.filter((b) => !googleHas(b))).values()],
    covered: all.size - missingKeys.size,
    weaker: [...weakKeys].filter((k) => !missingKeys.has(k)).length,
    googleTotal: all.size,
  };
}

/* ------------------------------- ad groups and keywords ------------------------------- */

export interface KeywordGap {
  text: string;
  matchType: MatchKind;
  /** The Google ad group, and the Bing one it is paired with (null: no counterpart). */
  googleGroup: string;
  bingGroup: string | null;
  metrics?: DetailMetrics;
}

/** An active Google keyword that Microsoft has – but not where, or not running. */
export interface KeywordElsewhere extends KeywordGap {
  /** The Bing ad group(s) it is in, and whether it is running there. */
  found: { group: string; status: string }[];
}

export interface MatchTypeDiff {
  text: string;
  googleGroup: string;
  bingGroup: string;
  google: MatchKind[];
  bing: MatchKind[];
}

export interface KeywordComparison {
  pairs: GroupPair[];
  /** Active Google keywords that are nowhere in the Microsoft campaign – most converting first. */
  missingInBing: KeywordGap[];
  /** Active in Google, in Microsoft only in another ad group – or paused. */
  elsewhereInBing: KeywordElsewhere[];
  onlyInBing: { text: string; matchType: MatchKind; bingGroup: string }[];
  matchTypeDiffs: MatchTypeDiff[];
}

const active = (status: string) => status === 'active';

export function compareKeywords(google: CampaignStructure, bing: CampaignStructure): KeywordComparison {
  const pairs = pairGroups(google.adGroups, bing.adGroups);
  const bingGroupName = new Map(bing.adGroups.map((g) => [g.id, g.name]));
  // Where each keyword text is in Microsoft, in the whole campaign (paused ones too).
  const inBing = new Map<string, { group: string; status: string }[]>();
  for (const k of bing.keywords) {
    if (k.status === 'deleted') continue;
    const list = inBing.get(normText(k.text)) ?? [];
    list.push({ group: bingGroupName.get(k.adGroupId) ?? '', status: k.status });
    inBing.set(normText(k.text), list);
  }
  const missingInBing: KeywordGap[] = [];
  const elsewhereInBing: KeywordElsewhere[] = [];
  const onlyInBing: KeywordComparison['onlyInBing'] = [];
  const matchTypeDiffs: MatchTypeDiff[] = [];
  for (const p of pairs) {
    const gk = p.google ? google.keywords.filter((k) => k.adGroupId === p.google!.id && active(k.status)) : [];
    const bk = p.bing ? bing.keywords.filter((k) => k.adGroupId === p.bing!.id && active(k.status)) : [];
    const types = (list: typeof gk, text: string) => [...new Set(list.filter((k) => normText(k.text) === text).map((k) => k.matchType))].sort();
    const gTexts = new Set(gk.map((k) => normText(k.text)));
    const bTexts = new Set(bk.map((k) => normText(k.text)));
    for (const k of gk) {
      const text = normText(k.text);
      if (bTexts.has(text)) continue;
      const gap = { text, matchType: k.matchType, googleGroup: p.google!.name, bingGroup: p.bing?.name ?? null, metrics: k.metrics };
      const found = inBing.get(text);
      if (found?.length) elsewhereInBing.push({ ...gap, found });
      else missingInBing.push(gap);
    }
    for (const k of bk) {
      const text = normText(k.text);
      // Only in Microsoft when Google has it in no ad group at all.
      if (!gTexts.has(text) && !google.keywords.some((g) => active(g.status) && normText(g.text) === text)) onlyInBing.push({ text, matchType: k.matchType, bingGroup: p.bing!.name });
    }
    if (p.google && p.bing)
      for (const text of gTexts) {
        if (!bTexts.has(text)) continue;
        const g = types(gk, text);
        const b = types(bk, text);
        if (g.join() !== b.join()) matchTypeDiffs.push({ text, googleGroup: p.google.name, bingGroup: p.bing.name, google: g, bing: b });
      }
  }
  const byValue = (a: KeywordGap, b: KeywordGap) => (b.metrics?.conversions ?? 0) - (a.metrics?.conversions ?? 0) || (b.metrics?.clicks ?? 0) - (a.metrics?.clicks ?? 0);
  missingInBing.sort(byValue);
  elsewhereInBing.sort(byValue);
  return { pairs, missingInBing, elsewhereInBing, onlyInBing, matchTypeDiffs };
}

/* ---------------------------------- search terms ---------------------------------- */

const words = (s: string) => normText(s).split(' ').filter(Boolean);

/** Would this negative keyword stop the search term? (Exact: the same; phrase: the words in order; broad: all the words.) */
export function blocks(n: { text: string; matchType: MatchKind }, term: string): boolean {
  const t = normText(term);
  const text = normText(n.text);
  if (!text) return false;
  if (n.matchType === 'exact') return t === text;
  if (n.matchType === 'phrase') return ` ${t} `.includes(` ${text} `);
  const have = new Set(words(t));
  return words(text).every((w) => have.has(w));
}

export interface BlockedTerm extends DSearchTerm {
  /** The Google negative that would have stopped it. */
  negative: { text: string; matchType: MatchKind };
}

export interface SearchTermComparison {
  /** Converting in Google, never shown in Bing – keyword candidates. */
  convertingOnlyInGoogle: DSearchTerm[];
  /** Paid for in Bing though a Google negative excludes it (and no Bing negative does). */
  excludedInGoogleOnly: BlockedTerm[];
}

export function compareSearchTerms(google: DSearchTerm[], bing: DSearchTerm[], googleNegatives: DNegative[], bingNegatives: DNegative[]): SearchTermComparison {
  const inBing = new Set(bing.map((t) => normText(t.term)));
  const convertingOnlyInGoogle = google.filter((t) => t.conversions > 0 && !inBing.has(normText(t.term))).sort((a, b) => b.conversions - a.conversions || b.revenue - a.revenue);
  const excludedInGoogleOnly: BlockedTerm[] = [];
  for (const t of bing) {
    if (t.spend <= 0) continue;
    const g = googleNegatives.find((n) => n.level !== 'adgroup' && blocks(n, t.term));
    if (!g || bingNegatives.some((n) => n.level !== 'adgroup' && blocks(n, t.term))) continue;
    excludedInGoogleOnly.push({ ...t, negative: { text: normText(g.text), matchType: g.matchType } });
  }
  excludedInGoogleOnly.sort((a, b) => b.spend - a.spend);
  return { convertingOnlyInGoogle, excludedInGoogleOnly };
}

/* ------------------------------------- ads ------------------------------------- */

/** "https://www.Shop.dk/stole/?utm=x" → "shop.dk/stole" – the page, without tracking. */
export function normUrl(url: string): string {
  return url
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/[?#].*$/, '')
    .replace(/\/+$/, '');
}

export interface AdGroupAdDiff {
  googleGroup: string | null;
  bingGroup: string | null;
  googleAds: number;
  bingAds: number;
  /** Headlines/descriptions in Google's running ads that no running Bing ad in the group has. */
  missingHeadlines: string[];
  missingDescriptions: string[];
  /** Landing pages only one side uses. */
  urlsOnlyGoogle: string[];
  urlsOnlyBing: string[];
}

export function compareAds(google: { adGroups: DAdGroup[]; ads: DAd[] }, bing: { adGroups: DAdGroup[]; ads: DAd[] }): AdGroupAdDiff[] {
  const running = (a: DAd) => a.status === 'active';
  return pairGroups(google.adGroups, bing.adGroups)
    .map((p): AdGroupAdDiff => {
      const ga = p.google ? google.ads.filter((a) => a.adGroupId === p.google!.id && running(a)) : [];
      const ba = p.bing ? bing.ads.filter((a) => a.adGroupId === p.bing!.id && running(a)) : [];
      const set = (list: DAd[], f: (a: DAd) => string[], norm: (s: string) => string) => new Set(list.flatMap(f).map(norm));
      const missing = (f: (a: DAd) => string[]) => {
        const have = set(ba, f, (s) => s.trim().toLowerCase());
        return [...new Set(ga.flatMap(f).map((s) => s.trim()))].filter((s) => !have.has(s.toLowerCase()));
      };
      const gu = set(ga, (a) => a.finalUrls, normUrl);
      const bu = set(ba, (a) => a.finalUrls, normUrl);
      return {
        googleGroup: p.google?.name ?? null,
        bingGroup: p.bing?.name ?? null,
        googleAds: ga.length,
        bingAds: ba.length,
        missingHeadlines: p.bing ? missing((a) => a.headlines) : [],
        missingDescriptions: p.bing ? missing((a) => a.descriptions) : [],
        urlsOnlyGoogle: [...gu].filter((u) => !bu.has(u)),
        urlsOnlyBing: [...bu].filter((u) => !gu.has(u)),
      };
    })
    .filter((d) => d.googleAds || d.bingAds);
}
