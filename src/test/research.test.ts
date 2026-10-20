import { beforeEach, describe, expect, it } from 'vitest';
import { getTool, type ToolContext } from '@/ai/tools';
import { DemoBackend } from '@/bing/demo/backend';
import { LiveBackend } from '@/bing/live';
import { DEFAULT_SPEND_RULES } from '@/stores/settings';

function ctx(): ToolContext {
  return { backend: new DemoBackend(0), accountId: '1000001', currency: 'DKK', rules: DEFAULT_SPEND_RULES, defaultPreset: 'last30', memo: new Map() };
}

/** A LiveBackend whose Microsoft calls are answered by `reply` (shapes from Microsoft's REST docs). */
function liveWith(reply: (path: string, body: Record<string, unknown>) => unknown) {
  const backend = new LiveBackend({ getAccess: async () => ({ accessToken: 't', expiresAt: Date.now() + 3600_000, developerToken: 'd' }) });
  const calls: { path: string; body: Record<string, unknown> }[] = [];
  const client = (backend as unknown as { client: { call: (s: string, p: string, o: { body?: unknown }) => Promise<unknown>; download: () => Promise<ArrayBuffer> } }).client;
  client.call = async (_service, path, o) => {
    const body = (o.body ?? {}) as Record<string, unknown>;
    calls.push({ path, body });
    if (path === 'User/Query') return { User: { Id: 1 } };
    if (path === 'Accounts/Search') return { Accounts: [{ Id: 5, ParentCustomerId: 7 }] };
    if (path === 'GeoLocationsFileUrl/Query') return { FileUrl: 'https://x.blob.core.windows.net/geo.csv' };
    return reply(path, body);
  };
  client.download = async () => new TextEncoder().encode('Location Id,Bing Display Name,Location Type,Replaces,Status,AdWords Location Id\n59,Denmark,Country,,Active,2208\n').buffer as ArrayBuffer;
  localStorage.removeItem('bac.ms-country-ids');
  return { backend, calls };
}

describe('Microsoft research calls', () => {
  it('reads monthly search counts for Danish in Denmark and sums the devices', async () => {
    const { backend, calls } = liveWith(() => ({
      KeywordSearchCounts: [
        {
          Keyword: 'butiksinventar',
          SearchCountsByAttributes: [
            { Device: 'Computers', HistoricalSearchCounts: [{ DayMonthAndYear: { Day: 1, Month: 8, Year: 2026 }, SearchCount: '120' }, { DayMonthAndYear: { Day: 1, Month: 9, Year: 2026 }, SearchCount: '140' }] },
            { Device: 'Smartphones', HistoricalSearchCounts: [{ DayMonthAndYear: { Day: 1, Month: 9, Year: 2026 }, SearchCount: '60' }] },
          ],
        },
        null,
      ],
    }));
    const v = await backend.searchVolumes('5', ['butiksinventar', '!!']);
    const body = calls.find((c) => c.path === 'HistoricalSearchCount/Query')!.body;
    expect(body).toMatchObject({ Language: 'Danish', PublisherCountries: ['DK'], TimePeriodRollup: 'Monthly', Devices: ['Computers', 'Smartphones', 'Tablets'] });
    expect(v).toEqual([{ keyword: 'butiksinventar', months: [{ month: '2026-08', searches: 120 }, { month: '2026-09', searches: 200 }] }]);
  });

  it('asks for bid estimates per keyword in Denmark and reads the weekly ranges', async () => {
    const { backend, calls } = liveWith(() => ({
      KeywordEstimatedBids: [
        { Keyword: 'butiksinventar', EstimatedBids: [{ AverageCPC: 4.2, CTR: 5.1, EstimatedMinBid: 5, MatchType: 'Phrase', MinClicksPerWeek: 10, MaxClicksPerWeek: 14, MinImpressionsPerWeek: '200', MaxImpressionsPerWeek: '260', MinTotalCostPerWeek: 42, MaxTotalCostPerWeek: 59 }] },
        null,
      ],
    }));
    const e = await backend.bidEstimates('5', [{ text: 'butiksinventar', matchType: 'Phrase' }, { text: 'xyz', matchType: 'Exact' }], { campaignId: '11', adGroupId: '22' });
    const body = calls.find((c) => c.path === 'EstimatedBid/QueryByKeywords')!.body;
    expect(body).toMatchObject({ Keywords: [{ KeywordText: 'butiksinventar', MatchTypes: ['Phrase'] }, { KeywordText: 'xyz', MatchTypes: ['Exact'] }], Language: 'Danish', LocationIds: [59], CampaignId: 11, AdGroupId: 22, EntityLevelBid: 'Keyword' });
    expect(e[0]).toMatchObject({ averageCpc: 4.2, estimatedMinBid: 5, clicksPerWeek: [10, 14], impressionsPerWeek: [200, 260], costPerWeek: [42, 59] });
    expect(e[1]).toMatchObject({ keyword: 'xyz', averageCpc: null, clicksPerWeek: null });
  });

  it('reads auction insights with a date range parameter', async () => {
    const { backend, calls } = liveWith(() => ({
      Result: { Entries: [{ DisplayDomain: 'konkurrent.dk', AggregatedKpi: { ImpressionShare: 33.5, OverlapRate: 40, AboveRate: 22, TopOfPageRate: 61, AbsoluteTopOfPageRate: 20, OutrankingShare: 45 } }] },
    }));
    const r = await backend.auctionInsights('5', 'Campaign', ['11'], { from: '2026-09-01', to: '2026-09-30' });
    const body = calls.find((c) => c.path === 'AuctionInsightData/Query')!.body;
    expect(body).toMatchObject({ EntityType: 'Campaign', EntityIds: [11], SearchParameters: [{ Type: 'DateRangeSearchParameter', StartDate: { Day: 1, Month: 9, Year: 2026 }, EndDate: { Day: 30, Month: 9, Year: 2026 } }] });
    expect(r).toEqual([{ domain: 'konkurrent.dk', impressionShare: 33.5, overlapRate: 40, aboveRate: 22, topOfPageRate: 61, absoluteTopOfPageRate: 20, outrankingShare: 45 }]);
  });
});

describe('research tools', () => {
  beforeEach(() => DemoBackend.reset());

  it('research_keywords gives volume, bid, search-term evidence and a verdict per keyword', async () => {
    const tool = getTool('research_keywords')!;
    if (tool.kind === 'write') throw new Error('unexpected');
    const c = ctx();
    const existing = (await c.backend.listKeywords(c.accountId, '1020'))[0]!;
    const out = await tool.run(tool.schema.parse({ keywords: [{ text: existing.text }, { text: 'butiksinventar til frisør', matchType: 'Exact' }], campaignId: '102', adGroupId: '1020' }), c);
    const r = out.result as { keywords: { keyword: string; verdict: string; searchesPerMonth: { avgMonthly: number } | null; bidEstimate: unknown; searchTerms: { matchingTerms: number }; existsIn: unknown[] }[] };
    expect(r.keywords[0]!.verdict).toBe('Findes allerede');
    expect(r.keywords[0]!.existsIn.length).toBeGreaterThan(0);
    expect(r.keywords[1]!.searchesPerMonth!.avgMonthly).toBeGreaterThan(0);
    expect(r.keywords[1]!.bidEstimate).toBeTruthy();
    expect(r.keywords[1]!.verdict).not.toBe('Findes allerede');
  });

  it('get_auction_insights lists the competitors', async () => {
    const tool = getTool('get_auction_insights')!;
    if (tool.kind === 'write') throw new Error('unexpected');
    const out = await tool.run(tool.schema.parse({ level: 'Campaign', ids: ['102'] }), ctx());
    expect((out.result as { competitors: { domain: string }[] }).competitors.length).toBeGreaterThan(1);
    await expect(tool.run(tool.schema.parse({ level: 'Campaign' }), ctx())).rejects.toThrow(/id'er/);
  });

  it('add_keywords shows the evidence on the approval card', async () => {
    const tool = getTool('add_keywords')!;
    if (tool.kind !== 'write') throw new Error('unexpected');
    const planned = await tool.plan(tool.schema.parse({ campaignId: '102', adGroupId: '1020', keywords: [{ text: 'ergonomisk kontorstol test', matchType: 'Phrase' }], reason: 'x' }), ctx());
    expect(planned.plan!.changes[0]!.field).toMatch(/søgn\.\/md\./);
  });
});

describe('follow-ups the user asks for', () => {
  it('fills the follow-up card from schedule_follow_up', async () => {
    const { requestedFollowUp } = await import('@/features/chat/FollowUpCard');
    const tool = getTool('schedule_follow_up')!;
    if (tool.kind === 'write') throw new Error('unexpected');
    const input = tool.schema.parse({ title: 'Gennemgang: Kontormøbler', description: 'Tjek CPA', date: '2026-11-02', time: '10:30', checklist: ['Sammenlign CPA'] });
    const out = await tool.run(input, ctx());
    expect(String(out.result)).toMatch(/NOT created yet/);
    const item = { kind: 'assistant', id: 'a', ts: 0, model: 'm', status: 'done', parts: [{ type: 'tool', id: 't', name: 'schedule_follow_up', label: '', input, status: 'done', startedAt: 0 }] } as const;
    expect(requestedFollowUp(item as never)).toEqual({ title: 'Gennemgang: Kontormøbler', description: 'Tjek CPA', date: '2026-11-02', time: '10:30', checklist: ['Sammenlign CPA'] });
  });
});
