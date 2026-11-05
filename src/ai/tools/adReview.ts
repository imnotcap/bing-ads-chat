/**
 * review_ad_copy: the assistant checks a draft responsive search ad before it proposes it
 * (src/ai/adCopy.ts has the rules). The same review runs again inside
 * create_responsive_search_ad, so what reaches the approval card has been through it.
 */
import { z } from 'zod';
import { addDays, today } from '@/lib/format';
import { reviewAd, type EvidenceItem, type Pin, type Review, type ReviewInput } from '../adCopy';
import { defineRead, getAdGroup, getCampaign, getKeywords, getReport, type ToolContext } from './context';

export const evidenceSchema = z
  .array(
    z.object({
      claim: z.string().max(200).describe('The claim as written in the ad, e.g. "Fri fragt over 499 kr".'),
      quote: z.string().max(300).describe('A short quote copied from the landing page that backs it, e.g. "Fri fragt ved køb over 499 kr.". The number and unit in the ad must be in the quote.'),
      url: z.string().max(500).optional().describe('The page the quote is from.'),
    }),
  )
  .max(20)
  .optional()
  .describe('Proof for every factual claim in the ad (price, free shipping, delivery time, guarantee, return period …), quoted from the landing page you read with web_fetch. Claims without a quote are flagged.');

const last90 = () => ({ from: addDays(today(), -89), to: today() });

const pins = (list: string[] | undefined, n: number): Pin[] => Array.from({ length: n }, (_, i) => (Number(list?.[i]) || null) as Pin);

/** What the ad must be held up against: the ad group's active keywords (weighted by 90 days of clicks) and its other ads. */
export async function adReviewContext(ctx: ToolContext, campaignId: string, adGroupId: string): Promise<Pick<ReviewInput, 'keywords' | 'existing'>> {
  const group = await getAdGroup(ctx, campaignId, adGroupId);
  const keywords = (await getKeywords(ctx, group.id).catch(() => [])).filter((k) => k.status === 'Active');
  const clicks = new Map<string, number>();
  try {
    for (const r of await getReport(ctx, { kind: 'keyword', range: last90(), aggregation: 'Summary', campaignIds: [campaignId] }))
      if (r.adGroupId === group.id && r.keyword) clicks.set(r.keyword.toLowerCase(), (clicks.get(r.keyword.toLowerCase()) ?? 0) + (r.clicks ?? 0));
  } catch {
    /* no report: every keyword counts the same */
  }
  const existing = (await ctx.backend.listAds(ctx.accountId, group.id).catch(() => [])).map((a) => ({
    headlines: a.headlines,
    descriptions: a.descriptions,
    enabled: a.status === 'Active',
  }));
  return {
    keywords: keywords.map((k) => ({ text: k.text, weight: 1 + (clicks.get(k.text.toLowerCase()) ?? 0) })),
    existing,
  };
}

/** The review as the assistant gets it: what to fix first, and the numbers behind it. */
export function reviewResult(review: Review) {
  const by = (level: string) => review.issues.filter((i) => i.level === level).map((i) => i.text);
  const errors = by('error');
  const warnings = by('warning');
  return {
    verdict: errors.length ? 'blocked' : warnings.length ? 'fix_before_proposing' : 'ok',
    errors,
    warnings,
    tips: by('tip'),
    headlines: review.headlineCount,
    shortHeadlines: review.shortHeadlines,
    keywordCoverage: review.keywordCoverage ? { ...review.keywordCoverage, share: Math.round(review.keywordCoverage.share * 100) } : null,
    claims: review.claims,
    angles: Object.fromEntries(Object.entries(review.angles).map(([k, v]) => [k, v.length])),
    instruction:
      errors.length || warnings.length
        ? 'Rewrite the ad to fix every error and warning – change the texts, do not argue with the checker – and review it again before you propose it. Tips are advice: apply the ones that fit and say which you left out and why.'
        : 'The ad passes. Apply the tips that fit, then propose it with create_responsive_search_ad (pass the same evidence).',
  };
}

export const adReviewTools = [
  defineRead({
    name: 'review_ad_copy',
    kind: 'read',
    description:
      'Check a DRAFT responsive search ad before you propose it. It tests what Microsoft requires (pinning must leave every position fillable), what its style rules reject (exclamation marks, capitals, urgency, repeated words, phone numbers, unproven superlatives), whether every factual claim is backed by a quote from the landing page, how much of the ad group\'s keywords (weighted by clicks) the texts contain, near-duplicate headlines, the mix of angles (offer, trust, call to action), and how the ad relates to the other ads in the group. Returns errors and warnings to fix – and tips. Always call it with your draft (all headlines in order, the keyword headline first) and the evidence for your claims, fix what it flags, and only then call create_responsive_search_ad. It changes nothing.',
    schema: z.object({
      campaignId: z.string(),
      adGroupId: z.string(),
      headlines: z.array(z.string().min(1).max(100)).min(3).max(15).describe('All headlines in order – headline 1 (the keyword) first.'),
      headlinePins: z.array(z.enum(['', '1', '2', '3'])).max(15).optional().describe('Per headline: "" = any position, "1"–"3" = pinned. Headline 1 is normally pinned to "1".'),
      descriptions: z.array(z.string().min(1).max(200)).min(2).max(4),
      descriptionPins: z.array(z.enum(['', '1', '2'])).max(4).optional(),
      evidence: evidenceSchema,
    }),
    label: () => 'Gennemgår annoncetekst',
    async run(input, ctx) {
      const c = await getCampaign(ctx, input.campaignId);
      const g = await getAdGroup(ctx, c.id, input.adGroupId);
      const evidence: EvidenceItem[] = input.evidence ?? [];
      const review = reviewAd({
        headlines: input.headlines,
        headlinePins: pins(input.headlinePins, input.headlines.length),
        descriptions: input.descriptions,
        descriptionPins: pins(input.descriptionPins, input.descriptions.length),
        evidence,
        ...(await adReviewContext(ctx, c.id, g.id)),
      });
      const result = reviewResult(review);
      return {
        result: { campaign: { id: c.id, name: c.name }, adGroup: { id: g.id, name: g.name }, ...result },
        summary: `${result.errors.length} fejl · ${result.warnings.length} advarsler · ${result.tips.length} tips`,
      };
    },
  }),
];

