import { beforeEach, describe, expect, it } from 'vitest';
import { remainingUsd, useBilling, usageBlocked } from '@/workspace/billing';
import type { BillingState } from '@/workspace/types';

const full = (over: Partial<BillingState> = {}): BillingState =>
  ({
    month: '2026-10',
    plan: 'teams',
    seats: 3,
    people: 3,
    priceMonthlyUsd: 0,
    pricePerSeatUsd: 0,
    includedUsd: 30,
    usedUsd: 30,
    includedLeftUsd: 0,
    creditUsd: 0,
    remainingUsd: 0,
    purchases: [],
    pack: { priceUsd: 20, creditUsd: 25 },
    ...over,
  }) as BillingState;

beforeEach(() => useBilling.setState({ state: null, pending: 0 }));

describe('usage pool', () => {
  it('lets the assistant run while there is money left', () => {
    useBilling.setState({ state: full({ remainingUsd: 12 }), pending: 0 });
    expect(remainingUsd()).toBe(12);
    expect(usageBlocked()).toBeNull();
  });

  it('blocks and explains when the pool is spent', () => {
    useBilling.setState({ state: full(), pending: 0 });
    const msg = usageBlocked();
    expect(msg).toContain('oktober');
    expect(msg).toContain('ekstra');
  });

  it('counts requests that Cloudflare has not confirmed yet', () => {
    useBilling.setState({ state: full({ remainingUsd: 1 }), pending: 1.5 });
    expect(remainingUsd()).toBeCloseTo(-0.5);
    expect(usageBlocked()).not.toBeNull();
  });

  /*
   * A reply without the pool used to make remainingUsd NaN, which slipped past the
   * `left > 0` guard and then threw on state.purchases.length – the chat died with
   * "Cannot read properties of undefined" and nobody could send a message.
   */
  it('never blocks on a billing reply it cannot read', () => {
    for (const bad of [{}, { remainingUsd: null }, { remainingUsd: 'x' }, { remainingUsd: NaN }]) {
      useBilling.setState({ state: bad as unknown as BillingState, pending: 0 });
      expect(remainingUsd()).toBeNull();
      expect(usageBlocked()).toBeNull();
    }
  });

  it('still explains itself when the pool is spent but the extras are missing', () => {
    useBilling.setState({ state: { month: 'nonsense', includedUsd: 30, remainingUsd: 0 } as unknown as BillingState, pending: 0 });
    const msg = usageBlocked();
    expect(msg).toContain('denne måned');
    expect(msg).toContain('administrator');
  });
});
