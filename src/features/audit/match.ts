/**
 * Suggests which Google Ads campaign a Microsoft Advertising campaign is the counterpart
 * of. Campaigns imported from Google keep their names, so the name decides most of it;
 * the kind (Søgning/Shopping/PMax) breaks ties. Only a suggestion – the team confirms
 * every match on the audit page.
 */

export interface MatchCandidate {
  id: string;
  name: string;
  /** Google's advertising channel (SEARCH, SHOPPING, PERFORMANCE_MAX …). */
  channel: string;
}

/** Microsoft's campaign type → Google's advertising channel. */
const CHANNEL_OF: Record<string, string> = { Search: 'SEARCH', Shopping: 'SHOPPING', PerformanceMax: 'PERFORMANCE_MAX', Audience: 'DISPLAY' };

/** Words that name the platform rather than the campaign. */
const NOISE = new Set(['bing', 'microsoft', 'msa', 'msft', 'ms', 'google', 'gads', 'ga', 'adwords', 'kopi', 'copy', 'import', 'imported']);

export function nameTokens(name: string): string[] {
  return name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .split(/[^a-z0-9æøå]+/)
    .filter((t) => t && !NOISE.has(t));
}

/** 0–1: how alike two campaign names are (shared words over all words), 1 = the same words. */
export function nameScore(a: string, b: string): number {
  const ta = new Set(nameTokens(a));
  const tb = new Set(nameTokens(b));
  if (!ta.size || !tb.size) return 0;
  let shared = 0;
  for (const t of ta) if (tb.has(t)) shared++;
  return shared / (ta.size + tb.size - shared);
}

export interface Suggestion {
  googleId: string;
  score: number;
}

/** Below this, no suggestion is made – the team picks by hand. */
export const MIN_SCORE = 0.5;

/** The Google campaigns ranked as counterparts of one Microsoft campaign, best first. */
export function rankCandidates(bing: { name: string; type: string }, google: MatchCandidate[]): Suggestion[] {
  const channel = CHANNEL_OF[bing.type];
  return google
    .map((g) => {
      const score = nameScore(bing.name, g.name);
      // Same kind of campaign: a small lift, enough to break a tie between equal names.
      return { googleId: g.id, score: score > 0 && channel === g.channel ? Math.min(1, score + 0.1) : score };
    })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score);
}

/** The best counterpart, if it is a convincing one. */
export function suggestMatch(bing: { name: string; type: string }, google: MatchCandidate[]): Suggestion | null {
  const best = rankCandidates(bing, google)[0];
  return best && best.score >= MIN_SCORE ? best : null;
}
