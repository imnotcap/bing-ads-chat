import { AnimatePresence, motion } from 'motion/react';
import { Brain, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { ShinyText } from '@/components/reactbits';
import type { ThinkingPart } from '@/stores/chat';
import { cn } from '@/lib/utils';
import { EASE } from '@/components/motion';

export function ThinkingBlock({ part, live }: { part: ThinkingPart; live: boolean }) {
  const [open, setOpen] = useState(false);
  const thinking = live && !part.endedAt;
  const secs = part.endedAt ? Math.max(1, Math.round((part.endedAt - part.startedAt) / 1000)) : null;
  const hasText = part.text.trim().length > 0;
  return (
    <div className="text-[13px]">
      <button
        type="button"
        onClick={() => hasText && setOpen((o) => !o)}
        className={cn('inline-flex items-center gap-1.5 rounded-lg py-1 text-muted transition-colors', hasText && 'hover:text-ink')}
      >
        <Brain className="size-3.5" />
        {thinking ? <ShinyText className="font-medium">Tænker …</ShinyText> : <span>Tænkte{secs ? ` i ${secs} sek.` : ''}</span>}
        {hasText && <ChevronRight className={cn('size-3.5 transition-transform', open && 'rotate-90')} />}
      </button>
      <AnimatePresence initial={false}>
        {(open || (thinking && hasText)) && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: EASE }}
            className="overflow-hidden"
          >
            <div
              className={cn(
                'mt-1 whitespace-pre-wrap border-l-2 border-violet/25 pl-3 leading-relaxed text-muted',
                thinking && !open && 'max-h-24 overflow-hidden [mask-image:linear-gradient(to_bottom,transparent,black_40%)]',
              )}
              data-selectable
            >
              {thinking && !open ? part.text.slice(-600) : part.text}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
