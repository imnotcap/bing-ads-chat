import { beforeEach, describe, expect, it } from 'vitest';
import { getTool, type ToolContext } from '@/ai/tools';
import { blockedBy, clearSearchTerms, rememberSearchTerms } from '@/ai/tools/searchTerms';
import { DemoBackend } from '@/bing/demo/backend';
import { abortable } from '@/lib/utils';
import { DEFAULT_SPEND_RULES } from '@/stores/settings';

function ctx(): ToolContext {
  return { backend: new DemoBackend(0), accountId: '1000001', currency: 'DKK', rules: DEFAULT_SPEND_RULES, defaultPreset: 'last30', memo: new Map() };
}

describe('blockedBy', () => {
  beforeEach(clearSearchTerms);

  it('sums what an exact or phrase negative would have blocked, per ad group', () => {
    rememberSearchTerms('a', [
      { campaignId: 'c1', adGroupId: 'g1', searchTerm: 'Metal pengeskab', clicks: 4, spend: 40, conversions: 0 },
      { campaignId: 'c1', adGroupId: 'g1', searchTerm: 'pengeskab brandsikret', clicks: 2, spend: 20, conversions: 0 },
      { campaignId: 'c1', adGroupId: 'g2', searchTerm: 'pengeskab', clicks: 1, spend: 5, conversions: 1 },
    ]);
    expect(blockedBy('a', 'c1', { text: 'pengeskab', matchType: 'Phrase', adGroupId: 'g1' })).toEqual({ terms: 2, clicks: 6, spend: 60, conversions: 0 });
    expect(blockedBy('a', 'c1', { text: 'pengeskab', matchType: 'Phrase' })).toEqual({ terms: 3, clicks: 7, spend: 65, conversions: 1 });
    expect(blockedBy('a', 'c1', { text: 'metal pengeskab', matchType: 'Exact' })).toEqual({ terms: 1, clicks: 4, spend: 40, conversions: 0 });
    expect(blockedBy('a', 'c1', { text: 'penge', matchType: 'Phrase' })).toBeNull();
    expect(blockedBy('a', 'other', { text: 'pengeskab', matchType: 'Phrase' })).toBeNull();
  });
});

describe('get_search_terms', () => {
  beforeEach(() => {
    DemoBackend.reset();
    clearSearchTerms();
  });

  it('returns every term of an ad group at once – past the team row limit – and the proposal fills in the numbers', async () => {
    const c = { ...ctx(), rules: { ...DEFAULT_SPEND_RULES, maxRows: 2 } };
    const report = getTool('run_report')!;
    if (report.kind === 'write') throw new Error('unexpected');
    const sample = (await report.run(report.schema.parse({ kind: 'searchterm', period: 'last90', limit: 5 }), c)).result as { rows: { campaignId: string; adGroupId: string }[] };
    const { campaignId, adGroupId } = sample.rows[0]!;

    const tool = getTool('get_search_terms')!;
    if (tool.kind === 'write') throw new Error('unexpected');
    const out = (await tool.run(tool.schema.parse({ campaignId, adGroupId }), c)).result as {
      adGroups: { ref: string; id: string; keywords: string[] }[];
      columns: string[];
      terms: [string, string, number, number, number, number][];
      totals: { terms: number };
    };
    expect(out.adGroups).toHaveLength(1);
    expect(out.adGroups[0]!.id).toBe(adGroupId);
    expect(out.columns).toEqual(['term', 'adGroup', 'impressions', 'clicks', 'spend', 'conversions']);
    expect(out.terms.length).toBe(out.totals.terms);
    expect(out.terms.length).toBeGreaterThan(2); // more than the team's 2 rows per report
    expect(out.terms.every((t) => t[1] === out.adGroups[0]!.ref)).toBe(true);

    // The model only names the negative; clicks and spend come from the terms just read.
    const [term, , , clicks, spend] = out.terms[0]!;
    const propose = getTool('propose_negative_keywords')!;
    if (propose.kind !== 'write') throw new Error('unexpected');
    const planned = await propose.plan(propose.schema.parse({ reason: 'Test', campaignId, candidates: [{ text: term, matchType: 'Exact', adGroupId, why: 'Andet produkt' }] }), c);
    expect(planned.plan?.changes[0]?.cells?.clicks).toBe(clicks);
    expect(planned.plan?.changes[0]?.cells?.spend).toBeCloseTo(spend, 1);
  });
});

describe('abortable', () => {
  it('rejects as soon as the signal aborts, even if the promise never settles', async () => {
    const controller = new AbortController();
    const never = new Promise<number>(() => {});
    const run = abortable(never, controller.signal);
    controller.abort();
    await expect(run).rejects.toThrow('Aborted');
    await expect(abortable(Promise.resolve(3), new AbortController().signal)).resolves.toBe(3);
  });
});
