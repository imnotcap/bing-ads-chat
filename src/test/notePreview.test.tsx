import { describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';

const sent: unknown[] = [];
vi.mock('@/workspace/shared', async (orig) => ({ ...(await orig<typeof import('@/workspace/shared')>()), writeNotes: async (notes: unknown) => (sent.push(notes), { written: 1 }) }));

import { ApprovalCard } from '@/features/chat/ApprovalCard';
import { useNoteDrafts } from '@/ai/notes';
import type { ToolPart } from '@/stores/chat';

const part: ToolPart = {
  type: 'tool',
  id: 'call-1',
  name: 'match_product_groups_to_google',
  label: '',
  input: {},
  status: 'done',
  startedAt: 0,
  plan: { kind: 'update', title: 'Produktgrupper', changes: [], dailyBudgetDelta: 0, increasesSpend: false, campaignIds: ['1'] },
};

describe('the notes sheet preview on the card', () => {
  it('shows the row first, lets the user correct it, and writes only on the button', async () => {
    useNoteDrafts.getState().set('call-1', { status: 'draft', rows: [{ campaign: 'Shopping | Lager', adGroup: 'Pallestativer', topics: ['Produkter'], comment: 'Tilføjede c073283018 m. bud på 10,05 kr.' }] });
    render(<ApprovalCard currency="DKK" part={part} />);
    expect(sent).toEqual([]);
    const comment = screen.getByLabelText('Kommentar') as HTMLTextAreaElement;
    expect(comment.value).toBe('Tilføjede c073283018 m. bud på 10,05 kr.');
    fireEvent.change(comment, { target: { value: 'Tilføjede c073283018 m. bud på 11 kr.' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Skriv i notatark \(1\)/ }));
    });
    expect(sent).toEqual([[{ campaign: 'Shopping | Lager', adGroup: 'Pallestativer', topics: ['Produkter'], comment: 'Tilføjede c073283018 m. bud på 11 kr.' }]]);
    expect(screen.getByText('Skrevet i arket')).toBeTruthy();
  });

  it('writes nothing when skipped', () => {
    sent.length = 0;
    useNoteDrafts.getState().set('call-2', { status: 'draft', rows: [{ campaign: 'K', adGroup: 'G', topics: ['Produkter'], comment: 'Ekskluderede 1' }] });
    render(<ApprovalCard currency="DKK" part={{ ...part, id: 'call-2' }} />);
    fireEvent.click(screen.getByRole('button', { name: 'Spring over' }));
    expect(screen.getByText('Ikke skrevet')).toBeTruthy();
    expect(sent).toEqual([]);
  });
});
