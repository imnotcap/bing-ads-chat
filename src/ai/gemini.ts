/**
 * Google Gemini (generativelanguage.googleapis.com, v1beta) for the chat agent.
 *
 * The conversation history is stored in the Claude Messages format (the app's
 * canonical format); this module converts it to Gemini "contents" on every request
 * and streams the answer back with server-sent events. Function calls arrive
 * whole (not token by token). Gemini 3 models return a `thoughtSignature` with
 * function calls that must be sent back unchanged on the next request – they are
 * kept per tool call in the conversation (Conversation.geminiSignatures).
 */
import type Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import type { ApiMessage } from '@/stores/chat';
import type { AnyTool } from './tools/context';
import type { Effort } from './models';

// VITE_GEMINI_BASE_URL is only used for local development against a mock server.
const API = `${import.meta.env.VITE_GEMINI_BASE_URL || 'https://generativelanguage.googleapis.com'}/v1beta`;
/** Documented placeholder for function calls made by another model (e.g. after switching from Claude). */
const SKIP_SIGNATURE = 'skip_thought_signature_validator';

export interface GeminiPart {
  text?: string;
  thought?: boolean;
  thoughtSignature?: string;
  inlineData?: { mimeType: string; data: string };
  functionCall?: { name: string; args?: Record<string, unknown>; id?: string };
  functionResponse?: { name: string; response: Record<string, unknown>; id?: string };
}

export interface GeminiContent {
  role: 'user' | 'model';
  parts: GeminiPart[];
}

export interface GeminiUsage {
  promptTokenCount?: number;
  candidatesTokenCount?: number;
  thoughtsTokenCount?: number;
  cachedContentTokenCount?: number;
}

export interface GeminiModelListing {
  id: string;
  label: string;
  description: string;
}

/* ------------------------------- conversion ------------------------------- */

function toolResultText(content: Anthropic.Beta.BetaToolResultBlockParam['content']): string {
  if (typeof content === 'string') return content;
  return (content ?? []).map((b) => (b.type === 'text' ? b.text : '')).join('\n');
}

/** Claude-format history → Gemini contents. */
export function toGeminiContents(api: ApiMessage[], signatures: Record<string, string> = {}): GeminiContent[] {
  const names = new Map<string, string>();
  const out: GeminiContent[] = [];
  for (const msg of api) {
    const blocks = typeof msg.content === 'string' ? [{ type: 'text' as const, text: msg.content }] : msg.content;
    const parts: GeminiPart[] = [];
    let firstCall = true;
    for (const b of blocks) {
      switch (b.type) {
        case 'text':
          if (b.text) parts.push({ text: b.text });
          break;
        case 'image':
          if (b.source.type === 'base64') parts.push({ inlineData: { mimeType: b.source.media_type, data: b.source.data } });
          break;
        case 'document':
          if (b.source.type === 'base64') parts.push({ inlineData: { mimeType: b.source.media_type, data: b.source.data } });
          else if (b.source.type === 'text') parts.push({ text: `${b.title ? `[${b.title}]\n` : ''}${b.source.data}` });
          break;
        case 'tool_use': {
          names.set(b.id, b.name);
          // Gemini 3 validates the signature on the first function call of each step.
          const signature = signatures[b.id] ?? (firstCall ? SKIP_SIGNATURE : undefined);
          parts.push({ functionCall: { name: b.name, args: (b.input ?? {}) as Record<string, unknown>, id: b.id }, ...(signature ? { thoughtSignature: signature } : {}) });
          firstCall = false;
          break;
        }
        case 'tool_result': {
          const text = toolResultText(b.content);
          let response: Record<string, unknown>;
          try {
            const parsed = JSON.parse(text) as unknown;
            response = parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : { result: parsed };
          } catch {
            response = { result: text };
          }
          if (b.is_error) response = { error: text };
          parts.push({ functionResponse: { name: names.get(b.tool_use_id) ?? 'tool', response, id: b.tool_use_id } });
          break;
        }
        default:
          // thinking, server tools etc. are Claude-only and left out.
          break;
      }
    }
    if (!parts.length) continue;
    const role = msg.role === 'assistant' ? 'model' : 'user';
    const prev = out[out.length - 1];
    if (prev && prev.role === role) prev.parts.push(...parts);
    else out.push({ role, parts });
  }
  return out;
}

export function geminiTools(tools: AnyTool[]) {
  return [
    {
      functionDeclarations: tools.map((t) => {
        const { $schema: _ignored, ...schema } = z.toJSONSchema(t.schema, { io: 'input' }) as Record<string, unknown>;
        void _ignored;
        return { name: t.name, description: t.description, parametersJsonSchema: schema };
      }),
    },
  ];
}

function thinkingConfig(model: string, effort: Effort, showThinking: boolean) {
  // Gemini 3 models take a thinking level; older ones decide themselves.
  const level = /^gemini-[3-9]/.test(model) ? { thinkingLevel: effort === 'low' ? 'low' : 'high' } : {};
  return { includeThoughts: showThinking, ...level };
}

/* -------------------------------- streaming -------------------------------- */

export type GeminiEvent =
  | { type: 'text'; text: string }
  | { type: 'thought'; text: string }
  | { type: 'call'; id: string; name: string; args: Record<string, unknown>; signature?: string }
  | { type: 'done'; finishReason: string | null; usage: GeminiUsage };

export async function* streamGemini(opts: {
  apiKey: string;
  model: string;
  system: string;
  contents: GeminiContent[];
  tools: AnyTool[];
  effort: Effort;
  showThinking: boolean;
  signal: AbortSignal;
}): AsyncGenerator<GeminiEvent> {
  const body = {
    systemInstruction: { parts: [{ text: opts.system }] },
    contents: opts.contents,
    ...(opts.tools.length ? { tools: geminiTools(opts.tools), toolConfig: { functionCallingConfig: { mode: 'AUTO' } } } : {}),
    generationConfig: { maxOutputTokens: 32_000, thinkingConfig: thinkingConfig(opts.model, opts.effort, opts.showThinking) },
  };
  const res = await fetch(`${API}/models/${encodeURIComponent(opts.model)}:streamGenerateContent?alt=sse`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': opts.apiKey },
    body: JSON.stringify(body),
    signal: opts.signal,
  });
  if (!res.ok || !res.body) {
    const err = (await res.json().catch(() => null)) as { error?: { message?: string; status?: string } } | null;
    throw new GeminiError(res.status, err?.error?.message ?? `HTTP ${res.status}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let usage: GeminiUsage = {};
  let finishReason: string | null = null;
  let callIndex = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let sep: number;
    while ((sep = buffer.search(/\r?\n\r?\n/)) >= 0) {
      const chunk = buffer.slice(0, sep);
      buffer = buffer.slice(sep).replace(/^\r?\n\r?\n/, '');
      const data = chunk
        .split(/\r?\n/)
        .filter((l) => l.startsWith('data:'))
        .map((l) => l.slice(5).trim())
        .join('');
      if (!data) continue;
      const json = JSON.parse(data) as {
        candidates?: { content?: { parts?: GeminiPart[] }; finishReason?: string }[];
        usageMetadata?: GeminiUsage;
        promptFeedback?: { blockReason?: string };
      };
      if (json.promptFeedback?.blockReason) throw new GeminiError(400, `Gemini afviste forespørgslen (${json.promptFeedback.blockReason}).`);
      if (json.usageMetadata) usage = json.usageMetadata;
      const cand = json.candidates?.[0];
      if (cand?.finishReason) finishReason = cand.finishReason;
      for (const p of cand?.content?.parts ?? []) {
        if (p.functionCall) {
          const id = p.functionCall.id || `gm_${Date.now().toString(36)}_${callIndex++}`;
          yield { type: 'call', id, name: p.functionCall.name, args: p.functionCall.args ?? {}, signature: p.thoughtSignature };
        } else if (p.text) {
          yield p.thought ? { type: 'thought', text: p.text } : { type: 'text', text: p.text };
        }
      }
    }
  }
  yield { type: 'done', finishReason, usage };
}

export class GeminiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

/** Gemini usage → the token buckets used for cost and the usage ring. */
export function geminiTokenUsage(u: GeminiUsage) {
  const cached = u.cachedContentTokenCount ?? 0;
  return {
    input_tokens: Math.max(0, (u.promptTokenCount ?? 0) - cached),
    output_tokens: (u.candidatesTokenCount ?? 0) + (u.thoughtsTokenCount ?? 0),
    cache_read_input_tokens: cached,
    cache_creation_input_tokens: 0,
  };
}

/** The Gemini models the key can use for chat (for the admin's model list). */
export async function listGeminiModels(apiKey: string): Promise<GeminiModelListing[]> {
  const out: GeminiModelListing[] = [];
  let pageToken = '';
  do {
    const res = await fetch(`${API}/models?pageSize=200${pageToken ? `&pageToken=${pageToken}` : ''}`, { headers: { 'x-goog-api-key': apiKey } });
    const json = (await res.json().catch(() => ({}))) as {
      models?: { name: string; displayName?: string; description?: string; supportedGenerationMethods?: string[] }[];
      nextPageToken?: string;
      error?: { message?: string };
    };
    if (!res.ok) throw new Error(json.error?.message ?? `Gemini svarede ${res.status}`);
    for (const m of json.models ?? []) {
      const id = m.name.replace(/^models\//, '');
      if (!id.startsWith('gemini') || !m.supportedGenerationMethods?.includes('generateContent')) continue;
      if (/embedding|image|tts|audio|live|vision-only/.test(id)) continue;
      out.push({ id, label: m.displayName ?? id, description: m.description ?? '' });
    }
    pageToken = json.nextPageToken ?? '';
  } while (pageToken);
  return out.sort((a, b) => b.id.localeCompare(a.id));
}
