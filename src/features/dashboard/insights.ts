/**
 * "Ugens indsigt": short readings of the period, written from the numbers (no AI call –
 * instant and free). The first page sums up the period against the one before; the
 * next pages are the attention points (features/insights/alerts.ts).
 */
import { change } from '@/bing/metrics';
import type { DerivedMetrics } from '@/bing/types';
import type { CampaignRow } from '@/hooks/useAdsData';
import { fmtMoney, fmtNumber, parseIso } from '@/lib/format';
import type { Alert } from '../insights/alerts';
import type { Granularity } from './period';

export interface InsightChip {
  label: string;
  detail: string;
  tone: 'up' | 'down' | 'warn' | 'info';
}

export interface InsightPage {
  text: string;
  chips: InsightChip[];
  /** Hand the reading to the assistant. */
  prompt: string;
}

const pct = (v: number) => `${Math.round(Math.abs(v) * 100)} %`;
const WEEKDAYS = ['søndag', 'mandag', 'tirsdag', 'onsdag', 'torsdag', 'fredag', 'lørdag'];

export function buildInsights({
  totals,
  previous,
  daily,
  campaigns,
  previousCampaigns,
  alerts,
  currency,
  granularity,
  current,
}: {
  totals: DerivedMetrics;
  previous: DerivedMetrics;
  daily: { date: string; revenue: number }[];
  campaigns: CampaignRow[];
  previousCampaigns: CampaignRow[];
  alerts: Alert[];
  currency: string;
  granularity: Granularity;
  /** The running week/month ("denne uge") or one stepped back to ("i ugen"). */
  current: boolean;
}): InsightPage[] {
  const period = granularity === 'week' ? (current ? 'denne uge' : 'i ugen') : current ? 'denne måned' : 'i måneden';
  const before = granularity === 'week' ? 'ugen før' : 'måneden før';
  const pages: InsightPage[] = [];

  // Who moved the most, in money.
  const prevById = new Map(previousCampaigns.map((c) => [c.id, c.metrics?.revenue ?? 0]));
  const moves = campaigns
    .map((c) => {
      const now = c.metrics?.revenue ?? 0;
      const was = prevById.get(c.id) ?? 0;
      return { c, delta: now - was, rel: change(now, was) };
    })
    .filter((m) => Math.abs(m.delta) > 0)
    .sort((a, b) => b.delta - a.delta);
  const up = moves[0] && moves[0].delta > 0 ? moves[0] : null;
  const down = moves.length && moves[moves.length - 1]!.delta < 0 ? moves[moves.length - 1]! : null;

  const rev = change(totals.revenue, previous.revenue);
  const spend = change(totals.spend, previous.spend);
  const parts: string[] = [];
  if (rev === null || Math.abs(rev) < 0.005) parts.push(`Konverteringsværdien ${rev === null ? 'er' : 'var uændret på'} ${fmtMoney(totals.revenue, currency, 0)} ${period}.`);
  else parts.push(`Konverteringsværdien ${rev >= 0 ? 'steg' : 'faldt'} ${pct(rev)} til ${fmtMoney(totals.revenue, currency, 0)} ${period}${up && rev >= 0 ? `, drevet af ${up.c.name}` : down && rev < 0 ? `, mest i ${down.c.name}` : ''}.`);
  if (spend !== null && Math.abs(spend) < 0.005) parts.push('Forbruget var uændret.');
  else if (spend !== null) {
    const roas = totals.roas !== null ? ` – ROAS endte på ${fmtNumber(totals.roas, 1)}x${previous.roas !== null ? ` mod ${fmtNumber(previous.roas, 1)}x ${before}` : ''}` : '';
    parts.push(`Forbruget ${spend >= 0 ? 'steg' : 'faldt'} ${pct(spend)}${roas}.`);
  }
  const best = [...daily].sort((a, b) => b.revenue - a.revenue)[0];
  if (best && best.revenue > 0 && daily.length > 2) {
    const d = parseIso(best.date);
    parts.push(granularity === 'week' ? `${WEEKDAYS[d.getDay()]!.replace(/^./, (c) => c.toUpperCase())} var ugens stærkeste dag.` : `Den ${d.getDate()}. var månedens stærkeste dag.`);
  }
  const chips: InsightChip[] = [];
  if (up) chips.push({ label: up.c.name, detail: up.rel !== null ? `+${pct(up.rel)} konv.værdi` : `+${fmtMoney(up.delta, currency, 0)}`, tone: 'up' });
  if (down) chips.push({ label: down.c.name, detail: down.rel !== null ? `−${pct(down.rel)} konv.værdi` : `−${fmtMoney(-down.delta, currency, 0)}`, tone: 'down' });
  pages.push({
    text: parts.join(' '),
    chips,
    prompt: `Forklar udviklingen ${period} mod ${before}: hvad drev konverteringsværdien og forbruget, og hvad bør jeg gøre nu?`,
  });

  const cpa = change(totals.cpa, previous.cpa);
  if (cpa !== null && Math.abs(cpa) >= 0.1) {
    pages.push({
      text: `Prisen pr. konvertering ${cpa > 0 ? 'steg' : 'faldt'} ${pct(cpa)} til ${fmtMoney(totals.cpa, currency, 0)} ${period}. ${cpa > 0 ? 'Det er værd at se på søgetermer og bud i de dyreste kampagner.' : 'Kontoen får flere konverteringer for pengene end før.'}`,
      chips: [{ label: 'CPA', detail: `${cpa > 0 ? '+' : '−'}${pct(cpa)}`, tone: cpa > 0 ? 'down' : 'up' }],
      prompt: `CPA ${cpa > 0 ? 'steg' : 'faldt'} ${pct(cpa)} ${period}. Hvorfor, og hvad bør jeg gøre?`,
    });
  }

  for (const a of alerts) {
    if (pages.length >= 4) break;
    pages.push({
      text: `${a.title}. ${a.detail}.`,
      chips: a.campaign ? [{ label: a.campaign, detail: a.tone === 'opportunity' ? 'Mulighed' : a.tone === 'warning' ? 'Bør ses på' : 'Til info', tone: a.tone === 'opportunity' ? 'up' : a.tone === 'warning' ? 'warn' : 'info' }] : [],
      prompt: a.prompt,
    });
  }
  return pages;
}
