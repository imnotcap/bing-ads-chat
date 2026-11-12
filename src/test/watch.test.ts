import { describe, expect, it } from 'vitest';
import { liveRows, periodRange } from '@/features/products/watch';
import { addDays, today } from '@/lib/format';

const item = (id: string, title = '') => ({ id, title, addedBy: 'Ida', addedAt: 1 });

describe('watched products', () => {
  it('matches Microsoft and shop numbers by product id, in any case, and shows 0 for nothing sold', () => {
    const ms = new Map([['2722722208', { title: 'Banquetstol', metrics: { impressions: 100, clicks: 10, spend: 50, conversions: 2, revenue: 900 } }]]);
    const shop = new Map([['2722722208', { name: 'Banquetstol sort', units: 3, revenue: 1200 }]]);
    const rows = liveRows([item('2722722208'), item('X1', 'Stabelstol')], ms, shop);
    expect(rows[0]).toMatchObject({ title: 'Banquetstol', ms: { clicks: 10 }, shop: { units: 3 } });
    expect(rows[1]).toMatchObject({ title: 'Stabelstol', ms: { clicks: 0 }, shop: { units: 0 } });
    expect(liveRows([item('A')], null, null)[0]).toMatchObject({ ms: null, shop: null, title: 'A' });
  });

  it('periods end today; "since" never starts in the future', () => {
    const t = today();
    expect(periodRange('today', t)).toEqual({ from: t, to: t });
    expect(periodRange('yesterday', t)).toEqual({ from: addDays(t, -1), to: addDays(t, -1) });
    expect(periodRange('last7', t)).toEqual({ from: addDays(t, -6), to: t });
    expect(periodRange('since', addDays(t, 5))).toEqual({ from: t, to: t });
  });
});
