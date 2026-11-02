/**
 * The rows for the team's notes sheet ("Notatark til Google og Bing") after a change
 * Microsoft confirmed: one row per campaign and ad group, with a short comment in the
 * team's own style – "Ekskluderede 2712160205", "Tilføjede 3130234618 m. bud på 10,05 kr."
 * The Worker adds the date, time, status and who (cloudflare/src/notesheet.ts).
 */
import { create } from 'zustand';
import { fmtMoney } from '@/lib/format';
import type { ChangeLine } from '@/stores/activity';

export interface NoteRow {
  campaign: string;
  adGroup: string;
  /** The words to try for the sheet's Emne column, best first. */
  topics: string[];
  comment: string;
}

const TOPICS: Record<string, string[]> = {
  Produktgruppe: ['Produkter'],
  'Negativt søgeord': ['Negative søgeord', 'Søgeord', 'Annoncegruppe'],
  Søgeord: ['Søgeord', 'Annoncegruppe'],
  Annoncegruppe: ['Annoncegruppe'],
  Kampagne: ['Kampagne'],
  Annonce: ['Annoncer', 'Annonce', 'Annoncegruppe'],
};

const money = (v: unknown, currency: string) => (typeof v === 'number' ? fmtMoney(v, currency) : String(v ?? ''));
const list = (items: string[]) => [...new Set(items.filter(Boolean))].join(', ');

/** The ad group a line belongs to, as far as the line tells. */
function adGroupOf(c: ChangeLine): string {
  const g = c.cells?.group ?? c.cells?.target;
  if (typeof g === 'string' && g && g !== 'Hele kampagnen') return g;
  if (c.entity === 'Annoncegruppe') {
    const head = c.field.split(' · ')[0] ?? '';
    return ['Navn', 'kampagne', 'status', 'CPC-bud'].includes(head) ? '' : head;
  }
  return '';
}

/** What happened to one ad group's lines, in a sentence or two. */
function commentOf(lines: ChangeLine[], currency: string): string {
  const parts: string[] = [];
  const products = lines.filter((c) => c.entity === 'Produktgruppe');
  if (products.length) {
    const kind = (k: string) => products.filter((c) => c.cells?.kind === k);
    const bids = kind('Byd');
    const byBid = new Map<string, string[]>();
    for (const c of bids) {
      const bid = c.cells?.bid;
      const key = typeof bid === 'number' ? money(bid, currency) : '';
      byBid.set(key, [...(byBid.get(key) ?? []), c.after === 'Alt andet' ? 'alt andet' : String(c.after ?? '')]);
    }
    for (const [bid, ids] of byBid) parts.push(`Tilføjede ${list(ids)}${bid ? ` m. bud på ${bid}` : ''}`);
    const excluded = kind('Udeluk').map((c) => (c.after === 'Alt andet' ? 'alt andet' : String(c.after ?? '')));
    if (excluded.length) parts.push(`Ekskluderede ${list(excluded)}`);
    const removed = kind('Fjern').map((c) => String(c.after ?? ''));
    if (removed.length) parts.push(`Fjernede opdelingen af ${list(removed)}`);
    if (kind('Alle').length) parts.push('Byder nu på alle produkter');
  }
  const negatives = lines.filter((c) => c.entity === 'Negativt søgeord');
  if (negatives.length) parts.push(`Tilføjede negative søgeord: ${list(negatives.map((c) => `${c.after}${c.cells?.matchType ? ` (${String(c.cells.matchType).toLowerCase()})` : ''}`))}`);
  for (const c of lines.filter((x) => x.entity !== 'Produktgruppe' && x.entity !== 'Negativt søgeord')) {
    const what = c.field.includes(' · ') ? c.field.split(' · ').slice(1).join(' · ') : c.field;
    const isMoney = /bud|budget/i.test(what);
    const after = isMoney ? money(c.after, currency) : String(c.after ?? '');
    if (c.before !== undefined && c.before !== null && c.before !== '') parts.push(`Ændrede ${what} fra ${isMoney ? money(c.before, currency) : String(c.before)} til ${after}`);
    else parts.push(`${what.charAt(0).toUpperCase()}${what.slice(1)}: ${after}`);
  }
  return parts.join('. ').slice(0, 1000);
}

/**
 * One row per campaign and ad group. `campaignName`: the campaign the plan is about
 * (most changes are to one campaign).
 */
export function noteRows(lines: ChangeLine[], campaignName: string, currency: string): NoteRow[] {
  const groups = new Map<string, ChangeLine[]>();
  for (const c of lines) {
    const key = `${adGroupOf(c)}\u0000${c.entity}`;
    groups.set(key, [...(groups.get(key) ?? []), c]);
  }
  return [...groups.entries()]
    .map(([key, ls]) => {
      const [adGroup = '', entity = ''] = key.split('\u0000');
      return { campaign: campaignName, adGroup, topics: TOPICS[entity] ?? [entity], comment: commentOf(ls, currency) };
    })
    .filter((r) => r.comment);
}

/* ------------------------------ the preview on the card ------------------------------ */

export type NoteDraftStatus = 'draft' | 'sending' | 'sent' | 'skipped' | 'error';

export interface NoteDraft {
  rows: NoteRow[];
  status: NoteDraftStatus;
  error?: string;
}

/**
 * The rows proposed for the notes sheet, per tool call (the approval card shows them for
 * the user to correct and send). Kept while the app is open.
 */
export const useNoteDrafts = create<{
  drafts: Record<string, NoteDraft>;
  set: (id: string, draft: NoteDraft) => void;
  patch: (id: string, patch: Partial<NoteDraft>) => void;
}>((set) => ({
  drafts: {},
  set: (id, draft) => set((s) => ({ drafts: { ...s.drafts, [id]: draft } })),
  patch: (id, patch) => set((s) => (s.drafts[id] ? { drafts: { ...s.drafts, [id]: { ...s.drafts[id]!, ...patch } } } : s)),
}));
