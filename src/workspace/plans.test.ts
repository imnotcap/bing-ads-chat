import { describe, expect, it } from 'vitest';
import { EXTRA_USAGE_PACK, PLANS, billedSeats, creditSpent, includedUsage, isPlanId, monthlyPrice } from './plans';

describe('plans', () => {
  it('bills Solo as one seat', () => {
    expect(billedSeats('solo', 0)).toBe(1);
    expect(billedSeats('solo', 3)).toBe(1);
    expect(monthlyPrice('solo', 1)).toBe(PLANS.solo.priceUsd);
    expect(includedUsage('solo', 1)).toBe(PLANS.solo.includedUsd);
  });

  it('bills Teams per person, never below the minimum', () => {
    expect(billedSeats('teams', 1)).toBe(PLANS.teams.minSeats);
    expect(billedSeats('teams', 7)).toBe(7);
    expect(billedSeats('teams', 10_000)).toBe(PLANS.teams.maxSeats);
    expect(monthlyPrice('teams', 7)).toBe(7 * PLANS.teams.priceUsd);
    // Every seat adds to the shared pool.
    expect(includedUsage('teams', 7)).toBe(7 * PLANS.teams.includedUsd);
  });

  it('sells extra usage at a margin', () => {
    expect(EXTRA_USAGE_PACK.priceUsd).toBeGreaterThan(EXTRA_USAGE_PACK.creditUsd);
  });

  it('knows the plan ids', () => {
    expect(isPlanId('solo')).toBe(true);
    expect(isPlanId('teams')).toBe(true);
    expect(isPlanId('enterprise')).toBe(false);
    expect(isPlanId(undefined)).toBe(false);
  });
});

describe('creditSpent', () => {
  it('uses no credits while the month’s pool lasts', () => {
    expect(creditSpent(10, 5, 50)).toBe(0);
    expect(creditSpent(0, 50, 50)).toBe(0);
  });

  it('pays only the part beyond the pool with credits', () => {
    expect(creditSpent(48, 5, 50)).toBeCloseTo(3);
  });

  it('pays everything with credits once the pool is used up', () => {
    expect(creditSpent(60, 2, 50)).toBeCloseTo(2);
  });
});
