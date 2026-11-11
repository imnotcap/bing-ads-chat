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
    const read = await tool.plan(tool.schema.parse({ service: 'campaign', path: 'AdExtensions/QueryByIds', method: 'POST', body: { AccountId: 1, AdExtensionIds: [2], AdExtensionType: 'SitelinkAdExtension' }, reason: 'x' }), ctx());
    expect(read.plan).toBeNull();
    const write = await tool.plan(tool.schema.parse({ service: 'campaign', path: 'CampaignCriterions', method: 'POST', body: { CampaignId: 105 }, reason: 'x' }), ctx());
    expect(write.plan?.kind).toBe('raw');
    expect(write.plan?.campaignIds).toEqual(['105']);
  });
});

describe('remove_negative_keywords', () => {
  it('finds the negatives by text, removes them, reads back, and can be undone', async () => {
    const c = ctx();
    await c.backend.addNegativeKeywords(c.accountId, 'Campaign', '102', [
      { text: 'gratis', matchType: 'Phrase' },
      { text: 'brugt', matchType: 'Exact' },
    ]);
    const tool = getTool('remove_negative_keywords')!;
    if (tool.kind !== 'write') throw new Error('unexpected');
    const { plan, execute } = await tool.plan(tool.schema.parse({ campaignId: '102', keywords: [{ text: 'Gratis' }, { text: 'findes ikke' }], reason: 'Blokerer gode søgninger' }), c);
    expect(plan!.changes.map((l) => [l.before, l.after])).toEqual([['gratis', 'Fjernet']]);
    expect(plan!.notes!.join(' ')).toMatch(/Ikke fundet.*"findes ikke"/);
    expect(plan!.undo).toMatchObject({ tool: 'add_negative_keywords', input: { keywords: [{ text: 'gratis', matchType: 'Phrase' }] } });
    await execute();
    const left = await c.backend.listNegativeKeywords(c.accountId, 'Campaign', '102', '102');
    expect(left.map((n) => n.text)).not.toContain('gratis');
    expect(left.map((n) => n.text)).toContain('brugt');
  });
});

describe('create_campaign – Shopping', () => {
  it('makes everything a Shopping campaign needs to show products, paused, and reads it back', async () => {
    const c = ctx();
    const b = c.backend;
    const calls: string[] = [];
    const tree: { adGroupId: string; bid?: number | null }[] = [];
    b.listStores = async () => [{ id: '4711', name: 'Inventarland' }];
    const create = b.createCampaign.bind(b);
    b.createCampaign = async (acc, spec) => (calls.push(`campaign:${spec.type}:${spec.shopping?.storeId}:${spec.status}`), create(acc, spec));
    b.applyProductPartitionActions = async (_acc, actions) => {
      for (const a of actions) if (a.action === 'Add') tree.push({ adGroupId: a.adGroupId, bid: a.bid });
      calls.push(`partition:${actions.map((a) => (a.action === 'Add' ? `${a.operand}:${a.bid}` : 'delete')).join(',')}`);
      return { ids: ['1'] };
    };
    b.listProductPartitions = async (_acc, adGroupId) => tree.filter((t) => t.adGroupId === adGroupId).map((t, i) => ({ id: String(i), parentId: null, group: 'x', unit: true, excluded: false, operand: 'All', attribute: '', bid: t.bid }));
    b.createProductAd = async () => (calls.push('product ad'), { ids: ['9'] });

    const tool = getTool('create_campaign')!;
    if (tool.kind !== 'write') throw new Error('unexpected');
    const { plan, execute } = await tool.plan(
      tool.schema.parse({ name: 'Shopping | Test', type: 'Shopping', dailyBudget: 100, bidStrategy: { type: 'EnhancedCpc' }, productBid: 10.05, reason: 'Ny kampagne' }),
      c,
    );
    expect(plan!.changes.map((l) => [l.field, l.after])).toEqual(
      expect.arrayContaining([
        ['butik', 'Inventarland (4711) · DK'],
        ['Annoncegruppe', 'Alle produkter'],
        ['Alle produkter · bud', 10.05],
      ]),
    );
    const done = await execute();
    expect(calls).toEqual(['campaign:Shopping:4711:Paused', 'partition:All:10.05', 'product ad']);
    expect(done.result).toMatchObject({ outcome: 'confirmed', made: [expect.stringMatching(/^kampagnen/), 'annoncegruppen "Alle produkter"', 'produktgruppen "Alle produkter"', 'produktannoncen'] });
  });

  it('asks which store when there are several', async () => {
    const c = ctx();
    c.backend.listStores = async () => [{ id: '1', name: 'A' }, { id: '2', name: 'B' }];
    c.backend.createProductAd = async () => ({ ids: [] });
    c.backend.applyProductPartitionActions = async () => ({ ids: [] });
    c.backend.listProductPartitions = async () => [];
    const tool = getTool('create_campaign')!;
    if (tool.kind !== 'write') throw new Error('unexpected');
    await expect(tool.plan(tool.schema.parse({ name: 'S', type: 'Shopping', dailyBudget: 50, bidStrategy: { type: 'EnhancedCpc' }, reason: 'x' }), c)).rejects.toThrow(/Vælg butikken \(storeId\): "A" \(1\), "B" \(2\)/);
  });
});
