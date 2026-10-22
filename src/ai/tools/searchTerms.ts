/**
 * The search terms the assistant last read per campaign, so a negative keyword proposal
 * can show clicks, spend and conversions without the model writing them out – it only
 * names the negative, and the app sums up what that negative would have blocked.
 */
import type { ReportRow } from '@/bing/types';

interface TermStats {
  adGroupId: string;
  term: string;
  clicks: number;
  spend: number;
  conversions: number;
}

const byCampaign = new Map<string, TermStats[]>();

/** Lower case with single spaces. Punctuation is kept, so "hæve-sænkebord" is not counted as "hæve sænkebord". */
export function normalizeTerm(text: string): string {
  return text.toLowerCase().normalize('NFKC').replace(/\s+/g, ' ').trim();
}

/** Keeps the latest search term rows of every campaign in them (one account at a time). */
export function rememberSearchTerms(accountId: string, rows: ReportRow[]) {
  const fresh = new Map<string, TermStats[]>();
  for (const r of rows) {
    if (!r.campaignId || !r.searchTerm) continue;
    const key = `${accountId}|${r.campaignId}`;
    const list = fresh.get(key) ?? [];
    list.push({ adGroupId: r.adGroupId ?? '', term: normalizeTerm(r.searchTerm), clicks: r.clicks ?? 0, spend: r.spend ?? 0, conversions: r.conversions ?? 0 });
    fresh.set(key, list);
  }
  for (const [key, list] of fresh) byCampaign.set(key, list);
}

/** What a negative would have blocked in the remembered search terms (null: never read). */
export function blockedBy(
  accountId: string,
  campaignId: string,
  negative: { text: string; matchType: 'Exact' | 'Phrase'; adGroupId?: string },
): { terms: number; clicks: number; spend: number; conversions: number } | null {
  const list = byCampaign.get(`${accountId}|${campaignId}`);
  if (!list) return null;
  const n = normalizeTerm(negative.text);
  if (!n) return null;
  const out = { terms: 0, clicks: 0, spend: 0, conversions: 0 };
  for (const t of list) {
    if (negative.adGroupId && t.adGroupId !== negative.adGroupId) continue;
    const hit = negative.matchType === 'Exact' ? t.term === n : ` ${t.term} `.includes(` ${n} `);
    if (!hit) continue;
    out.terms++;
    out.clicks += t.clicks;
    out.spend += t.spend;
    out.conversions += t.conversions;
  }
  return out.terms ? { ...out, spend: Math.round(out.spend * 100) / 100, conversions: Math.round(out.conversions * 100) / 100 } : null;
}

export function clearSearchTerms() {
  byCampaign.clear();
}
