/**
 * The campaign (and ad group) a conversation works on, picked in the chat field.
 * Before the first message there is no conversation yet – the pick waits here.
 */
import { create } from 'zustand';
import { useChat, type ChatFocus } from '@/stores/chat';

export const useDraftFocus = create<{ focus: ChatFocus | null; set: (focus: ChatFocus | null) => void }>((set) => ({
  focus: null,
  set: (focus) => set({ focus }),
}));

/** The conversation the next message goes to, if it has started. */
function startedConversation() {
  const { conversations, activeId } = useChat.getState();
  const c = conversations.find((x) => x.id === activeId);
  return c && c.items.length > 0 ? c : null;
}

export function useFocus(): ChatFocus | null {
  const conv = useChat((s) => {
    const c = s.conversations.find((x) => x.id === s.activeId);
    return c && c.items.length > 0 ? c : null;
  });
  const draft = useDraftFocus((s) => s.focus);
  return conv ? (conv.focus ?? null) : draft;
}

export function setFocus(focus: ChatFocus | null) {
  const conv = startedConversation();
  if (conv) useChat.getState().patch(conv.id, () => ({ focus }));
  else useDraftFocus.getState().set(focus);
}
