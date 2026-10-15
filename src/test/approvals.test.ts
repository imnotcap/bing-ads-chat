import { beforeEach, describe, expect, it } from 'vitest';
import { applyEdits } from '@/ai/approvals';
import { evaluateGuardrails } from '@/ai/guardrails';
import { getTool, type ToolContext } from '@/ai/tools';
import { DemoBackend } from '@/bing/demo/backend';
import { DEFAULT_SPEND_RULES } from '@/stores/settings';

function ctx(): ToolContext {
  return { backend: new DemoBackend(0), accountId: '1000001', currency: 'DKK', rules: DEFAULT_SPEND_RULES, defaultPreset: 'last30', memo: new Map() };
}
const spendCtx = { currency: 'DKK', totalActiveDailyBudget: 1800, monthToDateSpend: 10000, daysLeftInMonth: 10 };

describe('editable approvals', () => {
  beforeEach(() => DemoBackend.reset());

  it('applies edits by path without mutating the original input', () => {
    const input = { changes: [{ campaignId: '1', name: 'A' }, { campaignId: '2', name: 'B' }], reason: 'x' };
    const out = applyEdits(input, [{ path: ['changes', 1, 'name'], value: '  Search | Sofaer | DK  ' }]) as typeof input;
    expect(out.changes[1]!.name).toBe('Search | Sofaer | DK');
    expect(input.changes[1]!.name).toBe('B');
  });

  it('marks renamed titles as editable and always asks for approval, even on autopilot', async () => {
    const tool = getTool('update_campaigns')!;
    if (tool.kind !== 'write') throw new Error('unexpected');
    const campaigns = await new DemoBackend(0).listCampaigns('1000001');
    const id = campaigns[0]!.id;
    const { plan } = await tool.plan(tool.schema.parse({ changes: [{ campaignId: id, name: 'Search | Test | DK' }], reason: 'Klarere navn' }), ctx());
    if (!plan) throw new Error('no plan');
    expect(plan.changes[0]!.edit?.path).toEqual(['changes', 0, 'name']);
    const decision = evaluateGuardrails(plan, { ...DEFAULT_SPEND_RULES, approvalMode: 'none' }, spendCtx);
    expect(decision.verdict).toBe('approve');
  });

  it('shows follow-up suggestions as a terminal visual', async () => {
    const tool = getTool('suggest_next_steps')!;
    if (tool.kind === 'write') throw new Error('unexpected');
    const out = await tool.run(
      tool.schema.parse({ question: 'Skal jeg lave flere ændringer?', suggestions: [{ label: 'Titel-optimér de nye kampagner', prompt: 'Titel-optimér', primary: true }] }),
      ctx(),
    );
    expect(out.visual?.type).toBe('suggestions');
  });
});
