import { memo, useMemo } from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { openExternal } from '@/lib/platform';

const PLUGINS = [remarkGfm];

const COMPONENTS: Components = {
  a: ({ href, children }) => (
    <a
      href={href}
      onClick={(e) => {
        e.preventDefault();
        if (href && /^https?:\/\//.test(href)) void openExternal(href);
      }}
    >
      {children}
    </a>
  ),
  table: ({ children }) => (
    <div className="overflow-x-auto">
      <table>{children}</table>
    </div>
  ),
};

/**
 * Splits markdown at blank lines into blocks that can be parsed on their own. While an
 * answer streams only its last block changes, so only that one is parsed again instead
 * of the whole answer on every update. Code fences and indented continuations (a list
 * item's second paragraph) stay with the block before them.
 */
export function splitBlocks(text: string): string[] {
  const blocks: string[] = [];
  let current: string[] = [];
  let fence: string | null = null;
  let blank = false;
  for (const line of text.split('\n')) {
    const marker = /^\s*(`{3,}|~{3,})/.exec(line)?.[1];
    if (fence) {
      if (marker && marker[0] === fence[0] && marker.length >= fence.length) fence = null;
      current.push(line);
      continue;
    }
    if (!line.trim()) {
      blank = true;
      current.push(line);
      continue;
    }
    if (blank && current.some((l) => l.trim()) && !/^\s/.test(line)) {
      blocks.push(current.join('\n'));
      current = [];
    }
    blank = false;
    if (marker) fence = marker;
    current.push(line);
  }
  if (current.length) blocks.push(current.join('\n'));
  return blocks;
}

const Block = memo(function Block({ text }: { text: string }) {
  return (
    <ReactMarkdown remarkPlugins={PLUGINS} components={COMPONENTS}>
      {text}
    </ReactMarkdown>
  );
});

export const Markdown = memo(function Markdown({ text }: { text: string }) {
  const blocks = useMemo(() => splitBlocks(text), [text]);
  return (
    <div className="prose-chat" data-selectable>
      {blocks.map((b, i) => (
        <Block key={i} text={b} />
      ))}
    </div>
  );
});
