import { beforeEach, describe, expect, it } from 'vitest';
import { evaluateGuardrails } from '@/ai/guardrails';
import { ALL_TOOLS, getTool, toolDefinitions, type ToolContext } from '@/ai/tools';
import { DemoBackend } from '@/bing/demo/backend';
import { DEFAULT_SPEND_RULES } from '@/stores/settings';

function ctx(): ToolContext {
  return { backend: new DemoBackend(0), accountId: '1000001', currency: 'DKK', rules: DEFAULT_SPEND_RULES, defaultPreset: 'last30', memo: new Map() };
}

describe('tools', () => {
  beforeEach(() => DemoBackend.reset());

  it('produces valid JSON schemas for every tool', () => {
    const defs = toolDefinitions();
    expect(defs).toHaveLength(ALL_TOOLS.length);
    for (const d of defs) {
      expect(d.input_schema.type).toBe('object');
      expect(d.description?.length).toBeGreaterThan(20);
      expect(JSON.stringify(d.input_schema)).not.toContain('$schema');
    }
    expect(new Set(defs.map((d) => d.name)).size).toBe(defs.length);
  });

  it('runs the overview with a visual', async () => {
    const tool = getTool('get_performance_overview')!;
    if (tool.kind === 'write') throw new Error('unexpected');
    const out = await tool.run(tool.schema.parse({ period: 'last7' }), ctx());
    expect(out.visual?.type).toBe('kpis');
    expect((out.result as { totals: { spend: number } }).totals.spend).toBeGreaterThan(0);
  });

  it('filters search terms without conversions', async () => {
    const tool = getTool('run_report')!;
    if (tool.kind === 'write') throw new Error('unexpected');
    const out = await tool.run(tool.schema.parse({ kind: 'searchterm', period: 'last30', onlyWithoutConversions: true }), ctx());
    const rows = (out.result as { rows: { conversions?: number; searchTerm: string }[] }).rows;
    expect(rows.length).toBeGreaterThan(3);
    expect(rows.every((r) => !r.conversions)).toBe(true);
  });

  it('plans a budget increase that needs approval and executes it', async () => {
    const c = ctx();
    const tool = getTool('update_campaigns')!;
    if (tool.kind !== 'write') throw new Error('unexpected');
    const change = await tool.plan(tool.schema.parse({ changes: [{ campaignId: '103', dailyBudget: 600 }], reason: 'Begrænset af budget' }), c);
    expect(change.plan?.dailyBudgetDelta).toBe(200);
    expect(change.plan?.maxBudgetIncrease).toBeCloseTo(0.5);
    const decision = evaluateGuardrails(change.plan!, c.rules, { currency: 'DKK', totalActiveDailyBudget: null, monthToDateSpend: null, daysLeftInMonth: 0 });
    expect(decision.verdict).toBe('approve');
    const res = await change.execute();
    expect(res.summary).toBe('Bekræftet hos Microsoft: 1 ændring');
    expect((res.result as { outcome: string }).outcome).toBe('confirmed');
    expect(change.plan?.undo?.input).toEqual(expect.objectContaining({ changes: [{ campaignId: '103', dailyBudget: 400 }] }));
    expect((await c.backend.listCampaigns('1000001')).find((x) => x.id === '103')?.dailyBudget).toBe(600);
  });

  it('rejects ad copy that is too long', () => {
    const tool = getTool('create_responsive_search_ad')!;
    const r = tool.schema.safeParse({
      campaignId: '102',
      adGroupId: '1020',
      headlines: ['Denne overskrift er alt for lang til en annonce', 'B', 'C'],
      descriptions: ['a', 'b'],
      finalUrl: 'https://example.com',
      reason: 'x',
    });
    expect(r.success).toBe(false);
  });

  it('treats raw API query calls as read-only', async () => {
    const tool = getTool('microsoft_ads_api')!;
    if (tool.kind !== 'write') throw new Error('unexpected');
    const read = await tool.plan(tool.schema.parse({ service: 'campaign', path: 'AdExtensions/QueryByIds', method: 'POST', body: {}, reason: 'x' }), ctx());
    expect(read.plan).toBeNull();
    const write = await tool.plan(tool.schema.parse({ service: 'campaign', path: 'CampaignCriterions', method: 'POST', body: { CampaignId: 105 }, reason: 'x' }), ctx());
    expect(write.plan?.kind).toBe('raw');
    expect(write.plan?.campaignIds).toEqual(['105']);
  });
});
