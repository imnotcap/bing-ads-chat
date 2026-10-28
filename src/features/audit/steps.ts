/**
 * The audit, step by step – the team's own sheet: one Microsoft Advertising campaign at a
 * time, held up against its Google Ads counterpart (which performs well), and Microsoft
 * corrected towards it. Google is only read; changes are made in Microsoft only.
 *
 * Shared by the app and the Worker (cloudflare/src/audit.ts checks step ids against it),
 * so: no imports.
 */

export type StepId =
  | 'match'
  | 'role'
  | 'setup'
  | 'budget'
  | 'performance'
  | 'devices'
  | 'geo'
  | 'audiences'
  | 'adgroups'
  | 'keywords'
  | 'searchterms'
  | 'negatives'
  | 'ads'
  | 'landing'
  | 'shopping'
  | 'pmax'
  | 'dsa'
  | 'execute'
  | 'comment'
  | 'sparring'
  | 'followup';

export interface AuditStep {
  id: StepId;
  title: string;
  /** What to do – one or two sentences. */
  what: string;
  /** Campaign kinds (Microsoft's CampaignType) the step is for; none = every campaign. */
  only?: string[];
}

export const AUDIT_STEPS: AuditStep[] = [
  { id: 'match', title: 'Afklar kampagnematch', what: 'Find den Google Ads-kampagne, der svarer til denne. Er der ingen, så notér det – så sammenlignes der med kontoen som helhed.' },
  { id: 'role', title: 'Forstå kampagnens rolle', what: 'Hvad skal kampagnen: brand, generisk, Shopping, PMax, remarketing? Er rollen den samme i Google?' },
  { id: 'setup', title: 'Status og opsætning', what: 'Status, kampagnetype, sprog og netværk. Kører den det samme sted og på samme måde som i Google?' },
  { id: 'budget', title: 'Budget og budgivning', what: 'Dagsbudget, budstrategi og mål (ROAS/CPA). Foreslå en tilpasning med begrundelse frem for at kopiere Google-beløbet.' },
  { id: 'performance', title: 'Performance og 2026-overblik', what: 'Omkostning, konverteringer, værdi og ROAS for perioden og for 2026 – side om side med Google.' },
  { id: 'devices', title: 'Enhedsfordeling', what: 'Fordelingen på computer, mobil og tablet og eventuelle budjusteringer pr. enhed.' },
  { id: 'geo', title: 'Geografi', what: 'Målretning af lande/områder og "personer i eller interesseret i" – som i Google?' },
  { id: 'audiences', title: 'Målgrupper', what: 'Tilknyttede målgrupper (remarketing, in-market, kundelister) og om de observerer eller målretter.' },
  { id: 'adgroups', title: 'Match annoncegrupper', what: 'Find hver annoncegruppes modstykke i Google. Mangler der grupper i Microsoft – eller omvendt?' },
  { id: 'keywords', title: 'Søgeord og matchtyper', what: 'Søgeord og matchtyper pr. annoncegruppe. Mangler de søgeord, der giver resultater i Google?', only: ['Search'] },
  { id: 'searchterms', title: 'Søgetermer', what: 'Hvilke søgetermer udløser annoncerne? Spild skal udelukkes, gode termer kan blive søgeord.' },
  { id: 'negatives', title: 'Negative søgeord', what: 'Negative søgeord og lister på kampagne- og gruppeniveau. Alt, Google udelukker, bør også være udelukket her.' },
  { id: 'ads', title: 'Annoncer og aktiver', what: 'Annoncetekster, udvidelser/aktiver (sitelinks, billeder, info). Samme budskaber og lige så komplette?' },
  { id: 'landing', title: 'Landingssider', what: 'Endelige URL’er og sporingsparametre. Peger annoncerne samme sted hen som i Google, og virker siderne?' },
  { id: 'shopping', title: 'Shopping og produkter', what: 'Produktgrupper, bud og udelukkede varer. Varer, der er udelukket i Google, skal også være udelukket her.', only: ['Shopping', 'PerformanceMax'] },
  { id: 'pmax', title: 'PMax', what: 'Aktivgrupper, listinggrupper og signaler. Svarer de til Googles PMax-opsætning?', only: ['PerformanceMax'] },
  { id: 'dsa', title: 'DSA og remarketing', what: 'Dynamiske søgeannoncer og remarketing: bruges de som i Google, og med de rigtige mål og udelukkelser?' },
  { id: 'execute', title: 'Udfør og verificér ændringer', what: 'Lav ændringerne i Microsoft Advertising. Notér før-værdi, periode, årsag og dato – og tjek bagefter, at de er slået igennem.' },
  { id: 'comment', title: 'Skriv kampagnekommentar', what: 'Kort konklusion: hvad blev fundet, hvad blev ændret, og hvad skal følges op.' },
  { id: 'sparring', title: 'Sparring og afslutning', what: 'Efter de første 5 kampagner: sparring. "Færdig" først, når alle grupper, annoncer og søgeord/produkter er gennemgået.' },
  { id: 'followup', title: 'Opfølgning', what: 'Følg op på ændringerne efter en passende periode, og sammenlign med før-værdierne.' },
];

export const STEP_IDS = new Set<string>(AUDIT_STEPS.map((s) => s.id));

/** Whether a step is for this kind of campaign (Search, Shopping, PerformanceMax …). */
export function stepApplies(step: AuditStep, campaignType: string | null | undefined): boolean {
  return !step.only || !campaignType || step.only.includes(campaignType);
}

/** A step is done, or marked as not relevant for the campaign; anything else is open. */
export type StepStatus = 'done' | 'na';

export interface StepMark {
  status: StepStatus;
  by: string;
  at: number;
}

/** One campaign's audit, as stored in the workspace. */
export interface CampaignAudit {
  /** The Microsoft Advertising campaign. */
  bingId: string;
  /** The Google Ads campaign it is held up against; null = "no counterpart" (decided), undefined = not decided. */
  googleId?: string | null;
  matchedBy?: string;
  matchedAt?: number;
  steps: Partial<Record<StepId, StepMark>>;
  note?: { text: string; by: string; at: number };
}

export interface Progress {
  done: number;
  total: number;
}

/** Steps finished (done or not relevant) out of those that apply to the campaign. */
export function progressOf(audit: CampaignAudit | undefined, campaignType: string | null | undefined): Progress {
  let done = 0;
  let total = 0;
  for (const step of AUDIT_STEPS) {
    const mark = audit?.steps[step.id];
    if (!stepApplies(step, campaignType) && mark?.status !== 'done') continue;
    total++;
    if (mark) done++;
  }
  return { done, total };
}
