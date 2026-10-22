/**
 * The chat agent: a streaming tool-use loop against the Claude Messages API.
 *
 * - History is append-only (Conversation.api), which keeps prompt caching and
 *   preserved thinking valid across turns.
 * - Read tools run in parallel; write tools are planned, checked against the
 *   spending guardrails and – when required – wait for the user's approval.
 * - Every executed, rejected or blocked change is written to the activity log.
 */
import Anthropic from '@anthropic-ai/sdk';
import { nativeNotify } from '@/components/notifications/toast';
import { getBackend } from '@/bing/backend';
import { getSpendStatus, invalidateSpendCache } from '@/bing/spend';
import { toContentBlocks, toMeta, type Attachment } from '@/lib/attachments';
import { DATE_PRESET_LABELS, presetRange } from '@/lib/format';
import { sharedKey } from '@/workspace/shared';
import { queryClient } from '@/lib/queryClient';
import { abortable, errorMessage, uid } from '@/lib/utils';
import { useActivity } from '@/stores/activity';
import { useChat, type ApiMessage, type AssistantItem, type Conversation, type Part, type ToolPart } from '@/stores/chat';
import { useConnection } from '@/stores/connection';
import { useSettings } from '@/stores/settings';
import { useUsage } from '@/stores/usage';
import { refreshBilling, reportUsage, usageBlocked } from '@/workspace/billing';
import { applyEdits, applyPicks, requestApproval } from './approvals';
import { proofreadPlan } from './proofread';
import { evaluateGuardrails, type SpendContext } from './guardrails';
import { buildContextBlock, buildSystemPrompt } from './prompt';
import { playbookFor } from '@/workspace/playbooks';
import { allLimits } from '@/workspace/limits';
import { otherBranchesContext } from './branchLimits';
import { TERMINAL_TOOLS, getTool, toolDefinitions, type PlannedChange, type ToolContext } from './tools';
import { connectorContext, enabledTools, isConnectorOn } from './connectors';
import { GeminiError, geminiTokenUsage, streamGemini, toGeminiContents } from './gemini';
import { contextTokens, modelInfo } from './models';
import type { WriteTool } from './tools/context';
import { totalActiveDailyBudget } from './tools/write';

type ToolUse = Anthropic.Beta.BetaToolUseBlock;
type ToolResult = Anthropic.Beta.BetaToolResultBlockParam;

const MAX_RESULT_CHARS = 80_000;
const controllers = new Map<string, AbortController>();

/* --------------------------------- helpers --------------------------------- */

function conv(id: string): Conversation {
  const c = useChat.getState().conversations.find((x) => x.id === id);
  if (!c) throw new Error('Samtalen findes ikke længere.');
  return c;
}

function updateAssistant(convId: string, itemId: string, fn: (item: AssistantItem) => AssistantItem) {
  useChat.getState().updateItem(convId, itemId, fn);
}

function updatePart(convId: string, itemId: string, partId: string, fn: (p: Part) => Part) {
  updateAssistant(convId, itemId, (it) => ({ ...it, parts: it.parts.map((p) => (p.id === partId ? fn(p) : p)) }));
}

function updateTool(convId: string, itemId: string, toolUseId: string, patch: Partial<ToolPart>) {
  updatePart(convId, itemId, toolUseId, (p) => (p.type === 'tool' ? { ...p, ...patch } : p));
}

function addPart(convId: string, itemId: string, part: Part) {
  updateAssistant(convId, itemId, (it) => ({ ...it, parts: [...it.parts, part] }));
}

function notice(convId: string, itemId: string, tone: 'info' | 'warning' | 'error', text: string) {
  addPart(convId, itemId, { type: 'notice', id: uid('n_'), tone, text });
}

function appendApi(convId: string, msg: ApiMessage) {
  useChat.getState().patch(convId, (c) => ({ api: [...c.api, msg] }));
}

/** Adds a note to the user turn the model is about to answer (nothing after it has been sent yet). */
function appendToLastUser(convId: string, text: string) {
  useChat.getState().patch(convId, (c) => {
    const last = c.api[c.api.length - 1];
    if (last?.role !== 'user') return { api: [...c.api, { role: 'user', content: [{ type: 'text', text }] }] };
    const before = typeof last.content === 'string' ? [{ type: 'text' as const, text: last.content }] : last.content;
    return { api: [...c.api.slice(0, -1), { role: 'user', content: [...before, { type: 'text', text }] }] };
  });
}

/** What a tool is called while its input is still being written (its label needs the input). */
const TITLES: Record<string, string> = {
  find_campaigns_and_ad_groups: 'Finder kampagner og annoncegrupper',
  research_keywords: 'Undersøger søgeord',
  run_report: 'Kører rapport',
  find_api_operation: 'Slår op i Microsofts API',
  update_campaigns: 'Ændrer kampagner',
  create_campaign: 'Opretter kampagne',
  delete_campaigns: 'Sletter kampagner',
  create_ad_group: 'Opretter annoncegruppe',
  update_ad_groups: 'Ændrer annoncegrupper',
  add_keywords: 'Tilføjer søgeord',
  update_keywords: 'Ændrer søgeord',
  delete_keywords: 'Sletter søgeord',
  add_negative_keywords: 'Tilføjer negative søgeord',
  propose_negative_keywords: 'Foreslår negative søgeord',
  update_ads: 'Ændrer annoncer',
  microsoft_ads_api: 'Microsoft Ads API',
  train_playbook: 'Træner assistenten',
  create_file: 'Laver en fil',
};

function toolLabel(name: string, input: unknown): string {
  const tool = getTool(name);
  if (!tool) return TITLES[name] ?? name;
  try {
    const label = tool.label(input as never);
    return /undefined/.test(label) ? (TITLES[name] ?? label) : label;
  } catch {
    return TITLES[name] ?? name;
  }
}

/** Tools whose whole result is the point (every search term of a campaign) get more room. */
const RESULT_CHARS: Record<string, number> = { get_search_terms: 240_000 };

function serialize(result: unknown, max = MAX_RESULT_CHARS): string {
  const text = typeof result === 'string' ? result : JSON.stringify(result);
  if (text.length <= max) return text;
  return `${text.slice(0, max)}\n…[truncated – narrow the request with filters or a lower limit]`;
}

/**
 * If the history ends with tool calls that never got results (app closed, run
 * stopped), answer them so the conversation stays valid. Append-only.
 */
function repairHistory(convId: string) {
  const c = conv(convId);
  const last = c.api[c.api.length - 1];
  if (!last || last.role !== 'assistant' || typeof last.content === 'string') return;
  const uses = last.content.filter((b): b is ToolUse => b.type === 'tool_use');
  if (!uses.length) return;
  appendApi(convId, {
    role: 'user',
    content: uses.map((u) => ({ type: 'tool_result', tool_use_id: u.id, is_error: true, content: 'Not executed: the run was stopped before this tool ran.' })),
  });
}

export function friendlyError(err: unknown): string {
  if (err instanceof GeminiError) {
    if (err.status === 400 && /api key/i.test(err.message)) return 'Gemini API-nøglen blev afvist. Tjek den under Indstillinger → AI-modeller.';
    if (err.status === 403) return 'Gemini-nøglen har ikke adgang til den valgte model. Vælg en anden under Indstillinger → AI-modeller.';
    if (err.status === 404) return 'Gemini-modellen findes ikke (længere). Vælg en anden under Indstillinger → AI-modeller.';
    if (err.status === 429) return 'Gemini-kvoten er brugt op lige nu (rate limit). Vent et øjeblik og prøv igen.';
    if (err.status >= 500) return 'Gemini er overbelastet eller utilgængelig lige nu – prøv igen om lidt.';
    return `Gemini afviste forespørgslen: ${err.message}`;
  }
  if (err instanceof Anthropic.AuthenticationError) return 'Claude API-nøglen blev afvist. Tjek den under Indstillinger → Forbindelser.';
  if (err instanceof Anthropic.PermissionDeniedError) return 'Din Claude API-nøgle har ikke adgang til den valgte model. Vælg en anden model under Indstillinger → AI-assistent.';
  if (err instanceof Anthropic.RateLimitError) return 'Claude modtager for mange forespørgsler lige nu (rate limit). Vent et øjeblik og prøv igen.';
  if (err instanceof Anthropic.BadRequestError) return `Claude afviste forespørgslen: ${err.message}`;
  if (err instanceof Anthropic.InternalServerError) return 'Claude er overbelastet eller utilgængelig lige nu – prøv igen om lidt.';
  if (err instanceof Anthropic.APIConnectionError) return 'Ingen forbindelse til Claude. Tjek din internetforbindelse.';
  if (err instanceof Anthropic.APIError) return `Claude-fejl (${err.status ?? 'ukendt'}): ${err.message}`;
  return errorMessage(err);
}

/* ------------------------------ public actions ------------------------------ */

export function isRunning(convId: string) {
  return !!useChat.getState().running[convId];
}

export function stopConversation(convId: string) {
  controllers.get(convId)?.abort();
}

/** `interrupted`: the user stopped the previous answer to send this (see features/chat/queue.ts). */
export async function sendMessage(convId: string, text: string, attachments: Attachment[] = [], opts: { interrupted?: boolean } = {}): Promise<void> {
  const trimmed = text.trim() || (attachments.length ? 'Se de vedhæftede filer.' : '');
  if (!trimmed || isRunning(convId)) return;

  const settings = useSettings.getState();
  const connection = useConnection.getState();
  const account = connection.accounts.find((a) => a.id === connection.accountId) ?? null;
  const model = settings.ai.model;
  const chat = useChat.getState();

  const userItemId = uid('u_');
  const itemId = uid('a_');
  const first = conv(convId).items.length === 0;
  chat.patch(convId, (c) => ({
    title: first ? (text.trim() || attachments[0]?.name || trimmed).replace(/\s+/g, ' ').slice(0, 60) : c.title,
    accountId: c.accountId ?? connection.accountId,
    mode: connection.mode,
    items: [
      ...c.items,
      { kind: 'user', id: userItemId, ts: Date.now(), text: text.trim(), attachments: attachments.length ? attachments.map(toMeta) : undefined },
      { kind: 'assistant', id: itemId, ts: Date.now(), model, parts: [], status: 'streaming' },
    ],
  }));

  const fail = (message: string) => updateAssistant(convId, itemId, (it) => ({ ...it, status: 'error', error: message }));

  // Stoppable from the very first moment – also while the key, billing and limits load.
  const controller = new AbortController();
  const { signal } = controller;
  controllers.set(convId, controller);
  chat.setRunning(convId, true);
  try {
    const provider = modelInfo(model).provider;
    const apiKey = await abortable(sharedKey(provider === 'google' ? 'google' : 'anthropic').catch(() => null), signal);
    if (!apiKey) {
      return fail(
        provider === 'google'
          ? 'Der er ingen fælles Gemini API-nøgle (eller serveren kunne ikke nås). Tilføj den under Indstillinger → AI-modeller.'
          : 'Der er ingen fælles Claude API-nøgle (eller serveren kunne ikke nås). Tilføj den under Indstillinger → Forbindelser.',
      );
    }
    // The user's subscription: the month's included AI use plus bought credits.
    await abortable(refreshBilling(), signal);
    const blocked = usageBlocked();
    if (blocked) return fail(blocked);

    repairHistory(convId);
    // The team's shared budget and limits per branch (Microsoft's become the spending rules).
    const limits = await abortable(allLimits().catch(() => ({})), signal);
    const period = presetRange(settings.datePreset);
    const context = buildContextBlock({
      account,
      mode: connection.mode,
      periodLabel: DATE_PRESET_LABELS[settings.datePreset],
      periodRange: period,
      rules: useSettings.getState().spend,
      connectors: connectorContext(settings.ai.connectors, provider),
      otherBranches: otherBranchesContext(limits),
      focus: conv(convId).focus,
    });
    const content: Anthropic.Beta.BetaContentBlockParam[] = [];
    if (context !== conv(convId).lastContext) content.push({ type: 'text', text: context });
    if (opts.interrupted) {
      content.push({
        type: 'text',
        text: '<note>The user stopped your previous answer to send this message. Keep their previous question in mind: answer this message, and finish or connect to the earlier question where it is still relevant.</note>',
      });
    }
    content.push(...toContentBlocks(attachments));
    content.push({ type: 'text', text: trimmed });
    chat.patch(convId, (c) => {
      // A stopped answer can leave the previous question without a reply – one user turn then.
      const last = c.api[c.api.length - 1];
      if (last?.role === 'user') {
        const before = typeof last.content === 'string' ? [{ type: 'text' as const, text: last.content }] : last.content;
        return { api: [...c.api.slice(0, -1), { role: 'user', content: [...before, ...content] }], lastContext: context };
      }
      return { api: [...c.api, { role: 'user', content }], lastContext: context };
    });

    if (provider === 'google') await runGeminiLoop(convId, itemId, apiKey, signal);
    else await runLoop(convId, itemId, apiKey, signal);
    updateAssistant(convId, itemId, (it) => ({ ...it, status: it.status === 'streaming' ? 'done' : it.status }));
    // Like Claude: tell the user when an answer is ready while they're elsewhere.
    const answer = conv(convId).items.find((i) => i.id === itemId);
    const firstText = answer?.kind === 'assistant' ? answer.parts.find((p) => p.type === 'text')?.text : undefined;
    void nativeNotify('Svaret er klar', (firstText ?? '').replace(/[*#>_`|]/g, '').trim().slice(0, 140) || conv(convId).title);
  } catch (err) {
    if (signal.aborted) {
      updateAssistant(convId, itemId, (it) => ({
        ...it,
        status: 'stopped',
        parts: it.parts.map((p) =>
          p.type === 'tool' && (p.status === 'running' || p.status === 'streaming' || p.status === 'awaiting_approval') ? { ...p, status: 'stopped' } : p,
        ),
      }));
    } else {
      console.error(err);
      fail(friendlyError(err));
      void nativeNotify('Assistenten stødte på en fejl', friendlyError(err));
    }
  } finally {
    controllers.delete(convId);
    useChat.getState().setRunning(convId, false);
  }
}

/** The switched-on tools – without change proposals when the team set the branch to read-only. */
function allowedTools(connectors: Parameters<typeof enabledTools>[0]) {
  const readOnly = !useSettings.getState().spend.mayPropose;
  return enabledTools(connectors).filter((t) => !readOnly || t.kind !== 'write' || t.name === 'train_playbook');
}

/* --------------------------------- the loop --------------------------------- */

/** Input size (tokens) at which older parts of a conversation are summarized. */
// High enough that a full search term list (tens of thousands of tokens) is still there when the assistant judges it.
export const COMPACT_AT = 250_000;
const COMPACT_INSTRUCTIONS = `Summarize the conversation so far so the work can continue without the earlier messages. Keep, exactly:
- what the user asked for, their goals and preferences, and any decisions they made
- every change that was proposed, approved, rejected or carried out (campaign/ad group/keyword names and IDs, old and new values)
- the key numbers found in reports (spend, conversions, CPA, ROAS, CTR …) with their period and account
- open questions and what the user still wants done next
Write it in the user's language. Leave out raw report rows that are no longer needed.`;

async function runLoop(convId: string, itemId: string, apiKey: string, signal: AbortSignal) {
  const settings = useSettings.getState();
  const { ai } = settings;
  // VITE_ANTHROPIC_BASE_URL is only used for local development against a mock server.
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true, maxRetries: 2, baseURL: import.meta.env.VITE_ANTHROPIC_BASE_URL || undefined });
  const tools: Anthropic.Beta.BetaToolUnion[] = [...toolDefinitions(allowedTools(ai.connectors))];
  if (isConnectorOn(ai.connectors, 'web')) {
    // Web search runs on Anthropic's side; the dynamic-filtering version needs a recent Opus/Sonnet.
    const dynamic = /^claude-(opus|sonnet)-5/.test(ai.model);
    tools.push({ type: dynamic ? 'web_search_20260209' : 'web_search_20250305', name: 'web_search', max_uses: 5 } as unknown as Anthropic.Beta.BetaToolUnion);
    // Reading a page (landing pages, prices, delivery terms, competitors) to check that ad copy is true.
    tools.push({ type: dynamic ? 'web_fetch_20260209' : 'web_fetch_20250910', name: 'web_fetch', max_uses: 5 } as unknown as Anthropic.Beta.BetaToolUnion);
  }
  const system: Anthropic.Beta.BetaTextBlockParam[] = [{ type: 'text', text: buildSystemPrompt(settings.business, await abortable(playbookFor('microsoft_ads'), signal)) }];
  const memo = new Map<string, Promise<unknown>>();
  let jsonRetries = 0;
  let splitRetry = false;

  for (let round = 1; ; round++) {
    if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
    if (round > ai.maxToolRounds) {
      notice(convId, itemId, 'warning', `Stoppede efter ${ai.maxToolRounds} værktøjsrunder. Skriv "fortsæt", hvis assistenten skal arbejde videre.`);
      return;
    }
    if (usageBlocked()) {
      notice(convId, itemId, 'warning', 'Dit AI-forbrug for måneden er brugt – assistenten stoppede her. Køb ekstra forbrug i Brug-ringen nederst til højre i chatfeltet.');
      return;
    }

    const stream = client.beta.messages.stream(
      {
        model: ai.model,
        // Room for long thinking plus a big tool call (e.g. 300 negative keywords); it is a ceiling, not a cost.
        max_tokens: 128_000,
        system,
        tools,
        messages: conv(convId).api,
        thinking: {
          type: 'adaptive',
          display: ai.showThinking ? 'summarized' : 'omitted',
          // Claude's earlier reasoning is tied to the system prompt and tools it was written
          // with. They change when the app is updated, a branch is trained or a connector is
          // switched – then that old reasoning is left out instead of the request failing.
          block_binding: { prefix_mismatch_behavior: 'drop_block' },
        },
        output_config: { effort: ai.effort },
        // The conversation so far is cached for an hour, so the next message only adds
        // to it instead of making Claude read the whole conversation again.
        cache_control: { type: 'ephemeral', ttl: '1h' },
        // A long conversation is summarized by Claude (a compaction block that stays in the
        // history), so it keeps what was said without reading every old report again.
        context_management: { edits: [{ type: 'compact_20260112', trigger: { type: 'input_tokens', value: COMPACT_AT }, instructions: COMPACT_INSTRUCTIONS }] },
        // Server-side fallback if the model declines for policy reasons; the one-hour cache,
        // compaction and block_binding above.
        betas: ['server-side-fallback-2026-07-01', 'extended-cache-ttl-2025-04-11', 'compact-2026-01-12', 'thinking-binding-controls-2026-08-01'],
        fallbacks: 'default',
      },
      { signal },
    );

    const partIds = new Map<number, string>();
    const deltas = createDeltaBuffer(convId, itemId);
    let message: Anthropic.Beta.BetaMessage;
    try {
      for await (const ev of stream) {
        if (ev.type === 'content_block_start') {
          deltas.flush();
          const b = ev.content_block;
          if (b.type === 'text') {
            const id = uid('t_');
            partIds.set(ev.index, id);
            addPart(convId, itemId, { type: 'text', id, text: b.text });
          } else if (b.type === 'thinking' && ai.showThinking) {
            const id = uid('th_');
            partIds.set(ev.index, id);
            addPart(convId, itemId, { type: 'thinking', id, text: b.thinking ?? '', startedAt: Date.now() });
          } else if (b.type === 'tool_use') {
            partIds.set(ev.index, b.id);
            addPart(convId, itemId, { type: 'tool', id: b.id, name: b.name, label: toolLabel(b.name, {}), input: {}, status: 'streaming', startedAt: Date.now() });
          } else if (b.type === 'server_tool_use') {
            const label = b.name === 'web_fetch' ? 'Læser side på nettet' : b.name === 'web_search' ? 'Søger på nettet' : 'Arbejder';
            addPart(convId, itemId, { type: 'tool', id: b.id, name: b.name, label, input: {}, status: 'running', startedAt: Date.now() });
          } else if (b.type === 'web_search_tool_result') {
            const found = Array.isArray(b.content) ? b.content.length : 0;
            updateTool(convId, itemId, b.tool_use_id, { status: 'done', summary: found ? `${found} resultater` : 'Ingen resultater', endedAt: Date.now() });
          } else if (b.type === 'web_fetch_tool_result') {
            const content = b.content as { type?: string; url?: string };
            const failed = content.type === 'web_fetch_tool_result_error';
            updateTool(convId, itemId, b.tool_use_id, { status: failed ? 'error' : 'done', summary: failed ? 'Siden kunne ikke hentes' : (content.url ?? 'Side hentet'), endedAt: Date.now() });
          } else if ('tool_use_id' in b && typeof b.tool_use_id === 'string' && b.type.endsWith('_tool_result')) {
            // Other server tool results (e.g. the code web search filters with) – the step is done.
            updateTool(convId, itemId, b.tool_use_id, { status: 'done', endedAt: Date.now() });
          }
        } else if (ev.type === 'content_block_delta') {
          const id = partIds.get(ev.index);
          if (!id) continue;
          if (ev.delta.type === 'text_delta') deltas.push(id, ev.delta.text);
          else if (ev.delta.type === 'thinking_delta') deltas.push(id, ev.delta.thinking);
        } else if (ev.type === 'content_block_stop') {
          deltas.flush();
          const id = partIds.get(ev.index);
          if (id) updatePart(convId, itemId, id, (p) => (p.type === 'thinking' ? { ...p, endedAt: Date.now() } : p));
        }
      }
      deltas.flush();
      message = await stream.finalMessage();
      jsonRetries = 0;
    } catch (err) {
      deltas.flush();
      if (signal.aborted || !(err instanceof Anthropic.AnthropicError) || err instanceof Anthropic.APIError || !/JSON/.test(err.message) || jsonRetries++ >= 2) throw err;
      // Eager input streaming: a tool input that is not valid JSON – re-issue the turn.
      updateAssistant(convId, itemId, (it) => ({ ...it, parts: it.parts.filter((p) => !(p.type === 'tool' && p.status === 'streaming')) }));
      continue;
    }

    const cost = useUsage.getState().record(message.model || ai.model, message.usage);
    reportUsage(cost);
    updateAssistant(convId, itemId, (it) => ({ ...it, costUsd: (it.costUsd ?? 0) + cost, contextTokens: contextTokens(message.usage) }));

    for (const b of message.content) {
      if (b.type === 'compaction' && b.content) notice(convId, itemId, 'info', 'Samtalen er blevet lang, så Claude har opsummeret det tidligere – alt vigtigt, der er nævnt, huskes stadig.');
      if (b.type === 'fallback') notice(convId, itemId, 'info', `Svaret blev færdiggjort af ${b.to.model}, fordi ${b.from.model} afviste en del af forespørgslen.`);
    }

    const toolUses = message.content.filter((b): b is ToolUse => b.type === 'tool_use');

    if (message.stop_reason === 'refusal') {
      appendApi(convId, { role: 'assistant', content: message.content.filter((b) => b.type !== 'tool_use') });
      notice(convId, itemId, 'warning', 'Claude afviste at svare på denne forespørgsel. Prøv at omformulere den.');
      return;
    }
    if (message.stop_reason === 'max_tokens' && toolUses.length) {
      // A truncated tool input must never run; the turn is not added to the history.
      const cut = new Set(toolUses.map((u) => u.id));
      if (!splitRetry) {
        // Once: ask for the same work again, split into smaller calls – instead of giving up.
        splitRetry = true;
        updateAssistant(convId, itemId, (it) => ({ ...it, parts: it.parts.filter((p) => !(p.type === 'tool' && cut.has(p.id))) }));
        notice(convId, itemId, 'info', 'Svaret blev for langt til ét værktøjskald – assistenten deler det op.');
        appendToLastUser(
          convId,
          '<note>Your previous reply hit the output limit before its tool call was complete, so nothing ran. Do the same work again, but split long inputs into several calls of at most 100 items each (e.g. several propose_negative_keywords calls for the same campaign in this one reply), and keep your reasoning short.</note>',
        );
        continue;
      }
      notice(convId, itemId, 'error', 'Svaret blev for langt og blev afbrudt, før værktøjet kunne køre. Prøv at dele opgaven op.');
      updateAssistant(convId, itemId, (it) => ({ ...it, parts: it.parts.map((p) => (p.type === 'tool' && cut.has(p.id) ? { ...p, status: 'error', error: 'Afbrudt' } : p)) }));
      return;
    }

    appendApi(convId, { role: 'assistant', content: message.content });

    if (message.stop_reason === 'pause_turn') continue;
    if (message.stop_reason === 'max_tokens') {
      notice(convId, itemId, 'warning', 'Svaret nåede den maksimale længde. Skriv "fortsæt" for resten.');
      return;
    }
    if (!toolUses.length) return;

    const results = await executeTools(convId, itemId, toolUses, memo, signal);
    appendApi(convId, { role: 'user', content: results });
    // Follow-up suggestions close the turn – no extra request needed.
    if (toolUses.every((u) => TERMINAL_TOOLS.has(u.name))) return;
  }
}

/* ------------------------------ the Gemini loop ------------------------------ */

/** The same tool-use loop as runLoop, against Google Gemini (see ai/gemini.ts). */
async function runGeminiLoop(convId: string, itemId: string, apiKey: string, signal: AbortSignal) {
  const settings = useSettings.getState();
  const { ai } = settings;
  const tools = allowedTools(ai.connectors);
  const system = buildSystemPrompt(settings.business, await abortable(playbookFor('microsoft_ads'), signal));
  const memo = new Map<string, Promise<unknown>>();

  for (let round = 1; ; round++) {
    if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
    if (round > ai.maxToolRounds) {
      notice(convId, itemId, 'warning', `Stoppede efter ${ai.maxToolRounds} værktøjsrunder. Skriv "fortsæt", hvis assistenten skal arbejde videre.`);
      return;
    }
    if (usageBlocked()) {
      notice(convId, itemId, 'warning', 'Dit AI-forbrug for måneden er brugt – assistenten stoppede her. Køb ekstra forbrug i Brug-ringen nederst til højre i chatfeltet.');
      return;
    }

    const c = conv(convId);
    const deltas = createDeltaBuffer(convId, itemId);
    const blocks: Anthropic.Beta.BetaContentBlockParam[] = [];
    const uses: ToolUse[] = [];
    const signatures: Record<string, string> = {};
    let textId: string | null = null;
    let thoughtId: string | null = null;
    let finishReason: string | null = null;
    let usage = {};
    const endThought = () => {
      if (!thoughtId) return;
      deltas.flush();
      const id = thoughtId;
      updatePart(convId, itemId, id, (p) => (p.type === 'thinking' ? { ...p, endedAt: Date.now() } : p));
      thoughtId = null;
    };

    try {
      for await (const ev of streamGemini({ apiKey, model: ai.model, system, contents: toGeminiContents(c.api, c.geminiSignatures), tools, effort: ai.effort, showThinking: ai.showThinking, signal })) {
        if (ev.type === 'thought') {
          if (!ai.showThinking) continue;
          if (!thoughtId) {
            deltas.flush();
            thoughtId = uid('th_');
            addPart(convId, itemId, { type: 'thinking', id: thoughtId, text: '', startedAt: Date.now() });
          }
          deltas.push(thoughtId, ev.text);
        } else if (ev.type === 'text') {
          endThought();
          if (!textId) {
            deltas.flush();
            textId = uid('t_');
            addPart(convId, itemId, { type: 'text', id: textId, text: '' });
          }
          deltas.push(textId, ev.text);
          const last = blocks[blocks.length - 1];
          if (last?.type === 'text') last.text += ev.text;
          else blocks.push({ type: 'text', text: ev.text });
        } else if (ev.type === 'call') {
          endThought();
          deltas.flush();
          textId = null;
          const use = { type: 'tool_use', id: ev.id, name: ev.name, input: ev.args } as ToolUse;
          uses.push(use);
          blocks.push({ type: 'tool_use', id: ev.id, name: ev.name, input: ev.args });
          if (ev.signature) signatures[ev.id] = ev.signature;
          addPart(convId, itemId, { type: 'tool', id: ev.id, name: ev.name, label: toolLabel(ev.name, ev.args), input: ev.args, status: 'streaming', startedAt: Date.now() });
        } else {
          finishReason = ev.finishReason;
          usage = ev.usage;
        }
      }
    } finally {
      endThought();
      deltas.flush();
    }

    const tokens = geminiTokenUsage(usage);
    const cost = useUsage.getState().record(ai.model, tokens);
    reportUsage(cost);
    updateAssistant(convId, itemId, (it) => ({ ...it, costUsd: (it.costUsd ?? 0) + cost, contextTokens: contextTokens(tokens) }));

    if (finishReason && ['SAFETY', 'PROHIBITED_CONTENT', 'BLOCKLIST', 'SPII', 'RECITATION'].includes(finishReason)) {
      notice(convId, itemId, 'warning', 'Gemini afviste at svare på denne forespørgsel. Prøv at omformulere den.');
      if (blocks.some((b) => b.type === 'text')) appendApi(convId, { role: 'assistant', content: blocks.filter((b) => b.type === 'text') });
      return;
    }
    if (finishReason === 'MALFORMED_FUNCTION_CALL') {
      notice(convId, itemId, 'error', 'Gemini lavede et ugyldigt værktøjskald. Prøv igen – eller vælg en anden model.');
      return;
    }
    if (finishReason === 'MAX_TOKENS' && uses.length) {
      notice(convId, itemId, 'error', 'Svaret blev for langt og blev afbrudt, før værktøjet kunne køre. Prøv at dele opgaven op.');
      return;
    }
    if (!blocks.length) {
      notice(convId, itemId, 'warning', 'Gemini returnerede et tomt svar. Prøv igen.');
      return;
    }

    if (Object.keys(signatures).length) {
      useChat.getState().patch(convId, (cv) => ({ geminiSignatures: { ...cv.geminiSignatures, ...signatures } }));
    }
    appendApi(convId, { role: 'assistant', content: blocks });
    if (finishReason === 'MAX_TOKENS') {
      notice(convId, itemId, 'warning', 'Svaret nåede den maksimale længde. Skriv "fortsæt" for resten.');
      return;
    }
    if (!uses.length) return;

    const results = await executeTools(convId, itemId, uses, memo, signal);
    appendApi(convId, { role: 'user', content: results });
    if (uses.every((u) => TERMINAL_TOOLS.has(u.name))) return;
  }
}

/* ------------------------------ tool execution ------------------------------ */

async function buildToolContext(convId: string, memo: Map<string, Promise<unknown>>, signal: AbortSignal): Promise<ToolContext> {
  const { accountId, accounts } = useConnection.getState();
  if (!accountId) throw new Error('Ingen annoncekonto er valgt.');
  const settings = useSettings.getState();
  return {
    backend: await getBackend(),
    accountId,
    currency: accounts.find((a) => a.id === accountId)?.currency ?? 'DKK',
    rules: settings.spend,
    defaultPreset: settings.datePreset,
    conversationId: convId,
    signal,
    memo,
  };
}

async function spendContext(ctx: ToolContext): Promise<SpendContext> {
  const r = ctx.rules;
  const needsTotals = r.maxTotalDailyBudget !== null || r.monthlyBudget !== null;
  if (!needsTotals) return { currency: ctx.currency, totalActiveDailyBudget: null, monthToDateSpend: null, daysLeftInMonth: 0 };
  const total = await totalActiveDailyBudget(ctx);
  if (r.monthlyBudget === null) return { currency: ctx.currency, totalActiveDailyBudget: total, monthToDateSpend: null, daysLeftInMonth: 0 };
  const s = await getSpendStatus(ctx.backend, ctx.accountId, r.monthlyBudget);
  return { currency: ctx.currency, totalActiveDailyBudget: total, monthToDateSpend: s.monthToDateSpend, daysLeftInMonth: s.daysLeftInMonth };
}

function afterChange() {
  invalidateSpendCache();
  void queryClient.invalidateQueries();
}

async function executeTools(
  convId: string,
  itemId: string,
  uses: ToolUse[],
  memo: Map<string, Promise<unknown>>,
  signal: AbortSignal,
): Promise<ToolResult[]> {
  const results = new Map<string, ToolResult>();
  const ok = (id: string, result: unknown, tool?: string): ToolResult => ({ type: 'tool_result', tool_use_id: id, content: serialize(result, RESULT_CHARS[tool ?? ''] ?? MAX_RESULT_CHARS) });
  const err = (id: string, message: string): ToolResult => ({ type: 'tool_result', tool_use_id: id, is_error: true, content: message });

  let ctx: ToolContext | null = null;
  try {
    ctx = await abortable(buildToolContext(convId, memo, signal), signal);
  } catch (e) {
    for (const u of uses) {
      updateTool(convId, itemId, u.id, { status: 'error', error: errorMessage(e), input: u.input, endedAt: Date.now() });
      results.set(u.id, err(u.id, errorMessage(e)));
    }
    return uses.map((u) => results.get(u.id)!);
  }

  const parsed = uses.map((u) => {
    const tool = getTool(u.name);
    const check = tool?.schema.safeParse(u.input);
    return { use: u, tool, input: check?.success ? check.data : undefined, issues: check && !check.success ? check.error.issues : undefined };
  });

  for (const p of parsed) {
    updateTool(convId, itemId, p.use.id, { input: p.use.input, label: toolLabel(p.use.name, p.input ?? p.use.input) });
    if (!p.tool) {
      results.set(p.use.id, err(p.use.id, `Unknown tool ${p.use.name}`));
      updateTool(convId, itemId, p.use.id, { status: 'error', error: 'Ukendt værktøj', endedAt: Date.now() });
    } else if (p.input === undefined) {
      const detail = (p.issues ?? []).map((i) => `${i.path.join('.') || 'input'}: ${i.message}`).join('; ');
      results.set(p.use.id, err(p.use.id, JSON.stringify({ INVALID_INPUT: detail })));
      updateTool(convId, itemId, p.use.id, { status: 'error', error: `Ugyldigt input: ${detail}`, endedAt: Date.now() });
    }
  }

  // Reads and visuals in parallel.
  await Promise.all(
    parsed
      .filter((p) => p.tool && p.input !== undefined && p.tool.kind !== 'write')
      .map(async (p) => {
        const tool = p.tool!;
        if (tool.kind === 'write') return;
        updateTool(convId, itemId, p.use.id, { status: 'running' });
        try {
          const out = await abortable(tool.run(p.input, ctx!), signal);
          results.set(p.use.id, ok(p.use.id, out.result, tool.name));
          updateTool(convId, itemId, p.use.id, { status: 'done', summary: out.summary, preview: out.preview, endedAt: Date.now() });
          if (out.visual) addPart(convId, itemId, { type: 'visual', id: uid('v_'), visual: out.visual });
        } catch (e) {
          if (signal.aborted) throw e;
          results.set(p.use.id, err(p.use.id, errorMessage(e)));
          updateTool(convId, itemId, p.use.id, { status: 'error', error: errorMessage(e), endedAt: Date.now() });
        }
      }),
  );

  // Changes: plan all, show approval cards together, then execute in order.
  const writes = parsed.filter((p) => p.tool?.kind === 'write' && p.input !== undefined);
  const planned: { id: string; name: string; tool: WriteTool; input: unknown; plan: PlannedChange; verdict: 'allow' | 'approve' | 'block' }[] = [];
  for (const p of writes) {
    const tool = p.tool!;
    if (tool.kind !== 'write') continue;
    updateTool(convId, itemId, p.use.id, { status: 'running' });
    try {
      const change = await abortable(tool.plan(p.input, ctx), signal);
      // Keywords, ad texts and names are proofread in Danish before the user sees them.
      if (change.plan) change.plan = await proofreadPlan(change.plan, signal);
      if (!change.plan) {
        planned.push({ id: p.use.id, name: tool.name, tool, input: p.input, plan: change, verdict: 'allow' });
        continue;
      }
      const decision = evaluateGuardrails(change.plan, ctx.rules, await abortable(spendContext(ctx), signal));
      updateTool(convId, itemId, p.use.id, {
        plan: change.plan,
        decision,
        status: decision.verdict === 'approve' ? 'awaiting_approval' : decision.verdict === 'block' ? 'blocked' : 'running',
      });
      planned.push({ id: p.use.id, name: tool.name, tool, input: p.input, plan: change, verdict: decision.verdict });
      if (decision.verdict === 'block') {
        const entry = useActivity.getState().add({
          source: 'assistant',
          mode: ctx.backend.mode,
          accountId: ctx.accountId,
          tool: tool.name,
          summary: change.plan.title,
          changes: change.plan.changes,
          status: 'blocked',
          error: decision.reasons.join(' '),
          conversationId: convId,
        });
        updateTool(convId, itemId, p.use.id, { activityId: entry.id, endedAt: Date.now() });
        results.set(
          p.use.id,
          err(p.use.id, `BLOCKED by the user's spending rules – nothing was changed. Reasons: ${decision.reasons.join(' ')} Do not retry this change; explain the rule to the user (they can adjust it under Indstillinger → Forbrug).`),
        );
      }
    } catch (e) {
      if (signal.aborted) throw e;
      results.set(p.use.id, err(p.use.id, errorMessage(e)));
      updateTool(convId, itemId, p.use.id, { status: 'error', error: errorMessage(e), endedAt: Date.now() });
    }
  }

  const approvals = new Map(planned.filter((x) => x.verdict === 'approve').map((x) => [x.id, requestApproval(x.id, signal)]));
  if (approvals.size) void nativeNotify('Godkendelse kræves', `${approvals.size} ændring${approvals.size === 1 ? '' : 'er'} venter på din godkendelse i XavierOS.`);

  for (const item of planned) {
    if (item.verdict === 'block') continue;
    let plan = item.plan.plan;
    let change = item.plan;
    let userEdits: { field: string; value: string }[] = [];
    let deselected: string[] = [];
    let userAdded: string[] = [];
    if (item.verdict === 'approve') {
      const answer = await approvals.get(item.id)!;
      if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
      if (!answer.approved) {
        const entry = plan
          ? useActivity.getState().add({
              source: 'assistant',
              mode: ctx.backend.mode,
              accountId: ctx.accountId,
              tool: item.name,
              summary: plan.title,
              changes: plan.changes,
              status: 'rejected',
              error: answer.note,
              conversationId: convId,
            })
          : null;
        updateTool(convId, itemId, item.id, { status: 'rejected', activityId: entry?.id, endedAt: Date.now() });
        results.set(
          item.id,
          err(item.id, `The user REJECTED this change – nothing was changed.${answer.note ? ` The user's comment: "${answer.note}"` : ''} Do not retry it unless the user asks.`),
        );
        continue;
      }
      const pick = plan?.pick;
      const excluded = pick && answer.excluded?.length ? answer.excluded : [];
      const added = pick?.add && answer.added?.length ? answer.added : [];
      if (answer.edits?.length || excluded.length || added.length) {
        // The user corrected values, ticked rows off or added their own: apply, validate and re-plan.
        let edited = applyEdits(item.input, answer.edits ?? []);
        if (pick && (excluded.length || added.length)) {
          edited = applyPicks(edited, pick.path, excluded, added.map((a) => ({ ...pick.add?.base, ...a })));
        }
        const check = item.tool.schema.safeParse(edited);
        if (!check.success) {
          const detail = check.error.issues.map((i) => i.message).join('; ');
          results.set(item.id, err(item.id, `The user's edits were invalid (${detail}) – nothing was changed.`));
          updateTool(convId, itemId, item.id, { status: 'error', error: `Ugyldig rettelse: ${detail}`, endedAt: Date.now() });
          continue;
        }
        change = await abortable(item.tool.plan(check.data, ctx), signal);
        plan = change.plan;
        userEdits = (answer.edits ?? []).map((e) => ({ field: e.path.join('.'), value: e.value }));
        deselected = excluded.map((i) => String(item.plan.plan?.changes[i]?.after ?? i));
        userAdded = added.map((a) => a.text);
        updateTool(convId, itemId, item.id, { plan: plan ?? undefined, input: check.data });
      }
      updateTool(convId, itemId, item.id, { status: 'running' });
    }
    try {
      const exec = await change.execute();
      const userChanges = {
        ...(userEdits.length ? { userEditedBeforeApproval: userEdits } : {}),
        // Rows the user chose not to add – don't propose them again unless asked.
        ...(deselected.length ? { userDeselected: deselected } : {}),
        ...(userAdded.length ? { userAddedThemselves: userAdded } : {}),
      };
      results.set(item.id, ok(item.id, Object.keys(userChanges).length ? { ...(exec.result as object), ...userChanges } : exec.result));
      let activityId: string | undefined;
      if (plan) {
        activityId = useActivity.getState().add({
          source: 'assistant',
          mode: ctx.backend.mode,
          accountId: ctx.accountId,
          tool: item.name,
          summary: plan.title,
          // Only what Microsoft confirmed (tools that verify by reading back report it).
          changes: exec.changes?.length ? exec.changes : plan.changes,
          status: 'success',
          conversationId: convId,
          undo: exec.undo ?? plan.undo,
        }).id;
        afterChange();
      }
      updateTool(convId, itemId, item.id, { status: 'done', summary: exec.summary, activityId, endedAt: Date.now() });
    } catch (e) {
      if (signal.aborted) throw e;
      if (plan) {
        useActivity.getState().add({
          source: 'assistant',
          mode: ctx.backend.mode,
          accountId: ctx.accountId,
          tool: item.name,
          summary: plan.title,
          changes: plan.changes,
          status: 'failed',
          error: errorMessage(e),
          conversationId: convId,
        });
      }
      results.set(item.id, err(item.id, errorMessage(e)));
      updateTool(convId, itemId, item.id, { status: 'error', error: errorMessage(e), endedAt: Date.now() });
    }
  }

  return uses.map((u) => results.get(u.id) ?? err(u.id, 'No result'));
}

/**
 * Collects streamed text/thinking deltas and writes them to the chat store at most
 * every 40 ms. Writing every token re-renders the whole chat (and any open menu)
 * dozens of times per frame, which is slow and can trip React's nested-update limit.
 */
function createDeltaBuffer(convId: string, itemId: string) {
  const pending = new Map<string, string>();
  let timer: ReturnType<typeof setTimeout> | null = null;
  const flush = () => {
    if (timer) clearTimeout(timer);
    timer = null;
    if (!pending.size) return;
    const batch = new Map(pending);
    pending.clear();
    updateAssistant(convId, itemId, (it) => ({
      ...it,
      parts: it.parts.map((p) => {
        const d = batch.get(p.id);
        return d && (p.type === 'text' || p.type === 'thinking') ? { ...p, text: p.text + d } : p;
      }),
    }));
  };
  return {
    push(id: string, text: string) {
      pending.set(id, (pending.get(id) ?? '') + text);
      timer ??= setTimeout(flush, 40);
    },
    flush,
  };
}

/* ----------------------------------- undo ----------------------------------- */

/** Re-applies the previous values of a logged change (user action from the Aktivitet page). */
export async function undoActivity(entryId: string): Promise<void> {
  const activity = useActivity.getState();
  const entry = activity.entries.find((e) => e.id === entryId);
  if (!entry?.undo) throw new Error('Denne ændring kan ikke fortrydes automatisk.');
  const tool = getTool(entry.undo.tool);
  if (!tool || tool.kind !== 'write') throw new Error('Fortryd-handlingen er ikke tilgængelig.');
  const { accountId } = useConnection.getState();
  if (accountId !== entry.accountId || useConnection.getState().mode !== entry.mode) {
    throw new Error('Skift til den konto (og tilstand), ændringen blev lavet på, for at fortryde den.');
  }
  const input = tool.schema.parse(entry.undo.input);
  const ctx = await buildToolContext('', new Map(), new AbortController().signal);
  const change = await tool.plan(input, ctx);
  await change.execute();
  activity.markUndone(entryId);
  activity.add({
    source: 'user',
    mode: entry.mode,
    accountId: entry.accountId,
    tool: entry.undo.tool,
    summary: `Fortrudt: ${entry.summary}`,
    changes: change.plan?.changes ?? [],
    status: 'success',
  });
  afterChange();
}
