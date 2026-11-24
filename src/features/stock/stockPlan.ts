/**
 * The sold-out sheet (cloudflare/src/stocksheet.ts) turned into product group changes and a
 * to-do list:
 *
 * - Udsolgt / Fjernet: the item is excluded in every Shopping ad group and Performance Max
 *   asset group where it can show – its own product group is switched to excluded, or (when it
 *   falls under a "Alle produkter" / "alt andet" that is bid on) it gets an excluded group of its
 *   own. Only where Microsoft has shown it in the last 90 days when that is known: excluding a
 *   product that never shows there changes nothing.
 * - På lager: an item excluded on its own is shown again – its exclusion is removed so it falls
 *   under "alt andet" like before, or, where "alt andet" is excluded, it is bid on at the group's
 *   usual bid.
 *
 * Nothing is sent from here: the tool (ai/tools/stock.ts) shows it all on one approval card.
 */
import type { StockDone, StockRow } from '@/workspace/types';
import { shapeOf, type EditRequest } from '@/features/audit/productMirror';
import type { DListingNode } from '@/features/audit/detail';

export const OUT = new Set(['soldout', 'removed']);

/** What one ad group (or asset group) needs: the items to exclude, to remove from their own group, and to bid on again. */
export function stockEdit(nodes: DListingNode[], out: string[], back: string[], shown: Set<string> | null): Required<Pick<EditRequest, 'exclude' | 'remove' | 'include'>> {
  const b = shapeOf(nodes);
  const exclude: string[] = [];
  const remove: string[] = [];
  const include: string[] = [];
  if (b.kind === 'none' || b.kind === 'other') return { exclude, remove, include };
  const nodeOf = (id: string) => (b.kind === 'ids' ? b.items.get(id.toLowerCase()) : undefined);
  // Does an item without its own product group show here? Only under a "Alle produkter" / "alt andet" bid on.
  const restShows = b.kind === 'all' ? !b.root.excluded : !b.other.excluded;
  for (const id of out) {
    const own = nodeOf(id);
    if (own) {
      if (!own.excluded) exclude.push(id);
    } else if (restShows && (!shown || shown.has(id.toLowerCase()))) exclude.push(id);
  }
  for (const id of back) {
    const own = nodeOf(id);
    if (!own?.excluded) continue;
    if (b.kind === 'ids' && !b.other.excluded) remove.push(id);
    else include.push(id);
  }
  return { exclude, remove, include };
}

/* ------------------------------------ to-do ------------------------------------ */

/** How many days before the date in column E a sold-out item is listed as "snart på lager". */
export const SOON_DAYS = 3;

export interface StockTodo {
  /** På lager in the sheet, not re-activated by the app yet. */
  reactivate: StockRow[];
  /** Udsolgt / Fjernet, with the date in column E within SOON_DAYS days (or passed). */
  soon: StockRow[];
  /** Udsolgt / Fjernet, not excluded by the app yet. */
  exclude: StockRow[];
  /** Rows whose status in column D was not understood. */
  unknown: StockRow[];
}

const addDays = (iso: string, n: number) => new Date(Date.parse(`${iso}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

/** The latest row per item id wins (a product can be listed again further down). */
function latest(rows: StockRow[]): StockRow[] {
  const by = new Map<string, StockRow>();
  for (const r of rows) by.set(r.itemId.toLowerCase(), r);
  return [...by.values()];
}

export function stockTodo(rows: StockRow[], done: StockDone, today: string): StockTodo {
  const all = latest(rows);
  const acted = (r: StockRow) => done[r.itemId.toLowerCase()]?.status;
  const soonUntil = addDays(today, SOON_DAYS);
  const byDate = (a: StockRow, b: StockRow) => (a.date ?? '9999').localeCompare(b.date ?? '9999') || a.row - b.row;
  return {
    reactivate: all.filter((r) => r.status === 'instock' && acted(r) !== 'instock').sort((a, b) => a.row - b.row),
    soon: all.filter((r) => OUT.has(r.status) && r.date !== null && r.date <= soonUntil).sort(byDate),
    exclude: all.filter((r) => OUT.has(r.status) && !OUT.has(acted(r) ?? '')).sort((a, b) => a.row - b.row),
    unknown: all.filter((r) => r.status === 'unknown'),
  };
}

/** The request for the assistant (Overblik → Lager → "Bed assistenten"). */
export function stockAsk(todo: StockTodo, which: 'reactivate' | 'exclude' | 'both'): string {
  const list = (rows: StockRow[]) => rows.slice(0, 60).map((r) => `- ${r.itemId} – ${r.title}${r.date ? ` (dato ${r.date})` : ''}`);
  return [
    'Kør udsolgt-arket (apply_stock_sheet) og vis ændringerne til godkendelse:',
    ...(which !== 'exclude' && todo.reactivate.length ? ['På lager igen – skal genaktiveres:', ...list(todo.reactivate)] : []),
    ...(which !== 'reactivate' && todo.exclude.length ? ['Udsolgt eller fjernet – skal udelukkes:', ...list(todo.exclude)] : []),
    `Brug only: "${which}". Fortæl kort, hvad der ændres hvor, og hvad der ikke var noget at gøre ved.`,
  ].join('\n');
}
