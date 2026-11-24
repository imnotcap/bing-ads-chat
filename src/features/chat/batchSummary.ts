/** Short texts for the batch of approval cards (ApprovalBatch.tsx). */
import type { ChangePlan } from '@/ai/guardrails';
import { fmtMoney } from '@/lib/format';
import type { ToolPart } from '@/stores/chat';

/**
 * One line for what a card does: pick tables by action ("Byd 1838650105, 1838650205 · 8 kr."),
 * other cards by their first changes ("Dagsbudget: 300 kr.").
 */
export function cardSummary(plan: ChangePlan, currency: string): string {
  const changes = plan.changes;
  if (!changes.length) return '';
  const kinds = new Map<string, string[]>();
  const bids = new Set<number>();
  let picked = false;
  for (const c of changes) {
    const kind = c.cells?.kind;
    if (typeof kind !== 'string') continue;
    picked = true;
    kinds.set(kind, [...(kinds.get(kind) ?? []), String(c.after ?? '')]);
    const bid = c.cells?.bid;
    if (typeof bid === 'number') bids.add(bid);
  }
  const few = (xs: (string | number | null | undefined)[]) => {
    const list = xs.filter((x) => x !== null && x !== undefined && x !== '').map(String);
    return list.length > 3 ? `${list.slice(0, 3).join(', ')} +${list.length - 3}` : list.join(', ');
  };
  if (picked) {
    const parts = [...kinds].map(([k, ids]) => `${k} ${few(ids)}`);
    const bid = bids.size === 1 ? ` · ${fmtMoney([...bids][0]!, currency, 2)}` : bids.size > 1 ? ` · ${bids.size} bud` : '';
    return parts.join(' · ') + bid;
  }
  const value = (v: string | number | null | undefined) => (typeof v === 'number' ? fmtMoney(v, currency, 2) : (v ?? '–'));
  const first = changes.slice(0, 2).map((c) => `${c.field}: ${value(c.after)}`);
  return first.join(' · ') + (changes.length > 2 ? ` +${changes.length - 2}` : '');
}

/** The rule warnings of the waiting cards, each once, with how many cards it applies to. */
export function batchReasons(parts: ToolPart[]): { text: string; count: number }[] {
  const count = new Map<string, number>();
  for (const p of parts) for (const r of new Set(p.decision?.reasons ?? [])) count.set(r, (count.get(r) ?? 0) + 1);
  return [...count].map(([text, n]) => ({ text, count: n }));
}
