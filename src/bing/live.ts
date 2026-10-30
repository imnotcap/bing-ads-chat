/**
 * LiveBackend – Microsoft Advertising API v13 (REST/JSON).
 * Campaign Management, Reporting, Customer Management and Ad Insight services.
 */
import { sleep } from '@/lib/utils';
import { MsAdsClient, MsApiError, extractErrorMessages, type MsCredentials } from './client';
import { parseCsv } from './csv';
import { buildReportRequest, normalizeReportRows } from './reports';
import { aggregateProducts, buildProductReportRequest, offerIdOf, productStatuses, type CatalogOffer } from './products';
import { previousRange, type DateRange } from '@/lib/format';
import type {
  ProductPerformance,
  Account,
  Ad,
  AdGroup,
  AdGroupPatch,
  AdPatch,
  AdsBackend,
  AuctionCompetitor,
  BidStrategy,
  BudgetOpportunity,
  Campaign,
  CampaignPatch,
  EditorialStatus,
  ItemError,
  Keyword,
  KeywordBidEstimate,
  KeywordIdea,
  KeywordPatch,
  MsService,
  MutationResult,
  NegativeEntityType,
  NegativeKeyword,
  NegativeKeywordList,
  PartitionAction,
  ProductTreeNode,
  NewAdGroup,
  NewCampaign,
  NewKeyword,
  NewResponsiveSearchAd,
  PinPosition,
  ReportRow,
  ReportSpec,
  SearchVolume,
} from './types';
import { extractFirstFile } from './zip';
import { CampaignCache, type CampaignStore } from './campaignCache';

type Json = Record<string, unknown>;

const CAMPAIGN_TYPES = ['Search', 'Shopping', 'Audience', 'PerformanceMax'];
/** Without these, campaigns on Maximize conversion value / Target impression share come back with an empty BiddingScheme. */
// REST takes flag combinations comma-separated (SOAP took them space-separated).
const CAMPAIGN_FIELDS = 'MaxConversionValueBiddingScheme,TargetImpressionShareBiddingScheme,BidStrategyId';
const POLL_ATTEMPTS = 40;
const POLL_DELAY_MS = 2_000;
/** The product report covers thousands of products: give Microsoft up to three minutes. */
const PRODUCT_POLL_ATTEMPTS = 90;
/** 250 offers per page: room for 25,000 offers per store. */
const MAX_CATALOG_PAGES = 100;
const CONTENT_PRODUCTS = 'https://content.api.bingads.microsoft.com/shopping/v9.1/bmc';
const CONTENT_STATUSES = 'https://content.api.ads.microsoft.com/v9.1/bmc/stores';

type ProductIssue = { status: 'warning' | 'disapproved'; issues: string[] };

/** Arrays may arrive as plain arrays or SOAP-style wrappers ({ string: [...] }). */
function arr<T = unknown>(v: unknown): T[] {
  if (Array.isArray(v)) return v as T[];
  if (v && typeof v === 'object') {
    const inner = Object.values(v as Json)[0];
    if (Array.isArray(inner)) return inner as T[];
  }
  return [];
}

const str = (v: unknown): string => (v === null || v === undefined ? '' : String(v));
const num = (v: unknown): number | null => (v === null || v === undefined || v === '' ? null : Number(v));
const amount = (v: unknown): number | null => (v && typeof v === 'object' ? num((v as Json).Amount) : num(v));

/** "TargetCpaBiddingScheme" and "TargetCpa" both mean Target CPA. */
export function bidStrategyType(raw: unknown): string {
  return str(raw).replace(/BiddingScheme$/, '') || 'Unknown';
}

function toBidStrategy(raw: unknown): BidStrategy {
  const s = (raw ?? {}) as Json;
  return {
    type: bidStrategyType(s.Type),
    targetCpa: num(s.TargetCpa),
    targetRoas: num(s.TargetRoas),
    maxCpc: amount(s.MaxCpc),
  };
}

/** In REST JSON the bidding scheme's Type is the class name, e.g. "TargetCpaBiddingScheme". */
export function fromBidStrategy(b: BidStrategy): Json {
  const out: Json = { Type: `${b.type}BiddingScheme` };
  if (b.maxCpc) out.MaxCpc = { Amount: b.maxCpc };
  if (b.targetCpa) out.TargetCpa = b.targetCpa;
  if (b.targetRoas) out.TargetRoas = b.targetRoas;
  return out;
}

function mapCampaign(c: Json): Campaign {
  return {
    id: str(c.Id),
    name: str(c.Name),
    status: str(c.Status),
    type: str(c.CampaignType).split(/[\s,]+/)[0] || 'Search',
    dailyBudget: num(c.DailyBudget),
    sharedBudgetId: c.BudgetId ? str(c.BudgetId) : null,
    bidStrategy: toBidStrategy(c.BiddingScheme),
    portfolioBidStrategyId: Number(c.BidStrategyId) > 0 ? str(c.BidStrategyId) : null,
    experimentId: Number(c.ExperimentId) > 0 ? str(c.ExperimentId) : null,
    languages: arr<string>(c.Languages),
    timeZone: str(c.TimeZone) || undefined,
  };
}

/** One product tree change as Microsoft's REST API takes it (AdGroupCriterionAction). */
export function partitionActionJson(a: PartitionAction): Json {
  if (a.action === 'Delete') {
    return { Action: 'Delete', AdGroupCriterion: { Type: a.excluded ? 'NegativeAdGroupCriterion' : 'BiddableAdGroupCriterion', Id: Number(a.id), AdGroupId: Number(a.adGroupId) } };
  }
  const criterion = {
    Type: 'ProductPartition',
    Condition: { Operand: a.operand, Attribute: a.attribute },
    ParentCriterionId: a.parentId === null ? null : Number(a.parentId),
    PartitionType: a.kind === 'subdivision' ? 'Subdivision' : 'Unit',
  };
  const base: Json = { AdGroupId: Number(a.adGroupId), Criterion: criterion, ...(a.tempId !== undefined ? { Id: a.tempId } : {}) };
  if (a.excluded) return { Action: 'Add', AdGroupCriterion: { Type: 'NegativeAdGroupCriterion', ...base } };
  // A subdivision carries no bid; a biddable unit always does.
  return {
    Action: 'Add',
    AdGroupCriterion: {
      Type: 'BiddableAdGroupCriterion',
      Status: 'Active',
      ...base,
      CriterionBid: a.kind === 'subdivision' ? null : { Type: 'FixedBid', Amount: a.bid ?? null },
    },
  };
}

/**
 * Reads the result of a batch operation. Microsoft reports a failed item as a
 * BatchError whose Index is the item's position in the request (the list of errors is
 * not in request order), and – for adds – a null in its place in the id list.
 * Throws when not a single item went through, so a fully rejected change is never
 * reported as done.
 */
export function batchResult(res: unknown, count: number, idsKey?: string): MutationResult {
  const r = (res ?? {}) as Json;
  // Nested errors (e.g. negative keywords per entity) carry the item index on the inner BatchErrors.
  const nested = arr<Json>(r.NestedPartialErrors).flatMap((n) => {
    const inner = arr<Json>(n.BatchErrors);
    return inner.length ? inner : [{ ...n, Index: null }];
  });
  const raw = [...arr<Json>(r.PartialErrors), ...nested];
  const failed: ItemError[] = raw.map((e) => {
    const idx = e.Index === null || e.Index === undefined || e.Index === '' ? null : Number(e.Index);
    const messages = extractErrorMessages(e);
    return { index: Number.isInteger(idx) ? idx : null, message: messages.slice(0, 2).join(' · ') || 'Ukendt fejl fra Microsoft Advertising', code: str(e.ErrorCode) || undefined };
  });
  let ids: string[] | undefined;
  if (idsKey) {
    const slots = arr(r[idsKey]).map((v) => (v && typeof v === 'object' ? str(Object.values(v as Json)[0]) : str(v)));
    ids = slots.filter(Boolean);
    // A null id without a matching error still means the item was not created.
    slots.forEach((id, i) => {
      if (!id && !failed.some((f) => f.index === i)) failed.push({ index: i, message: 'Microsoft Advertising returnerede intet id for elementet.' });
    });
    if (count > 0 && slots.length === 0 && !failed.length) failed.push({ index: null, message: 'Microsoft Advertising returnerede ingen id’er.' });
  }
  const failedItems = new Set(failed.map((f) => f.index).filter((i) => i !== null));
  const allFailed = idsKey ? !ids?.length && failed.length > 0 : count > 0 && (failedItems.size >= count || (count === 1 && failed.length > 0));
  if (allFailed) {
    throw new MsApiError(`Microsoft Advertising afviste ændringen – intet blev ændret: ${[...new Set(failed.map((f) => f.message))].join(' · ')}`, 400, raw);
  }
  return {
    ids: ids?.length ? ids : undefined,
    partialErrors: failed.length ? failed.map((f) => (f.index === null ? f.message : `#${f.index + 1}: ${f.message}`)) : undefined,
    failed: failed.length ? failed : undefined,
  };
}

export class LiveBackend implements AdsBackend {
  readonly mode = 'live' as const;
  private readonly client: MsAdsClient;
  private accounts: Account[] | null = null;
  private geo: Promise<Map<string, string>> | null = null;

  private readonly campaignCache: CampaignCache | null;

  constructor(creds: MsCredentials, campaignStore?: CampaignStore) {
    this.client = new MsAdsClient(creds);
    this.campaignCache = campaignStore ? new CampaignCache(campaignStore, (id) => this.listCampaigns(id)) : null;
  }

  listCampaignsCached(accountId: string): Promise<Campaign[]> {
    return this.campaignCache ? this.campaignCache.get(accountId) : this.listCampaigns(accountId);
  }

  campaignsChanged() {
    this.campaignCache?.changed();
  }

  /** Verifies the credentials by reading the signed-in user. */
  async whoAmI(): Promise<{ userId: string; name: string }> {
    const res = await this.client.call<Json>('customer', 'User/Query', { body: { UserId: null } });
    const user = (res.User ?? {}) as Json;
    const name = [user.Name && (user.Name as Json).FirstName, user.Name && (user.Name as Json).LastName].filter(Boolean).join(' ');
    return { userId: str(user.Id), name: name || str(user.UserName) || 'Microsoft-bruger' };
  }

  async listAccounts(): Promise<Account[]> {
    if (this.accounts) return this.accounts;
    const { userId } = await this.whoAmI();
    const res = await this.client.call<Json>('customer', 'Accounts/Search', {
      body: {
        Predicates: [{ Field: 'UserId', Operator: 'Equals', Value: userId }],
        Ordering: null,
        PageInfo: { Index: 0, Size: 1000 },
        ReturnAdditionalFields: null,
      },
    });
    this.accounts = arr<Json>(res.Accounts).map((a) => ({
      id: str(a.Id),
      name: str(a.Name),
      number: str(a.Number) || undefined,
      customerId: str(a.ParentCustomerId),
      currency: str(a.CurrencyCode) || 'DKK',
      status: str(a.AccountLifeCycleStatus) || undefined,
      financialStatus: str(a.AccountFinancialStatus) || undefined,
      timeZone: str(a.TimeZone) || undefined,
    }));
    return this.accounts;
  }

  private async ctx(accountId: string) {
    const acc = (await this.listAccounts()).find((a) => a.id === accountId);
    if (!acc) throw new Error(`Kontoen ${accountId} findes ikke for den forbundne Microsoft-bruger.`);
    return { accountId, customerId: acc.customerId };
  }

  private async cm<T = Json>(accountId: string, path: string, method: 'POST' | 'PUT' | 'DELETE', body: unknown): Promise<T> {
    return this.client.call<T>('campaign', path, { method, body, ...(await this.ctx(accountId)) });
  }

  async listCampaigns(accountId: string): Promise<Campaign[]> {
    const campaigns = await this.queryCampaigns(accountId);
    this.campaignCache?.saved(accountId, campaigns);
    return campaigns;
  }

  private async queryCampaigns(accountId: string): Promise<Campaign[]> {
    let fields: string | null = CAMPAIGN_FIELDS;
    const query = (type: string) =>
      this.cm<Json>(accountId, 'Campaigns/QueryByAccountId', 'POST', { AccountId: Number(accountId), CampaignType: type, ReturnAdditionalFields: fields });
    try {
      const res = await query(CAMPAIGN_TYPES.join(',')).catch((err) => {
        if (!(err instanceof MsApiError) || err.status !== 400) throw err;
        // Older API behaviour: retry without the additional fields before splitting by type.
        fields = null;
        return query(CAMPAIGN_TYPES.join(','));
      });
      return arr<Json>(res.Campaigns).map(mapCampaign);
    } catch (err) {
      if (!(err instanceof MsApiError) || err.status !== 400) throw err;
      // Some API versions only accept one campaign type per call.
      const results = await Promise.allSettled(CAMPAIGN_TYPES.map(query));
      const campaigns = results.flatMap((r) => (r.status === 'fulfilled' ? arr<Json>(r.value.Campaigns).map(mapCampaign) : []));
      if (!campaigns.length && results.every((r) => r.status === 'rejected')) throw err;
      return campaigns;
    }
  }

  async listAdGroups(accountId: string, campaignId: string): Promise<AdGroup[]> {
    const res = await this.cm<Json>(accountId, 'AdGroups/QueryByCampaignId', 'POST', { CampaignId: Number(campaignId) });
    return arr<Json>(res.AdGroups).map((g) => ({
      id: str(g.Id),
      campaignId,
      name: str(g.Name),
      status: str(g.Status),
      cpcBid: amount(g.CpcBid),
    }));
  }

  async listKeywords(accountId: string, adGroupId: string): Promise<Keyword[]> {
    const res = await this.cm<Json>(accountId, 'Keywords/QueryByAdGroupId', 'POST', { AdGroupId: Number(adGroupId) });
    return arr<Json>(res.Keywords).map((k) => ({
      id: str(k.Id),
      adGroupId,
      text: str(k.Text),
      matchType: (str(k.MatchType) || 'Broad') as Keyword['matchType'],
      status: str(k.Status),
      bid: amount(k.Bid),
      editorialStatus: (str(k.EditorialStatus) || null) as EditorialStatus | null,
    }));
  }

  async listAds(accountId: string, adGroupId: string): Promise<Ad[]> {
    const res = await this.cm<Json>(accountId, 'Ads/QueryByAdGroupId', 'POST', {
      AdGroupId: Number(adGroupId),
      AdTypes: ['ResponsiveSearch', 'ExpandedText', 'DynamicSearch', 'Product'],
      ReturnAdditionalFields: null,
    });
    const assets = (v: unknown) => arr<Json>(v).map((a) => str(((a.Asset ?? {}) as Json).Text)).filter(Boolean);
    const pins = (v: unknown) =>
      arr<Json>(v)
        .filter((a) => str(((a.Asset ?? {}) as Json).Text))
        .map((a) => (Number(/\d$/.exec(str(a.PinnedField))?.[0]) || null) as PinPosition);
    return arr<Json>(res.Ads).map((a) => ({
      id: str(a.Id),
      adGroupId,
      type: str(a.Type),
      status: str(a.Status),
      headlines: a.Headlines ? assets(a.Headlines) : [a.TitlePart1, a.TitlePart2, a.TitlePart3].map(str).filter(Boolean),
      descriptions: a.Descriptions ? assets(a.Descriptions) : [a.Text, a.TextPart2].map(str).filter(Boolean),
      ...(a.Headlines ? { headlinePins: pins(a.Headlines), descriptionPins: pins(a.Descriptions) } : {}),
      finalUrls: arr<string>(a.FinalUrls).map(str),
      path1: str(a.Path1) || null,
      path2: str(a.Path2) || null,
      editorialStatus: (str(a.EditorialStatus) || null) as EditorialStatus | null,
    }));
  }

  async listNegativeKeywords(accountId: string, entityType: NegativeEntityType, entityId: string, campaignId: string): Promise<NegativeKeyword[]> {
    // GetNegativeKeywordsByEntityIds – for ad groups the parent is the campaign (ignored for campaigns).
    const res = await this.cm<Json>(accountId, 'NegativeKeywords/QueryByEntityIds', 'POST', {
      EntityIds: [Number(entityId)],
      EntityType: entityType,
      ParentEntityId: Number(entityType === 'AdGroup' ? campaignId : accountId),
    });
    return arr<Json>(res.EntityNegativeKeywords).flatMap((e) =>
      arr<Json>(e.NegativeKeywords).map((n) => ({
        id: str(n.Id) || undefined,
        text: str(n.Text),
        matchType: (str(n.MatchType) || 'Phrase') as NegativeKeyword['matchType'],
      })),
    );
  }

  async listNegativeKeywordLists(accountId: string, campaignId: string): Promise<NegativeKeywordList[]> {
    const assoc = await this.cm<Json>(accountId, 'SharedEntityAssociations/QueryByEntityIds', 'POST', {
      EntityIds: [Number(campaignId)],
      EntityType: 'Campaign',
      SharedEntityType: 'NegativeKeywordList',
    });
    const ids = [...new Set(arr<Json>(assoc.Associations).map((a) => str(a.SharedEntityId)).filter(Boolean))];
    if (!ids.length) return [];
    const all = await this.cm<Json>(accountId, 'SharedEntities/Query', 'POST', { SharedEntityType: 'NegativeKeywordList' });
    const names = new Map(arr<Json>(all.SharedEntities).map((e) => [str(e.Id), str(e.Name)]));
    const lists: NegativeKeywordList[] = [];
    for (const id of ids) {
      const items = await this.cm<Json>(accountId, 'ListItems/QueryBySharedList', 'POST', { SharedList: { Type: 'NegativeKeywordList', Id: Number(id) } });
      lists.push({
        id,
        name: names.get(id) ?? '',
        keywords: arr<Json>(items.ListItems).map((n) => ({ id: str(n.Id) || undefined, text: str(n.Text), matchType: (str(n.MatchType) || 'Phrase') as NegativeKeyword['matchType'] })),
      });
    }
    return lists;
  }

  async listProductPartitions(accountId: string, adGroupId: string, adGroupName: string): Promise<ProductTreeNode[]> {
    // GetAdGroupCriterionsByIds with no ids: every product partition of the ad group.
    const res = await this.cm<Json>(accountId, 'AdGroupCriterions/QueryByIds', 'POST', { AdGroupCriterionIds: null, AdGroupId: Number(adGroupId), CriterionType: 'ProductPartition' });
    return arr<Json>(res.AdGroupCriterions).map((c) => {
      const criterion = (c.Criterion ?? {}) as Json;
      const condition = (criterion.Condition ?? {}) as Json;
      const parent = str(criterion.ParentCriterionId);
      return {
        id: str(c.Id),
        parentId: parent && parent !== '0' ? parent : null,
        group: adGroupName,
        groupId: adGroupId,
        bid: amount(((c.CriterionBid ?? {}) as Json).Amount ?? null),
        unit: criterion.PartitionType ? str(criterion.PartitionType) === 'Unit' : null,
        excluded: str(c.Type) === 'NegativeAdGroupCriterion',
        operand: str(condition.Operand),
        attribute: str(condition.Attribute),
      };
    });
  }

  async applyProductPartitionActions(accountId: string, actions: PartitionAction[]): Promise<MutationResult> {
    const groups = new Set(actions.map((a) => a.adGroupId));
    if (groups.size !== 1) throw new Error('Ændringer af produktgrupper skal sendes én annoncegruppe ad gangen.');
    if (actions.length > 5000) throw new Error('Højst 5.000 ændringer af produktgrupper pr. annoncegruppe ad gangen.');
    const res = (await this.cm<Json>(accountId, 'ProductPartitionActions/Apply', 'POST', { CriterionActions: actions.map(partitionActionJson) })) ?? {};
    const errors = arr<Json>(res.PartialErrors);
    // Microsoft makes all of a call's actions or none of them.
    if (errors.length) {
      const messages = [...new Set(errors.flatMap((e) => extractErrorMessages(e)))];
      throw new MsApiError(`Microsoft Advertising afviste ændringen af produktgrupperne – intet blev ændret: ${messages.slice(0, 3).join(' · ') || 'ukendt fejl'}`, 400, errors);
    }
    return { ids: arr<unknown>(res.AdGroupCriterionIds).map((v) => str(v)).filter(Boolean) };
  }

  async listAssetGroupListingGroups(accountId: string, campaignId: string): Promise<ProductTreeNode[]> {
    const groups = await this.cm<Json>(accountId, 'AssetGroups/QueryByCampaignId', 'POST', { CampaignId: Number(campaignId) });
    const out: ProductTreeNode[] = [];
    for (const g of arr<Json>(groups.AssetGroups)) {
      const gid = str(g.Id);
      const res = await this.cm<Json>(accountId, 'AssetGroupListingGroups/QueryByIds', 'POST', { AssetGroupId: Number(gid), AssetGroupListingGroupIds: null });
      for (const l of arr<Json>(res.AssetGroupListingGroups)) {
        const dimension = (l.Dimension ?? {}) as Json;
        const parent = str(l.ParentListingGroupId);
        const type = str(l.ListingGroupType ?? l.GroupNodeListingType);
        out.push({
          id: `${gid}~${str(l.Id)}`,
          parentId: parent && parent !== '0' ? `${gid}~${parent}` : null,
          group: str(g.Name),
          unit: type ? type === 'Unit' : null,
          excluded: l.IsExcluded === true || str(l.IsExcluded).toLowerCase() === 'true',
          operand: str(dimension.Operand),
          attribute: str(dimension.Attribute),
        });
      }
    }
    return out;
  }

  /* ------------------------------- mutations ------------------------------- */

  async updateCampaigns(accountId: string, patches: CampaignPatch[]): Promise<MutationResult> {
    const res = await this.cm(accountId, 'Campaigns', 'PUT', {
      AccountId: Number(accountId),
      Campaigns: patches.map((p) => {
        const c: Json = { Id: Number(p.campaignId) };
        if (p.status) c.Status = p.status;
        if (p.dailyBudget !== undefined) c.DailyBudget = p.dailyBudget;
        if (p.name) c.Name = p.name;
        if (p.bidStrategy) c.BiddingScheme = fromBidStrategy(p.bidStrategy);
        return c;
      }),
    });
    return batchResult(res, patches.length);
  }

  async createCampaign(accountId: string, spec: NewCampaign): Promise<MutationResult> {
    const res = await this.cm(accountId, 'Campaigns', 'POST', {
      AccountId: Number(accountId),
      Campaigns: [
        {
          Name: spec.name,
          BudgetType: 'DailyBudgetStandard',
          DailyBudget: spec.dailyBudget,
          CampaignType: spec.type,
          Languages: spec.languages,
          Status: spec.status,
          TimeZone: spec.timeZone ?? 'BrusselsCopenhagenMadridParis',
          BiddingScheme: fromBidStrategy(spec.bidStrategy),
        },
      ],
    });
    return batchResult(res, 1, 'CampaignIds');
  }

  async deleteCampaigns(accountId: string, campaignIds: string[]): Promise<MutationResult> {
    const res = await this.cm(accountId, 'Campaigns', 'DELETE', { AccountId: Number(accountId), CampaignIds: campaignIds.map(Number) });
    return batchResult(res, campaignIds.length);
  }

  async createAdGroup(accountId: string, spec: NewAdGroup): Promise<MutationResult> {
    const group: Json = { Name: spec.name, Status: spec.status };
    if (spec.cpcBid) group.CpcBid = { Amount: spec.cpcBid };
    const res = await this.cm(accountId, 'AdGroups', 'POST', { CampaignId: Number(spec.campaignId), AdGroups: [group] });
    return batchResult(res, 1, 'AdGroupIds');
  }

  async updateAdGroups(accountId: string, campaignId: string, patches: AdGroupPatch[]): Promise<MutationResult> {
    const res = await this.cm(accountId, 'AdGroups', 'PUT', {
      CampaignId: Number(campaignId),
      AdGroups: patches.map((p) => {
        const g: Json = { Id: Number(p.adGroupId) };
        if (p.status) g.Status = p.status;
        if (p.cpcBid !== undefined) g.CpcBid = { Amount: p.cpcBid };
        if (p.name) g.Name = p.name;
        return g;
      }),
    });
    return batchResult(res, patches.length);
  }

  async addKeywords(accountId: string, adGroupId: string, keywords: NewKeyword[]): Promise<MutationResult> {
    const res = await this.cm(accountId, 'Keywords', 'POST', {
      AdGroupId: Number(adGroupId),
      Keywords: keywords.map((k) => ({ Text: k.text, MatchType: k.matchType, Bid: k.bid ? { Amount: k.bid } : null })),
    });
    return batchResult(res, keywords.length, 'KeywordIds');
  }

  async updateKeywords(accountId: string, adGroupId: string, patches: KeywordPatch[]): Promise<MutationResult> {
    const res = await this.cm(accountId, 'Keywords', 'PUT', {
      AdGroupId: Number(adGroupId),
      Keywords: patches.map((p) => {
        const k: Json = { Id: Number(p.keywordId) };
        if (p.status) k.Status = p.status;
        if (p.bid !== undefined) k.Bid = { Amount: p.bid };
        return k;
      }),
    });
    return batchResult(res, patches.length);
  }

  async deleteKeywords(accountId: string, adGroupId: string, keywordIds: string[]): Promise<MutationResult> {
    const res = await this.cm(accountId, 'Keywords', 'DELETE', { AdGroupId: Number(adGroupId), KeywordIds: keywordIds.map(Number) });
    return batchResult(res, keywordIds.length);
  }

  async addNegativeKeywords(accountId: string, entityType: NegativeEntityType, entityId: string, keywords: NegativeKeyword[]): Promise<MutationResult> {
    const res = await this.cm(accountId, 'EntityNegativeKeywords', 'POST', {
      EntityNegativeKeywords: [
        {
          EntityId: Number(entityId),
          EntityType: entityType,
          NegativeKeywords: keywords.map((k) => ({ Type: 'NegativeKeyword', Text: k.text, MatchType: k.matchType })),
        },
      ],
    });
    return batchResult(res, keywords.length);
  }

  async createResponsiveSearchAd(accountId: string, adGroupId: string, ad: NewResponsiveSearchAd): Promise<MutationResult> {
    // AssetLink.PinnedField: Headline1–3 / Description1–2; left out = any position.
    const asset = (kind: 'Headline' | 'Description', pins?: PinPosition[]) => (text: string, i: number) => ({
      Asset: { Type: 'TextAsset', Text: text },
      ...(pins?.[i] ? { PinnedField: `${kind}${pins[i]}` } : {}),
    });
    const res = await this.cm(accountId, 'Ads', 'POST', {
      AdGroupId: Number(adGroupId),
      Ads: [
        {
          Type: 'ResponsiveSearch',
          Headlines: ad.headlines.map(asset('Headline', ad.headlinePins)),
          Descriptions: ad.descriptions.map(asset('Description', ad.descriptionPins)),
          FinalUrls: [ad.finalUrl],
          Path1: ad.path1 || null,
          Path2: ad.path2 || null,
          Status: 'Active',
        },
      ],
    });
    return batchResult(res, 1, 'AdIds');
  }

  async updateAds(accountId: string, adGroupId: string, patches: AdPatch[]): Promise<MutationResult> {
    // Ads are polymorphic – the update must carry each ad's own Type.
    const existing = await this.listAds(accountId, adGroupId);
    const res = await this.cm(accountId, 'Ads', 'PUT', {
      AdGroupId: Number(adGroupId),
      Ads: patches.map((p) => ({
        Type: existing.find((a) => a.id === p.adId)?.type || 'ResponsiveSearch',
        Id: Number(p.adId),
        Status: p.status,
      })),
    });
    return batchResult(res, patches.length);
  }

  /* -------------------------------- insight -------------------------------- */

  async runReport(accountId: string, spec: ReportSpec, signal?: AbortSignal): Promise<ReportRow[]> {
    return normalizeReportRows(spec.kind, await this.reportCsv(accountId, buildReportRequest(accountId, spec), signal));
  }

  /** Orders a report, waits for it and returns its CSV rows (keyed by Microsoft's column names). */
  private async reportCsv(accountId: string, request: Record<string, unknown>, signal?: AbortSignal, attempts = POLL_ATTEMPTS): Promise<Record<string, string>[]> {
    const ctx = await this.ctx(accountId);
    const submit = await this.client.call<{ ReportRequestId?: string }>('reporting', 'GenerateReport/Submit', {
      body: { ReportRequest: request },
      signal,
      ...ctx,
    });
    if (!submit.ReportRequestId) throw new Error('Microsoft Advertising: rapporten kunne ikke bestilles.');

    for (let attempt = 0; attempt < attempts; attempt++) {
      await sleep(attempt === 0 ? 1200 : POLL_DELAY_MS, signal);
      const poll = await this.client.call<{ ReportRequestStatus?: { Status?: string; ReportDownloadUrl?: string | null } }>(
        'reporting',
        'GenerateReport/Poll',
        { body: { ReportRequestId: submit.ReportRequestId }, signal, ...ctx },
      );
      const status = poll.ReportRequestStatus?.Status;
      if (status === 'Error') throw new Error('Microsoft Advertising: rapportgenereringen fejlede.');
      if (status === 'Success') {
        const url = poll.ReportRequestStatus?.ReportDownloadUrl;
        // No URL means the report has no rows for the period.
        if (!url) return [];
        const zip = await this.client.download(url, signal);
        return parseCsv(new TextDecoder().decode(await extractFirstFile(zip)));
      }
    }
    throw new Error(`Microsoft Advertising: rapporten blev ikke klar inden for ${Math.round((attempts * POLL_DELAY_MS) / 1000)} sekunder. Prøv en kortere periode.`);
  }

  /* -------------------------------- products -------------------------------- */

  /**
   * Every product with activity in the period or the one before (product report), with
   * image, link and stock from the Merchant Center catalogue and approval issues where
   * Microsoft gives them. The catalogue and statuses are extras: without them the
   * products still come back, with status "unknown".
   */
  async productPerformance(accountId: string, range: DateRange, signal?: AbortSignal): Promise<ProductPerformance[]> {
    const [current, previous, catalog, campaigns] = await Promise.all([
      this.reportCsv(accountId, buildProductReportRequest(accountId, range, true), signal, PRODUCT_POLL_ATTEMPTS),
      this.reportCsv(accountId, buildProductReportRequest(accountId, previousRange(range), false), signal, PRODUCT_POLL_ATTEMPTS),
      this.merchantCatalog(accountId, signal).catch(() => null),
      (this.listCampaignsCached ? this.listCampaignsCached(accountId) : this.listCampaigns(accountId)).catch(() => null),
    ]);
    const products = aggregateProducts(current, previous);
    const active = campaigns ? campaigns.filter((c) => (c.type === 'Shopping' || c.type === 'PerformanceMax') && c.status === 'Active').length : null;
    return productStatuses(products, catalog?.offers ?? null, catalog?.issues ?? null, active);
  }

  /**
   * The Microsoft Merchant Center stores of the customer: every offer (image, link, price,
   * stock), 250 per call, and the offers with warnings or disapprovals (the
   * ProductStatuses API is in closed beta – where it isn't open the issues are left out).
   * Docs: https://learn.microsoft.com/advertising/shopping-content/products-resource
   */
  private async merchantCatalog(accountId: string, signal?: AbortSignal): Promise<{ offers: Map<string, CatalogOffer>; issues: Map<string, ProductIssue> | null }> {
    const ctx = await this.ctx(accountId);
    const res = await this.client.call<{ BMCStores?: Json[] | null }>('campaign', 'BMCStores/QueryByCustomerId', { body: {}, signal, ...ctx });
    const stores = (res.BMCStores ?? []).filter((s) => s.IsActive !== false && s.HasCatalog !== false).map((s) => String(s.Id));
    if (!stores.length) throw new Error('Ingen Merchant Center-butik.');
    const offers = new Map<string, CatalogOffer>();
    let issues: Map<string, ProductIssue> | null = new Map();
    for (const store of stores) {
      let token = '';
      for (let page = 0; page < MAX_CATALOG_PAGES; page++) {
        const q = new URLSearchParams({ 'max-results': '250', ...(token ? { 'start-token': token } : {}) });
        const list = await this.client.content<{ resources?: Json[]; nextPageToken?: string }>(`${CONTENT_PRODUCTS}/${store}/products?${q}`, { signal, ...ctx });
        for (const o of list.resources ?? []) {
          const offerId = str(o.offerId) || offerIdOf(str(o.id));
          if (!offerId) continue;
          const price = o.price as { value?: string | number } | undefined;
          offers.set(offerId.toLowerCase(), {
            title: str(o.title) || null,
            imageUrl: str(o.imageLink) || null,
            link: str(o.link) || null,
            price: price?.value !== undefined && price.value !== '' ? Number(price.value) : null,
            availability: str(o.availability) || null,
          });
        }
        token = str(list.nextPageToken);
        if (!token) break;
      }
      if (issues) issues = await this.offerIssues(store, issues, ctx, signal).catch(() => null);
    }
    return { offers, issues };
  }

  private async offerIssues(store: string, into: Map<string, ProductIssue>, ctx: { accountId: string; customerId: string }, signal?: AbortSignal) {
    let token = '';
    for (let page = 0; page < MAX_CATALOG_PAGES; page++) {
      const q = new URLSearchParams({ 'max-results': '250', ...(token ? { 'continuation-token': token } : {}) });
      const res = await this.client.content<{ resources?: Json[]; nextPageToken?: string }>(`${CONTENT_STATUSES}/${store}/productstatuses?${q}`, { signal, ...ctx });
      for (const r of res.resources ?? []) {
        const id = offerIdOf(str(r.productId));
        if (!id) continue;
        const list = Array.isArray(r.itemLevelIssues) ? (r.itemLevelIssues as Json[]) : [];
        into.set(id, {
          status: /disapproved/i.test(str(r.status)) ? 'disapproved' : 'warning',
          issues: list.map((i) => str(i.description) || str(i.code)).filter(Boolean),
        });
      }
      token = str(res.nextPageToken);
      if (!token) break;
    }
    return into;
  }

  /**
   * Country name (English, lower case) → Microsoft location id, from Microsoft's
   * geographical locations file (GetGeoLocationsFileUrl). Location ids are not published
   * anywhere else, so they are never hard-coded. Cached on this PC.
   */
  private async countryIds(accountId: string): Promise<Map<string, string>> {
    const KEY = 'bac.ms-country-ids';
    try {
      const cached = JSON.parse(localStorage.getItem(KEY) ?? 'null') as { at: number; ids: Record<string, string> } | null;
      if (cached && Date.now() - cached.at < 30 * 86_400_000) return new Map(Object.entries(cached.ids));
    } catch {
      /* no cache */
    }
    this.geo ??= (async () => {
      const res = await this.cm<Json>(accountId, 'GeoLocationsFileUrl/Query', 'POST', { Version: '2.0', LanguageLocale: 'en' });
      const url = str(res.FileUrl);
      if (!url) throw new Error('Microsoft Advertising sendte ikke lokationsfilen.');
      const rows = parseCsv(new TextDecoder().decode(await this.client.download(url)));
      const ids: Record<string, string> = {};
      for (const r of rows) {
        if (r['Location Type'] === 'Country' && r['Status'] !== 'Deprecated' && r['Location Id']) ids[(r['Bing Display Name'] ?? '').toLowerCase()] = r['Location Id'];
      }
      try {
        localStorage.setItem(KEY, JSON.stringify({ at: Date.now(), ids }));
      } catch {
        /* storage full or unavailable */
      }
      return new Map(Object.entries(ids));
    })().catch((e: unknown) => {
      this.geo = null;
      throw e;
    });
    return this.geo;
  }

  async keywordIdeas(accountId: string, input: { queries: string[]; url?: string; language?: string; location?: string; limit?: number }): Promise<KeywordIdea[]> {
    const country = (input.location ?? 'Denmark').trim();
    const language = input.language ?? (country.toLowerCase() === 'denmark' ? 'Danish' : 'English');
    const locationId = (await this.countryIds(accountId)).get(country.toLowerCase());
    if (!locationId) throw new Error(`Microsoft Advertising kender ikke landet "${country}" – skriv landets engelske navn, fx Denmark, Germany eller United Kingdom.`);
    // GetKeywordIdeas requires Language, Location and Network, plus a query, URL or category.
    const params: Json[] = [];
    if (input.queries.length) params.push({ Type: 'QuerySearchParameter', Queries: input.queries });
    if (input.url) params.push({ Type: 'UrlSearchParameter', Url: input.url });
    params.push({ Type: 'LanguageSearchParameter', Languages: [{ Language: language }] });
    params.push({ Type: 'LocationSearchParameter', Locations: [{ LocationId: Number(locationId) }] });
    params.push({ Type: 'NetworkSearchParameter', Network: { Network: 'OwnedAndOperatedAndSyndicatedSearch' } });
    const res = await this.client
      .call<Json>('adinsight', 'KeywordIdeas/Query', {
        body: {
          ExpandIdeas: true,
          IdeaAttributes: ['Keyword', 'Competition', 'MonthlySearchCounts', 'SuggestedBid', 'Source'],
          SearchParameters: params,
        },
        ...(await this.ctx(accountId)),
      })
      .catch((e: unknown) => {
        throw new Error(
          `Microsoft gav ingen søgeordsidéer for ${country} på ${language}: ${e instanceof Error ? e.message : String(e)} Ifølge Microsofts dokumentation findes søgeordsidéer via API'et kun for USA, Storbritannien, Canada, Australien, Frankrig og Tyskland.`,
        );
      });
    return arr<Json>(res.KeywordIdeas)
      .map((k) => {
        const counts = arr<number>(k.MonthlySearchCounts).map(Number);
        return {
          keyword: str(k.Keyword),
          monthlySearches: counts.length ? Math.round(counts.reduce((a, b) => a + b, 0) / counts.length) : null,
          competition: str(k.Competition) || null,
          suggestedBid: num(k.SuggestedBid),
          source: str(k.Source) || null,
        };
      })
      .slice(0, input.limit ?? 50);
  }

  async searchVolumes(accountId: string, keywords: string[], opts: { language?: string; countryCode?: string; months?: number } = {}): Promise<SearchVolume[]> {
    const end = new Date();
    end.setDate(0); // the last completed month
    const start = new Date(end.getFullYear(), end.getMonth() - Math.min(opts.months ?? 12, 24) + 1, 1);
    const dmy = (d: Date) => ({ Day: d.getDate(), Month: d.getMonth() + 1, Year: d.getFullYear() });
    const res = await this.client.call<Json>('adinsight', 'HistoricalSearchCount/Query', {
      body: {
        Keywords: keywords,
        Language: opts.language ?? 'Danish',
        PublisherCountries: [opts.countryCode ?? 'DK'],
        StartDate: dmy(start),
        EndDate: dmy(end),
        TimePeriodRollup: 'Monthly',
        Devices: ['Computers', 'Smartphones', 'Tablets'],
      },
      ...(await this.ctx(accountId)),
    });
    // One entry per keyword (null when the keyword is not valid), split by device – summed here.
    return arr<Json | null>(res.KeywordSearchCounts).flatMap((k, i) => {
      if (!k) return [];
      const byMonth = new Map<string, number>();
      for (const d of arr<Json>(k.SearchCountsByAttributes)) {
        for (const h of arr<Json>(d.HistoricalSearchCounts)) {
          const date = (h.DayMonthAndYear ?? {}) as Json;
          const month = `${date.Year}-${String(date.Month).padStart(2, '0')}`;
          byMonth.set(month, (byMonth.get(month) ?? 0) + Number(h.SearchCount ?? 0));
        }
      }
      return [{ keyword: str(k.Keyword) || keywords[i]!, months: [...byMonth].sort().map(([month, searches]) => ({ month, searches })) }];
    });
  }

  async bidEstimates(
    accountId: string,
    keywords: { text: string; matchType: string }[],
    opts: { campaignId?: string; adGroupId?: string; language?: string; location?: string } = {},
  ): Promise<KeywordBidEstimate[]> {
    const country = (opts.location ?? 'Denmark').trim();
    const locationId = (await this.countryIds(accountId)).get(country.toLowerCase());
    const res = await this.client.call<Json>('adinsight', 'EstimatedBid/QueryByKeywords', {
      body: {
        Keywords: keywords.map((k) => ({ KeywordText: k.text, MatchTypes: [k.matchType] })),
        TargetPositionForAds: 'MainLine',
        Language: opts.language ?? (country.toLowerCase() === 'denmark' ? 'Danish' : 'English'),
        LocationIds: locationId ? [Number(locationId)] : null,
        CampaignId: opts.campaignId ? Number(opts.campaignId) : null,
        AdGroupId: opts.adGroupId ? Number(opts.adGroupId) : null,
        EntityLevelBid: 'Keyword',
      },
      ...(await this.ctx(accountId)),
    });
    const range = (a: unknown, b: unknown): [number, number] | null => (a === null || a === undefined || b === null || b === undefined ? null : [Number(a), Number(b)]);
    return arr<Json | null>(res.KeywordEstimatedBids).flatMap((k, i) => {
      const e = k ? arr<Json>(k.EstimatedBids)[0] : undefined;
      const kw = keywords[i]!;
      return [
        {
          keyword: str(k?.Keyword) || kw.text,
          matchType: str(e?.MatchType) || kw.matchType,
          estimatedMinBid: num(e?.EstimatedMinBid),
          averageCpc: num(e?.AverageCPC),
          ctr: num(e?.CTR),
          clicksPerWeek: range(e?.MinClicksPerWeek, e?.MaxClicksPerWeek),
          impressionsPerWeek: range(e?.MinImpressionsPerWeek, e?.MaxImpressionsPerWeek),
          costPerWeek: range(e?.MinTotalCostPerWeek, e?.MaxTotalCostPerWeek),
        },
      ];
    });
  }

  async auctionInsights(accountId: string, level: 'Account' | 'Campaign' | 'AdGroup' | 'Keyword', ids: string[], range: { from: string; to: string }): Promise<AuctionCompetitor[]> {
    const dmy = (iso: string) => {
      const [y, m, d] = iso.split('-').map(Number);
      return { Day: d, Month: m, Year: y };
    };
    const res = await this.client.call<Json>('adinsight', 'AuctionInsightData/Query', {
      body: {
        EntityType: level,
        EntityIds: level === 'Account' ? null : ids.map(Number),
        SearchParameters: [{ Type: 'DateRangeSearchParameter', StartDate: dmy(range.from), EndDate: dmy(range.to) }],
        ReturnAdditionalFields: 'AbsoluteTopOfPageRate',
      },
      ...(await this.ctx(accountId)),
    });
    const result = (res.Result ?? {}) as Json;
    return arr<Json>(result.Entries).map((e) => {
      const k = (e.AggregatedKpi ?? {}) as Json;
      return {
        domain: str(e.DisplayDomain),
        impressionShare: num(k.ImpressionShare),
        overlapRate: num(k.OverlapRate),
        aboveRate: num(k.AboveRate),
        topOfPageRate: num(k.TopOfPageRate),
        absoluteTopOfPageRate: num(k.AbsoluteTopOfPageRate),
        outrankingShare: num(k.OutrankingShare),
      };
    });
  }

  async budgetOpportunities(accountId: string, campaignId?: string): Promise<BudgetOpportunity[]> {
    const ids = campaignId
      ? [campaignId]
      : (await this.listCampaigns(accountId))
          .filter((c) => c.status === 'Active')
          .slice(0, 15)
          .map((c) => c.id);
    const ctx = await this.ctx(accountId);
    const results = await Promise.allSettled(
      ids.map((id) => this.client.call<Json>('adinsight', 'BudgetOpportunities/Query', { body: { CampaignId: Number(id) }, ...ctx })),
    );
    return results.flatMap((r) =>
      r.status === 'fulfilled'
        ? arr<Json>(r.value.Opportunities).map((o) => ({
            campaignId: str(o.CampaignId),
            currentBudget: num(o.CurrentBudget),
            suggestedBudget: num(o.RecommendedBudget),
            increaseInClicks: num(o.IncreaseInClicks),
            increaseInImpressions: num(o.IncreaseInImpressions),
            increaseInConversions: num(o.IncreaseInConversions),
          }))
        : [],
    );
  }

  async rawRequest(accountId: string, service: MsService, path: string, method: 'GET' | 'POST' | 'PUT' | 'DELETE', body?: unknown): Promise<unknown> {
    return this.client.call(service, path, { method, body, ...(await this.ctx(accountId)) });
  }
}
