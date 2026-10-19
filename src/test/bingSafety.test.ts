import { beforeEach, describe, expect, it } from 'vitest';
import { getTool, type ToolContext } from '@/ai/tools';
import { negativeBlocks, normalizeKeyword, rawErrors, collectAmounts } from '@/ai/tools/write';
import { DemoBackend } from '@/bing/demo/backend';
import { batchResult, bidStrategyType, LiveBackend } from '@/bing/live';
import type { AdsBackend } from '@/bing/types';
import { DEFAULT_SPEND_RULES } from '@/stores/settings';

function ctx(backend: AdsBackend = new DemoBackend(0)): ToolContext {
  return { backend, accountId: '1000001', currency: 'DKK', rules: DEFAULT_SPEND_RULES, defaultPreset: 'last30', memo: new Map() };
}

function writeTool(name: string) {
  const t = getTool(name)!;
  if (t.kind !== 'write') throw new Error('unexpected');
  return t;
}

const plan = (name: string, input: unknown, c = ctx()) => {
  const t = writeTool(name);
  return t.plan(t.schema.parse(input), c);
};

describe('Microsoft Advertising batch results', () => {
  it('maps errors to the item by Index, not by order', () => {
    const res = batchResult(
      { KeywordIds: [11, null, 13], PartialErrors: [{ Index: 1, Message: 'Duplicate keyword', ErrorCode: 'DuplicateKeyword', Code: 1542 }] },
      3,
      'KeywordIds',
    );
    expect(res.ids).toEqual(['11', '13']);
    expect(res.failed).toEqual([expect.objectContaining({ index: 1, code: 'DuplicateKeyword' })]);
  });

  it('throws when every item failed, so it is never reported as done', () => {
    expect(() => batchResult({ PartialErrors: [{ Index: 0, Message: 'x' }, { Index: 1, Message: 'y' }] }, 2)).toThrow(/intet blev ændret/);
    expect(() => batchResult({ KeywordIds: [null], PartialErrors: [{ Index: 0, Message: 'x' }] }, 1, 'KeywordIds')).toThrow(/intet blev ændret/);
    expect(batchResult({ PartialErrors: [{ Index: 0, Message: 'x' }] }, 2).failed).toHaveLength(1);
  });

  it('reads item indexes from nested errors', () => {
    const res = batchResult({ NestedPartialErrors: [{ Index: 0, BatchErrors: [{ Index: 2, Message: 'Too long' }] }] }, 3);
    expect(res.failed?.[0]?.index).toBe(2);
  });

  it('treats a null id without an error as not created', () => {
    const res = batchResult({ KeywordIds: [5, null] }, 2, 'KeywordIds');
    expect(res.failed?.[0]?.index).toBe(1);
  });

  it('normalises bidding scheme type names', () => {
    expect(bidStrategyType('TargetCpaBiddingScheme')).toBe('TargetCpa');
    expect(bidStrategyType('MaxConversions')).toBe('MaxConversions');
  });
});

describe('feasibility before a change', () => {
  beforeEach(() => DemoBackend.reset());

  it('refuses keyword bids under automated bidding (Microsoft ignores them silently)', async () => {
    // Campaign 102 uses Maximize conversions.
    await expect(plan('update_keywords', { campaignId: '102', adGroupId: '1020', changes: [{ keywordId: 'k1', bid: 9 }], reason: 'x' })).rejects.toThrow(/ignorerer/);
    await expect(plan('update_ad_groups', { campaignId: '102', changes: [{ adGroupId: '1020', cpcBid: 9 }], reason: 'x' })).rejects.toThrow(/ignorerer/);
  });

  it('refuses Manual CPC on a search campaign', async () => {
    await expect(plan('update_campaigns', { changes: [{ campaignId: '101', bidStrategy: { type: 'ManualCpc' } }], reason: 'x' })).rejects.toThrow(/Forbedret CPC/);
  });

  it('refuses moving to standalone Target CPA', async () => {
    await expect(plan('update_campaigns', { changes: [{ campaignId: '101', bidStrategy: { type: 'TargetCpa', targetCpa: 300 } }], reason: 'x' })).rejects.toThrow(/Maksimér konverteringer med en mål-CPA/);
  });

  it('refuses activating a suspended campaign and changing an experiment budget', async () => {
    const backend = new DemoBackend(0);
    const list = backend.listCampaigns.bind(backend);
    backend.listCampaigns = async (a) => (await list(a)).map((c) => (c.id === '106' ? { ...c, status: 'Suspended' } : c.id === '101' ? { ...c, experimentId: '9' } : c));
    await expect(plan('update_campaigns', { changes: [{ campaignId: '106', status: 'Active' }], reason: 'x' }, ctx(backend))).rejects.toThrow(/suspenderet/);
    await expect(plan('update_campaigns', { changes: [{ campaignId: '101', dailyBudget: 300 }], reason: 'x' }, ctx(backend))).rejects.toThrow(/eksperimentkampagne/);
  });

  it('refuses duplicate keywords the way Microsoft normalises them', async () => {
    const c = ctx();
    const existing = (await c.backend.listKeywords(c.accountId, '1010'))[0]!;
    const text = `${existing.text.toUpperCase()}!`;
    await expect(plan('add_keywords', { campaignId: '101', adGroupId: '1010', keywords: [{ text, matchType: existing.matchType }], reason: 'x' }, c)).rejects.toThrow(/Findes allerede/);
  });

  it('asks before negatives that would block our own active keywords', async () => {
    const c = ctx();
    const kw = (await c.backend.listKeywords(c.accountId, '1010')).find((k) => k.status === 'Active')!;
    const change = await plan('add_negative_keywords', { campaignId: '101', keywords: [{ text: kw.text, matchType: 'Phrase' }], reason: 'x' }, c);
    expect(change.plan?.approvalReasons?.length).toBeGreaterThan(0);
    expect(change.plan?.notes?.join(' ')).toContain(kw.text);
  });

  it('knows when a negative blocks a keyword', () => {
    expect(negativeBlocks({ text: 'gratis', matchType: 'Phrase' }, 'Kontorstol gratis levering')).toBe(true);
    expect(negativeBlocks({ text: 'kontorstol', matchType: 'Exact' }, 'kontorstol billig')).toBe(false);
    expect(negativeBlocks({ text: 'kontor-stol', matchType: 'Exact' }, 'Kontor stol')).toBe(true);
    expect(normalizeKeyword('  Hæve-Sænkebord! ')).toBe('hæve sænkebord');
  });
});

describe('verification after a change', () => {
  beforeEach(() => DemoBackend.reset());

  it('reports "nothing changed" when Microsoft answers without errors but keeps the old value', async () => {
    const backend = new DemoBackend(0);
    backend.updateCampaigns = async () => ({});
    const change = await plan('update_campaigns', { changes: [{ campaignId: '101', dailyBudget: 250 }], reason: 'x' }, ctx(backend));
    await expect(change.execute()).rejects.toThrow(/Intet blev ændret/);
  }, 10_000);

  it('reports a partial result item by item', async () => {
    const backend = new DemoBackend(0);
    const update = backend.updateKeywords.bind(backend);
    // Microsoft rejects the second keyword.
    backend.updateKeywords = async (a, g, patches) => {
      await update(a, g, patches.slice(0, 1));
      return { failed: [{ index: 1, message: 'Keyword is disapproved' }], partialErrors: ['#2: Keyword is disapproved'] };
    };
    const c = ctx(backend);
    const kws = (await backend.listKeywords(c.accountId, '1010')).filter((k) => k.status === 'Active').slice(0, 2);
    const change = await plan('update_keywords', { campaignId: '101', adGroupId: '1010', changes: kws.map((k) => ({ keywordId: k.id, status: 'Paused' })), reason: 'x' }, c);
    const res = await change.execute();
    const result = res.result as { outcome: string; rejectedByMicrosoft: string[] };
    expect(result.outcome).toBe('partially_applied');
    expect(result.rejectedByMicrosoft[0]).toContain('disapproved');
    expect(res.summary).toMatch(/^1 af 2/);
    expect((res.undo?.input as { changes: unknown[] }).changes).toHaveLength(1);
    expect(res.changes).toHaveLength(1);
  });
});

describe('raw API calls', () => {
  it('keeps budgets and bids in raw bodies under the spending ceilings', () => {
    const a = collectAmounts({ Campaigns: [{ Id: 1, DailyBudget: 900 }], AdGroups: [{ CpcBid: { Amount: 12 } }], Budgets: [{ Amount: 5000 }] });
    expect(a.budgets.sort()).toEqual([5000, 900]);
    expect(a.bids).toEqual([12]);
  });

  it('detects a raw write where nothing went through', () => {
    expect(rawErrors({ AdExtensionIdentities: [null], PartialErrors: [{ Index: 0, Message: 'bad' }] }).allFailed).toBe(false);
    expect(rawErrors({ CampaignCriterionIds: [null], PartialErrors: [{ Index: 0, Message: 'bad' }] }).allFailed).toBe(true);
  });

  it('refuses account and billing changes', async () => {
    await expect(plan('microsoft_ads_api', { service: 'customer', path: 'Users', method: 'PUT', body: {}, reason: 'x' })).rejects.toThrow(/fakturering/);
    await expect(plan('microsoft_ads_api', { service: 'campaign', path: '../x', method: 'PUT', body: {}, reason: 'x' })).rejects.toThrow(/Ugyldig sti/);
  });
});

describe('REST requests sent to Microsoft (checked against the v13 REST reference)', () => {
  function live() {
    const backend = new LiveBackend({ getAccess: async () => ({ accessToken: 't', expiresAt: Date.now() + 3600_000, developerToken: 'd' }) });
    const calls: { service: string; path: string; method?: string; body: Record<string, unknown> }[] = [];
    const client = (backend as unknown as { client: { call: (s: string, p: string, o: { method?: string; body?: unknown }) => Promise<unknown> } }).client;
    client.call = async (service, path, o) => {
      calls.push({ service, path, method: o.method, body: (o.body ?? {}) as Record<string, unknown> });
      if (path === 'User/Query') return { User: { Id: 1 } };
      if (path === 'Accounts/Search') return { Accounts: [{ Id: 5, ParentCustomerId: 7, CurrencyCode: 'DKK', AccountLifeCycleStatus: 'Active' }] };
      if (path === 'Campaigns/QueryByAccountId') return { Campaigns: [{ Id: 9, Name: 'A', Status: 'Active', CampaignType: 'Search', BiddingScheme: { Type: 'MaxConversionsBiddingScheme' } }] };
      return {};
    };
    return { backend, calls };
  }

  it('reads negative keywords from NegativeKeywords/QueryByEntityIds with the campaign as parent of an ad group', async () => {
    const { backend, calls } = live();
    await backend.listNegativeKeywords('5', 'AdGroup', '42', '9');
    const call = calls.find((c) => c.path.includes('QueryByEntityIds'))!;
    expect(call.path).toBe('NegativeKeywords/QueryByEntityIds');
    expect(call.body).toEqual({ EntityIds: [42], EntityType: 'AdGroup', ParentEntityId: 9 });
  });

  it('sends bidding schemes by class name and flags comma-separated', async () => {
    const { backend, calls } = live();
    const campaigns = await backend.listCampaigns('5');
    expect(campaigns[0]!.bidStrategy.type).toBe('MaxConversions');
    const query = calls.find((c) => c.path === 'Campaigns/QueryByAccountId')!;
    expect(query.body.CampaignType).toBe('Search,Shopping,Audience,PerformanceMax');
    expect(query.body.ReturnAdditionalFields).toBe('MaxConversionValueBiddingScheme,TargetImpressionShareBiddingScheme,BidStrategyId');
    await backend.updateCampaigns('5', [{ campaignId: '9', bidStrategy: { type: 'MaxConversions', targetCpa: 300, maxCpc: 12 } }]);
    const update = calls.find((c) => c.path === 'Campaigns' && c.method === 'PUT')!;
    expect((update.body.Campaigns as Record<string, unknown>[])[0]!.BiddingScheme).toEqual({ Type: 'MaxConversionsBiddingScheme', TargetCpa: 300, MaxCpc: { Amount: 12 } });
  });

  it('uses the documented paths and methods for every write', async () => {
    const { backend, calls } = live();
    await backend.listAccounts();
    calls.length = 0;
    await backend.addKeywords('5', '42', [{ text: 'a', matchType: 'Exact' }]).catch(() => {});
    await backend.updateKeywords('5', '42', [{ keywordId: '1', status: 'Paused' }]);
    await backend.deleteKeywords('5', '42', ['1']);
    await backend.addNegativeKeywords('5', 'Campaign', '9', [{ text: 'gratis', matchType: 'Phrase' }]);
    await backend.updateAdGroups('5', '9', [{ adGroupId: '42', status: 'Paused' }]);
    await backend.deleteCampaigns('5', ['9']);
    expect(calls.map((c) => `${c.method} ${c.path}`)).toEqual([
      'POST Keywords',
      'PUT Keywords',
      'DELETE Keywords',
      'POST EntityNegativeKeywords',
      'PUT AdGroups',
      'DELETE Campaigns',
    ]);
  });
});
