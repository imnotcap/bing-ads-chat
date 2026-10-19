import { beforeEach, describe, expect, it, vi } from 'vitest';

const sent: { convId: string; text: string; opts?: { interrupted?: boolean } }[] = [];
const stopped: string[] = [];
vi.mock('@/ai/agent', () => ({
  sendMessage: async (convId: string, text: string, _a: unknown, opts?: { interrupted?: boolean }) => void sent.push({ convId, text, opts }),
  stopConversation: (convId: string) => void stopped.push(convId),
}));

const { useChat } = await import('@/stores/chat');
const { enqueue, removeQueued, sendQueuedNow, useQueue } = await import('@/features/chat/queue');
const tick = () => new Promise((r) => setTimeout(r, 0));

describe('message queue', () => {
  beforeEach(() => {
    sent.length = 0;
    stopped.length = 0;
    useQueue.setState({ byConv: {} });
    useChat.getState().setRunning('c1', false);
  });

  it('sends queued messages one by one when the answer is done', async () => {
    useChat.getState().setRunning('c1', true);
    enqueue('c1', 'første', []);
    enqueue('c1', 'anden', []);
    expect(sent).toEqual([]);
    useChat.getState().setRunning('c1', false);
    await tick();
    expect(sent.map((s) => s.text)).toEqual(['første']);
    expect(useQueue.getState().byConv.c1!.map((m) => m.text)).toEqual(['anden']);
    // The next one goes when that answer is done too.
    useChat.getState().setRunning('c1', true);
    useChat.getState().setRunning('c1', false);
    await tick();
    expect(sent.map((s) => s.text)).toEqual(['første', 'anden']);
  });

  it('"Send nu" stops the answer and sends that message first, marked as an interruption', async () => {
    useChat.getState().setRunning('c1', true);
    enqueue('c1', 'a', []);
    enqueue('c1', 'b', []);
    const b = useQueue.getState().byConv.c1![1]!;
    sendQueuedNow('c1', b.id);
    expect(stopped).toEqual(['c1']);
    useChat.getState().setRunning('c1', false);
    await tick();
    expect(sent).toEqual([{ convId: 'c1', text: 'b', opts: { interrupted: true } }]);
    expect(useQueue.getState().byConv.c1!.map((m) => m.text)).toEqual(['a']);
  });

  it('a removed message is never sent', async () => {
    useChat.getState().setRunning('c1', true);
    enqueue('c1', 'fortrudt', []);
    removeQueued('c1', useQueue.getState().byConv.c1![0]!.id);
    useChat.getState().setRunning('c1', false);
    await tick();
    expect(sent).toEqual([]);
  });
});
