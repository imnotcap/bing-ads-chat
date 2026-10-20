/**
 * Finding campaigns and ad groups by (part of) their name – the first step whenever the
 * user names something, instead of listing hundreds of campaigns and reading through them.
 */
import { z } from 'zod';
import { defineRead, getAdGroups, getCampaigns, getReport, statusLabel, type ToolContext } from './context';

const fold = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '');

const words = (s: string) => fold(s).split(/[^\p{L}\p{N}]+/u).filter(Boolean);

/**
 * How well a name matches a search: 100 = the same name, 60–90 = every word is in it
 * (higher when it starts the same and has few other words), up to 40 = some words.
 */
export function nameScore(query: string, name: string): number {
  const q = words(query);
  if (!q.length) return 0;
  const n = words(name);
  if (q.join(' ') === n.join(' ')) return 100;
  const hits = q.filter((w) => n.some((x) => x.includes(w))).length;
  if (hits === q.length) return 60 + (n[0]?.startsWith(q[0]!) ? 15 : 0) + Math.max(0, 15 - (n.length - q.length) * 3);
  return hits * 2 >= q.length ? Math.round((hits / q.length) * 40) : 0;
}

/** Campaigns sorted by how well their name matches; nothing below `min`. */
export function matchByName<T extends { name: string }>(items: T[], query: string, min = 1): (T & { score: number })[] {
  return items
    .map((x) => ({ ...x, score: nameScore(query, x.name) }))
    .filter((x) => x.score >= min)
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name, 'da'));
}

const quality = (score: number) => (score === 100 ? 'exact' : score >= 60 ? 'all words' : 'some words');

interface FoundAdGroup {
  id: string;
  name: string;
  campaignId: string;
  campaignName: string;
  status?: string;
}

async function adGroupCandidates(ctx: ToolContext, campaignIds: string[]): Promise<FoundAdGroup[]> {
  const out = new Map<string, FoundAdGroup>();
  // Every ad group that ran in the last 90 days, in one report (whatever its campaign) …
  const to = new Date().toISOString().slice(0, 10);
  const from = new Date(Date.now() - 89 * 86_400_000).toISOString().slice(0, 10);
  const rows = await getReport(ctx, { kind: 'adgroup', range: { from, to }, aggregation: 'Summary' }).catch(() => []);
  for (const r of rows) {
    if (r.adGroupId && r.adGroupName) out.set(r.adGroupId, { id: r.adGroupId, name: r.adGroupName, campaignId: r.campaignId ?? '', campaignName: r.campaignName ?? '' });
  }
  // … plus every ad group (also paused or new ones) in the campaigns whose name matched.
  const campaigns = await getCampaigns(ctx);
  for (const id of campaignIds) {
    const c = campaigns.find((x) => x.id === id);
    const groups = await getAdGroups(ctx, id).catch(() => []);
    for (const g of groups) out.set(g.id, { id: g.id, name: g.name, campaignId: id, campaignName: c?.name ?? '', status: g.status });
  }
  return [...out.values()];
}

export const findTools = [
  defineRead({
    name: 'find_campaigns_and_ad_groups',
    kind: 'read',
    description: `Find campaigns and ad groups by name (or part of it) – ALWAYS the first step when the user names a campaign or ad group, before any other tool. Matches every word in any order, ignores case, accents and separators like "|" (e.g. "butiksinventar exact" finds "Butiksinventar | Exact"). Returns the best matches with ids; ad groups come with their campaign. Use the ids with list_ad_groups, list_keywords, run_report etc. If nothing matches, try fewer or other words before telling the user it doesn't exist.`,
    schema: z.object({
      query: z.string().min(1).describe('The name or words from it, e.g. "Sækkevogne" or "Butiksinventar Exact".'),
      what: z.enum(['both', 'campaigns', 'ad_groups']).optional().describe('Default both.'),
      limit: z.number().int().min(1).max(30).optional().describe('Max matches of each kind (default 10).'),
    }),
    label: (i) => `Finder "${i.query}"`,
    async run(input, ctx) {
      const limit = input.limit ?? 10;
      const what = input.what ?? 'both';
      const campaigns = matchByName(await getCampaigns(ctx), input.query);
      const strong = campaigns.filter((c) => c.score >= 60);
      let adGroups: (FoundAdGroup & { score: number })[] = [];
      if (what !== 'campaigns') {
        const candidates = await adGroupCandidates(ctx, strong.slice(0, 5).map((c) => c.id));
        // An ad group also matches on "campaign name + ad group name".
        adGroups = candidates
          .map((g) => ({ ...g, score: Math.max(nameScore(input.query, g.name), nameScore(input.query, `${g.campaignName} ${g.name}`) - 5) }))
          .filter((g) => g.score > 0)
          .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name, 'da'));
      }
      const shownCampaigns = what === 'ad_groups' ? [] : campaigns.slice(0, limit);
      const shownGroups = adGroups.slice(0, limit);
      const rows = [
        ...shownCampaigns.map((c) => ({ kind: 'Kampagne', name: c.name, where: '', status: statusLabel(c.status), id: c.id })),
        ...shownGroups.map((g) => ({ kind: 'Annoncegruppe', name: g.name, where: g.campaignName, status: g.status ? statusLabel(g.status) : '', id: g.id })),
      ];
      return {
        result: {
          query: input.query,
          campaigns: shownCampaigns.map((c) => ({ id: c.id, name: c.name, status: c.status, type: c.type, match: quality(c.score) })),
          adGroups: shownGroups.map((g) => ({ id: g.id, name: g.name, campaignId: g.campaignId, campaignName: g.campaignName, status: g.status, match: quality(g.score) })),
          ...(campaigns.length > limit || adGroups.length > limit ? { note: `More matches than shown (${campaigns.length} campaigns, ${adGroups.length} ad groups) – use more words to narrow it down.` } : {}),
          ...(!rows.length ? { note: 'Nothing matched. Try fewer or other words (a single distinctive word works best) before telling the user it does not exist.' } : {}),
        },
        summary: `${shownCampaigns.length} kampagner · ${shownGroups.length} annoncegrupper`,
        preview: {
          columns: [
            { key: 'kind', label: 'Type' },
            { key: 'name', label: 'Navn' },
            { key: 'where', label: 'Kampagne' },
            { key: 'status', label: 'Status' },
          ],
          rows,
        },
      };
    },
  }),
];
