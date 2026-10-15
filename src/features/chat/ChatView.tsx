import { AnimatePresence, motion } from 'motion/react';
import { ArrowDown, PanelRight, PanelRightClose, SquarePen } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { sendMessage, stopConversation } from '@/ai/agent';
import { Aurora } from '@/components/reactbits';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/controls';
import { Tooltip } from '@/components/ui/overlays';
import { useActiveConversation, useChat } from '@/stores/chat';
import { useConnection, useCurrentAccount } from '@/stores/connection';
import { useSettings } from '@/stores/settings';
import { Composer } from './Composer';
import { EmptyState } from './EmptyState';
import { AssistantMessage, UserMessage } from './Messages';

export function startChat(text: string) {
  const chat = useChat.getState();
  const { accountId, mode } = useConnection.getState();
  let id = chat.activeId;
  const active = chat.conversations.find((c) => c.id === id);
  // A conversation belongs to one account/mode – start a new one if those changed.
  if (!active || (active.items.length > 0 && (active.accountId !== accountId || active.mode !== mode))) {
    id = chat.newConversation(accountId, mode);
  }
  void sendMessage(id!, text);
}

/** Keeps the view pinned to the newest message unless the user scrolled up. */
function useStickToBottom(dep: unknown) {
  const ref = useRef<HTMLDivElement>(null);
  const pinned = useRef(true);
  const [showButton, setShowButton] = useState(false);
  const onScroll = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const near = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
    pinned.current = near;
    setShowButton(!near);
  }, []);
  const scrollToBottom = useCallback((smooth = true) => {
    const el = ref.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: smooth ? 'smooth' : 'auto' });
  }, []);
  useEffect(() => {
    if (pinned.current) scrollToBottom(false);
  }, [dep, scrollToBottom]);
  return { ref, onScroll, showButton, scrollToBottom };
}

export function ChatView() {
  const conversation = useActiveConversation();
  const running = useChat((s) => (conversation ? !!s.running[conversation.id] : false));
  const newConversation = useChat((s) => s.newConversation);
  const account = useCurrentAccount();
  const mode = useConnection((s) => s.mode);
  const hasKey = useConnection((s) => s.hasAnthropicKey);
  const aurora = useSettings((s) => s.appearance.auroraBackground);
  const insights = useSettings((s) => s.appearance.insightsPanel);
  const setAppearance = useSettings((s) => s.setAppearance);
  const items = conversation?.items ?? [];
  const lastItem = items[items.length - 1];
  const tick = lastItem?.kind === 'assistant' ? JSON.stringify(lastItem.parts.map((p) => (p.type === 'text' || p.type === 'thinking' ? p.text.length : p.type === 'tool' ? p.status : p.id))) : items.length;
  const { ref, onScroll, showButton, scrollToBottom } = useStickToBottom(`${conversation?.id}:${items.length}:${tick}`);
  const currency = account?.currency ?? 'DKK';
  const empty = items.length === 0;

  return (
    <div className="relative flex h-full min-w-0 flex-1 flex-col overflow-hidden">
      {aurora && <Aurora className="h-[460px] [mask-image:linear-gradient(to_bottom,black_30%,transparent)]" intensity={empty ? 0.6 : 0.32} />}

      <header className="relative z-10 flex h-16 shrink-0 items-center gap-3 px-6">
        <div className="min-w-0 flex-1">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div key={conversation?.id ?? 'new'} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} className="flex items-center gap-2.5">
              <h2 className="truncate text-[15px] font-semibold text-ink">{empty ? 'Ny samtale' : conversation?.title}</h2>
              {mode === 'demo' && <Badge tone="violet">Demo-konto</Badge>}
            </motion.div>
          </AnimatePresence>
        </div>
        {!empty && (
          <Button size="sm" variant="secondary" onClick={() => newConversation(useConnection.getState().accountId, mode)}>
            <SquarePen /> Ny samtale
          </Button>
        )}
        <Tooltip content={insights ? 'Skjul indsigtspanel' : 'Vis indsigtspanel'}>
          <Button size="icon-sm" variant="ghost" onClick={() => setAppearance({ insightsPanel: !insights })} aria-label="Indsigtspanel">
            {insights ? <PanelRightClose /> : <PanelRight />}
          </Button>
        </Tooltip>
      </header>

      <div ref={ref} onScroll={onScroll} className="relative z-0 flex-1 overflow-y-auto">
        {empty ? (
          <EmptyState onPick={startChat} running={running} />
        ) : (
          <div className="mx-auto grid w-full max-w-[800px] gap-7 px-6 pb-10 pt-4">
            {items.map((it) => (it.kind === 'user' ? <UserMessage key={it.id} item={it} /> : <AssistantMessage key={it.id} item={it} currency={currency} />))}
          </div>
        )}
      </div>

      <div className="relative z-10 mx-auto w-full max-w-[840px] px-6 pb-5">
        <AnimatePresence>
          {showButton && !empty && (
            <motion.button
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              onClick={() => scrollToBottom()}
              className="absolute -top-12 left-1/2 grid size-9 -translate-x-1/2 place-items-center rounded-full border border-line bg-white text-ink-2 shadow-pop"
              aria-label="Rul til bunden"
            >
              <ArrowDown className="size-4" />
            </motion.button>
          )}
        </AnimatePresence>
        <Composer running={running} disabled={!hasKey} onSend={startChat} onStop={() => conversation && stopConversation(conversation.id)} />
        <p className="mt-2 text-center text-[11.5px] text-subtle">
          Assistenten kan tage fejl. Ændringer følger dine forbrugsregler og kan fortrydes under Aktivitet.
        </p>
      </div>
    </div>
  );
}
