import { sendMessage } from '@/ai/agent';
import type { Attachment } from '@/lib/attachments';
import { useChat } from '@/stores/chat';
import { useConnection } from '@/stores/connection';
import { useDraftFocus } from './focus';

export function startChat(text: string, attachments: Attachment[] = []) {
  const chat = useChat.getState();
  const { accountId, mode } = useConnection.getState();
  let id = chat.activeId;
  const active = chat.conversations.find((c) => c.id === id);
  // A conversation belongs to one account/mode – start a new one if those changed.
  if (!active || (active.items.length > 0 && (active.accountId !== accountId || active.mode !== mode))) {
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
