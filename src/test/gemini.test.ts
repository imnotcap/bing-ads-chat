import { describe, expect, it } from 'vitest';
import { connectorContext, enabledTools } from '@/ai/connectors';
import { geminiTokenUsage, geminiTools, toGeminiContents } from '@/ai/gemini';
import type { ApiMessage } from '@/stores/chat';

describe('gemini conversion', () => {
  const history: ApiMessage[] = [
    { role: 'user', content: [{ type: 'text', text: '<context>…</context>' }, { type: 'text', text: 'Hvordan går det?' }] },
    {
      role: 'assistant',
      content: [
        { type: 'thinking', thinking: 'hmm', signature: 'x' },
        { type: 'text', text: 'Jeg kigger.' },
        { type: 'tool_use', id: 'gm_1', name: 'list_campaigns', input: { status: 'Active' } },
        { type: 'tool_use', id: 'gm_2', name: 'get_spend_status', input: {} },
      ],
    },
    {
      role: 'user',
      content: [
        { type: 'tool_result', tool_use_id: 'gm_1', content: '{"campaigns":[1,2]}' },
        { type: 'tool_result', tool_use_id: 'gm_2', content: 'boom', is_error: true },
      ],
    },
  ];

  it('maps roles, drops thinking and pairs function responses with their names', () => {
    const out = toGeminiContents(history, { gm_1: 'sig-1' });
    expect(out.map((c) => c.role)).toEqual(['user', 'model', 'user']);
    expect(out[1]!.parts.some((p) => 'thought' in p)).toBe(false);
    expect(out[1]!.parts[1]).toMatchObject({ functionCall: { name: 'list_campaigns', id: 'gm_1' }, thoughtSignature: 'sig-1' });
    expect(out[1]!.parts[2]!.thoughtSignature).toBeUndefined();
    expect(out[2]!.parts[0]).toMatchObject({ functionResponse: { name: 'list_campaigns', response: { campaigns: [1, 2] } } });
    expect(out[2]!.parts[1]).toMatchObject({ functionResponse: { name: 'get_spend_status', response: { error: 'boom' } } });
  });

  it('uses the documented placeholder signature for calls made by another model', () => {
    const out = toGeminiContents(history);
    expect(out[1]!.parts[1]!.thoughtSignature).toBe('skip_thought_signature_validator');
  });

  it('builds function declarations with JSON schemas and maps usage', () => {
    const decl = geminiTools(enabledTools({}))[0]!.functionDeclarations;
    expect(decl.find((d) => d.name === 'run_report')?.parametersJsonSchema).toMatchObject({ type: 'object' });
    expect(geminiTokenUsage({ promptTokenCount: 1000, cachedContentTokenCount: 400, candidatesTokenCount: 50, thoughtsTokenCount: 20 })).toEqual({
      input_tokens: 600,
      output_tokens: 70,
      cache_read_input_tokens: 400,
      cache_creation_input_tokens: 0,
    });
  });
});

describe('connectors', () => {
  it('removes the tools of disabled connectors but keeps follow-up suggestions', () => {
    const names = enabledTools({ msads_write: false, visuals: false, msads_api: false }).map((t) => t.name);
    expect(names).toContain('list_campaigns');
    expect(names).toContain('suggest_next_steps');
    expect(names).not.toContain('update_campaigns');
    expect(names).not.toContain('show_chart');
    expect(names).not.toContain('microsoft_ads_api');
  });

  it('tells the model what is off, including web search on Gemini', () => {
    expect(connectorContext({}, 'google')).toContain('Websøgning');
    expect(connectorContext({ web: true }, 'anthropic')).toBe('Connectors: all on.');
  });
});
