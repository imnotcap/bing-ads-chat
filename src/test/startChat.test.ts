import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/ai/agent', () => ({ sendMessage: vi.fn(async () => undefined) }));

import { sendMessage } from '@/ai/agent';
import { startChat } from '@/features/chat/startChat';
import { useChat } from '@/stores/chat';
import { useConnection } from '@/stores/connection';

/** An open conversation with a message in it, on the current account. */
function openConversation() {
  const { accountId, mode } = useConnection.getState();
  const id = useChat.getState().newConversation(accountId, mode);
  useChat.getState().patch(id, () => ({ items: [{ id: 'm1' } as never] }));
  return id;
}

describe('startChat', () => {
  beforeEach(() => {
    useChat.getState().clearAll();
    vi.mocked(sendMessage).mockClear();
  });

  it('continues the open conversation when asked from the chat', () => {
    const id = openConversation();
    startChat('Næste spørgsmål');
    expect(vi.mocked(sendMessage).mock.calls[0]![0]).toBe(id);
    expect(useChat.getState().conversations).toHaveLength(1);
  });

  it('opens a new conversation when handed over from another page', () => {
    const id = openConversation();
    startChat('Lav en 1:1 matchup', [], { fresh: true });
    const used = vi.mocked(sendMessage).mock.calls[0]![0];
    expect(used).not.toBe(id);
    expect(useChat.getState().activeId).toBe(used);
    expect(useChat.getState().conversations).toHaveLength(2);
  });

  it('reuses an empty conversation instead of piling up new ones', () => {
    const { accountId, mode } = useConnection.getState();
    const empty = useChat.getState().newConversation(accountId, mode);
    startChat('Hej', [], { fresh: true });
    expect(vi.mocked(sendMessage).mock.calls[0]![0]).toBe(empty);
  });
});
