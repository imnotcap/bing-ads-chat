/**
 * Budget and limits per branch ("Budget og grænser"): monthly budget, ceilings, goals and
 * what the branch's assistant may do. Shared by the team on Cloudflare like the playbooks.
 * Microsoft Advertising's limits are enforced in code today (ai/guardrails.ts, the
 * spending rules); the other branches' limits are given to the chat as context and are
 * ready for when those branches get their own assistant. Used by the Worker too, so no
 * app imports here.
 */
import { CONNECTORS, type ConnectorId } from '../workspace/connectors';

export type LimitBranchId = 'microsoft_ads' | ConnectorId;

export interface BranchLimits {
  /** Monthly budget (ad spend – for Daisycon: commission). */
  monthlyBudget: number | null;
  /** Warn when month-to-date spend passes this share of the monthly budget. */
  warnAtPct: number;
  /** Microsoft only: pause all active campaigns when the monthly budget is used (the app does it, while open). */
  autoPauseAtMonthlyBudget: boolean;
  maxDailyBudgetPerCampaign: number | null;
  /** Sum of the daily budgets of all active campaigns. */
  maxTotalDailyBudget: number | null;
  /** Budget increases above this share are flagged on the approval card. */
  maxBudgetIncreasePct: number | null;
  maxCpcBid: number | null;
  targetCpa: number | null;
  targetRoas: number | null;
  /** Daisycon: highest commission share the assistant may propose. */
  maxCommissionPct: number | null;
  /** Serper/Ahrefs: paid API credits/units the branch may use per month. */
  monthlyCreditCap: number | null;
  /** Most rows the assistant may fetch per query – it reads summaries, never the whole database. */
  maxRows: number;
  /** false = the branch only reads and analyses (no change proposals at all). */
  mayPropose: boolean;
  allowCreateCampaigns: boolean;
  allowDelete: boolean;
  /** New campaigns and ad groups are always created paused. */
  newEntitiesPaused: boolean;
  /** Campaigns the assistant may never change (ids; names for platforms the app can't list yet). */
  protectedCampaignIds: string[];
}

export type LimitKey = keyof BranchLimits;

export const DEFAULT_LIMITS: BranchLimits = {
  monthlyBudget: null,
  warnAtPct: 80,
  autoPauseAtMonthlyBudget: false,
  maxDailyBudgetPerCampaign: null,
  maxTotalDailyBudget: null,
  maxBudgetIncreasePct: 20,
  maxCpcBid: null,
  targetCpa: null,
  targetRoas: null,
  maxCommissionPct: null,
  monthlyCreditCap: null,
  maxRows: 200,
  mayPropose: true,
  allowCreateCampaigns: true,
  allowDelete: false,
  newEntitiesPaused: true,
  protectedCampaignIds: [],
};

export interface StoredLimits {
  values: Partial<BranchLimits>;
  updatedBy: string | null;
  updatedAt: number | null;
}

/* ------------------------------ which fields where ------------------------------ */

export type LimitKind = 'ads' | 'affiliate' | 'credits' | 'read';

const KIND: Record<LimitBranchId, LimitKind> = {
  microsoft_ads: 'ads',
  google_ads: 'ads',
  meta_ads: 'ads',
  linkedin_ads: 'ads',
  daisycon: 'affiliate',
  ahrefs: 'credits',
  serper: 'credits',
  search_console: 'read',
  ga4: 'read',
  magento: 'read',
  klaviyo: 'read',
  pim: 'read',
};

/** Branches of the other marketing channels are archived with their connectors (workspace/connectors.ts); their limits stay stored. */
const ARCHIVED_BRANCHES: LimitBranchId[] = ['google_ads', 'meta_ads', 'linkedin_ads', 'daisycon', 'klaviyo'];
export const LIMIT_BRANCH_IDS = (Object.keys(KIND) as LimitBranchId[]).filter((id) => !ARCHIVED_BRANCHES.includes(id));
export const isLimitBranchId = (v: string): v is LimitBranchId => v in KIND;
export const limitKind = (id: LimitBranchId) => KIND[id];

export function branchName(id: LimitBranchId) {
  return id === 'microsoft_ads' ? 'Microsoft Advertising' : CONNECTORS.find((c) => c.id === id)!.name;
}

export interface LimitField {
  key: LimitKey;
  label: string;
  hint?: string;
  type: 'money' | 'number' | 'pct' | 'switch' | 'list';
  step?: number;
}

export interface LimitGroup {
  title: string;
  description: string;
  fields: LimitField[];
}

const bidLabel = (id: LimitBranchId) => (id === 'meta_ads' ? 'Maks. bud pr. resultat' : id === 'linkedin_ads' ? 'Maks. bud (CPC/CPM)' : 'Maks. CPC-bud');
const entity = (id: LimitBranchId) => (id === 'meta_ads' ? 'kampagner og annoncesæt' : 'kampagner');

/** The settings each branch has, grouped for the page. */
export function limitGroups(id: LimitBranchId): LimitGroup[] {
  const kind = KIND[id];
  const data: LimitGroup = {
    title: 'Data',
    description: 'Assistenten læser opsummerede tal – aldrig hele databasen.',
    fields: [{ key: 'maxRows', label: 'Maks. rækker pr. forespørgsel', hint: 'Større udtræk bliver filtreret og opsummeret i stedet.', type: 'number', step: 50 }],
  };
  if (kind === 'ads') {
    return [
      {
        title: 'Budget',
        description: 'Bruges til prognoser og advarsler – og blokerer ændringer, der vil gå over grænserne.',
        fields: [
          { key: 'monthlyBudget', label: 'Månedsbudget', hint: 'Samlet annonceforbrug pr. måned.', type: 'money' },
          { key: 'warnAtPct', label: 'Advar ved', hint: 'Andel af månedsbudgettet.', type: 'pct' },
          ...(id === 'microsoft_ads'
            ? [{ key: 'autoPauseAtMonthlyBudget' as const, label: 'Budgetvagt: pause alt ved 100 %', hint: 'Appen sætter alle aktive kampagner (undtagen beskyttede) på pause, når månedsbudgettet er brugt. Fra som standard.', type: 'switch' as const }]
            : []),
          { key: 'maxDailyBudgetPerCampaign', label: 'Maks. dagsbudget pr. kampagne', type: 'money' },
          { key: 'maxTotalDailyBudget', label: 'Maks. samlet dagsbudget', hint: 'Summen af alle aktive kampagners dagsbudgetter.', type: 'money' },
          { key: 'maxCpcBid', label: bidLabel(id), type: 'money', step: 0.01 },
          { key: 'maxBudgetIncreasePct', label: 'Advarsel ved budgetstigning over', hint: 'Større stigninger markeres med en advarsel på godkendelseskortet.', type: 'pct' },
        ],
      },
      {
        title: 'Mål',
        description: 'Assistenten vurderer kampagner og forslag mod disse mål.',
        fields: [
          { key: 'targetCpa', label: 'Mål-CPA', hint: 'Pris pr. konvertering.', type: 'money' },
          { key: 'targetRoas', label: 'Mål-ROAS', hint: 'Omsætning pr. krone brugt, fx 4.', type: 'number', step: 0.1 },
        ],
      },
      {
        title: 'Ændringer',
        description: 'Alle ændringer kræver altid din godkendelse – her bestemmer I, hvad der overhovedet må foreslås.',
        fields: [
          { key: 'mayPropose', label: 'Må foreslå ændringer', hint: 'Fra = grenen læser og analyserer kun.', type: 'switch' },
          { key: 'allowCreateCampaigns', label: `Må foreslå nye ${entity(id)}`, type: 'switch' },
          { key: 'newEntitiesPaused', label: 'Nye kampagner starter pauset', hint: 'Så I kan se dem igennem, før de bruger penge.', type: 'switch' },
          { key: 'allowDelete', label: 'Må foreslå sletning', hint: 'Assistenten foretrækker at sætte på pause.', type: 'switch' },
          ...(id === 'microsoft_ads' ? [] : [{ key: 'protectedCampaignIds' as const, label: 'Beskyttede kampagner', hint: 'Navne eller id’er – én pr. linje. Må aldrig ændres.', type: 'list' as const }]),
        ],
      },
      data,
    ];
  }
  if (kind === 'affiliate') {
    return [
      {
        title: 'Budget og kommission',
        description: 'Affiliate-omkostninger og grænser for kommission.',
        fields: [
          { key: 'monthlyBudget', label: 'Månedligt kommissionsbudget', type: 'money' },
          { key: 'warnAtPct', label: 'Advar ved', hint: 'Andel af budgettet.', type: 'pct' },
          { key: 'maxCommissionPct', label: 'Maks. kommission', hint: 'Højeste kommission pr. salg, assistenten må foreslå.', type: 'pct' },
          { key: 'targetCpa', label: 'Mål-pris pr. salg', type: 'money' },
          { key: 'targetRoas', label: 'Mål-ROAS', type: 'number', step: 0.1 },
        ],
      },
      { title: 'Ændringer', description: 'Alle ændringer kræver altid din godkendelse.', fields: [{ key: 'mayPropose', label: 'Må foreslå ændringer', hint: 'Fx kommission og partnere. Fra = kun analyse.', type: 'switch' }] },
      data,
    ];
  }
  if (kind === 'credits') {
    return [
      {
        title: 'Forbrug af API-kreditter',
        description: id === 'serper' ? 'Hver Google-søgning koster en kredit.' : 'Ahrefs tæller API-enheder pr. måned.',
        fields: [{ key: 'monthlyCreditCap', label: id === 'serper' ? 'Maks. søgninger pr. måned' : 'Maks. API-enheder pr. måned', type: 'number', step: 100 }],
      },
      data,
    ];
  }
  return [data];
}

/* --------------------------------- values --------------------------------- */

export function effectiveLimits(stored: StoredLimits | null | undefined): BranchLimits {
  return { ...DEFAULT_LIMITS, ...(stored?.values ?? {}) };
}

const num = (v: unknown, min: number, max: number): number | null | undefined => {
  if (v === null || v === '') return null;
  // Danish formatting too: "50.000" and "1.234,5".
  const text = typeof v === 'string' ? v.replace(/\s/g, '') : '';
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number((/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(text) ? text.replace(/\./g, '') : text).replace(',', '.')) : NaN;
  if (!Number.isFinite(n)) return undefined;
  return Math.min(max, Math.max(min, n));
};

/** Validates a patch from the app: only known keys with sane values survive. */
export function cleanLimits(input: unknown): Partial<BranchLimits> {
  const out: Partial<BranchLimits> = {};
  if (!input || typeof input !== 'object') return out;
  const o = input as Record<string, unknown>;
  const money = ['monthlyBudget', 'maxDailyBudgetPerCampaign', 'maxTotalDailyBudget', 'maxCpcBid', 'targetCpa', 'targetRoas', 'maxBudgetIncreasePct', 'maxCommissionPct', 'monthlyCreditCap'] as const;
  for (const k of money) {
    if (!(k in o)) continue;
    const v = num(o[k], 0, 100_000_000);
    if (v !== undefined) out[k] = v;
  }
  if ('warnAtPct' in o) {
    const v = num(o.warnAtPct, 10, 100);
    if (typeof v === 'number') out.warnAtPct = Math.round(v);
  }
  if ('maxRows' in o) {
    const v = num(o.maxRows, 10, 1000);
    if (typeof v === 'number') out.maxRows = Math.round(v);
  }
  for (const k of ['autoPauseAtMonthlyBudget', 'mayPropose', 'allowCreateCampaigns', 'allowDelete', 'newEntitiesPaused'] as const) {
    if (typeof o[k] === 'boolean') out[k] = o[k];
  }
  if (Array.isArray(o.protectedCampaignIds)) {
    out.protectedCampaignIds = [...new Set(o.protectedCampaignIds.map((x) => String(x).trim().slice(0, 200)).filter(Boolean))].slice(0, 500);
  }
  return out;
}

/** One line per other branch with limits set, for the chat's context block. */
export function otherBranchesContext(all: Partial<Record<LimitBranchId, StoredLimits | null>>, currency = 'DKK'): string | null {
  const lines: string[] = [];
  for (const id of LIMIT_BRANCH_IDS) {
    if (id === 'microsoft_ads') continue;
    const v = all[id]?.values;
    if (!v || !Object.keys(v).length) continue;
    const l = effectiveLimits(all[id]);
    const parts = [
      l.monthlyBudget !== null && `monthly budget ${l.monthlyBudget} ${currency}`,
      l.maxDailyBudgetPerCampaign !== null && `max daily budget/campaign ${l.maxDailyBudgetPerCampaign}`,
      l.targetCpa !== null && `target CPA ${l.targetCpa}`,
      l.targetRoas !== null && `target ROAS ${l.targetRoas}`,
      l.maxCommissionPct !== null && `max commission ${l.maxCommissionPct} %`,
      l.monthlyCreditCap !== null && `max ${l.monthlyCreditCap} credits/month`,
      !l.mayPropose && 'read-only',
    ].filter(Boolean);
    if (parts.length) lines.push(`${branchName(id)}: ${parts.join(', ')}`);
  }
  return lines.length ? `Other branches' budgets and limits (set by the team – use them when comparing channels): ${lines.join('; ')}.` : null;
}
