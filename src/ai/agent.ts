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
import { getBackend } from '@/bing/backend';
import { getSpendStatus, invalidateSpendCache } from '@/bing/spend';
import { toContentBlocks, toMeta, type Attachment } from '@/lib/attachments';
import { DATE_PRESET_LABELS, presetRange } from '@/lib/format';
import { getSecret } from '@/lib/platform';
import { queryClient } from '@/lib/queryClient';
import { errorMessage, uid } from '@/lib/utils';
import { useActivity } from '@/stores/activity';
import { useChat, type ApiMessage, type AssistantItem, type Conversation, type Part, type ToolPart } from '@/stores/chat';
import { useConnection } from '@/stores/connection';
import { useSettings } from '@/stores/settings';
import { monthTotal, useUsage } from '@/stores/usage';
import { requestApproval } from './approvals';
import { evaluateGuardrails, type SpendContext } from './guardrails';
import { buildContextBlock, buildSystemPrompt } from './prompt';
import { getTool, toolDefinitions, type ToolContext } from './tools';
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

function toolLabel(name: string, input: unknown): string {
  const tool = getTool(name);
  if (!tool) return name;
  try {
    return tool.label(input as never);
  } catch {
    return tool.label.length ? name : tool.label({} as never);
  }
}

function serialize(result: unknown): string {
  const text = typeof result === 'string' ? result : JSON.stringify(result);
  if (text.length <= MAX_RESULT_CHARS) return text;
  return `${text.slice(0, MAX_RESULT_CHARS)}\n…[truncated – narrow the request with filters or a lower limit]`;
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

export async function sendMessage(convId: string, text: string, attachments: Attachment[] = []): Promise<void> {
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

  const apiKey = await getSecret('anthropic_api_key');
  if (!apiKey) return fail('Der er ingen Claude API-nøgle. Tilføj den under Indstillinger → Forbindelser.');
  const cap = settings.ai.monthlyAiBudgetUsd;
  if (cap !== null && monthTotal(useUsage.getState().months).costUsd >= cap) {
    return fail(`Månedens AI-budget på $${cap} er brugt. Hæv grænsen under Indstillinger → AI-assistent for at fortsætte.`);
  }

  repairHistory(convId);
  const period = presetRange(settings.datePreset);
  const context = buildContextBlock({
    account,
    mode: connection.mode,
    periodLabel: DATE_PRESET_LABELS[settings.datePreset],
    periodRange: period,
    rules: settings.spend,
  });
  const content: Anthropic.Beta.BetaContentBlockParam[] = [];
  if (context !== conv(convId).lastContext) content.push({ type: 'text', text: context });
  content.push(...toContentBlocks(attachments));
  content.push({ type: 'text', text: trimmed });
  chat.patch(convId, (c) => ({ api: [...c.api, { role: 'user', content }], lastContext: context }));

  const controller = new AbortController();
  controllers.set(convId, controller);
  chat.setRunning(convId, true);
  try {
    await runLoop(convId, itemId, apiKey, controller.signal);
    updateAssistant(convId, itemId, (it) => ({ ...it, status: it.status === 'streaming' ? 'done' : it.status }));
  } catch (err) {
    if (controller.signal.aborted) {
      updateAssistant(convId, itemId, (it) => ({
        ...it,
        status: 'stopped',
        parts: it.parts.map((p) =>
          p.type === 'tool' && (p.status === 'running' || p.status === 'streaming' || p.status === 'awaiting_approval') ? { ...p, status: 'stopped' } : p,
        ),
      }));
    } else {
      fail(friendlyError(err));
    }
  } finally {
    controllers.delete(convId);
    useChat.getState().setRunning(convId, false);
  }
}

/* --------------------------------- the loop --------------------------------- */

async function runLoop(convId: string, itemId: string, apiKey: string, signal: AbortSignal) {
  const settings = useSettings.getState();
  const { ai } = settings;
  // VITE_ANTHROPIC_BASE_URL is only used for local development against a mock server.
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true, maxRetries: 2, baseURL: import.meta.env.VITE_ANTHROPIC_BASE_URL || undefined });
  const tools = toolDefinitions();
  const system: Anthropic.Beta.BetaTextBlockParam[] = [{ type: 'text', text: buildSystemPrompt(settings.business) }];
  const memo = new Map<string, Promise<unknown>>();
  let jsonRetries = 0;

  for (let round = 1; ; round++) {
    if (round > ai.maxToolRounds) {
      notice(convId, itemId, 'warning', `Stoppede efter ${ai.maxToolRounds} værktøjsrunder. Skriv "fortsæt", hvis assistenten skal arbejde videre.`);
      return;
    }
    if (ai.monthlyAiBudgetUsd !== null && monthTotal(useUsage.getState().months).costUsd >= ai.monthlyAiBudgetUsd) {
      notice(convId, itemId, 'warning', 'Månedens AI-budget er brugt – assistenten stoppede her.');
      return;
    }

    const stream = client.beta.messages.stream(
      {
        model: ai.model,
        max_tokens: 32_000,
        system,
        tools,
        messages: conv(convId).api,
        thinking: { type: 'adaptive', display: ai.showThinking ? 'summarized' : 'omitted' },
        output_config: { effort: ai.effort },
        cache_control: { type: 'ephemeral' },
        // Server-side fallback if the model declines for policy reasons.
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
      },
      { signal },
    );

    const partIds = new Map<number, string>();
    let message: Anthropic.Beta.BetaMessage;
    try {
      for await (const ev of stream) {
        if (ev.type === 'content_block_start') {
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
          }
        } else if (ev.type === 'content_block_delta') {
          const id = partIds.get(ev.index);
          if (!id) continue;
          if (ev.delta.type === 'text_delta') {
            const d = ev.delta.text;
            updatePart(convId, itemId, id, (p) => (p.type === 'text' ? { ...p, text: p.text + d } : p));
          } else if (ev.delta.type === 'thinking_delta') {
            const d = ev.delta.thinking;
            updatePart(convId, itemId, id, (p) => (p.type === 'thinking' ? { ...p, text: p.text + d } : p));
          }
        } else if (ev.type === 'content_block_stop') {
          const id = partIds.get(ev.index);
          if (id) updatePart(convId, itemId, id, (p) => (p.type === 'thinking' ? { ...p, endedAt: Date.now() } : p));
        }
      }
      message = await stream.finalMessage();
      jsonRetries = 0;
    } catch (err) {
      if (signal.aborted || err instanceof Anthropic.APIError || jsonRetries++ >= 2) throw err;
      // Eager input streaming: a tool input that is not valid JSON – re-issue the turn.
      updateAssistant(convId, itemId, (it) => ({ ...it, parts: it.parts.filter((p) => !(p.type === 'tool' && p.status === 'streaming')) }));
      continue;
    }

    const cost = useUsage.getState().record(message.model || ai.model, message.usage);
    updateAssistant(convId, itemId, (it) => ({ ...it, costUsd: (it.costUsd ?? 0) + cost }));

    for (const b of message.content) {
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
      notice(convId, itemId, 'error', 'Svaret blev for langt og blev afbrudt, før værktøjet kunne køre. Prøv at dele opgaven op.');
      updateAssistant(convId, itemId, (it) => ({ ...it, parts: it.parts.map((p) => (p.type === 'tool' && p.status === 'streaming' ? { ...p, status: 'error', error: 'Afbrudt' } : p)) }));
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
  const ok = (id: string, result: unknown): ToolResult => ({ type: 'tool_result', tool_use_id: id, content: serialize(result) });
  const err = (id: string, message: string): ToolResult => ({ type: 'tool_result', tool_use_id: id, is_error: true, content: message });

  let ctx: ToolContext | null = null;
  try {
    ctx = await buildToolContext(convId, memo, signal);
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
          const out = await tool.run(p.input, ctx!);
          results.set(p.use.id, ok(p.use.id, out.result));
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
  const planned: { id: string; name: string; plan: Awaited<ReturnType<Extract<typeof writes[number]['tool'], { kind: 'write' }>['plan']>>; verdict: 'allow' | 'approve' | 'block' }[] = [];
  for (const p of writes) {
    const tool = p.tool!;
    if (tool.kind !== 'write') continue;
    updateTool(convId, itemId, p.use.id, { status: 'running' });
    try {
      const change = await tool.plan(p.input, ctx);
      if (!change.plan) {
        planned.push({ id: p.use.id, name: tool.name, plan: change, verdict: 'allow' });
        continue;
      }
      const decision = evaluateGuardrails(change.plan, ctx.rules, await spendContext(ctx));
      updateTool(convId, itemId, p.use.id, {
        plan: change.plan,
        decision,
        status: decision.verdict === 'approve' ? 'awaiting_approval' : decision.verdict === 'block' ? 'blocked' : 'running',
      });
      planned.push({ id: p.use.id, name: tool.name, plan: change, verdict: decision.verdict });
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

  for (const item of planned) {
    if (item.verdict === 'block') continue;
    const plan = item.plan.plan;
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
      updateTool(convId, itemId, item.id, { status: 'running' });
    }
    try {
      const exec = await item.plan.execute();
      results.set(item.id, ok(item.id, exec.result));
      let activityId: string | undefined;
      if (plan) {
        activityId = useActivity.getState().add({
          source: 'assistant',
          mode: ctx.backend.mode,
          accountId: ctx.accountId,
          tool: item.name,
          summary: plan.title,
          changes: plan.changes,
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
