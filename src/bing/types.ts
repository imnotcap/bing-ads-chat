/** Domain model shared by the live Microsoft Advertising backend and the demo backend. */
import type { DateRange } from '@/lib/format';

export type EntityStatus = 'Active' | 'Paused' | 'Deleted' | 'BudgetPaused' | 'BudgetAndManualPaused' | 'Suspended' | 'Inactive' | (string & {});
export type CampaignType = 'Search' | 'Shopping' | 'Audience' | 'PerformanceMax' | (string & {});
export type BidStrategyType =
  | 'ManualCpc'
  | 'EnhancedCpc'
  | 'MaxClicks'
  | 'MaxConversions'
  | 'TargetCpa'
  | 'MaxConversionValue'
  | 'TargetRoas'
  | 'TargetImpressionShare'
  | (string & {});
export type MatchType = 'Exact' | 'Phrase' | 'Broad';
export type NegativeMatchType = 'Exact' | 'Phrase';

export interface Account {
  id: string;
  name: string;
  number?: string;
  customerId: string;
  currency: string;
  status?: string;
  /** AccountFinancialStatus – Hold (past due) and Proposed mean ads are not delivered. */
  financialStatus?: string;
  timeZone?: string;
}

export interface Metrics {
  impressions: number;
  clicks: number;
  spend: number;
  conversions: number;
  revenue: number;
}

export interface DerivedMetrics extends Metrics {
  ctr: number | null;
  cpc: number | null;
  cpa: number | null;
  roas: number | null;
  convRate: number | null;
}

export interface BidStrategy {
  type: BidStrategyType;
  targetCpa?: number | null;
  targetRoas?: number | null;
  maxCpc?: number | null;
}

export interface Campaign {
  id: string;
  name: string;
  status: EntityStatus;
  type: CampaignType;
  dailyBudget: number | null;
  /** Set when the campaign uses a shared budget (its daily budget cannot be edited directly). */
  sharedBudgetId?: string | null;
  bidStrategy: BidStrategy;
  /** Set when the campaign uses a portfolio bid strategy (shared across campaigns). */
  portfolioBidStrategyId?: string | null;
  /** Set for experiment campaigns – their budget and status always follow the base campaign. */
  experimentId?: string | null;
  languages?: string[];
  timeZone?: string;
}

export interface AdGroup {
  id: string;
  campaignId: string;
  name: string;
  status: EntityStatus;
  cpcBid: number | null;
}

export interface Keyword {
  id: string;
  adGroupId: string;
  text: string;
  matchType: MatchType;
  status: EntityStatus;
  bid: number | null;
  qualityScore?: number | null;
  /** Editorial review: Active, ActiveLimited, Inactive (under review) or Disapproved. */
  editorialStatus?: EditorialStatus | null;
}

export interface Ad {
  id: string;
  adGroupId: string;
  type: string;
  status: EntityStatus;
  headlines: string[];
  descriptions: string[];
  headlinePins?: PinPosition[];
  descriptionPins?: PinPosition[];
  finalUrls: string[];
  path1?: string | null;
  path2?: string | null;
  editorialStatus?: EditorialStatus | null;
}

export type EditorialStatus = 'Active' | 'ActiveLimited' | 'Inactive' | 'Disapproved' | (string & {});

export interface NegativeKeyword {
  id?: string;
  text: string;
  matchType: NegativeMatchType;
}

export type NegativeEntityType = 'Campaign' | 'AdGroup';

/**
 * One change to a Shopping ad group's product tree (ApplyProductPartitionActions). A new
 * subdivision gets a negative `tempId` that its children use as `parentId`; an excluded
 * unit is a NegativeAdGroupCriterion, everything else a BiddableAdGroupCriterion.
 * `attribute: null` is the "everything else" node of a subdivision.
 */
export type PartitionAction =
  | {
      action: 'Add';
      adGroupId: string;
      tempId?: number;
      parentId: string | number | null;
      kind: 'subdivision' | 'unit';
      operand: string;
      attribute: string | null;
      excluded: boolean;
      bid?: number | null;
    }
  | { action: 'Delete'; adGroupId: string; id: string; excluded: boolean };

/** A shared negative keyword list a campaign uses (GetSharedEntityAssociationsByEntityIds). */
export interface NegativeKeywordList {
  id: string;
  name: string;
  keywords: NegativeKeyword[];
}

/**
 * One node of a product tree: a Shopping ad group's product partition, or a Performance
 * Max asset group's listing group. `operand` is Microsoft's (Id, Brand, ProductType1,
 * CustomLabel0, CategoryL1, Condition, All …); an empty `attribute` is "everything else".
 */
export interface ProductTreeNode {
  id: string;
  parentId: string | null;
  /** The ad group or asset group the tree belongs to. */
  group: string;
  groupId?: string;
  /** A biddable unit's CPC bid. */
  bid?: number | null;
  /** Null when Microsoft did not say (worked out from the tree instead). */
  unit: boolean | null;
  excluded: boolean;
  operand: string;
  attribute: string;
}

/* ---------------- mutations ---------------- */

export interface CampaignPatch {
  campaignId: string;
  status?: 'Active' | 'Paused';
  dailyBudget?: number;
  name?: string;
  bidStrategy?: BidStrategy;
}

export interface NewCampaign {
  name: string;
  type: 'Search' | 'Shopping' | 'Audience' | 'PerformanceMax';
  dailyBudget: number;
  bidStrategy: BidStrategy;
  languages: string[];
  status: 'Active' | 'Paused';
  timeZone?: string;
}

export interface NewAdGroup {
  campaignId: string;
  name: string;
  cpcBid?: number | null;
  status: 'Active' | 'Paused';
}

export interface AdGroupPatch {
  adGroupId: string;
  status?: 'Active' | 'Paused';
  cpcBid?: number;
  name?: string;
}

export interface NewKeyword {
  text: string;
  matchType: MatchType;
  bid?: number | null;
}

export interface KeywordPatch {
  keywordId: string;
  status?: 'Active' | 'Paused';
  bid?: number;
}

/** Where an RSA text always shows (Microsoft's PinnedField); null = any position. */
export type PinPosition = 1 | 2 | 3 | null;

export interface NewResponsiveSearchAd {
  headlines: string[];
  descriptions: string[];
  /** Per headline: pinned to position 1–3, or null. */
  headlinePins?: PinPosition[];
  /** Per description: pinned to position 1–2, or null. */
  descriptionPins?: PinPosition[];
  finalUrl: string;
  path1?: string;
  path2?: string;
}

export interface AdPatch {
  adId: string;
  status: 'Active' | 'Paused';
}

export interface ItemError {
  /** Zero-based position of the item in the request (null when Microsoft did not say). */
  index: number | null;
  message: string;
  code?: string;
}

export interface MutationResult {
  /** Ids of the items that were created, in request order (failed items are left out). */
  ids?: string[];
  /** Per-item errors reported by Microsoft Advertising (partial success). */
  partialErrors?: string[];
  /** The same errors with the position of the item they belong to. */
  failed?: ItemError[];
}

/* ---------------- reporting ---------------- */

export type ReportKind =
  | 'account'
  | 'campaign'
  | 'adgroup'
  | 'keyword'
  | 'searchterm'
  | 'ad'
  | 'geo'
  | 'device'
  | 'agegender'
  | 'hourofday'
  | 'dayofweek'
  | 'impressionshare';

export type ReportAggregation = 'Summary' | 'Daily' | 'Weekly' | 'Monthly';

export interface ReportSpec {
  kind: ReportKind;
  range: DateRange;
  aggregation: ReportAggregation;
  campaignIds?: string[];
  /** Advanced (live only): raw Microsoft report column names replacing the defaults. */
  columns?: string[];
}

/**
 * Normalised report row. Dimension keys are present depending on the report kind;
 * metric keys are always present.
 */
export interface ReportRow extends Partial<DerivedMetrics> {
  date?: string;
  campaignId?: string;
  campaignName?: string;
  campaignStatus?: string;
  adGroupId?: string;
  adGroupName?: string;
  keywordId?: string;
  keyword?: string;
  matchType?: string;
  qualityScore?: number | null;
  currentMaxCpc?: number | null;
  searchTerm?: string;
  adId?: string;
  adTitle?: string;
  device?: string;
  country?: string;
  region?: string;
  city?: string;
  ageGroup?: string;
  gender?: string;
  hour?: number;
  dayOfWeek?: string;
  /** Impression share report (percent, 0–100). */
  impressionShare?: number | null;
  lostToBudget?: number | null;
  lostToRank?: number | null;
  topImpressionShare?: number | null;
  absoluteTopImpressionShare?: number | null;
  clickShare?: number | null;
  [extra: string]: string | number | null | undefined;
}

export interface KeywordIdea {
  keyword: string;
  monthlySearches: number | null;
  competition: string | null;
  suggestedBid: number | null;
  source?: string | null;
}

/** Microsoft's search counts for a keyword (all devices), one value per month, oldest first. */
export interface SearchVolume {
  keyword: string;
  months: { month: string; searches: number }[];
}

/** Microsoft's bid and traffic estimate for a keyword and match type (per week). */
export interface KeywordBidEstimate {
  keyword: string;
  matchType: string;
  /** Suggested bid to reach the target position. */
  estimatedMinBid: number | null;
  averageCpc: number | null;
  ctr: number | null;
  clicksPerWeek: [number, number] | null;
  impressionsPerWeek: [number, number] | null;
  costPerWeek: [number, number] | null;
}

/** One advertiser in the auctions (Auction insights). Rates are percentages. */
export interface AuctionCompetitor {
  domain: string;
  impressionShare: number | null;
  overlapRate: number | null;
  aboveRate: number | null;
  topOfPageRate: number | null;
  absoluteTopOfPageRate: number | null;
  outrankingShare: number | null;
}

export interface BudgetOpportunity {
  campaignId: string;
  campaignName?: string;
  currentBudget: number | null;
  suggestedBudget: number | null;
  increaseInClicks?: number | null;
  increaseInImpressions?: number | null;
  increaseInConversions?: number | null;
}

export type MsService = 'campaign' | 'reporting' | 'customer' | 'adinsight' | 'bulk' | 'billing';

/**
 * Everything the assistant and the UI can do with an advertising account.
 * Implemented by LiveBackend (Microsoft Advertising REST API v13) and DemoBackend.
 */
/* ---------------- products (Shopping / Performance Max) ---------------- */

/** One campaign/ad group a product showed in, with what it did there. */
export interface ProductPlacement {
  campaignId: string;
  campaignName: string;
  adGroupId: string | null;
  adGroupName: string | null;
  metrics: Metrics;
}

/**
 * A product offer's state. Microsoft has no API for the web UI's "eligible in X of Y
 * campaigns", so the app counts the Shopping/Performance Max campaigns the product
 * actually showed in; approval and issues come from Merchant Center where available.
 */
export interface ProductStatus {
  /** 'ok' | 'warning' | 'disapproved' | 'outofstock' | 'notincatalog' | 'unknown' */
  status: string;
  /** Shopping/Performance Max campaigns the product showed in during the period … */
  servingCampaigns: number | null;
  /** … of the active ones that can show products. */
  totalCampaigns: number | null;
  issues: string[];
}

/** One product with its performance in a period and the period before. */
export interface ProductPerformance {
  /** The merchant's product id (offer id). */
  id: string;
  title: string;
  brand: string | null;
  category: string | null;
  productType: string | null;
  price: number | null;
  imageUrl: string | null;
  link: string | null;
  metrics: Metrics;
  previous: Metrics;
  placements: ProductPlacement[];
  status: ProductStatus | null;
}

export interface AdsBackend {
  readonly mode: 'live' | 'demo';
  listAccounts(): Promise<Account[]>;
  /** Straight from the source (Microsoft) – use after changes and to confirm them. */
  listCampaigns(accountId: string): Promise<Campaign[]>;
  /** The same list from a shared cache when it is recent enough (live: Cloudflare, see bing/campaignCache.ts). */
  listCampaignsCached?(accountId: string): Promise<Campaign[]>;
  /** A change was made: the next cached read goes to Microsoft. */
  campaignsChanged?(): void;
  listAdGroups(accountId: string, campaignId: string): Promise<AdGroup[]>;
  listKeywords(accountId: string, adGroupId: string): Promise<Keyword[]>;
  listAds(accountId: string, adGroupId: string): Promise<Ad[]>;
  /** `campaignId`: the campaign the entity belongs to (Microsoft needs it for ad groups). */
  listNegativeKeywords(accountId: string, entityType: NegativeEntityType, entityId: string, campaignId: string): Promise<NegativeKeyword[]>;
  /** The shared negative keyword lists the campaign uses, with their keywords (live only). */
  listNegativeKeywordLists?(accountId: string, campaignId: string): Promise<NegativeKeywordList[]>;
  /** A Shopping ad group's product partitions – which are bid on and which are excluded (live only). */
  listProductPartitions?(accountId: string, adGroupId: string, adGroupName: string): Promise<ProductTreeNode[]>;
  /**
   * Changes one Shopping ad group's product tree in a single call (all actions for the same
   * ad group). Microsoft applies such a call as a whole: if one action fails, none is made.
   */
  applyProductPartitionActions?(accountId: string, actions: PartitionAction[]): Promise<MutationResult>;
  /** A Performance Max campaign's listing groups, for all its asset groups (live only). */
  listAssetGroupListingGroups?(accountId: string, campaignId: string): Promise<ProductTreeNode[]>;

  updateCampaigns(accountId: string, patches: CampaignPatch[]): Promise<MutationResult>;
  createCampaign(accountId: string, spec: NewCampaign): Promise<MutationResult>;
  deleteCampaigns(accountId: string, campaignIds: string[]): Promise<MutationResult>;
  createAdGroup(accountId: string, spec: NewAdGroup): Promise<MutationResult>;
  updateAdGroups(accountId: string, campaignId: string, patches: AdGroupPatch[]): Promise<MutationResult>;
  addKeywords(accountId: string, adGroupId: string, keywords: NewKeyword[]): Promise<MutationResult>;
  updateKeywords(accountId: string, adGroupId: string, patches: KeywordPatch[]): Promise<MutationResult>;
  deleteKeywords(accountId: string, adGroupId: string, keywordIds: string[]): Promise<MutationResult>;
  addNegativeKeywords(accountId: string, entityType: NegativeEntityType, entityId: string, keywords: NegativeKeyword[]): Promise<MutationResult>;
  createResponsiveSearchAd(accountId: string, adGroupId: string, ad: NewResponsiveSearchAd): Promise<MutationResult>;
  updateAds(accountId: string, adGroupId: string, patches: AdPatch[]): Promise<MutationResult>;

  runReport(accountId: string, spec: ReportSpec, signal?: AbortSignal): Promise<ReportRow[]>;
  /**
   * Every product that had any activity in the period or the one before (Microsoft's
   * product report, plus status from Merchant Center where available). Filtering to the
   * products worth showing happens in bing/products.ts.
   */
  productPerformance?(accountId: string, range: DateRange, signal?: AbortSignal): Promise<ProductPerformance[]>;
  /** `location`: a country name in English (default Denmark). */
  keywordIdeas(accountId: string, input: { queries: string[]; url?: string; language?: string; location?: string; limit?: number }): Promise<KeywordIdea[]>;
  budgetOpportunities(accountId: string, campaignId?: string): Promise<BudgetOpportunity[]>;
  /** Monthly search counts on Microsoft's network (Ad Insight GetHistoricalSearchCount). */
  searchVolumes?(accountId: string, keywords: string[], opts?: { language?: string; countryCode?: string; months?: number }): Promise<SearchVolume[]>;
  /** Suggested bids with estimated traffic (Ad Insight GetEstimatedBidByKeywords). */
  bidEstimates?(
    accountId: string,
    keywords: { text: string; matchType: string }[],
    opts?: { campaignId?: string; adGroupId?: string; language?: string; location?: string },
  ): Promise<KeywordBidEstimate[]>;
  /** Who else shows up in the same auctions (Ad Insight GetAuctionInsightData). */
  auctionInsights?(accountId: string, level: 'Account' | 'Campaign' | 'AdGroup' | 'Keyword', ids: string[], range: { from: string; to: string }): Promise<AuctionCompetitor[]>;

  /** Raw call to any Microsoft Advertising REST v13 operation (live only). */
  rawRequest(accountId: string, service: MsService, path: string, method: 'GET' | 'POST' | 'PUT' | 'DELETE', body?: unknown): Promise<unknown>;
}
