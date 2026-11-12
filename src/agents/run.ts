/**
 * The four agents. Each reads Microsoft with the app's own connection and writes only to the
 * planning boards – a card, a comment, a ticked checklist item. Nothing in the ad account is
 * changed: a card's "Bed assistenten" button starts a conversation, and every change there
 * goes through the usual approval card.
 *
 * - followUp (per person): the follow-up cards on your boards that are due – numbers before
 *   and after the change, and a verdict, as a comment.
 * - searchTerms (team, Mondays): search terms that cost money without selling, not blocked yet.
 * - periods (team): campaigns whose period starts tomorrow (ready?) or ended (how did it go?).
 * - rejections (team): disapproved ads and keywords, and selling products with Merchant Center problems.
 */
import type { AdsBackend, Campaign } from '@/bing/types';
import { addDays, fmtMoney, fmtNumber, today } from '@/lib/format';
import { useActivity } from '@/stores/activity';
import { useBoard } from '@/stores/board';
import { canSeeBoard, type Card } from '@/board/model';
import { getTool, type ToolContext } from '@/ai/tools';
import { daysBetween, dk, followUpVerdict, isoAdd, pickSearchTerms, readiness, sum, type NegativeRule, type TermRow } from './logic';

export interface AgentEnv {
  backend: AdsBackend;
  accountId: string;
  currency: string;
  /** The team-wide "only once" (Worker): false when another app already did it. */
  claim: (key: string) => Promise<boolean>;
  /** The tool context for re-using the assistant's read tools. */
  tool: ToolContext;
}

const AGENT_NOTE = 'Agent';

/** Runs `fn` over `items`, at most `limit` at a time. */
async function pool<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i]!);
      }
    }),
  );
  return out;
}

async function totals(env: AgentEnv, campaignIds: string[], from: string, to: string) {
  const rows = await env.backend.runReport(env.accountId, { kind: 'campaign', range: { from, to }, aggregation: 'Summary', campaignIds });
  return sum(rows);
}

/* ------------------------------- 1. follow-up ------------------------------- */

/** The comment the agent leaves – a card that has one from today is not looked at again today. */
const FOLLOW_PREFIX = `${AGENT_NOTE} – opfølgning`;

export async function runFollowUp(env: AgentEnv): Promise<number> {
  const board = useBoard.getState();
  const now = today();
  const activity = useActivity.getState().entries;
  const visible = new Set(board.boards.filter((b) => canSeeBoard(b, board.meId)).map((b) => b.id));
  const due = Object.values(board.cards).filter(
    (c: Card) => visible.has(c.boardId) && c.source?.activityIds.length && !c.done && !c.archived && c.due && c.due <= now && !c.activity.some((a) => a.kind === 'comment' && a.text.startsWith(FOLLOW_PREFIX) && new Date(a.ts).toISOString().slice(0, 10) === now),
  );
  let done = 0;
  for (const card of due) {
    const entries = activity.filter((e) => card.source!.activityIds.includes(e.id) && e.accountId === env.accountId && e.status === 'success');
    const campaignIds = [...new Set(entries.flatMap((e) => e.campaignIds ?? []))];
    if (!entries.length || !campaignIds.length) continue;
    const changed = new Date(Math.min(...entries.map((e) => e.ts))).toISOString().slice(0, 10);
    const afterFrom = isoAdd(changed, 1);
    const afterTo = addDays(now, -1);
    const afterDays = afterTo >= afterFrom ? Math.min(daysBetween(afterFrom, afterTo), 28) : 0;
    const beforeTo = isoAdd(changed, -1);
    const beforeFrom = isoAdd(beforeTo, -(Math.max(afterDays, 7) - 1));
    const [before, after] = await Promise.all([
      totals(env, campaignIds, beforeFrom, beforeTo),
      afterDays ? totals(env, campaignIds, isoAdd(afterTo, -(afterDays - 1)), afterTo) : Promise.resolve(null),
    ]);
    const v = followUpVerdict(before, daysBetween(beforeFrom, beforeTo), after ?? sum([]), afterDays, env.currency);
    const text = [`${FOLLOW_PREFIX} (${dk(beforeFrom)}–${dk(beforeTo)} mod ${afterDays ? `${dk(isoAdd(afterTo, -(afterDays - 1)))}–${dk(afterTo)}` : 'ingen dage endnu'}):`, ...v.lines.map((l) => `• ${l}`), `Vurdering: ${v.text}`].join('\n');
    board.addComment(card.id, text);
    if (v.verdict === 'wait') board.updateCard(card.id, { due: isoAdd(now, 7) });
    else {
      const check = card.checklist.find((i) => !i.done && /tjek tallene/i.test(i.text));
      if (check) board.updateCheckItem(card.id, check.id, { done: true });
    }
    done++;
  }
  return done;
}

/* ------------------------------ 3. search terms ------------------------------ */

export async function runSearchTerms(env: AgentEnv): Promise<number> {
  const to = addDays(today(), -1);
  const from = addDays(to, -29);
  if (!(await env.claim(`searchterms:${env.accountId}:${to}`))) return 0;
  const rows = await env.backend.runReport(env.accountId, { kind: 'searchterm', range: { from, to }, aggregation: 'Summary' });
  const byKey = new Map<string, TermRow>();
  for (const r of rows) {
    const term = (r.searchTerm ?? '').trim().toLowerCase();
    if (!term || !r.campaignId) continue;
    const k = `${r.campaignId}|${term}`;
    const t = byKey.get(k) ?? { term, campaignId: r.campaignId, campaignName: r.campaignName ?? '', clicks: 0, spend: 0, conversions: 0 };
    byKey.set(k, { ...t, clicks: t.clicks + (r.clicks ?? 0), spend: t.spend + (r.spend ?? 0), conversions: t.conversions + (r.conversions ?? 0) });
  }
  const terms = [...byKey.values()];
  // The negatives of the campaigns with candidates: on the campaign and in its lists.
  const rough = pickSearchTerms(terms, new Map(), { limit: 60 });
  const campaigns = [...new Set(rough.map((t) => t.campaignId))];
  const negatives = new Map<string, NegativeRule[]>();
  await pool(campaigns, 4, async (id) => {
    const own = await env.backend.listNegativeKeywords(env.accountId, 'Campaign', id, id).catch(() => []);
    const lists = env.backend.listNegativeKeywordLists ? await env.backend.listNegativeKeywordLists(env.accountId, id).catch(() => []) : [];
    negatives.set(
      id,
      [...own, ...lists.flatMap((l) => l.keywords)].map((n) => ({ text: n.text, matchType: /exact/i.test(n.matchType) ? 'exact' : 'phrase' })),
    );
  });
  const picks = pickSearchTerms(terms, negatives, { limit: 25 });
  if (!picks.length) return 0;
  const kr = (v: number) => fmtMoney(v, env.currency);
  const spend = picks.reduce((n, t) => n + t.spend, 0);
  const list = picks.map((t) => `"${t.term}" – ${t.campaignName} (id ${t.campaignId}): ${fmtNumber(t.clicks)} klik, ${kr(t.spend)}, 0 konv.`);
  useBoard.getState().addAgentCard({
    label: 'searchterms',
    title: `Søgetermer uden salg: ${picks.length} forslag (${kr(spend)})`,
    description: [`${dk(from)}–${dk(to)}: søgetermer med mindst 8 klik og forbrug over 3 gennemsnitlige klik, uden salg – og ikke allerede stoppet af et negativt søgeord.`, '', ...list.map((l) => `• ${l}`)].join('\n'),
    priority: spend > 1000 ? 'high' : 'medium',
    ask: [
      `Søgetermer uden salg de seneste 30 dage (${dk(from)}–${dk(to)}) – fra søgeterm-agenten:`,
      ...list.map((l) => `- ${l}`),
      'Vurdér hver enkelt: er den irrelevant, så foreslå den som negativt søgeord i den nævnte kampagne (propose_negative_keywords – eksakt eller sætning, der stopper netop den). Er den relevant men dyr, så sig det i stedet. Vis ændringerne til godkendelse, før noget sker.',
    ].join('\n'),
  });
  return 1;
}

/* --------------------------------- 4. periods --------------------------------- */

export async function runPeriods(env: AgentEnv): Promise<number> {
  const now = today();
  const campaigns = (await env.backend.listCampaigns(env.accountId)).filter((c) => c.status !== 'Deleted');
  const groups = await pool(campaigns, 4, (c) => env.backend.listAdGroups(env.accountId, c.id).catch(() => []));
  let made = 0;
  for (const [i, c] of campaigns.entries()) {
    const gs = groups[i]!.filter((g) => g.status !== 'Deleted');
    // Starting tomorrow or today: ready?
    const starts = [...new Set(gs.map((g) => g.startDate).filter((d): d is string => !!d && d >= now && d <= isoAdd(now, 1)))];
    for (const start of starts) {
      if (!(await env.claim(`period-start:${c.id}:${start}`))) continue;
      const inPeriod = gs.filter((g) => g.startDate === start);
      const ads = await pool(inPeriod, 4, (g) => env.backend.listAds(env.accountId, g.id).catch(() => []));
      const checks = readiness(c, inPeriod.map((g, j) => ({ name: g.name, status: g.status, approvedAds: ads[j]!.filter((a) => a.status === 'Active' && a.editorialStatus !== 'Disapproved').length })));
      const bad = checks.filter((x) => !x.ok);
      const end = inPeriod.find((g) => g.endDate)?.endDate;
      useBoard.getState().addAgentCard({
        label: 'period',
        title: `${bad.length ? 'Ikke klar' : 'Klar'}: ${c.name} starter ${start === now ? 'i dag' : 'i morgen'}`,
        description: `Perioden ${dk(start)}${end ? `–${dk(end)}` : ''} for ${inPeriod.length} annoncegrupper. ${bad.length ? `${bad.length} ting skal ordnes.` : 'Alt ser klar ud.'}`,
        checklist: checks.map((x) => ({ text: x.text, done: x.ok })),
        priority: bad.length ? 'highest' : 'low',
        due: start,
        ...(bad.length
          ? { ask: [`Kampagnen "${c.name}" (id ${c.id}) starter sin periode ${dk(start)}. Periode-agenten fandt:`, ...bad.map((x) => `- ${x.text}`), 'Ret det, der skal til, så den er klar – vis ændringerne til godkendelse, før noget sker.'].join('\n') }
          : {}),
      });
      made++;
    }
    // Ended in the last three days: how did it go?
    const ends = [...new Set(gs.map((g) => g.endDate).filter((d): d is string => !!d && d < now && d >= isoAdd(now, -3)))];
    for (const end of ends) {
      if (!(await env.claim(`period-end:${c.id}:${end}`))) continue;
      const start = gs.filter((g) => g.endDate === end).map((g) => g.startDate).filter((d): d is string => !!d).sort()[0] ?? isoAdd(end, -6);
      const days = daysBetween(start, end);
      const [during, before] = await Promise.all([totals(env, [c.id], start, end), totals(env, [c.id], isoAdd(start, -days), isoAdd(start, -1))]);
      const v = followUpVerdict(before, days, during, days, env.currency);
      const kr = (x: number) => fmtMoney(x, env.currency);
      const roas = during.spend > 0 ? fmtNumber(during.revenue / during.spend, 2) : '–';
      useBoard.getState().addAgentCard({
        label: 'period',
        title: `Periode slut: ${c.name}`,
        description: [
          `${dk(start)}–${dk(end)} (${days} dage): ${kr(during.spend)} brugt, ${fmtNumber(during.conversions, 1)} konverteringer, ${kr(during.revenue)} i omsætning, ROAS ${roas}.`,
          `Mod de ${days} dage før (pr. dag):`,
          ...v.lines.map((l) => `• ${l}`),
        ].join('\n'),
        priority: 'medium',
        ask: `Evaluér perioden for kampagnen "${c.name}" (id ${c.id}) ${dk(start)}–${dk(end)}: hvad virkede (produkter, søgeord, annoncer), hvad gjorde ikke, og hvad skal vi gøre anderledes næste gang? Hent tallene selv.`,
      });
      made++;
    }
  }
  return made;
}

/* ------------------------------- 5. rejections ------------------------------- */

export async function runRejections(env: AgentEnv): Promise<number> {
  const campaigns = (await env.backend.listCampaigns(env.accountId)).filter((c) => c.status === 'Active');
  const groupLists = await pool(campaigns, 4, (c) => env.backend.listAdGroups(env.accountId, c.id).catch(() => []));
  const groups = campaigns.flatMap((c: Campaign, i) => groupLists[i]!.filter((g) => g.status === 'Active').map((g) => ({ c, g })));
  const found: { key: string; line: string }[] = [];
  await pool(groups, 4, async ({ c, g }) => {
    const [ads, kws] = await Promise.all([env.backend.listAds(env.accountId, g.id).catch(() => []), env.backend.listKeywords(env.accountId, g.id).catch(() => [])]);
    for (const a of ads) if (a.status === 'Active' && a.editorialStatus === 'Disapproved') found.push({ key: `ad:${a.id}`, line: `Annonce afvist – ${c.name} › ${g.name} (annonce-id ${a.id}${a.headlines[0] ? `, "${a.headlines[0]}"` : ''})` });
    for (const k of kws) if (k.status === 'Active' && k.editorialStatus === 'Disapproved') found.push({ key: `kw:${k.id}`, line: `Søgeord afvist – ${c.name} › ${g.name}: "${k.text}"` });
  });
  // Selling products with warnings or disapprovals in Merchant Center (the assistant's own list).
  const products = getTool('list_products');
  if (products && products.kind === 'read') {
    const out = await products.run(products.schema.parse({ period: 'last30', filter: 'problems', limit: 40 }), env.tool).catch(() => null);
    const list = (out?.result as { products?: { id: string; title: string; status?: string; issues?: string[] }[] } | undefined)?.products ?? [];
    for (const p of list) found.push({ key: `p:${p.id}:${p.status ?? ''}`, line: `Produkt ${p.status === 'disapproved' ? 'afvist' : 'med advarsel'}: ${p.title} (${p.id})${p.issues?.length ? ` – ${p.issues.slice(0, 2).join('; ')}` : ''}` });
  }
  if (!found.length) return 0;
  // A new card only when the set of problems changed since the last one.
  const signature = hash(found.map((f) => f.key).sort().join(','));
  if (!(await env.claim(`rejections:${env.accountId}:${signature}`))) return 0;
  found.sort((a, b) => a.line.localeCompare(b.line, 'da'));
  useBoard.getState().addAgentCard({
    label: 'rejections',
    title: `Afvisninger: ${found.length} ${found.length === 1 ? 'ting' : 'ting'} kører ikke`,
    description: found.slice(0, 60).map((f) => `• ${f.line}`).join('\n') + (found.length > 60 ? `\n… og ${found.length - 60} mere` : ''),
    priority: found.some((f) => f.key.startsWith('ad:') || f.line.includes('afvist')) ? 'high' : 'medium',
    ask: ['Afvisnings-agenten fandt dette, der ikke kører:', ...found.slice(0, 60).map((f) => `- ${f.line}`), 'Find årsagen til hver (Microsofts afvisningsgrund), og foreslå rettelser – nye annoncetekster, søgeord eller hvad der skal rettes i feedet. Vis ændringerne til godkendelse, før noget sker.'].join('\n'),
  });
  return 1;
}

function hash(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}
