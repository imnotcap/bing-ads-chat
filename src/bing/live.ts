/**
 * LiveBackend – Microsoft Advertising API v13 (REST/JSON).
 * Campaign Management, Reporting, Customer Management and Ad Insight services.
 */
import { sleep } from '@/lib/utils';
import { MsAdsClient, MsApiError, extractErrorMessages, type MsCredentials } from './client';
import { parseCsv } from './csv';
import { buildReportRequest, normalizeReportRows } from './reports';
import type {
  Account,
  Ad,
  AdGroup,
  AdGroupPatch,
  AdPatch,
  AdsBackend,
  BidStrategy,
  BudgetOpportunity,
  Campaign,
  CampaignPatch,
  EditorialStatus,
  ItemError,
  Keyword,
  KeywordIdea,
  KeywordPatch,
  MsService,
  MutationResult,
  NegativeEntityType,
  NegativeKeyword,
  NewAdGroup,
  NewCampaign,
  NewKeyword,
  NewResponsiveSearchAd,
  PinPosition,
  ReportRow,
  ReportSpec,
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
    const ctx = await this.ctx(accountId);
    const submit = await this.client.call<{ ReportRequestId?: string }>('reporting', 'GenerateReport/Submit', {
      body: { ReportRequest: buildReportRequest(accountId, spec) },
      signal,
      ...ctx,
    });
    if (!submit.ReportRequestId) throw new Error('Microsoft Advertising: rapporten kunne ikke bestilles.');

    for (let attempt = 0; attempt < POLL_ATTEMPTS; attempt++) {
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
        const csv = new TextDecoder().decode(await extractFirstFile(zip));
        return normalizeReportRows(spec.kind, parseCsv(csv));
      }
    }
    throw new Error('Microsoft Advertising: rapporten blev ikke klar inden for 80 sekunder. Prøv en kortere periode.');
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
