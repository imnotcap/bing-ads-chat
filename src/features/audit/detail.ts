/**
 * One campaign's insides, the same shape for both sides of the audit: Google Ads (read by
 * the Worker, cloudflare/src/googleAds.ts) and Microsoft Advertising (read by the app,
 * bingDetail.ts) – so compare.ts can hold them up against each other.
 *
 * Shared by the app and the Worker, so: no imports.
 */

export type MatchKind = 'exact' | 'phrase' | 'broad';

export interface DetailMetrics {
  impressions: number;
  clicks: number;
  spend: number;
  conversions: number;
  revenue: number;
}

export interface DAdGroup {
  id: string;
  name: string;
  /** 'active', 'paused' or the platform's own word for anything else. */
  status: string;
}

export interface DKeyword {
  adGroupId: string;
  text: string;
  matchType: MatchKind;
  status: string;
  /** The period's numbers (Google only – it is the side that shows what works). */
  metrics?: DetailMetrics;
}

export interface CampaignStructure {
  adGroups: DAdGroup[];
  keywords: DKeyword[];
}

export interface DNegative {
  text: string;
  matchType: MatchKind;
  /** Where it is set: on the campaign, on an ad group, or in a shared list the campaign uses. */
  level: 'campaign' | 'adgroup' | 'list';
  adGroupName?: string;
  listName?: string;
}

/**
 * One node of a product tree (Shopping's product groups, PMax's listing groups). `dim` is
 * the platform-neutral dimension – all, id, brand, type1–5, label0–4, category1–5,
 * condition, channel – and `value` is lower-case; '' is "everything else".
 */
export interface DListingNode {
  id: string;
  parentId: string | null;
  /** The ad group (Shopping) or asset group (PMax) the tree belongs to. */
  group: string;
  unit: boolean;
  excluded: boolean;
  dim: string;
  value: string;
}

export interface DSearchTerm extends DetailMetrics {
  term: string;
}

export interface DAd {
  adGroupId: string;
  status: string;
  type: string;
  headlines: string[];
  descriptions: string[];
  finalUrls: string[];
}

export type DetailPart = 'structure' | 'negatives' | 'products' | 'searchterms' | 'ads';
export const DETAIL_PARTS: DetailPart[] = ['structure', 'negatives', 'products', 'searchterms', 'ads'];

export interface DetailData {
  structure: CampaignStructure;
  negatives: DNegative[];
  products: DListingNode[];
  searchterms: DSearchTerm[];
  ads: { adGroups: DAdGroup[]; ads: DAd[] };
}

/* ------------------------------ product dimensions ------------------------------ */

/** Microsoft's product condition operands → the shared dimension names. */
export function bingDimension(operand: string): string {
  const o = operand.trim();
  if (/^all$/i.test(o)) return 'all';
  if (/^id$/i.test(o)) return 'id';
  if (/^brand$/i.test(o)) return 'brand';
  let m = /^ProductType(\d)$/i.exec(o);
  if (m) return `type${m[1]}`;
  m = /^CustomLabel(\d)$/i.exec(o);
  if (m) return `label${m[1]}`;
  m = /^CategoryL(\d)$/i.exec(o);
  if (m) return `category${m[1]}`;
  if (/^condition$/i.test(o)) return 'condition';
  if (/^channel$/i.test(o)) return 'channel';
  return o.toLowerCase();
}

export const DIMENSION_LABELS: Record<string, string> = {
  all: 'Alle produkter',
  id: 'Vare-ID',
  brand: 'Mærke',
  condition: 'Stand',
  channel: 'Kanal',
};

export function dimensionLabel(dim: string): string {
  if (DIMENSION_LABELS[dim]) return DIMENSION_LABELS[dim]!;
  let m = /^type(\d)$/.exec(dim);
  if (m) return `Produkttype ${m[1]}`;
  m = /^label(\d)$/.exec(dim);
  if (m) return `Brugerdefineret etiket ${m[1]}`;
  m = /^category(\d)$/.exec(dim);
  if (m) return `Kategori ${m[1]}`;
  return dim;
}
