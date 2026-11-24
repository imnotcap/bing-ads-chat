import { describe, expect, it } from 'vitest';
import { assertStockSheetCall, parseDate, parseStatus, stockRows } from '../../cloudflare/src/stocksheet';
import type { DListingNode } from '@/features/audit/detail';
import { conversionBreakdown } from '@/features/dashboard/conversionBreakdown';
import { stockAsk, stockEdit, stockTodo } from '@/features/stock/stockPlan';
import type { ProductPerformance } from '@/bing/types';
import type { StockRow } from '@/workspace/types';

const TODAY = '2026-11-24';

describe('reading the sold-out sheet', () => {
  it('understands the statuses in column D', () => {
    expect(parseStatus('Udsolgt')).toBe('soldout');
    expect(parseStatus(' udsolgt ')).toBe('soldout');
    expect(parseStatus('Ikke på lager')).toBe('soldout');
    expect(parseStatus('Fjernet')).toBe('removed');
    expect(parseStatus('Udgået')).toBe('removed');
    expect(parseStatus('På lager')).toBe('instock');
    expect(parseStatus('Paa lager')).toBe('instock');
    expect(parseStatus('Måske')).toBe('unknown');
    expect(parseStatus('')).toBe('unknown');
  });

  it('reads the date in column E – a Sheets date or typed text', () => {
    expect(parseDate(46350, TODAY)).toBe('2026-11-24'); // serial number
    expect(parseDate('2026-12-01', TODAY)).toBe('2026-12-01');
    expect(parseDate('1-12-2026', TODAY)).toBe('2026-12-01');
    expect(parseDate('01.12.26', TODAY)).toBe('2026-12-01');
    expect(parseDate('1/12', TODAY)).toBe('2026-12-01');
    expect(parseDate('5/1', TODAY)).toBe('2027-01-05'); // no year, long ago this year → next year
    expect(parseDate('3. dec. 2026', TODAY)).toBe('2026-12-03');
    expect(parseDate('31-02-2026', TODAY)).toBeNull();
    expect(parseDate('snart', TODAY)).toBeNull();
    expect(parseDate('', TODAY)).toBeNull();
  });

  it('finds the item id and the name by their headings, and skips the heading row', () => {
    const rows = stockRows(
      [
        ['Produktnavn', 'Varenummer', 'Leverandør', 'Status', 'Forventet'],
        ['Kontorstol Flex', '2971059542', 'Acme', 'Udsolgt', '1-12-2026'],
        ['Hæve-sænkebord', '2915839003', 'Acme', 'På lager', ''],
        ['', '', '', '', ''],
        ['Lampe', '2911111111', 'Acme', 'hmm', ''],
      ],
      TODAY,
    );
    expect(rows).toEqual([
      { row: 2, itemId: '2971059542', title: 'Kontorstol Flex', status: 'soldout', statusText: 'Udsolgt', date: '2026-12-01' },
      { row: 3, itemId: '2915839003', title: 'Hæve-sænkebord', status: 'instock', statusText: 'På lager', date: null },
      { row: 5, itemId: '2911111111', title: 'Lampe', status: 'unknown', statusText: 'hmm', date: null },
    ]);
  });

  it('without headings: the item id is the column that looks like ids', () => {
    const rows = stockRows(
      [
        ['SKU-100', 'Reol hvid 80 cm', 'x', 'Fjernet', 46351],
        ['SKU-101', 'Reol sort 80 cm', 'x', 'Udsolgt', ''],
      ],
      TODAY,
    );
    expect(rows.map((r) => [r.row, r.itemId, r.title, r.status, r.date])).toEqual([
      [1, 'SKU-100', 'Reol hvid 80 cm', 'removed', '2026-11-25'],
      [2, 'SKU-101', 'Reol sort 80 cm', 'soldout', null],
    ]);
  });

  it('only ever reads the connected sheet', () => {
    const base = 'https://sheets.googleapis.com/v4/spreadsheets/abc';
    expect(() => assertStockSheetCall('abc', `${base}?fields=x`)).not.toThrow();
    expect(() => assertStockSheetCall('abc', `${base}/values/A1:E5`)).not.toThrow();
    expect(() => assertStockSheetCall('abc', `${base}/values/A1:append?x`, { method: 'POST' })).toThrow(/kun læses/);
    expect(() => assertStockSheetCall('abc', `${base}/values/A1`, { method: 'PUT' })).toThrow(/kun læses/);
    expect(() => assertStockSheetCall('abc', `${base}:batchUpdate`, { method: 'POST' })).toThrow(/kun læses/);
    expect(() => assertStockSheetCall('abc', 'https://sheets.googleapis.com/v4/spreadsheets/other?x')).toThrow(/kun læses/);
  });
});

/* ------------------------------- product groups ------------------------------- */

const n = (id: string, parentId: string | null, raw: string, o: Partial<DListingNode> = {}): DListingNode => ({
  id,
  parentId,
  group: 'Stole',
  unit: true,
  excluded: false,
  dim: parentId ? 'id' : 'all',
  value: raw.toLowerCase(),
  raw,
  groupId: '500',
  ...o,
});

/** "Alle produkter" split: A bid on, B excluded, everything else bid on. */
const SPLIT = [n('0', null, '', { unit: false }), n('1', '0', 'A'), n('2', '0', 'B', { excluded: true }), n('3', '0', '')];
/** The same, with everything else excluded. */
const SPLIT_ELSE_OFF = [n('0', null, '', { unit: false }), n('1', '0', 'A'), n('2', '0', 'B', { excluded: true }), n('3', '0', '', { excluded: true })];
const ALL = [n('0', null, '')];

describe('what the sheet changes in one ad group', () => {
  it('excludes an item bid on, and an item under "alt andet" where it has shown', () => {
    expect(stockEdit(SPLIT, ['A', 'C', 'D'], [], new Set(['c']))).toEqual({ exclude: ['A', 'C'], remove: [], include: [] });
    // Not known what has shown: every item that can show is excluded.
    expect(stockEdit(SPLIT, ['C'], [], null).exclude).toEqual(['C']);
    expect(stockEdit(ALL, ['C'], [], new Set(['c'])).exclude).toEqual(['C']);
  });

  it('leaves an item that cannot show here alone', () => {
    // Already excluded, or under an excluded "alt andet".
    expect(stockEdit(SPLIT, ['B'], [], null).exclude).toEqual([]);
    expect(stockEdit(SPLIT_ELSE_OFF, ['C'], [], null).exclude).toEqual([]);
    expect(stockEdit([], ['C'], [], null).exclude).toEqual([]);
  });

  it('re-activates an excluded item: back under "alt andet", or bid on where "alt andet" is excluded', () => {
    expect(stockEdit(SPLIT, [], ['B', 'A', 'C'], null)).toEqual({ exclude: [], remove: ['B'], include: [] });
    expect(stockEdit(SPLIT_ELSE_OFF, [], ['B'], null)).toEqual({ exclude: [], remove: [], include: ['B'] });
  });
});

/* ------------------------------------ to-do ------------------------------------ */

const row = (itemId: string, status: StockRow['status'], date: string | null = null, r = 2): StockRow => ({ row: r, itemId, title: `Vare ${itemId}`, status, statusText: status, date });

describe('the Lager tab', () => {
  it('lists what to re-activate, what is due soon and what is not excluded yet', () => {
    const rows = [
      row('A', 'instock', null, 2),
      row('B', 'instock', null, 3),
      row('C', 'soldout', '2026-11-26', 4),
      row('D', 'soldout', '2026-12-20', 5),
      row('E', 'removed', '2026-11-20', 6),
      row('F', 'unknown', null, 7),
      // Listed again further down: the last row wins.
      row('D', 'soldout', '2026-11-25', 8),
    ];
    const t = stockTodo(rows, { b: { status: 'instock', at: 1, by: 'x' }, c: { status: 'soldout', at: 1, by: 'x' } }, TODAY);
    expect(t.reactivate.map((r) => r.itemId)).toEqual(['A']);
    expect(t.soon.map((r) => r.itemId)).toEqual(['E', 'D', 'C']);
    expect(t.exclude.map((r) => r.itemId)).toEqual(['E', 'D']);
    expect(t.unknown.map((r) => r.itemId)).toEqual(['F']);
    expect(stockAsk(t, 'reactivate')).toMatch(/apply_stock_sheet[\s\S]*- A – Vare A[\s\S]*only: "reactivate"/);
    expect(stockAsk(t, 'reactivate')).not.toMatch(/Vare E/);
  });

  it('asks again when the sheet changes after the app acted', () => {
    // Re-activated before, sold out again now.
    const t = stockTodo([row('A', 'soldout')], { a: { status: 'instock', at: 1, by: 'x' } }, TODAY);
    expect(t.exclude.map((r) => r.itemId)).toEqual(['A']);
  });
});

/* ------------------------------ conversions by product ------------------------------ */

describe('the products behind a day\'s conversions', () => {
  const m = (conversions: number, revenue: number) => ({ impressions: 100, clicks: 10, spend: 20, conversions, revenue });
  const product = (id: string, conv: number, rev: number, placements: [string, string, number, number][]): ProductPerformance => ({
    id,
    title: `Produkt ${id}`,
    brand: null,
    category: null,
    productType: null,
    price: null,
    imageUrl: null,
    link: null,
    metrics: m(conv, rev),
    previous: m(0, 0),
    placements: placements.map(([campaignId, adGroupName, c, r]) => ({ campaignId, campaignName: `Kampagne ${campaignId}`, adGroupId: null, adGroupName, metrics: m(c, r) })),
    status: null,
  });

  it('lists converting products, and the rest per campaign', () => {
    const b = conversionBreakdown(
      [product('p1', 1, 500, [['s', 'Stole', 1, 500]]), product('p2', 2, 900, [['s', 'Borde', 2, 900]]), product('p3', 0, 0, [['s', 'Borde', 0, 0]])],
      [
        { campaignId: 's', campaignName: 'Shopping', conversions: 3, revenue: 1400 },
        { campaignId: 'q', campaignName: 'Søg', conversions: 4, revenue: 2000 },
        { campaignId: 'z', campaignName: 'Ingen', conversions: 0, revenue: 0 },
      ],
    );
    expect(b.products.map((p) => [p.id, p.conversions, p.where])).toEqual([
      ['p2', 2, ['Kampagne s › Borde']],
      ['p1', 1, ['Kampagne s › Stole']],
    ]);
    expect(b.productConversions).toBe(3);
    expect(b.rest).toEqual([{ campaignId: 'q', campaignName: 'Søg', conversions: 4, revenue: 2000 }]);
    expect(b.restConversions).toBe(4);
  });
});
