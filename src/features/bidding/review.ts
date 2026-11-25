/**
 * Which budgets and targets (and Enhanced CPC bids) to raise, lower or leave – the rules the
 * assistant follows (ai/tools/bidReview.ts → review_bids_and_budgets), in three layers:
 *
 * 1. Gates – if one fails, the lever stays as it is. Most bad changes are made at the wrong
 *    time: learning period (14 days after a new campaign, a bid strategy switch or changed
 *    conversion goals – Microsoft), cooldown (one conversion cycle, at least 7 days, since the
 *    last change to the campaign – Microsoft: one cycle), enough data (target changes only with
 *    ≥ 30 conversions in 30 days – Microsoft), tracking health (conversions gone while clicks
 *    hold → alert a person), conversion lag (the newest cycle of days is left out) and known
 *    events (promotion periods: targets stay; Microsoft's seasonality adjustments are for that).
 * 2. A decision table on actual CPA (or ROAS, mirrored) over the last 30 days against the goal.
 * 3. Step limits: targets ±15 % per change (Microsoft), budgets and bids ±20 % (house rule), one
 *    lever at a time per campaign, never under the minimum bid.
 *
 * Nothing here changes anything: the assistant proposes, a person approves every card.
 */

export const LEARNING_DAYS = 14;
export const MIN_COOLDOWN_DAYS = 7;
export const MIN_TARGET_CONVERSIONS = 30;
/** Microsoft's threshold for conversion-based bidding is per ACCOUNT. */
export const MIN_ACCOUNT_CONVERSIONS = 5;
export const TARGET_STEP = 0.15;
export const BUDGET_STEP = 0.2;
export const BID_STEP = 0.2;
/** "Limited by budget": at least this share of impressions lost to budget (percent). */
export const LIMITED_BY_BUDGET = 10;
/** Keyword/product bids: under this many clicks nothing is judged; a ROAS needs JUDGE_* to be read. */
export const MIN_BID_CLICKS = 30;
export const JUDGE_CLICKS = 100;
export const JUDGE_CONVERSIONS = 10;

export type StrategyType = 'EnhancedCpc' | 'ManualCpc' | 'MaxClicks' | 'MaxConversions' | 'MaxConversionValue' | 'TargetCpa' | 'TargetRoas' | 'TargetImpressionShare' | (string & {});

export interface CampaignInput {
  id: string;
  name: string;
  type: string;
  strategy: { type: StrategyType; targetCpa?: number | null; targetRoas?: number | null };
  dailyBudget: number | null;
  sharedBudget: boolean;
  /** The 30 days judged (the newest conversion cycle left out). */
  metrics: { spend: number; clicks: number; conversions: number; revenue: number };
  days: number;
  lostToBudget: number | null;
  lostToRank: number | null;
  /** When the levers were last changed through the app (ms), and how often the target was tightened in 60 days. */
  last: { budget?: number; target?: number; bids?: number; strategy?: number; created?: number; goals?: number };
  targetTightenings60: number;
  /** A dated period (Black Week …) running in or right after the 30 days. */
  event: string | null;
}

export interface Goal {
  cpa: number | null;
  roas: number | null;
}

export interface Context {
  now: number;
  cycleDays: number;
  accountConversions30: number;
  tracking: { broken: boolean; detail: string } | null;
  maxBudgetIncreasePct: number | null;
}

export type Move = 'raise' | 'lower' | 'hold' | 'add';

export interface LeverAdvice {
  move: Move;
  from: number | null;
  to: number | null;
  /** Which rule fired (shown with the reason, kept in the change log). */
  rule: string;
  why: string;
}

export interface CampaignVerdict {
  campaignId: string;
  campaign: string;
  /** The gate that holds everything, if any. */
  gate: string | null;
  budget: LeverAdvice;
  /** The CPA/ROAS target (automated strategies) – or, under Enhanced CPC, the bids. */
  target: LeverAdvice & { kind: 'cpa' | 'roas' | 'bids' | null };
  /** For a person to decide (the assistant never does these on its own). */
  escalate: string[];
  /** The numbers behind it. */
  numbers: { cpa: number | null; roas: number | null; goalCpa: number | null; goalRoas: number | null; costRatio: number | null; conversions: number; lostToBudget: number | null; budgetUse: number | null };
}

const AUTOMATED = new Set(['MaxConversions', 'MaxConversionValue', 'TargetCpa', 'TargetRoas']);
const VALUE_BASED = new Set(['MaxConversionValue', 'TargetRoas']);
const BIDS_USED = new Set(['EnhancedCpc', 'ManualCpc']);
const DAY = 86_400_000;

const round = (v: number, d = 2) => Math.round(v * 10 ** d) / 10 ** d;
const pct = (v: number) => `${Math.round(v * 100)} %`;

/** Cost ratio: actual against goal, > 1 is worse – CPA / goal CPA, or goal ROAS / ROAS. */
export function costRatio(m: CampaignInput['metrics'], goal: Goal, preferRoas: boolean): { ratio: number | null; kind: 'cpa' | 'roas' | null } {
  const cpa = m.conversions > 0 ? m.spend / m.conversions : null;
  const roas = m.spend > 0 ? m.revenue / m.spend : null;
  const useRoas = goal.roas && (preferRoas || !goal.cpa);
  if (useRoas) return { ratio: roas ? goal.roas! / roas : m.spend > 0 ? Infinity : null, kind: 'roas' };
  if (goal.cpa) return { ratio: cpa !== null ? cpa / goal.cpa : m.spend > 0 ? Infinity : null, kind: 'cpa' };
  return { ratio: null, kind: null };
}

/** The goal for a campaign: its own target, else the team's (business profile; ROAS falls back to break-even). */
export function goalOf(c: CampaignInput, team: Goal): Goal {
  return { cpa: c.strategy.targetCpa ?? team.cpa, roas: c.strategy.targetRoas ?? team.roas };
}

export function reviewCampaign(c: CampaignInput, team: Goal, ctx: Context): CampaignVerdict {
  const goal = goalOf(c, team);
  const m = c.metrics;
  const cpa = m.conversions > 0 ? m.spend / m.conversions : null;
  const roas = m.spend > 0 ? m.revenue / m.spend : null;
  const automated = AUTOMATED.has(c.strategy.type);
  const valueBased = VALUE_BASED.has(c.strategy.type);
  const bidsUsed = BIDS_USED.has(c.strategy.type);
  const { ratio, kind } = costRatio(m, goal, valueBased || (!!goal.roas && !c.strategy.targetCpa));
  const budgetUse = c.dailyBudget && c.days ? m.spend / c.days / c.dailyBudget : null;
  const limited = (c.lostToBudget ?? 0) >= LIMITED_BY_BUDGET;
  const cooldown = Math.max(MIN_COOLDOWN_DAYS, ctx.cycleDays);
  const ago = (t?: number) => (t ? (ctx.now - t) / DAY : Infinity);
  const escalate: string[] = [];
  const hold = (rule: string, why: string): LeverAdvice => ({ move: 'hold', from: null, to: null, rule, why });

  // The lever the "target" row steers: the CPA/ROAS target, or the bids under Enhanced CPC.
  const targetKind: 'cpa' | 'roas' | 'bids' | null = bidsUsed ? 'bids' : automated ? (valueBased ? 'roas' : 'cpa') : null;
  const currentTarget = targetKind === 'roas' ? (c.strategy.targetRoas ?? null) : targetKind === 'cpa' ? (c.strategy.targetCpa ?? null) : null;

  const numbers = { cpa, roas, goalCpa: goal.cpa, goalRoas: goal.roas, costRatio: ratio, conversions: m.conversions, lostToBudget: c.lostToBudget, budgetUse };
  const out = (gate: string | null, budget: LeverAdvice, target: LeverAdvice): CampaignVerdict => ({
    campaignId: c.id,
    campaign: c.name,
    gate,
    budget,
    target: { ...target, kind: targetKind },
    escalate,
    numbers,
  });

  /* ---------------------------------- 1. gates ---------------------------------- */
  if (ctx.tracking?.broken) {
    escalate.push(`Sporingen ser ud til at være gået i stykker (${ctx.tracking.detail}) – ret den, før noget ændres.`);
    const g = hold('G4', 'Sporingen ser ud til at være i stykker – intet ændres, før en person har tjekket den.');
    return out('Sporing', g, g);
  }
  const learning = Math.min(ago(c.last.created), ago(c.last.strategy), ago(c.last.goals));
  if (learning < LEARNING_DAYS) {
    const g = hold('G1', `I læringsperioden (${Math.floor(learning)} af ${LEARNING_DAYS} dage efter ny kampagne, nyt budstrategi eller ændrede konverteringsmål) – Microsoft: ændringer nu forlænger læringen.`);
    return out('Læring', g, g);
  }
  const lastLever = Math.min(ago(c.last.budget), ago(c.last.target), ago(c.last.bids));
  if (lastLever < cooldown) {
    const g = hold('G2', `Ændret for ${Math.floor(lastLever)} dage siden – vent én konverteringscyklus (${cooldown} dage), så effekten kan aflæses.`);
    return out('Afkøling', g, g);
  }
  if (ratio === null) {
    const g = hold('G0', 'Intet mål at holde tallene op mod – sæt mål-CPA eller mål-ROAS i virksomhedsprofilen (eller dækningsgraden).');
    return out('Mål mangler', g, g);
  }
  const enough = m.conversions >= MIN_TARGET_CONVERSIONS;

  /* ------------------------------- 2. decision table ------------------------------- */
  let budget: LeverAdvice = hold('B0', `Inden for målet ±15 % (${kind === 'roas' ? `ROAS ${round(roas ?? 0)} mod ${goal.roas}` : `CPA ${round(cpa ?? 0, 0)} mod ${goal.cpa}`}) – behold.`);
  let target: LeverAdvice = hold('T0', budget.why);
  const actual = kind === 'roas' ? `ROAS ${roas !== null ? round(roas) : '–'} mod mål ${goal.roas}` : `CPA ${cpa !== null ? round(cpa, 0) : '–'} kr. mod mål ${goal.cpa} kr.`;
  const step = Math.min(BUDGET_STEP, ctx.maxBudgetIncreasePct ? ctx.maxBudgetIncreasePct / 100 : BUDGET_STEP);

  // The target (or bids) one step tighter / looser.
  const tighten = (rule: string, why: string): LeverAdvice => {
    if (targetKind === 'bids') return { move: 'lower', from: null, to: null, rule, why: `${why} Sænk budene ca. ${pct(BID_STEP)} (søgeord og produktgrupper nedenfor).` };
    if (!currentTarget) {
      if (!automated) return hold(rule, `${why} Strategien har intet mål at stramme.`);
      const at = kind === 'roas' ? (roas ? round(roas) : null) : cpa ? round(cpa, 0) : null;
      return at ? { move: 'add', from: null, to: at, rule, why: `${why} Sæt et mål på den faktiske ${kind === 'roas' ? 'ROAS' : 'CPA'} de seneste 30 dage (Microsoft), og stram derefter ${pct(TARGET_STEP)} pr. cyklus.` } : hold(rule, why);
    }
    const to = targetKind === 'roas' ? round(currentTarget * (1 + TARGET_STEP)) : round(currentTarget * (1 - TARGET_STEP), 0);
    return { move: targetKind === 'roas' ? 'raise' : 'lower', from: currentTarget, to, rule, why: `${why} ${targetKind === 'roas' ? 'Hæv mål-ROAS' : 'Sænk mål-CPA'} ${pct(TARGET_STEP)}.` };
  };
  const loosen = (rule: string, why: string): LeverAdvice => {
    if (targetKind === 'bids') return { move: 'raise', from: null, to: null, rule, why: `${why} Hæv budene på de søgeord og produktgrupper, der klarer sig bedst (nedenfor), højst ${pct(BID_STEP)}.` };
    if (!currentTarget) return hold(rule, `${why} Strategien har intet mål at løsne – den køber allerede så meget, budgettet tillader.`);
    const to = targetKind === 'roas' ? round(currentTarget * (1 - TARGET_STEP)) : round(currentTarget * (1 + TARGET_STEP), 0);
    return { move: targetKind === 'roas' ? 'lower' : 'raise', from: currentTarget, to, rule, why: `${why} ${targetKind === 'roas' ? 'Sænk mål-ROAS' : 'Hæv mål-CPA'} ${pct(TARGET_STEP)} for mere volumen.` };
  };

  if (limited && ratio <= 1) {
    budget =
      c.sharedBudget || !c.dailyBudget
        ? hold('B1', `Begrænset af budget (${round(c.lostToBudget ?? 0, 0)} % tabt) og på mål (${actual}) – men kampagnen bruger et delt budget; hæv det delte budget.`)
        : { move: 'raise', from: c.dailyBudget, to: Math.round(c.dailyBudget * (1 + step)), rule: 'B1', why: `Begrænset af budget (${round(c.lostToBudget ?? 0, 0)} % af visningerne tabt) og på mål (${actual}) – hæv budgettet ${pct(step)}. Microsoft: en kampagne kan godt slå sit mål, mens budgettet holder den tilbage.` };
    if ((c.lostToRank ?? 0) > 50) budget.why += ` NB: ${round(c.lostToRank ?? 0, 0)} % tabes også på rang – mere budget køber mindre, end tallet antyder.`;
    target = hold('B1', 'Behold målet – det er budgettet, der holder kampagnen tilbage (én ting ad gangen).');
  } else if (limited && ratio > 1) {
    budget = hold('B2', `Begrænset af budget, men over målet (${actual}) – mere budget køber dyrere salg.`);
    target = tighten('B2', `Begrænset af budget og over målet (${actual}).`);
  } else if (ratio <= 1 - TARGET_STEP) {
    target = loosen('T1', `Klart bedre end målet (${actual}) og ikke begrænset af budget – ofte "Begrænset af mål for automatisk budgivning".`);
  } else if (ratio > 1 + TARGET_STEP) {
    target = tighten('T2', `Over målet (${actual}).`);
    if (c.targetTightenings60 >= 2) {
      escalate.push(`"${c.name}" er stadig over målet efter ${c.targetTightenings60} stramninger på 60 dage – en person må se på det (tilbud, landingsside, søgetermer). Overvej også budgettet −20 %.`);
      if (c.dailyBudget && !c.sharedBudget) budget = { move: 'lower', from: c.dailyBudget, to: Math.round(c.dailyBudget * (1 - BUDGET_STEP)), rule: 'T3', why: `Stadig over målet efter ${c.targetTightenings60} stramninger – overvej budgettet −20 % (en person beslutter).` };
    }
  }
  if (!limited && budgetUse !== null && budgetUse < 0.7 && budget.move === 'hold') {
    budget = hold('B5', `Bruger kun ${pct(budgetUse)} af budgettet og er ikke begrænset – behold budgettet; målet er nok for stramt eller markedet lille. Det ledige budget kan flyttes til en kampagne, der er begrænset af budget og på mål.`);
  }

  /* ------------------------------ gates on single levers ------------------------------ */
  if (!enough && (target.move !== 'hold' || budget.move !== 'hold')) {
    const note = `Kun ${round(m.conversions, 1)} konverteringer på 30 dage – under de ${MIN_TARGET_CONVERSIONS}, Microsoft vurderer en strategi på. Kun et signal; ingen ændring af mål eller budget endnu.`;
    if (target.move !== 'hold') target = hold(target.rule, `${target.why} ${note}`);
    if (budget.move !== 'hold') budget = hold(budget.rule, `${budget.why} ${note}`);
  }
  if (c.event && target.move !== 'hold') {
    target = hold('G6', `${target.why} Men ${c.event} ligger i perioden – målene bliver, som de er (Microsofts sæsonjustering er til kampagneperioder).`);
  }

  /* ---------------------------------- 4. escalate ---------------------------------- */
  if (ratio >= 2) escalate.push(`"${c.name}": ${kind === 'roas' ? `ROAS under det halve af målet` : `CPA over det dobbelte af målet`} (${actual}).`);
  if (c.strategy.type === 'EnhancedCpc' && ctx.accountConversions30 >= MIN_ACCOUNT_CONVERSIONS && m.conversions >= MIN_TARGET_CONVERSIONS)
    escalate.push(`"${c.name}" kører Forbedret CPC med ${round(m.conversions, 0)} konverteringer på 30 dage. Microsoft anbefaler en konverteringsbaseret strategi (Maksimér konverteringer/-værdi med mål på den faktiske CPA/ROAS), når kontoen har mindst ${MIN_ACCOUNT_CONVERSIONS} – et skift besluttes af en person og testes helst som eksperiment.`);

  return out(null, budget, target);
}

/* ------------------------------------ bids ------------------------------------ */

export interface BidInput {
  id: string;
  label: string;
  bid: number | null;
  clicks: number;
  spend: number;
  conversions: number;
  revenue: number;
}

export interface BidAdvice extends LeverAdvice {
  id: string;
  label: string;
  /** Kroner at stake (spend), to sort by. */
  weight: number;
}

/**
 * A keyword's or product group's bid under Enhanced CPC: the bid that meets the goal is
 * conversion rate × order value ÷ goal ROAS (= revenue per click ÷ goal ROAS), or goal CPA ×
 * conversion rate. Moves at most ±20 %, never under the minimum bid – when even the minimum
 * bid loses money, the advice is to pause or exclude instead. Enhanced CPC treats the bid as
 * an average: single clicks can cost more.
 */
export function reviewBid(k: BidInput, goal: Goal, minBid: number | null, avgOrderValue: number | null): BidAdvice | null {
  const base = { id: k.id, label: k.label, weight: k.spend, from: k.bid };
  if (!k.bid || k.clicks < MIN_BID_CLICKS) return null;
  const floor = minBid ?? 0;
  const goalCpa = goal.cpa ?? (goal.roas && avgOrderValue ? avgOrderValue / goal.roas : null);
  // 0 sales after enough spend.
  if (k.conversions <= 0) {
    if (goalCpa && k.spend >= 2 * goalCpa) {
      const to = round(Math.max(floor, k.bid * (1 - BID_STEP)));
      return to >= k.bid - 0.005
        ? { ...base, move: 'lower', to: null, rule: 'K0', why: `${k.clicks} klik for ${round(k.spend, 0)} kr. uden salg (over 2× mål-CPA), og buddet er allerede på mindstebuddet – sæt det på pause eller udeluk det.` }
        : { ...base, move: 'lower', to, rule: 'K1', why: `${k.clicks} klik for ${round(k.spend, 0)} kr. uden salg (over 2× mål-CPA ${round(goalCpa, 0)} kr.) – sænk ${pct(BID_STEP)}.` };
    }
    return null;
  }
  if (k.clicks < JUDGE_CLICKS && k.conversions < JUDGE_CONVERSIONS) return null;
  const perClick = k.revenue / k.clicks;
  const targetCpc = goal.roas ? perClick / goal.roas : goal.cpa ? (goal.cpa * k.conversions) / k.clicks : null;
  if (!targetCpc) return null;
  const roas = k.spend > 0 ? k.revenue / k.spend : 0;
  if (targetCpc < floor) {
    return { ...base, move: 'lower', to: null, rule: 'K4', why: `Buddet, der rammer målet, er ${round(targetCpc)} kr. – under mindstebuddet ${floor} kr. Mindstebuddet taber penge her: sæt det på pause eller udeluk det.` };
  }
  if (targetCpc >= k.bid * 1.1) {
    const to = round(Math.min(targetCpc, k.bid * (1 + BID_STEP)));
    return { ...base, move: 'raise', to, rule: 'K2', why: `ROAS ${round(roas)} på ${k.clicks} klik – målet tåler ${round(targetCpc)} kr. pr. klik. Hæv mod det, højst ${pct(BID_STEP)} ad gangen.` };
  }
  if (targetCpc <= k.bid * 0.9) {
    const to = round(Math.max(floor, targetCpc, k.bid * (1 - BID_STEP)));
    return { ...base, move: 'lower', to, rule: 'K3', why: `ROAS ${round(roas)} på ${k.clicks} klik – målet tåler kun ${round(targetCpc)} kr. pr. klik. Sænk mod det, højst ${pct(BID_STEP)} ad gangen.` };
  }
  return null;
}

/* ------------------------------------ account gates ------------------------------------ */

/**
 * Tracking health from the account's days (oldest first): conversions gone while clicks hold.
 * The newest days always lack late conversions, so only a hard drop counts – the last two
 * days under a quarter of normal while clicks are at least 70 % of normal, on an account
 * that normally has at least 1.5 conversions a day.
 */
export function trackingHealth(days: { clicks: number; conversions: number }[]): { broken: boolean; detail: string } {
  if (days.length < 6) return { broken: false, detail: '' };
  const last = days.slice(-2);
  const before = days.slice(-9, -2);
  const avg = (xs: typeof days, k: 'clicks' | 'conversions') => xs.reduce((n, d) => n + d[k], 0) / xs.length;
  const normalConv = avg(before, 'conversions');
  const normalClicks = avg(before, 'clicks');
  const conv = avg(last, 'conversions');
  const clicks = avg(last, 'clicks');
  const broken = normalConv >= 1.5 && conv < normalConv * 0.25 && clicks >= normalClicks * 0.7;
  return { broken, detail: broken ? `${round(conv, 1)} konverteringer om dagen de sidste 2 dage mod normalt ${round(normalConv, 1)}, mens klikkene holder (${Math.round(clicks)} mod ${Math.round(normalClicks)})` : '' };
}

/** Month pacing: act only when month-to-date spend is more than 15 % off pro-rata; over the monthly cap is for a person. */
export function pacing(monthToDate: number, daysElapsed: number, daysInMonth: number, monthlyBudget: number | null, forecast: number): { status: 'ok' | 'ahead' | 'behind' | 'none'; detail: string; escalate: string | null } {
  if (!monthlyBudget || daysElapsed <= 0) return { status: 'none', detail: '', escalate: null };
  const proRata = (monthlyBudget * daysElapsed) / daysInMonth;
  const off = proRata > 0 ? monthToDate / proRata - 1 : 0;
  const status = off > 0.15 ? 'ahead' : off < -0.15 ? 'behind' : 'ok';
  const detail = `Forbrug ${Math.round(monthToDate)} kr. mod ${Math.round(proRata)} kr. pro rata (${off >= 0 ? '+' : ''}${Math.round(off * 100)} %).`;
  return { status, detail, escalate: forecast > monthlyBudget ? `Forbruget forventes at nå ${Math.round(forecast)} kr. – over månedsbudgettet på ${Math.round(monthlyBudget)} kr.` : null };
}
