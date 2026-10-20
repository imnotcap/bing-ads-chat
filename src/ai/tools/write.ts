/**
 * Tools that change the account. Each returns a ChangePlan (evaluated by the
 * spending guardrails and shown on the approval card) plus an execute function.
 *
 * Every tool follows the same three steps:
 *  1. plan    – check that the change can actually work in Microsoft Advertising
 *               (bid strategy, campaign type, shared budget, duplicates …) and refuse it
 *               with an explanation when it cannot, instead of sending something the API
 *               silently ignores;
 *  2. execute – send it and map Microsoft's per-item errors back to the items;
 *  3. verify  – read the entities back and only report what Microsoft now shows.
 */
import { z } from 'zod';
import { presetRange } from '@/lib/format';
import { activeDailyBudget } from '@/bing/spend';
import { findOperation, isReadOperation, missingRequired, searchOperations } from '@/bing/msOperations';
import type { AdGroup, Campaign, Keyword, MsService, NegativeKeyword } from '@/bing/types';
import { useActivity, type ChangeLine } from '@/stores/activity';
import type { ChangePlan } from '../guardrails';
import {
  bidLabel,
  bidsIgnoredReason,
  bidStrategyProblem,
  campaignBlocker,
  CONVERSION_BASED,
  editorialNote,
  failedIndexes,
  last30,
  near,
  readBack,
  report,
  servingBlockers,
  strategyDataCheck,
  verify,
  type LineCheck,
} from './checks';
import { defineWrite, getAdGroup, getAdGroups, getCampaign, getCampaigns, getKeywords, getReport, statusLabel, type ToolContext } from './context';

export { bidLabel } from './checks';

const reason = z.string().describe('Short explanation (Danish) of why this change is made – shown to the user on the approval card.');
const onOff = z.enum(['Active', 'Paused']);
const acknowledge = z
  .boolean()
  .optional()
  .describe(
    'Set to true ONLY when the user has explicitly confirmed, after you explained the risk, that they want a conversion-based bid strategy although the campaign has too little conversion data. Never set it on your own.',
  );

const bidStrategySchema = z.object({
  type: z
    .enum(['EnhancedCpc', 'ManualCpc', 'MaxClicks', 'MaxConversions', 'TargetCpa', 'MaxConversionValue', 'TargetRoas'])
    .describe('For a target use MaxConversions + targetCpa or MaxConversionValue + targetRoas. TargetCpa/TargetRoas only to adjust a campaign that already uses them. ManualCpc only for Audience campaigns.'),
  targetCpa: z.number().positive().optional().describe('Target CPA in account currency (MaxConversions or TargetCpa).'),
  targetRoas: z.number().positive().optional().describe('Required for TargetRoas, optional for MaxConversionValue (e.g. 4 = 400 %).'),
  maxCpc: z.number().positive().optional().describe('Optional bid cap (MaxClicks, MaxConversions, TargetCpa, TargetRoas).'),
});

const MATCH_LABELS: Record<string, string> = { Exact: 'eksakt', Phrase: 'udtryk', Broad: 'bred' };

/**
 * Characters that count against an ad text limit: Microsoft counts the final text, so
 * dynamic text such as {KeyWord:Kontorstole} counts as its default text.
 */
export function finalLength(text: string): number {
  return text
    .replace(/\{[^{}:]+:([^{}]*)\}/g, '$1')
    .replace(/\{[^{}]*\}/g, '')
    .trim().length;
}

const adText = (max: number, what: string) =>
  z
    .string()
    .trim()
    .min(1)
    .max(1000)
    .refine((t) => /[\p{L}\p{N}]/u.test(t), `${what} skal indeholde mindst ét ord`)
    .refine((t) => finalLength(t) <= max, `${what} må højst være ${max} tegn (dynamisk tekst tæller som sin standardtekst)`);

function isActive(status: string | undefined) {
  return status === 'Active';
}

/** Paused in any form (Microsoft keeps "budget + manual" as its own status). */
function isPausedState(status: string | undefined) {
  return status === 'Paused' || status === 'BudgetAndManualPaused';
}

function pct(before: number | null | undefined, after: number) {
  return before ? (after - before) / before : null;
}

/** Microsoft treats keywords that only differ in case, accents or punctuation as duplicates. */
export function normalizeKeyword(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFKC')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Would this negative keyword stop the (positive) keyword's own search term from matching? */
export function negativeBlocks(neg: NegativeKeyword, keywordText: string): boolean {
  const n = normalizeKeyword(neg.text);
  const k = normalizeKeyword(keywordText);
  if (!n || !k) return false;
  if (neg.matchType === 'Exact') return n === k;
  return ` ${k} `.includes(` ${n} `);
}

const money = (v: number | null | undefined, cur: string) => (v == null ? '–' : `${v.toLocaleString('da-DK', { maximumFractionDigits: 2 })} ${cur}`);

function statusMatches(requested: 'Active' | 'Paused', actual: string | undefined) {
  return requested === 'Active' ? actual === 'Active' : isPausedState(actual);
}

/**
 * A bid strategy changed through the app within the last 14 days means the campaign is
 * most likely still learning – budget, target and strategy changes then reset it.
 */
function learningNote(ctx: ToolContext, c: Campaign): string | null {
  const since = Date.now() - 14 * 86_400_000;
  const hit = useActivity
    .getState()
    .entries.find((e) => e.accountId === ctx.accountId && e.status === 'success' && !e.undone && e.ts >= since && e.changes.some((l) => l.entityId === c.id && l.field.endsWith('budstrategi')));
  if (!hit) return null;
  return `"${c.name}" fik ny budstrategi ${new Date(hit.ts).toLocaleDateString('da-DK')} og er sandsynligvis stadig i læringsfase (~2 uger). Ændringer i budget, mål eller strategi nu forstyrrer læringen – vent hellere.`;
}

/** Fresh read of a list (the per-turn cache is cleared first). */
function fresh(ctx: ToolContext) {
  ctx.memo.clear();
  ctx.backend.campaignsChanged?.();
}

export const writeTools = [
  /* ------------------------------------------------------------------ campaigns */
  defineWrite({
    name: 'update_campaigns',
    kind: 'write',
    description: `Change one or more campaigns: status (Active/Paused), daily budget, name and/or bid strategy. Batch all campaign changes into one call.
The tool checks feasibility first and refuses changes Microsoft would ignore or reject: shared budgets, experiment campaigns, Manual CPC outside Audience campaigns (Microsoft silently turns it into Enhanced CPC), unsupported strategies for Performance Max, portfolio bid strategies, and conversion-based strategies without enough conversion data (<15 conversions/30 days). After sending, it reads the campaigns back and reports only what Microsoft confirms.`,
    schema: z.object({
      changes: z
        .array(
          z.object({
            campaignId: z.string(),
            status: onOff.optional(),
            dailyBudget: z.number().positive().optional().describe('New daily budget in account currency'),
            name: z.string().min(1).max(128).optional(),
            bidStrategy: bidStrategySchema.optional(),
          }),
        )
        .min(1),
      acknowledgeLowConversionData: acknowledge,
      reason,
    }),
    label: (i) => (i.changes.length === 1 ? 'Ændrer kampagne' : `Ændrer ${i.changes.length} kampagner`),
    async plan(input, ctx) {
      const campaigns = await getCampaigns(ctx);
      const lines: ChangeLine[] = [];
      const checks: LineCheck<Campaign[]>[] = [];
      const notes: string[] = [];
      const approvalReasons: string[] = [];
      const problems: string[] = [];
      let delta = 0;
      let increases = false;
      let maxInc: number | null = null;
      const newBudgets: number[] = [];
      const newBids: number[] = [];
      const undo = new Map<number, Record<string, unknown>>();
      const seen = new Set<string>();

      for (const [index, ch] of input.changes.entries()) {
        const c = campaigns.find((x) => x.id === String(ch.campaignId));
        if (!c) throw new Error(`Kampagne ${ch.campaignId} findes ikke på kontoen. Brug list_campaigns for at finde det rigtige id.`);
        if (seen.has(c.id)) throw new Error(`Kampagne ${c.id} står flere gange i samme kald – saml ændringerne for den i ét element.`);
        seen.add(c.id);
        const find = (list: Campaign[]) => list.find((x) => x.id === c.id);
        const inverse: Record<string, unknown> = { campaignId: c.id };
        const wasActive = isActive(c.status);
        const willBeActive = ch.status ? ch.status === 'Active' : wasActive;
        const before = c.dailyBudget ?? 0;
        const after = ch.dailyBudget ?? before;

        if (c.experimentId && (ch.status || ch.dailyBudget !== undefined)) {
          throw new Error(`"${c.name}" er en eksperimentkampagne – dens status og budget følger altid basiskampagnen og kan ikke ændres her.`);
        }

        if (ch.status && !statusMatches(ch.status, c.status)) {
          if (ch.status === 'Active' && c.status === 'Suspended') throw new Error(`"${c.name}" er suspenderet af Microsoft og kan ikke aktiveres herfra – kontakt Microsoft Advertising support.`);
          if (ch.status === 'Active' && (c.status === 'BudgetPaused' || c.status === 'BudgetAndManualPaused')) {
            notes.push(`"${c.name}" er stoppet af Microsoft, fordi budgettet er brugt. Den kører igen, når budgettet er fyldt op (næste dag/måned) eller hæves.`);
          }
          if (ch.status === 'Active') {
            const groups = await getAdGroups(ctx, c.id).catch(() => null);
            if (groups && !groups.some((g) => isActive(g.status))) notes.push(`"${c.name}" har ingen aktive annoncegrupper – den viser ingen annoncer, selvom den aktiveres.`);
          }
          const line: ChangeLine = { entity: 'Kampagne', entityId: c.id, field: `${c.name} · status`, before: statusLabel(c.status), after: statusLabel(ch.status) };
          lines.push(line);
          checks.push({ line, index, verify: (s) => (statusMatches(ch.status!, find(s)?.status) ? null : statusLabel(find(s)?.status ?? 'findes ikke')) });
          inverse.status = wasActive ? 'Active' : 'Paused';
          if (ch.status === 'Active') increases = true;
        }

        if (ch.dailyBudget !== undefined && !near(ch.dailyBudget, c.dailyBudget)) {
          if (c.sharedBudgetId) throw new Error(`"${c.name}" bruger et delt budget – dagsbudgettet kan ikke ændres for kampagnen alene (det skal ændres på det delte budget, via microsoft_ads_api 'Budgets').`);
          const line: ChangeLine = { entity: 'Kampagne', entityId: c.id, field: `${c.name} · dagsbudget`, before: c.dailyBudget, after: ch.dailyBudget };
          lines.push(line);
          checks.push({ line, index, verify: (s) => (near(find(s)?.dailyBudget, ch.dailyBudget) ? null : money(find(s)?.dailyBudget, ctx.currency)) });
          inverse.dailyBudget = c.dailyBudget ?? undefined;
          newBudgets.push(ch.dailyBudget);
          const inc = pct(c.dailyBudget, ch.dailyBudget);
          if (inc !== null && inc > 0) {
            increases = true;
            maxInc = Math.max(maxInc ?? 0, inc);
          }
        }

        if (ch.name && ch.name !== c.name) {
          if (campaigns.some((x) => x.id !== c.id && x.name.toLowerCase() === ch.name!.toLowerCase())) throw new Error(`Der findes allerede en kampagne med navnet "${ch.name}".`);
          const line: ChangeLine = { entity: 'Kampagne', entityId: c.id, field: 'Kampagnenavn', before: c.name, after: ch.name, edit: { path: ['changes', index, 'name'], maxLength: 128 } };
          lines.push(line);
          checks.push({ line, index, verify: (s) => (find(s)?.name === ch.name ? null : (find(s)?.name ?? 'findes ikke')) });
          inverse.name = c.name;
        }

        const b = ch.bidStrategy;
        const sameStrategy =
          b && b.type === c.bidStrategy.type && near(b.targetCpa ?? 0, c.bidStrategy.targetCpa ?? 0) && near(b.targetRoas ?? 0, c.bidStrategy.targetRoas ?? 0) && near(b.maxCpc ?? 0, c.bidStrategy.maxCpc ?? 0);
        if (b && !sameStrategy) {
          const problem = bidStrategyProblem(c, b);
          if (problem) throw new Error(problem);
          if (c.portfolioBidStrategyId) {
            throw new Error(`"${c.name}" bruger en porteføljebudstrategi (delt med andre kampagner, id ${c.portfolioBidStrategyId}). Den skal ændres på porteføljen, ikke på kampagnen alene.`);
          }
          if (CONVERSION_BASED.has(b.type) || b.targetCpa || b.targetRoas) {
            const check = strategyDataCheck(c, b, await last30(ctx, c.id), ctx.currency);
            problems.push(...check.problems);
            notes.push(...check.warnings);
          }
          if (b.type !== c.bidStrategy.type) approvalReasons.push('Skift af budstrategi ændrer, hvordan Microsoft byder – tjek det, før det gemmes.');
          const line: ChangeLine = { entity: 'Kampagne', entityId: c.id, field: `${c.name} · budstrategi`, before: bidLabel(c.bidStrategy), after: bidLabel(b) };
          lines.push(line);
          checks.push({
            line,
            index,
            verify: (s) => {
              const now = find(s)?.bidStrategy;
              if (!now) return 'kampagnen findes ikke';
              const ok = now.type === b.type && (b.type !== 'TargetCpa' || near(now.targetCpa, b.targetCpa)) && (b.type !== 'TargetRoas' || near(now.targetRoas, b.targetRoas));
              return ok ? null : bidLabel(now);
            },
          });
          inverse.bidStrategy = c.bidStrategy;
          if (b.maxCpc) newBids.push(b.maxCpc);
          increases = true;
        }
        if (inverse.dailyBudget !== undefined || inverse.bidStrategy) {
          const learning = learningNote(ctx, c);
          if (learning) {
            notes.push(learning);
            approvalReasons.push('Kampagnen er sandsynligvis i læringsfase.');
          }
        }
        delta += (willBeActive ? after : 0) - (wasActive ? before : 0);
        if (Object.keys(inverse).length > 1) undo.set(index, inverse);
      }

      if (!lines.length) throw new Error('Ingen ændringer – værdierne er allerede som foreslået.');
      if (problems.length && !input.acknowledgeLowConversionData) {
        throw new Error(
          `Ikke sendt – budstrategien kan ikke forventes at virke: ${problems.join(' ')} Forklar det for brugeren og anbefal et alternativ (fx Forbedret CPC eller Maksimér klik, indtil der er nok konverteringer). Kun hvis brugeren udtrykkeligt vil fortsætte alligevel, må du kalde igen med acknowledgeLowConversionData: true.`,
        );
      }
      if (problems.length) {
        notes.push(...problems);
        approvalReasons.push('Kampagnen har for lidt konverteringsdata til den valgte budstrategi.');
      }

      const plan: ChangePlan = {
        kind: 'update',
        title: input.changes.length === 1 ? 'Ændring af kampagne' : `Ændring af ${input.changes.length} kampagner`,
        reason: input.reason,
        changes: lines,
        dailyBudgetDelta: delta,
        increasesSpend: increases || delta > 0,
        campaignIds: input.changes.map((c) => String(c.campaignId)),
        maxBudgetIncrease: maxInc,
        newDailyBudgets: newBudgets,
        newBids,
        notes: [...new Set(notes)],
        approvalReasons: [...new Set(approvalReasons)],
        undo: undo.size ? { tool: 'update_campaigns', input: { changes: [...undo.values()], reason: 'Fortryd tidligere ændring' } } : undefined,
      };
      return {
        plan,
        execute: async () => {
          const res = await ctx.backend.updateCampaigns(
            ctx.accountId,
            input.changes.map((c) => ({ ...c, campaignId: String(c.campaignId) })),
          );
          fresh(ctx);
          const state = await readBack(() => ctx.backend.listCampaigns(ctx.accountId), checks, failedIndexes(res));
          const v = verify(checks, res, state);
          const applied = [...undo.entries()].filter(([i]) => v.appliedIndexes.has(i)).map(([, inv]) => inv);
          return report(v, {
            noun: ['ændring', 'ændringer'],
            warnings: plan.notes,
            undo: applied.length ? { tool: 'update_campaigns', input: { changes: applied, reason: 'Fortryd tidligere ændring' } } : undefined,
          });
        },
      };
    },
  }),

  defineWrite({
    name: 'create_campaign',
    kind: 'write',
    description:
      'Create a new Search campaign. (Shopping, Performance Max and Audience campaigns need store/asset/audience settings – use microsoft_ads_api for those.) A campaign shows no ads until it has an ad group with keywords and an ad: follow up with create_ad_group, add_keywords and create_responsive_search_ad. If the spending rules say new entities start paused, it is created paused. The tool reads the campaign back and reports what Microsoft actually saved.',
    schema: z.object({
      name: z.string().min(1).max(128),
      type: z.enum(['Search', 'Shopping', 'Audience', 'PerformanceMax']).optional().describe('Only Search is supported by this tool (default).'),
      dailyBudget: z.number().positive(),
      bidStrategy: bidStrategySchema,
      languages: z.array(z.string()).optional().describe("Ad languages, e.g. ['Danish'] (default) or ['All']"),
      status: onOff.optional().describe('Default Paused'),
      acknowledgeLowConversionData: acknowledge,
      reason,
    }),
    label: (i) => `Opretter kampagne "${i.name}"`,
    async plan(input, ctx) {
      const type = input.type ?? 'Search';
      if (type !== 'Search') {
        throw new Error(`${type}-kampagner kræver ekstra indstillinger (fx butik/produktfeed, asset groups eller målgrupper), som dette værktøj ikke sætter. Brug microsoft_ads_api med de nødvendige Settings, eller opret den i Microsoft Advertising.`);
      }
      const problem = bidStrategyProblem({ name: input.name, type }, input.bidStrategy);
      if (problem) throw new Error(problem);
      const campaigns = await getCampaigns(ctx);
      if (campaigns.some((c) => c.name.toLowerCase() === input.name.toLowerCase())) throw new Error(`Der findes allerede en kampagne med navnet "${input.name}" – Microsoft tillader ikke to med samme navn.`);

      const notes: string[] = [];
      const approvalReasons: string[] = [];
      if (CONVERSION_BASED.has(input.bidStrategy.type)) {
        // A new campaign has no history: look at the whole account to see whether conversions are tracked at all.
        const rows = await getReport(ctx, { kind: 'account', range: presetRange('last30'), aggregation: 'Summary' });
        const conversions = rows.reduce((s, r) => s + (r.conversions ?? 0), 0);
        if (conversions === 0) {
          const msg = 'Kontoen har 0 konverteringer de sidste 30 dage – konverteringssporingen (UET-tag og konverteringsmål) ser ikke ud til at virke, så en konverteringsbaseret budstrategi har intet at lære af.';
          if (!input.acknowledgeLowConversionData) {
            throw new Error(`Ikke oprettet: ${msg} Anbefal Forbedret CPC eller Maksimér klik i starten. Kun hvis brugeren udtrykkeligt vil alligevel, må du kalde igen med acknowledgeLowConversionData: true.`);
          }
          notes.push(msg);
          approvalReasons.push('Konverteringsbaseret budstrategi uden konverteringsdata.');
        } else notes.push(`En ny kampagne har ingen egen historik – ${bidLabel(input.bidStrategy)} er typisk 1–2 uger om at lære. Forvent udsving i starten.`);
      }
      const status = ctx.rules.newEntitiesPaused ? 'Paused' : (input.status ?? 'Paused');
      if (ctx.rules.newEntitiesPaused && input.status === 'Active') notes.push('Oprettes som pauset (forbrugsregel: nye kampagner starter pauset).');
      notes.push('Kampagnen viser ingen annoncer, før den har en annoncegruppe med søgeord og en godkendt annonce.');
      const plan: ChangePlan = {
        kind: 'create',
        title: 'Ny kampagne',
        reason: input.reason,
        changes: [
          { entity: 'Kampagne', field: 'Kampagnenavn', after: input.name, edit: { path: ['name'], maxLength: 128 } },
          { entity: 'Kampagne', field: 'type', after: type },
          { entity: 'Kampagne', field: 'dagsbudget', after: input.dailyBudget },
          { entity: 'Kampagne', field: 'budstrategi', after: bidLabel(input.bidStrategy) },
          { entity: 'Kampagne', field: 'status', after: statusLabel(status) },
        ],
        dailyBudgetDelta: status === 'Active' ? input.dailyBudget : 0,
        increasesSpend: status === 'Active',
        campaignIds: [],
        newDailyBudgets: [input.dailyBudget],
        newBids: input.bidStrategy.maxCpc ? [input.bidStrategy.maxCpc] : [],
        notes,
        approvalReasons,
      };
      return {
        plan,
        execute: async () => {
          const res = await ctx.backend.createCampaign(ctx.accountId, {
            name: input.name,
            type,
            dailyBudget: input.dailyBudget,
            bidStrategy: input.bidStrategy,
            languages: input.languages?.length ? input.languages : ['Danish'],
            status,
          });
          const id = res.ids?.[0];
          fresh(ctx);
          const find = (s: Campaign[]) => s.find((c) => c.id === id);
          const checks: LineCheck<Campaign[]>[] = [
            { line: plan.changes[0]!, index: 0, verify: (s) => (find(s) ? null : 'kampagnen blev ikke fundet ved genlæsning') },
            { line: plan.changes[2]!, index: 0, verify: (s) => (near(find(s)?.dailyBudget, input.dailyBudget) ? null : money(find(s)?.dailyBudget, ctx.currency)) },
            { line: plan.changes[3]!, index: 0, verify: (s) => (find(s)?.bidStrategy.type === input.bidStrategy.type ? null : bidLabel(find(s)?.bidStrategy)) },
            { line: plan.changes[4]!, index: 0, verify: (s) => (statusMatches(status, find(s)?.status) ? null : statusLabel(find(s)?.status)) },
          ];
          const state = await readBack(() => ctx.backend.listCampaigns(ctx.accountId), checks, failedIndexes(res));
          const v = verify(checks, res, state);
          return report(v, {
            noun: ['felt', 'felter'],
            warnings: notes,
            extra: { campaignId: id, status: find(state)?.status },
            undo: id ? { tool: 'update_campaigns', input: { changes: [{ campaignId: id, status: 'Paused' }], reason: 'Fortryd: sæt ny kampagne på pause' } } : undefined,
          });
        },
      };
    },
  }),

  defineWrite({
    name: 'delete_campaigns',
    kind: 'write',
    description: 'Permanently delete campaigns (cannot be undone, the history is kept in reports). Prefer pausing (update_campaigns) unless the user explicitly wants deletion.',
    schema: z.object({ campaignIds: z.array(z.string()).min(1), reason }),
    label: (i) => `Sletter ${i.campaignIds.length} kampagne${i.campaignIds.length === 1 ? '' : 'r'}`,
    async plan(input, ctx) {
      const campaigns = await Promise.all([...new Set(input.campaignIds.map(String))].map((id) => getCampaign(ctx, id)));
      const delta = -campaigns.filter((c) => isActive(c.status)).reduce((s, c) => s + (c.dailyBudget ?? 0), 0);
      const lines: ChangeLine[] = campaigns.map((c) => ({ entity: 'Kampagne', entityId: c.id, field: c.name, before: statusLabel(c.status), after: 'Slettet' }));
      const checks: LineCheck<Campaign[]>[] = campaigns.map((c, index) => ({
        line: lines[index]!,
        index,
        verify: (s) => (s.some((x) => x.id === c.id) ? `findes stadig (${statusLabel(s.find((x) => x.id === c.id)?.status)})` : null),
      }));
      return {
        plan: {
          kind: 'delete',
          title: 'Sletning af kampagner',
          reason: input.reason,
          changes: lines,
          dailyBudgetDelta: delta,
          increasesSpend: false,
          campaignIds: campaigns.map((c) => c.id),
          notes: ['Sletning kan ikke fortrydes. Pause er normalt det sikre valg.'],
        },
        execute: async () => {
          const res = await ctx.backend.deleteCampaigns(ctx.accountId, campaigns.map((c) => c.id));
          fresh(ctx);
          const state = await readBack(() => ctx.backend.listCampaigns(ctx.accountId), checks, failedIndexes(res));
          return report(verify(checks, res, state), { noun: ['kampagne slettet', 'kampagner slettet'] });
        },
      };
    },
  }),

  /* ------------------------------------------------------------------ ad groups */
  defineWrite({
    name: 'create_ad_group',
    kind: 'write',
    description:
      'Create an ad group in a Search campaign. cpcBid is required when the campaign uses Enhanced CPC (without it Microsoft sets the minimum bid and the ad group gets almost no traffic) and is not allowed under automated bid strategies (Microsoft ignores it).',
    schema: z.object({
      campaignId: z.string(),
      name: z.string().min(1).max(256),
      cpcBid: z.number().positive().optional().describe('Default CPC bid – only for Enhanced/Manual CPC campaigns'),
      status: onOff.optional().describe('Default Active (the campaign status still applies)'),
      reason,
    }),
    label: (i) => `Opretter annoncegruppe "${i.name}"`,
    async plan(input, ctx) {
      const c = await getCampaign(ctx, input.campaignId);
      if (c.type === 'PerformanceMax') throw new Error(`"${c.name}" er Performance Max – den bruger asset groups, ikke annoncegrupper.`);
      const ignored = bidsIgnoredReason(c);
      if (ignored && input.cpcBid) throw new Error(`Ikke sendt: ${ignored} Opret annoncegruppen uden cpcBid.`);
      if (!ignored && !input.cpcBid) {
        throw new Error(`"${c.name}" bruger ${bidLabel(c.bidStrategy)}, så annoncegruppen skal have et CPC-bud – uden bud sætter Microsoft minimumsbuddet, og gruppen får stort set ingen trafik. Find et realistisk bud (fx get_keyword_ideas' foreslåede bud eller kampagnens nuværende CPC).`);
      }
      const groups = await getAdGroups(ctx, c.id);
      if (groups.some((g) => g.name.toLowerCase() === input.name.toLowerCase())) throw new Error(`Der findes allerede en annoncegruppe med navnet "${input.name}" i "${c.name}".`);
      // New ad groups in a running campaign start paused when the rule is on.
      const status = ctx.rules.newEntitiesPaused && isActive(c.status) ? 'Paused' : (input.status ?? 'Active');
      const notes = [...(await servingBlockers(ctx, c)), 'Annoncegruppen viser først annoncer, når den har søgeord og en godkendt annonce.'];
      const lines: ChangeLine[] = [
        { entity: 'Annoncegruppe', field: 'kampagne', after: c.name },
        { entity: 'Annoncegruppe', field: 'Navn', after: input.name, edit: { path: ['name'], maxLength: 256 } },
        { entity: 'Annoncegruppe', field: 'status', after: statusLabel(status) },
        ...(input.cpcBid ? [{ entity: 'Annoncegruppe', field: 'CPC-bud', after: input.cpcBid }] : []),
      ];
      return {
        plan: {
          kind: 'create',
          title: 'Ny annoncegruppe',
          reason: input.reason,
          changes: lines,
          dailyBudgetDelta: 0,
          increasesSpend: isActive(c.status) && status === 'Active',
          campaignIds: [c.id],
          newBids: input.cpcBid ? [input.cpcBid] : [],
          notes,
        },
        execute: async () => {
          const res = await ctx.backend.createAdGroup(ctx.accountId, { campaignId: c.id, name: input.name, cpcBid: input.cpcBid, status });
          const id = res.ids?.[0];
          fresh(ctx);
          const find = (s: AdGroup[]) => s.find((g) => g.id === id);
          const checks: LineCheck<AdGroup[]>[] = [
            { line: lines[1]!, index: 0, verify: (s) => (find(s) ? null : 'annoncegruppen blev ikke fundet ved genlæsning') },
            { line: lines[2]!, index: 0, verify: (s) => (statusMatches(status, find(s)?.status) ? null : statusLabel(find(s)?.status)) },
            ...(input.cpcBid ? [{ line: lines[3]!, index: 0, verify: (s: AdGroup[]) => (near(find(s)?.cpcBid, input.cpcBid) ? null : money(find(s)?.cpcBid, ctx.currency)) }] : []),
          ];
          const state = await readBack(() => ctx.backend.listAdGroups(ctx.accountId, c.id), checks, failedIndexes(res));
          return report(verify(checks, res, state), {
            noun: ['felt', 'felter'],
            warnings: notes,
            extra: { adGroupId: id },
            undo: id ? { tool: 'update_ad_groups', input: { campaignId: c.id, changes: [{ adGroupId: id, status: 'Paused' }], reason: 'Fortryd: sæt ny annoncegruppe på pause' } } : undefined,
          });
        },
      };
    },
  }),

  defineWrite({
    name: 'update_ad_groups',
    kind: 'write',
    description:
      'Change status, default CPC bid and/or name of ad groups in one campaign. CPC bids can only be changed when the campaign uses Enhanced/Manual CPC – under automated bid strategies Microsoft ignores them, so the tool refuses and you should change the campaign target or budget instead. Reads the ad groups back and reports only confirmed changes.',
    schema: z.object({
      campaignId: z.string(),
      changes: z
        .array(z.object({ adGroupId: z.string(), status: onOff.optional(), cpcBid: z.number().positive().optional(), name: z.string().min(1).max(256).optional() }))
        .min(1),
      reason,
    }),
    label: (i) => `Ændrer ${i.changes.length} annoncegruppe${i.changes.length === 1 ? '' : 'r'}`,
    async plan(input, ctx) {
      const c = await getCampaign(ctx, input.campaignId);
      const groups = await getAdGroups(ctx, c.id);
      const ignored = bidsIgnoredReason(c);
      if (ignored && input.changes.some((ch) => ch.cpcBid !== undefined)) throw new Error(`Ikke sendt: ${ignored}`);
      const lines: ChangeLine[] = [];
      const checks: LineCheck<AdGroup[]>[] = [];
      const notes: string[] = [];
      const undo = new Map<number, Record<string, unknown>>();
      const bids: number[] = [];
      let increases = false;
      for (const [index, ch] of input.changes.entries()) {
        const g = groups.find((x) => x.id === String(ch.adGroupId));
        if (!g) throw new Error(`Annoncegruppe ${ch.adGroupId} findes ikke i kampagne ${c.id}. Brug list_ad_groups for at finde det rigtige id.`);
        const find = (s: AdGroup[]) => s.find((x) => x.id === g.id);
        const inv: Record<string, unknown> = { adGroupId: g.id };
        if (ch.status && !statusMatches(ch.status, g.status)) {
          if (ch.status === 'Active' && g.status === 'Expired') throw new Error(`"${g.name}" er udløbet (slutdatoen er passeret). Den kan kun aktiveres ved at forlænge slutdatoen (microsoft_ads_api: PUT AdGroups med EndDate).`);
          if (ch.status === 'Active') {
            const blocker = campaignBlocker(c);
            if (blocker) notes.push(`${blocker} Annoncegruppen viser derfor ikke annoncer, selvom den aktiveres.`);
          }
          const line: ChangeLine = { entity: 'Annoncegruppe', entityId: g.id, field: `${g.name} · status`, before: statusLabel(g.status), after: statusLabel(ch.status) };
          lines.push(line);
          checks.push({ line, index, verify: (s) => (statusMatches(ch.status!, find(s)?.status) ? null : statusLabel(find(s)?.status ?? 'findes ikke')) });
          inv.status = isActive(g.status) ? 'Active' : 'Paused';
          if (ch.status === 'Active') increases = true;
        }
        if (ch.cpcBid !== undefined && !near(ch.cpcBid, g.cpcBid)) {
          const line: ChangeLine = { entity: 'Annoncegruppe', entityId: g.id, field: `${g.name} · CPC-bud`, before: g.cpcBid, after: ch.cpcBid };
          lines.push(line);
          checks.push({ line, index, verify: (s) => (near(find(s)?.cpcBid, ch.cpcBid) ? null : money(find(s)?.cpcBid, ctx.currency)) });
          if (g.cpcBid) inv.cpcBid = g.cpcBid;
          bids.push(ch.cpcBid);
          if (!g.cpcBid || ch.cpcBid > g.cpcBid) increases = true;
          if (g.cpcBid && Math.abs(ch.cpcBid - g.cpcBid) / g.cpcBid > 0.5) notes.push(`Buddet på "${g.name}" ændres med over 50 % på én gang – store spring gør det svært at aflæse effekten.`);
        }
        if (ch.name && ch.name !== g.name) {
          if (groups.some((x) => x.id !== g.id && x.name.toLowerCase() === ch.name!.toLowerCase())) throw new Error(`Der findes allerede en annoncegruppe med navnet "${ch.name}" i kampagnen.`);
          const line: ChangeLine = { entity: 'Annoncegruppe', entityId: g.id, field: 'Annoncegruppenavn', before: g.name, after: ch.name, edit: { path: ['changes', index, 'name'], maxLength: 256 } };
          lines.push(line);
          checks.push({ line, index, verify: (s) => (find(s)?.name === ch.name ? null : (find(s)?.name ?? 'findes ikke')) });
          inv.name = g.name;
        }
        if (Object.keys(inv).length > 1) undo.set(index, inv);
      }
      if (!lines.length) throw new Error('Ingen ændringer – værdierne er allerede som foreslået.');
      return {
        plan: {
          kind: 'update',
          title: `Ændring af annoncegrupper i ${c.name}`,
          reason: input.reason,
          changes: lines,
          dailyBudgetDelta: 0,
          increasesSpend: increases,
          campaignIds: [c.id],
          newBids: bids,
          notes: [...new Set(notes)],
          undo: undo.size ? { tool: 'update_ad_groups', input: { campaignId: c.id, changes: [...undo.values()], reason: 'Fortryd tidligere ændring' } } : undefined,
        },
        execute: async () => {
          const res = await ctx.backend.updateAdGroups(ctx.accountId, c.id, input.changes.map((x) => ({ ...x, adGroupId: String(x.adGroupId) })));
          fresh(ctx);
          const state = await readBack(() => ctx.backend.listAdGroups(ctx.accountId, c.id), checks, failedIndexes(res));
          const v = verify(checks, res, state);
          const applied = [...undo.entries()].filter(([i]) => v.appliedIndexes.has(i)).map(([, inv]) => inv);
          return report(v, {
            noun: ['ændring', 'ændringer'],
            warnings: notes,
            undo: applied.length ? { tool: 'update_ad_groups', input: { campaignId: c.id, changes: applied, reason: 'Fortryd tidligere ændring' } } : undefined,
          });
        },
      };
    },
  }),

  /* ------------------------------------------------------------------- keywords */
  defineWrite({
    name: 'add_keywords',
    kind: 'write',
    description:
      'Add keywords to an ad group in a Search campaign. Match types: Exact, Phrase, Broad. A keyword bid is only allowed when the campaign uses Enhanced/Manual CPC (otherwise the ad group/automated bidding is used). The tool refuses duplicates (Microsoft ignores case, accents and punctuation), warns when an existing negative keyword would block a new keyword, and reads the keywords back – new keywords usually wait for editorial review before they serve.',
    schema: z.object({
      campaignId: z.string(),
      adGroupId: z.string(),
      keywords: z
        .array(z.object({ text: z.string().min(1).max(100), matchType: z.enum(['Exact', 'Phrase', 'Broad']), bid: z.number().positive().optional() }))
        .min(1)
        .max(200),
      reason,
    }),
    label: (i) => `Tilføjer ${i.keywords.length} søgeord`,
    async plan(input, ctx) {
      const c = await getCampaign(ctx, input.campaignId);
      if (c.type !== 'Search') throw new Error(`"${c.name}" er en ${c.type}-kampagne – søgeord bruges kun i søgekampagner.`);
      const g = await getAdGroup(ctx, c.id, input.adGroupId);
      const ignored = bidsIgnoredReason(c);
      if (ignored && input.keywords.some((k) => k.bid)) throw new Error(`Ikke sendt: ${ignored} Tilføj søgeordene uden bud.`);
      const tooLong = input.keywords.filter((k) => normalizeKeyword(k.text).split(' ').length > 10);
      if (tooLong.length) throw new Error(`Søgeord må højst have 10 ord: ${tooLong.map((k) => `"${k.text}"`).join(', ')}.`);

      const existing = await getKeywords(ctx, g.id);
      const key = (text: string, match: string) => `${normalizeKeyword(text)}|${match}`;
      const have = new Set(existing.map((k) => key(k.text, k.matchType)));
      const dupes = input.keywords.filter((k) => have.has(key(k.text, k.matchType)));
      if (dupes.length) {
        throw new Error(`Findes allerede i "${g.name}" (Microsoft ser bort fra store/små bogstaver og tegnsætning): ${dupes.map((k) => `"${k.text}" (${MATCH_LABELS[k.matchType]})`).join(', ')}. Fjern dem fra kaldet.`);
      }
      const inRequest = new Set<string>();
      for (const k of input.keywords) {
        const id = key(k.text, k.matchType);
        if (inRequest.has(id)) throw new Error(`"${k.text}" (${MATCH_LABELS[k.matchType]}) står to gange i kaldet.`);
        inRequest.add(id);
      }

      const notes = await servingBlockers(ctx, c, g);
      const negatives = [
        ...(await ctx.backend.listNegativeKeywords(ctx.accountId, 'Campaign', c.id, c.id).catch(() => [])),
        ...(await ctx.backend.listNegativeKeywords(ctx.accountId, 'AdGroup', g.id, c.id).catch(() => [])),
      ];
      for (const k of input.keywords) {
        const block = negatives.find((n) => negativeBlocks(n, k.text));
        if (block) notes.push(`"${k.text}" blokeres af det negative søgeord "${block.text}" (${MATCH_LABELS[block.matchType]}) og vil ikke få visninger, før det negative fjernes.`);
      }
      const lines: ChangeLine[] = input.keywords.map((k, i) => ({
        entity: 'Søgeord',
        field: `Søgeord · ${MATCH_LABELS[k.matchType]}${k.bid ? ` · bud ${k.bid}` : ''}`,
        after: k.text,
        edit: { path: ['keywords', i, 'text'], maxLength: 100 },
      }));
      return {
        plan: {
          kind: 'create',
          title: `Nye søgeord i ${g.name}`,
          reason: input.reason,
          changes: lines,
          dailyBudgetDelta: 0,
          increasesSpend: isActive(c.status) && isActive(g.status),
          campaignIds: [c.id],
          newBids: input.keywords.flatMap((k) => (k.bid ? [k.bid] : [])),
          notes,
        },
        execute: async () => {
          const res = await ctx.backend.addKeywords(ctx.accountId, g.id, input.keywords);
          fresh(ctx);
          const find = (s: Keyword[], i: number) => s.find((x) => key(x.text, x.matchType) === key(input.keywords[i]!.text, input.keywords[i]!.matchType));
          const checks: LineCheck<Keyword[]>[] = input.keywords.map((_, index) => ({ line: lines[index]!, index, verify: (s) => (find(s, index) ? null : 'søgeordet blev ikke fundet ved genlæsning') }));
          const state = await readBack(() => ctx.backend.listKeywords(ctx.accountId, g.id), checks, failedIndexes(res));
          const v = verify(checks, res, state);
          const created = input.keywords.map((_, i) => (v.appliedIndexes.has(i) ? find(state, i) : undefined)).filter((k): k is Keyword => !!k);
          const editorial = created.flatMap((k) => editorialNote(k.editorialStatus, `Søgeordet "${k.text}"`) ?? []);
          const ids = created.map((k) => k.id);
          return report(v, {
            noun: 'søgeord',
            warnings: [...notes, ...editorial],
            extra: { keywordIds: ids, editorialStatus: Object.fromEntries(created.map((k) => [k.text, k.editorialStatus ?? 'ukendt'])) },
            undo: ids.length ? { tool: 'update_keywords', input: { campaignId: c.id, adGroupId: g.id, changes: ids.map((id) => ({ keywordId: id, status: 'Paused' })), reason: 'Fortryd: sæt nye søgeord på pause' } } : undefined,
          });
        },
      };
    },
  }),

  defineWrite({
    name: 'update_keywords',
    kind: 'write',
    description:
      'Change status (Active/Paused) and/or bid of keywords in one ad group. Bids can only be changed when the campaign uses Enhanced/Manual CPC – under automated bid strategies Microsoft ignores keyword bids, so the tool refuses. Reads the keywords back and reports only confirmed changes (a keyword under editorial review shows as Inactive).',
    schema: z.object({
      campaignId: z.string(),
      adGroupId: z.string(),
      changes: z.array(z.object({ keywordId: z.string(), status: onOff.optional(), bid: z.number().positive().optional() })).min(1),
      reason,
    }),
    label: (i) => `Ændrer ${i.changes.length} søgeord`,
    async plan(input, ctx) {
      const c = await getCampaign(ctx, input.campaignId);
      const g = await getAdGroup(ctx, c.id, input.adGroupId);
      const ignored = bidsIgnoredReason(c);
      if (ignored && input.changes.some((ch) => ch.bid !== undefined)) throw new Error(`Ikke sendt: ${ignored}`);
      const keywords = await getKeywords(ctx, g.id);
      const lines: ChangeLine[] = [];
      const checks: LineCheck<Keyword[]>[] = [];
      const notes: string[] = [];
      const undo = new Map<number, Record<string, unknown>>();
      const bids: number[] = [];
      let increases = false;
      let activates = false;
      for (const [index, ch] of input.changes.entries()) {
        const k = keywords.find((x) => x.id === String(ch.keywordId));
        if (!k) throw new Error(`Søgeord ${ch.keywordId} findes ikke i annoncegruppe ${g.id}. Brug list_keywords for at finde det rigtige id.`);
        const find = (s: Keyword[]) => s.find((x) => x.id === k.id);
        const inv: Record<string, unknown> = { keywordId: k.id };
        const label = `${k.text} (${MATCH_LABELS[k.matchType] ?? k.matchType})`;
        if (ch.status && !statusMatches(ch.status, k.status)) {
          if (ch.status === 'Active') {
            activates = true;
            const ed = editorialNote(k.editorialStatus, `"${k.text}"`);
            if (ed) notes.push(ed);
          }
          const line: ChangeLine = { entity: 'Søgeord', entityId: k.id, field: `${label} · status`, before: statusLabel(k.status), after: statusLabel(ch.status) };
          lines.push(line);
          checks.push({
            line,
            index,
            verify: (s) => {
              const now = find(s);
              if (statusMatches(ch.status!, now?.status)) return null;
              return now?.status === 'Inactive' ? `Inaktiv (redaktionel status: ${now.editorialStatus ?? 'ukendt'})` : statusLabel(now?.status ?? 'findes ikke');
            },
          });
          inv.status = isActive(k.status) ? 'Active' : 'Paused';
          if (ch.status === 'Active') increases = true;
        }
        if (ch.bid !== undefined && !near(ch.bid, k.bid ?? g.cpcBid)) {
          const prev = k.bid ?? g.cpcBid;
          const line: ChangeLine = { entity: 'Søgeord', entityId: k.id, field: `${label} · bud`, before: prev, after: ch.bid };
          lines.push(line);
          checks.push({ line, index, verify: (s) => (near(find(s)?.bid, ch.bid) ? null : money(find(s)?.bid ?? null, ctx.currency)) });
          if (prev) inv.bid = prev;
          bids.push(ch.bid);
          if (!prev || ch.bid > prev) increases = true;
          if (prev && Math.abs(ch.bid - prev) / prev > 0.5) notes.push(`Buddet på "${k.text}" ændres med over 50 % på én gang – store spring gør det svært at aflæse effekten.`);
        }
        if (Object.keys(inv).length > 1) undo.set(index, inv);
      }
      if (!lines.length) throw new Error('Ingen ændringer – værdierne er allerede som foreslået.');
      if (activates) notes.push(...(await servingBlockers(ctx, c, g)));
      return {
        plan: {
          kind: 'update',
          title: `Søgeord i ${g.name}`,
          reason: input.reason,
          changes: lines,
          dailyBudgetDelta: 0,
          increasesSpend: increases,
          campaignIds: [c.id],
          newBids: bids,
          notes: [...new Set(notes)],
          undo: undo.size ? { tool: 'update_keywords', input: { campaignId: c.id, adGroupId: g.id, changes: [...undo.values()], reason: 'Fortryd tidligere ændring' } } : undefined,
        },
        execute: async () => {
          const res = await ctx.backend.updateKeywords(ctx.accountId, g.id, input.changes.map((x) => ({ ...x, keywordId: String(x.keywordId) })));
          fresh(ctx);
          const state = await readBack(() => ctx.backend.listKeywords(ctx.accountId, g.id), checks, failedIndexes(res));
          const v = verify(checks, res, state);
          const applied = [...undo.entries()].filter(([i]) => v.appliedIndexes.has(i)).map(([, inv]) => inv);
          return report(v, {
            noun: ['søgeordsændring', 'søgeordsændringer'],
            warnings: notes,
            undo: applied.length ? { tool: 'update_keywords', input: { campaignId: c.id, adGroupId: g.id, changes: applied, reason: 'Fortryd tidligere ændring' } } : undefined,
          });
        },
      };
    },
  }),

  defineWrite({
    name: 'delete_keywords',
    kind: 'write',
    description: 'Delete keywords from an ad group (their history stays in reports). Prefer pausing (update_keywords) unless deletion is requested.',
    schema: z.object({ campaignId: z.string(), adGroupId: z.string(), keywordIds: z.array(z.string()).min(1), reason }),
    label: (i) => `Sletter ${i.keywordIds.length} søgeord`,
    async plan(input, ctx) {
      const c = await getCampaign(ctx, input.campaignId);
      const g = await getAdGroup(ctx, c.id, input.adGroupId);
      const keywords = await getKeywords(ctx, g.id);
      const targets = [...new Set(input.keywordIds.map(String))].map((id) => {
        const k = keywords.find((x) => x.id === id);
        if (!k) throw new Error(`Søgeord ${id} findes ikke i annoncegruppe ${g.id}.`);
        return k;
      });
      const lines: ChangeLine[] = targets.map((k) => ({ entity: 'Søgeord', entityId: k.id, field: `${k.text} (${MATCH_LABELS[k.matchType] ?? k.matchType})`, before: statusLabel(k.status), after: 'Slettet' }));
      const checks: LineCheck<Keyword[]>[] = targets.map((k, index) => ({ line: lines[index]!, index, verify: (s) => (s.some((x) => x.id === k.id) ? 'findes stadig' : null) }));
      return {
        plan: {
          kind: 'delete',
          title: `Sletning af søgeord i ${g.name}`,
          reason: input.reason,
          changes: lines,
          dailyBudgetDelta: 0,
          increasesSpend: false,
          campaignIds: [c.id],
        },
        execute: async () => {
          const res = await ctx.backend.deleteKeywords(ctx.accountId, g.id, targets.map((k) => k.id));
          fresh(ctx);
          const state = await readBack(() => ctx.backend.listKeywords(ctx.accountId, g.id), checks, failedIndexes(res));
          return report(verify(checks, res, state), { noun: 'søgeord slettet' });
        },
      };
    },
  }),

  defineWrite({
    name: 'add_negative_keywords',
    kind: 'write',
    description:
      'Add negative keywords to a campaign (omit adGroupId) or an ad group. Match types: Exact or Phrase. Use for search terms that waste spend. The tool refuses negatives that already exist, and when a negative would block one of your own active keywords it lists them and always asks the user first. Reads the negatives back afterwards.',
    schema: z.object({
      campaignId: z.string(),
      adGroupId: z.string().optional(),
      keywords: z.array(z.object({ text: z.string().min(1).max(100), matchType: z.enum(['Exact', 'Phrase']) })).min(1).max(500),
      reason,
    }),
    label: (i) => `Tilføjer ${i.keywords.length} negative søgeord`,
    async plan(input, ctx) {
      const c = await getCampaign(ctx, input.campaignId);
      const g = input.adGroupId ? await getAdGroup(ctx, c.id, input.adGroupId) : null;
      const target = g ? `annoncegruppen ${g.name}` : `kampagnen ${c.name}`;
      const entityType = g ? 'AdGroup' : 'Campaign';
      const entityId = g ? g.id : c.id;
      const key = (n: NegativeKeyword) => `${normalizeKeyword(n.text)}|${n.matchType}`;

      const existing = await ctx.backend.listNegativeKeywords(ctx.accountId, entityType, entityId, c.id);
      const have = new Set(existing.map(key));
      const dupes = input.keywords.filter((k) => have.has(key(k)));
      if (dupes.length) throw new Error(`Findes allerede som negative søgeord på ${target}: ${dupes.map((k) => `"${k.text}"`).join(', ')}. Fjern dem fra kaldet.`);
      const inRequest = new Set<string>();
      for (const k of input.keywords) {
        if (inRequest.has(key(k))) throw new Error(`"${k.text}" står to gange i kaldet.`);
        inRequest.add(key(k));
      }

      // Would any of them stop our own active keywords from showing?
      const groups = g ? [g] : (await getAdGroups(ctx, c.id)).filter((x) => isActive(x.status));
      const positives = (await Promise.all(groups.map((x) => getKeywords(ctx, x.id)))).flat().filter((k) => isActive(k.status));
      const conflicts: string[] = [];
      for (const n of input.keywords) {
        const hit = positives.filter((k) => negativeBlocks(n, k.text));
        if (hit.length) conflicts.push(`"${n.text}" blokerer jeres aktive søgeord ${hit.slice(0, 4).map((k) => `"${k.text}"`).join(', ')}${hit.length > 4 ? ` og ${hit.length - 4} flere` : ''}`);
      }
      const lines: ChangeLine[] = input.keywords.map((k, i) => ({
        entity: 'Negativt søgeord',
        field: `Negativt søgeord · ${MATCH_LABELS[k.matchType]}`,
        after: k.text,
        edit: { path: ['keywords', i, 'text'], maxLength: 100 },
      }));
      const checks: LineCheck<NegativeKeyword[]>[] = input.keywords.map((k, index) => ({
        line: lines[index]!,
        index,
        verify: (s) => (s.some((x) => key(x) === key(k)) ? null : 'blev ikke fundet ved genlæsning'),
      }));
      return {
        plan: {
          kind: 'update',
          title: `Negative søgeord på ${target}`,
          reason: input.reason,
          changes: lines,
          dailyBudgetDelta: 0,
          increasesSpend: false,
          campaignIds: [c.id],
          notes: conflicts,
          approvalReasons: conflicts.length ? ['Nogle af de negative søgeord vil stoppe jeres egne aktive søgeord.'] : [],
        },
        execute: async () => {
          const res = await ctx.backend.addNegativeKeywords(ctx.accountId, entityType, entityId, input.keywords);
          fresh(ctx);
          const state = await readBack(() => ctx.backend.listNegativeKeywords(ctx.accountId, entityType, entityId, c.id), checks, failedIndexes(res));
          return report(verify(checks, res, state), { noun: 'negative søgeord', warnings: conflicts });
        },
      };
    },
  }),

  /* ------------------------------------------------------------------------ ads */
  defineWrite({
    name: 'propose_negative_keywords',
    kind: 'write',
    description: `Propose negative keywords for ONE campaign, found in its search terms, as a table the user ticks on/off (all ticked to start with) – they can also add their own. Use this – not add_negative_keywords – whenever you suggest negatives from search terms. Never mix campaigns in one table: if the user didn't name a campaign, ask which one (or suggest the one with the most wasted spend) before proposing. Get the candidates from run_report kind "searchterm" limited to that campaign (campaignIds); typical negatives: spend or many clicks without conversions, irrelevant intent (jobs, free, used, DIY, competitors, other products). Never propose a term that converts well or matches a product the business sells.`,
    schema: z.object({
      campaignId: z.string().describe('The one campaign all the negatives are for.'),
      candidates: z
        .array(
          z.object({
            text: z.string().min(1).max(100).describe('The negative keyword, usually the search term or the unwanted word in it.'),
            matchType: z.enum(['Exact', 'Phrase']).describe('Exact blocks only this search; Phrase blocks every search containing it.'),
            adGroupId: z.string().optional().describe('An ad group in the campaign – omit to add it on the campaign (blocks all its ad groups).'),
            searchTerm: z.string().optional().describe('The search term it comes from, if different from text.'),
            clicks: z.number().optional(),
            spend: z.number().optional(),
            conversions: z.number().optional(),
            why: z.string().max(120).describe('Short Danish reason shown in the table, e.g. "Jobsøgning – ikke købsintention".'),
          }),
        )
        .min(1)
        .max(200),
      reason,
    }),
    label: (i) => `Foreslår ${i.candidates.length} negative søgeord`,
    async plan(input, ctx) {
      const c = await getCampaign(ctx, input.campaignId);
      const groups = new Map<string, string>();
      for (const k of input.candidates) {
        if (k.adGroupId && !groups.has(k.adGroupId)) groups.set(k.adGroupId, (await getAdGroup(ctx, c.id, k.adGroupId)).name);
      }
      const where = (k: (typeof input.candidates)[number]) => (k.adGroupId ? groups.get(k.adGroupId)! : 'Hele kampagnen');
      const key = (n: { text: string; matchType: string }) => `${normalizeKeyword(n.text)}|${n.matchType}`;
      const targetOf = (k: (typeof input.candidates)[number]) => k.adGroupId ?? '';
      const readNegatives = (target: string) => ctx.backend.listNegativeKeywords(ctx.accountId, target ? 'AdGroup' : 'Campaign', target || c.id, c.id);

      // What is already there, and which of our own active keywords each candidate would stop.
      const targets = [...new Set(input.candidates.map(targetOf))];
      const existing = new Map(await Promise.all(targets.map(async (t) => [t, new Set((await readNegatives(t)).map(key))] as const)));
      const already = input.candidates.filter((k) => existing.get(targetOf(k))?.has(key(k)));
      const activeGroups = (await getAdGroups(ctx, c.id)).filter((g) => isActive(g.status));
      const positives = (await Promise.all(activeGroups.map((g) => getKeywords(ctx, g.id).then((list) => list.map((k) => ({ ...k, adGroupId: g.id }))))))
        .flat()
        .filter((k) => isActive(k.status));
      const conflicts: string[] = [];
      for (const n of input.candidates) {
        const hit = positives.filter((k) => (!n.adGroupId || k.adGroupId === n.adGroupId) && negativeBlocks(n, k.text));
        if (hit.length) conflicts.push(`"${n.text}" vil stoppe jeres aktive søgeord ${hit.slice(0, 4).map((k) => `"${k.text}"`).join(', ')}${hit.length > 4 ? ` og ${hit.length - 4} flere` : ''} – fjern fluebenet, medmindre det er meningen.`);
      }
      const notes = [...conflicts];
      if (already.length) notes.push(`Findes allerede som negative og springes over: ${already.map((k) => `"${k.text}"`).join(', ')}.`);
      const lines: ChangeLine[] = input.candidates.map((k) => ({
        entity: 'Negativt søgeord',
        entityId: k.adGroupId ?? c.id,
        field: `Negativt søgeord · ${MATCH_LABELS[k.matchType]} · ${c.name}${k.adGroupId ? ` › ${where(k)}` : ''}`,
        after: k.text,
        cells: {
          // Microsoft's own names, as in the Microsoft Advertising interface.
          matchType: k.matchType,
          target: where(k),
          searchTerm: k.searchTerm && k.searchTerm !== k.text ? k.searchTerm : null,
          clicks: k.clicks ?? null,
          spend: k.spend ?? null,
          conversions: k.conversions ?? null,
          why: k.why,
        },
      }));
      return {
        plan: {
          kind: 'update',
          title: `Negative søgeord · ${c.name}`,
          reason: input.reason,
          changes: lines,
          dailyBudgetDelta: 0,
          increasesSpend: false,
          campaignIds: [c.id],
          notes,
          pick: {
            path: ['candidates'],
            tag: 'matchType',
            note: 'why',
            columns: [
              { key: 'target', label: 'Annoncegruppe' },
              { key: 'searchTerm', label: 'Fra søgeterm' },
              { key: 'clicks', label: 'Klik', format: 'number' },
              { key: 'spend', label: 'Forbrug', format: 'money' },
              { key: 'conversions', label: 'Konv.', format: 'number' },
            ],
            add: { label: 'Tilføj manuelle negative søgeord', base: { why: 'Tilføjet manuelt' }, note: 'Tilføjet manuelt', cells: { target: 'Hele kampagnen' } },
            approveLabel: 'Tilføj {n} negative søgeord',
          },
        },
        execute: async () => {
          // One call for the campaign and one per ad group; each candidate keeps its own position.
          const v = { applied: [] as ChangeLine[], appliedIndexes: new Set<number>(), confirmed: [] as string[], rejected: [] as string[], notApplied: [] as string[] };
          const skipped: string[] = [];
          for (const target of targets) {
            const items = input.candidates.map((k, index) => ({ k, index })).filter((x) => targetOf(x.k) === target);
            const before = new Set((await readNegatives(target)).map(key));
            const send = items.filter((x) => !before.has(key(x.k)));
            skipped.push(...items.filter((x) => before.has(key(x.k))).map((x) => `"${x.k.text}" (${where(x.k)})`));
            if (!send.length) continue;
            let failed = new Map<number, string>();
            try {
              const res = await ctx.backend.addNegativeKeywords(ctx.accountId, target ? 'AdGroup' : 'Campaign', target || c.id, send.map((x) => ({ text: x.k.text, matchType: x.k.matchType })));
              failed = new Map((res.failed ?? []).filter((f) => f.index !== null).map((f) => [send[f.index!]!.index, f.message]));
            } catch (e) {
              for (const x of send) failed.set(x.index, e instanceof Error ? e.message : String(e));
            }
            const after = new Set((await readNegatives(target)).map(key));
            for (const x of send) {
              const label = `${x.k.text} (${MATCH_LABELS[x.k.matchType]}, ${where(x.k)})`;
              if (after.has(key(x.k))) {
                v.confirmed.push(label);
                v.applied.push(lines[x.index]!);
                v.appliedIndexes.add(x.index);
              } else if (failed.has(x.index)) v.rejected.push(`${label} – ${failed.get(x.index)}`);
              else v.notApplied.push(`${label} – blev ikke fundet ved genlæsning`);
            }
          }
          fresh(ctx);
          if (!v.confirmed.length && skipped.length && !v.rejected.length && !v.notApplied.length) {
            return { result: { outcome: 'nothing_to_do', alreadyNegative: skipped }, summary: 'Alle fandtes allerede som negative søgeord' };
          }
          return report(v, { noun: 'negative søgeord', warnings: [...conflicts, ...(skipped.length ? [`Fandtes allerede og blev sprunget over: ${skipped.join(', ')}.`] : [])], extra: { campaign: c.name } });
        },
      };
    },
  }),

  defineWrite({
    name: 'create_responsive_search_ad',
    kind: 'write',
    description:
      'Create a responsive search ad in a Search campaign. 3–15 unique headlines (max 30 characters each), 2–4 unique descriptions (max 90 characters each), final URL (https), optional display paths (max 15 characters each, no spaces; path2 needs path1). Write in the language of the campaign (Danish by default) and follow the tone of voice from the business profile. New ads go through Microsoft editorial review before they serve – the tool reads the ad back and reports its editorial status.',
    schema: z.object({
      campaignId: z.string(),
      adGroupId: z.string(),
      headlines: z.array(adText(30, 'Overskrift')).min(3).max(15),
      descriptions: z.array(adText(90, 'Beskrivelse')).min(2).max(4),
      finalUrl: z.string().url(),
      path1: z.string().max(1000).refine((t) => finalLength(t) <= 15, 'Visningssti må højst være 15 tegn').optional(),
      path2: z.string().max(1000).refine((t) => finalLength(t) <= 15, 'Visningssti må højst være 15 tegn').optional(),
      reason,
    }),
    label: () => 'Opretter responsiv søgeannonce',
    async plan(input, ctx) {
      const c = await getCampaign(ctx, input.campaignId);
      if (c.type !== 'Search') throw new Error(`"${c.name}" er en ${c.type}-kampagne – responsive søgeannoncer bruges kun i søgekampagner.`);
      const g = await getAdGroup(ctx, c.id, input.adGroupId);
      const dup = (list: string[]) => list.filter((x, i) => list.findIndex((y) => y.toLowerCase() === x.toLowerCase()) !== i);
      if (dup(input.headlines).length) throw new Error(`Overskrifterne skal være forskellige – disse går igen: ${[...new Set(dup(input.headlines))].map((h) => `"${h}"`).join(', ')}.`);
      if (dup(input.descriptions).length) throw new Error('Beskrivelserne skal være forskellige.');
      if (!/^https?:\/\//i.test(input.finalUrl)) throw new Error('Slut-URL skal starte med https://.');
      if (input.path2 && !input.path1) throw new Error('Visningssti 2 kræver visningssti 1.');
      for (const p of [input.path1, input.path2]) if (p && p.includes('/')) throw new Error(`Visningsstien "${p}" må ikke indeholde skråstreg – brug path1 og path2 til hver sin del.`);
      const notes = await servingBlockers(ctx, c, g);
      if (input.headlines.some((h) => h.includes('!'))) notes.push('Microsofts redaktionelle regler tillader ikke udråbstegn i overskrifter – overskrifter med "!" risikerer at blive afvist.');
      if (input.headlines.length < 8) notes.push(`Kun ${input.headlines.length} overskrifter – med 8–15 forskellige har Microsoft flere kombinationer at teste.`);
      const host = (() => {
        try {
          return new URL(input.finalUrl).hostname.replace(/^www\./, '');
        } catch {
          return '';
        }
      })();
      const otherHosts = new Set(
        (await ctx.backend.listAds(ctx.accountId, g.id).catch(() => [])).flatMap((a) => a.finalUrls.map((u) => {
          try {
            return new URL(u).hostname.replace(/^www\./, '');
          } catch {
            return '';
          }
        })),
      );
      otherHosts.delete('');
      if (host && otherHosts.size && !otherHosts.has(host)) notes.push(`Slut-URL'en peger på ${host}, men de andre annoncer i gruppen bruger ${[...otherHosts].join(', ')}. Tjek, at det er den rigtige side.`);
      const lines: ChangeLine[] = [
        ...input.headlines.map((h, i) => ({ entity: 'Annonce', field: `Overskrift ${i + 1}`, after: h, edit: { path: ['headlines', i], maxLength: h.includes('{') ? undefined : 30 } })),
        ...input.descriptions.map((d, i) => ({ entity: 'Annonce', field: `Beskrivelse ${i + 1}`, after: d, edit: { path: ['descriptions', i], maxLength: d.includes('{') ? undefined : 90 } })),
        { entity: 'Annonce', field: 'Slut-URL', after: input.finalUrl },
        ...(input.path1 ? [{ entity: 'Annonce', field: 'Visningssti', after: [input.path1, input.path2].filter(Boolean).join('/') }] : []),
      ];
      return {
        plan: {
          kind: 'create',
          title: `Ny annonce i ${g.name}`,
          reason: input.reason,
          changes: lines,
          dailyBudgetDelta: 0,
          increasesSpend: false,
          campaignIds: [c.id],
          notes,
        },
        execute: async () => {
          const res = await ctx.backend.createResponsiveSearchAd(ctx.accountId, g.id, {
            headlines: input.headlines,
            descriptions: input.descriptions,
            finalUrl: input.finalUrl,
            path1: input.path1,
            path2: input.path2,
          });
          const id = res.ids?.[0];
          fresh(ctx);
          const all = await ctx.backend.listAds(ctx.accountId, g.id);
          const ad = all.find((a) => a.id === id);
          if (!ad) throw new Error(`Microsoft svarede uden fejl, men annoncen${id ? ` (id ${id})` : ''} blev ikke fundet ved genlæsning. Tjek annoncegruppen i Microsoft Advertising.`);
          const missing = input.headlines.filter((h) => !ad.headlines.includes(h));
          const editorial = editorialNote(ad.editorialStatus, 'Annoncen');
          return {
            result: {
              outcome: 'confirmed',
              verifiedByReadBack: true,
              adId: ad.id,
              status: ad.status,
              editorialStatus: ad.editorialStatus ?? 'ukendt',
              ...(missing.length ? { headlinesNotSaved: missing } : {}),
              warnings: [...notes, ...(editorial ? [editorial] : [])],
              instruction: 'The ad exists in Microsoft Advertising. Tell the user its editorial status – an ad under review (Inactive) does not serve yet.',
            },
            summary: `Annonce oprettet og bekræftet${editorial ? ' · afventer/afvist redaktionelt' : ''}`,
            undo: { tool: 'update_ads', input: { campaignId: c.id, adGroupId: g.id, changes: [{ adId: ad.id, status: 'Paused' }], reason: 'Fortryd: sæt annoncen på pause' } },
          };
        },
      };
    },
  }),

  defineWrite({
    name: 'update_ads',
    kind: 'write',
    description: 'Pause or activate ads in one ad group. Reads the ads back afterwards; an ad that is disapproved or under editorial review does not serve even when active.',
    schema: z.object({
      campaignId: z.string(),
      adGroupId: z.string(),
      changes: z.array(z.object({ adId: z.string(), status: onOff })).min(1),
      reason,
    }),
    label: (i) => `Ændrer ${i.changes.length} annonce${i.changes.length === 1 ? '' : 'r'}`,
    async plan(input, ctx) {
      const c = await getCampaign(ctx, input.campaignId);
      const g = await getAdGroup(ctx, c.id, input.adGroupId);
      const ads = await ctx.backend.listAds(ctx.accountId, g.id);
      const lines: ChangeLine[] = [];
      const checks: LineCheck<typeof ads>[] = [];
      const notes: string[] = [];
      const undo = new Map<number, Record<string, unknown>>();
      for (const [index, ch] of input.changes.entries()) {
        const a = ads.find((x) => x.id === String(ch.adId));
        if (!a) throw new Error(`Annonce ${ch.adId} findes ikke i annoncegruppe ${g.id}. Brug list_ads for at finde det rigtige id.`);
        if (statusMatches(ch.status, a.status)) continue;
        const name = a.headlines.slice(0, 2).join(' | ') || a.id;
        if (ch.status === 'Active') {
          const ed = editorialNote(a.editorialStatus, `Annoncen "${name}"`);
          if (ed) notes.push(ed);
        }
        const line: ChangeLine = { entity: 'Annonce', entityId: a.id, field: name, before: statusLabel(a.status), after: statusLabel(ch.status) };
        lines.push(line);
        checks.push({
          line,
          index,
          verify: (s) => {
            const now = s.find((x) => x.id === a.id);
            if (statusMatches(ch.status, now?.status)) return null;
            return now?.status === 'Inactive' ? `Inaktiv (redaktionel status: ${now.editorialStatus ?? 'ukendt'})` : statusLabel(now?.status ?? 'findes ikke');
          },
        });
        undo.set(index, { adId: a.id, status: isActive(a.status) ? 'Active' : 'Paused' });
      }
      if (!lines.length) throw new Error('Ingen ændringer – annoncerne har allerede den status.');
      if (input.changes.some((ch) => ch.status === 'Active')) notes.push(...(await servingBlockers(ctx, c, g)));
      const remainingActive = ads.filter((a) => {
        const ch = input.changes.find((x) => String(x.adId) === a.id);
        return ch ? ch.status === 'Active' : isActive(a.status);
      });
      if (!remainingActive.length) notes.push(`Efter ændringen har "${g.name}" ingen aktive annoncer – annoncegruppen viser så slet ingenting.`);
      return {
        plan: {
          kind: 'update',
          title: `Annoncer i ${g.name}`,
          reason: input.reason,
          changes: lines,
          dailyBudgetDelta: 0,
          increasesSpend: false,
          campaignIds: [c.id],
          notes: [...new Set(notes)],
          undo: { tool: 'update_ads', input: { campaignId: c.id, adGroupId: g.id, changes: [...undo.values()], reason: 'Fortryd tidligere ændring' } },
        },
        execute: async () => {
          const res = await ctx.backend.updateAds(ctx.accountId, g.id, input.changes.map((x) => ({ ...x, adId: String(x.adId) })));
          fresh(ctx);
          const state = await readBack(() => ctx.backend.listAds(ctx.accountId, g.id), checks, failedIndexes(res));
          const v = verify(checks, res, state);
          const applied = [...undo.entries()].filter(([i]) => v.appliedIndexes.has(i)).map(([, inv]) => inv);
          return report(v, {
            noun: ['annonce opdateret', 'annoncer opdateret'],
            warnings: notes,
            undo: applied.length ? { tool: 'update_ads', input: { campaignId: c.id, adGroupId: g.id, changes: applied, reason: 'Fortryd tidligere ændring' } } : undefined,
          });
        },
      };
    },
  }),

  /* ------------------------------------------------------------------------ raw */
  defineWrite({
    name: 'microsoft_ads_api',
    kind: 'write',
    description: `Call any Microsoft Advertising REST API v13 operation directly – for everything the other tools do not cover (ad extensions/assets such as sitelinks and callouts, location and device targeting criteria and bid adjustments, audiences, conversion goals, UET tags, shared budgets and negative keyword lists, labels, Bulk …). Use the dedicated tools for campaigns, ad groups, keywords, negatives and ads – they check feasibility and verify the result.
ALWAYS look the operation up with find_api_operation first and use exactly the method and path it returns – paths do not always follow a pattern (e.g. GetNegativeKeywordsByEntityIds is POST 'NegativeKeywords/QueryByEntityIds'), and calls to operations that do not exist are refused. The JSON body uses the request element names it lists. Polymorphic objects need a "Type" field with the class name (e.g. BiddingScheme {"Type": "MaxConversionsBiddingScheme"}; ads use the ad type, e.g. "ResponsiveSearch"). Flag combinations are comma-separated. CustomerId and CustomerAccountId headers are added automatically.
Reads (POST to …/Query…, …/Search, or GET) run immediately; every other call needs the user's approval. Writes are NOT verified automatically: after a write, read the entity back with a Query call before telling the user it is done. Account, user and billing administration (customer/billing services) is not allowed. Live accounts only.`,
    schema: z.object({
      service: z.enum(['campaign', 'reporting', 'customer', 'adinsight', 'bulk', 'billing']).describe('campaign = CampaignManagement, customer = CustomerManagement, billing = CustomerBilling'),
      path: z.string().describe("Operation path after /v13/, e.g. 'AdExtensions/QueryByIds' or 'CampaignCriterions'"),
      method: z.enum(['GET', 'POST', 'PUT', 'DELETE']),
      body: z.record(z.string(), z.unknown()).optional(),
      reason,
    }),
    label: (i) => `Microsoft Ads API: ${i.method} ${i.path}`,
    async plan(input, ctx) {
      const path = input.path.replace(/^\/+/, '');
      if (!/^[A-Za-z][A-Za-z0-9]*(\/[A-Za-z][A-Za-z0-9]*)*$/.test(path)) throw new Error(`Ugyldig sti "${input.path}" – brug fx 'AdExtensions/QueryByIds'.`);
      const op = findOperation(input.service, input.method, path);
      if (!op) {
        const samePath = searchOperations(path.replace(/\//g, ' '), 3);
        const hint = samePath.map((o) => `${o.method} ${o.service}/${o.path} (${o.op})`).join('; ');
        throw new Error(`Microsoft Advertising har ingen operation ${input.method} ${input.service}/${path} – kaldet ville fejle. ${hint ? `Mente du: ${hint}? ` : ''}Slå den rigtige operation op med find_api_operation.`);
      }
      const readOnly = isReadOperation(op);
      const missing = missingRequired(op, input.body);
      const run = async () => {
        const result = await ctx.backend.rawRequest(ctx.accountId, input.service as MsService, op.path, op.method as 'GET' | 'POST' | 'PUT' | 'DELETE', input.body).catch((e: unknown) => {
          if (missing.length && e instanceof Error) e.message += ` (Dokumentationen for ${op.op} kræver også: ${missing.join(', ')}.)`;
          throw e;
        });
        if (!readOnly) fresh(ctx);
        const text = JSON.stringify(result ?? null);
        const body = text.length > 60_000 ? { truncated: true, json: text.slice(0, 60_000) } : result;
        if (readOnly) return { result: body, summary: `Svar modtaget (${Math.round(text.length / 1024)} kB)` };
        const errors = rawErrors(result);
        if (errors.allFailed) throw new Error(`Microsoft Advertising afviste kaldet – intet blev ændret: ${errors.messages.join(' · ') || 'alle id’er i svaret er tomme'}`);
        return {
          result: {
            outcome: errors.messages.length ? 'partially_applied' : 'sent_unverified',
            ...(errors.messages.length ? { errors: errors.messages } : {}),
            response: body,
            instruction: 'Microsoft accepted the request, but raw writes are not verified. Read the entity back (a …/Query… call) before you tell the user the change is in place; some settings are accepted without error but ignored.',
          },
          summary: errors.messages.length ? `Sendt – Microsoft meldte ${errors.messages.length} fejl` : 'Sendt uden fejl (ikke verificeret endnu)',
        };
      };
      if (readOnly) return { plan: null, execute: run };
      if (input.service === 'customer' || input.service === 'billing') {
        throw new Error('Ændringer af konti, brugere og fakturering må ikke laves fra chatten – gør det i Microsoft Advertising.');
      }
      const amounts = collectAmounts(input.body);
      const campaignIds = collectCampaignIds(input.body);
      const notes: string[] = [`Operation: ${op.op}${op.summary ? ` – ${op.summary}` : ''}`];
      if (missing.length) notes.push(`Dokumentationen kræver disse felter, som mangler i kaldet: ${missing.join(', ')}.`);
      if (ctx.rules.protectedCampaignIds.length && !campaignIds.length) notes.push('Kaldet nævner ingen kampagne-id, så det kan ikke afgøres automatisk, om det rammer en beskyttet kampagne – tjek det selv.');
      return {
        plan: {
          kind: 'raw',
          title: `${input.method} ${input.service}/${path}`,
          reason: input.reason,
          changes: [{ entity: 'API-kald', field: `${input.method} ${path}`, after: JSON.stringify(input.body ?? {}).slice(0, 600) }],
          dailyBudgetDelta: 0,
          increasesSpend: true,
          campaignIds,
          newDailyBudgets: amounts.budgets,
          newBids: amounts.bids,
          notes,
        },
        execute: run,
      };
    },
  }),
];

/** Errors in a raw write response, and whether nothing at all went through. */
export function rawErrors(result: unknown): { messages: string[]; allFailed: boolean } {
  const r = (result ?? {}) as Record<string, unknown>;
  const list = (v: unknown) => (Array.isArray(v) ? v : v && typeof v === 'object' ? (Object.values(v)[0] as unknown[]) : []) ?? [];
  const errors = [...list(r.PartialErrors), ...list(r.NestedPartialErrors)].filter(Boolean) as Record<string, unknown>[];
  const messages = errors.map((e) => `${e.Index !== undefined && e.Index !== null ? `#${Number(e.Index) + 1}: ` : ''}${String(e.Message ?? e.ErrorCode ?? 'Ukendt fejl')}`);
  const idLists = Object.entries(r).filter(([k, v]) => /Ids$/.test(k) && Array.isArray(list(v)));
  const allFailed = errors.length > 0 && idLists.length > 0 && idLists.every(([, v]) => list(v).every((x) => x === null || x === undefined));
  return { messages, allFailed };
}

/** Finds campaign ids anywhere in a raw request body (for the protected-campaign check). */
function collectCampaignIds(body: unknown, out: string[] = []): string[] {
  if (!body || typeof body !== 'object') return out;
  for (const [k, v] of Object.entries(body as Record<string, unknown>)) {
    if (/^CampaignIds?$/.test(k)) {
      for (const id of Array.isArray(v) ? v : [v]) if (id !== null && id !== undefined) out.push(String(id));
    } else if (v && typeof v === 'object') collectCampaignIds(v, out);
  }
  return out;
}

/** Budgets and bids anywhere in a raw request body, so the spending ceilings still apply. */
export function collectAmounts(body: unknown, out: { budgets: number[]; bids: number[] } = { budgets: [], bids: [] }, parent = ''): { budgets: number[]; bids: number[] } {
  if (!body || typeof body !== 'object') return out;
  for (const [k, v] of Object.entries(body as Record<string, unknown>)) {
    const amount = typeof v === 'number' ? v : v && typeof v === 'object' && typeof (v as Record<string, unknown>).Amount === 'number' ? ((v as Record<string, unknown>).Amount as number) : null;
    if (amount !== null && (k === 'DailyBudget' || (k === 'Amount' && /^Budgets?$/.test(parent)))) out.budgets.push(amount);
    else if (amount !== null && /^(CpcBid|Bid|MaxCpc|CpmBid|CpvBid)$/.test(k)) out.bids.push(amount);
    else if (v && typeof v === 'object') collectAmounts(v, out, Array.isArray(body) ? parent : k);
  }
  return out;
}

export async function totalActiveDailyBudget(ctx: ToolContext): Promise<number> {
  return activeDailyBudget((await getCampaigns(ctx)) as Campaign[]);
}
