/**
 * Research before proposing: what people actually search (Microsoft's search counts and
 * the account's own search terms), what a keyword would cost, whether it already exists –
 * and who the account competes with in the auctions. Every keyword or ad proposal should
 * rest on this instead of on guesses.
 */
import { z } from 'zod';
import type { KeywordBidEstimate, ReportRow, SearchVolume } from '@/bing/types';
import { round } from '@/lib/utils';
import { foreignWords } from '../proofread';
import { defineRead, getReport, resolvePeriod, type ToolContext } from './context';

const fold = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '');
const words = (s: string) => fold(s).split(/[^\p{L}\p{N}]+/u).filter(Boolean);
/** Microsoft treats keywords alike regardless of case, accents and punctuation. */
const same = (a: string, b: string) => words(a).join(' ') === words(b).join(' ');

const last90 = () => {
  const to = new Date().toISOString().slice(0, 10);
  return { from: new Date(Date.now() - 89 * 86_400_000).toISOString().slice(0, 10), to };
};

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

function volumeStats(v: SearchVolume | undefined) {
  if (!v?.months.length) return null;
  const counts = v.months.map((m) => m.searches);
  const recent = avg(counts.slice(-3))!;
  const earlier = avg(counts.slice(0, 3))!;
  return {
    avgMonthly: Math.round(avg(counts)!),
    last3MonthsAvg: Math.round(recent),
    trendPct: counts.length >= 6 && earlier > 0 ? Math.round(((recent - earlier) / earlier) * 100) : null,
    peakMonth: v.months.reduce((a, b) => (b.searches > a.searches ? b : a)).month,
  };
}

/** The account's own search terms that contain every word of the keyword. */
function termEvidence(keyword: string, terms: ReportRow[]) {
  const w = words(keyword);
  const hits = terms.filter((t) => {
    const tw = words(t.searchTerm ?? '');
    return w.every((x) => tw.includes(x));
  });
  const sum = (k: 'clicks' | 'spend' | 'conversions' | 'revenue' | 'impressions') => round(hits.reduce((s, t) => s + ((t[k] as number | null) ?? 0), 0), 2);
  return {
    matchingTerms: hits.length,
    impressions: sum('impressions'),
    clicks: sum('clicks'),
    spend: sum('spend'),
    conversions: sum('conversions'),
    revenue: sum('revenue'),
    topTerms: [...hits]
      .sort((a, b) => (b.clicks ?? 0) - (a.clicks ?? 0))
      .slice(0, 3)
      .map((t) => ({ term: t.searchTerm, clicks: t.clicks ?? 0, conversions: t.conversions ?? 0 })),
  };
}

type Verdict = 'Findes allerede' | 'Ikke dansk' | 'Bevist (konverterer)' | 'Lovende' | 'Lav volumen' | 'Dyr' | 'Ingen data';

function verdictOf(o: {
  keyword: string;
  existing: unknown[];
  volume: ReturnType<typeof volumeStats>;
  evidence: ReturnType<typeof termEvidence>;
  bid: KeywordBidEstimate | undefined;
  accountCpc: number | null;
}): { verdict: Verdict; why: string } {
  const { volume, evidence, bid, accountCpc } = o;
  if (o.existing.length) return { verdict: 'Findes allerede', why: 'Søgeordet ligger allerede i kontoen – tilføj det ikke igen; brug det eksisterende eller en anden matchtype.' };
  const foreign = foreignWords(o.keyword);
  if (foreign) return { verdict: 'Ikke dansk', why: `${foreign.reason} Brug "${foreign.suggestion}".` };
  if (evidence.conversions > 0) return { verdict: 'Bevist (konverterer)', why: `Søgetermer med ordene har givet ${evidence.conversions} konverteringer på ${evidence.clicks} klik de seneste 90 dage.` };
  if (bid?.averageCpc && accountCpc && bid.averageCpc > accountCpc * 2)
    return { verdict: 'Dyr', why: `Anslået CPC ${bid.averageCpc} er over dobbelt så høj som kontoens gennemsnit (${round(accountCpc, 2)}).` };
  if (volume && volume.avgMonthly < 10 && !evidence.clicks) return { verdict: 'Lav volumen', why: `Kun ~${volume.avgMonthly} søgninger/md. på Microsofts netværk og ingen klik i søgetermerne.` };
  if (!volume && !evidence.impressions && !bid?.clicksPerWeek) return { verdict: 'Ingen data', why: 'Microsoft har ingen søgetal og søgeordet er ikke set i kontoens søgetermer – test forsigtigt.' };
  return {
    verdict: 'Lovende',
    why: [volume && `~${volume.avgMonthly} søgninger/md.`, evidence.clicks ? `${evidence.clicks} klik i søgetermer uden konvertering endnu` : null, bid?.averageCpc ? `anslået CPC ${bid.averageCpc}` : null]
      .filter(Boolean)
      .join(', '),
  };
}

async function safe<T>(p: Promise<T> | undefined, errors: string[], what: string): Promise<T | null> {
  if (!p) return null;
  try {
    return await p;
  } catch (e) {
    errors.push(`${what}: ${e instanceof Error ? e.message : String(e)}`);
    return null;
  }
}

async function researchKeywords(
  ctx: ToolContext,
  keywords: { text: string; matchType: 'Exact' | 'Phrase' | 'Broad' }[],
  opts: { campaignId?: string; adGroupId?: string } = {},
) {
  const errors: string[] = [];
  const range = last90();
  const [volumes, bids, terms, existing] = await Promise.all([
    safe(ctx.backend.searchVolumes?.(ctx.accountId, keywords.map((k) => k.text)), errors, 'Søgetal fra Microsoft'),
    safe(ctx.backend.bidEstimates?.(ctx.accountId, keywords, opts), errors, 'Budestimat fra Microsoft'),
    safe(getReport(ctx, { kind: 'searchterm', range, aggregation: 'Summary' }), errors, 'Søgetermer'),
    safe(getReport(ctx, { kind: 'keyword', range, aggregation: 'Summary' }), errors, 'Eksisterende søgeord'),
  ]);
  const termRows = terms ?? [];
  const totalClicks = termRows.reduce((s, t) => s + (t.clicks ?? 0), 0);
  const accountCpc = totalClicks ? termRows.reduce((s, t) => s + (t.spend ?? 0), 0) / totalClicks : null;
  const rows = keywords.map((k, i) => {
    const volume = volumeStats(volumes?.find((v) => same(v.keyword, k.text)) ?? volumes?.[i]);
    const bid = bids?.find((b) => same(b.keyword, k.text)) ?? bids?.[i];
    const evidence = termEvidence(k.text, termRows);
    const already = (existing ?? [])
      .filter((r) => r.keyword && same(r.keyword, k.text))
      .map((r) => ({ where: `${r.campaignName} › ${r.adGroupName}`, matchType: r.matchType, clicks: r.clicks ?? 0, conversions: r.conversions ?? 0 }));
    const { verdict, why } = verdictOf({ keyword: k.text, existing: already, volume, evidence, bid, accountCpc });
    return { keyword: k.text, matchType: k.matchType, volume, bid, evidence, existsIn: already, verdict, why };
  });
  return { rows, errors, accountCpc, range };
}

const kw = z.object({ text: z.string().min(1).max(100), matchType: z.enum(['Exact', 'Phrase', 'Broad']).optional().describe('Default Phrase.') });

export const researchTools = [
  defineRead({
    name: 'research_keywords',
    kind: 'read',
    description: `Validate keywords BEFORE proposing them (required before add_keywords and before writing ads around a keyword). For each keyword: Microsoft's monthly search counts in Denmark (12 months, trend, peak month), Microsoft's suggested bid with estimated clicks/cost per week, the account's own search terms containing the keyword (clicks, spend, conversions, top terms – last 90 days), whether it already exists in the account, and a verdict (Bevist / Lovende / Lav volumen / Dyr / Findes allerede / Ingen data). Give campaignId/adGroupId for more precise bid estimates. Up to 50 keywords per call.`,
    schema: z.object({
      keywords: z.array(kw).min(1).max(50),
      campaignId: z.string().optional(),
      adGroupId: z.string().optional(),
    }),
    label: (i) => `Undersøger ${i.keywords.length} søgeord`,
    async run(input, ctx) {
      const list = input.keywords.map((k) => ({ text: k.text.trim(), matchType: k.matchType ?? ('Phrase' as const) }));
      const { rows, errors, accountCpc, range } = await researchKeywords(ctx, list, { campaignId: input.campaignId, adGroupId: input.adGroupId });
      return {
        result: {
          period: range,
          currency: ctx.currency,
          accountAverageCpc: accountCpc === null ? null : round(accountCpc, 2),
          keywords: rows.map((r) => ({
            keyword: r.keyword,
            matchType: r.matchType,
            verdict: r.verdict,
            why: r.why,
            searchesPerMonth: r.volume,
            bidEstimate: r.bid
              ? { suggestedBid: r.bid.estimatedMinBid, averageCpc: r.bid.averageCpc, clicksPerWeek: r.bid.clicksPerWeek, costPerWeek: r.bid.costPerWeek }
              : null,
            searchTerms: r.evidence,
            existsIn: r.existsIn,
          })),
          sources:
            "Search counts and bid estimates are Microsoft's own (Bing, Yahoo, DuckDuckGo, AOL and partners in Denmark) – far lower than Google's, so compare keywords relatively. Search terms are this account's real queries.",
          ...(errors.length ? { unavailable: errors, note: 'Some sources were unavailable – say which, and do not fill the gap with guesses.' } : {}),
        },
        summary: `${rows.filter((r) => r.verdict === 'Bevist (konverterer)' || r.verdict === 'Lovende').length} af ${rows.length} lovende`,
        preview: {
          columns: [
            { key: 'keyword', label: 'Søgeord' },
            { key: 'matchType', label: 'Match' },
            { key: 'searches', label: 'Søgninger/md.', format: 'number' },
            { key: 'trend', label: 'Trend' },
            { key: 'cpc', label: 'Anslået CPC', format: 'money' },
            { key: 'clicks', label: 'Klik i søgetermer', format: 'number' },
            { key: 'conversions', label: 'Konv.', format: 'number' },
            { key: 'verdict', label: 'Vurdering' },
          ],
          rows: rows.map((r) => ({
            keyword: r.keyword,
            matchType: r.matchType,
            searches: r.volume?.avgMonthly ?? null,
            trend: r.volume?.trendPct === null || r.volume?.trendPct === undefined ? '' : `${r.volume.trendPct > 0 ? '+' : ''}${r.volume.trendPct} %`,
            cpc: r.bid?.averageCpc ?? null,
            clicks: r.evidence.clicks,
            conversions: r.evidence.conversions,
            verdict: r.verdict,
          })),
        },
      };
    },
  }),

  defineRead({
    name: 'get_auction_insights',
    kind: 'read',
    description:
      'Auction insights: which other advertisers (domains) show up in the same auctions, with their impression share, overlap rate, how often they rank above you, top-of-page rates and your outranking share. Use it before bid/budget advice and when writing ads (to stand out from those competitors). Level Account, or Campaign/AdGroup/Keyword with ids.',
    schema: z.object({
      level: z.enum(['Account', 'Campaign', 'AdGroup', 'Keyword']),
      ids: z.array(z.string()).max(200).optional().describe('Required for Campaign, AdGroup and Keyword.'),
      period: z.string().optional().describe("Period, e.g. last30 (default) or 'YYYY-MM-DD..YYYY-MM-DD'."),
    }),
    label: () => 'Henter auktionsindsigt',
    async run(input, ctx) {
      if (input.level !== 'Account' && !input.ids?.length) throw new Error(`Angiv id'er for niveauet ${input.level}.`);
      if (!ctx.backend.auctionInsights) throw new Error('Auktionsindsigt er ikke tilgængelig for denne konto.');
      const period = resolvePeriod(input.period ?? 'last30', ctx);
      const rows = await ctx.backend.auctionInsights(ctx.accountId, input.level, input.ids ?? [], period);
      return {
        result: {
          period,
          competitors: rows,
          ...(rows.length ? {} : { note: 'Microsoft returned no auction insight data (too few impressions in the period). Say so.' }),
          howToRead:
            'All values are percentages. overlapRate = how often they appear when you do; aboveRate = how often they rank above you; outrankingShare = how often you rank above them or show when they do not.',
        },
        summary: `${rows.length} annoncører`,
        preview: {
          columns: [
            { key: 'domain', label: 'Annoncør' },
            { key: 'impressionShare', label: 'Visningsandel %', format: 'number' },
            { key: 'overlapRate', label: 'Overlap %', format: 'number' },
            { key: 'aboveRate', label: 'Over dig %', format: 'number' },
            { key: 'topOfPageRate', label: 'Øverst %', format: 'number' },
            { key: 'outrankingShare', label: 'Du slår dem %', format: 'number' },
          ],
          rows: rows.map((r) => ({ ...r })),
        },
      };
    },
  }),
];

export { researchKeywords };
