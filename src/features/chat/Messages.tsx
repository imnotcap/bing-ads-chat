import { motion } from 'motion/react';
import { AlertTriangle, Check, Copy, Info, OctagonX } from 'lucide-react';
import { memo, useState } from 'react';
import { MiniOrb, ShinyText } from '@/components/reactbits';
import { VisualBlock } from '@/components/blocks/VisualBlock';
import { EASE } from '@/components/motion';
import { modelInfo } from '@/ai/models';
import { fmtTime, fmtUsd } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { AssistantItem, NoticePart, Part, ToolPart, UserItem } from '@/stores/chat';
import { ApprovalCard } from './ApprovalCard';
import { Markdown } from './Markdown';
import { ThinkingBlock } from './ThinkingBlock';
import { ToolSteps } from './ToolSteps';

export const UserMessage = memo(function UserMessage({ item }: { item: UserItem }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.35, ease: EASE }}
      className="flex justify-end"
    >
      <div
        className="max-w-[78%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-line-2 px-4 py-2.5 text-[15px] leading-relaxed text-ink"
        data-selectable
      >
        {item.text}
      </div>
    </motion.div>
  );
});

function NoticeLine({ part }: { part: NoticePart }) {
  const Icon = part.tone === 'error' ? OctagonX : part.tone === 'warning' ? AlertTriangle : Info;
  return (
    <div
      className={cn(
        'flex items-start gap-2 rounded-xl px-3 py-2 text-[13px]',
        part.tone === 'error' ? 'bg-negative-bg text-negative' : part.tone === 'warning' ? 'bg-warning-bg text-warning' : 'bg-brand-50 text-brand',
      )}
    >
      <Icon className="mt-0.5 size-4 shrink-0" />
      {part.text}
    </div>
  );
}

type Group = { kind: 'steps'; parts: ToolPart[] } | { kind: 'part'; part: Part };

/** Consecutive read/display tools are shown together as one steps card. */
function groupParts(parts: Part[]): Group[] {
  const out: Group[] = [];
  for (const p of parts) {
    const isStep = p.type === 'tool' && !p.plan;
    const last = out[out.length - 1];
    if (isStep && last?.kind === 'steps') last.parts.push(p as ToolPart);
    else if (isStep) out.push({ kind: 'steps', parts: [p as ToolPart] });
    else out.push({ kind: 'part', part: p });
  }
  return out;
}

function CopyButton({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        void navigator.clipboard.writeText(text);
        setDone(true);
        setTimeout(() => setDone(false), 1500);
      }}
      className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 transition-colors hover:bg-line-2 hover:text-ink"
    >
      {done ? <Check className="size-3" /> : <Copy className="size-3" />}
      {done ? 'Kopieret' : 'Kopiér'}
    </button>
  );
}

export const AssistantMessage = memo(function AssistantMessage({ item, currency }: { item: AssistantItem; currency: string }) {
  const live = item.status === 'streaming';
  const groups = groupParts(item.parts);
  const text = item.parts
    .filter((p) => p.type === 'text')
    .map((p) => (p as { text: string }).text)
    .join('\n\n');
  const lastPart = item.parts[item.parts.length - 1];
  const waitingForFirst = live && (!lastPart || (lastPart.type === 'tool' && lastPart.status !== 'running' && lastPart.status !== 'streaming' && lastPart.status !== 'awaiting_approval'));

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: EASE }} className="group flex gap-3.5">
      <div className="pt-0.5">
        <MiniOrb size={26} active={live} />
      </div>
      <div className="grid min-w-0 flex-1 gap-3">
        {groups.map((g, i) =>
          g.kind === 'steps' ? (
            <ToolSteps key={g.parts[0]!.id} parts={g.parts} currency={currency} />
          ) : g.part.type === 'text' ? (
            g.part.text.trim() ? (
              <div key={g.part.id} className={cn(live && i === groups.length - 1 && 'streaming-caret')}>
                <Markdown text={g.part.text} />
              </div>
            ) : null
          ) : g.part.type === 'thinking' ? (
            <ThinkingBlock key={g.part.id} part={g.part} live={live} />
          ) : g.part.type === 'tool' ? (
            <ApprovalCard key={g.part.id} part={g.part} currency={currency} />
          ) : g.part.type === 'visual' ? (
            <motion.div key={g.part.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: EASE }}>
              <VisualBlock visual={g.part.visual} currency={currency} />
            </motion.div>
          ) : (
            <NoticeLine key={g.part.id} part={g.part} />
          ),
        )}
        {waitingForFirst && (
          <div className="py-1 text-[14px]">
            <ShinyText className="font-medium">{item.parts.length ? 'Analyserer …' : 'Et øjeblik …'}</ShinyText>
          </div>
        )}
        {item.status === 'error' && item.error && <NoticeLine part={{ type: 'notice', id: 'err', tone: 'error', text: item.error }} />}
        {item.status === 'stopped' && <div className="text-[12.5px] text-muted">Stoppet.</div>}
        {!live && (
          <div className="flex items-center gap-2 text-[11.5px] text-subtle opacity-0 transition-opacity group-hover:opacity-100">
            <span>{fmtTime(item.ts)}</span>
            <span>·</span>
            <span>{modelInfo(item.model).label}</span>
            {item.costUsd !== undefined && item.costUsd > 0 && (
              <>
                <span>·</span>
                <span title="Anslået pris for Claude API-forbruget i dette svar">≈ {fmtUsd(item.costUsd)}</span>
              </>
            )}
            {text && <CopyButton text={text} />}
          </div>
        )}
      </div>
    </motion.div>
  );
});
