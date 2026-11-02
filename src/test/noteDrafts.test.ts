import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const written: unknown[] = [];
vi.mock('@/workspace/shared', async (orig) => ({ ...(await orig<typeof import('@/workspace/shared')>()), writeNotes: async (notes: unknown) => (written.push(notes), { written: 1 }) }));

import { startNoteDrafts, useNoteDrafts } from '@/ai/notes';
import { getTool, type ToolContext } from '@/ai/tools';
import { DemoBackend } from '@/bing/demo/backend';
import { useAccount } from '@/stores/account';
import { useActivity } from '@/stores/activity';
import { DEFAULT_SPEND_RULES } from '@/stores/settings';

const connect = (connected: boolean) =>
  useAccount.setState({ workspace: { ...(useAccount.getState().workspace ?? ({} as never)), notesheet: { connected, name: 'Notatark til Google og Bing', tab: 'Ark1', url: null, serviceAccount: null, columns: [], connectedBy: null, connectedAt: null, lastWrite: null, error: null } } as never });

const tick = () => new Promise((r) => setTimeout(r, 0));
let stop: () => void;

beforeEach(() => {
  useActivity.getState().clear();
  useNoteDrafts.setState({ drafts: {} });
  written.length = 0;
  connect(true);
  stop = startNoteDrafts(async (_a, id) => (id === '7' ? 'Shopping | Lager' : ''), () => 'DKK');
});
afterEach(() => stop());

describe('every change in the app gets rows for the notes sheet', () => {
  it('drafts rows for the user\'s own change on a live account – nothing is written yet', async () => {
    const e = useActivity.getState().add({
      source: 'user',
      mode: 'live',
      accountId: '1',
      tool: 'update_campaigns',
      summary: 'Dagsbudget ændret',
      changes: [{ entity: 'Kampagne', entityId: '7', field: 'Shopping | Lager · dagsbudget', before: 300, after: 375 }],
      status: 'success',
      campaignIds: ['7'],
    });
    await tick();
    const d = useNoteDrafts.getState().drafts[e.id]!;
    expect(d).toMatchObject({ status: 'draft', source: 'user', title: 'Dagsbudget ændret' });
    expect(d.rows[0]).toMatchObject({ campaign: 'Shopping | Lager', adGroup: '', topics: ['Kampagne'] });
    expect(d.rows[0]!.comment).toMatch(/^Ændrede dagsbudget fra 300\s?kr\. til 375\s?kr\.$/);
    expect(written).toEqual([]);
  });

  it('one row per campaign when the budget guard pauses several', async () => {
    const e = useActivity.getState().add({
      source: 'budgetvagt',
      mode: 'live',
      accountId: '1',
      tool: 'update_campaigns',
      summary: 'Budgetvagt: 2 kampagner sat på pause',
      changes: [
        { entity: 'Kampagne', entityId: '7', field: 'A · status', before: 'Aktiv', after: 'Pauset' },
        { entity: 'Kampagne', entityId: '8', field: 'B · status', before: 'Aktiv', after: 'Pauset' },
      ],
      status: 'success',
    });
    await tick();
    expect(useNoteDrafts.getState().drafts[e.id]!.rows.map((r) => [r.campaign, r.comment])).toEqual([
      ['A', 'Ændrede status fra Aktiv til Pauset'],
      ['B', 'Ændrede status fra Aktiv til Pauset'],
    ]);
  });

  it('nothing for demo, failed changes, or when no sheet is connected', async () => {
    const base = { source: 'user' as const, accountId: '1', tool: 'update_campaigns', summary: 's', changes: [{ entity: 'Kampagne', field: 'A · status', after: 'Pauset' }] };
    const demo = useActivity.getState().add({ ...base, mode: 'demo', status: 'success' });
    const failed = useActivity.getState().add({ ...base, mode: 'live', status: 'failed' });
    connect(false);
    const off = useActivity.getState().add({ ...base, mode: 'live', status: 'success' });
    await tick();
    const drafts = useNoteDrafts.getState().drafts;
    expect([drafts[demo.id], drafts[failed.id], drafts[off.id]]).toEqual([undefined, undefined, undefined]);
  });
});

describe('add_note_to_sheet', () => {
  const ctx = (): ToolContext => ({ backend: new DemoBackend(0), accountId: '1000001', currency: 'DKK', rules: DEFAULT_SPEND_RULES, defaultPreset: 'last30', memo: new Map() });

  it('shows the row on a card and writes it only when approved', async () => {
    const tool = getTool('add_note_to_sheet')!;
    if (tool.kind !== 'write') throw new Error('unexpected');
    const { plan, execute } = await tool.plan(tool.schema.parse({ comment: 'Test fra XavierOS – kan slettes', reason: 'Test' }), ctx());
    expect(plan!.changes.map((c) => [c.field, c.after])).toEqual([
      ['Kampagne', ''],
      ['Annoncegruppe', ''],
      ['Emne', 'Kampagne'],
      ['Kommentar', 'Test fra XavierOS – kan slettes'],
    ]);
    expect(plan!.changes.every((c) => c.edit)).toBe(true);
    expect(written).toEqual([]);
    await execute();
    expect(written).toEqual([[{ campaign: '', adGroup: '', topics: ['Kampagne'], comment: 'Test fra XavierOS – kan slettes' }]]);
  });

  it('says how to connect the sheet when it is not', async () => {
    connect(false);
    const tool = getTool('add_note_to_sheet')!;
    if (tool.kind !== 'write') throw new Error('unexpected');
    await expect(tool.plan(tool.schema.parse({ comment: 'x', reason: 'x' }), ctx())).rejects.toThrow(/Indstillinger → Forbindelser → Notatark/);
  });
});
