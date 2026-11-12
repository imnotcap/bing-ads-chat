/**
 * What the agents decide, as pure functions (tested in src/test/agents.test.ts):
 * - the follow-up verdict on a change (numbers before against after),
 * - which search terms cost money without selling and are not already blocked,
 * - whether a campaign is ready for its period.
 */
import { blocks } from '@/features/audit/compare';
import type { MatchKind } from '@/features/audit/detail';
import { fmtMoney, fmtNumber } from '@/lib/format';

export interface Totals {
  impressions: number;
  clicks: number;
  spend: number;
  conversions: number;
  revenue: number;
}

export const ZERO: Totals = { impressions: 0, clicks: 0, spend: 0, conversions: 0, revenue: 0 };

export function sum(rows: Partial<Totals>[]): Totals {
  return rows.reduce<Totals>(
    (t, r) => ({
      impressions: t.impressions + (r.impressions ?? 0),
      clicks: t.clicks + (r.clicks ?? 0),
      spend: t.spend + (r.spend ?? 0),
      conversions: t.conversions + (r.conversions ?? 0),
      revenue: t.revenue + (r.revenue ?? 0),
    }),
    ZERO,
  );
}

/* ------------------------------- 1. follow-up ------------------------------- */

export type Verdict = 'keep' | 'watch' | 'rollback' | 'wait';

export interface FollowUpVerdict {
  verdict: Verdict;
  /** One sentence: what to do and why. */
  text: string;
  /** The numbers per day, before → after. */
  lines: string[];
}

/** Under this much data after the change, it is too early to say anything. */
export const MIN_AFTER_DAYS = 5;
export const MIN_AFTER_CLICKS = 30;

const pct = (a: number, b: number) => (b > 0 ? (a - b) / b : null);
const signed = (v: number | null) => (v === null ? '' : ` (${v >= 0 ? '+' : '−'}${fmtNumber(Math.abs(v) * 100, 0)} %)`);

/**
 * The change's numbers per day before against after. Keep: sales and ROAS held up. Roll back:
 * ROAS fell clearly while the spend did not, or sales stopped. Otherwise watch it.
 */
export function followUpVerdict(before: Totals, beforeDays: number, after: Totals, afterDays: number, currency = 'DKK'): FollowUpVerdict {
  const b = (v: number) => (beforeDays > 0 ? v / beforeDays : 0);
  const a = (v: number) => (afterDays > 0 ? v / afterDays : 0);
  const roasB = before.spend > 0 ? before.revenue / before.spend : null;
  const roasA = after.spend > 0 ? after.revenue / after.spend : null;
  const kr = (v: number) => fmtMoney(v, currency);
  const lines = [
    `Forbrug pr. dag: ${kr(b(before.spend))} → ${kr(a(after.spend))}${signed(pct(a(after.spend), b(before.spend)))}`,
    `Klik pr. dag: ${fmtNumber(b(before.clicks), 1)} → ${fmtNumber(a(after.clicks), 1)}${signed(pct(a(after.clicks), b(before.clicks)))}`,
    `Konverteringer pr. dag: ${fmtNumber(b(before.conversions), 2)} → ${fmtNumber(a(after.conversions), 2)}${signed(pct(a(after.conversions), b(before.conversions)))}`,
    `ROAS: ${roasB === null ? '–' : fmtNumber(roasB, 2)} → ${roasA === null ? '–' : fmtNumber(roasA, 2)}`,
  ];
  if (afterDays < MIN_AFTER_DAYS || after.clicks < MIN_AFTER_CLICKS)
    return { verdict: 'wait', text: `For lidt data endnu (${afterDays} dage, ${fmtNumber(after.clicks)} klik efter ændringen) – jeg kigger igen om en uge.`, lines };
  const expected = b(before.conversions) * afterDays;
  if (after.conversions <= 0 && expected >= 2)
    return { verdict: 'rollback', text: `Ingen salg efter ændringen, hvor der før var ${fmtNumber(b(before.conversions), 1)} pr. dag – overvej at rulle tilbage.`, lines };
  const convOk = a(after.conversions) >= b(before.conversions) * 0.9;
  if (roasB !== null && roasA !== null) {
    if (roasA >= roasB * 0.9 && convOk) return { verdict: 'keep', text: `Behold – ROAS og salg har holdt (ROAS ${fmtNumber(roasB, 2)} → ${fmtNumber(roasA, 2)}).`, lines };
    if (roasA < roasB * 0.75 && a(after.spend) >= b(before.spend) * 0.9)
      return { verdict: 'rollback', text: `ROAS faldt fra ${fmtNumber(roasB, 2)} til ${fmtNumber(roasA, 2)}, uden at forbruget faldt – overvej at rulle tilbage.`, lines };
  } else if (convOk && after.conversions > 0) return { verdict: 'keep', text: 'Behold – salget har holdt.', lines };
  return { verdict: 'watch', text: 'Blandet billede – hold øje en uge mere, før der besluttes.', lines };
}

/* ------------------------------ 3. search terms ------------------------------ */

export interface TermRow {
  term: string;
  campaignId: string;
  campaignName: string;
  clicks: number;
  spend: number;
  conversions: number;
}

export interface NegativeRule {
  text: string;
  matchType: MatchKind;
}

export interface TermCandidate extends TermRow {
  /** The account's average CPC – the line under which a term is noise. */
  cpc: number;
}

/**
 * Search terms that cost money and sold nothing over the period: at least `minClicks`
 * clicks and three average clicks' worth of spend – and not already stopped by a negative
 * in the campaign (or a list it uses). Most expensive first.
 */
export function pickSearchTerms(rows: TermRow[], negatives: Map<string, NegativeRule[]>, opts: { minClicks?: number; limit?: number } = {}): TermCandidate[] {
  const total = sum(rows);
  const cpc = total.clicks > 0 ? total.spend / total.clicks : 0;
  const minClicks = opts.minClicks ?? 8;
  const minSpend = Math.max(cpc * 3, 1);
  return rows
    .filter((r) => r.term && r.conversions <= 0 && r.clicks >= minClicks && r.spend >= minSpend)
    .filter((r) => !(negatives.get(r.campaignId) ?? []).some((n) => blocks(n, r.term)))
    .sort((a, b) => b.spend - a.spend)
    .slice(0, opts.limit ?? 25)
    .map((r) => ({ ...r, cpc }));
}

/* --------------------------------- 4. periods --------------------------------- */

export interface ReadyCheck {
  text: string;
  ok: boolean;
}

export function readiness(c: { status: string; dailyBudget: number | null }, groups: { name: string; status: string; approvedAds: number }[]): ReadyCheck[] {
  const paused = groups.filter((g) => g.status !== 'Active' && g.status !== 'Expired');
  const noAds = groups.filter((g) => g.approvedAds === 0);
  return [
    { text: c.status === 'Active' ? 'Kampagnen er aktiv' : `Kampagnen er ${c.status === 'Paused' ? 'pauset' : c.status} – aktivér den (startdatoen holder annoncerne tilbage)`, ok: c.status === 'Active' },
    { text: c.dailyBudget && c.dailyBudget > 0 ? `Dagsbudget sat (${fmtNumber(c.dailyBudget)})` : 'Intet dagsbudget', ok: !!c.dailyBudget && c.dailyBudget > 0 },
    { text: paused.length ? `Pauset: ${paused.map((g) => g.name).join(', ')}` : 'Alle annoncegrupper i perioden er aktive', ok: !paused.length },
    { text: noAds.length ? `Ingen aktiv, godkendt annonce: ${noAds.map((g) => g.name).join(', ')}` : 'Hver annoncegruppe har en godkendt annonce', ok: !noAds.length },
  ];
}

/* ---------------------------------- dates ---------------------------------- */

export function isoAdd(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const t = new Date(Date.UTC(y!, m! - 1, d!));
  t.setUTCDate(t.getUTCDate() + days);
  return t.toISOString().slice(0, 10);
}

export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000) + 1;
}

/** "24-11-2026" – the team's date format. */
export const dk = (iso: string) => {
  const [y, m, d] = iso.split('-');
  return `${Number(d)}-${Number(m)}-${y}`;
};
