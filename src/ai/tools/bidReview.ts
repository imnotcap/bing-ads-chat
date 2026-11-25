/**
 * review_bids_and_budgets: which budgets, targets and Enhanced CPC bids to raise, lower or
 * leave – from the account's own numbers, by the rules in features/bidding/review.ts (gates →
 * decision table → step limits → what a person must decide). Read only: the assistant then
 * proposes the changes on approval cards.
 */
import { z } from 'zod';
import { getSpendStatus } from '@/bing/spend';
import type { AdGroup, Campaign } from '@/bing/types';
import { toListingNodes } from '@/features/audit/bingDetail';
import { shapeOf } from '@/features/audit/productMirror';
import { pacing, reviewBid, reviewCampaign, trackingHealth, type BidAdvice, type CampaignInput, type Goal } from '@/features/bidding/review';
import { addDays, today } from '@/lib/format';
import { useActivity } from '@/stores/activity';
import { useSettings } from '@/stores/settings';
import { accountConversions30 } from './checks';
import { compact, defineRead, getAdGroups, getCampaigns, getReport, type ToolContext } from './context';
import { shownItems, teamTargetRoas } from './google';

const DAY = 86_400_000;

/** When the app last changed each lever of a campaign (this PC's change log). */
function leverHistory(ctx: ToolContext, campaignId: string) {
  const last: CampaignInput['last'] = {};
  let targetChanges60 = 0;
  const since60 = Date.now() - 60 * DAY;
  for (const e of useActivity.getState().entries) {
    if (e.accountId !== ctx.accountId || e.mode !== ctx.backend.mode || e.status !== 'success' || e.undone) continue;
    const mine = e.campaignIds?.includes(campaignId);
    const set = (k: keyof CampaignInput['last']) => (last[k] = Math.max(last[k] ?? 0, e.ts));
    // Conversion goals are account-wide: they restart learning everywhere.
    if (e.tool === 'microsoft_ads_api' && /ConversionGoal/i.test(JSON.stringify(e.changes))) set('goals');
    if (!mine) continue;
    if (e.tool === 'create_campaign') set('created');
    if (['update_keywords', 'update_ad_groups', 'edit_product_groups', 'match_product_groups_to_google', 'apply_stock_sheet'].includes(e.tool)) set('bids');
    for (const l of e.changes) {
      if (l.entityId && l.entityId !== campaignId) continue;
      if (/· dagsbudget$/.test(l.field)) set('budget');
      if (/· budstrategi$/.test(l.field)) {
        const typeOf = (v: unknown) => String(v ?? '').split(/[ (·]/)[0];
        if (typeOf(l.before) !== typeOf(l.after)) set('strategy');
        else {
          set('target');
          if (e.ts >= since60) targetChanges60++;
        }
      }
    }
  }
  return { last, targetChanges60 };
}

/** A dated period (Black Week …) in the window or running now: an ad group with a start or end date. */
function eventOf(groups: AdGroup[], from: string, to: string): string | null {
  const g = groups.find((x) => x.status !== 'Deleted' && (x.startDate || x.endDate) && (x.startDate ?? '0000') <= to && (x.endDate ?? '9999') >= from);
  if (!g) return null;
  const dk = (d?: string | null) => (d ? d.split('-').reverse().slice(0, 2).map(Number).join('/') : '…');
  return `kampagneperioden "${g.name}" (${dk(g.startDate)}–${dk(g.endDate)})`;
}

export const bidReviewTools = [
  defineRead({
    name: 'review_bids_and_budgets',
    kind: 'read',
    description: `Which budgets, CPA/ROAS targets and Enhanced CPC bids to raise, lower or keep – computed from the account's numbers by the team's rules. Use it for EVERY question about raising or lowering budgets, targets or bids ("skal budgettet op?", "hvilke bud skal ned?", "optimér budgetterne").
1. Gates – any one failing keeps the lever as it is: learning period (14 days after a new campaign, a strategy switch or changed conversion goals), cooldown (one conversion cycle, min. 7 days, since the campaign's last change), ≥30 conversions in 30 days before a target or budget change (below: only a signal), tracking health (conversions gone while clicks hold → a person checks it), conversion lag (the newest cycle of days is left out), known events (a dated campaign period: targets stay).
2. Decision table on actual CPA/ROAS (30 days) against the goal (the campaign's target, else the business profile's, else break-even): limited by budget and on goal → budget +20 %; limited and over goal → keep budget, tighten target 15 %; clearly better than goal (≤85 %) and not limited → loosen target 15 %; over goal by >15 % → tighten 15 %; within ±15 % → keep; under 70 % of budget used → keep budget, spare budget can move.
3. Steps: targets ±15 %, budgets and bids ±20 %, one lever per campaign at a time, never under the minimum bid (pause/exclude instead). Bids (Enhanced CPC): target CPC = revenue per click ÷ goal ROAS.
Returns per campaign the advice with rule and reason, keyword/product bid moves with ids, and what a person must decide (escalate). Present it as a short table; then propose the changes on cards (update_campaigns for budgets/targets, update_keywords / edit_product_groups for bids) – never change a lever whose gate failed. products: true also reviews Shopping product group bids (slower; best with campaignIds).`,
    schema: z.object({
      campaignIds: z.array(z.string()).max(50).optional().describe('Only these campaigns (default: all active Search, Shopping and Performance Max).'),
      bids: z.boolean().optional().describe('Also review keyword bids in Enhanced CPC campaigns (default true).'),
      products: z.boolean().optional().describe('Also review Shopping product group bids in Enhanced CPC campaigns (default: only when campaignIds are given).'),
    }),
    label: () => 'Gennemgår budgetter, mål og bud',
    async run(input, ctx) {
      const business = useSettings.getState().business;
      const cycle = Math.max(1, Math.min(60, Math.round(business.conversionCycleDays ?? 7)));
      const to = addDays(today(), -cycle);
      const from = addDays(to, -29);
      const range = { from, to };
      const team: Goal = { cpa: business.targetCpa, roas: teamTargetRoas() };
      const all = (await getCampaigns(ctx)).filter((c: Campaign) =>
        input.campaignIds?.length ? input.campaignIds.includes(c.id) : c.status === 'Active' && ['Search', 'Shopping', 'PerformanceMax'].includes(c.type),
      );
      if (!all.length) throw new Error('Ingen aktive Søge-, Shopping- eller Performance Max-kampagner at gennemgå.');
      const ids = all.map((c) => c.id);
      const [shares, plain, days, account30, spend] = await Promise.all([
        getReport(ctx, { kind: 'impressionshare', range, aggregation: 'Summary', campaignIds: ids }).catch(() => []),
        getReport(ctx, { kind: 'campaign', range, aggregation: 'Summary', campaignIds: ids }),
        getReport(ctx, { kind: 'account', range: { from: addDays(today(), -10), to: addDays(today(), -1) }, aggregation: 'Daily' }).catch(() => []),
        accountConversions30(ctx).catch(() => 0),
        getSpendStatus(ctx.backend, ctx.accountId, ctx.rules.monthlyBudget).catch(() => null),
      ]);
      const tracking = trackingHealth([...days].sort((a, b) => (a.date ?? '').localeCompare(b.date ?? '')).map((d) => ({ clicks: d.clicks ?? 0, conversions: d.conversions ?? 0 })));
      const daysWithData = 30;
      const verdicts = await Promise.all(
        all.map(async (c) => {
          const rows = (shares.length ? shares : plain).filter((r) => r.campaignId === c.id);
          const m = rows.reduce<CampaignInput['metrics']>((s, r) => ({ spend: s.spend + (r.spend ?? 0), clicks: s.clicks + (r.clicks ?? 0), conversions: s.conversions + (r.conversions ?? 0), revenue: s.revenue + (r.revenue ?? 0) }), { spend: 0, clicks: 0, conversions: 0, revenue: 0 });
          const share = shares.find((r) => r.campaignId === c.id);
          const groups = await getAdGroups(ctx, c.id).catch(() => [] as AdGroup[]);
          const hist = leverHistory(ctx, c.id);
          const inputC: CampaignInput = {
            id: c.id,
            name: c.name,
            type: c.type,
            strategy: c.bidStrategy,
            dailyBudget: c.dailyBudget,
            sharedBudget: !!c.sharedBudgetId,
            metrics: m,
            days: daysWithData,
            lostToBudget: share?.lostToBudget ?? null,
            lostToRank: share?.lostToRank ?? null,
            last: hist.last,
            targetTightenings60: hist.targetChanges60,
            event: eventOf(groups, from, today()),
          };
          return { c, groups, m, verdict: reviewCampaign(inputC, team, { now: Date.now(), cycleDays: cycle, accountConversions30: account30, tracking, maxBudgetIncreasePct: ctx.rules.maxBudgetIncreasePct ?? null }) };
        }),
      );

      // Bids under Enhanced CPC – only where the campaign's own gates passed.
      const bidMoves: (BidAdvice & { campaignId: string; adGroupId?: string; keywordId?: string; itemId?: string })[] = [];
      const open = verdicts.filter((v) => v.verdict.gate === null && v.verdict.target.kind === 'bids');
      const goalOf = (c: Campaign): Goal => ({ cpa: c.bidStrategy.targetCpa ?? team.cpa, roas: c.bidStrategy.targetRoas ?? team.roas });
      const aov = (m: { conversions: number; revenue: number }) => (m.conversions > 0 ? m.revenue / m.conversions : null);
      const minBid = ctx.rules.minCpcBid ?? null;
      const search = open.filter((v) => v.c.type === 'Search');
      if (input.bids !== false && search.length) {
        const kws = await getReport(ctx, { kind: 'keyword', range, aggregation: 'Summary', campaignIds: search.map((v) => v.c.id) }).catch(() => []);
        for (const r of kws) {
          const v = search.find((x) => x.c.id === r.campaignId);
          if (!v || !r.keywordId) continue;
          const a = reviewBid(
            { id: r.keywordId, label: `${r.campaignName} › ${r.adGroupName}: "${r.keyword}" (${r.matchType})`, bid: r.currentMaxCpc ?? null, clicks: r.clicks ?? 0, spend: r.spend ?? 0, conversions: r.conversions ?? 0, revenue: r.revenue ?? 0 },
            goalOf(v.c),
            minBid,
            aov(v.m),
          );
          if (a) bidMoves.push({ ...a, campaignId: v.c.id, adGroupId: r.adGroupId, keywordId: r.keywordId });
        }
      }
      const shopping = open.filter((v) => v.c.type === 'Shopping');
      if ((input.products ?? !!input.campaignIds?.length) && shopping.length && ctx.backend.listProductPartitions) {
        for (const v of shopping.slice(0, 5)) {
          const shown = await shownItems(ctx, v.c.id, false);
          if (!shown.items?.stats) continue;
          for (const g of v.groups.filter((x) => x.status === 'Active')) {
            const b = shapeOf(toListingNodes(await ctx.backend.listProductPartitions(ctx.accountId, g.id, g.name)));
            if (b.kind !== 'ids') continue;
            for (const [id, node] of b.items) {
              if (node.excluded) continue;
              const s = shown.items.stats.get(`${g.id}|${id}`);
              if (!s) continue;
              const a = reviewBid({ id: `${g.id}|${node.raw || id}`, label: `${v.c.name} › ${g.name}: ${node.raw || id}`, bid: node.bid ?? null, ...s }, goalOf(v.c), minBid, aov(v.m));
              if (a) bidMoves.push({ ...a, campaignId: v.c.id, adGroupId: g.id, itemId: node.raw || id });
            }
          }
        }
      }
      bidMoves.sort((a, b) => b.weight - a.weight);

      const pace = spend
        ? pacing(spend.monthToDateSpend, spend.daysElapsed, spend.daysElapsed + spend.daysLeftInMonth, spend.monthlyBudget, spend.forecastByRunRate)
        : null;
      const escalate = [...new Set([...verdicts.flatMap((v) => v.verdict.escalate), ...(pace?.escalate ? [pace.escalate] : [])])];
      const label = { raise: 'Hæv', lower: 'Sænk', hold: 'Behold', add: 'Sæt mål' } as const;
      const lever = (a: { move: keyof typeof label; from: number | null; to: number | null }) => `${label[a.move]}${a.from !== null && a.to !== null ? ` ${a.from} → ${a.to}` : a.to !== null ? ` ${a.to}` : ''}`;
      const toMove = verdicts.filter((v) => v.verdict.budget.move !== 'hold' || v.verdict.target.move !== 'hold').length;

      return {
        result: {
          window: { ...range, note: `30 dage uden de nyeste ${cycle} dage (konverteringscyklus – sene konverteringer er ikke kommet endnu)` },
          accountConversions30: Math.round(account30),
          ...(tracking.broken ? { tracking: `BROKEN? ${tracking.detail} – change nothing, tell the user to check UET/conversion goals.` } : {}),
          ...(pace && pace.status !== 'none' ? { monthPacing: compact({ status: pace.status, detail: pace.detail }) } : {}),
          campaigns: verdicts.map(({ c, verdict: v }) =>
            compact({
              campaignId: c.id,
              campaign: c.name,
              strategy: c.bidStrategy.type,
              gate: v.gate,
              budget: compact({ advice: lever(v.budget), rule: v.budget.rule, why: v.budget.why }),
              [v.target.kind === 'bids' ? 'bids' : 'target']: compact({ kind: v.target.kind, advice: lever(v.target), rule: v.target.rule, why: v.target.why }),
              numbers: compact({
                conversions: Math.round(v.numbers.conversions * 10) / 10,
                cpa: v.numbers.cpa !== null ? Math.round(v.numbers.cpa) : null,
                roas: v.numbers.roas !== null ? Math.round(v.numbers.roas * 100) / 100 : null,
                goalCpa: v.numbers.goalCpa,
                goalRoas: v.numbers.goalRoas,
                lostToBudgetPct: v.numbers.lostToBudget,
                budgetUsedPct: v.numbers.budgetUse !== null ? Math.round(v.numbers.budgetUse * 100) : null,
              }),
            }),
          ),
          bidMoves: bidMoves.slice(0, 40).map((b) => compact({ campaignId: b.campaignId, adGroupId: b.adGroupId, keywordId: b.keywordId, itemId: b.itemId, what: b.label, advice: lever(b), rule: b.rule, why: b.why })),
          ...(bidMoves.length > 40 ? { moreBidMoves: bidMoves.length - 40 } : {}),
          escalate,
          notes: [
            'Gates use the changes made through this app on this PC – changes made in Microsoft Advertising or from another PC are not seen; say so if the user may have changed something there.',
            'One lever per campaign: never propose a budget and a target change for the same campaign together.',
            "Every proposal's reason names the rule (B1, T2 …), the numbers and when it is checked again (one conversion cycle later) – a follow-up card is made after approval.",
          ],
        },
        summary: `${verdicts.length} kampagner · ${toMove} med forslag${bidMoves.length ? ` · ${bidMoves.length} bud` : ''}${escalate.length ? ` · ${escalate.length} til en person` : ''}`,
        preview: {
          columns: [
            { key: 'campaign', label: 'Kampagne' },
            { key: 'budget', label: 'Budget' },
            { key: 'target', label: 'Mål / bud' },
            { key: 'gate', label: 'Port' },
          ],
          rows: verdicts.map(({ c, verdict: v }) => ({ campaign: c.name, budget: lever(v.budget), target: lever(v.target), gate: v.gate ?? '–' })),
        },
      };
    },
  }),
];
