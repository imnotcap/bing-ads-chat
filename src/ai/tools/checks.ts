/**
 * Feasibility checks before a change and verification after it.
 *
 * Microsoft Advertising accepts several changes "without error" that never take effect:
 * keyword and ad group bids under an automated bid strategy, manual CPC on anything but
 * Audience campaigns (it silently becomes enhanced CPC), bid strategies set on ad groups
 * or keywords, activating a keyword in a paused campaign … So a write tool must
 *  1) check that the change can work before it is proposed, and
 *  2) read the entities back afterwards and only call a change done when Microsoft
 *     actually shows the new value.
 * Docs: https://learn.microsoft.com/advertising/guides/budget-bid-strategies
 */
import { presetRange } from '@/lib/format';
import { sleep } from '@/lib/utils';
import type { Account, AdGroup, BidStrategy, Campaign, MutationResult } from '@/bing/types';
import type { ChangeLine } from '@/stores/activity';
import { getReport, memo, type ExecutionResult, type ToolContext } from './context';

export const BID_LABELS: Record<string, string> = {
  ManualCpc: 'Manuel CPC',
  EnhancedCpc: 'Forbedret CPC',
  MaxClicks: 'Maksimér klik',
  MaxConversions: 'Maksimér konverteringer',
  TargetCpa: 'Mål-CPA',
  MaxConversionValue: 'Maksimér konverteringsværdi',
  TargetRoas: 'Mål-ROAS',
  TargetImpressionShare: 'Mål for visningsandel',
};

export function bidLabel(b: BidStrategy | undefined): string {
  if (!b) return '–';
  const base = BID_LABELS[b.type] ?? b.type;
  if (b.targetCpa) return `${base} (${b.targetCpa})`;
  if (b.targetRoas) return `${base} (${b.targetRoas})`;
  return base;
}

/** Strategies where Microsoft sets the bids itself – ad group and keyword bids are ignored. */
const AUTOMATED = new Set(['MaxClicks', 'MaxConversions', 'TargetCpa', 'TargetRoas', 'MaxConversionValue', 'TargetImpressionShare']);
/** Strategies that learn from conversion data. */
export const CONVERSION_BASED = new Set(['MaxConversions', 'TargetCpa', 'TargetRoas', 'MaxConversionValue']);
/** Microsoft: below 15 conversions in 30 days these strategies stop optimising. */
export const MIN_CONVERSIONS_30D = 15;
/** The team's playbook: automated strategies need at least 30 conversions in 30 days. */
export const RECOMMENDED_CONVERSIONS_30D = 30;

const LEVER: Record<string, string> = {
  MaxClicks: 'kampagnens budget eller maks. CPC-loft',
  MaxConversions: 'kampagnens budget eller maks. CPC-loft (eller skift til Mål-CPA)',
  TargetCpa: 'kampagnens mål-CPA eller budget',
  TargetRoas: 'kampagnens mål-ROAS eller budget',
  MaxConversionValue: 'kampagnens budget eller mål-ROAS',
  TargetImpressionShare: 'målet for visningsandel eller maks. CPC-loftet',
};

/**
 * Why bids on ad groups/keywords in this campaign would be ignored, or null when they
 * are used (manual and enhanced CPC).
 */
export function bidsIgnoredReason(c: Campaign): string | null {
  if (c.type === 'PerformanceMax') return `"${c.name}" er en Performance Max-kampagne – den har ingen søgeords- eller annoncegruppebud.`;
  if (!AUTOMATED.has(c.bidStrategy.type)) return null;
  return `"${c.name}" bruger ${BID_LABELS[c.bidStrategy.type] ?? c.bidStrategy.type}, så Microsoft sætter selv buddene og ignorerer søgeords- og annoncegruppebud (API'et melder ingen fejl, men intet ændrer sig). Justér i stedet ${LEVER[c.bidStrategy.type] ?? 'kampagnens budstrategi'}.`;
}

/** Bid strategies Microsoft accepts for the campaign type (documented limits). */
export function bidStrategyProblem(c: Pick<Campaign, 'name' | 'type'> & { bidStrategy?: BidStrategy }, b: BidStrategy): string | null {
  if (b.type === 'ManualCpc' && c.type !== 'Audience') {
    return `Manuel CPC findes kun for Audience-kampagner. Microsoft ignorerer det for "${c.name}" uden fejl og bruger Forbedret CPC i stedet – vælg Forbedret CPC (EnhancedCpc), hvis du vil styre buddene selv.`;
  }
  if (c.type === 'PerformanceMax' && b.type !== 'MaxConversions' && b.type !== 'MaxConversionValue') {
    return `Performance Max understøtter kun Maksimér konverteringer (evt. med mål-CPA) og Maksimér konverteringsværdi (evt. med mål-ROAS).`;
  }
  // Since August 2025 campaigns can't be moved to standalone Target CPA / Target ROAS (existing ones may keep theirs).
  if ((b.type === 'TargetCpa' || b.type === 'TargetRoas') && c.bidStrategy?.type !== b.type) {
    return b.type === 'TargetCpa'
      ? 'Microsoft tillader ikke længere at skifte til Mål-CPA som selvstændig strategi. Brug Maksimér konverteringer med en mål-CPA (type MaxConversions + targetCpa).'
      : 'Microsoft tillader ikke længere at skifte til Mål-ROAS som selvstændig strategi. Brug Maksimér konverteringsværdi med en mål-ROAS (type MaxConversionValue + targetRoas).';
  }
  if (b.type === 'TargetCpa' && !b.targetCpa) return 'Mål-CPA kræver en mål-CPA (targetCpa).';
  if (b.type === 'TargetRoas' && !b.targetRoas) return 'Mål-ROAS kræver en mål-ROAS (targetRoas).';
  return null;
}

export interface ConversionData {
  conversions: number;
  revenue: number;
  spend: number;
  cpa: number | null;
  roas: number | null;
}

/** Last 30 days for one campaign (the window Microsoft's automated strategies learn from). */
export async function last30(ctx: ToolContext, campaignId: string): Promise<ConversionData> {
  const rows = await getReport(ctx, { kind: 'campaign', range: presetRange('last30'), aggregation: 'Summary', campaignIds: [campaignId] });
  const r = rows.filter((x) => !x.campaignId || x.campaignId === campaignId);
  const conversions = r.reduce((s, x) => s + (x.conversions ?? 0), 0);
  const revenue = r.reduce((s, x) => s + (x.revenue ?? 0), 0);
  const spend = r.reduce((s, x) => s + (x.spend ?? 0), 0);
  return { conversions, revenue, spend, cpa: conversions ? spend / conversions : null, roas: spend ? revenue / spend : null };
}

/**
 * Data check before switching to a conversion-based strategy. Returns hard problems
 * (need the user's explicit acknowledgement) and softer warnings.
 */
export function strategyDataCheck(c: Campaign, b: BidStrategy, d: ConversionData, currency: string): { problems: string[]; warnings: string[] } {
  const problems: string[] = [];
  const warnings: string[] = [];
  const conv = Math.round(d.conversions * 10) / 10;
  if (CONVERSION_BASED.has(b.type)) {
    if (d.conversions === 0) problems.push(`"${c.name}" har 0 konverteringer de sidste 30 dage – ${BID_LABELS[b.type]} har intet at optimere efter (tjek UET-tag og konverteringsmål først).`);
    else if (d.conversions < MIN_CONVERSIONS_30D) problems.push(`"${c.name}" har kun ${conv} konverteringer de sidste 30 dage. Microsoft stopper med at optimere under ${MIN_CONVERSIONS_30D} pr. 30 dage.`);
    else if (d.conversions < RECOMMENDED_CONVERSIONS_30D) warnings.push(`"${c.name}" har ${conv} konverteringer de sidste 30 dage – under de ${RECOMMENDED_CONVERSIONS_30D}, jeres playbook kræver for automatiske strategier. Forvent ustabile resultater.`);
  }
  if ((b.type === 'TargetRoas' || b.type === 'MaxConversionValue') && d.revenue === 0 && d.conversions > 0) {
    problems.push(`"${c.name}" har ingen konverteringsværdi (omsætning) de sidste 30 dage – værdibaserede strategier kræver, at omsætning spores.`);
  }
  if (b.targetCpa && d.cpa) {
    const ratio = b.targetCpa / d.cpa;
    if (ratio < 0.85 || ratio > 1.15) warnings.push(`Mål-CPA flyttes ${Math.round(Math.abs(1 - ratio) * 100)} % fra den faktiske CPA – playbooken anbefaler ±10–15 % pr. skridt med mindst 2 uger imellem.`);
    if (ratio < 0.7) warnings.push(`Mål-CPA ${b.targetCpa} er ${Math.round((1 - ratio) * 100)} % under den faktiske CPA (${d.cpa.toFixed(0)} ${currency}) – forvent markant færre konverteringer. Sænk hellere i trin på 10–20 %.`);
    if (ratio > 1.5) warnings.push(`Mål-CPA ${b.targetCpa} er langt over den faktiske CPA (${d.cpa.toFixed(0)} ${currency}) – det kan øge forbruget uden flere gode konverteringer.`);
  }
  if (b.targetRoas && d.roas) {
    const ratio = b.targetRoas / d.roas;
    if (ratio < 0.85 || ratio > 1.15) warnings.push(`Mål-ROAS flyttes ${Math.round(Math.abs(1 - ratio) * 100)} % fra den faktiske ROAS – playbooken anbefaler ±10–15 % pr. skridt med mindst 2 uger imellem.`);
    if (ratio > 1.3) warnings.push(`Mål-ROAS ${b.targetRoas} er over den faktiske ROAS (${d.roas.toFixed(2)}) – forvent lavere volumen. Hæv hellere i trin på 10–20 %.`);
  }
  if (CONVERSION_BASED.has(b.type) && b.type !== c.bidStrategy.type) {
    warnings.push('Nyt budstrategiskift giver en læringsperiode på typisk 1–2 uger, hvor resultaterne svinger. Vurder først effekten bagefter, og undgå andre store ændringer imens.');
  }
  return { problems, warnings };
}

/* ------------------------------- serving state ------------------------------- */

const ACCOUNT_STATES: Record<string, string> = {
  Draft: 'betalingsmetoden er ikke godkendt endnu',
  Pending: 'kontoen afventer godkendelse hos Microsoft',
  Inactive: 'kontoen er deaktiveret (kontakt Microsoft Advertising support)',
  Pause: 'kontoen er sat på pause',
  Suspended: 'kontoen er suspenderet af Microsoft',
};

export async function currentAccount(ctx: ToolContext): Promise<Account | undefined> {
  const accounts = await memo(ctx, 'accounts', () => ctx.backend.listAccounts());
  return accounts.find((a) => a.id === ctx.accountId);
}

/** Why nothing in the account can serve right now, or null. */
export function accountBlocker(a: Account | undefined): string | null {
  if (a?.financialStatus === 'Hold') return 'Kontoen kan ikke vise annoncer: betalingen er forfalden (Microsoft leverer ikke annoncer, før kontoen er betalt).';
  if (a?.financialStatus === 'Proposed') return 'Kontoen kan ikke vise annoncer endnu: den er kun oprettet som forslag (mangler godkendt betaling).';
  if (!a?.status || a.status === 'Active') return null;
  return `Kontoen kan ikke vise annoncer: ${ACCOUNT_STATES[a.status] ?? `status ${a.status}`}.`;
}

export function campaignBlocker(c: Campaign): string | null {
  switch (c.status) {
    case 'Active':
      return null;
    case 'Paused':
      return `Kampagnen "${c.name}" er sat på pause.`;
    case 'BudgetPaused':
    case 'BudgetAndManualPaused':
      return `Kampagnen "${c.name}" er stoppet, fordi budgettet er brugt.`;
    case 'Suspended':
      return `Kampagnen "${c.name}" er suspenderet af Microsoft (kontakt support).`;
    default:
      return `Kampagnen "${c.name}" har status ${c.status}.`;
  }
}

export function adGroupBlocker(g: AdGroup): string | null {
  if (g.status === 'Active') return null;
  if (g.status === 'Expired') return `Annoncegruppen "${g.name}" er udløbet (slutdatoen er passeret).`;
  return `Annoncegruppen "${g.name}" er sat på pause.`;
}

export function editorialNote(status: string | null | undefined, what: string): string | null {
  switch (status) {
    case 'Inactive':
      return `${what} afventer Microsofts redaktionelle godkendelse og vises først, når den er godkendt.`;
    case 'Disapproved':
      return `${what} er afvist redaktionelt af Microsoft og vises ikke, før den er rettet.`;
    case 'ActiveLimited':
      return `${what} er kun godkendt i nogle markeder.`;
    default:
      return null;
  }
}

/** Everything above an entity that stops it from serving (account, campaign, ad group). */
export async function servingBlockers(ctx: ToolContext, c: Campaign, g?: AdGroup): Promise<string[]> {
  const out = [accountBlocker(await currentAccount(ctx).catch(() => undefined)), campaignBlocker(c), g ? adGroupBlocker(g) : null];
  return out.filter((x): x is string => !!x);
}

/* -------------------------------- verification -------------------------------- */

export const near = (a: number | null | undefined, b: number | null | undefined) => a != null && b != null && Math.abs(a - b) < 0.005;

/** A changed field and how to check it on the entities read back from Microsoft. */
export interface LineCheck<S> {
  line: ChangeLine;
  /** Position of the item in the request (matches Microsoft's error Index). */
  index: number;
  /** null when Microsoft now shows the requested value; otherwise what it shows instead. */
  verify: (state: S) => string | null;
}

/** Reads back; when something does not match yet, waits a moment and reads once more. */
export async function readBack<S>(read: () => Promise<S>, checks: LineCheck<S>[], skip: Set<number>): Promise<S> {
  let state = await read();
  if (checks.some((c) => !skip.has(c.index) && c.verify(state) !== null)) {
    await sleep(1500);
    state = await read();
  }
  return state;
}

export const failedIndexes = (res: MutationResult) => new Set((res.failed ?? []).map((f) => f.index).filter((i): i is number => i !== null));

const fmtValue = (v: unknown) => (v === null || v === undefined || v === '' ? '–' : String(v));
const describe = (l: ChangeLine) => (l.before !== undefined ? `${l.field}: ${fmtValue(l.before)} → ${fmtValue(l.after)}` : `${l.field}: ${fmtValue(l.after)}`);

export interface Verified {
  applied: ChangeLine[];
  appliedIndexes: Set<number>;
  confirmed: string[];
  rejected: string[];
  notApplied: string[];
}

/** Sorts every requested line into confirmed / rejected by Microsoft / accepted but not applied. */
export function verify<S>(checks: LineCheck<S>[], res: MutationResult, state: S): Verified {
  const out: Verified = { applied: [], appliedIndexes: new Set(), confirmed: [], rejected: [], notApplied: [] };
  const errors = new Map((res.failed ?? []).filter((f) => f.index !== null).map((f) => [f.index!, f.message]));
  for (const c of checks) {
    const rejected = errors.get(c.index);
    if (rejected) {
      out.rejected.push(`${describe(c.line)} – ${rejected}`);
      continue;
    }
    const actual = c.verify(state);
    if (actual === null) {
      out.confirmed.push(describe(c.line));
      out.applied.push(c.line);
      out.appliedIndexes.add(c.index);
    } else out.notApplied.push(`${describe(c.line)} – Microsoft viser: ${actual}`);
  }
  // Errors Microsoft could not tie to an item.
  for (const f of res.failed ?? []) if (f.index === null) out.rejected.push(f.message);
  return out;
}

/**
 * Turns a verified change into an honest tool result. Throws when nothing was applied,
 * so the chat, the activity log and the assistant all see a failure – never "done".
 */
export function report(v: Verified, opts: { noun: string | [one: string, many: string]; warnings?: string[]; extra?: Record<string, unknown>; undo?: ExecutionResult['undo'] }): ExecutionResult {
  const total = v.confirmed.length + v.rejected.length + v.notApplied.length;
  const noun = (n: number) => (typeof opts.noun === 'string' ? opts.noun : opts.noun[n === 1 ? 0 : 1]);
  const warnings = [...new Set(opts.warnings ?? [])];
  if (!v.confirmed.length) {
    const why = [...v.rejected.map((r) => `Afvist: ${r}`), ...v.notApplied.map((n) => `Ikke slået igennem: ${n}`)].join(' · ');
    throw new Error(`Intet blev ændret. ${why || 'Microsoft viser stadig de gamle værdier.'}`);
  }
  const outcome = v.confirmed.length === total ? 'confirmed' : 'partially_applied';
  const summary =
    outcome === 'confirmed'
      ? `Bekræftet hos Microsoft: ${v.confirmed.length} ${noun(v.confirmed.length)}`
      : `${v.confirmed.length} af ${total} ${noun(total)} bekræftet · ${v.rejected.length + v.notApplied.length} ikke gennemført`;
  return {
    result: {
      outcome,
      verifiedByReadBack: true,
      confirmed: v.confirmed,
      ...(v.rejected.length ? { rejectedByMicrosoft: v.rejected } : {}),
      ...(v.notApplied.length ? { acceptedButNotApplied: v.notApplied } : {}),
      ...(warnings.length ? { warnings } : {}),
      ...opts.extra,
      instruction:
        outcome === 'confirmed'
          ? warnings.length
            ? 'The change is confirmed by reading it back, but tell the user about the warnings (e.g. it will not serve yet).'
            : 'The change is confirmed by reading it back from Microsoft Advertising.'
          : 'Only part of the change went through. Tell the user exactly what was and was not changed, and why.',
    },
    summary: warnings.length ? `${summary} · ${warnings.length} advarsel${warnings.length === 1 ? '' : 'er'}` : summary,
    undo: opts.undo,
    changes: v.applied,
  };
}
