import { beforeEach, describe, expect, it } from 'vitest';
import { getTool, type ToolContext } from '@/ai/tools';
import { DemoBackend } from '@/bing/demo/backend';
import { DEFAULT_SPEND_RULES } from '@/stores/settings';

function ctx(): ToolContext {
  return { backend: new DemoBackend(0), accountId: '1000001', currency: 'DKK', rules: DEFAULT_SPEND_RULES, defaultPreset: 'last30', memo: new Map() };
}

const HEADLINES = ['Ergonomiske kontorstole', 'Kontorstole til ryggen', 'Se hele udvalget', 'Fri fragt over 499 kr', '30 dages returret', 'Stole med nakkestøtte', 'Test din stol hos os', 'Få hjælp af en rådgiver'];
const DESCRIPTIONS = ['Find stolen, der passer til din ryg. Kontorstole fra kendte mærker.', 'Fri fragt ved køb over 499 kr. ekskl. moms – hurtig levering.', 'Prøv stolen i 30 dage, og send den tilbage, hvis den ikke passer.', 'Få en gratis rådgivning, og se vores udvalg af ergonomiske stole.'];
const EVIDENCE = [
  { claim: 'Fri fragt over 499 kr', quote: 'Fri fragt ved køb over 499 kr.' },
  { claim: '30 dages returret', quote: '30 dages returret på alle stole' },
  { claim: 'gratis rådgivning', quote: 'Gratis rådgivning – ring eller skriv' },
];

const read = (name: string) => {
  const tool = getTool(name)!;
  if (tool.kind === 'write') throw new Error('unexpected');
  return tool;
};
const write = (name: string) => {
  const tool = getTool(name)!;
  if (tool.kind !== 'write') throw new Error('unexpected');
  return tool;
};

type Review = { verdict: string; errors: string[]; warnings: string[]; tips: string[]; keywordCoverage: { share: number } | null; claims: { text: string; supported: boolean }[] };

describe('review_ad_copy', () => {
  beforeEach(() => DemoBackend.reset());

  it('checks a draft against the ad group’s real keywords and ads', async () => {
    const tool = read('review_ad_copy');
    const out = await tool.run(tool.schema.parse({ campaignId: '102', adGroupId: '1020', headlines: ['Ergonomisk kontorstol', ...HEADLINES], descriptions: DESCRIPTIONS, evidence: EVIDENCE }), ctx());
    const r = (out.result as unknown) as Review;
    // Keywords in the demo ad group: ergonomisk kontorstol, kontorstol, kontorstol med nakkestøtte, billig kontorstol.
    expect(r.keywordCoverage!.share).toBeGreaterThan(50);
    expect(r.claims.every((c) => c.supported)).toBe(true);
    expect(r.errors).toEqual([]);
  });

  it('flags claims without proof, and tells the assistant to fix before proposing', async () => {
    const tool = read('review_ad_copy');
    const out = await tool.run(tool.schema.parse({ campaignId: '102', adGroupId: '1020', headlines: HEADLINES, descriptions: DESCRIPTIONS }), ctx());
    const r = (out.result as unknown) as Review & { instruction: string };
    expect(r.verdict).toBe('fix_before_proposing');
    expect(r.warnings.join(' ')).toContain('Fri fragt');
    expect(r.instruction).toMatch(/review it again/i);
  });

  it('blocks pinning that leaves a position empty', async () => {
    const tool = read('review_ad_copy');
    const out = await tool.run(tool.schema.parse({ campaignId: '102', adGroupId: '1020', headlines: HEADLINES, headlinePins: HEADLINES.map(() => '1'), descriptions: DESCRIPTIONS, evidence: EVIDENCE }), ctx());
    expect(((out.result as unknown) as Review).verdict).toBe('blocked');
  });
});

describe('create_responsive_search_ad runs the same review', () => {
  beforeEach(() => DemoBackend.reset());
  const input = (extra: object = {}) => ({
    campaignId: '102',
    adGroupId: '1020',
    keywordHeadline: 'Kontorstole',
    headlines: HEADLINES,
    descriptions: DESCRIPTIONS,
    finalUrl: 'https://nordlys.dk/kontorstole',
    reason: 'Test',
    ...extra,
  });

  it('refuses an ad where no headline can show in position 2 or 3', async () => {
    const tool = write('create_responsive_search_ad');
    await expect(tool.plan(tool.schema.parse(input({ headlinePins: HEADLINES.map(() => '1') })), ctx())).rejects.toThrow(/position 2 og 3/);
  });

  it('puts unproven claims on the approval card, and nothing when they are backed', async () => {
    const tool = write('create_responsive_search_ad');
    const unbacked = await tool.plan(tool.schema.parse(input()), ctx());
    expect(unbacked.plan!.notes!.join(' ')).toContain('uden dokumentation');
    const backed = await tool.plan(tool.schema.parse(input({ evidence: EVIDENCE })), ctx());
    expect(backed.plan!.notes!.join(' ')).not.toContain('dokumentation');
  });

  it('still creates a passing ad, and puts the tips in the result for the assistant', async () => {
    const tool = write('create_responsive_search_ad');
    const change = await tool.plan(tool.schema.parse(input({ evidence: EVIDENCE })), ctx());
    const res = await change.execute();
    expect((res.result as { outcome: string; tips: string[] }).outcome).toBe('confirmed');
    expect(Array.isArray((res.result as { tips: string[] }).tips)).toBe(true);
  });
});
