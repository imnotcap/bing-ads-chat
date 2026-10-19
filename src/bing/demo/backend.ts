/**
 * DemoBackend – an in-memory Microsoft Advertising account. Structural changes made
 * by the assistant are persisted in localStorage so the demo behaves like a real
 * account across restarts ("Nulstil demo" in Indstillinger restores it).
 */
import { parseIso, toIso, today } from '@/lib/format';
import { sleep } from '@/lib/utils';
import { EMPTY_METRICS, addMetrics, derive } from '../metrics';
import type {
  Account,
  Ad,
  AdGroup,
  AdGroupPatch,
  AdPatch,
  AdsBackend,
  BudgetOpportunity,
  Campaign,
  CampaignPatch,
  ItemError,
  Keyword,
  KeywordIdea,
  KeywordPatch,
  Metrics,
  MutationResult,
  NegativeEntityType,
  NegativeKeyword,
  NewAdGroup,
  NewCampaign,
  NewKeyword,
  NewResponsiveSearchAd,
  ReportAggregation,
  ReportRow,
  ReportSpec,
} from '../types';
import { DEMO_ACCOUNTS, createSeedState, type DemoState } from './seed';
import { Simulator, hash } from './simulate';

const STORAGE_KEY = 'bac.demo-state.v1';

const DEVICES: [string, number, number][] = [
  // name, traffic share, conversion multiplier
  ['Computer', 0.58, 1.18],
  ['Smartphone', 0.36, 0.72],
  ['Tablet', 0.06, 0.95],
];

const REGIONS: [string, string, number][] = [
  ['Hovedstaden', 'København', 0.27],
  ['Hovedstaden', 'Frederiksberg', 0.06],
  ['Hovedstaden', 'Hillerød', 0.05],
  ['Midtjylland', 'Aarhus', 0.16],
  ['Midtjylland', 'Herning', 0.05],
  ['Syddanmark', 'Odense', 0.1],
  ['Syddanmark', 'Kolding', 0.06],
  ['Syddanmark', 'Esbjerg', 0.04],
  ['Sjælland', 'Roskilde', 0.06],
  ['Sjælland', 'Næstved', 0.04],
  ['Nordjylland', 'Aalborg', 0.08],
  ['Nordjylland', 'Hjørring', 0.03],
];

const AGE_GENDER: [string, string, number, number][] = [
  ['18-24', 'Male', 0.06, 0.6],
  ['18-24', 'Female', 0.05, 0.6],
  ['25-34', 'Male', 0.14, 0.95],
  ['25-34', 'Female', 0.12, 1],
  ['35-49', 'Male', 0.17, 1.2],
  ['35-49', 'Female', 0.16, 1.25],
  ['50-64', 'Male', 0.12, 1.1],
  ['50-64', 'Female', 0.11, 1.05],
  ['65+', 'Male', 0.04, 0.7],
  ['65+', 'Female', 0.03, 0.7],
];

const HOURS = [0.4, 0.2, 0.1, 0.1, 0.1, 0.3, 1.2, 2.6, 4.4, 5.6, 6.2, 6.4, 6, 6.3, 6.5, 6.3, 5.8, 5.2, 5.4, 6.1, 6.6, 5.9, 3.8, 1.6];
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function scale(m: Metrics, traffic: number, conv = 1): Metrics {
  return {
    impressions: m.impressions * traffic,
    clicks: m.clicks * traffic,
    spend: m.spend * traffic,
    conversions: m.conversions * traffic * conv,
    revenue: m.revenue * traffic * conv,
  };
}

function bucket(date: string, agg: ReportAggregation): string | undefined {
  if (agg === 'Summary') return undefined;
  if (agg === 'Daily') return date;
  const d = parseIso(date);
  if (agg === 'Monthly') return toIso(new Date(d.getFullYear(), d.getMonth(), 1));
  const monday = new Date(d);
  monday.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return toIso(monday);
}

/** Normalises conversion weights so dimension splits keep the account totals. */
function normalised<T extends { traffic: number; conv: number }>(items: T[]): T[] {
  const total = items.reduce((s, i) => s + i.traffic * i.conv, 0) || 1;
  const sumTraffic = items.reduce((s, i) => s + i.traffic, 0) || 1;
  return items.map((i) => ({ ...i, traffic: i.traffic / sumTraffic, conv: (i.conv * sumTraffic) / total }));
}

export class DemoBackend implements AdsBackend {
  readonly mode = 'demo' as const;
  private state: DemoState;
  private sim: Simulator;

  constructor(private readonly latencyMs = 250) {
    this.state = DemoBackend.load();
    this.sim = new Simulator(this.state);
  }

  static load(): DemoState {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as DemoState;
        if (parsed.version === 1) return { ...createSeedState(), ...parsed };
      }
    } catch {
      /* storage unavailable – fall back to the seed */
    }
    return createSeedState();
  }

  static reset() {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }

  private commit() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
    } catch {
      /* ignore */
    }
    this.sim.setState(this.state);
  }

  private async delay() {
    if (this.latencyMs) await sleep(this.latencyMs * (0.6 + Math.random() * 0.8));
  }

  private newId(prefix = ''): string {
    this.state.nextId += 1;
    return `${prefix}${this.state.nextId}`;
  }

  private campaign(accountId: string, id: string) {
    const c = this.state.campaigns.find((x) => x.id === id && x.accountId === accountId);
    if (!c) throw new Error(`Kampagne ${id} findes ikke på kontoen.`);
    return c;
  }

  private adGroup(accountId: string, id: string): AdGroup {
    const g = this.state.adGroups.find((x) => x.id === id);
    if (!g) throw new Error(`Annoncegruppe ${id} findes ikke.`);
    this.campaign(accountId, g.campaignId);
    return g;
  }

  private setActive(id: string, status: string) {
    if (status === 'Active') delete this.state.pausedSince[id];
    else this.state.pausedSince[id] ??= today();
  }

  /* --------------------------------- reads --------------------------------- */

  async listAccounts(): Promise<Account[]> {
    await this.delay();
    return DEMO_ACCOUNTS;
  }

  async listCampaigns(accountId: string): Promise<Campaign[]> {
    await this.delay();
    return this.state.campaigns
      .filter((c) => c.accountId === accountId && c.status !== 'Deleted')
      .map(({ accountId: _a, ...c }) => {
        void _a;
        return { ...c };
      });
  }

  async listAdGroups(accountId: string, campaignId: string): Promise<AdGroup[]> {
    await this.delay();
    this.campaign(accountId, campaignId);
    return this.state.adGroups.filter((g) => g.campaignId === campaignId && g.status !== 'Deleted').map((g) => ({ ...g }));
  }

  async listKeywords(accountId: string, adGroupId: string): Promise<Keyword[]> {
    await this.delay();
    this.adGroup(accountId, adGroupId);
    return this.state.keywords.filter((k) => k.adGroupId === adGroupId && k.status !== 'Deleted').map((k) => ({ editorialStatus: 'Active', ...k }));
  }

  async listAds(accountId: string, adGroupId: string): Promise<Ad[]> {
    await this.delay();
    this.adGroup(accountId, adGroupId);
    return this.state.ads.filter((a) => a.adGroupId === adGroupId).map((a) => ({ editorialStatus: 'Active', ...a }));
  }

  async listNegativeKeywords(accountId: string, entityType: NegativeEntityType, entityId: string, _campaignId?: string): Promise<NegativeKeyword[]> {
    await this.delay();
    if (entityType === 'Campaign') this.campaign(accountId, entityId);
    else this.adGroup(accountId, entityId);
    return (this.state.negatives[`${entityType}:${entityId}`] ?? []).map(({ addedAt: _d, ...n }) => {
      void _d;
      return n;
    });
  }

  /* ------------------------------- mutations ------------------------------- */

  async updateCampaigns(accountId: string, patches: CampaignPatch[]): Promise<MutationResult> {
    await this.delay();
    for (const p of patches) {
      const c = this.campaign(accountId, p.campaignId);
      if (p.status) {
        c.status = p.status;
        this.setActive(c.id, p.status);
      }
      if (p.dailyBudget !== undefined) {
        if (p.dailyBudget < 1) throw new Error('Dagsbudgettet skal være mindst 1.');
        const log = (this.state.budgetLog[c.id] ??= [{ date: '0000-01-01', budget: c.dailyBudget ?? 0 }]);
        log.push({ date: today(), budget: p.dailyBudget });
        c.dailyBudget = p.dailyBudget;
      }
      if (p.name) c.name = p.name;
      // Like Microsoft: manual CPC only exists for Audience campaigns – elsewhere it silently becomes enhanced CPC.
      if (p.bidStrategy) c.bidStrategy = p.bidStrategy.type === 'ManualCpc' && c.type !== 'Audience' ? { type: 'EnhancedCpc' } : { ...p.bidStrategy };
    }
    this.commit();
    return {};
  }

  async createCampaign(accountId: string, spec: NewCampaign): Promise<MutationResult> {
    await this.delay();
    if (this.state.campaigns.some((c) => c.accountId === accountId && c.name.toLowerCase() === spec.name.toLowerCase() && c.status !== 'Deleted')) {
      throw new Error(`Der findes allerede en kampagne med navnet "${spec.name}".`);
    }
    const id = this.newId();
    this.state.campaigns.push({
      accountId,
      id,
      name: spec.name,
      status: spec.status,
      type: spec.type,
      dailyBudget: spec.dailyBudget,
      bidStrategy: spec.bidStrategy.type === 'ManualCpc' && spec.type !== 'Audience' ? { type: 'EnhancedCpc' } : spec.bidStrategy,
      languages: spec.languages,
    });
    this.state.bornOn[id] = today();
    if (spec.status !== 'Active') this.state.pausedSince[id] = today();
    this.commit();
    return { ids: [id] };
  }

  async deleteCampaigns(accountId: string, campaignIds: string[]): Promise<MutationResult> {
    await this.delay();
    for (const id of campaignIds) {
      const c = this.campaign(accountId, id);
      c.status = 'Deleted';
      this.setActive(id, 'Deleted');
    }
    this.commit();
    return {};
  }

  async createAdGroup(accountId: string, spec: NewAdGroup): Promise<MutationResult> {
    await this.delay();
    this.campaign(accountId, spec.campaignId);
    const id = this.newId();
    this.state.adGroups.push({ id, campaignId: spec.campaignId, name: spec.name, status: spec.status, cpcBid: spec.cpcBid ?? null });
    this.state.bornOn[id] = today();
    if (spec.status !== 'Active') this.state.pausedSince[id] = today();
    this.commit();
    return { ids: [id] };
  }

  async updateAdGroups(accountId: string, campaignId: string, patches: AdGroupPatch[]): Promise<MutationResult> {
    await this.delay();
    this.campaign(accountId, campaignId);
    for (const p of patches) {
      const g = this.adGroup(accountId, p.adGroupId);
      if (p.status) {
        g.status = p.status;
        this.setActive(g.id, p.status);
      }
      if (p.cpcBid !== undefined) g.cpcBid = p.cpcBid;
      if (p.name) g.name = p.name;
    }
    this.commit();
    return {};
  }

  async addKeywords(accountId: string, adGroupId: string, keywords: NewKeyword[]): Promise<MutationResult> {
    await this.delay();
    this.adGroup(accountId, adGroupId);
    const ids: string[] = [];
    const failed: ItemError[] = [];
    keywords.forEach((k, index) => {
      const dup = this.state.keywords.some(
        (x) => x.adGroupId === adGroupId && x.status !== 'Deleted' && x.text.toLowerCase() === k.text.toLowerCase() && x.matchType === k.matchType,
      );
      if (dup) {
        failed.push({ index, message: `"${k.text}" (${k.matchType}) findes allerede i annoncegruppen.`, code: 'DuplicateKeyword' });
        return;
      }
      const id = this.newId('k');
      this.state.keywords.push({ id, adGroupId, text: k.text, matchType: k.matchType, status: 'Active', bid: k.bid ?? null, qualityScore: 5 + Math.round(hash(k.text) * 4) });
      this.state.bornOn[id] = today();
      ids.push(id);
    });
    this.commit();
    return batchOutcome(ids, failed, keywords.length);
  }

  async updateKeywords(accountId: string, adGroupId: string, patches: KeywordPatch[]): Promise<MutationResult> {
    await this.delay();
    this.adGroup(accountId, adGroupId);
    for (const p of patches) {
      const k = this.state.keywords.find((x) => x.id === p.keywordId && x.adGroupId === adGroupId);
      if (!k) throw new Error(`Søgeord ${p.keywordId} findes ikke i annoncegruppe ${adGroupId}.`);
      if (p.status) {
        k.status = p.status;
        this.setActive(k.id, p.status);
      }
      if (p.bid !== undefined) k.bid = p.bid;
    }
    this.commit();
    return {};
  }

  async deleteKeywords(accountId: string, adGroupId: string, keywordIds: string[]): Promise<MutationResult> {
    await this.delay();
    this.adGroup(accountId, adGroupId);
    for (const id of keywordIds) {
      const k = this.state.keywords.find((x) => x.id === id && x.adGroupId === adGroupId);
      if (!k) throw new Error(`Søgeord ${id} findes ikke i annoncegruppe ${adGroupId}.`);
      k.status = 'Deleted';
      this.setActive(id, 'Deleted');
    }
    this.commit();
    return {};
  }

  async addNegativeKeywords(accountId: string, entityType: NegativeEntityType, entityId: string, keywords: NegativeKeyword[]): Promise<MutationResult> {
    await this.delay();
    if (entityType === 'Campaign') this.campaign(accountId, entityId);
    else this.adGroup(accountId, entityId);
    const list = (this.state.negatives[`${entityType}:${entityId}`] ??= []);
    const ids: string[] = [];
    const failed: ItemError[] = [];
    keywords.forEach((k, index) => {
      if (list.some((n) => n.text.toLowerCase() === k.text.toLowerCase() && n.matchType === k.matchType)) {
        failed.push({ index, message: `"${k.text}" (${k.matchType}) er allerede et negativt søgeord her.`, code: 'DuplicateNegativeKeyword' });
        return;
      }
      const id = this.newId('n');
      list.push({ id, text: k.text, matchType: k.matchType, addedAt: today() });
      ids.push(id);
    });
    this.commit();
    return batchOutcome(ids, failed, keywords.length);
  }

  async createResponsiveSearchAd(accountId: string, adGroupId: string, ad: NewResponsiveSearchAd): Promise<MutationResult> {
    await this.delay();
    this.adGroup(accountId, adGroupId);
    const id = this.newId('a');
    this.state.ads.push({
      id,
      adGroupId,
      type: 'ResponsiveSearch',
      status: 'Active',
      headlines: ad.headlines,
      descriptions: ad.descriptions,
      finalUrls: [ad.finalUrl],
      path1: ad.path1 ?? null,
      path2: ad.path2 ?? null,
    });
    this.commit();
    return { ids: [id] };
  }

  async updateAds(accountId: string, adGroupId: string, patches: AdPatch[]): Promise<MutationResult> {
    await this.delay();
    this.adGroup(accountId, adGroupId);
    for (const p of patches) {
      const a = this.state.ads.find((x) => x.id === p.adId && x.adGroupId === adGroupId);
      if (!a) throw new Error(`Annonce ${p.adId} findes ikke i annoncegruppe ${adGroupId}.`);
      a.status = p.status;
    }
    this.commit();
    return {};
  }

  /* -------------------------------- reports -------------------------------- */

  async runReport(accountId: string, spec: ReportSpec): Promise<ReportRow[]> {
    if (spec.kind === 'impressionshare') throw new Error('Visningsandel findes kun på rigtige Microsoft Advertising-konti.');
    await sleep(this.latencyMs * 2);
    const { kind, range, campaignIds } = spec;
    const days = this.sim.range(range.from, range.to);
    const agg = kind === 'hourofday' || kind === 'dayofweek' ? 'Summary' : spec.aggregation;
    const groups = new Map<string, { row: ReportRow; m: Metrics }>();
    const add = (key: string, date: string, dims: ReportRow, m: Metrics) => {
      const b = bucket(date, agg);
      const k = b ? `${b}|${key}` : key;
      let g = groups.get(k);
      if (!g) {
        g = { row: b ? { date: b, ...dims } : { ...dims }, m: { ...EMPTY_METRICS } };
        groups.set(k, g);
      }
      g.m = addMetrics(g.m, m);
    };

    const campaigns = new Map(this.state.campaigns.map((c) => [c.id, c]));
    const adGroups = new Map(this.state.adGroups.map((g) => [g.id, g]));
    const keywords = new Map(this.state.keywords.map((k) => [k.id, k]));
    const units = this.sim.units(accountId, kind === 'campaign' || kind === 'adgroup' || kind === 'keyword' || kind === 'searchterm' || kind === 'ad' ? campaignIds : undefined);

    for (const date of days) {
      if (kind === 'campaign' || kind === 'adgroup' || kind === 'keyword' || kind === 'ad') {
        for (const u of units) {
          const m = this.sim.unitDay(accountId, u, date);
          const c = campaigns.get(u.campaignId);
          const g = adGroups.get(u.adGroupId);
          if (kind === 'campaign') {
            add(u.campaignId, date, { campaignId: u.campaignId, campaignName: c?.name, campaignStatus: c?.status }, m);
          } else if (kind === 'adgroup') {
            add(u.adGroupId, date, { campaignId: u.campaignId, campaignName: c?.name, adGroupId: u.adGroupId, adGroupName: g?.name, adGroupStatus: g?.status }, m);
          } else if (kind === 'keyword') {
            const k = u.keywordId ? keywords.get(u.keywordId) : undefined;
            if (!k) continue;
            add(k.id, date, {
              campaignId: u.campaignId,
              campaignName: c?.name,
              adGroupId: u.adGroupId,
              adGroupName: g?.name,
              keywordId: k.id,
              keyword: k.text,
              matchType: k.matchType,
              keywordStatus: k.status,
              qualityScore: k.qualityScore ?? null,
              currentMaxCpc: k.bid ?? g?.cpcBid ?? null,
            }, m);
          } else {
            const ads = this.state.ads.filter((a) => a.adGroupId === u.adGroupId);
            const weights = ads.map((a, i) => (a.status === 'Active' ? 1 + hash(a.id) * 0.8 - i * 0.15 : 0));
            const total = weights.reduce((s, w) => s + w, 0);
            ads.forEach((a, i) => {
              const w = total ? (weights[i] ?? 0) / total : 0;
              if (!w) return;
              add(a.id, date, { campaignName: c?.name, adGroupId: u.adGroupId, adGroupName: g?.name, adId: a.id, adTitle: a.headlines.slice(0, 2).join(' | '), adType: a.type }, scale(m, w));
            });
          }
        }
      } else if (kind === 'searchterm') {
        for (const u of units) {
          const k = u.keywordId ? keywords.get(u.keywordId) : undefined;
          if (!k) continue;
          const c = campaigns.get(u.campaignId);
          const g = adGroups.get(u.adGroupId);
          for (const t of this.sim.searchTerms(accountId, u, date, k.text)) {
            add(`${u.adGroupId}|${t.term}`, date, {
              campaignId: u.campaignId,
              campaignName: c?.name,
              adGroupId: u.adGroupId,
              adGroupName: g?.name,
              searchTerm: t.term,
              keyword: k.text,
              matchType: k.matchType,
            }, t.metrics);
          }
        }
      } else {
        const total = this.sim.accountDay(accountId, date);
        if (kind === 'account') {
          const acc = DEMO_ACCOUNTS.find((a) => a.id === accountId);
          add('acc', date, { accountName: acc?.name }, total);
        } else if (kind === 'device') {
          for (const d of normalised(DEVICES.map(([name, traffic, conv]) => ({ name, traffic, conv })))) add(d.name, date, { device: d.name }, scale(total, d.traffic, d.conv));
        } else if (kind === 'geo') {
          for (const r of normalised(REGIONS.map(([region, city, traffic]) => ({ region, city, traffic, conv: 0.85 + hash(city) * 0.3 })))) {
            add(r.city, date, { country: 'Denmark', region: r.region, city: r.city }, scale(total, r.traffic, r.conv));
          }
        } else if (kind === 'agegender') {
          for (const a of normalised(AGE_GENDER.map(([age, gender, traffic, conv]) => ({ age, gender, traffic, conv })))) {
            add(`${a.age}|${a.gender}`, date, { ageGroup: a.age, gender: a.gender }, scale(total, a.traffic, a.conv));
          }
        } else if (kind === 'hourofday') {
          for (const h of normalised(HOURS.map((traffic, hour) => ({ hour, traffic, conv: hour >= 19 && hour <= 22 ? 1.2 : hour < 7 ? 0.6 : 1 })))) {
            add(String(h.hour), date, { hour: h.hour }, scale(total, h.traffic, h.conv));
          }
        } else if (kind === 'dayofweek') {
          const name = DAY_NAMES[parseIso(date).getDay()] ?? '';
          add(name, date, { dayOfWeek: name }, total);
        }
      }
    }

    return [...groups.values()]
      .map(({ row, m }) => ({ ...row, ...derive(m) }))
      .sort((a, b) => (a.date && b.date && a.date !== b.date ? a.date.localeCompare(b.date) : (b.spend ?? 0) - (a.spend ?? 0)));
  }

  async keywordIdeas(_accountId: string, input: { queries: string[]; url?: string; language?: string; limit?: number }): Promise<KeywordIdea[]> {
    await sleep(this.latencyMs * 2);
    const seeds = input.queries.length ? input.queries : input.url ? [input.url.replace(/^https?:\/\/(www\.)?/, '').split(/[/.]/)[0] ?? 'kontormøbler'] : ['kontormøbler'];
    const suffixes = ['', ' tilbud', ' pris', ' test', ' bedst i test', ' online', ' køb', ' til hjemmekontor', ' danmark', ' sort', ' hvid', ' udsalg'];
    const out: KeywordIdea[] = [];
    for (const seed of seeds) {
      for (const suf of suffixes) {
        const kw = `${seed.toLowerCase()}${suf}`.trim();
        const r = hash(kw);
        out.push({
          keyword: kw,
          monthlySearches: Math.round((suf ? 40 : 600) + r * (suf ? 900 : 4000)),
          competition: r > 0.66 ? 'High' : r > 0.33 ? 'Medium' : 'Low',
          suggestedBid: Math.round((2 + r * 6) * 100) / 100,
          source: suf ? 'Suggestion' : 'Query',
        });
      }
    }
    return out.sort((a, b) => (b.monthlySearches ?? 0) - (a.monthlySearches ?? 0)).slice(0, input.limit ?? 40);
  }

  async budgetOpportunities(accountId: string, campaignId?: string): Promise<BudgetOpportunity[]> {
    await this.delay();
    const day = toIso(new Date(Date.now() - 86_400_000));
    const out: BudgetOpportunity[] = [];
    for (const c of this.state.campaigns.filter((x) => x.accountId === accountId && x.status === 'Active' && (!campaignId || x.id === campaignId))) {
      const units = this.sim.units(accountId, [c.id]);
      const spend = units.reduce((s, u) => s + this.sim.unitDay(accountId, u, day).spend, 0);
      const budget = c.dailyBudget ?? 0;
      if (budget && spend >= budget * 0.97) {
        out.push({
          campaignId: c.id,
          campaignName: c.name,
          currentBudget: budget,
          suggestedBudget: Math.round(budget * 1.6),
          increaseInClicks: Math.round(budget / 5),
          increaseInImpressions: Math.round(budget * 6),
          increaseInConversions: Math.round(budget / 90),
        });
      }
    }
    return out;
  }

  async rawRequest(): Promise<unknown> {
    throw new Error('Direkte API-kald er ikke tilgængelige i demo-tilstand. Forbind en rigtig Microsoft Advertising-konto under Indstillinger.');
  }
}

/** Mirrors the live backend: a batch where every item failed throws, so it is never reported as done. */
function batchOutcome(ids: string[], failed: ItemError[], count: number): MutationResult {
  if (count > 0 && failed.length >= count) throw new Error(`Microsoft Advertising afviste ændringen – intet blev ændret: ${failed.map((f) => f.message).join(' · ')}`);
  return {
    ids: ids.length ? ids : undefined,
    failed: failed.length ? failed : undefined,
    partialErrors: failed.length ? failed.map((f) => `#${(f.index ?? 0) + 1}: ${f.message}`) : undefined,
  };
}
