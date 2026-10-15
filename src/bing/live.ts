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
  ReportRow,
  ReportSpec,
} from './types';
import { extractFirstFile } from './zip';

type Json = Record<string, unknown>;

const CAMPAIGN_TYPES = ['Search', 'Shopping', 'Audience', 'PerformanceMax'];
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

function toBidStrategy(raw: unknown): BidStrategy {
  const s = (raw ?? {}) as Json;
  return {
    type: str(s.Type) || 'Unknown',
    targetCpa: num(s.TargetCpa),
    targetRoas: num(s.TargetRoas),
    maxCpc: amount(s.MaxCpc),
  };
}

export function fromBidStrategy(b: BidStrategy): Json {
  const out: Json = { Type: b.type };
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
    languages: arr<string>(c.Languages),
    timeZone: str(c.TimeZone) || undefined,
  };
}

function partial(res: unknown, idsKey: string): MutationResult {
  const r = (res ?? {}) as Json;
  const ids = arr(r[idsKey])
    .map((v) => (v && typeof v === 'object' ? str(Object.values(v as Json)[0]) : str(v)))
    .filter(Boolean);
  const errors = [...arr(r.PartialErrors), ...arr(r.NestedPartialErrors)];
  const partialErrors = errors.length ? extractErrorMessages(errors) : undefined;
  if (partialErrors?.length && ids.length === 0 && idsKey) {
    throw new MsApiError(`Microsoft Advertising afviste ændringen: ${partialErrors.join(' · ')}`, 400, errors);
  }
  return { ids: ids.length ? ids : undefined, partialErrors };
}

function partialOnly(res: unknown): MutationResult {
  const r = (res ?? {}) as Json;
  const errors = [...arr(r.PartialErrors), ...arr(r.NestedPartialErrors)];
  if (!errors.length) return {};
  return { partialErrors: extractErrorMessages(errors) };
}

export class LiveBackend implements AdsBackend {
  readonly mode = 'live' as const;
  private readonly client: MsAdsClient;
  private accounts: Account[] | null = null;

  constructor(creds: MsCredentials) {
    this.client = new MsAdsClient(creds);
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
    const query = (type: string) =>
      this.cm<Json>(accountId, 'Campaigns/QueryByAccountId', 'POST', { AccountId: Number(accountId), CampaignType: type, ReturnAdditionalFields: null });
    try {
      const res = await query(CAMPAIGN_TYPES.join(' '));
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
    }));
  }

  async listAds(accountId: string, adGroupId: string): Promise<Ad[]> {
    const res = await this.cm<Json>(accountId, 'Ads/QueryByAdGroupId', 'POST', {
      AdGroupId: Number(adGroupId),
      AdTypes: ['ResponsiveSearch', 'ExpandedText', 'DynamicSearch', 'Product'],
      ReturnAdditionalFields: null,
    });
    const assets = (v: unknown) => arr<Json>(v).map((a) => str(((a.Asset ?? {}) as Json).Text)).filter(Boolean);
    return arr<Json>(res.Ads).map((a) => ({
      id: str(a.Id),
      adGroupId,
      type: str(a.Type),
      status: str(a.Status),
      headlines: a.Headlines ? assets(a.Headlines) : [a.TitlePart1, a.TitlePart2, a.TitlePart3].map(str).filter(Boolean),
      descriptions: a.Descriptions ? assets(a.Descriptions) : [a.Text, a.TextPart2].map(str).filter(Boolean),
      finalUrls: arr<string>(a.FinalUrls).map(str),
      path1: str(a.Path1) || null,
      path2: str(a.Path2) || null,
    }));
  }

  async listNegativeKeywords(accountId: string, entityType: NegativeEntityType, entityId: string): Promise<NegativeKeyword[]> {
    const res = await this.cm<Json>(accountId, 'EntityNegativeKeywords/QueryByEntityIds', 'POST', {
      EntityIds: [Number(entityId)],
      EntityType: entityType,
      ParentEntityId: entityType === 'Campaign' ? Number(accountId) : null,
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
    return partialOnly(res);
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
    return partial(res, 'CampaignIds');
  }

  async deleteCampaigns(accountId: string, campaignIds: string[]): Promise<MutationResult> {
    const res = await this.cm(accountId, 'Campaigns', 'DELETE', { AccountId: Number(accountId), CampaignIds: campaignIds.map(Number) });
    return partialOnly(res);
  }

  async createAdGroup(accountId: string, spec: NewAdGroup): Promise<MutationResult> {
    const group: Json = { Name: spec.name, Status: spec.status };
    if (spec.cpcBid) group.CpcBid = { Amount: spec.cpcBid };
    const res = await this.cm(accountId, 'AdGroups', 'POST', { CampaignId: Number(spec.campaignId), AdGroups: [group] });
    return partial(res, 'AdGroupIds');
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
    return partialOnly(res);
  }

  async addKeywords(accountId: string, adGroupId: string, keywords: NewKeyword[]): Promise<MutationResult> {
    const res = await this.cm(accountId, 'Keywords', 'POST', {
      AdGroupId: Number(adGroupId),
      Keywords: keywords.map((k) => ({ Text: k.text, MatchType: k.matchType, Bid: k.bid ? { Amount: k.bid } : null })),
    });
    return partial(res, 'KeywordIds');
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
    return partialOnly(res);
  }

  async deleteKeywords(accountId: string, adGroupId: string, keywordIds: string[]): Promise<MutationResult> {
    const res = await this.cm(accountId, 'Keywords', 'DELETE', { AdGroupId: Number(adGroupId), KeywordIds: keywordIds.map(Number) });
    return partialOnly(res);
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
    return partialOnly(res);
  }

  async createResponsiveSearchAd(accountId: string, adGroupId: string, ad: NewResponsiveSearchAd): Promise<MutationResult> {
    const asset = (text: string) => ({ Asset: { Type: 'TextAsset', Text: text } });
    const res = await this.cm(accountId, 'Ads', 'POST', {
      AdGroupId: Number(adGroupId),
      Ads: [
        {
          Type: 'ResponsiveSearch',
          Headlines: ad.headlines.map(asset),
          Descriptions: ad.descriptions.map(asset),
          FinalUrls: [ad.finalUrl],
          Path1: ad.path1 || null,
          Path2: ad.path2 || null,
          Status: 'Active',
        },
      ],
    });
    return partial(res, 'AdIds');
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
    return partialOnly(res);
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

  async keywordIdeas(accountId: string, input: { queries: string[]; url?: string; language?: string; limit?: number }): Promise<KeywordIdea[]> {
    const params: Json[] = [];
    if (input.queries.length) params.push({ Type: 'QuerySearchParameter', Queries: input.queries });
    if (input.url) params.push({ Type: 'UrlSearchParameter', Url: input.url });
    params.push({ Type: 'LanguageSearchParameter', Languages: [{ Language: input.language ?? 'Danish' }] });
    params.push({ Type: 'NetworkSearchParameter', Network: { Network: 'OwnedAndOperatedAndSyndicatedSearch' } });
    const res = await this.client.call<Json>('adinsight', 'KeywordIdeas/Query', {
      body: {
        ExpandIdeas: true,
        IdeaAttributes: ['Keyword', 'Competition', 'MonthlySearchCounts', 'SuggestedBid', 'Source'],
        SearchParameters: params,
      },
      ...(await this.ctx(accountId)),
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
