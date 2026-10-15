import { sendMessage } from '@/ai/agent';
import type { Attachment } from '@/lib/attachments';
import { useChat } from '@/stores/chat';
import { useConnection } from '@/stores/connection';

export function startChat(text: string, attachments: Attachment[] = []) {
  const chat = useChat.getState();
  const { accountId, mode } = useConnection.getState();
  let id = chat.activeId;
  const active = chat.conversations.find((c) => c.id === id);
  // A conversation belongs to one account/mode – start a new one if those changed.
  if (!active || (active.items.length > 0 && (active.accountId !== accountId || active.mode !== mode))) {
    id = chat.newConversation(accountId, mode);
  }
  void sendMessage(id!, text, attachments);
}
