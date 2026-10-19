import { beforeEach, describe, expect, it } from 'vitest';
import { applyPicks } from '@/ai/approvals';
import { getTool, type ToolContext } from '@/ai/tools';
import { DemoBackend } from '@/bing/demo/backend';
import { DEFAULT_SPEND_RULES } from '@/stores/settings';

function ctx(): ToolContext {
  return { backend: new DemoBackend(0), accountId: '1000001', currency: 'DKK', rules: DEFAULT_SPEND_RULES, defaultPreset: 'last30', memo: new Map() };
}

describe('propose_negative_keywords', () => {
  beforeEach(() => DemoBackend.reset());

  it('shows one campaign’s search terms as a pick table and adds the ticked and manual ones', async () => {
    const c = ctx();
    const report = getTool('run_report')!;
    if (report.kind === 'write') throw new Error('unexpected');
    const out = await report.run(report.schema.parse({ kind: 'searchterm', period: 'last30', onlyWithoutConversions: true, limit: 50 }), c);
    const all = (out.result as { rows: { searchTerm: string; campaignId: string; adGroupId: string; clicks?: number; spend?: number }[] }).rows;
    const campaignId = all[0]!.campaignId;
    const rows = all.filter((r) => r.campaignId === campaignId).slice(0, 3);
    expect(rows.length).toBe(3);

    const tool = getTool('propose_negative_keywords')!;
    if (tool.kind !== 'write') throw new Error('unexpected');
    const input = tool.schema.parse({
      reason: 'Søgetermer uden konverteringer',
      campaignId,
      candidates: rows.map((r, i) => ({
        text: r.searchTerm,
        matchType: 'Exact',
        adGroupId: i === 0 ? r.adGroupId : undefined,
        clicks: r.clicks,
        spend: r.spend,
        conversions: 0,
        why: 'Forbrug uden konverteringer',
      })),
    });
    const planned = await tool.plan(input, c);
    const plan = planned.plan!;
    expect(plan.pick?.path).toEqual(['candidates']);
    expect(plan.campaignIds).toEqual([campaignId]);
    expect(plan.changes).toHaveLength(3);
    expect(plan.changes.every((ch) => !ch.edit)).toBe(true);
    expect(plan.changes[0]?.cells?.matchType).toBe('Exact');

    // The user ticks the second row off and adds one of their own.
    const picked = tool.schema.parse(applyPicks(input, ['candidates'], [1], [{ ...plan.pick!.add!.base, text: 'gratis', matchType: 'Phrase' }]));
    const exec = await (await tool.plan(picked, c)).execute();
    expect(exec.summary).toMatch(/^Bekræftet hos Microsoft: 3 negative søgeord/);

    const onAdGroup = await c.backend.listNegativeKeywords(c.accountId, 'AdGroup', rows[0]!.adGroupId);
    expect(onAdGroup.map((n) => n.text)).toContain(rows[0]!.searchTerm);
    const onCampaign = (await c.backend.listNegativeKeywords(c.accountId, 'Campaign', campaignId)).map((n) => n.text);
    expect(onCampaign).toContain(rows[2]!.searchTerm);
    expect(onCampaign).toContain('gratis');
    expect(onCampaign).not.toContain(rows[1]!.searchTerm);
  });

  it('removes the ticked-off rows and appends added items', () => {
    expect(applyPicks({ a: 1, candidates: ['x', 'y', 'z'] }, ['candidates'], [0, 2], ['w'])).toEqual({ a: 1, candidates: ['y', 'w'] });
  });
});
