/** Turns a conversation into Markdown for export and copying. */
import { formatBytes } from '@/lib/attachments';
import { fmtDateLong, fmtTime } from '@/lib/format';
import type { AssistantItem, Conversation, ToolPart } from '@/stores/chat';

const STATUS: Partial<Record<ToolPart['status'], string>> = {
  done: 'Gennemført',
  rejected: 'Afvist',
  blocked: 'Blokeret af forbrugsreglerne',
  error: 'Fejlede',
  stopped: 'Stoppet',
  awaiting_approval: 'Afventer godkendelse',
};

const value = (v: unknown) => (v === null || v === undefined || v === '' ? '–' : String(v).replace(/\|/g, '\\|'));

function changeMarkdown(p: ToolPart): string {
  const plan = p.plan!;
  const lines = [`**${plan.title}** – ${STATUS[p.status] ?? p.status}`];
  if (plan.reason) lines.push(`_${plan.reason}_`);
  lines.push('', '| Ændring | Før | Efter |', '|---|---|---|');
  for (const c of plan.changes) lines.push(`| ${value(c.field)} | ${value(c.before)} | ${value(c.after)} |`);
  return lines.join('\n');
}

/** Markdown of one assistant reply (text and changes; charts and tool steps are left out). */
export function assistantMarkdown(item: AssistantItem): string {
  const out: string[] = [];
  for (const p of item.parts) {
    if (p.type === 'text' && p.text.trim()) out.push(p.text.trim());
    else if (p.type === 'tool' && p.plan) out.push(changeMarkdown(p));
    else if (p.type === 'visual' && p.visual.type === 'file') out.push(`📎 ${p.visual.fileName}\n\n\`\`\`\n${p.visual.content}\n\`\`\``);
    else if (p.type === 'visual' && p.visual.type === 'suggestions') out.push(`_${p.visual.question}_\n${p.visual.items.map((i) => `- ${i.label}`).join('\n')}`);
    else if (p.type === 'notice') out.push(`> ${p.text}`);
  }
  return out.join('\n\n');
}

export function conversationMarkdown(c: Conversation): string {
  const out = [`# ${c.title}`, '', `_Eksporteret fra XavierOS · ${fmtDateLong(new Date().toISOString().slice(0, 10))}_`];
  for (const it of c.items) {
    if (it.kind === 'user') {
      out.push('', `## Dig · ${fmtTime(it.ts)}`, '', it.text.trim());
      if (it.attachments?.length) out.push('', ...it.attachments.map((a) => `- 📎 ${a.name} (${formatBytes(a.size)})`));
    } else {
      const body = assistantMarkdown(it);
      if (body) out.push('', `## Assistent · ${fmtTime(it.ts)}`, '', body);
    }
  }
  return out.join('\n') + '\n';
}

export function exportFileName(c: Conversation): string {
  const day = new Date().toISOString().slice(0, 10);
  return `${c.title.replace(/[\\/:*?"<>|]+/g, '-').slice(0, 80).trim() || 'Samtale'} ${day}.md`;
}
