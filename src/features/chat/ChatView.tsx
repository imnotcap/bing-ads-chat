import { AnimatePresence, motion } from 'motion/react';
import { ArrowDown, Upload } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { sendMessage, stopConversation } from '@/ai/agent';
import { Aurora } from '@/components/reactbits';
import type { Attachment } from '@/lib/attachments';
import { useActiveConversation, useChat } from '@/stores/chat';
import { useConnection, useCurrentAccount } from '@/stores/connection';
import { useSettings } from '@/stores/settings';
import { Composer, type ComposerHandle } from './Composer';
import { EmptyState } from './EmptyState';
import { AssistantMessage, UserMessage } from './Messages';

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
  const account = useCurrentAccount();
  const hasKey = useConnection((s) => s.hasAnthropicKey);
  const aurora = useSettings((s) => s.appearance.auroraBackground);
  const composer = useRef<ComposerHandle>(null);
  const [dragging, setDragging] = useState(false);
  const dragDepth = useRef(0);
  const items = conversation?.items ?? [];
  const lastItem = items[items.length - 1];
  const tick = lastItem?.kind === 'assistant' ? JSON.stringify(lastItem.parts.map((p) => (p.type === 'text' || p.type === 'thinking' ? p.text.length : p.type === 'tool' ? p.status : p.id))) : items.length;
  const { ref, onScroll, showButton, scrollToBottom } = useStickToBottom(`${conversation?.id}:${items.length}:${tick}`);
  const currency = account?.currency ?? 'DKK';
  const empty = items.length === 0;

  const hasFiles = (e: React.DragEvent) => [...e.dataTransfer.types].includes('Files');

  return (
    <div
      className="relative flex h-full min-w-0 flex-1 flex-col overflow-hidden"
      onDragEnter={(e) => {
        if (!hasFiles(e) || !hasKey) return;
        dragDepth.current += 1;
        setDragging(true);
      }}
      onDragOver={(e) => hasFiles(e) && e.preventDefault()}
      onDragLeave={() => {
        dragDepth.current = Math.max(0, dragDepth.current - 1);
        if (!dragDepth.current) setDragging(false);
      }}
      onDrop={(e) => {
        if (!hasFiles(e)) return;
        e.preventDefault();
        dragDepth.current = 0;
        setDragging(false);
        if (hasKey) composer.current?.addFiles([...e.dataTransfer.files]);
      }}
    >
      {/* Soft static light from the top-right corner; the animated aurora is opt-in (Udseende). */}
      {!empty && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-60"
          style={{ background: 'radial-gradient(600px 380px at 100% 0%, rgb(139 123 255 / 0.14), transparent 70%)' }}
        />
      )}
      {aurora && <Aurora className="h-[420px] [mask-image:linear-gradient(to_bottom,black_30%,transparent)]" intensity={empty ? 0.45 : 0.25} />}

      <div ref={ref} onScroll={onScroll} className="relative z-0 flex-1 overflow-y-auto">
        {empty ? (
          <EmptyState onPick={(p) => startChat(p)} />
        ) : (
          <div className="mx-auto grid w-full max-w-[760px] gap-7 px-6 pb-10 pt-8">
            {items.map((it) => (it.kind === 'user' ? <UserMessage key={it.id} item={it} /> : <AssistantMessage key={it.id} item={it} currency={currency} />))}
          </div>
        )}
      </div>

      <div className="relative z-10 mx-auto w-full max-w-[800px] px-6 pb-5">
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
        <Composer
          ref={composer}
          running={running}
          disabled={!hasKey}
          onSend={(text, attachments) => startChat(text, attachments)}
          onStop={() => conversation && stopConversation(conversation.id)}
        />
      </div>

      <AnimatePresence>
        {dragging && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="pointer-events-none absolute inset-3 z-30 grid place-items-center rounded-3xl border-2 border-dashed border-brand/40 bg-brand-50/80 backdrop-blur-sm"
          >
            <div className="text-center">
              <Upload className="mx-auto size-7 text-brand" />
              <div className="mt-2 text-[15px] font-medium text-ink">Slip filerne for at vedhæfte dem</div>
              <div className="text-[12.5px] text-muted">Billeder, PDF, CSV og tekstfiler</div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
