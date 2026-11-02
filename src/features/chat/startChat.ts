import { sendMessage } from '@/ai/agent';
import type { Attachment } from '@/lib/attachments';
import { useChat } from '@/stores/chat';
import { useConnection } from '@/stores/connection';
import { useDraftFocus } from './focus';

/**
 * Sends a message to the assistant. `fresh`: handed over from another page (audit, dashboard,
 * campaigns …) – it gets a conversation of its own instead of landing in the open one.
 */
export function startChat(text: string, attachments: Attachment[] = [], { fresh = false }: { fresh?: boolean } = {}) {
  const chat = useChat.getState();
  const { accountId, mode } = useConnection.getState();
  let id = chat.activeId;
  const active = chat.conversations.find((c) => c.id === id);
  // A conversation belongs to one account/mode – start a new one if those changed.
  if (!active || (active.items.length > 0 && (fresh || active.accountId !== accountId || active.mode !== mode))) {
    id = chat.newConversation(accountId, mode);
  }
  // The focus picked before the first message belongs to this conversation.
  const conv = useChat.getState().conversations.find((c) => c.id === id);
  if (conv && !conv.items.length) {
    useChat.getState().patch(id!, () => ({ focus: useDraftFocus.getState().focus }));
    useDraftFocus.getState().set(null);
  }
  void sendMessage(id!, text, attachments);
}
