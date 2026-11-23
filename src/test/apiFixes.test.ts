/**
 * The five defects the API research found (docs/research/…/api_v13.md), each checked
 * against Microsoft's documentation before fixing.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const fetches: { url: string; body: unknown }[] = [];
let replies: (() => Response)[] = [];
vi.mock('@/lib/platform', async (orig) => ({
  ...(await orig<typeof import('@/lib/platform')>()),
  msFetch: async (url: string, init?: RequestInit) => {
    fetches.push({ url, body: init?.body ? JSON.parse(String(init.body)) : null });
    return replies.shift()!();
  },
}));

import { bidStrategyProblem } from '@/ai/tools/checks';
import { MsAdsClient } from '@/bing/client';
import { LiveBackend, listingGroupActionJson } from '@/bing/live';
import { extractErrorMessages, isCredentialRejection, retryAfterMs } from '@/bing/msErrors';

const json = (status: number, body: unknown) => () => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
// As Microsoft sends it: the number in Code, the symbolic name in ErrorCode.
const NAMES: Record<number, string> = { 117: 'CallRateExceeded', 207: 'ConcurrentRequestOverLimit', 105: 'InvalidCredentials' };
const error = (code: number) => ({ OperationErrors: [{ Code: code, ErrorCode: NAMES[code], Message: 'Error' }] });

function live() {
  const backend = new LiveBackend({ getAccess: async () => ({ accessToken: 't', expiresAt: Date.now() + 3600_000, developerToken: 'd' }) });
  const calls: { path: string; body: Record<string, unknown> }[] = [];
  const client = (backend as unknown as { client: { call: (s: string, p: string, o: { body?: unknown }) => Promise<unknown> } }).client;
  client.call = async (_s, path, o) => {
    const body = (o.body ?? {}) as Record<string, unknown>;
    if (path === 'User/Query') return { User: { Id: 1 } };
    if (path === 'Accounts/Search') return { Accounts: [{ Id: 5, ParentCustomerId: 7 }] };
    calls.push({ path, body });
    if (path === 'CampaignCriterions/QueryByIds') return { CampaignCriterions: [{ Id: '9', Criterion: { Type: 'LocationIntentCriterion', IntentOption: 'PeopleInOrSearchingForOrViewingPages' } }] };
    if (path === 'CampaignCriterions' && Array.isArray(body.CampaignCriterions)) return { CampaignCriterionIds: (body.CampaignCriterions as unknown[]).map((_, i) => String(200 + i)), PartialErrors: [] };
    if (path === 'AdExtensions') return { AdExtensionIdentities: (body.AdExtensions as unknown[]).map((_, i) => ({ Id: String(100 + i), Version: 1 })), NestedPartialErrors: [] };
    return { PartialErrors: [] };
  };
  return { backend, calls };
}

beforeEach(() => {
  fetches.length = 0;
  replies = [];
});
afterEach(() => vi.useRealTimers());

describe('1. Performance Max listing groups: AssetGroupListingType', () => {
  it('writes the documented field (Add: required) and never the old name', () => {
    const out = listingGroupActionJson({ action: 'Add', adGroupId: '77', parentId: -1, kind: 'unit', operand: 'Id', attribute: 'SKU-1', excluded: false }).ListingGroup as Record<string, unknown>;
    expect(out.AssetGroupListingType).toBe('Unit');
    expect(out).not.toHaveProperty('ListingGroupType');
  });
});

describe('2. Location intent is written as "Targets"', () => {
  it('reads with "LocationIntent" and updates with CriterionType "Targets"', async () => {
    const { backend, calls } = live();
    await backend.setLocationIntent('5', '900', 'PeopleIn');
    expect(calls.map((c) => [c.path, c.body.CriterionType])).toEqual([
      ['CampaignCriterions/QueryByIds', 'LocationIntent'],
      ['CampaignCriterions', 'Targets'],
    ]);
  });
});

describe('3. Sitelinks: both descriptions or none, and at most 100 per call', () => {
  it('never sends an empty Description2, and splits 150 sitelinks into two calls with the right positions', async () => {
    const { backend, calls } = live();
    const one = { kind: 'sitelink' as const, text: 'Kontorstole', description1: 'Over 200 modeller', finalUrl: 'https://example.dk/stole' };
    const many = Array.from({ length: 150 }, (_, i) => ({ kind: 'sitelink' as const, text: `Link ${i}`, finalUrl: 'https://example.dk' }));
    const res = await backend.addAdExtensions('5', [one, ...many]);
    const sent = calls.filter((c) => c.path === 'AdExtensions');
    expect(sent.map((c) => (c.body.AdExtensions as unknown[]).length)).toEqual([100, 51]);
    const first = (sent[0]!.body.AdExtensions as Record<string, unknown>[])[0]!;
    expect(first).not.toHaveProperty('Description1');
    expect(first).not.toHaveProperty('Description2');
    expect(res.ids).toHaveLength(151);
  });
});

describe('4. Max CPC: Microsoft refuses a new one on non-portfolio automated strategies (611274)', () => {
  it('refuses adding one, allows changing an existing one and portfolio strategies', () => {
    expect(bidStrategyProblem({ name: 'Ny', type: 'Search' }, { type: 'MaxClicks', maxCpc: 5 })).toMatch(/611274/);
    expect(bidStrategyProblem({ name: 'A', type: 'Search', bidStrategy: { type: 'EnhancedCpc' } }, { type: 'MaxConversions', maxCpc: 5 })).toMatch(/611274/);
    expect(bidStrategyProblem({ name: 'A', type: 'Search', bidStrategy: { type: 'MaxClicks', maxCpc: 4 } }, { type: 'MaxClicks', maxCpc: 6 })).toBeNull();
    expect(bidStrategyProblem({ name: 'A', type: 'Search', bidStrategy: { type: 'MaxClicks' }, portfolioBidStrategyId: '12' }, { type: 'MaxClicks', maxCpc: 6 })).toBeNull();
    expect(bidStrategyProblem({ name: 'A', type: 'Search' }, { type: 'MaxClicks' })).toBeNull();
  });
});

describe('5. "Too many calls": wait as long as Microsoft says', () => {
  it('recognises Microsoft\'s real error payloads – the symbolic name, not only the number', () => {
    expect(retryAfterMs(400, extractErrorMessages(error(117)))).toBe(60_000);
    expect(retryAfterMs(400, extractErrorMessages(error(207)))).toBe(30_000);
    expect(isCredentialRejection(400, extractErrorMessages(error(105)))).toBe(true);
    expect(isCredentialRejection(400, ['User is not authorized (UserIsNotAuthorized)'])).toBe(true);
  });

  it('117 and 429 wait 60 seconds; 207 only in Reporting; 4204 (Bulk) is not retried', () => {
    expect(retryAfterMs(400, ['Error (117)'])).toBe(60_000);
    expect(retryAfterMs(429, [])).toBe(60_000);
    expect(retryAfterMs(400, ['Error (207)'], true)).toBe(30_000);
    expect(retryAfterMs(400, ['Address line 3 is invalid (207)'], false)).toBeNull();
    expect(retryAfterMs(400, ['Error (4204)'], true)).toBeNull();
    expect(retryAfterMs(400, ['Error (1100)'])).toBeNull();
  });

  it('tries once more after 60 seconds, then reports a second refusal', async () => {
    vi.useFakeTimers();
    const client = new MsAdsClient({ getAccess: async () => ({ accessToken: 't', expiresAt: Date.now() + 3600_000, developerToken: 'd' }) });
    replies = [json(400, error(117)), json(200, { ok: true })];
    const done = client.call('campaign', 'Campaigns/QueryByAccountId', { body: {} });
    await vi.advanceTimersByTimeAsync(59_000);
    expect(fetches).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1_000);
    await expect(done).resolves.toEqual({ ok: true });
    expect(fetches).toHaveLength(2);

    replies = [json(400, error(117)), json(400, error(117))];
    const twice = client.call('campaign', 'Campaigns/QueryByAccountId', { body: {} });
    const failed = expect(twice).rejects.toThrow(/for mange forespørgsler – Microsoft beder om at vente et minut/);
    await vi.advanceTimersByTimeAsync(60_000);
    await failed;
    expect(fetches).toHaveLength(4);
  });
});

describe('6. The smaller risks from the report', () => {
  it('removes an ad group end date the documented way (2 Jan 2050) and reads 2050 back as none', async () => {
    const { backend, calls } = live();
    await backend.updateAdGroups('5', '900', [{ adGroupId: '1', endDate: null }, { adGroupId: '2', endDate: '2026-12-01' }, { adGroupId: '3', name: 'x' }]);
    const groups = calls.find((c) => c.path === 'AdGroups')!.body.AdGroups as Record<string, unknown>[];
    expect(groups[0]!.EndDate).toEqual({ Day: 2, Month: 1, Year: 2050 });
    expect(groups[1]!.EndDate).toEqual({ Day: 1, Month: 12, Year: 2026 });
    expect(groups[2]).not.toHaveProperty('EndDate');
  });

  it('never sends a biddable product group without a bid – Microsoft would refuse the whole tree', async () => {
    const { backend, calls } = live();
    await expect(
      backend.applyProductPartitionActions!('5', [
        { action: 'Add', adGroupId: '77', tempId: -1, parentId: null, kind: 'subdivision', operand: 'All', attribute: null, excluded: false },
        { action: 'Add', adGroupId: '77', parentId: -1, kind: 'unit', operand: 'Id', attribute: 'SKU-1', excluded: false },
        { action: 'Add', adGroupId: '77', parentId: -1, kind: 'unit', operand: 'Id', attribute: null, excluded: true },
      ]),
    ).rejects.toThrow(/"SKU-1" mangler et bud/);
    expect(calls).toHaveLength(0);
  });

  it('writes and reads ad schedule blocks on the quarter hour', async () => {
    const { backend, calls } = live();
    await backend.applyCampaignTargets!('5', '900', { add: [{ kind: 'schedule', day: 'Monday', from: 8.5, to: 16.75, adjustment: 0 }, { kind: 'schedule', day: 'Monday', from: 19, to: 24, adjustment: -20 }], update: [], delete: [] });
    const sent = (calls.find((c) => c.path === 'CampaignCriterions')!.body.CampaignCriterions as { Criterion: Record<string, unknown> }[]).map((c) => c.Criterion);
    expect(sent[0]).toMatchObject({ FromHour: 8, FromMinute: 'Thirty', ToHour: 16, ToMinute: 'FortyFive' });
    expect(sent[1]).toMatchObject({ FromHour: 19, FromMinute: 'Zero', ToHour: 24, ToMinute: 'Zero' });
  });
});
