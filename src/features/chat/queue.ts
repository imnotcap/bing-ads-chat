/**
 * Messages written while the assistant is still answering: they wait in a queue above
 * the chat field and are sent one by one when the answer is done. "Send nu" stops the
 * current answer and sends the message at once – the assistant is told it was
 * interrupted, so it keeps the first question in mind.
 */
import { create } from 'zustand';
import { sendMessage, stopConversation } from '@/ai/agent';
import type { Attachment } from '@/lib/attachments';
import { uid } from '@/lib/utils';
import { useChat } from '@/stores/chat';

export interface QueuedMessage {
  id: string;
  text: string;
  attachments: Attachment[];
  /** Sent by "Send nu": goes first and tells the assistant it was interrupted. */
  now?: boolean;
}

interface QueueState {
  byConv: Record<string, QueuedMessage[]>;
  set: (convId: string, list: QueuedMessage[]) => void;
}

export const useQueue = create<QueueState>((set) => ({
  byConv: {},
  set: (convId, list) => set((s) => ({ byConv: { ...s.byConv, [convId]: list } })),
}));

const list = (convId: string) => useQueue.getState().byConv[convId] ?? [];

export function enqueue(convId: string, text: string, attachments: Attachment[]) {
  useQueue.getState().set(convId, [...list(convId), { id: uid('q_'), text, attachments }]);
}

export function removeQueued(convId: string, id: string) {
  useQueue.getState().set(
    convId,
    list(convId).filter((m) => m.id !== id),
  );
}

/** Stops the current answer; the message is sent as soon as the stop has gone through. */
export function sendQueuedNow(convId: string, id: string) {
  const msg = list(convId).find((m) => m.id === id);
  if (!msg) return;
  useQueue.getState().set(convId, [{ ...msg, now: true }, ...list(convId).filter((m) => m.id !== id)]);
  if (useChat.getState().running[convId]) stopConversation(convId);
  else flush(convId);
}

function flush(convId: string) {
  const [next, ...rest] = list(convId);
  if (!next || useChat.getState().running[convId]) return;
  useQueue.getState().set(convId, rest);
  void sendMessage(convId, next.text, next.attachments, { interrupted: next.now });
}

// When an answer finishes (or is stopped), the next queued message goes out.
let wasRunning: Record<string, boolean> = {};
useChat.subscribe((s) => {
  const now = s.running;
  for (const convId of Object.keys(wasRunning)) {
    if (wasRunning[convId] && !now[convId] && list(convId).length) queueMicrotask(() => flush(convId));
  }
  wasRunning = { ...now };
});
