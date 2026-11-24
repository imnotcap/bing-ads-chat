import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

const answers: { id: string; answer: { approved: boolean; edits?: unknown[]; excluded?: number[]; note?: string } }[] = [];
vi.mock('@/ai/approvals', async (orig) => ({
  ...(await orig<typeof import('@/ai/approvals')>()),
  answerApproval: (id: string, answer: (typeof answers)[number]['answer']) => answers.push({ id, answer }),
}));

import { ApprovalBatch } from '@/features/chat/ApprovalBatch';
import { batchCards } from '@/features/chat/Messages';
import { cardSummary } from '@/features/chat/batchSummary';
import { planEdit, shapeOf } from '@/features/audit/productMirror';
import type { DListingNode } from '@/features/audit/detail';
import type { ToolPart } from '@/stores/chat';
import { exclusionBids, loadOldBids, oldBidOf, saveOldBids } from '@/workspace/oldBids';

const plan = (title: string, items: string[], bid = 8): NonNullable<ToolPart['plan']> => ({
  kind: 'update',
  title,
  changes: items.map((id) => ({ entity: 'Produktgruppe', entityId: 'g', field: `${title} · Byd på ${id}`, after: id, cells: { kind: 'Byd', bid }, pickKey: `k:${id}` })),
  dailyBudgetDelta: 0,
  increasesSpend: true,
  campaignIds: ['1'],
  pick: { skipPath: ['skip'], group: 'group', itemLabel: 'Varenummer', tag: 'kind', columns: [{ key: 'bid', label: 'Bud', format: 'money' as const }], approveLabel: 'Udfør {n}' },
});
const card = (id: string, title: string, items: string[], status: ToolPart['status'] = 'awaiting_approval'): ToolPart => ({
  type: 'tool',
  id,
  name: 'edit_product_groups',
  label: '',
  input: {},
  status,
  startedAt: 0,
  plan: plan(title, items),
  decision: { verdict: 'approve', reasons: ['Et bud er under mindstebuddet på 10,05 kr. – ret det til 10,05 kr..'] },
});

describe('many approval cards as one', () => {
  beforeEach(() => {
    answers.length = 0;
  });

  it('groups three or more cards in a row – not two, and not across text', () => {
    const text = (id: string, t: string) => ({ kind: 'part' as const, part: { type: 'text' as const, id, text: t } });
    const c = (id: string) => ({ kind: 'part' as const, part: card(id, id, ['1']) });
    const g = batchCards([text('t0', 'Her er ændringerne:'), c('a'), c('b'), text('t1', ''), c('c'), text('t2', 'Færdig.')]);
    expect(g.map((x) => x.kind)).toEqual(['part', 'cards', 'part']);
    expect(g[1]!.kind === 'cards' && g[1]!.parts.map((p) => p.id)).toEqual(['a', 'b', 'c']);
    expect(batchCards([c('a'), c('b'), text('t', 'ok'), c('c')]).map((x) => x.kind)).toEqual(['part', 'part', 'part', 'part']);
  });

  it('says in one line what each card does', () => {
    expect(cardSummary(plan('Medicinal', ['1838650105', '1838650205']), 'DKK').replace(/\s/g, ' ')).toBe('Byd 1838650105, 1838650205 · 8,00 kr.');
    expect(
      cardSummary({ kind: 'update', title: 'x', changes: [{ entity: 'Kampagne', field: 'Dagsbudget', after: 300 }], dailyBudgetDelta: 0, increasesSpend: false, campaignIds: [] }, 'DKK')
      .replace(/\s/g, ' '),
    ).toBe('Dagsbudget: 300,00 kr.');
  });

  it('approves every chosen card at once and rejects the ones ticked off', () => {
    render(<ApprovalBatch currency="DKK" parts={[card('a', 'Medicinal', ['1', '2']), card('b', 'Lagerkøleskab', ['3']), card('c', 'Kølemøbler', ['4']), card('d', 'Done', ['5'], 'done')]} />);
    expect(screen.getByText('4 ændringer samlet')).toBeTruthy();
    // The shared warning once, with how many it applies to.
    expect(screen.getAllByText(/under mindstebuddet/)).toHaveLength(1);
    expect(screen.getByText(/i 3 af ændringerne/)).toBeTruthy();
    fireEvent.click(screen.getByLabelText('Medtag Lagerkøleskab'));
    fireEvent.click(screen.getByRole('button', { name: /Godkend 2 \(3 rækker\)/ }));
    expect(answers).toEqual([
      { id: 'a', answer: { approved: true, excluded: [] } },
      { id: 'b', answer: { approved: false, note: 'Fravalgt i den samlede godkendelse.' } },
      { id: 'c', answer: { approved: true, excluded: [] } },
    ]);
  });

  it('sends the corrections made in an opened card', () => {
    render(<ApprovalBatch currency="DKK" parts={[card('a', 'Medicinal', ['1', '2']), card('b', 'B', ['3']), card('c', 'C', ['4'])]} />);
    fireEvent.click(screen.getAllByText('Medicinal')[0]!);
    // Tick off item 2 inside the opened card.
    fireEvent.click(screen.getByLabelText('Medtag 2'));
    fireEvent.click(screen.getByRole('button', { name: /Godkend alle/ }));
    expect(answers.find((a) => a.id === 'a')?.answer.excluded).toEqual([1]);
  });
});

/* --------------------------------- old bids --------------------------------- */

const n = (id: string, parentId: string | null, raw: string, o: Partial<DListingNode> = {}): DListingNode => ({
  id,
  parentId,
  group: 'Stole',
  unit: true,
  excluded: false,
  dim: parentId ? 'id' : 'all',
  value: raw.toLowerCase(),
  raw,
  groupId: '500',
  ...o,
});

describe('old bids', () => {
  it('remembers the bid an item had when it is excluded – its own, or the one of "alt andet"', () => {
    const nodes = [n('0', null, '', { unit: false }), n('1', '0', 'A', { bid: 12.5 }), n('2', '0', '', { bid: 4 })];
    expect(shapeOf(nodes).kind).toBe('ids');
    const g = planEdit(nodes, { id: '500', name: 'Stole', cpcBid: 3 }, { exclude: ['A', 'B'] });
    const keys = new Set(g.rows.map((r) => r.key));
    expect(exclusionBids(g, keys)).toEqual([
      { adGroupId: '500', itemId: 'A', bid: 12.5 },
      { adGroupId: '500', itemId: 'B', bid: 4 },
    ]);
    // Rows the user ticked off are not saved.
    expect(exclusionBids(g, new Set([g.rows[0]!.key]))).toEqual([{ adGroupId: '500', itemId: 'A', bid: 12.5 }]);
    // Performance Max has no bids.
    expect(exclusionBids({ ...g, noBids: true }, keys)).toEqual([]);
  });

  it('keeps them on this PC without a workspace, per ad group', async () => {
    localStorage.clear();
    await saveOldBids('42', [
      { adGroupId: '500', itemId: 'SKU-1', bid: 12.5 },
      { adGroupId: '501', itemId: 'SKU-1', bid: 9 },
    ]);
    const map = await loadOldBids('42');
    expect(oldBidOf(map, '500', 'sku-1')).toBe(12.5);
    expect(oldBidOf(map, '501', 'SKU-1')).toBe(9);
    expect(oldBidOf(map, '502', 'SKU-1')).toBeNull();
    expect(oldBidOf(await loadOldBids('43'), '500', 'SKU-1')).toBeNull();
  });

  it('re-activates at the old bid', () => {
    const nodes = [n('0', null, '', { unit: false }), n('1', '0', 'A', { excluded: true }), n('2', '0', '', { excluded: true })];
    const g = planEdit(nodes, { id: '500', name: 'Stole', cpcBid: 0.06 }, { itemBids: { A: 12.5 } });
    expect(g.rows.map((r) => [r.action, r.itemId, r.bid])).toEqual([['to_bid', 'A', 12.5]]);
  });
});
