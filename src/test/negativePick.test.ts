import { beforeEach, describe, expect, it } from 'vitest';
import { applyExclusions } from '@/ai/approvals';
import { getTool, type ToolContext } from '@/ai/tools';
import { DemoBackend } from '@/bing/demo/backend';
import { DEFAULT_SPEND_RULES } from '@/stores/settings';

function ctx(): ToolContext {
  return { backend: new DemoBackend(0), accountId: '1000001', currency: 'DKK', rules: DEFAULT_SPEND_RULES, defaultPreset: 'last30', memo: new Map() };
}

describe('propose_negative_keywords', () => {
  beforeEach(() => DemoBackend.reset());

  it('shows search-term candidates as a pick table and adds only the ticked ones, per campaign', async () => {
    const c = ctx();
    const report = getTool('run_report')!;
    if (report.kind === 'write') throw new Error('unexpected');
    const out = await report.run(report.schema.parse({ kind: 'searchterm', period: 'last30', onlyWithoutConversions: true, limit: 6 }), c);
    const rows = (out.result as { rows: { searchTerm: string; campaignId: string; adGroupId: string; clicks?: number; spend?: number }[] }).rows;
    expect(rows.length).toBeGreaterThan(2);

    const tool = getTool('propose_negative_keywords')!;
    if (tool.kind !== 'write') throw new Error('unexpected');
    const input = tool.schema.parse({
      reason: 'Søgetermer uden konverteringer',
      candidates: rows.slice(0, 3).map((r, i) => ({
        text: r.searchTerm,
        matchType: 'Exact',
        campaignId: r.campaignId,
        adGroupId: i === 0 ? r.adGroupId : undefined,
        clicks: r.clicks,
        spend: r.spend,
        conversions: 0,
        why: 'Forbrug uden konverteringer',
      })),
    });
    const planned = await tool.plan(input, c);
    expect(planned.plan?.pick?.path).toEqual(['candidates']);
    expect(planned.plan?.changes).toHaveLength(3);
    expect(planned.plan?.changes[0]?.cells?.why).toBe('Forbrug uden konverteringer');

    // The user ticks the second row off.
    const picked = tool.schema.parse(applyExclusions(input, ['candidates'], [1]));
    const exec = await (await tool.plan(picked, c)).execute();
    expect(exec.summary).toMatch(/^2 negative søgeord tilføjet/);

    const first = rows[0]!;
    const onAdGroup = await c.backend.listNegativeKeywords(c.accountId, 'AdGroup', first.adGroupId);
    expect(onAdGroup.map((n) => n.text)).toContain(first.searchTerm);
    const onCampaign = await c.backend.listNegativeKeywords(c.accountId, 'Campaign', rows[2]!.campaignId);
    expect(onCampaign.map((n) => n.text)).toContain(rows[2]!.searchTerm);
    expect(onCampaign.map((n) => n.text)).not.toContain(rows[1]!.searchTerm);
  });

  it('removes only the ticked-off rows', () => {
    expect(applyExclusions({ a: 1, candidates: ['x', 'y', 'z'] }, ['candidates'], [0, 2])).toEqual({ a: 1, candidates: ['y'] });
  });
});
