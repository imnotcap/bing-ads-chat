import { beforeEach, describe, expect, it } from 'vitest';
import { evaluateGuardrails } from '@/ai/guardrails';
import { STANDARD_SCHEDULE, WEEK, describeDay, deviceChanges, scheduleChanges, scheduleGaps } from '@/ai/targetingDefaults';
import { getTool, type ToolContext } from '@/ai/tools';
import { bidStrategyProblem } from '@/ai/tools/checks';
import { DemoBackend } from '@/bing/demo/backend';
import { LiveBackend } from '@/bing/live';
import { DEFAULT_SPEND_RULES } from '@/stores/settings';

function ctx(backend = new DemoBackend(0)): ToolContext {
  return { backend, accountId: '1000001', currency: 'DKK', rules: { ...DEFAULT_SPEND_RULES, minCpcBid: 10.05 }, defaultPreset: 'last30', memo: new Map() };
}

/** A LiveBackend whose Microsoft calls are recorded and answered by `reply` (shapes from Microsoft's REST docs). */
function liveWith(reply: (path: string, body: Record<string, unknown>, method: string) => unknown) {
  const backend = new LiveBackend({ getAccess: async () => ({ accessToken: 't', expiresAt: Date.now() + 3600_000, developerToken: 'd' }) });
  const calls: { path: string; method: string; body: Record<string, unknown> }[] = [];
  const client = (backend as unknown as { client: { call: (s: string, p: string, o: { body?: unknown; method?: string }) => Promise<unknown>; download: () => Promise<ArrayBuffer> } }).client;
  client.call = async (_service, path, o) => {
    const body = (o.body ?? {}) as Record<string, unknown>;
    const method = o.method ?? 'POST';
    if (path === 'User/Query') return { User: { Id: 1 } };
    if (path === 'Accounts/Search') return { Accounts: [{ Id: 5, ParentCustomerId: 7 }] };
    if (path === 'GeoLocationsFileUrl/Query') return { FileUrl: 'https://x.blob.core.windows.net/geo.csv' };
    calls.push({ path, method, body });
    return reply(path, body, method);
  };
  client.download = async () =>
    new TextEncoder().encode(
      'Location Id,Bing Display Name,Location Type,Replaces,Status,AdWords Location Id\n59,Denmark,Country,,Active,2208\n4001,Region Zealand|Denmark,State,,Active,1\n4002,Capital Region of Denmark|Denmark,State,,Active,2\n4003,Zealand|Old,State,,Deprecated,3\n',
    ).buffer as ArrayBuffer;
  localStorage.removeItem('bac.ms-geo-locations');
  return { backend, calls };
}

describe('the team standard', () => {
  it('covers every hour of the week with at most 7 blocks a day, as in Microsoft Advertising', () => {
    expect(STANDARD_SCHEDULE).toHaveLength(42);
    expect(scheduleGaps(STANDARD_SCHEDULE)).toEqual([]);
    for (const d of WEEK) expect(STANDARD_SCHEDULE.filter((b) => b.day === d).length).toBeLessThanOrEqual(7);
    expect(describeDay(STANDARD_SCHEDULE.filter((b) => b.day === 'Monday'))).toBe('00–06 −35 % · 06–16 0 % · 16–24 −25 %');
    expect(describeDay(STANDARD_SCHEDULE.filter((b) => b.day === 'Friday'))).toBe('00–16 0 % · 16–19 −25 % · 19–24 −55 %');
    expect(describeDay(STANDARD_SCHEDULE.filter((b) => b.day === 'Saturday'))).toBe('00–24 −55 %');
    expect(describeDay(STANDARD_SCHEDULE.filter((b) => b.day === 'Sunday'))).toBe('00–16 −55 % · 16–24 −40 %');
  });

  it('adds all three devices together, or updates them one by one when they exist', () => {
    const added = deviceChanges([], { Smartphones: -90, Tablets: -90 });
    expect(added.add.map((a) => a.kind === 'device' && `${a.device} ${a.adjustment}`)).toEqual(['Computers 0', 'Smartphones -90', 'Tablets -90']);
    const updated = deviceChanges(
      [
        { id: '1', device: 'Computers', adjustment: 0 },
        { id: '2', device: 'Smartphones', adjustment: -20 },
        { id: '3', device: 'Tablets', adjustment: -90 },
      ],
      { Smartphones: -90, Tablets: -90 },
    );
    expect(updated).toEqual({ add: [], update: [{ kind: 'device', device: 'Smartphones', adjustment: -90, id: '2' }], delete: [] });
  });

  it('replaces a schedule: same blocks are kept or updated, the rest deleted and added', () => {
    const changes = scheduleChanges(
      [
        { id: 'a', day: 'Monday', from: 0, to: 6, adjustment: -40 },
        { id: 'b', day: 'Monday', from: 6, to: 12, adjustment: 0 },
      ],
      [
        { day: 'Monday', from: 0, to: 6, adjustment: -35 },
        { day: 'Monday', from: 6, to: 9, adjustment: 0 },
      ],
    );
    expect(changes.update).toEqual([{ kind: 'schedule', day: 'Monday', from: 0, to: 6, adjustment: -35, id: 'a' }]);
    expect(changes.delete).toEqual(['b']);
    expect(changes.add).toEqual([{ kind: 'schedule', day: 'Monday', from: 6, to: 9, adjustment: 0 }]);
  });
});

describe('Microsoft requests (REST v13 shapes)', () => {
  it('sends devices, schedule and locations as "Targets": deletes, then updates, then additions', async () => {
    const { backend, calls } = liveWith((_path, _b, method) => (method === 'POST' ? { CampaignCriterionIds: ['11', '12'], NestedPartialErrors: [] } : { PartialErrors: [] }));
    const res = await backend.applyCampaignTargets('5', '900', {
      delete: ['77'],
      update: [{ kind: 'device', device: 'Smartphones', adjustment: -90, id: '31' }],
      add: [
        { kind: 'schedule', day: 'Monday', from: 19, to: 24, adjustment: -20 },
        { kind: 'location', locationId: '4001', adjustment: 0 },
      ],
    });
    expect(res.failed).toEqual([]);
    expect(calls.map((c) => `${c.method} ${c.path}`)).toEqual(['DELETE CampaignCriterions', 'PUT CampaignCriterions', 'POST CampaignCriterions']);
    expect(calls[0]!.body).toEqual({ CampaignCriterionIds: [77], CampaignId: 900, CriterionType: 'Targets' });
    expect(calls[1]!.body).toEqual({
      CampaignCriterions: [
        { Type: 'BiddableCampaignCriterion', CampaignId: 900, Id: 31, Criterion: { Type: 'DeviceCriterion', DeviceName: 'Smartphones' }, CriterionBid: { Type: 'BidMultiplier', Multiplier: -90 } },
      ],
      CriterionType: 'Targets',
    });
    expect(calls[2]!.body).toEqual({
      CampaignCriterions: [
        {
          Type: 'BiddableCampaignCriterion',
          CampaignId: 900,
          Criterion: { Type: 'DayTimeCriterion', Day: 'Monday', FromHour: 19, FromMinute: 'Zero', ToHour: 24, ToMinute: 'Zero' },
          CriterionBid: { Type: 'BidMultiplier', Multiplier: -20 },
        },
        { Type: 'BiddableCampaignCriterion', CampaignId: 900, Criterion: { Type: 'LocationCriterion', LocationId: 4001 }, CriterionBid: { Type: 'BidMultiplier', Multiplier: 0 } },
      ],
      CriterionType: 'Targets',
    });
  });

  it('reads devices, schedule and locations one type at a time ("Targets" is not allowed for reads)', async () => {
    const { backend, calls } = liveWith((_p, body) => {
      if (body.CriterionType === 'Device')
        return { CampaignCriterions: [{ Id: '1', Type: 'BiddableCampaignCriterion', Criterion: { Type: 'DeviceCriterion', DeviceName: 'Tablets' }, CriterionBid: { Type: 'BidMultiplier', Multiplier: -90 } }] };
      if (body.CriterionType === 'DayTime')
        return {
          CampaignCriterions: [
            { Id: '2', Type: 'BiddableCampaignCriterion', Criterion: { Type: 'DayTimeCriterion', Day: 'Friday', FromHour: 19, FromMinute: 'Zero', ToHour: 24, ToMinute: 'Zero' }, CriterionBid: { Type: 'BidMultiplier', Multiplier: -55 } },
          ],
        };
      return { CampaignCriterions: [{ Id: '3', Type: 'BiddableCampaignCriterion', Criterion: { Type: 'LocationCriterion', LocationId: '59', DisplayName: 'Denmark' }, CriterionBid: { Type: 'BidMultiplier', Multiplier: 0 } }] };
    });
    const t = await backend.getCampaignTargets('5', '900');
    expect(calls.map((c) => c.body)).toEqual([
      { CampaignCriterionIds: null, CampaignId: 900, CriterionType: 'Device' },
      { CampaignCriterionIds: null, CampaignId: 900, CriterionType: 'DayTime' },
      { CampaignCriterionIds: null, CampaignId: 900, CriterionType: 'Location' },
    ]);
    expect(t).toEqual({
      devices: [{ id: '1', device: 'Tablets', adjustment: -90 }],
      schedule: [{ id: '2', day: 'Friday', from: 19, to: 24, adjustment: -55 }],
      locations: [{ id: '3', locationId: '59', name: 'Denmark', adjustment: 0 }],
    });
  });

  it('finds Denmark and its regions in the locations file (deprecated ones left out)', async () => {
    const { backend } = liveWith(() => ({}));
    const places = await backend.findLocations('5', ['Denmark', 'Region Zealand', 'Capital Region of Denmark', 'Atlantis']);
    expect(places.map((p) => `${p.locationId} ${p.name}`)).toEqual(['59 Denmark', '4001 Region Zealand|Denmark', '4002 Capital Region of Denmark|Denmark']);
  });

  it('sends the ad group language, the product ad and the Shopping setting as documented', async () => {
    const { backend, calls } = liveWith((path) => (path === 'AdGroups' ? { AdGroupIds: ['1'], PartialErrors: [] } : path === 'Ads' ? { AdIds: ['2'], PartialErrors: [] } : { CampaignIds: ['3'], PartialErrors: [] }));
    await backend.createAdGroup('5', { campaignId: '900', name: 'Palleløftere', cpcBid: 10.05, status: 'Paused', language: 'Danish' });
    await backend.createProductAd('5', '1');
    await backend.createCampaign('5', {
      name: 'Shopping | Test',
      type: 'Shopping',
      dailyBudget: 100,
      bidStrategy: { type: 'EnhancedCpc' },
      languages: ['Danish'],
      status: 'Paused',
      shopping: { storeId: '123', salesCountryCode: 'DK' },
    });
    expect(calls[0]!.body).toEqual({ CampaignId: 900, AdGroups: [{ Name: 'Palleløftere', Status: 'Paused', CpcBid: { Amount: 10.05 }, Language: 'Danish' }] });
    expect(calls[1]!.body).toEqual({ AdGroupId: 1, Ads: [{ Type: 'Product', Status: 'Active' }] });
    const campaign = (calls[2]!.body.Campaigns as Record<string, unknown>[])[0]!;
    expect(campaign.CampaignType).toBe('Shopping');
    expect(campaign.Languages).toEqual(['Danish']);
    expect(campaign.Settings).toEqual([{ Type: 'ShoppingSetting', StoreId: 123, Priority: 0, SalesCountryCode: 'DK' }]);
  });
});

describe('the request that failed: nine Shopping ad groups, devices and an ad schedule', () => {
  beforeEach(() => DemoBackend.reset());

  async function shoppingCampaign(backend: DemoBackend) {
    // Like "Shopping | Transport & Løft": created without a language.
    const res = await backend.createCampaign('1000001', { name: 'Shopping | Transport & Løft', type: 'Shopping', dailyBudget: 200, bidStrategy: { type: 'EnhancedCpc' }, languages: [], status: 'Paused' });
    return res.ids![0]!;
  }

  it('creates all nine on one card with Danish, product ads and the team standard on the campaign', async () => {
    const backend = new DemoBackend(0);
    const campaignId = await shoppingCampaign(backend);
    const c = ctx(backend);
    const tool = getTool('create_ad_group')!;
    if (tool.kind !== 'write') throw new Error('unexpected');
    const adGroups = [
      ['Palleløftere', 8],
      ['El Palleløftere', 10],
      ['Rulleborde | Rustfri', 10],
      ['Rulleborde | Plast', 10],
      ['Værkstedsvogne', 10],
      ['Elektriske Ladvogne', 10],
      ['Pallestablere', 15.05],
      ['Palleløfter med vægt', 10],
      ['Transportbure og Trådbure', 8.55],
    ].map(([name, cpcBid]) => ({ name, cpcBid }));
    const input = tool.schema.parse({ campaignId, adGroups, reason: 'Nye annoncegrupper' });
    const planned = await tool.plan(input, c);
    const plan = planned.plan!;
    expect(plan.title).toBe('9 nye annoncegrupper · Shopping | Transport & Løft');
    expect(plan.notes).toContain('Kampagnen har intet sprog, så annoncegrupperne får sproget dansk.');
    expect(plan.changes.filter((l) => l.field === 'Annoncegruppe')).toHaveLength(9);
    // The team standard on the campaign: three devices, seven days, six locations.
    expect(plan.changes.filter((l) => l.field.startsWith('Kampagne · Enhed'))).toHaveLength(3);
    expect(plan.changes.filter((l) => l.field.startsWith('Kampagne · Tidsplan'))).toHaveLength(7);
    expect(plan.changes.filter((l) => l.field === 'Kampagne · Lokation')).toHaveLength(6);
    // The spending rule's minimum bid (10,05 kr.) flags the two lower bids on the card.
    const decision = evaluateGuardrails(plan, c.rules, { currency: 'DKK', totalActiveDailyBudget: 0, monthToDateSpend: 0, daysLeftInMonth: 10 });
    expect(decision.reasons.join(' ')).toMatch(/8 bud er under mindstebuddet/); // all but 15,05 kr. – also the 10 kr. ones

    const exec = await planned.execute();
    expect(exec.summary).toMatch(/^Bekræftet hos Microsoft/);
    const groups = await backend.listAdGroups('1000001', campaignId);
    expect(groups.map((g) => g.name).sort()).toEqual(adGroups.map((g) => g.name).sort());
    for (const g of groups) expect((await backend.listAds('1000001', g.id)).some((a) => a.type === 'Product')).toBe(true);
    const targets = await backend.getCampaignTargets('1000001', campaignId);
    expect(targets.devices.map((d) => `${d.device} ${d.adjustment}`).sort()).toEqual(['Computers 0', 'Smartphones -90', 'Tablets -90']);
    expect(targets.schedule).toHaveLength(42);
    expect(targets.locations).toHaveLength(6);
  });

  it('sets the user’s own devices and ad schedule exactly as written', async () => {
    const backend = new DemoBackend(0);
    const campaignId = await shoppingCampaign(backend);
    const c = ctx(backend);
    const tool = getTool('set_campaign_targeting')!;
    if (tool.kind !== 'write') throw new Error('unexpected');
    const monThu = ['Monday', 'Tuesday', 'Wednesday', 'Thursday'];
    const input = tool.schema.parse({
      campaignId,
      devices: { smartphones: -90, tablets: -90 },
      schedule: [
        { days: monThu, from: 0, to: 6, adjustment: -40 },
        { days: monThu, from: 6, to: 9, adjustment: 0 },
        { days: monThu, from: 9, to: 12, adjustment: 10 },
        { days: monThu, from: 12, to: 16, adjustment: 10 },
        { days: monThu, from: 16, to: 19, adjustment: -30 },
        { days: monThu, from: 19, to: 24, adjustment: -20 },
        { days: ['Friday'], from: 0, to: 24, adjustment: -50 },
        { days: ['Saturday'], from: 0, to: 24, adjustment: -55 },
        { days: ['Sunday'], from: 0, to: 24, adjustment: -40 },
      ],
      reason: 'Enheder og tidsplan',
    });
    const planned = await tool.plan(input, c);
    expect(planned.plan!.notes).toEqual([]); // no gaps
    expect(planned.plan!.increasesSpend).toBe(true); // +10 % in the middle of the day
    const exec = await planned.execute();
    expect(exec.summary).toBe('Bekræftet hos Microsoft: 10 indstillinger');
    const t = await backend.getCampaignTargets('1000001', campaignId);
    expect(t.schedule).toHaveLength(27);
    expect(t.schedule.find((b) => b.day === 'Wednesday' && b.from === 19)).toMatchObject({ to: 24, adjustment: -20 });
  });

  it('refuses overlaps, more than 7 blocks a day and the raw API for targeting', async () => {
    const backend = new DemoBackend(0);
    const campaignId = await shoppingCampaign(backend);
    const c = ctx(backend);
    const tool = getTool('set_campaign_targeting')!;
    if (tool.kind !== 'write') throw new Error('unexpected');
    const overlap = tool.schema.parse({ campaignId, schedule: [{ days: ['Monday'], from: 0, to: 10, adjustment: 0 }, { days: ['Monday'], from: 9, to: 12, adjustment: 0 }], reason: 'x' });
    await expect(tool.plan(overlap, c)).rejects.toThrow(/overlapper/);
    const crowded = tool.schema.parse({ campaignId, schedule: Array.from({ length: 8 }, (_, i) => ({ days: ['Monday'], from: i, to: i + 1, adjustment: 0 })), reason: 'x' });
    await expect(tool.plan(crowded, c)).rejects.toThrow(/højst 7 tidsrum/);
    const gaps = await tool.plan(tool.schema.parse({ campaignId, schedule: [{ days: ['Monday'], from: 8, to: 16, adjustment: 0 }], reason: 'x' }), c);
    expect(gaps.plan!.notes!.join(' ')).toMatch(/Uden for tidsplanen vises ingen annoncer: Mandag 00–08, 16–24; Tirsdag 00–24/);

    const raw = getTool('microsoft_ads_api')!;
    if (raw.kind !== 'write') throw new Error('unexpected');
    const body = { CampaignCriterions: [{ Type: 'BiddableCampaignCriterion', CampaignId: 1, Criterion: { Type: 'DeviceCriterion', DeviceName: 'Smartphones' } }], CriterionType: 'Targets' };
    await expect(raw.plan(raw.schema.parse({ service: 'campaign', path: 'CampaignCriterions', method: 'POST', body, reason: 'x' }), c)).rejects.toThrow(/set_campaign_targeting/);
    await expect(raw.plan(raw.schema.parse({ service: 'campaign', path: 'AdGroups', method: 'POST', body: { CampaignId: 1, AdGroups: [] }, reason: 'x' }), c)).rejects.toThrow(/create_ad_group/);
  });

  it('creates a Shopping campaign with Danish, the store and the team standard', async () => {
    const backend = new DemoBackend(0);
    const c = ctx(backend);
    const tool = getTool('create_campaign')!;
    if (tool.kind !== 'write') throw new Error('unexpected');
    const planned = await tool.plan(tool.schema.parse({ name: 'Shopping | Ny', type: 'Shopping', dailyBudget: 150, bidStrategy: { type: 'EnhancedCpc' }, reason: 'x' }), c);
    expect(planned.plan!.changes.find((l) => l.field === 'butik')?.after).toBe('Demo-butik (700001) · Danmark');
    const exec = await planned.execute();
    expect(exec.summary).toMatch(/^Bekræftet hos Microsoft/);
    const id = (exec.result as { campaignId: string }).campaignId;
    const campaign = (await backend.listCampaigns('1000001')).find((x) => x.id === id)!;
    expect(campaign.languages).toEqual(['Danish']);
    expect((await backend.getCampaignTargets('1000001', id)).schedule).toHaveLength(42);
    expect(bidStrategyProblem({ name: 'x', type: 'Shopping' }, { type: 'MaxConversions' })).toMatch(/Smart Shopping/);
  });
});

/**
 * A small Microsoft Advertising for the live backend: it keeps ad groups, product groups,
 * ads and campaign criterions, and refuses what Microsoft refuses (no language anywhere,
 * a criterion type other than "Targets", device criterions not added as all three).
 */
function fakeMicrosoft() {
  const groups: { Id: number; Name: string; Status: string; CpcBid: { Amount: number } | null; Language?: string }[] = [];
  type Node = {
    Id: number;
    Type: string;
    Criterion: { Type: string; Condition: { Operand: string; Attribute: string | null }; ParentCriterionId: number | null; PartitionType: string };
    CriterionBid?: { Type: string; Amount: number | null } | null;
  };
  const trees = new Map<number, Node[]>();
  const ads = new Map<number, string[]>();
  const criterions: { Id: number; Type: string; Criterion: Record<string, unknown>; CriterionBid: { Type: string; Multiplier: number } }[] = [];
  let next = 1000;
  const typeOf = (c: Record<string, unknown>) => String(c.Type).replace('Criterion', '');
  const { backend, calls } = liveWith((path, body, method) => {
    if (path === 'Campaigns/QueryByAccountId')
      return { Campaigns: [{ Id: 900, Name: 'Shopping | Transport & Løft', Status: 'Paused', CampaignType: 'Shopping', Languages: null, BiddingScheme: { Type: 'EnhancedCpcBiddingScheme' }, DailyBudget: 200 }] };
    if (path === 'AdGroups/QueryByCampaignId') return { AdGroups: groups };
    if (path === 'AdGroups' && method === 'POST') {
      const g = (body.AdGroups as Record<string, unknown>[])[0]!;
      if (!g.Language) return { AdGroupIds: [null], PartialErrors: [{ Index: 0, ErrorCode: 'CampaignServiceMissingLanguage', Message: 'The language is not provided.' }] };
      const Id = next++;
      groups.push({ Id, Name: String(g.Name), Status: String(g.Status), CpcBid: (g.CpcBid as { Amount: number }) ?? null, Language: String(g.Language) });
      return { AdGroupIds: [Id], PartialErrors: [] };
    }
    if (path === 'ProductPartitionActions/Apply') {
      // Microsoft's rules (ApplyProductPartitionActions): a biddable "All" root, a bid on every biddable unit,
      // an "everything else" (Attribute null) under every subdivision, and all actions or none.
      type Action = { Action: string; AdGroupCriterion: Node & { AdGroupId: number } };
      const actions = body.CriterionActions as Action[];
      const groupId = actions[0]!.AdGroupCriterion.AdGroupId;
      const tree = [...(trees.get(groupId) ?? [])];
      const temp = new Map<number, number>();
      const ids: number[] = [];
      for (const a of actions) {
        const c = a.AdGroupCriterion;
        if (a.Action === 'Delete') {
          const drop = (id: number) => {
            for (const child of tree.filter((n) => n.Criterion.ParentCriterionId === id)) drop(child.Id);
            tree.splice(tree.findIndex((n) => n.Id === id), 1);
          };
          drop(Number(c.Id));
          continue;
        }
        const Id = next++;
        if (c.Id !== undefined && Number(c.Id) < 0) temp.set(Number(c.Id), Id);
        const parent = c.Criterion.ParentCriterionId;
        const node: Node = { ...c, Id, Criterion: { ...c.Criterion, ParentCriterionId: parent === null ? null : (temp.get(parent) ?? parent) } };
        tree.push(node);
        ids.push(Id);
      }
      const root = tree.filter((n) => n.Criterion.ParentCriterionId === null);
      const fail = (Message: string) => ({ PartialErrors: [{ Index: 0, Message }] });
      if (root.length !== 1 || root[0]!.Type !== 'BiddableAdGroupCriterion' || root[0]!.Criterion.Condition.Operand !== 'All') return fail('The root must be a biddable "All" node.');
      for (const n of tree) {
        if (n.Criterion.PartitionType === 'Unit' && n.Type === 'BiddableAdGroupCriterion' && !n.CriterionBid?.Amount) return fail('Every biddable unit needs a bid.');
        if (n.Criterion.PartitionType === 'Subdivision' && !tree.some((x) => x.Criterion.ParentCriterionId === n.Id && x.Criterion.Condition.Attribute === null))
          return fail('Every subdivision needs an "everything else" node.');
      }
      trees.set(groupId, tree);
      return { AdGroupCriterionIds: ids, PartialErrors: [] };
    }
    if (path === 'AdGroupCriterions/QueryByIds') return { AdGroupCriterions: trees.get(Number(body.AdGroupId)) ?? [] };
    if (path === 'Ads' && method === 'POST') {
      const id = Number(body.AdGroupId);
      ads.set(id, [...(ads.get(id) ?? []), ...(body.Ads as { Type: string }[]).map((a) => a.Type)]);
      return { AdIds: [next++], PartialErrors: [] };
    }
    if (path === 'Ads/QueryByAdGroupId') return { Ads: (ads.get(Number(body.AdGroupId)) ?? []).map((Type, i) => ({ Id: i + 1, Type, Status: 'Active' })) };
    if (path === 'CampaignCriterions/QueryByIds') {
      if (body.CriterionType === 'Targets') throw new Error('Targets is not allowed for GetCampaignCriterionsByIds');
      return { CampaignCriterions: criterions.filter((c) => typeOf(c.Criterion) === body.CriterionType) };
    }
    if (path === 'CampaignCriterions') {
      if (body.CriterionType !== 'Targets') return { PartialErrors: [{ Index: 0, ErrorCode: 'CampaignCriterionTypeInvalid', Message: "The campaign criterion's type is not valid." }] };
      if (method === 'DELETE') {
        for (const id of body.CampaignCriterionIds as number[]) criterions.splice(criterions.findIndex((c) => c.Id === id), 1);
        return { PartialErrors: [] };
      }
      const list = body.CampaignCriterions as (typeof criterions)[number][];
      if (method === 'PUT') {
        for (const u of list) criterions.find((c) => c.Id === u.Id)!.CriterionBid = u.CriterionBid;
        return { PartialErrors: [] };
      }
      const devices = list.filter((c) => typeOf(c.Criterion) === 'Device');
      if (devices.length && devices.length !== 3) return { CampaignCriterionIds: list.map(() => null), NestedPartialErrors: [{ Index: 0, Message: 'Add all three device criterions together.' }] };
      const ids = list.map((c) => {
        const Id = next++;
        criterions.push({ ...c, Id });
        return Id;
      });
      return { CampaignCriterionIds: ids, NestedPartialErrors: [] };
    }
    throw new Error(`Uventet kald i testen: ${method} ${path}`);
  });
  return { backend, calls, groups, trees, ads, criterions };
}

describe('live: the same request against Microsoft’s rules', () => {
  it('creates the Shopping ad groups with Danish, "Alle produkter" with the bid and a product ad – and the standard targeting', async () => {
    const ms = fakeMicrosoft();
    const c = ctx(ms.backend as unknown as DemoBackend);
    c.accountId = '5';
    const tool = getTool('create_ad_group')!;
    if (tool.kind !== 'write') throw new Error('unexpected');
    const planned = await tool.plan(
      tool.schema.parse({ campaignId: '900', adGroups: [{ name: 'Palleløftere', cpcBid: 10.05, items: ['2515012108', '2392163005'] }, { name: 'Pallestablere', cpcBid: 15.05 }], reason: 'x' }),
      c,
    );
    expect(planned.plan!.changes.filter((l) => l.field.startsWith('Produktgrupper')).map((l) => l.after)).toEqual([
      '2 varenumre (2515012108, 2392163005) · alt andet udelukket',
      'Alle produkter udelukket – tilføj varenumre bagefter',
    ]);
    const exec = await planned.execute();
    expect(exec.summary).toMatch(/^Bekræftet hos Microsoft/);
    expect((exec.result as { confirmed: string[] }).confirmed.filter((x) => x.startsWith('Produktgrupper'))).toHaveLength(2);
    expect(ms.groups.map((g) => `${g.Name} ${g.Language} ${g.CpcBid?.Amount}`)).toEqual(['Palleløftere Danish 10.05', 'Pallestablere Danish 15.05']);
    // "Alle produkter" split: the items with the bid, "alt andet" excluded – never all products.
    const shape = (id: number) =>
      (ms.trees.get(id) ?? []).map((n) => `${n.Criterion.PartitionType} ${n.Criterion.Condition.Operand}:${n.Criterion.Condition.Attribute ?? '*'} ${n.Type === 'NegativeAdGroupCriterion' ? 'udelukket' : (n.CriterionBid?.Amount ?? '')}`.trim());
    expect(shape(ms.groups[0]!.Id)).toEqual(['Subdivision All:*', 'Unit Id:2515012108 10.05', 'Unit Id:2392163005 10.05', 'Unit Id:* udelukket']);
    expect(shape(ms.groups[1]!.Id)).toEqual(['Subdivision All:*', 'Unit Id:* udelukket']);
    expect([...ms.ads.values()]).toEqual([['Product'], ['Product']]);
    // Devices: one "Targets" call with all three; 42 schedule blocks; Denmark + the two regions the file knows.
    const types = ms.criterions.map((x) => String(x.Criterion.Type));
    expect(types.filter((t) => t === 'DeviceCriterion')).toHaveLength(3);
    expect(types.filter((t) => t === 'DayTimeCriterion')).toHaveLength(42);
    expect(types.filter((t) => t === 'LocationCriterion')).toHaveLength(3);
    expect(ms.calls.filter((x) => x.path === 'CampaignCriterions').every((x) => x.body.CriterionType === 'Targets')).toBe(true);
    expect(ms.criterions.find((x) => x.Criterion.DeviceName === 'Smartphones')!.CriterionBid.Multiplier).toBe(-90);
  });
});

describe('excluding "Alle produkter" in existing ad groups', () => {
  it('splits a group that bids on all products and excludes "alt andet" – as Microsoft allows', async () => {
    const ms = fakeMicrosoft();
    const c = ctx(ms.backend as unknown as DemoBackend);
    c.accountId = '5';
    // An ad group that bids on all products (as the earlier version created them).
    ms.groups.push({ Id: 50, Name: 'Palleløftere', Status: 'Paused', CpcBid: { Amount: 10.05 }, Language: 'Danish' });
    ms.trees.set(50, [{ Id: 51, Type: 'BiddableAdGroupCriterion', Criterion: { Type: 'ProductPartition', Condition: { Operand: 'All', Attribute: null }, ParentCriterionId: null, PartitionType: 'Unit' }, CriterionBid: { Type: 'FixedBid', Amount: 10.05 } }]);
    const tool = getTool('edit_product_groups')!;
    if (tool.kind !== 'write') throw new Error('unexpected');
    const planned = await tool.plan(tool.schema.parse({ campaignId: '900', adGroupId: '50', everythingElse: 'exclude', reason: 'Udeluk alle produkter' }), c);
    const exec = await planned.execute();
    expect(exec.summary).toMatch(/Bekræftet/);
    const tree = ms.trees.get(50)!;
    expect(tree.map((n) => `${n.Criterion.PartitionType} ${n.Criterion.Condition.Attribute ?? '*'} ${n.Type}`)).toEqual(['Subdivision * BiddableAdGroupCriterion', 'Unit * NegativeAdGroupCriterion']);

    // Then an item id to bid on: added under the split, "alt andet" stays excluded.
    const more = await tool.plan(tool.schema.parse({ campaignId: '900', adGroupId: '50', include: ['2392164005'], bid: 12, reason: 'Byd på varenummer' }), { ...c, memo: new Map() });
    await more.execute();
    const after = ms.trees.get(50)!.map((n) => `${n.Criterion.PartitionType} ${n.Criterion.Condition.Attribute ?? '*'} ${n.Type === 'NegativeAdGroupCriterion' ? 'udelukket' : (n.CriterionBid?.Amount ?? '')}`.trim());
    expect(after.sort()).toEqual(['Subdivision *', 'Unit * udelukket', 'Unit 2392164005 12'].sort());
  });
});
