import { describe, expect, it } from 'vitest';
import { evaluateGuardrails, type ChangePlan } from '@/ai/guardrails';
import { DEFAULT_SPEND_RULES, type SpendRules } from '@/stores/settings';

const ctx = { currency: 'DKK', totalActiveDailyBudget: 1000, monthToDateSpend: 10_000, daysLeftInMonth: 10 };

function plan(p: Partial<ChangePlan>): ChangePlan {
  return { kind: 'update', title: 't', changes: [], dailyBudgetDelta: 0, increasesSpend: false, campaignIds: ['1'], ...p };
}

const rules = (r: Partial<SpendRules>): SpendRules => ({ ...DEFAULT_SPEND_RULES, ...r });

describe('evaluateGuardrails', () => {
  it('allows spend-neutral changes in "spend" mode', () => {
    expect(evaluateGuardrails(plan({}), rules({ approvalMode: 'spend' }), ctx).verdict).toBe('allow');
  });

  it('requires approval for spend increases in "spend" mode', () => {
    const d = evaluateGuardrails(plan({ increasesSpend: true, dailyBudgetDelta: 50 }), rules({ approvalMode: 'spend' }), ctx);
    expect(d.verdict).toBe('approve');
  });

  it('requires approval for everything in "all" mode', () => {
    expect(evaluateGuardrails(plan({}), rules({ approvalMode: 'all' }), ctx).verdict).toBe('approve');
  });

  it('autopilot still asks when a budget increase exceeds the percentage limit', () => {
    const d = evaluateGuardrails(plan({ increasesSpend: true, maxBudgetIncrease: 0.8 }), rules({ approvalMode: 'none', maxBudgetIncreasePct: 50 }), ctx);
    expect(d.verdict).toBe('approve');
    expect(d.reasons.join(' ')).toContain('80 %');
  });

  it('autopilot allows changes within the limits', () => {
    const d = evaluateGuardrails(plan({ increasesSpend: true, maxBudgetIncrease: 0.2, dailyBudgetDelta: 20 }), rules({ approvalMode: 'none' }), ctx);
    expect(d.verdict).toBe('allow');
  });

  it('blocks protected campaigns', () => {
    const d = evaluateGuardrails(plan({ campaignIds: ['7'] }), rules({ protectedCampaignIds: ['7'] }), ctx);
    expect(d.verdict).toBe('block');
  });

  it('blocks budgets above the per-campaign ceiling', () => {
    const d = evaluateGuardrails(plan({ newDailyBudgets: [900] }), rules({ maxDailyBudgetPerCampaign: 500 }), ctx);
    expect(d.verdict).toBe('block');
  });

  it('blocks bids above the CPC ceiling', () => {
    expect(evaluateGuardrails(plan({ newBids: [12] }), rules({ maxCpcBid: 10 }), ctx).verdict).toBe('block');
  });

  it('blocks deletes unless allowed', () => {
    expect(evaluateGuardrails(plan({ kind: 'delete' }), rules({ allowDelete: false }), ctx).verdict).toBe('block');
    expect(evaluateGuardrails(plan({ kind: 'delete' }), rules({ allowDelete: true, approvalMode: 'spend' }), ctx).verdict).toBe('approve');
  });

  it('blocks when the total daily budget ceiling would be exceeded', () => {
    const d = evaluateGuardrails(plan({ dailyBudgetDelta: 300, increasesSpend: true }), rules({ maxTotalDailyBudget: 1200, approvalMode: 'none' }), ctx);
    expect(d.verdict).toBe('block');
  });

  it('asks for approval when the month forecast exceeds the monthly budget', () => {
    // 10.000 + (1000 + 200) * 10 = 22.000 > 20.000
    const d = evaluateGuardrails(plan({ dailyBudgetDelta: 200, increasesSpend: true }), rules({ monthlyBudget: 20_000, approvalMode: 'none' }), ctx);
    expect(d.verdict).toBe('approve');
  });

  it('always asks for raw API changes', () => {
    expect(evaluateGuardrails(plan({ kind: 'raw' }), rules({ approvalMode: 'none' }), ctx).verdict).toBe('approve');
  });
});
