/**
 * Deterministic metric simulation for the demo account. The same entity and date
 * always produce the same numbers, so answers stay consistent across questions.
 */
import { eachDay, parseIso } from '@/lib/format';
import { EMPTY_METRICS, addMetrics } from '../metrics';
import type { Metrics } from '../types';
import { SEARCH_TERMS, UNIT_PROFILES, type DemoState, type UnitProfile } from './seed';

/** Ad groups that are simulated as one unit (no keywords: Shopping, PMax, Audience). */
const ADGROUP_UNITS: Record<string, string> = { '1040': 'g107', '1070': 'g108', '1080': 'g109' };

export function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967296;
}

/** Rounds randomly but deterministically, so 0.3 conversions become 1 in ~30 % of days. */
function probRound(v: number, seed: string): number {
  const base = Math.floor(v);
  return base + (hash(seed) < v - base ? 1 : 0);
}

const WEEKDAY = [0.95, 1.08, 1.1, 1.06, 1.02, 0.92, 0.82];

function dayFactor(date: string): number {
  const d = parseIso(date);
  const doy = (d.getTime() - new Date(d.getFullYear(), 0, 1).getTime()) / 86_400_000;
  // Gentle seasonality: busier in autumn/winter (back-to-office, Black Friday).
  const season = 1 + 0.25 * Math.cos(((doy - 330) / 365) * 2 * Math.PI);
  return (WEEKDAY[d.getDay()] ?? 1) * season;
}

export function profileFor(unitKey: string): UnitProfile {
  const known = UNIT_PROFILES[unitKey];
  if (known) return known;
  // New entities created during the session get a modest, plausible profile.
  const r = hash(unitKey);
  return { impressions: 80 + r * 220, ctr: 0.03 + r * 0.03, cpc: 2.5 + r * 3, cvr: 0.01 + r * 0.025, aov: 1200 + r * 2500 };
}

export interface UnitRef {
  key: string;
  campaignId: string;
  adGroupId: string;
  keywordId?: string;
}

export class Simulator {
  private cache = new Map<string, Metrics>();

  constructor(private state: DemoState) {}

  setState(state: DemoState) {
    this.state = state;
    this.cache.clear();
  }

  private inactiveSince(id: string): string | undefined {
    return this.state.pausedSince?.[id];
  }

  private bornOn(id: string): string | undefined {
    return this.state.bornOn?.[id];
  }

  /** Units (keywords, or whole ad groups without keywords) of one account. */
  units(accountId: string, campaignIds?: string[]): UnitRef[] {
    const campaigns = this.state.campaigns.filter((c) => c.accountId === accountId && (!campaignIds?.length || campaignIds.includes(c.id)));
    const out: UnitRef[] = [];
    for (const c of campaigns) {
      for (const g of this.state.adGroups.filter((x) => x.campaignId === c.id)) {
        const kws = this.state.keywords.filter((k) => k.adGroupId === g.id);
        if (kws.length) for (const k of kws) out.push({ key: k.id, campaignId: c.id, adGroupId: g.id, keywordId: k.id });
        else out.push({ key: ADGROUP_UNITS[g.id] ?? `ag${g.id}`, campaignId: c.id, adGroupId: g.id });
      }
    }
    return out;
  }

  budgetOn(campaignId: string, date: string): number {
    const log = this.state.budgetLog?.[campaignId];
    const campaign = this.state.campaigns.find((c) => c.id === campaignId);
    let budget = campaign?.dailyBudget ?? 0;
    if (log?.length) {
      budget = log[0]?.budget ?? budget;
      for (const entry of log) if (entry.date <= date) budget = entry.budget;
    }
    return budget;
  }

  private isActiveOn(ref: UnitRef, date: string): boolean {
    for (const id of [ref.campaignId, ref.adGroupId, ref.keywordId]) {
      if (!id) continue;
      const since = this.inactiveSince(id);
      if (since && since <= date) return false;
      const born = this.bornOn(id);
      if (born && born > date) return false;
    }
    return true;
  }

  private rawUnitDay(ref: UnitRef, date: string): Metrics {
    if (!this.isActiveOn(ref, date)) return { ...EMPTY_METRICS };
    const p = profileFor(ref.key);
    const seed = `${ref.key}|${date}`;
    const noise = 0.82 + hash(seed) * 0.36;
    const impressions = Math.round(p.impressions * dayFactor(date) * noise);
    const clicks = probRound(impressions * p.ctr * (0.9 + hash(`${seed}c`) * 0.2), `${seed}cr`);
    const spend = clicks * p.cpc * (0.88 + hash(`${seed}s`) * 0.24);
    const conversions = probRound(clicks * p.cvr * (0.7 + hash(`${seed}v`) * 0.6), `${seed}vr`);
    const revenue = conversions * p.aov * (0.8 + hash(`${seed}r`) * 0.4);
    return { impressions, clicks, spend, conversions, revenue };
  }

  /** Daily campaign spend is capped by the budget that applied that day. */
  private campaignScale(accountId: string, campaignId: string, date: string): number {
    const key = `scale|${campaignId}|${date}`;
    const cached = this.cache.get(key);
    if (cached) return cached.spend;
    const spend = this.units(accountId, [campaignId]).reduce((sum, u) => sum + this.rawUnitDay(u, date).spend, 0);
    const budget = this.budgetOn(campaignId, date);
    const scale = budget > 0 && spend > budget ? budget / spend : 1;
    this.cache.set(key, { ...EMPTY_METRICS, spend: scale });
    return scale;
  }

  unitDay(accountId: string, ref: UnitRef, date: string): Metrics {
    const key = `${ref.key}|${ref.adGroupId}|${date}`;
    const cached = this.cache.get(key);
    if (cached) return cached;
    const raw = this.rawUnitDay(ref, date);
    const s = this.campaignScale(accountId, ref.campaignId, date);
    const m: Metrics =
      s === 1
        ? raw
        : {
            impressions: Math.round(raw.impressions * (0.55 + 0.45 * s)),
            clicks: Math.round(raw.clicks * s),
            spend: raw.spend * s,
            conversions: Math.round(raw.conversions * s * 10) / 10,
            revenue: raw.revenue * s,
          };
    this.cache.set(key, m);
    return m;
  }

  /** Splits a keyword's traffic over its search terms (minus negatives added since). */
  searchTerms(accountId: string, ref: UnitRef, date: string, keywordText: string): { term: string; metrics: Metrics }[] {
    const m = this.unitDay(accountId, ref, date);
    const profiles = SEARCH_TERMS[ref.key] ?? [{ term: keywordText, share: 1, cvr: 1 }];
    const negatives = [...(this.state.negatives[`Campaign:${ref.campaignId}`] ?? []), ...(this.state.negatives[`AdGroup:${ref.adGroupId}`] ?? [])].filter(
      (n) => n.addedAt <= date,
    );
    const blocked = (term: string) =>
      negatives.some((n) => (n.matchType === 'Exact' ? term === n.text.toLowerCase() : ` ${term} `.includes(` ${n.text.toLowerCase()} `)));
    const totalCvrWeight = profiles.reduce((s, p) => s + p.share * p.cvr, 0) || 1;
    return profiles
      .filter((p) => !blocked(p.term))
      .map((p) => {
        const conv = (m.conversions * (p.share * p.cvr)) / totalCvrWeight;
        return {
          term: p.term,
          metrics: {
            impressions: Math.round(m.impressions * p.share),
            clicks: Math.round(m.clicks * p.share),
            spend: m.spend * p.share,
            conversions: Math.round(conv * 10) / 10,
            revenue: m.conversions ? (m.revenue * conv) / m.conversions : 0,
          },
        };
      });
  }

  accountDay(accountId: string, date: string): Metrics {
    return this.units(accountId).reduce((acc, u) => addMetrics(acc, this.unitDay(accountId, u, date)), { ...EMPTY_METRICS });
  }

  range(from: string, to: string): string[] {
    return eachDay(from, to);
  }
}
