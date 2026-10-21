import { motion } from 'motion/react';
import { AlertTriangle, ArrowRight, Check, Copy, FileText, Info, OctagonX, Sparkles } from 'lucide-react';
import { memo, useState } from 'react';
import { MiniOrb, ShinyText } from '@/components/reactbits';
import { VisualBlock } from '@/components/blocks/VisualBlock';
import { EASE } from '@/components/motion';
import { modelInfo } from '@/ai/models';
import { BrandIcon } from '@/components/brand/BrandIcon';
import { TERMINAL_TOOLS } from '@/ai/tools';
import type { SuggestionItem } from '@/ai/visuals';
import { formatBytes } from '@/lib/attachments';
import { fmtTime, fmtUsd } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { AssistantItem, NoticePart, Part, ToolPart, UserItem } from '@/stores/chat';
import { ApprovalCard } from './ApprovalCard';
import { FollowUpCard } from './FollowUpCard';
import { Markdown } from './Markdown';
import { startChat } from './startChat';
import { ThinkingBlock } from './ThinkingBlock';
import { ToolSteps } from './ToolSteps';
import { withoutToolNames } from './toolNames';

export const UserMessage = memo(function UserMessage({ item }: { item: UserItem }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.35, ease: EASE }}
      className="flex flex-col items-end gap-2"
    >
      {item.attachments && item.attachments.length > 0 && (
        <div className="flex max-w-[78%] flex-wrap justify-end gap-2">
          {item.attachments.map((a) =>
            a.thumb ? (
              <img key={a.id} src={a.thumb} alt={a.name} title={a.name} className="size-20 rounded-xl border border-line object-cover" />
            ) : (
              <span key={a.id} className="flex h-12 max-w-[220px] items-center gap-2 rounded-xl border border-line bg-surface px-3 text-[12.5px]" title={a.name}>
                <FileText className={cn('size-4 shrink-0', a.kind === 'pdf' ? 'text-negative' : 'text-brand')} />
                <span className="min-w-0">
                  <span className="block truncate font-medium text-ink">{a.name}</span>
                  <span className="block text-[11px] text-muted">{formatBytes(a.size)}</span>
                </span>
              </span>
            ),
          )}
        </div>
      )}
      {item.text && (
        <div className="min-w-0 max-w-[78%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-line-2 px-4 py-2.5 text-[15px] leading-relaxed text-ink [overflow-wrap:anywhere]" data-selectable>
          {item.text}
        </div>
      )}
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
    // The follow-up tool is rendered as its suggestions block, not as a step.
    if (p.type === 'tool' && TERMINAL_TOOLS.has(p.name)) continue;
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

function Suggestions({ question, items, active }: { question: string; items: SuggestionItem[]; active: boolean }) {
  const [picked, setPicked] = useState<string | null>(null);
  const primary = items.filter((i) => i.primary).slice(0, 1);
  const rest = items.filter((i) => !primary.includes(i));
  const pick = (s: SuggestionItem) => {
    if (!active || picked) return;
    setPicked(s.label);
    startChat(s.prompt);
  };
  const disabled = !active || !!picked;
  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: EASE }} className="grid gap-2.5 pt-1">
      <div className="text-[14px] font-medium text-ink">{question}</div>
      {primary.map((s) => (
        <button
          key={s.label}
          type="button"
          disabled={disabled}
          onClick={() => pick(s)}
          className={cn(
            'group flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-[14px] font-medium transition-[background-color,box-shadow,opacity]',
            disabled ? 'bg-line-2 text-muted' : 'bg-ink text-white shadow-[0_8px_24px_-12px_rgb(18_18_22/0.5)] hover:bg-brand',
            picked === s.label && 'bg-brand-50 text-brand',
          )}
        >
          <Sparkles className="size-4 shrink-0" />
          <span className="min-w-0 flex-1">{s.label}</span>
          <ArrowRight className="size-4 shrink-0 transition-transform group-hover:translate-x-0.5" />
        </button>
      ))}
      {rest.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {rest.map((s) => (
            <button
              key={s.label}
              type="button"
              disabled={disabled}
              onClick={() => pick(s)}
              className={cn(
                'max-w-full rounded-full border px-3.5 py-1.5 text-left text-[13px] transition-colors',
                picked === s.label ? 'border-brand/40 bg-brand-50 text-brand' : disabled ? 'border-line text-subtle' : 'border-line bg-surface text-ink-2 hover:border-brand/40 hover:text-ink',
              )}
            >
              {s.label}
            </button>
          ))}
        </div>
      )}
    </motion.div>
  );
}

export const AssistantMessage = memo(function AssistantMessage({ item, currency, isLast }: { item: AssistantItem; currency: string; isLast: boolean }) {
  const live = item.status === 'streaming';
  const groups = groupParts(item.parts);
  const text = withoutToolNames(
    item.parts
      .filter((p) => p.type === 'text')
      .map((p) => (p as { text: string }).text)
      .join('\n\n'),
  );
  const lastPart = item.parts[item.parts.length - 1];
  const waitingForFirst = live && (!lastPart || (lastPart.type === 'tool' && lastPart.status !== 'running' && lastPart.status !== 'streaming' && lastPart.status !== 'awaiting_approval'));

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: EASE }} className="group flex gap-3.5">
      <div className="pt-0.5">
        <MiniOrb size={26} active={live} animated={live} />
      </div>
      <div className="grid min-w-0 flex-1 gap-3">
        {groups.map((g, i) =>
          g.kind === 'steps' ? (
            <ToolSteps key={g.parts[0]!.id} parts={g.parts} currency={currency} />
          ) : g.part.type === 'text' ? (
            withoutToolNames(g.part.text).trim() ? (
              <div key={g.part.id} className={cn(live && i === groups.length - 1 && 'streaming-caret')}>
                <Markdown text={withoutToolNames(g.part.text)} />
              </div>
            ) : null
          ) : g.part.type === 'thinking' ? (
            <ThinkingBlock key={g.part.id} part={g.part} live={live} />
          ) : g.part.type === 'tool' ? (
            <ApprovalCard key={g.part.id} part={g.part} currency={currency} />
          ) : g.part.type === 'visual' && g.part.visual.type === 'suggestions' ? (
            <Suggestions key={g.part.id} question={g.part.visual.question} items={g.part.visual.items} active={isLast && !live} />
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
        {item.status === 'done' && <FollowUpCard item={item} />}
        {!live && (
          <div className="flex items-center gap-2 text-[11.5px] text-subtle opacity-0 transition-opacity group-hover:opacity-100">
            <span>{fmtTime(item.ts)}</span>
            <span>·</span>
            <span className="inline-flex items-center gap-1">
              <BrandIcon brand={modelInfo(item.model).provider === 'google' ? 'gemini' : 'claude'} className="size-3" />
              {modelInfo(item.model).label}
            </span>
            {item.costUsd !== undefined && item.costUsd > 0 && (
              <>
                <span>·</span>
                <span title="Anslået pris for AI-forbruget i dette svar">≈ {fmtUsd(item.costUsd)}</span>
              </>
            )}
            {text && <CopyButton text={text} />}
          </div>
        )}
      </div>
    </motion.div>
  );
});
