/**
 * Tools that change the account. Each returns a ChangePlan (evaluated by the
 * spending guardrails and shown on the approval card) plus an execute function.
 */
import { z } from 'zod';
import { activeDailyBudget } from '@/bing/spend';
import type { BidStrategy, Campaign, MsService } from '@/bing/types';
import type { ChangeLine } from '@/stores/activity';
import type { ChangePlan } from '../guardrails';
import { defineWrite, getAdGroup, getAdGroups, getCampaign, getCampaigns, getKeywords, statusLabel, type ToolContext } from './context';

const reason = z.string().describe('Short explanation (Danish) of why this change is made – shown to the user on the approval card.');
const onOff = z.enum(['Active', 'Paused']);

const bidStrategySchema = z.object({
  type: z.enum(['ManualCpc', 'EnhancedCpc', 'MaxClicks', 'MaxConversions', 'TargetCpa', 'MaxConversionValue', 'TargetRoas']),
  targetCpa: z.number().positive().optional().describe('Required for TargetCpa, optional for MaxConversions (account currency).'),
  targetRoas: z.number().positive().optional().describe('For TargetRoas / MaxConversionValue.'),
  maxCpc: z.number().positive().optional().describe('Optional bid cap (MaxClicks, MaxConversions, TargetCpa, TargetRoas).'),
});

const BID_LABELS: Record<string, string> = {
  ManualCpc: 'Manuel CPC',
  EnhancedCpc: 'Forbedret CPC',
  MaxClicks: 'Maksimér klik',
  MaxConversions: 'Maksimér konverteringer',
  TargetCpa: 'Mål-CPA',
  MaxConversionValue: 'Maksimér konverteringsværdi',
  TargetRoas: 'Mål-ROAS',
};

export function bidLabel(b: BidStrategy | undefined): string {
  if (!b) return '–';
  const base = BID_LABELS[b.type] ?? b.type;
  if (b.targetCpa) return `${base} (${b.targetCpa})`;
  if (b.targetRoas) return `${base} (${b.targetRoas})`;
  return base;
}

function isActive(status: string | undefined) {
  return status === 'Active';
}

function pct(before: number | null | undefined, after: number) {
  return before ? (after - before) / before : null;
}

function invalidate(ctx: ToolContext) {
  ctx.memo.clear();
}

function partialNote(res: { partialErrors?: string[] }) {
  return res.partialErrors?.length ? ` (delvise fejl: ${res.partialErrors.join(' · ')})` : '';
}

export const writeTools = [
  defineWrite({
    name: 'update_campaigns',
    kind: 'write',
    description:
      'Change one or more campaigns: status (Active/Paused), daily budget, name and/or bid strategy. Batch all campaign changes into one call. Campaigns with a shared budget cannot get an individual daily budget.',
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
      reason,
    }),
    label: (i) => (i.changes.length === 1 ? 'Ændrer kampagne' : `Ændrer ${i.changes.length} kampagner`),
    async plan(input, ctx) {
      const campaigns = await getCampaigns(ctx);
      const lines: ChangeLine[] = [];
      let delta = 0;
      let increases = false;
      let maxInc: number | null = null;
      const newBudgets: number[] = [];
      const undo: Record<string, unknown>[] = [];
      for (const ch of input.changes) {
        const c = campaigns.find((x) => x.id === String(ch.campaignId));
        if (!c) throw new Error(`Kampagne ${ch.campaignId} findes ikke på kontoen.`);
        const inverse: Record<string, unknown> = { campaignId: c.id };
        const wasActive = isActive(c.status);
        const willBeActive = ch.status ? ch.status === 'Active' : wasActive;
        const before = c.dailyBudget ?? 0;
        const after = ch.dailyBudget ?? before;
        if (ch.status && ch.status !== c.status) {
          lines.push({ entity: 'Kampagne', entityId: c.id, field: `${c.name} · status`, before: statusLabel(c.status), after: statusLabel(ch.status) });
          inverse.status = wasActive ? 'Active' : 'Paused';
          if (ch.status === 'Active') increases = true;
        }
        if (ch.dailyBudget !== undefined && ch.dailyBudget !== c.dailyBudget) {
          if (c.sharedBudgetId) throw new Error(`"${c.name}" bruger et delt budget – dagsbudgettet kan ikke ændres for kampagnen alene.`);
          lines.push({ entity: 'Kampagne', entityId: c.id, field: `${c.name} · dagsbudget`, before: c.dailyBudget, after: ch.dailyBudget });
          inverse.dailyBudget = c.dailyBudget ?? undefined;
          newBudgets.push(ch.dailyBudget);
          const inc = pct(c.dailyBudget, ch.dailyBudget);
          if (inc !== null && inc > 0) {
            increases = true;
            maxInc = Math.max(maxInc ?? 0, inc);
          }
        }
        if (ch.name && ch.name !== c.name) {
          lines.push({ entity: 'Kampagne', entityId: c.id, field: 'navn', before: c.name, after: ch.name });
          inverse.name = c.name;
        }
        if (ch.bidStrategy) {
          lines.push({ entity: 'Kampagne', entityId: c.id, field: `${c.name} · budstrategi`, before: bidLabel(c.bidStrategy), after: bidLabel(ch.bidStrategy) });
          inverse.bidStrategy = c.bidStrategy;
          increases = true;
        }
        delta += (willBeActive ? after : 0) - (wasActive ? before : 0);
        if (Object.keys(inverse).length > 1) undo.push(inverse);
      }
      if (!lines.length) throw new Error('Ingen ændringer – værdierne er allerede som foreslået.');
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
        undo: undo.length ? { tool: 'update_campaigns', input: { changes: undo, reason: 'Fortryd tidligere ændring' } } : undefined,
      };
      return {
        plan,
        execute: async () => {
          const res = await ctx.backend.updateCampaigns(
            ctx.accountId,
            input.changes.map((c) => ({ ...c, campaignId: String(c.campaignId) })),
          );
          invalidate(ctx);
          return { result: { ok: true, ...res }, summary: `${lines.length} ændring${lines.length === 1 ? '' : 'er'} gennemført${partialNote(res)}` };
        },
      };
    },
  }),

  defineWrite({
    name: 'create_campaign',
    kind: 'write',
    description:
      'Create a new campaign (Search is fully supported; Shopping/PerformanceMax/Audience need extra settings that may require microsoft_ads_api). Follow up with create_ad_group, add_keywords and create_responsive_search_ad. If the spending rules say new entities start paused, the campaign is created paused.',
    schema: z.object({
      name: z.string().min(1).max(128),
      type: z.enum(['Search', 'Shopping', 'Audience', 'PerformanceMax']).optional().describe('Default Search'),
      dailyBudget: z.number().positive(),
      bidStrategy: bidStrategySchema,
      languages: z.array(z.string()).optional().describe("Ad languages, e.g. ['Danish'] (default) or ['All']"),
      status: onOff.optional().describe('Default Paused'),
      reason,
    }),
    label: (i) => `Opretter kampagne "${i.name}"`,
    async plan(input, ctx) {
      const status = ctx.rules.newEntitiesPaused ? 'Paused' : (input.status ?? 'Paused');
      const notes = ctx.rules.newEntitiesPaused && input.status === 'Active' ? ['Oprettes som pauset (forbrugsregel: nye kampagner starter pauset).'] : [];
      const plan: ChangePlan = {
        kind: 'create',
        title: 'Ny kampagne',
        reason: input.reason,
        changes: [
          { entity: 'Kampagne', field: 'navn', after: input.name },
          { entity: 'Kampagne', field: 'type', after: input.type ?? 'Search' },
          { entity: 'Kampagne', field: 'dagsbudget', after: input.dailyBudget },
          { entity: 'Kampagne', field: 'budstrategi', after: bidLabel(input.bidStrategy) },
          { entity: 'Kampagne', field: 'status', after: statusLabel(status) },
        ],
        dailyBudgetDelta: status === 'Active' ? input.dailyBudget : 0,
        increasesSpend: status === 'Active',
        campaignIds: [],
        newDailyBudgets: [input.dailyBudget],
        notes,
      };
      return {
        plan,
        execute: async () => {
          const res = await ctx.backend.createCampaign(ctx.accountId, {
            name: input.name,
            type: input.type ?? 'Search',
            dailyBudget: input.dailyBudget,
            bidStrategy: input.bidStrategy,
            languages: input.languages?.length ? input.languages : ['Danish'],
            status,
          });
          invalidate(ctx);
          const id = res.ids?.[0];
          return {
            result: { ok: true, campaignId: id, status, ...res },
            summary: `Kampagne oprettet${id ? ` (id ${id})` : ''}${partialNote(res)}`,
            undo: id ? { tool: 'update_campaigns', input: { changes: [{ campaignId: id, status: 'Paused' }], reason: 'Fortryd: sæt ny kampagne på pause' } } : undefined,
          };
        },
      };
    },
  }),

  defineWrite({
    name: 'delete_campaigns',
    kind: 'write',
    description: 'Permanently delete campaigns. Prefer pausing (update_campaigns) unless the user explicitly wants deletion.',
    schema: z.object({ campaignIds: z.array(z.string()).min(1), reason }),
    label: (i) => `Sletter ${i.campaignIds.length} kampagne${i.campaignIds.length === 1 ? '' : 'r'}`,
    async plan(input, ctx) {
      const campaigns = await Promise.all(input.campaignIds.map((id) => getCampaign(ctx, id)));
      const delta = -campaigns.filter((c) => isActive(c.status)).reduce((s, c) => s + (c.dailyBudget ?? 0), 0);
      return {
        plan: {
          kind: 'delete',
          title: 'Sletning af kampagner',
          reason: input.reason,
          changes: campaigns.map((c) => ({ entity: 'Kampagne', entityId: c.id, field: c.name, before: statusLabel(c.status), after: 'Slettet' })),
          dailyBudgetDelta: delta,
          increasesSpend: false,
          campaignIds: campaigns.map((c) => c.id),
        },
        execute: async () => {
          const res = await ctx.backend.deleteCampaigns(ctx.accountId, campaigns.map((c) => c.id));
          invalidate(ctx);
          return { result: { ok: true, ...res }, summary: `${campaigns.length} kampagne(r) slettet${partialNote(res)}` };
        },
      };
    },
  }),

  defineWrite({
    name: 'create_ad_group',
    kind: 'write',
    description: 'Create an ad group in a campaign.',
    schema: z.object({
      campaignId: z.string(),
      name: z.string().min(1).max(256),
      cpcBid: z.number().positive().optional().describe('Default CPC bid (manual/enhanced CPC campaigns)'),
      status: onOff.optional().describe('Default Active (the campaign status still applies)'),
      reason,
    }),
    label: (i) => `Opretter annoncegruppe "${i.name}"`,
    async plan(input, ctx) {
      const c = await getCampaign(ctx, input.campaignId);
      // New ad groups in a running campaign start paused when the rule is on.
      const status = ctx.rules.newEntitiesPaused && isActive(c.status) ? 'Paused' : (input.status ?? 'Active');
      return {
        plan: {
          kind: 'create',
          title: 'Ny annoncegruppe',
          reason: input.reason,
          changes: [
            { entity: 'Annoncegruppe', field: 'kampagne', after: c.name },
            { entity: 'Annoncegruppe', field: 'navn', after: input.name },
            ...(input.cpcBid ? [{ entity: 'Annoncegruppe', field: 'CPC-bud', after: input.cpcBid }] : []),
          ],
          dailyBudgetDelta: 0,
          increasesSpend: isActive(c.status) && status === 'Active',
          campaignIds: [c.id],
          newBids: input.cpcBid ? [input.cpcBid] : [],
        },
        execute: async () => {
          const res = await ctx.backend.createAdGroup(ctx.accountId, { campaignId: c.id, name: input.name, cpcBid: input.cpcBid, status });
          invalidate(ctx);
          return { result: { ok: true, adGroupId: res.ids?.[0], ...res }, summary: `Annoncegruppe oprettet${partialNote(res)}` };
        },
      };
    },
  }),

  defineWrite({
    name: 'update_ad_groups',
    kind: 'write',
    description: 'Change status, default CPC bid and/or name of ad groups in one campaign.',
    schema: z.object({
      campaignId: z.string(),
      changes: z
        .array(z.object({ adGroupId: z.string(), status: onOff.optional(), cpcBid: z.number().positive().optional(), name: z.string().min(1).optional() }))
        .min(1),
      reason,
    }),
    label: (i) => `Ændrer ${i.changes.length} annoncegruppe${i.changes.length === 1 ? '' : 'r'}`,
    async plan(input, ctx) {
      const c = await getCampaign(ctx, input.campaignId);
      const groups = await getAdGroups(ctx, c.id);
      const lines: ChangeLine[] = [];
      const undo: Record<string, unknown>[] = [];
      const bids: number[] = [];
      let increases = false;
      for (const ch of input.changes) {
        const g = groups.find((x) => x.id === String(ch.adGroupId));
        if (!g) throw new Error(`Annoncegruppe ${ch.adGroupId} findes ikke i kampagne ${c.id}.`);
        const inv: Record<string, unknown> = { adGroupId: g.id };
        if (ch.status && ch.status !== g.status) {
          lines.push({ entity: 'Annoncegruppe', entityId: g.id, field: `${g.name} · status`, before: statusLabel(g.status), after: statusLabel(ch.status) });
          inv.status = isActive(g.status) ? 'Active' : 'Paused';
          if (ch.status === 'Active') increases = true;
        }
        if (ch.cpcBid !== undefined && ch.cpcBid !== g.cpcBid) {
          lines.push({ entity: 'Annoncegruppe', entityId: g.id, field: `${g.name} · CPC-bud`, before: g.cpcBid, after: ch.cpcBid });
          if (g.cpcBid) inv.cpcBid = g.cpcBid;
          bids.push(ch.cpcBid);
          if (!g.cpcBid || ch.cpcBid > g.cpcBid) increases = true;
        }
        if (ch.name && ch.name !== g.name) {
          lines.push({ entity: 'Annoncegruppe', entityId: g.id, field: 'navn', before: g.name, after: ch.name });
          inv.name = g.name;
        }
        if (Object.keys(inv).length > 1) undo.push(inv);
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
          undo: undo.length ? { tool: 'update_ad_groups', input: { campaignId: c.id, changes: undo, reason: 'Fortryd tidligere ændring' } } : undefined,
        },
        execute: async () => {
          const res = await ctx.backend.updateAdGroups(ctx.accountId, c.id, input.changes.map((x) => ({ ...x, adGroupId: String(x.adGroupId) })));
          invalidate(ctx);
          return { result: { ok: true, ...res }, summary: `${lines.length} ændring(er) gennemført${partialNote(res)}` };
        },
      };
    },
  }),

  defineWrite({
    name: 'add_keywords',
    kind: 'write',
    description: 'Add keywords to an ad group. Match types: Exact, Phrase, Broad. Bid is optional (ad group bid is used otherwise).',
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
      const g = await getAdGroup(ctx, c.id, input.adGroupId);
      return {
        plan: {
          kind: 'create',
          title: `Nye søgeord i ${g.name}`,
          reason: input.reason,
          changes: input.keywords.map((k) => ({ entity: 'Søgeord', field: `${k.text} (${k.matchType})`, after: k.bid ?? 'gruppebud' })),
          dailyBudgetDelta: 0,
          increasesSpend: isActive(c.status) && isActive(g.status),
          campaignIds: [c.id],
          newBids: input.keywords.flatMap((k) => (k.bid ? [k.bid] : [])),
        },
        execute: async () => {
          const res = await ctx.backend.addKeywords(ctx.accountId, g.id, input.keywords);
          invalidate(ctx);
          const ids = res.ids ?? [];
          return {
            result: { ok: true, keywordIds: ids, partialErrors: res.partialErrors },
            summary: `${ids.length} søgeord tilføjet${partialNote(res)}`,
            undo: ids.length ? { tool: 'update_keywords', input: { campaignId: c.id, adGroupId: g.id, changes: ids.map((id) => ({ keywordId: id, status: 'Paused' })), reason: 'Fortryd: sæt nye søgeord på pause' } } : undefined,
          };
        },
      };
    },
  }),

  defineWrite({
    name: 'update_keywords',
    kind: 'write',
    description: 'Change status (Active/Paused) and/or bid of keywords in one ad group.',
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
      const keywords = await getKeywords(ctx, g.id);
      const lines: ChangeLine[] = [];
      const undo: Record<string, unknown>[] = [];
      const bids: number[] = [];
      let increases = false;
      for (const ch of input.changes) {
        const k = keywords.find((x) => x.id === String(ch.keywordId));
        if (!k) throw new Error(`Søgeord ${ch.keywordId} findes ikke i annoncegruppe ${g.id}.`);
        const inv: Record<string, unknown> = { keywordId: k.id };
        const label = `${k.text} (${k.matchType})`;
        if (ch.status && ch.status !== k.status) {
          lines.push({ entity: 'Søgeord', entityId: k.id, field: `${label} · status`, before: statusLabel(k.status), after: statusLabel(ch.status) });
          inv.status = isActive(k.status) ? 'Active' : 'Paused';
          if (ch.status === 'Active') increases = true;
        }
        if (ch.bid !== undefined && ch.bid !== k.bid) {
          lines.push({ entity: 'Søgeord', entityId: k.id, field: `${label} · bud`, before: k.bid ?? g.cpcBid, after: ch.bid });
          const prev = k.bid ?? g.cpcBid;
          if (prev) inv.bid = prev;
          bids.push(ch.bid);
          if (!prev || ch.bid > prev) increases = true;
        }
        if (Object.keys(inv).length > 1) undo.push(inv);
      }
      if (!lines.length) throw new Error('Ingen ændringer – værdierne er allerede som foreslået.');
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
          undo: undo.length ? { tool: 'update_keywords', input: { campaignId: c.id, adGroupId: g.id, changes: undo, reason: 'Fortryd tidligere ændring' } } : undefined,
        },
        execute: async () => {
          const res = await ctx.backend.updateKeywords(ctx.accountId, g.id, input.changes.map((x) => ({ ...x, keywordId: String(x.keywordId) })));
          invalidate(ctx);
          return { result: { ok: true, ...res }, summary: `${lines.length} søgeordsændring(er) gennemført${partialNote(res)}` };
        },
      };
    },
  }),

  defineWrite({
    name: 'delete_keywords',
    kind: 'write',
    description: 'Delete keywords from an ad group. Prefer pausing (update_keywords) unless deletion is requested.',
    schema: z.object({ campaignId: z.string(), adGroupId: z.string(), keywordIds: z.array(z.string()).min(1), reason }),
    label: (i) => `Sletter ${i.keywordIds.length} søgeord`,
    async plan(input, ctx) {
      const c = await getCampaign(ctx, input.campaignId);
      const g = await getAdGroup(ctx, c.id, input.adGroupId);
      const keywords = await getKeywords(ctx, g.id);
      const targets = input.keywordIds.map((id) => {
        const k = keywords.find((x) => x.id === String(id));
        if (!k) throw new Error(`Søgeord ${id} findes ikke i annoncegruppe ${g.id}.`);
        return k;
      });
      return {
        plan: {
          kind: 'delete',
          title: `Sletning af søgeord i ${g.name}`,
          reason: input.reason,
          changes: targets.map((k) => ({ entity: 'Søgeord', entityId: k.id, field: `${k.text} (${k.matchType})`, before: statusLabel(k.status), after: 'Slettet' })),
          dailyBudgetDelta: 0,
          increasesSpend: false,
          campaignIds: [c.id],
        },
        execute: async () => {
          const res = await ctx.backend.deleteKeywords(ctx.accountId, g.id, targets.map((k) => k.id));
          invalidate(ctx);
          return { result: { ok: true, ...res }, summary: `${targets.length} søgeord slettet${partialNote(res)}` };
        },
      };
    },
  }),

  defineWrite({
    name: 'add_negative_keywords',
    kind: 'write',
    description: 'Add negative keywords to a campaign (omit adGroupId) or an ad group. Match types: Exact or Phrase. Use for search terms that waste spend.',
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
      return {
        plan: {
          kind: 'update',
          title: `Negative søgeord på ${target}`,
          reason: input.reason,
          changes: input.keywords.map((k) => ({ entity: 'Negativt søgeord', field: k.text, after: k.matchType === 'Exact' ? 'Eksakt' : 'Udtryk' })),
          dailyBudgetDelta: 0,
          increasesSpend: false,
          campaignIds: [c.id],
        },
        execute: async () => {
          const res = await ctx.backend.addNegativeKeywords(ctx.accountId, g ? 'AdGroup' : 'Campaign', g ? g.id : c.id, input.keywords);
          invalidate(ctx);
          return { result: { ok: true, ...res }, summary: `${input.keywords.length} negative søgeord tilføjet${partialNote(res)}` };
        },
      };
    },
  }),

  defineWrite({
    name: 'create_responsive_search_ad',
    kind: 'write',
    description:
      'Create a responsive search ad. 3–15 headlines (max 30 characters each), 2–4 descriptions (max 90 characters each), final URL, optional display paths (max 15 characters each). Write in the language of the campaign (Danish by default) and follow the tone of voice from the business profile.',
    schema: z.object({
      campaignId: z.string(),
      adGroupId: z.string(),
      headlines: z.array(z.string().min(1).max(30)).min(3).max(15),
      descriptions: z.array(z.string().min(1).max(90)).min(2).max(4),
      finalUrl: z.string().url(),
      path1: z.string().max(15).optional(),
      path2: z.string().max(15).optional(),
      reason,
    }),
    label: () => 'Opretter responsiv søgeannonce',
    async plan(input, ctx) {
      const c = await getCampaign(ctx, input.campaignId);
      const g = await getAdGroup(ctx, c.id, input.adGroupId);
      return {
        plan: {
          kind: 'create',
          title: `Ny annonce i ${g.name}`,
          reason: input.reason,
          changes: [
            ...input.headlines.map((h, i) => ({ entity: 'Annonce', field: `Overskrift ${i + 1}`, after: h })),
            ...input.descriptions.map((d, i) => ({ entity: 'Annonce', field: `Beskrivelse ${i + 1}`, after: d })),
            { entity: 'Annonce', field: 'Slut-URL', after: input.finalUrl },
            ...(input.path1 ? [{ entity: 'Annonce', field: 'Visningssti', after: [input.path1, input.path2].filter(Boolean).join('/') }] : []),
          ],
          dailyBudgetDelta: 0,
          increasesSpend: false,
          campaignIds: [c.id],
        },
        execute: async () => {
          const res = await ctx.backend.createResponsiveSearchAd(ctx.accountId, g.id, {
            headlines: input.headlines,
            descriptions: input.descriptions,
            finalUrl: input.finalUrl,
            path1: input.path1,
            path2: input.path2,
          });
          invalidate(ctx);
          const id = res.ids?.[0];
          return {
            result: { ok: true, adId: id, ...res },
            summary: `Annonce oprettet${partialNote(res)}`,
            undo: id ? { tool: 'update_ads', input: { campaignId: c.id, adGroupId: g.id, changes: [{ adId: id, status: 'Paused' }], reason: 'Fortryd: sæt annoncen på pause' } } : undefined,
          };
        },
      };
    },
  }),

  defineWrite({
    name: 'update_ads',
    kind: 'write',
    description: 'Pause or activate ads in one ad group.',
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
      const undo: Record<string, unknown>[] = [];
      for (const ch of input.changes) {
        const a = ads.find((x) => x.id === String(ch.adId));
        if (!a) throw new Error(`Annonce ${ch.adId} findes ikke i annoncegruppe ${g.id}.`);
        if (a.status === ch.status) continue;
        lines.push({ entity: 'Annonce', entityId: a.id, field: a.headlines.slice(0, 2).join(' | ') || a.id, before: statusLabel(a.status), after: statusLabel(ch.status) });
        undo.push({ adId: a.id, status: isActive(a.status) ? 'Active' : 'Paused' });
      }
      if (!lines.length) throw new Error('Ingen ændringer – annoncerne har allerede den status.');
      return {
        plan: {
          kind: 'update',
          title: `Annoncer i ${g.name}`,
          reason: input.reason,
          changes: lines,
          dailyBudgetDelta: 0,
          increasesSpend: false,
          campaignIds: [c.id],
          undo: { tool: 'update_ads', input: { campaignId: c.id, adGroupId: g.id, changes: undo, reason: 'Fortryd tidligere ændring' } },
        },
        execute: async () => {
          const res = await ctx.backend.updateAds(ctx.accountId, g.id, input.changes.map((x) => ({ ...x, adId: String(x.adId) })));
          invalidate(ctx);
          return { result: { ok: true, ...res }, summary: `${lines.length} annonce(r) opdateret${partialNote(res)}` };
        },
      };
    },
  }),

  defineWrite({
    name: 'microsoft_ads_api',
    kind: 'write',
    description: `Call any Microsoft Advertising REST API v13 operation directly – for everything the other tools do not cover (ad extensions/assets such as sitelinks and callouts, location and device targeting criteria and bid adjustments, audiences, conversion goals, UET tags, shared budgets and negative keyword lists, labels, Bulk, Customer Billing …).
Path convention: SOAP operation Get<Entities>By<X> → POST '<Entities>/QueryBy<X>'; Add<Entities> → POST '<Entities>'; Update<Entities> → PUT '<Entities>'; Delete<Entities> → DELETE '<Entities>'. The JSON body mirrors the SOAP request elements; polymorphic objects need a "Type" field. CustomerId and CustomerAccountId headers are added automatically.
Reads (POST to …/Query…, …/Search, or GET) run immediately; every other call needs the user's approval. Live accounts only.`,
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
      const readOnly = input.method === 'GET' || (input.method === 'POST' && /(^|\/)(Query\w*|Search|Get\w*)$/i.test(path)) || /GenerateReport\/(Submit|Poll)$/i.test(path);
      const run = async () => {
        const result = await ctx.backend.rawRequest(ctx.accountId, input.service as MsService, path, input.method, input.body);
        if (!readOnly) invalidate(ctx);
        const text = JSON.stringify(result ?? null);
        return {
          result: text.length > 60_000 ? { truncated: true, json: text.slice(0, 60_000) } : result,
          summary: readOnly ? `Svar modtaget (${Math.round(text.length / 1024)} kB)` : 'Ændring sendt til Microsoft Advertising',
        };
      };
      if (readOnly) return { plan: null, execute: run };
      const campaignIds = collectCampaignIds(input.body);
      return {
        plan: {
          kind: 'raw',
          title: `${input.method} ${input.service}/${path}`,
          reason: input.reason,
          changes: [{ entity: 'API-kald', field: `${input.method} ${path}`, after: JSON.stringify(input.body ?? {}).slice(0, 600) }],
          dailyBudgetDelta: 0,
          increasesSpend: true,
          campaignIds,
        },
        execute: run,
      };
    },
  }),
];

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

export async function totalActiveDailyBudget(ctx: ToolContext): Promise<number> {
  return activeDailyBudget((await getCampaigns(ctx)) as Campaign[]);
}
