import { beforeEach, describe, expect, it } from 'vitest';
import { followUpVerdict, isoAdd, pickSearchTerms, readiness } from '@/agents/logic';
import { runFollowUp, runPeriods, runRejections, runSearchTerms, type AgentEnv } from '@/agents/run';
import { useActivity } from '@/stores/activity';
import type { AdsBackend } from '@/bing/types';
import { today } from '@/lib/format';
import { AGENT_BOARD, useBoard } from '@/stores/board';
import { DEFAULT_SPEND_RULES } from '@/stores/settings';

const t = (clicks: number, spend: number, conversions: number, revenue: number) => ({ impressions: clicks * 10, clicks, spend, conversions, revenue });

describe('the follow-up verdict', () => {
  it('waits when there is too little data after the change', () => {
    expect(followUpVerdict(t(300, 3000, 30, 15000), 14, t(10, 100, 1, 500), 2).verdict).toBe('wait');
  });
  it('keeps a change when ROAS and sales held', () => {
    expect(followUpVerdict(t(280, 2800, 28, 14000), 14, t(150, 1400, 15, 8000), 7).verdict).toBe('keep');
  });
  it('suggests rolling back when ROAS fell and the spend did not', () => {
    const v = followUpVerdict(t(280, 2800, 28, 14000), 14, t(160, 1500, 6, 3000), 7);
    expect(v.verdict).toBe('rollback');
    expect(v.lines).toHaveLength(4);
  });
  it('suggests rolling back when sales stopped', () => {
    expect(followUpVerdict(t(280, 2800, 28, 14000), 14, t(150, 1400, 0, 0), 7).verdict).toBe('rollback');
  });
});

describe('search terms without sales', () => {
  const row = (term: string, clicks: number, spend: number, conversions = 0) => ({ term, campaignId: '1', campaignName: 'Stole', clicks, spend, conversions });
  it('picks the costly ones that sold nothing and are not already blocked', () => {
    const rows = [row('gratis stol', 20, 200), row('ikea stol', 15, 150), row('kontorstol', 100, 800, 9), row('stol x', 3, 30)];
    const picks = pickSearchTerms(rows, new Map([['1', [{ text: 'ikea', matchType: 'phrase' as const }]]]));
    expect(picks.map((p) => p.term)).toEqual(['gratis stol']);
  });
});

describe('period readiness', () => {
  it('flags a paused campaign and an ad group without an approved ad', () => {
    const r = readiness({ status: 'Paused', dailyBudget: 300 }, [{ name: 'BW', status: 'Active', approvedAds: 0 }]);
    expect(r.filter((x) => !x.ok).map((x) => x.text)).toEqual([expect.stringMatching(/pauset/), expect.stringMatching(/Ingen aktiv, godkendt annonce: BW/)]);
  });
});

describe('the agents write cards on the "Agenter" board', () => {
  const now = today();
  const claimed = new Set<string>();
  const backend = {
    listCampaigns: async () => [{ id: '7', name: 'Black Week', status: 'Paused', type: 'Search', dailyBudget: 500, bidStrategy: { type: 'ManualCpc' } }],
    listAdGroups: async () => [{ id: '70', campaignId: '7', name: 'BW stole', status: 'Active', cpcBid: 5, startDate: isoAdd(now, 1), endDate: isoAdd(now, 8) }],
    listAds: async () => [{ id: '700', adGroupId: '70', type: 'ResponsiveSearch', status: 'Active', headlines: ['Black Week'], descriptions: [], finalUrls: [], editorialStatus: 'Disapproved' }],
    listKeywords: async () => [],
    listNegativeKeywords: async () => [],
    runReport: async (_a: string, spec: { kind: string }) =>
      spec.kind === 'searchterm'
        ? [
            { searchTerm: 'gratis stol', campaignId: '7', campaignName: 'Black Week', clicks: 20, spend: 200, conversions: 0, impressions: 100, revenue: 0 },
            { searchTerm: 'kontorstol', campaignId: '7', campaignName: 'Black Week', clicks: 100, spend: 300, conversions: 5, impressions: 900, revenue: 5000 },
          ]
        : [],
  } as unknown as AdsBackend;
  const env = (): AgentEnv => ({
    backend,
    accountId: '1',
    currency: 'DKK',
    claim: async (k) => (claimed.has(k) ? false : (claimed.add(k), true)),
    tool: { backend, accountId: '1', currency: 'DKK', rules: DEFAULT_SPEND_RULES, defaultPreset: 'last30', memo: new Map() },
  });
  const agentCards = () => Object.values(useBoard.getState().cards).filter((c) => c.boardId === AGENT_BOARD);

  beforeEach(() => claimed.clear());

  it('the period watch: not ready – paused campaign, no approved ad – with the request for the assistant', async () => {
    expect(await runPeriods(env())).toBe(1);
    const card = agentCards().find((c) => c.title.includes('Black Week starter i morgen'))!;
    expect(card.title).toMatch(/^Ikke klar/);
    expect(card.checklist.filter((i) => !i.done)).toHaveLength(2);
    expect(card.ask).toMatch(/Black Week/);
    // Only once per period start.
    expect(await runPeriods(env())).toBe(0);
  });

  it('search terms: one card with the term that cost money without selling', async () => {
    expect(await runSearchTerms(env())).toBe(1);
    const card = agentCards().find((c) => c.title.startsWith('Søgetermer uden salg'))!;
    expect(card.description).toMatch(/gratis stol/);
    expect(card.description).not.toMatch(/"kontorstol"/);
  });

  it('rejections: a card for a disapproved ad, and none again while the list is the same', async () => {
    expect(await runRejections(env())).toBe(0); // the campaign is paused – only active campaigns count
    const active = { ...backend, listCampaigns: async () => [{ id: '7', name: 'Black Week', status: 'Active', type: 'Search', dailyBudget: 500, bidStrategy: { type: 'ManualCpc' } }] } as unknown as AdsBackend;
    const e = { ...env(), backend: active, tool: { ...env().tool, backend: active } };
    expect(await runRejections(e)).toBe(1);
    expect(agentCards().some((c) => c.title.startsWith('Afvisninger') && c.description.includes('annonce-id 700'))).toBe(true);
    expect(await runRejections(e)).toBe(0);
  });
});

describe('the follow-up agent', () => {
  it('comments the numbers and a verdict on a due follow-up card, and ticks "Tjek tallene"', async () => {
    const entry = useActivity.getState().add({ source: 'assistant', mode: 'live', accountId: '1', tool: 'update_ad_groups', summary: 'Bud ændret', changes: [], status: 'success', campaignIds: ['7'] });
    useActivity.setState((s) => ({ entries: s.entries.map((e) => (e.id === entry.id ? { ...e, ts: Date.now() - 12 * 86_400_000 } : e)) }));
    const { cardId } = useBoard.getState().addFollowUp({ title: 'Følg op: bud', description: '', due: isoAdd(today(), -1), checklist: ['Tjek tallene for det, der blev ændret', 'Beslut'], conversationId: 'c1', activityIds: [entry.id] });
    // Before: 10 kr. per sale at ROAS 5; after: the same per day – keep.
    const backend = {
      runReport: async (_a: string, spec: { range: { from: string; to: string } }) => {
        const days = Math.round((Date.parse(spec.range.to) - Date.parse(spec.range.from)) / 86_400_000) + 1;
        return [{ clicks: 20 * days, spend: 100 * days, conversions: 2 * days, revenue: 500 * days, impressions: 200 * days }];
      },
    } as unknown as AdsBackend;
    const env: AgentEnv = { backend, accountId: '1', currency: 'DKK', claim: async () => true, tool: { backend, accountId: '1', currency: 'DKK', rules: DEFAULT_SPEND_RULES, defaultPreset: 'last30', memo: new Map() } };
    expect(await runFollowUp(env)).toBe(1);
    const card = useBoard.getState().cards[cardId]!;
    expect(card.activity.some((a) => a.kind === 'comment' && /Vurdering: Behold/.test(a.text))).toBe(true);
    expect(card.checklist[0]!.done).toBe(true);
    // Not again the same day.
    expect(await runFollowUp(env)).toBe(0);
  });
});
