import { beforeEach, describe, expect, it } from 'vitest';
import { LIMIT_BRANCH_IDS, cleanLimits, effectiveLimits, limitGroups, otherBranchesContext } from '@/ai/branchLimits';
import { evaluateGuardrails, type ChangePlan } from '@/ai/guardrails';
import { buildContextBlock } from '@/ai/prompt';
import { getTool, type ToolContext } from '@/ai/tools';
import { DemoBackend } from '@/bing/demo/backend';
import { DEFAULT_SPEND_RULES } from '@/stores/settings';

const spendCtx = { currency: 'DKK', totalActiveDailyBudget: 1000, monthToDateSpend: 0, daysLeftInMonth: 10 };
const plan = (p: Partial<ChangePlan> = {}): ChangePlan => ({ kind: 'update', title: 't', changes: [], dailyBudgetDelta: 0, increasesSpend: false, campaignIds: [], ...p });

describe('budget and limits per branch', () => {
  it('every branch has settings that fit it', () => {
    const keys = (id: (typeof LIMIT_BRANCH_IDS)[number]) => limitGroups(id).flatMap((g) => g.fields.map((f) => f.key));
    expect(keys('google_ads')).toEqual(expect.arrayContaining(['monthlyBudget', 'maxDailyBudgetPerCampaign', 'maxCpcBid', 'targetRoas', 'mayPropose', 'protectedCampaignIds', 'maxRows']));
    expect(keys('microsoft_ads')).toContain('autoPauseAtMonthlyBudget');
    expect(keys('meta_ads')).not.toContain('autoPauseAtMonthlyBudget');
    expect(keys('daisycon')).toEqual(expect.arrayContaining(['monthlyBudget', 'maxCommissionPct']));
    expect(keys('serper')).toEqual(['monthlyCreditCap', 'maxRows']);
    expect(keys('ga4')).toEqual(['maxRows']);
  });

  it('only accepts known fields with sane values', () => {
    expect(cleanLimits({ monthlyBudget: '50.000', warnAtPct: 3, maxRows: 99999, mayPropose: false, hacker: 1, targetCpa: null, maxCpcBid: 'abc', protectedCampaignIds: [' 12 ', '', '12', 'Brand'] })).toEqual({
      monthlyBudget: 50000,
      warnAtPct: 10,
      maxRows: 1000,
      mayPropose: false,
      targetCpa: null,
      protectedCampaignIds: ['12', 'Brand'],
    });
    expect(cleanLimits({ monthlyBudget: '1.234,5' }).monthlyBudget).toBe(1234.5);
    expect(cleanLimits({ maxCpcBid: '4,25' }).maxCpcBid).toBe(4.25);
    expect(effectiveLimits({ values: { monthlyBudget: 9000 }, updatedBy: 'Casper', updatedAt: 1 })).toMatchObject({ monthlyBudget: 9000, mayPropose: true, maxRows: 200 });
  });

  it("gives the chat the other branches' budgets – but not those of archived channels", () => {
    const line = otherBranchesContext({
      // Archived with Google Ads: a stored budget stays stored, but the assistant is not told about it.
      google_ads: { values: { monthlyBudget: 40000, targetRoas: 5 }, updatedBy: null, updatedAt: null },
      serper: { values: { monthlyCreditCap: 2500 }, updatedBy: null, updatedAt: null },
      meta_ads: null,
    });
    expect(line).toContain('Serper: max 2500 credits/month');
    expect(line).not.toContain('Google Ads');
    expect(line).not.toContain('Meta');
    expect(otherBranchesContext({})).toBeNull();
    expect(otherBranchesContext({ google_ads: { values: { monthlyBudget: 40000 }, updatedBy: null, updatedAt: null } })).toBeNull();
    const block = buildContextBlock({ account: null, mode: 'demo', periodLabel: 'x', periodRange: { from: 'a', to: 'b' }, rules: DEFAULT_SPEND_RULES, otherBranches: line });
    expect(block).toContain('Serper: max 2500 credits/month');
  });

  it('a read-only branch blocks every change, but can still be trained', () => {
    const rules = { ...DEFAULT_SPEND_RULES, mayPropose: false };
    expect(evaluateGuardrails(plan(), rules, spendCtx)).toMatchObject({ verdict: 'block', reasons: [expect.stringMatching(/kun at læse/)] });
    expect(evaluateGuardrails(plan({ training: true }), rules, spendCtx).verdict).toBe('approve');
    expect(buildContextBlock({ account: null, mode: 'demo', periodLabel: 'x', periodRange: { from: 'a', to: 'b' }, rules })).toContain('READ-ONLY');
  });

  describe('row limit per query', () => {
    beforeEach(() => DemoBackend.reset());
    it('reports never return more rows than the team allows', async () => {
      const tool = getTool('run_report')!;
      if (tool.kind === 'write') throw new Error('unexpected');
      const ctx: ToolContext = { backend: new DemoBackend(0), accountId: '1000001', currency: 'DKK', rules: { ...DEFAULT_SPEND_RULES, maxRows: 10 }, defaultPreset: 'last30', memo: new Map() };
      const out = await tool.run(tool.schema.parse({ kind: 'searchterm', limit: 500 }), ctx);
      const result = out.result as { rows: unknown[]; totalRows: number; note?: string };
      expect(result.rows.length).toBeLessThanOrEqual(10);
      if (result.totalRows > 10) expect(result.note).toMatch(/team limit 10/);
    });
  });
});
