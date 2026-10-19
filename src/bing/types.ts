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

export interface NewResponsiveSearchAd {
  headlines: string[];
  descriptions: string[];
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
export interface AdsBackend {
  readonly mode: 'live' | 'demo';
  listAccounts(): Promise<Account[]>;
  listCampaigns(accountId: string): Promise<Campaign[]>;
  listAdGroups(accountId: string, campaignId: string): Promise<AdGroup[]>;
  listKeywords(accountId: string, adGroupId: string): Promise<Keyword[]>;
  listAds(accountId: string, adGroupId: string): Promise<Ad[]>;
  listNegativeKeywords(accountId: string, entityType: NegativeEntityType, entityId: string): Promise<NegativeKeyword[]>;

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
  keywordIdeas(accountId: string, input: { queries: string[]; url?: string; language?: string; limit?: number }): Promise<KeywordIdea[]>;
  budgetOpportunities(accountId: string, campaignId?: string): Promise<BudgetOpportunity[]>;

  /** Raw call to any Microsoft Advertising REST v13 operation (live only). */
  rawRequest(accountId: string, service: MsService, path: string, method: 'GET' | 'POST' | 'PUT' | 'DELETE', body?: unknown): Promise<unknown>;
}
