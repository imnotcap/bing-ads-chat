/**
 * Danish proofreading of everything that goes into the account – keywords, ad texts,
 * names – before the approval card is shown. Two layers:
 * - a fixed list of German, Swedish and Norwegian look-alikes the models tend to use
 *   ("lagerregal" is German – in Danish it is "lagerreol"), checked without the AI
 * - a Claude proofreader for spelling and grammar ("stvålskabe" → "stålskabe")
 * Findings become a suggestion on the line, which the user applies with one click.
 */
import Anthropic from '@anthropic-ai/sdk';
import { sharedKey } from '@/workspace/shared';
import type { ChangePlan } from './guardrails';

export interface LanguageIssue {
  text: string;
  suggestion: string;
  reason: string;
}

/** Non-Danish words (as parts of words) and the Danish word to use instead. */
const FOREIGN: [RegExp, string | ((m: RegExpExecArray) => string), string][] = [
  // German plural "Regale" is Danish "reoler".
  [/regal(e[ns]?)?(?![\p{L}])|regal/iu, (m) => (m[1] ? 'reoler' : 'reol'), 'tysk "Regal"'],
  [/schrank|schränk/iu, 'skab', 'tysk'],
  [/werkzeug/iu, 'værktøj', 'tysk'],
  [/werkstatt/iu, 'værksted', 'tysk'],
  [/schreibtisch/iu, 'skrivebord', 'tysk'],
  [/stuhl|stühle/iu, 'stol', 'tysk'],
  [/skrivbord/iu, 'skrivebord', 'svensk'],
  [/hylla|hyllor/iu, 'hylde', 'svensk'],
  [/hylle(r)?(?![\p{L}])/iu, 'hylde', 'norsk'],
  [/verktøy|verktyg/iu, 'værktøj', 'norsk/svensk'],
  [/verksted|verkstad/iu, 'værksted', 'norsk/svensk'],
  [/kjøkken|kök(?![\p{L}])/iu, 'køkken', 'norsk/svensk'],
  [/förvaring|oppbevaring/iu, 'opbevaring', 'svensk/norsk'],
  [/kontorsstol|kontorstoler(?![\p{L}])/iu, 'kontorstol/kontorstole', 'svensk/norsk bøjning'],
];

/** Fixed look-alikes from other languages in one text. */
export function foreignWords(text: string): LanguageIssue | null {
  for (const [re, danish, lang] of FOREIGN) {
    const m = re.exec(text);
    if (!m) continue;
    const word = typeof danish === 'string' ? danish : danish(m);
    // Replace the matched part, keeping the rest of the word ("lagerregal" → "lagerreol").
    const suggestion = text.slice(0, m.index) + word + text.slice(m.index + m[0].length);
    return { text, suggestion, reason: `"${m[0]}" er ${lang} – på dansk hedder det "${word}".` };
  }
  return null;
}

const SCHEMA = {
  type: 'object',
  properties: {
    issues: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          index: { type: 'integer' },
          suggestion: { type: 'string' },
          reason: { type: 'string' },
        },
        required: ['index', 'suggestion', 'reason'],
        additionalProperties: false,
      },
    },
  },
  required: ['issues'],
  additionalProperties: false,
} as const;

const INSTRUCTIONS = `Du er korrekturlæser for danske Microsoft Advertising-tekster (søgeord, annonceoverskrifter, beskrivelser, kampagne- og annoncegruppenavne) for en dansk virksomhed, der sælger inventar.
Find KUN reelle fejl: stavefejl, forkerte bøjninger, grammatik, og ord fra andre sprog (tysk, svensk, norsk, engelsk), hvor der findes et almindeligt dansk ord (fx "lagerregal" → "lagerreol", "skrivbord" → "skrivebord").
Bevar alt andet: brands og produktnavne, dynamisk tekst i {krøllede parenteser}, tegn som | og ›, store/små bogstaver i navne, bevidst korte søgeord uden tegnsætning, og engelske ord der er almindelige i dansk (fx "outlet", "online").
Forslaget skal have samme længde ±5 tegn og må ikke ændre betydningen. Svar kun med fejlene (tom liste, hvis alt er korrekt).`;

/** The texts the assistant wrote for the account: editable lines and pick-table rows (not URLs, numbers or settings). */
function texts(plan: ChangePlan): { i: number; text: string }[] {
  return plan.changes.flatMap((c, i) =>
    (c.edit || plan.pick) && typeof c.after === 'string' && c.after.trim() && !/^https?:\/\//i.test(c.after) && /\p{L}/u.test(c.after) ? [{ i, text: c.after }] : [],
  );
}

async function claudeIssues(list: { i: number; text: string }[], signal?: AbortSignal): Promise<Map<number, LanguageIssue>> {
  const out = new Map<number, LanguageIssue>();
  const apiKey = await sharedKey('anthropic').catch(() => null);
  if (!apiKey || !list.length) return out;
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true, maxRetries: 1, baseURL: import.meta.env.VITE_ANTHROPIC_BASE_URL || undefined });
  const res = await client.messages.create(
    {
      model: 'claude-sonnet-5-5',
      max_tokens: 4000,
      system: INSTRUCTIONS,
      output_config: { effort: 'low', format: { type: 'json_schema', schema: SCHEMA } },
      messages: [{ role: 'user', content: list.map((t, n) => `${n}: ${t.text}`).join('\n') }],
    } as unknown as Anthropic.MessageCreateParamsNonStreaming,
    { signal },
  );
  const text = res.content.find((b) => b.type === 'text')?.text ?? '';
  const parsed = JSON.parse(text) as { issues?: { index: number; suggestion: string; reason: string }[] };
  for (const issue of parsed.issues ?? []) {
    const t = list[issue.index];
    if (!t || !issue.suggestion.trim() || issue.suggestion.trim() === t.text.trim()) continue;
    out.set(t.i, { text: t.text, suggestion: issue.suggestion.trim(), reason: issue.reason.trim() });
  }
  return out;
}

/**
 * Adds the language findings to the plan: a suggestion on each line with a mistake and
 * one note listing them. Never fails the change – if the proofreader is unavailable,
 * only the fixed list is checked.
 */
export async function proofreadPlan(plan: ChangePlan, signal?: AbortSignal): Promise<ChangePlan> {
  const list = texts(plan);
  if (!list.length) return plan;
  const found = new Map<number, LanguageIssue>();
  for (const t of list) {
    const issue = foreignWords(t.text);
    if (issue) found.set(t.i, issue);
  }
  try {
    for (const [i, issue] of await claudeIssues(list, signal)) if (!found.has(i)) found.set(i, issue);
  } catch {
    /* the proofreader is a help, not a requirement */
  }
  if (!found.size) return plan;
  return {
    ...plan,
    changes: plan.changes.map((c, i) => (found.has(i) ? { ...c, suggestion: { value: found.get(i)!.suggestion, reason: found.get(i)!.reason } } : c)),
    notes: [
      ...(plan.notes ?? []),
      `Sprogtjek: ${found.size} ${found.size === 1 ? 'tekst ser forkert ud' : 'tekster ser forkerte ud'} – ${[...found.values()]
        .slice(0, 5)
        .map((f) => `"${f.text}" → "${f.suggestion}"`)
        .join(', ')}${found.size > 5 ? ' …' : ''}. Brug rettelsen på linjen, før du godkender.`,
    ],
  };
}
