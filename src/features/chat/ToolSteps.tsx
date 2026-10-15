/** Compact, expandable timeline of the read/display tools the assistant used. */
import { AnimatePresence, motion } from 'motion/react';
import { AlertCircle, Check, ChevronRight, Loader2, Square } from 'lucide-react';
import { useState } from 'react';
import { ShinyText } from '@/components/reactbits';
import { TableBlock } from '@/components/blocks/TableBlock';
import { EASE } from '@/components/motion';
import { cn } from '@/lib/utils';
import type { ToolPart } from '@/stores/chat';

function StatusIcon({ status }: { status: ToolPart['status'] }) {
  if (status === 'running' || status === 'streaming') return <Loader2 className="size-3.5 animate-spin text-brand" />;
  if (status === 'error') return <AlertCircle className="size-3.5 text-negative" />;
  if (status === 'stopped') return <Square className="size-3 text-subtle" />;
  return (
    <span className="grid size-4 place-items-center rounded-full bg-positive-bg">
      <Check className="size-2.5 text-positive" strokeWidth={3} />
    </span>
  );
}

function Step({ part, currency }: { part: ToolPart; currency: string }) {
  const [open, setOpen] = useState(false);
  const busy = part.status === 'running' || part.status === 'streaming';
  const expandable = !!part.preview?.rows.length || !!part.error || (!!part.input && Object.keys(part.input as object).length > 0);
  const secs = part.endedAt ? ((part.endedAt - part.startedAt) / 1000).toFixed(1).replace('.', ',') : null;
  return (
    <li className="relative">
      <button
        type="button"
        onClick={() => expandable && setOpen((o) => !o)}
        className={cn('flex w-full items-center gap-2.5 rounded-xl px-2.5 py-1.5 text-left text-[13px] transition-colors', expandable && 'hover:bg-line-2')}
      >
        <span className="grid size-4 place-items-center">
          <StatusIcon status={part.status} />
        </span>
        <span className={cn('font-medium', part.status === 'error' ? 'text-negative' : 'text-ink-2')}>
          {busy ? <ShinyText>{part.label} …</ShinyText> : part.label}
        </span>
        {part.summary && !busy && <span className="truncate text-muted">· {part.summary}</span>}
        {part.error && <span className="truncate text-negative/80">· {part.error}</span>}
        <span className="ml-auto flex items-center gap-2 pl-2 text-[11.5px] text-subtle">
          {secs && `${secs} s`}
          {expandable && <ChevronRight className={cn('size-3.5 transition-transform', open && 'rotate-90')} />}
        </span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: EASE }}
            className="overflow-hidden"
          >
            <div className="grid gap-2 px-2.5 pb-2.5 pl-9 pt-1">
              {part.preview && part.preview.rows.length > 0 && (
                <TableBlock columns={part.preview.columns} rows={part.preview.rows} total={part.preview.total} currency={currency} maxHeight={260} dense />
              )}
              {part.error && <div className="rounded-xl bg-negative-bg px-3 py-2 text-[12.5px] text-negative">{part.error}</div>}
              <details className="text-[12px] text-muted">
                <summary className="cursor-pointer select-none hover:text-ink">Teknisk input</summary>
                <pre className="mt-1 max-h-48 overflow-auto rounded-xl bg-line-2 p-2.5 text-[11.5px] text-ink-2" data-selectable>
                  {JSON.stringify(part.input, null, 2)}
                </pre>
              </details>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </li>
  );
}

export function ToolSteps({ parts, currency }: { parts: ToolPart[]; currency: string }) {
  return (
    <motion.ul
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: EASE }}
      className="grid gap-0.5 rounded-2xl border border-line/80 bg-white/60 p-1 backdrop-blur"
    >
      {parts.map((p) => (
        <Step key={p.id} part={p} currency={currency} />
      ))}
    </motion.ul>
  );
}
