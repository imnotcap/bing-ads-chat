/**
 * Comparing a Microsoft Advertising campaign with its Google Ads counterpart, and making
 * Microsoft's product groups like Google's.
 *
 * Google is ONLY read (src/ai/googleSource.ts → the workspace, which refuses anything else).
 * Every change is to Microsoft, after approval on a card. A 1:1 matchup corrects the
 * campaign's contents – ad groups, keywords, negatives, product groups, ads – never its
 * settings (bid strategy, budget, targets) unless the user asks for that themselves.
 */
import { z } from 'zod';
import type { AdGroup, Campaign } from '@/bing/types';
import { bingAds, bingNegatives, bingProducts, bingSearchTerms, bingStructure, toListingNodes } from '@/features/audit/bingDetail';
import { compareAds, compareExclusions, compareKeywords, compareNegatives, compareSearchTerms } from '@/features/audit/compare';
import type { GoogleCampaign } from '@/features/audit/data';
import type { DetailPart } from '@/features/audit/detail';
import { rankCandidates, suggestMatch } from '@/features/audit/match';
import { buildActions, planMirror, shapeOf, verifyMirror, type MirrorAction, type MirrorGroup } from '@/features/audit/productMirror';
import type { ChangeLine } from '@/stores/activity';
import { auditGoogleMatch, googleCampaigns, googleDetail, requireGoogle } from '../googleSource';
import { PERIOD_DESCRIPTION, defineRead, defineWrite, getAdGroups, getCampaign, memo, resolvePeriod, type ToolContext } from './context';

/* ------------------------------ finding the counterpart ------------------------------ */

async function counterpart(ctx: ToolContext, bing: Campaign, given: string | undefined, range: { from: string; to: string }): Promise<{ google: GoogleCampaign; how: string }> {
  requireGoogle();
  const list = await memo(ctx, `google:campaigns:${range.from}:${range.to}`, () => googleCampaigns(range));
  const byId = (id: string) => list.campaigns.find((g) => g.id === String(id));
  if (given) {
    const g = byId(given);
    if (!g) throw new Error(`Google-kampagne ${given} findes ikke (eller er fjernet) i den forbundne Google Ads-konto.`);
    return { google: g, how: 'valgt i forespørgslen' };
  }
  const matched = await auditGoogleMatch(bing.id).catch(() => undefined);
  if (matched === null) throw new Error(`På Audit-siden er det valgt, at "${bing.name}" ikke har en modpart i Google. Spørg brugeren, hvilken Google-kampagne der skal sammenlignes med.`);
  if (matched) {
    const g = byId(matched);
    if (g) return { google: g, how: 'matchet på Audit-siden' };
  }
  const s = suggestMatch(bing, list.campaigns);
  if (s) return { google: byId(s.googleId)!, how: 'foreslået ud fra navnet (ikke bekræftet på Audit-siden – nævn det)' };
  const options = rankCandidates(bing, list.campaigns)
    .slice(0, 5)
    .map((r) => `"${byId(r.googleId)!.name}" (id ${r.googleId})`);
  throw new Error(`Kunne ikke finde Google-modparten til "${bing.name}" sikkert.${options.length ? ` Mulige: ${options.join(', ')}.` : ''} Spørg brugeren, eller match kampagnen på Audit-siden.`);
}

/** What can be compared for a kind of campaign. */
function partsFor(type: string): DetailPart[] {
  if (type === 'Search') return ['structure', 'negatives', 'searchterms', 'ads'];
  if (type === 'Shopping') return ['products', 'negatives', 'searchterms'];
  if (type === 'PerformanceMax') return ['products', 'negatives'];
  return ['negatives'];
}

const top = <T,>(list: T[], n: number) => ({ count: list.length, items: list.slice(0, n), ...(list.length > n ? { more: list.length - n } : {}) });

const MATCH = { exact: 'Exact', phrase: 'Phrase', broad: 'Broad' } as const;

/** Microsoft's ad groups and the product trees of a Shopping campaign, and the plan to make them like Google's. */
async function productPlan(ctx: ToolContext, bing: Campaign, google: GoogleCampaign, range: { from: string; to: string }) {
  if (!ctx.backend.listProductPartitions) throw new Error('Produktgrupper kan kun læses fra den rigtige Microsoft-konto (ikke demo).');
  const [g, groups, nodes] = await Promise.all([
    googleDetail(google.id, 'products', range, false),
    getAdGroups(ctx, bing.id),
    bingProducts(ctx.accountId, bing.id, false, ctx.backend),
  ]);
  const live = groups.filter((x: AdGroup) => x.status !== 'Deleted');
  return { plan: planMirror(g.data, nodes, live.map((x) => ({ id: x.id, name: x.name, cpcBid: x.cpcBid }))), google: g.data, bing: nodes };
}

/* ------------------------------------ tools ------------------------------------ */

const TAG: Record<MirrorAction, string> = {
  add_bid: 'Byd',
  add_exclude: 'Udeluk',
  to_bid: 'Byd',
  to_exclude: 'Udeluk',
  remove: 'Fjern',
  else_bid: 'Byd',
  else_exclude: 'Udeluk',
  all: 'Alle',
  collapse: 'Alle',
};

export const googleTools = [
  defineRead({
    name: 'compare_with_google',
    kind: 'read',
    description:
      'Compare a Microsoft Advertising campaign 1:1 with its Google Ads counterpart (read only – nothing in Google can ever be changed). Reads both campaigns in full and returns every difference: ad groups paired by name, keywords missing in Microsoft (with Google\'s numbers), in another ad group or paused, match type differences; negative keywords missing (with the Microsoft ad group or campaign each belongs on); product groups per ad group (item ids bid on or excluded in Google but not in Microsoft, and "everything else"); search terms Microsoft pays for that Google excludes, and ones converting in Google only; ads (headlines, descriptions, landing pages Google uses and Microsoft does not). The Google campaign is the one matched on the Audit page, else the one with the same name – or pass googleCampaignId. Then fix Microsoft with: match_product_groups_to_google (item ids), propose_negative_keywords (negatives, with the ad group given here), add_keywords, review_ad_copy + create_responsive_search_ad / update_ads. A matchup changes the campaign\'s contents only – never bid strategy, budget, targets or status unless the user asks.',
    schema: z.object({
      campaignId: z.string().describe('The Microsoft campaign.'),
      googleCampaignId: z.string().optional().describe('The Google campaign, if not the one matched on the Audit page.'),
      parts: z.array(z.enum(['structure', 'negatives', 'products', 'searchterms', 'ads'])).optional().describe('Only these parts (default: all that apply to the campaign type).'),
      period: z.string().optional().describe(PERIOD_DESCRIPTION),
    }),
    label: () => 'Sammenligner med Google (kun læsning)',
    async run(input, ctx) {
      const c = await getCampaign(ctx, input.campaignId);
      const period = resolvePeriod(input.period, ctx);
      const { google, how } = await counterpart(ctx, c, input.googleCampaignId, period);
      const pmax = c.type === 'PerformanceMax';
      const parts = partsFor(c.type).filter((p) => !input.parts || input.parts.includes(p));
      const out: Record<string, unknown> = {};
      const errors: Record<string, string> = {};
      const negatives = parts.includes('negatives') || parts.includes('searchterms')
        ? Promise.all([googleDetail(google.id, 'negatives', period, pmax), bingNegatives(ctx.accountId, c.id, ctx.backend)])
        : null;

      await Promise.all(
        parts.map(async (part) => {
          try {
            if (part === 'structure') {
              const [g, b] = await Promise.all([googleDetail(google.id, 'structure', period, pmax), bingStructure(ctx.accountId, c.id, ctx.backend)]);
              const r = compareKeywords(g.data, b);
              out.adGroupsAndKeywords = {
                pairedAdGroups: r.pairs.filter((p) => p.google && p.bing).map((p) => ({ google: p.google!.name, microsoft: p.bing!.name })),
                onlyInGoogle: r.pairs.filter((p) => p.google && !p.bing).map((p) => p.google!.name),
                onlyInMicrosoft: r.pairs.filter((p) => !p.google && p.bing).map((p) => p.bing!.name),
                keywordsMissingInMicrosoft: top(
                  r.missingInBing.map((k) => ({ text: k.text, matchType: MATCH[k.matchType], googleAdGroup: k.googleGroup, microsoftAdGroup: k.bingGroup, googleClicks: k.metrics?.clicks, googleConversions: k.metrics?.conversions })),
                  80,
                ),
                inAnotherAdGroupOrPaused: top(r.elsewhereInBing.map((k) => ({ text: k.text, googleAdGroup: k.googleGroup, microsoft: k.found })), 40),
                matchTypeDifferences: top(r.matchTypeDiffs, 40),
                onlyInMicrosoft_keywords: top(r.onlyInBing, 40),
              };
            } else if (part === 'negatives') {
              const [g, b] = (await negatives)!;
              const r = compareNegatives(g.data, b);
              out.negativeKeywords = {
                googleTotal: r.googleTotal,
                coveredInMicrosoft: r.covered,
                weakerInMicrosoft: r.weaker,
                missingInMicrosoft: top(
                  r.missingInBing.map((n) => ({
                    text: n.text,
                    addAs: MATCH[n.suggested],
                    google: `${MATCH[n.matchType]} · ${n.sources.join(', ')}`,
                    microsoftTarget: n.target.kind === 'campaign' ? 'campaign' : n.target.group ? { adGroup: n.target.group } : 'no matching ad group – ask the user',
                  })),
                  300,
                ),
                onlyInMicrosoft: top(r.onlyInBing.map((n) => n.text), 40),
              };
            } else if (part === 'products') {
              if (pmax) {
                const [g, b] = await Promise.all([googleDetail(google.id, 'products', period, true), bingProducts(ctx.accountId, c.id, true, ctx.backend)]);
                const r = compareExclusions(g.data, b);
                out.productGroups = { note: 'Performance Max: only the excluded products are compared, and they cannot be changed from here yet.', excludedInGoogle: r.googleTotal, alsoInMicrosoft: r.covered, missingInMicrosoft: top(r.missingInBing, 60) };
              } else {
                const { plan } = await productPlan(ctx, c, google, period);
                out.productGroups = {
                  howToFix: 'match_product_groups_to_google makes these changes in Microsoft (it works the item ids out itself).',
                  adGroups: plan.map((m: MirrorGroup) => ({
                    google: m.googleGroup,
                    microsoft: m.bingGroup,
                    status: m.status,
                    ...(m.reason ? { reason: m.reason } : {}),
                    ...(m.rows.length
                      ? {
                          changes: Object.fromEntries(Object.entries(m.rows.reduce<Record<string, number>>((acc, r) => ({ ...acc, [r.action]: (acc[r.action] ?? 0) + 1 }), {}))),
                          examples: m.rows.slice(0, 8).map((r) => r.label),
                          splitsMicrosoftAllProducts: m.convert,
                        }
                      : {}),
                  })),
                };
              }
            } else if (part === 'searchterms') {
              const [[gn, bn], g, b] = await Promise.all([negatives!, googleDetail(google.id, 'searchterms', period, pmax), bingSearchTerms(ctx.accountId, c.id, period, ctx.backend)]);
              const r = compareSearchTerms(g.data, b, gn.data.negatives, bn.negatives);
              out.searchTerms = {
                note: 'Both platforms hide search terms with very low volume – a term missing from one report did not necessarily miss ads.',
                paidInMicrosoftButExcludedInGoogle: top(r.excludedInGoogleOnly.map((t) => ({ term: t.term, spend: t.spend, clicks: t.clicks, conversions: t.conversions, googleNegative: t.negative.text })), 60),
                convertingInGoogleNotInMicrosoftReport: top(r.convertingOnlyInGoogle.map((t) => ({ term: t.term, googleConversions: t.conversions, googleRevenue: t.revenue, googleClicks: t.clicks })), 60),
              };
            } else if (part === 'ads') {
              const [g, b] = await Promise.all([googleDetail(google.id, 'ads', period, pmax), bingAds(ctx.accountId, c.id, ctx.backend)]);
              const diffs = compareAds(g.data, b).filter((d) => !d.bingGroup || d.missingHeadlines.length || d.missingDescriptions.length || d.urlsOnlyGoogle.length || d.urlsOnlyBing.length);
              out.ads = top(diffs, 40);
            }
          } catch (e) {
            errors[part] = e instanceof Error ? e.message : String(e);
          }
        }),
      );

      return {
        result: {
          microsoft: { id: c.id, name: c.name, type: c.type, status: c.status, dailyBudget: c.dailyBudget, bidStrategy: c.bidStrategy.type },
          google: { id: google.id, name: google.name, channel: google.channel, status: google.status, dailyBudget: google.dailyBudget, bidStrategy: google.bidStrategy, howMatched: how },
          period,
          ...out,
          ...(Object.keys(errors).length ? { couldNotCompare: errors } : {}),
          rules: 'Google is read only – never suggest changing it. Fix Microsoft through approval cards. In a 1:1 matchup do not change bid strategy, budget, targets or status unless the user asks; the settings above are for context.',
        },
        summary: `Sammenlignet med "${google.name}" (Google, kun læsning)`,
      };
    },
  }),

  defineWrite({
    name: 'match_product_groups_to_google',
    kind: 'write',
    description:
      'Make a Shopping campaign\'s product groups in Microsoft like its Google Ads counterpart\'s: per ad group the same item ids bid on or excluded, and the same "everything else". The tool reads both trees and works the changes out itself – do not list item ids. Microsoft\'s "Alle produkter" is split by item id when Google is; a split Microsoft ad group gets only the differences (its other items keep their bids and history). Removing items Google does not split out, or undoing a split, starts unticked on the card. New item ids get the bid the ad group\'s units already use most. Trees split by brand, product type or several levels are reported and left alone. Only Microsoft is changed – Google is read only. Bid strategy, budgets and campaign settings are not touched.',
    schema: z.object({
      campaignId: z.string().describe('The Microsoft Shopping campaign.'),
      googleCampaignId: z.string().optional().describe('The Google campaign, if not the one matched on the Audit page.'),
      adGroupIds: z.array(z.string()).max(200).optional().describe('Only these Microsoft ad groups (default: all).'),
      skip: z.array(z.string()).max(20_000).optional().describe('Leave out – filled in from what the user ticks off on the card.'),
      reason: z.string().describe('Why, in Danish – shown on the approval card.'),
    }),
    label: () => 'Retter produktgrupper som i Google',
    async plan(input, ctx) {
      const c = await getCampaign(ctx, input.campaignId);
      if (c.type === 'PerformanceMax') throw new Error('Performance Max-listinggrupper kan ikke ændres herfra endnu – kun Shopping-kampagners produktgrupper.');
      if (c.type !== 'Shopping') throw new Error(`"${c.name}" er en ${c.type}-kampagne – produktgrupper findes kun i Shopping-kampagner.`);
      if (!ctx.backend.applyProductPartitionActions) throw new Error('Produktgrupper kan kun ændres på den rigtige Microsoft-konto (ikke demo).');
      const period = resolvePeriod(undefined, ctx);
      const { google, how } = await counterpart(ctx, c, input.googleCampaignId, period);
      const { plan } = await productPlan(ctx, c, google, period);
      const only = input.adGroupIds?.length ? new Set(input.adGroupIds.map(String)) : null;
      const groups = plan.filter((g) => !only || (g.bingAdGroupId && only.has(g.bingAdGroupId)));
      const skip = new Set(input.skip ?? []);
      const working = groups.filter((g) => g.status === 'changes');
      const lines: ChangeLine[] = working.flatMap((g) =>
        g.rows
          .filter((r) => !skip.has(r.key))
          .map((r) => ({
            entity: 'Produktgruppe',
            entityId: g.bingAdGroupId!,
            field: `${g.bingGroup} · ${r.label}`,
            after: r.itemId || (r.action === 'all' || r.action === 'collapse' ? 'Alle produkter' : 'Alt andet'),
            cells: {
              group: g.bingGroup,
              kind: TAG[r.action],
              why: r.label,
              bid: ['add_bid', 'to_bid', 'else_bid', 'all', 'collapse'].includes(r.action) ? g.bid : null,
            },
            pickKey: r.key,
            pickOff: r.defaultOff,
          })),
      );
      if (!lines.length) {
        const left = groups.filter((g) => g.status !== 'same').map((g) => `${g.googleGroup}: ${g.reason ?? 'ingen ændringer valgt'}`);
        throw new Error(`Ingen produktgrupper at rette – Microsoft ligner Google${left.length ? `, bortset fra: ${left.join(' · ')}` : ''}.`);
      }
      const notes = [
        `Google-kampagnen "${google.name}" er ${how}. Google ændres ikke – det læses kun.`,
        ...working.filter((g) => g.convert).map((g) => `"${g.bingGroup}": Microsofts "Alle produkter" opdeles efter varenummer, ligesom i Google.`),
        ...working.filter((g) => g.bid).map((g) => `"${g.bingGroup}": nye varenumre, der bydes på, får ${g.bid} kr. pr. klik (det bud, gruppens produkter oftest har).`),
        ...groups.filter((g) => g.status === 'unsupported' || g.status === 'missing').map((g) => `Ikke med – "${g.googleGroup}": ${g.reason}`),
        'Ændringer af produktgrupper kan ikke fortrydes med ét klik.',
      ];
      const increases = lines.some((l) => l.cells?.kind === 'Byd' || l.cells?.kind === 'Alle');
      return {
        plan: {
          kind: 'update',
          title: `Produktgrupper som i Google · ${c.name}`,
          reason: input.reason,
          changes: lines,
          dailyBudgetDelta: 0,
          increasesSpend: increases,
          campaignIds: [c.id],
          notes,
          pick: {
            skipPath: ['skip'],
            group: 'group',
            itemLabel: 'Varenummer',
            tag: 'kind',
            tagLabel: 'Handling',
            note: 'why',
            columns: [{ key: 'bid', label: 'Bud', format: 'money' }],
            approveLabel: 'Udfør {n} ændringer i Microsoft',
          },
        },
        execute: async () => {
          const chosen = new Set(lines.map((l) => l.pickKey!));
          const confirmed: string[] = [];
          const missing: string[] = [];
          const failed: string[] = [];
          const applied: ChangeLine[] = [];
          // One call per ad group (Microsoft's rule) – a group that fails leaves the others untouched.
          for (const g of working) {
            const mine = new Set(g.rows.filter((r) => chosen.has(r.key)).map((r) => r.key));
            if (!mine.size) continue;
            try {
              const actions = buildActions(g, mine);
              if (!actions.length) continue;
              await ctx.backend.applyProductPartitionActions!(ctx.accountId, actions);
            } catch (e) {
              failed.push(`"${g.bingGroup}": ${e instanceof Error ? e.message : String(e)}`);
              continue;
            }
            const after = toListingNodes(await ctx.backend.listProductPartitions!(ctx.accountId, g.bingAdGroupId!, g.bingGroup!));
            const v = verifyMirror(g, mine, shapeOf(after));
            confirmed.push(...v.confirmed.map((t) => `${g.bingGroup}: ${t}`));
            missing.push(...v.missing.map((t) => `${g.bingGroup}: ${t}`));
            applied.push(...lines.filter((l) => l.entityId === g.bingAdGroupId && v.confirmed.some((t) => l.field.endsWith(t))));
          }
          const outcome = failed.length || missing.length ? (confirmed.length ? 'partial' : 'failed') : 'confirmed';
          return {
            result: {
              outcome,
              verifiedByReadBack: true,
              confirmed: confirmed.length,
              ...(missing.length ? { notConfirmed: missing } : {}),
              ...(failed.length ? { failed } : {}),
              instruction:
                outcome === 'confirmed'
                  ? 'Microsoft confirms every change. Google was not touched.'
                  : 'Tell the user exactly which ad groups failed or were not confirmed, and why. Google was not touched.',
            },
            summary: outcome === 'confirmed' ? `Bekræftet hos Microsoft: ${confirmed.length} ændringer` : `${confirmed.length} bekræftet · ${failed.length + missing.length} ikke gennemført`,
            changes: applied,
          };
        },
      };
    },
  }),
];
