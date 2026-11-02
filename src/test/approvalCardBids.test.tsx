import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

const answers: unknown[] = [];
vi.mock('@/ai/approvals', async (orig) => ({ ...(await orig<typeof import('@/ai/approvals')>()), answerApproval: (_id: string, a: unknown) => answers.push(a) }));

import { ApprovalCard } from '@/features/chat/ApprovalCard';
import type { ToolPart } from '@/stores/chat';

const part = (plan: ToolPart['plan']): ToolPart => ({ type: 'tool', id: 't1', name: 'update_keywords', label: '', input: {}, status: 'awaiting_approval', startedAt: 0, plan });

describe('bids on the approval card', () => {
  it('flags a bid under 10,05 kr., fixes it with one click, and sends it as a number', () => {
    render(
      <ApprovalCard
        currency="DKK"
        part={part({
          kind: 'update',
          title: 'Bud',
          changes: [{ entity: 'Søgeord', field: 'kontorstol · bud', before: 6, after: 8, edit: { path: ['changes', 0, 'bid'], kind: 'money' } }],
          dailyBudgetDelta: 0,
          increasesSpend: true,
          campaignIds: ['1'],
        })}
      />,
    );
    const input = screen.getByLabelText('Ret kontorstol · bud') as HTMLInputElement;
    expect(input.value).toBe('8');
    expect(screen.getByText('Under mindstebuddet')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Ret til 10,05/ }));
    expect(input.value).toBe('10,05');
    expect(screen.queryByText('Under mindstebuddet')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Godkend/ }));
    expect(answers.at(-1)).toMatchObject({ approved: true, edits: [{ path: ['changes', 0, 'bid'], value: '10,05', kind: 'money' }] });
  });

  it('lets the user set the bid per ad group in a product group card', () => {
    render(
      <ApprovalCard
        currency="DKK"
        part={part({
          kind: 'update',
          title: 'Produktgrupper',
          changes: [
            { entity: 'Produktgruppe', field: 'A · Byd', after: 'SKU-1', cells: { group: 'Stole', groupId: '1040', kind: 'Byd', bid: 9 }, pickKey: 'k1' },
            { entity: 'Produktgruppe', field: 'A · Udeluk', after: 'SKU-2', cells: { group: 'Stole', groupId: '1040', kind: 'Udeluk', bid: null }, pickKey: 'k2' },
          ],
          dailyBudgetDelta: 0,
          increasesSpend: true,
          campaignIds: ['1'],
          pick: { skipPath: ['skip'], group: 'group', tag: 'kind', columns: [{ key: 'bid', label: 'Bud', format: 'money' }], groupBid: { idCell: 'groupId', valueCell: 'bid', path: ['bids'], label: 'Bud' }, approveLabel: 'Udfør {n}' },
        })}
      />,
    );
    const input = screen.getByLabelText('Bud i Stole') as HTMLInputElement;
    expect(input.value).toBe('9');
    fireEvent.change(input, { target: { value: '11,5' } });
    fireEvent.click(screen.getByRole('button', { name: /Udfør/ }));
    expect(answers.at(-1)).toMatchObject({ approved: true, edits: [{ path: ['bids', '1040'], value: '11,5', kind: 'money' }] });
  });
});
