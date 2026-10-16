/**
 * "/test": tries the follow-up without Microsoft Advertising and without the AI – a
 * local reply with the follow-up card, so the planning card, the Outlook reminder
 * and the mail can be checked. Nothing is sent to the AI or changed on any account.
 */
import { uid } from '@/lib/utils';
import { useChat } from '@/stores/chat';
import { useConnection } from '@/stores/connection';
import { useSettings } from '@/stores/settings';
import { useUi } from '@/stores/ui';

export const TEST_COMMAND = '/test';

export function startFollowUpTest() {
  const chat = useChat.getState();
  const { accountId, mode } = useConnection.getState();
  const active = chat.conversations.find((c) => c.id === chat.activeId);
  const id = active ? active.id : chat.newConversation(accountId, mode);
  const now = Date.now();
  chat.patch(id, (c) => ({
    title: c.items.length ? c.title : 'Test af opfølgning',
    items: [
      ...c.items,
      { kind: 'user', id: uid('u_'), ts: now, text: TEST_COMMAND },
      {
        kind: 'assistant',
        id: uid('a_'),
        ts: now + 1,
        model: useSettings.getState().ai.model,
        status: 'done',
        test: true,
        parts: [
          {
            type: 'text',
            id: uid('t_'),
            text:
              '**Test af opfølgning – intet er ændret, og AI’en er ikke brugt.**\n\n' +
              'Vælg nedenfor, hvad opfølgningen skal lave:\n\n' +
              '- **Kort i Min planlægning** – din personlige tavle\n' +
              '- **Påmindelse i Outlook-kalenderen** – en begivenhed i din egen kalender\n' +
              '- **Mail til dig** – sendt fra din Outlook til din egen adresse',
          },
        ],
      },
    ],
  }));
  useUi.getState().go('chat');
}
