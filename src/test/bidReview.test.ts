import { describe, expect, it } from 'vitest';
import { getTool, type ToolContext } from '@/ai/tools';
import { pacing, reviewBid, reviewCampaign, trackingHealth, type CampaignInput, type Context } from '@/features/bidding/review';
import { DemoBackend } from '@/bing/demo/backend';
import { DEFAULT_SPEND_RULES } from '@/stores/settings';

const NOW = Date.UTC(2026, 10, 25);
const DAY = 86_400_000;
const ctx: Context = { now: NOW, cycleDays: 7, accountConversions30: 120, tracking: { broken: false, detail: '' }, maxBudgetIncreasePct: null };
const TEAM = { cpa: 200, roas: null };

/** A Maximize conversions campaign with a 200 kr. target CPA: spend and conversions over the 30 days. */
const camp = (spend: number, conversions: number, o: Partial<CampaignInput> = {}): CampaignInput => ({
  id: '1',
  name: 'Kontorstole',
  type: 'Search',
  strategy: { type: 'MaxConversions', targetCpa: 200 },
  dailyBudget: 300,
  sharedBudget: false,
  metrics: { spend, clicks: spend / 5, conversions, revenue: conversions * 1500 },
  days: 30,
  lostToBudget: 0,
  lostToRank: 10,
  last: {},
  targetTightenings60: 0,
  event: null,
  ...o,
});

describe('the decision table', () => {
  it('limited by budget and on goal → budget +20 %, target kept', () => {
    const v = reviewCampaign(camp(8700, 50, { lostToBudget: 25 }), TEAM, ctx);
    expect(v.budget).toMatchObject({ move: 'raise', from: 300, to: 360, rule: 'B1' });
    expect(v.target.move).toBe('hold');
  });

  it('limited by budget and over goal → keep budget, tighten target −15 %', () => {
    const v = reviewCampaign(camp(8700, 35, { lostToBudget: 25 }), TEAM, ctx);
    expect(v.budget).toMatchObject({ move: 'hold', rule: 'B2' });
    expect(v.target).toMatchObject({ move: 'lower', from: 200, to: 170, rule: 'B2', kind: 'cpa' });
  });

  it('clearly better than goal and not limited → loosen target +15 %', () => {
    const v = reviewCampaign(camp(6000, 40), TEAM, ctx); // CPA 150 = 75 % of goal
    expect(v.target).toMatchObject({ move: 'raise', from: 200, to: 230, rule: 'T1' });
  });

  it('over goal by more than 15 % → tighten; after two tightenings a person decides and budget −20 % is offered', () => {
    expect(reviewCampaign(camp(9000, 35), TEAM, ctx).target).toMatchObject({ move: 'lower', to: 170, rule: 'T2' });
    const v = reviewCampaign(camp(9000, 35, { targetTightenings60: 2 }), TEAM, ctx);
    expect(v.budget).toMatchObject({ move: 'lower', to: 240, rule: 'T3' });
    expect(v.escalate.join(' ')).toMatch(/2 stramninger/);
  });

  it('within ±15 % → keep both; under 70 % of the budget used → keep and say the spare budget can move', () => {
    const v = reviewCampaign(camp(6600, 33), TEAM, ctx); // CPA 200, 220 kr./day of 300
    expect([v.budget.move, v.target.move]).toEqual(['hold', 'hold']);
    const low = reviewCampaign(camp(4000, 30, { strategy: { type: 'MaxConversions', targetCpa: 133 } }), TEAM, ctx);
    expect(low.budget.rule).toBe('B5');
  });

  it('works mirrored for ROAS', () => {
    const roasCamp = camp(10_000, 40, { strategy: { type: 'MaxConversionValue', targetRoas: 6 }, metrics: { spend: 10_000, clicks: 2000, conversions: 40, revenue: 45_000 } }); // ROAS 4.5 vs 6
    expect(reviewCampaign(roasCamp, { cpa: null, roas: 6 }, ctx).target).toMatchObject({ move: 'raise', from: 6, to: 6.9, kind: 'roas', rule: 'T2' });
  });

  it('a strategy without a target gets one at the actual 30-day value (Microsoft)', () => {
    const v = reviewCampaign(camp(9000, 35, { strategy: { type: 'MaxConversions' } }), TEAM, ctx);
    expect(v.target).toMatchObject({ move: 'add', to: 257, rule: 'T2' });
  });

  it('Enhanced CPC: the bids are the lever, and a switch is for a person to decide', () => {
    const v = reviewCampaign(camp(9000, 35, { strategy: { type: 'EnhancedCpc' } }), TEAM, ctx);
    expect(v.target).toMatchObject({ kind: 'bids', move: 'lower' });
    expect(v.escalate.join(' ')).toMatch(/konverteringsbaseret strategi/);
  });
});

describe('the gates', () => {
  it('learning period: nothing for 14 days after a strategy switch', () => {
    const v = reviewCampaign(camp(8700, 50, { lostToBudget: 25, last: { strategy: NOW - 5 * DAY } }), TEAM, ctx);
    expect(v.gate).toBe('Læring');
    expect([v.budget.move, v.target.move]).toEqual(['hold', 'hold']);
  });

  it('cooldown: one conversion cycle (at least 7 days) after any change to the campaign', () => {
    expect(reviewCampaign(camp(9000, 35, { last: { budget: NOW - 3 * DAY } }), TEAM, ctx).gate).toBe('Afkøling');
    expect(reviewCampaign(camp(9000, 35, { last: { budget: NOW - 9 * DAY } }), TEAM, { ...ctx, cycleDays: 12 }).gate).toBe('Afkøling');
    expect(reviewCampaign(camp(9000, 35, { last: { budget: NOW - 9 * DAY } }), TEAM, ctx).gate).toBeNull();
  });

  it('under 30 conversions: only a signal, nothing changes', () => {
    const v = reviewCampaign(camp(4500, 15), TEAM, ctx); // CPA 300
    expect(v.target.move).toBe('hold');
    expect(v.target.why).toMatch(/Kun 15 konverteringer/);
  });

  it('tracking looks broken: everything held, a person alerted', () => {
    const v = reviewCampaign(camp(9000, 35), TEAM, { ...ctx, tracking: { broken: true, detail: 'x' } });
    expect(v.gate).toBe('Sporing');
    expect(v.escalate[0]).toMatch(/Sporingen/);
  });

  it('a campaign period in the window: targets stay', () => {
    const v = reviewCampaign(camp(9000, 35, { event: 'kampagneperioden "Black Week"' }), TEAM, ctx);
    expect(v.target).toMatchObject({ move: 'hold', rule: 'G6' });
  });

  it('no goal anywhere: nothing to judge against', () => {
    expect(reviewCampaign(camp(9000, 35, { strategy: { type: 'MaxConversions' } }), { cpa: null, roas: null }, ctx).gate).toBe('Mål mangler');
  });

  it('CPA more than twice the goal goes to a person', () => {
    expect(reviewCampaign(camp(18_000, 40), TEAM, ctx).escalate.join(' ')).toMatch(/over det dobbelte/);
  });
});

describe('Enhanced CPC bids', () => {
  const k = (o: Partial<Parameters<typeof reviewBid>[0]>) => ({ id: 'k', label: 'kontorstol', bid: 10, clicks: 200, spend: 2000, conversions: 12, revenue: 12_000, ...o });

  it('moves toward the bid that meets the goal, at most 20 % at a time', () => {
    // 60 kr. per click at goal ROAS 4 → 15 kr. tolerated; bid 10 → 12 (cap +20 %).
    expect(reviewBid(k({}), { cpa: null, roas: 4 }, 10.05, null)).toMatchObject({ move: 'raise', to: 12, rule: 'K2' });
    // 20 kr. per click → 5 kr. tolerated – under the 10,05 kr. minimum: pause/exclude.
    expect(reviewBid(k({ bid: 14, revenue: 4000 }), { cpa: null, roas: 4 }, 10.05, null)).toMatchObject({ move: 'lower', to: null, rule: 'K4' });
    expect(reviewBid(k({ bid: 20, revenue: 12_000 }), { cpa: null, roas: 5 }, 10.05, null)).toMatchObject({ move: 'lower', to: 16, rule: 'K3' });
  });

  it('judges nothing under 30 clicks, and a ROAS only from 100 clicks or 10 conversions', () => {
    expect(reviewBid(k({ clicks: 20 }), { cpa: null, roas: 4 }, 10.05, null)).toBeNull();
    expect(reviewBid(k({ clicks: 60, conversions: 2 }), { cpa: null, roas: 4 }, 10.05, null)).toBeNull();
  });

  it('no sales after 2× the goal CPA: lower 20 % – or pause when already at the minimum', () => {
    expect(reviewBid(k({ conversions: 0, revenue: 0, spend: 500, clicks: 40, bid: 15 }), { cpa: 200, roas: null }, 10.05, null)).toMatchObject({ move: 'lower', to: 12, rule: 'K1' });
    expect(reviewBid(k({ conversions: 0, revenue: 0, spend: 500, clicks: 40, bid: 10.05 }), { cpa: 200, roas: null }, 10.05, null)).toMatchObject({ rule: 'K0', to: null });
  });
});

describe('account checks', () => {
  it('sees conversions gone while clicks hold – not the normal lag of the newest days', () => {
    const normal = Array.from({ length: 7 }, () => ({ clicks: 300, conversions: 6 }));
    expect(trackingHealth([...normal, { clicks: 290, conversions: 0 }, { clicks: 310, conversions: 1 }]).broken).toBe(true);
    expect(trackingHealth([...normal, { clicks: 290, conversions: 3 }, { clicks: 310, conversions: 2 }]).broken).toBe(false);
    expect(trackingHealth([...normal, { clicks: 100, conversions: 0 }, { clicks: 90, conversions: 0 }]).broken).toBe(false);
  });

  it('paces against the month, not the day', () => {
    expect(pacing(11_600, 10, 30, 30_000, 33_000)).toMatchObject({ status: 'ahead', escalate: expect.stringMatching(/over månedsbudgettet/) });
    expect(pacing(10_500, 10, 30, 30_000, 29_000)).toMatchObject({ status: 'ok', escalate: null });
    expect(pacing(5000, 10, 30, null, 9000).status).toBe('none');
  });
});

describe('the tool on the demo account', () => {
  it('reviews every active campaign without changing anything', async () => {
    const backend = new DemoBackend(0);
    const c: ToolContext = { backend, accountId: '1000001', currency: 'DKK', rules: DEFAULT_SPEND_RULES, defaultPreset: 'last30', memo: new Map() };
    const tool = getTool('review_bids_and_budgets')!;
    if (tool.kind !== 'read') throw new Error('unexpected');
    const out = (await tool.run(tool.schema.parse({}), c)) as { result: { campaigns: { campaign: string; budget: { advice: string } }[]; window: { from: string; to: string } } };
    expect(out.result.campaigns.length).toBeGreaterThan(0);
    expect(out.result.campaigns.every((x) => /^(Hæv|Sænk|Behold|Sæt mål)/.test(x.budget.advice))).toBe(true);
  });
});

describe('step limits on the card', () => {
  it('warns when a budget or bid moves more than 20 %', async () => {
    const { evaluateGuardrails } = await import('@/ai/guardrails');
    const plan = (before: number, after: number) => ({
      kind: 'update' as const,
      title: 'x',
      changes: [{ entity: 'Kampagne', field: 'Kontorstole · dagsbudget', before, after }],
      dailyBudgetDelta: after - before,
      increasesSpend: after > before,
      campaignIds: ['1'],
    });
    const spend = { currency: 'DKK', totalActiveDailyBudget: null, monthToDateSpend: null, daysLeftInMonth: 10 };
    const rules = { ...DEFAULT_SPEND_RULES, maxBudgetIncreasePct: null, monthlyBudget: null, maxDailyBudgetPerCampaign: null, maxTotalDailyBudget: null };
    expect(evaluateGuardrails(plan(300, 450), rules, spend).reasons.join(' ')).toMatch(/mere end 20 % \(op til 50 %\)/);
    expect(evaluateGuardrails(plan(300, 360), rules, spend).reasons.join(' ')).not.toMatch(/mere end 20 %/);
  });
});

describe('bid advice next to Google', () => {
  it('does not raise a bid on a few good sales', async () => {
    const { bidAdvice } = await import('@/features/audit/productMirror');
    const st = (clicks: number, spend: number, conversions: number, revenue: number) => ({ clicks, spend, conversions, revenue });
    expect(bidAdvice(40, 28, st(50, 500, 2, 4000), 5)).toMatchObject({ verdict: 'keep' });
    expect(bidAdvice(40, 28, st(120, 1200, 12, 9600), 5)).toMatchObject({ verdict: 'follow' });
  });
});
