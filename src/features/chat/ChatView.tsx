import { AnimatePresence, motion } from 'motion/react';
import { ArrowDown, Upload } from '@/components/icons';
import { useCallback, useEffect, useRef, useState } from 'react';
import { stopConversation } from '@/ai/agent';
import type { Attachment } from '@/lib/attachments';
import { cn } from '@/lib/utils';
import { useActiveConversation, useChat } from '@/stores/chat';
import { startChat } from './startChat';
import { useConnection, useCurrentAccount } from '@/stores/connection';
import { Composer, type ComposerHandle } from './Composer';
import { enqueue } from './queue';
import { QueueList } from './QueueList';
import { EmptyState } from './EmptyState';
import { AssistantMessage, UserMessage } from './Messages';

export { startChat } from './startChat';

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
  const composer = useRef<ComposerHandle>(null);
  const [dragging, setDragging] = useState(false);
  const dragDepth = useRef(0);
  const items = conversation?.items ?? [];
  const lastItem = items[items.length - 1];
  const tick = lastItem?.kind === 'assistant' ? JSON.stringify(lastItem.parts.map((p) => (p.type === 'text' || p.type === 'thinking' ? p.text.length : p.type === 'tool' ? p.status : p.id))) : items.length;
  const { ref, onScroll, showButton, scrollToBottom } = useStickToBottom(`${conversation?.id}:${items.length}:${tick}`);
  const currency = account?.currency ?? 'DKK';
  const empty = items.length === 0;

  // Stable callbacks: the memoized composer then skips the re-renders a streaming answer causes.
  const convId = conversation?.id;
  const onQueue = useCallback((text: string, attachments: Attachment[]) => convId && enqueue(convId, text, attachments), [convId]);
  const onStop = useCallback(() => convId && stopConversation(convId), [convId]);

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

      <div ref={ref} onScroll={onScroll} className="relative z-0 flex-1 overflow-y-auto overflow-x-hidden">
        {empty ? (
          <EmptyState onPick={(p) => startChat(p)} />
        ) : (
          <div className="fit-width mx-auto grid w-full max-w-[760px] gap-7 px-6 pb-10 pt-8">
            {items.map((it, i) => (
              // Older messages are skipped by layout and paint while off screen, so a long
              // conversation stays as fast as a short one while an answer streams in.
              <div key={it.id} id={`msg-${it.id}`} className={cn(i < items.length - 2 && 'offscreen-skip')}>
                {it.kind === 'user' ? <UserMessage item={it} /> : <AssistantMessage item={it} currency={currency} isLast={i === items.length - 1} />}
              </div>
            ))}
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
        <QueueList convId={conversation?.id ?? null} />
        <Composer
          ref={composer}
          running={running}
          disabled={!hasKey}
          onSend={startChat}
          onQueue={onQueue}
          onStop={onStop}
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
