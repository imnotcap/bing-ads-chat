import { useEffect } from 'react';
import { useChat } from '@/stores/chat';
import { useUi } from '@/stores/ui';

/** Records view/conversation changes so the top bar's back/forward buttons work. */
export function useNavigationHistory() {
  const view = useUi((s) => s.view);
  const activeId = useChat((s) => s.activeId);
  const boardId = useUi((s) => s.boardId);
  useEffect(() => {
    useUi.getState().record({ view, conversationId: view === 'chat' ? activeId : null, boardId: view === 'board' ? boardId : null });
  }, [view, activeId, boardId]);
}

export function navigate(delta: -1 | 1) {
  const entry = useUi.getState().move(delta);
  if (!entry) return;
  if (entry.view === 'chat') {
    const exists = useChat.getState().conversations.some((c) => c.id === entry.conversationId);
    useChat.getState().select(exists ? entry.conversationId : null);
  }
}
