/**
 * Some models write a tool's name into the reply before calling it ("suggest_next_steps:").
 * The user never sees tools, so such lines are left out of what is shown and copied.
 */
import { ALL_TOOLS } from '@/ai/tools';

const NAMES = [...ALL_TOOLS.map((t) => t.name), 'web_search', 'web_fetch'];
const LINE = new RegExp(`^[ \\t]*[\`*_]*(?:${NAMES.join('|')})(?:\\(.*\\))?[\`*_]*[ \\t]*:?[ \\t]*[\`*_]*[ \\t]*(?:\\n|$)`, 'gm');

export function withoutToolNames(text: string): string {
  return text.replace(LINE, '').replace(/\n{3,}/g, '\n\n');
}
