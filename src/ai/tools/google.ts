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
import { daysBetween, fmtMoney } from '@/lib/format';
import type { AdGroup, Campaign, PartitionAction } from '@/bing/types';
import { bingAds, bingNegatives, bingProducts, bingSearchTerms, bingShownItems, bingStructure, toListingNodes } from '@/features/audit/bingDetail';
import { byShown, compareAds, compareExclusions, compareKeywords, compareNegatives, compareSearchTerms } from '@/features/audit/compare';
import type { GoogleCampaign } from '@/features/audit/data';
import { SHOWN_DAYS, type DListingNode, type DetailPart, type ShownItems } from '@/features/audit/detail';
import { rankCandidates, suggestMatch } from '@/features/audit/match';
import { settingsFacts } from '@/features/audit/settings';
import { buildActions, compareProductTrees, planEdit, planMirror, performsWell, shapeOf, stateText, statsText, verifyMirror, type ItemState, type MirrorAction, type MirrorGroup } from '@/features/audit/productMirror';
import type { ChangeLine } from '@/stores/activity';
import { auditGoogleMatch, googleCampaigns, googleDetail, requireGoogle } from '../googleSource';
import { PERIOD_DESCRIPTION, defineRead, defineWrite, getAdGroups, getCampaign, getReport, memo, resolvePeriod, type ExecutionResult, type ToolContext } from './context';

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
  if (type === 'Shopping') return ['products'];
  if (type === 'PerformanceMax') return ['products', 'negatives'];
  return ['negatives'];
}

const top = <T,>(list: T[], n: number) => ({ count: list.length, items: list.slice(0, n), ...(list.length > n ? { more: list.length - n } : {}) });

const MATCH = { exact: 'Exact', phrase: 'Phrase', broad: 'Broad' } as const;

/** Microsoft's ad groups and the product trees of a Shopping campaign, and the plan to make them like Google's. */
async function productPlan(ctx: ToolContext, bing: Campaign, google: GoogleCampaign, range: { from: string; to: string }, includeUnshown = false) {
  if (!ctx.backend.listProductPartitions) throw new Error('Produktgrupper kan kun læses fra den rigtige Microsoft-konto (ikke demo).');
  const [g, groups, nodes, shown] = await Promise.all([
    googleDetail(google.id, 'products', range, false),
    getAdGroups(ctx, bing.id),
    bingProducts(ctx.accountId, bing.id, false, ctx.backend),
    shownItems(ctx, bing.id, includeUnshown),
  ]);
  const live = groups.filter((x: AdGroup) => x.status !== 'Deleted');
  // An item Google leaves out stays when it earns at least the campaign's own ROAS target here.
  const opts = { keepRoas: bing.bidStrategy.targetRoas ?? 1, currency: ctx.currency };
  return { plan: planMirror(g.data, nodes, live.map((x) => ({ id: x.id, name: x.name, cpcBid: x.cpcBid })), shown.items, opts), shown, google: g.data, bing: nodes };
}

/**
 * The products the campaign showed in Microsoft (last SHOWN_DAYS days): an item Google
 * excludes but Microsoft never showed needs no exclusion. When the report cannot be read,
 * every exclusion is kept – and the reason is passed on.
 */
async function shownItems(ctx: ToolContext, campaignId: string, skip: boolean): Promise<{ items: ShownItems | null; error?: string }> {
  if (skip) return { items: null };
  try {
    return { items: await memo(ctx, `shown:${campaignId}`, () => bingShownItems(ctx.accountId, campaignId, ctx.backend)) };
  } catch (e) {
    return { items: null, error: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * The campaign's overall setup on both sides – strategy, target, budget, what it delivers
 * and (Microsoft) the share of impressions it loses to budget and to rank – as plain facts.
 */
async function settingsOf(ctx: ToolContext, c: Campaign, g: GoogleCampaign, range: { from: string; to: string }) {
  const days = daysBetween(range.from, range.to);
  const rows = await getReport(ctx, { kind: 'impressionshare', range, aggregation: 'Summary', campaignIds: [c.id] }).catch(() => getReport(ctx, { kind: 'campaign', range, aggregation: 'Summary', campaignIds: [c.id] }));
  const r = rows.find((x) => x.campaignId === c.id) ?? rows[0];
  const metrics = { impressions: r?.impressions ?? 0, clicks: r?.clicks ?? 0, spend: r?.spend ?? 0, conversions: r?.conversions ?? 0, revenue: r?.revenue ?? 0 };
  return {
    period: range,
    facts: settingsFacts({
      currency: ctx.currency,
      days,
      microsoft: { bidStrategy: c.bidStrategy, dailyBudget: c.dailyBudget, metrics, impressionShare: r?.impressionShare ?? null, lostToBudget: r?.lostToBudget ?? null, lostToRank: r?.lostToRank ?? null },
      google: { bidStrategy: g.bidStrategy, targetRoas: g.targetRoas, targetCpa: g.targetCpa, dailyBudget: g.dailyBudget, metrics: g.metrics },
    }),
    assess:
      'Judge the setup from these facts and give ONE short recommendation each for bid strategy/target, budget and bids: keep, or change to what and why (with the number behind it). Microsoft has less data than Google – copying Google\'s target is not automatically right. Change nothing until the user says yes; then use update_campaigns (strategy, target, budget) or update_ad_groups/update_keywords (bids, never under the lowest CPC bid).',
  };
}


/**
 * Sends each ad group's chosen rows to Microsoft – one call per ad group, all or nothing –
 * and reads the tree back: only what Microsoft shows afterwards counts as done.
 */
/** How a product tree is sent and read back: Shopping ad groups, or Performance Max asset groups. */
interface TreeIO {
  apply: (actions: PartitionAction[]) => Promise<unknown>;
  read: (group: MirrorGroup) => Promise<DListingNode[]>;
}

const shoppingIO = (ctx: ToolContext): TreeIO => ({
  apply: (actions) => ctx.backend.applyProductPartitionActions!(ctx.accountId, actions),
  read: async (g) => toListingNodes(await ctx.backend.listProductPartitions!(ctx.accountId, g.bingAdGroupId!, g.bingGroup!)),
});

const pmaxIO = (ctx: ToolContext, campaignId: string): TreeIO => ({
  apply: (actions) => ctx.backend.applyAssetGroupListingGroupActions!(ctx.accountId, actions),
  read: async (g) => toListingNodes(await ctx.backend.listAssetGroupListingGroups!(ctx.accountId, campaignId)).filter((n) => n.groupId === g.bingAdGroupId),
});

async function applyGroups(ctx: ToolContext, groups: MirrorGroup[], lines: ChangeLine[], also: string, io: TreeIO = shoppingIO(ctx)): Promise<ExecutionResult> {
  const chosen = new Set(lines.map((l) => l.pickKey!));
  const confirmed: string[] = [];
  const missing: string[] = [];
  const failed: string[] = [];
  const applied: ChangeLine[] = [];
  for (const g of groups) {
    const mine = new Set(g.rows.filter((r) => chosen.has(r.key)).map((r) => r.key));
    if (!mine.size) continue;
    try {
      const actions = buildActions(g, mine);
      if (!actions.length) continue;
      await io.apply(actions);
    } catch (e) {
      failed.push(`"${g.bingGroup}": ${e instanceof Error ? e.message : String(e)}`);
      continue;
    }
    const after = await io.read(g);
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
      instruction: outcome === 'confirmed' ? `Microsoft confirms every change. ${also}` : `Tell the user exactly which ad groups failed or were not confirmed, and why. ${also}`,
    },
    summary: outcome === 'confirmed' ? `Bekræftet hos Microsoft: ${confirmed.length} ændringer` : `${confirmed.length} bekræftet · ${failed.length + missing.length} ikke gennemført`,
    changes: applied,
  };
}

/** A row of the product group card. */
const cardLine = (g: MirrorGroup, r: MirrorGroup['rows'][number], skip: Set<string>): ChangeLine | null =>
  skip.has(r.key)
    ? null
    : {
        entity: 'Produktgruppe',
        entityId: g.bingAdGroupId!,
        field: `${g.bingGroup} · ${r.label}`,
        after: r.itemId || (r.action === 'all' || r.action === 'collapse' ? 'Alle produkter' : 'Alt andet'),
        cells: { group: g.bingGroup, groupId: g.bingAdGroupId, kind: TAG[r.action], why: r.label, bid: BID_ROWS.includes(r.action) ? (r.bid ?? g.bid) : null },
        pickKey: r.key,
        pickOff: r.defaultOff,
      };

const BID_ROWS: MirrorAction[] = ['add_bid', 'to_bid', 'rebid', 'else_bid', 'all', 'collapse'];

const PICK = {
  skipPath: ['skip'],
  group: 'group',
  itemLabel: 'Varenummer',
  tag: 'kind',
  tagLabel: 'Handling',
  note: 'why',
  columns: [{ key: 'bid', label: 'Bud', format: 'money' as const }],
  groupBid: { idCell: 'groupId', valueCell: 'bid', path: ['bids'], label: 'Bud' },
  approveLabel: 'Udfør {n} ændringer i Microsoft',
};

/* ------------------------------------ tools ------------------------------------ */

const TAG: Record<MirrorAction, string> = {
  add_bid: 'Byd',
  add_exclude: 'Udeluk',
  to_bid: 'Byd',
  to_exclude: 'Udeluk',
  rebid: 'Bud',
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
      'Compare a Microsoft Advertising campaign 1:1 with its Google Ads counterpart (read only – nothing in Google can ever be changed). Reads both campaigns in full and returns every difference: ad groups paired by name, keywords missing in Microsoft (with Google\'s numbers), in another ad group or paused, match type differences; negative keywords missing (with the Microsoft ad group or campaign each belongs on); product groups per ad group (item ids bid on or excluded in Google but not in Microsoft, and "everything else"); search terms Microsoft pays for that Google excludes, and ones converting in Google only; ads (headlines, descriptions, landing pages Google uses and Microsoft does not). The Google campaign is the one matched on the Audit page, else the one with the same name – or pass googleCampaignId. Then fix Microsoft with: match_product_groups_to_google (item ids), propose_negative_keywords (negatives, with the ad group given here), add_keywords, review_ad_copy + create_responsive_search_ad / update_ads. It also returns the setup on both sides (strategy, target, budget, delivery, impression share lost to budget/rank) as facts – give a recommendation on it, but change the setup only when the user says yes.',
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
      const setup = settingsOf(ctx, c, google, period).catch((e: unknown) => ({ error: e instanceof Error ? e.message : String(e) }));
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
                const [g, b, shown] = await Promise.all([googleDetail(google.id, 'products', period, true), bingProducts(ctx.accountId, c.id, true, ctx.backend), shownItems(ctx, c.id, false)]);
                const r = compareExclusions(g.data, b);
                const split = shown.items ? byShown(r.missingInBing, shown.items) : { matter: r.missingInBing, unshown: [] };
                out.productGroups = {
                  note: 'Performance Max: only the excluded products are compared, and they cannot be changed from here yet.',
                  excludedInGoogle: r.googleTotal,
                  alsoInMicrosoft: r.covered,
                  missingInMicrosoft: top(split.matter, 60),
                  ...(split.unshown.length ? { notShownInMicrosoft: { count: split.unshown.length, note: `Excluded in Google, but Microsoft has not shown these item ids in the last ${SHOWN_DAYS} days – excluding them changes nothing, so they are not missing.` } } : {}),
                  ...(shown.error ? { couldNotCheckShown: shown.error } : {}),
                };
              } else {
                const { plan, shown, google: gNodes, bing: bNodes } = await productPlan(ctx, c, google, period);
                const unshown = plan.reduce((n, m) => n + m.unshown.length, 0);
                const diffs = compareProductTrees(gNodes, bNodes);
                const text = (st: ItemState) => stateText(st, ctx.currency).text + (st.via === 'else' ? ' (via alt andet)' : st.via === 'all' ? ' (alle produkter)' : '');
                out.productGroups = {
                  howToFix: 'match_product_groups_to_google makes Microsoft like Google (it reads both trees and uses Google\'s bids); create missing ad groups with create_ad_group.',
                  adGroups: diffs.map((d) => ({
                    google: d.googleGroup,
                    microsoft: d.bingGroup,
                    status: d.status === 'missing' ? 'missing in Microsoft' : d.status === 'extra' ? 'only in Microsoft' : d.status,
                    ...(d.reason ? { reason: d.reason } : {}),
                    ...(d.googleStatus && d.bingStatus && d.googleStatus !== d.bingStatus ? { adGroupStatus: { google: d.googleStatus, microsoft: d.bingStatus } } : {}),
                    ...(d.status === 'compared'
                      ? { differences: d.diffs.slice(0, 60).map((x) => ({ item: x.itemId || 'all other products', google: text(x.google), microsoft: text(x.bing) })), ...(d.diffs.length > 60 ? { more: d.diffs.length - 60 } : {}), same: d.same }
                      : {}),
                  })),
                  ...(unshown
                    ? { notShownInMicrosoft: `${unshown} item ids are excluded in Google but Microsoft has not shown them in the ad group in the last ${SHOWN_DAYS} days – excluding them changes nothing, so they are left out of the changes.` }
                    : {}),
                  ...(shown.error ? { couldNotCheckShown: shown.error } : {}),
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
          setup: await setup,
          ...out,
          ...(Object.keys(errors).length ? { couldNotCompare: errors } : {}),
          rules: 'Google is read only – never suggest changing it. Fix Microsoft through approval cards. Recommend on the setup (setup.assess), but change bid strategy, budget, targets or status only when the user says yes.',
        },
        summary: `Sammenlignet med "${google.name}" (Google, kun læsning)`,
      };
    },
  }),

  defineRead({
    name: 'list_product_groups',
    kind: 'read',
    description:
      'Read a Microsoft Shopping campaign\'s product groups (product partitions) per ad group: whether the tree is "Alle produkter", split by item id (each item id with its bid or excluded, and "everything else"), or split some other way. Use this – never microsoft_ads_api – to read product groups. Change them with edit_product_groups (what the user names) or match_product_groups_to_google (like Google).',
    schema: z.object({
      campaignId: z.string().describe('The Microsoft Shopping campaign.'),
      adGroupId: z.string().optional().describe('Only this ad group.'),
    }),
    label: () => 'Læser produktgrupper',
    async run(input, ctx) {
      const c = await getCampaign(ctx, input.campaignId);
      if (c.type !== 'Shopping') throw new Error(`"${c.name}" er en ${c.type}-kampagne – produktgrupper findes kun i Shopping-kampagner.`);
      if (!ctx.backend.listProductPartitions) throw new Error('Produktgrupper kan kun læses fra den rigtige Microsoft-konto (ikke demo).');
      const groups = (await getAdGroups(ctx, c.id)).filter((g) => g.status !== 'Deleted' && (!input.adGroupId || g.id === String(input.adGroupId)));
      const MAX = 400;
      const adGroups = await Promise.all(
        groups.map(async (g) => {
          const shape = shapeOf(toListingNodes(await ctx.backend.listProductPartitions!(ctx.accountId, g.id, g.name)));
          const unit = (n: { excluded: boolean; bid?: number | null }) => (n.excluded ? 'excluded' : { bid: n.bid ?? null });
          if (shape.kind === 'none') return { adGroup: g.name, id: g.id, tree: 'none' };
          if (shape.kind === 'other') return { adGroup: g.name, id: g.id, tree: 'other', why: shape.why };
          if (shape.kind === 'all') return { adGroup: g.name, id: g.id, tree: 'all products', allProducts: unit(shape.root) };
          const items = [...shape.items.values()].map((n) => ({ itemId: n.raw || n.value, ...(n.excluded ? { excluded: true } : { bid: n.bid ?? null }) }));
          return { adGroup: g.name, id: g.id, tree: 'by item id', everythingElse: unit(shape.other), itemCount: items.length, items: items.slice(0, MAX), ...(items.length > MAX ? { more: items.length - MAX } : {}) };
        }),
      );
      return { result: { campaign: c.name, adGroups }, summary: `${adGroups.length} ${adGroups.length === 1 ? 'annoncegruppe' : 'annoncegrupper'} læst` };
    },
  }),

  defineWrite({
    name: 'edit_product_groups',
    kind: 'write',
    description:
      'Change product groups in ONE Microsoft ad group exactly as the user asks – exclude item ids, bid on item ids, change the bid of item ids (or "alt andet"), or remove an item\'s own product group (it falls under "everything else") – e.g. "ekskludér 2515012108 & 2392163005 under Flipover", "sæt buddet på 2392164005 til 12 kr.". Shopping: an ad group. Performance Max: an asset group (adGroupId = the asset group id; listing groups have no bids – exclude, include and remove only). Works whether the group takes "Alle produkter" (split by item id, the rest stays as it is) or is already split. Get ids from list_product_groups or find_campaigns_and_ad_groups. Shows a card the user approves; sent to Microsoft in one call for the group and read back. Never use microsoft_ads_api for product groups. Only Microsoft is changed.',
    schema: z.object({
      campaignId: z.string().describe('The Microsoft Shopping or Performance Max campaign.'),
      adGroupId: z.string().describe('The ad group (Shopping) or asset group (Performance Max) whose product groups change.'),
      exclude: z.array(z.string().min(1).max(100)).max(500).optional().describe('Item ids to exclude.'),
      include: z.array(z.string().min(1).max(100)).max(500).optional().describe('Item ids to bid on as their own product group.'),
      remove: z.array(z.string().min(1).max(100)).max(500).optional().describe('Item ids whose own product group is removed (they fall under "everything else").'),
      setBid: z.array(z.string().min(1).max(100)).max(500).optional().describe('Item ids already bid on whose bid becomes `bid` ("alt andet" = everything else). Shopping only.'),
      bid: z.number().positive().max(1000).optional().describe('CPC bid – for setBid, and for the item ids bid on when the user names one (default: the bid the group\'s items use most). Shopping only.'),
      bids: z.record(z.string(), z.number().positive().max(1000)).optional().describe('Leave out – set on the card.'),
      skip: z.array(z.string()).max(2000).optional().describe('Leave out – filled in from what the user ticks off on the card.'),
      reason: z.string().describe('Why, in Danish – shown on the approval card.'),
    }),
    label: () => 'Retter produktgrupper',
    async plan(input, ctx) {
      const c = await getCampaign(ctx, input.campaignId);
      const pmax = c.type === 'PerformanceMax';
      if (c.type !== 'Shopping' && !pmax) throw new Error(`"${c.name}" er en ${c.type}-kampagne – produktgrupper findes kun i Shopping- og Performance Max-kampagner.`);
      if (pmax ? !ctx.backend.applyAssetGroupListingGroupActions || !ctx.backend.listAssetGroupListingGroups : !ctx.backend.applyProductPartitionActions || !ctx.backend.listProductPartitions)
        throw new Error('Produktgrupper kan kun ændres på den rigtige Microsoft-konto (ikke demo).');
      if (!input.exclude?.length && !input.include?.length && !input.remove?.length && !input.setBid?.length) throw new Error('Angiv hvilke varenumre der skal udelukkes, bydes på, have nyt bud eller fjernes.');
      // The group and its tree: an ad group's product groups, or an asset group's listing groups.
      let ag: { id: string; name: string; cpcBid?: number | null };
      let nodes: DListingNode[];
      if (pmax) {
        const all = toListingNodes(await ctx.backend.listAssetGroupListingGroups!(ctx.accountId, c.id));
        nodes = all.filter((n) => n.groupId === String(input.adGroupId));
        if (!nodes.length) {
          const names = [...new Set(all.map((n) => `"${n.group}" (id ${n.groupId})`))];
          throw new Error(`Asset group ${input.adGroupId} har ingen listinggrupper i "${c.name}".${names.length ? ` Asset groups: ${names.join(', ')}.` : ''}`);
        }
        ag = { id: String(input.adGroupId), name: nodes[0]!.group };
      } else {
        const found = (await getAdGroups(ctx, c.id)).find((g) => g.id === String(input.adGroupId));
        if (!found) throw new Error(`Annoncegruppe ${input.adGroupId} findes ikke i "${c.name}". Find den med list_product_groups.`);
        ag = { id: found.id, name: found.name, cpcBid: found.cpcBid };
        nodes = toListingNodes(await ctx.backend.listProductPartitions!(ctx.accountId, found.id, found.name));
      }
      const planned = planEdit(nodes, ag, { exclude: input.exclude, include: input.include, remove: input.remove, setBid: input.setBid, bid: input.bid, noBids: pmax });
      if (planned.status === 'unsupported') throw new Error(planned.reason);
      const group: MirrorGroup = { ...planned, bid: pmax ? null : (input.bids?.[ag.id] ?? planned.bid) };
      const skip = new Set(input.skip ?? []);
      const lines = group.rows.map((r) => cardLine(group, r, skip)).filter((l): l is ChangeLine => !!l);
      if (!lines.length) throw new Error(`Intet at ændre i "${ag.name}". ${planned.notes.join(' ')}`.trim());
      // What the products excluded have done here – a converting one should be a deliberate choice.
      const shown = await shownItems(ctx, c.id, false);
      const warnings = group.rows
        .filter((r) => (r.action === 'add_exclude' || r.action === 'to_exclude') && !skip.has(r.key))
        .flatMap((r) => {
          const st = shown.items?.stats?.get(`${ag.id}|${r.itemId.toLowerCase()}`);
          return st && st.conversions > 0 ? [`${r.itemId} har konverteret: ${statsText(st, ctx.currency)}${performsWell(st, c.bidStrategy.targetRoas ?? 1) ? ' – den klarer sig godt; er udelukkelsen meningen?' : '.'}`] : [];
        });
      const bidding = !pmax && lines.some((l) => l.cells?.bid !== null && l.cells?.bid !== undefined);
      return {
        plan: {
          kind: 'update',
          title: `${pmax ? 'Listinggrupper' : 'Produktgrupper'} · ${ag.name}`,
          reason: input.reason,
          changes: lines,
          dailyBudgetDelta: 0,
          increasesSpend: bidding || lines.some((l) => l.cells?.kind === 'Byd'),
          campaignIds: [c.id],
          newBids: bidding && group.bid ? [group.bid] : [],
          notes: [
            ...(group.convert ? [`"${ag.name}" tager i dag alle produkter: de valgte varenumre får deres egen gruppe, og resten er som før.`] : []),
            ...(lines.some((l) => l.cells?.kind === 'Bud') ? ['Et nyt bud sættes ved at erstatte varenummerets produktgruppe – tallene i rapporterne følger varenummeret.'] : []),
            ...warnings,
            ...planned.notes,
          ],
          pick: pmax ? { ...PICK, columns: [], groupBid: undefined } : PICK,
        },
        execute: () => applyGroups(ctx, [group], lines, '', pmax ? pmaxIO(ctx, c.id) : shoppingIO(ctx)),
      };
    },
  }),

  defineWrite({
    name: 'match_product_groups_to_google',
    kind: 'write',
    description:
      'Make a Shopping campaign\'s product groups in Microsoft like its Google Ads counterpart\'s: per ad group the same item ids bid on or excluded, and the same "everything else". The tool reads both trees and works the changes out itself – do not list item ids. Microsoft\'s "Alle produkter" is split by item id when Google is; a split Microsoft ad group gets only the differences (its other items keep their bids and history). Removing items Google does not split out, or undoing a split, starts unticked on the card. Item ids Microsoft splits out but Google does not (they fall under Google\'s excluded "everything else") are excluded too – unticked when they do well here (converting at the campaign\'s ROAS target or better over 90 days). New item ids get the bid the ad group\'s units already use most. An item Google excludes is only excluded in Microsoft when Microsoft has shown it in that ad group in the last 90 days – excluding a product that never shows changes nothing (includeUnshown: true to exclude those too, only if the user asks). Trees split by brand, product type or several levels are reported and left alone. Only Microsoft is changed – Google is read only. Bid strategy, budgets and campaign settings are not touched.',
    schema: z.object({
      campaignId: z.string().describe('The Microsoft Shopping campaign.'),
      googleCampaignId: z.string().optional().describe('The Google campaign, if not the one matched on the Audit page.'),
      adGroupIds: z.array(z.string()).max(200).optional().describe('Only these Microsoft ad groups (default: all).'),
      includeUnshown: z.boolean().optional().describe('Also exclude item ids Microsoft has not shown in the ad group (default false – only if the user asks).'),
      bids: z
        .record(z.string(), z.number().positive().max(1000))
        .optional()
        .describe('Leave out – the user sets a bid per ad group (Microsoft ad group id → bid) on the card.'),
      bid: z.number().positive().max(1000).optional().describe('CPC bid in the account currency for every item id this call starts bidding on (new, or switched from excluded) and a new "everything else" – only when the user names a bid. Default: the bid the ad group\'s units already use most. Existing units keep their bids.'),
      skip: z.array(z.string()).max(20_000).optional().describe('Leave out – filled in from what the user ticks off on the card.'),
      reason: z.string().describe('Why, in Danish – shown on the approval card.'),
    }),
    label: () => 'Retter produktgrupper som i Google',
    async plan(input, ctx) {
      const c = await getCampaign(ctx, input.campaignId);
      if (c.type === 'PerformanceMax') throw new Error('Spejling efter Google findes kun for Shopping. I Performance Max udelukkes eller tilføjes varenumre pr. asset group med edit_product_groups.');
      if (c.type !== 'Shopping') throw new Error(`"${c.name}" er en ${c.type}-kampagne – produktgrupper findes kun i Shopping-kampagner.`);
      if (!ctx.backend.applyProductPartitionActions) throw new Error('Produktgrupper kan kun ændres på den rigtige Microsoft-konto (ikke demo).');
      const period = resolvePeriod(undefined, ctx);
      const { google, how } = await counterpart(ctx, c, input.googleCampaignId, period);
      const { plan, shown } = await productPlan(ctx, c, google, period, input.includeUnshown);
      const only = input.adGroupIds?.length ? new Set(input.adGroupIds.map(String)) : null;
      const groups = plan.filter((g) => !only || (g.bingAdGroupId && only.has(g.bingAdGroupId)));
      const skip = new Set(input.skip ?? []);
      const chosenBid = (g: MirrorGroup) => (g.bingAdGroupId && input.bids?.[g.bingAdGroupId]) || input.bid || g.bid;
      // A bid the user named (in the request or on the card) wins over Google's own bids for the group.
      const named = (g: MirrorGroup) => !!((g.bingAdGroupId && input.bids?.[g.bingAdGroupId]) || input.bid);
      const working = groups
        .filter((g) => g.status === 'changes')
        .map((g) => ({ ...g, bid: chosenBid(g), rows: named(g) ? g.rows.map((r) => ({ ...r, bid: undefined })) : g.rows }));
      const BIDS: MirrorAction[] = ['add_bid', 'to_bid', 'else_bid', 'all', 'collapse'];
      const bids = working.filter((g) => g.rows.some((r) => BIDS.includes(r.action) && !skip.has(r.key)));
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
              groupId: g.bingAdGroupId,
              kind: TAG[r.action],
              why: r.label,
              bid: BIDS.includes(r.action) ? (r.bid ?? g.bid) : null,
            },
            pickKey: r.key,
            pickOff: r.defaultOff,
          })),
      );
      if (!lines.length) {
        const left = groups.filter((g) => g.status !== 'same').map((g) => `${g.googleGroup}: ${g.reason ?? 'ingen ændringer valgt'}`);
        const unshown = groups.reduce((n, g) => n + g.unshown.length, 0);
        const quiet = unshown ? ` ${unshown} varenumre, som Google udelukker, er ikke udelukket i Microsoft, men Microsoft har ikke vist dem de seneste ${SHOWN_DAYS} dage, så det ændrer intet.` : '';
        throw new Error(`Ingen produktgrupper at rette – Microsoft ligner Google${left.length ? `, bortset fra: ${left.join(' · ')}` : ''}.${quiet}`);
      }
      const notes = [
        `Google-kampagnen "${google.name}" er ${how}. Google ændres ikke – det læses kun.`,
        ...working.filter((g) => g.convert).map((g) => `"${g.bingGroup}": Microsofts "Alle produkter" opdeles efter varenummer, ligesom i Google.`),
        ...bids.map((g) =>
          g.bid
            ? `"${g.bingGroup}": nye bud ${fmtMoney(g.bid, ctx.currency)} (${input.bids?.[g.bingAdGroupId!] ? 'rettet på kortet' : input.bid ? 'det bud, der blev bedt om' : 'gruppens mest brugte bud'}). Andre varenumre beholder deres bud.`
            : `"${g.bingGroup}": har intet bud at gå ud fra – angiv et bud.`,
        ),
        ...groups
          .filter((g) => g.unshown.length)
          .map((g) => `"${g.bingGroup}": ${g.unshown.length} ${g.unshown.length === 1 ? 'varenummer' : 'varenumre'}, som Google udelukker, er ikke med – Microsoft har ikke vist ${g.unshown.length === 1 ? 'det' : 'dem'} i gruppen de seneste ${SHOWN_DAYS} dage, så en udelukkelse ændrer intet.`),
        ...(shown.error ? [`Kunne ikke tjekke, hvilke produkter Microsoft har vist (${shown.error}) – alle Googles udelukkelser er med.`] : []),
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
          newBids: [...new Set(bids.map((g) => g.bid).filter((b): b is number => !!b))],
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
            groupBid: { idCell: 'groupId', valueCell: 'bid', path: ['bids'], label: 'Bud' },
            approveLabel: 'Udfør {n} ændringer i Microsoft',
          },
        },
        execute: () => applyGroups(ctx, working, lines, 'Google was not touched.'),
      };
    },
  }),
];
