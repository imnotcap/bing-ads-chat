/**
 * A campaign's overall setup side by side – bid strategy, target, budget and what they
 * deliver – turned into short, plain facts the assistant judges from. The facts are worked
 * out here, in code, so the numbers behind a recommendation are never guessed.
 */
import { CONVERSION_BASED, MIN_CONVERSIONS_30D, bidLabel } from '@/ai/tools/checks';
import type { BidStrategy, Metrics } from '@/bing/types';
import { fmtMoney, fmtNumber } from '@/lib/format';

export const GOOGLE_BID: Record<string, string> = {
  MANUAL_CPC: 'Manuel CPC',
  ENHANCED_CPC: 'Forbedret CPC',
  TARGET_SPEND: 'Maksimér klik',
  MAXIMIZE_CONVERSIONS: 'Maksimér konverteringer',
  MAXIMIZE_CONVERSION_VALUE: 'Maksimér konverteringsværdi',
  TARGET_CPA: 'Mål-CPA',
  TARGET_ROAS: 'Mål-ROAS',
  TARGET_IMPRESSION_SHARE: 'Mål for visningsandel',
  MANUAL_CPM: 'Manuel CPM',
  MANUAL_CPV: 'Manuel CPV',
};

/** What a strategy steers by, the same word for both platforms. "Max value" with a ROAS target is target ROAS. */
type StrategyKind = 'roas' | 'value' | 'cpa' | 'conversions' | 'clicks' | 'manual' | 'share' | 'other';

function microsoftKind(b: BidStrategy): StrategyKind {
  if (b.type === 'TargetRoas' || (b.type === 'MaxConversionValue' && b.targetRoas)) return 'roas';
  if (b.type === 'MaxConversionValue') return 'value';
  if (b.type === 'TargetCpa' || (b.type === 'MaxConversions' && b.targetCpa)) return 'cpa';
  if (b.type === 'MaxConversions') return 'conversions';
  if (b.type === 'MaxClicks') return 'clicks';
  if (b.type === 'ManualCpc' || b.type === 'EnhancedCpc') return 'manual';
  if (b.type === 'TargetImpressionShare') return 'share';
  return 'other';
}

function googleKind(type: string, targetRoas: number | null, targetCpa: number | null): StrategyKind {
  if (type === 'TARGET_ROAS' || (type === 'MAXIMIZE_CONVERSION_VALUE' && targetRoas)) return 'roas';
  if (type === 'MAXIMIZE_CONVERSION_VALUE') return 'value';
  if (type === 'TARGET_CPA' || (type === 'MAXIMIZE_CONVERSIONS' && targetCpa)) return 'cpa';
  if (type === 'MAXIMIZE_CONVERSIONS') return 'conversions';
  if (type === 'TARGET_SPEND') return 'clicks';
  if (type === 'MANUAL_CPC' || type === 'ENHANCED_CPC') return 'manual';
  if (type === 'TARGET_IMPRESSION_SHARE') return 'share';
  return 'other';
}

export interface SettingsInput {
  currency: string;
  /** Days in the period the metrics cover. */
  days: number;
  microsoft: {
    bidStrategy: BidStrategy;
    dailyBudget: number | null;
    metrics: Metrics;
    /** Percent, 0–100 (impression share report); null when Microsoft did not say. */
    impressionShare: number | null;
    lostToBudget: number | null;
    lostToRank: number | null;
  };
  google: { bidStrategy: string; targetRoas: number | null; targetCpa: number | null; dailyBudget: number | null; metrics: Metrics } | null;
}

const ratio = (a: number, b: number) => (b > 0 ? a / b : null);
const pct = (v: number) => `${fmtNumber(v * 100, 0)} %`;

/** Short facts, one per line, most important first. Only what the numbers support. */
export function settingsFacts(s: SettingsInput): string[] {
  const out: string[] = [];
  const ms = s.microsoft;
  const g = s.google;
  const money = (v: number) => fmtMoney(v, s.currency);
  const mKind = microsoftKind(ms.bidStrategy);
  const msRoas = ratio(ms.metrics.revenue, ms.metrics.spend);
  const msCpa = ratio(ms.metrics.spend, ms.metrics.conversions);
  const conv30 = s.days > 0 ? (ms.metrics.conversions / s.days) * 30 : 0;

  // 1. The same strategy and target?
  if (g) {
    const gKind = googleKind(g.bidStrategy, g.targetRoas, g.targetCpa);
    const gLabel = GOOGLE_BID[g.bidStrategy] ?? g.bidStrategy;
    if (mKind !== gKind) out.push(`Forskellig budstrategi: Microsoft ${bidLabel(ms.bidStrategy)}, Google ${gLabel}.`);
    else if (mKind === 'roas' && ms.bidStrategy.targetRoas && g.targetRoas && Math.abs(ms.bidStrategy.targetRoas - g.targetRoas) > 0.05)
      out.push(`Samme budstrategi, men mål-ROAS er ${fmtNumber(ms.bidStrategy.targetRoas, 2)} i Microsoft mod ${fmtNumber(g.targetRoas, 2)} i Google.`);
    else if (mKind === 'cpa' && ms.bidStrategy.targetCpa && g.targetCpa && Math.abs(ms.bidStrategy.targetCpa - g.targetCpa) > 0.5)
      out.push(`Samme budstrategi, men mål-CPA er ${money(ms.bidStrategy.targetCpa)} i Microsoft mod ${money(g.targetCpa)} i Google.`);
    else out.push(`Samme budstrategi begge steder (${bidLabel(ms.bidStrategy)}).`);
  }

  // 2. Does Microsoft reach its own target?
  if (mKind === 'roas' && ms.bidStrategy.targetRoas) {
    out.push(
      msRoas === null
        ? `Microsoft har intet forbrug i perioden, så målet på ${fmtNumber(ms.bidStrategy.targetRoas, 2)} kan ikke vurderes.`
        : `Microsoft når ROAS ${fmtNumber(msRoas, 2)} mod målet ${fmtNumber(ms.bidStrategy.targetRoas, 2)}${msRoas < ms.bidStrategy.targetRoas * 0.8 ? ' – et godt stykke under' : msRoas >= ms.bidStrategy.targetRoas ? ' – over målet' : ''}.`,
    );
  }
  if (mKind === 'cpa' && ms.bidStrategy.targetCpa) {
    out.push(msCpa === null ? `Ingen konverteringer i Microsoft, så mål-CPA ${money(ms.bidStrategy.targetCpa)} nås ikke.` : `Microsoft har CPA ${money(msCpa)} mod målet ${money(ms.bidStrategy.targetCpa)}.`);
  }

  // 3. Enough data for a strategy that learns from conversions?
  if (CONVERSION_BASED.has(ms.bidStrategy.type) && conv30 < MIN_CONVERSIONS_30D)
    out.push(`Kun ${fmtNumber(conv30, conv30 < 10 ? 1 : 0)} konverteringer pr. 30 dage i Microsoft – under de ${MIN_CONVERSIONS_30D}, en konverteringsbaseret budstrategi skal bruge for at optimere.`);

  // 4. What holds the campaign back: budget or rank?
  if (ms.lostToBudget !== null && ms.lostToBudget >= 10) out.push(`Microsoft mister ${fmtNumber(ms.lostToBudget, 0)} % af de mulige visninger på budget.`);
  if (ms.lostToRank !== null && ms.lostToRank >= 30)
    out.push(`Microsoft mister ${fmtNumber(ms.lostToRank, 0)} % af de mulige visninger på rang – bud eller mål er for stramt, eller annoncerne/produkterne er svage.`);
  if (ms.impressionShare !== null) out.push(`Visningsandel i Microsoft: ${fmtNumber(ms.impressionShare, 0)} %.`);

  // 5. Budget: used, and against Google's.
  if (ms.dailyBudget && s.days > 0) {
    const used = ms.metrics.spend / s.days / ms.dailyBudget;
    if (used < 0.5) out.push(`Microsoft bruger kun ${pct(used)} af dagsbudgettet på ${money(ms.dailyBudget)} – budgettet er ikke det, der begrænser.`);
    else if (used > 0.9) out.push(`Microsoft bruger ${pct(Math.min(used, 1))} af dagsbudgettet på ${money(ms.dailyBudget)} – budgettet er fuldt brugt.`);
  }
  if (g?.dailyBudget && ms.dailyBudget) out.push(`Dagsbudget: Microsoft ${money(ms.dailyBudget)}, Google ${money(g.dailyBudget)}.`);

  // 6. Price and pull per click against Google.
  if (g) {
    const msCpc = ratio(ms.metrics.spend, ms.metrics.clicks);
    const gCpc = ratio(g.metrics.spend, g.metrics.clicks);
    if (msCpc !== null && gCpc !== null) out.push(`Gns. CPC: Microsoft ${money(msCpc)}, Google ${money(gCpc)}.`);
    const msCtr = ratio(ms.metrics.clicks, ms.metrics.impressions);
    const gCtr = ratio(g.metrics.clicks, g.metrics.impressions);
    if (msCtr !== null && gCtr !== null && gCtr > 0 && msCtr < gCtr * 0.6)
      out.push(`CTR er ${fmtNumber(msCtr * 100, 2)} % i Microsoft mod ${fmtNumber(gCtr * 100, 2)} % i Google – annoncerne/produkterne trækker færre klik.`);
    const gRoas = ratio(g.metrics.revenue, g.metrics.spend);
    if (msRoas !== null && gRoas !== null) out.push(`ROAS: Microsoft ${fmtNumber(msRoas, 2)}, Google ${fmtNumber(gRoas, 2)} (konverteringer tælles ikke helt ens).`);
  }
  return out;
}
