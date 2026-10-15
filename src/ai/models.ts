/**
 * AI models offered in the app. Claude models are built in; Gemini models are
 * added by the admin under Indstillinger → AI-modeller (fetched from the Gemini
 * API with the admin's key). The admin also decides which models users can pick.
 * Prices are list prices in USD per million tokens (editable for Gemini).
 */
import { useSettings } from '@/stores/settings';

export type Provider = 'anthropic' | 'google';
export type ModelId = string;
export type Effort = 'low' | 'medium' | 'high' | 'xhigh' | 'max';

export interface ModelInfo {
  id: ModelId;
  provider: Provider;
  label: string;
  description: string;
  input: number;
  output: number;
  cacheRead: number;
  /** 5-minute cache writes cost 1.25× input (Claude). */
  cacheWrite: number;
}

export const CLAUDE_MODELS: ModelInfo[] = [
  {
    id: 'claude-opus-5-5',
    provider: 'anthropic',
    label: 'Claude Opus 5.5',
    description: 'Stærk analyse og pålidelig brug af værktøjer.',
    input: 4,
    output: 20,
    cacheRead: 0.2,
    cacheWrite: 5,
  },
  {
    id: 'claude-sonnet-5-5',
    provider: 'anthropic',
    label: 'Claude Sonnet 5.5',
    description: 'Hurtig og billigere – god til daglige spørgsmål.',
    input: 2,
    output: 10,
    cacheRead: 0.2,
    cacheWrite: 2.5,
  },
  {
    id: 'claude-haiku-5-5',
    provider: 'anthropic',
    label: 'Claude Haiku 5.5',
    description: 'Lynhurtig og den billigste Claude – god til daglig drift.',
    input: 0.1,
    output: 0.5,
    cacheRead: 0.01,
    cacheWrite: 0.125,
  },
  {
    id: 'claude-fable-5-1',
    provider: 'anthropic',
    label: 'Claude Fable 5.1',
    description: 'Mest kapable model – til de sværeste analyser. Dyrest.',
    input: 10,
    output: 50,
    cacheRead: 0.25,
    cacheWrite: 12.5,
  },
];

/** @deprecated use allModels() / availableModels() */
export const MODELS = CLAUDE_MODELS;

export const PROVIDER_LABELS: Record<Provider, string> = { anthropic: 'Claude (Anthropic)', google: 'Gemini (Google)' };

export const EFFORT_LABELS: Record<Effort, string> = {
  low: 'Lav – hurtigste svar',
  medium: 'Mellem – balanceret',
  high: 'Høj – grundig',
  xhigh: 'Meget høj – dybdegående',
  max: 'Maksimal – langsom og dyr',
};

/** Every model the app knows: built-in Claude models + the admin's Gemini models. */
export function allModels(): ModelInfo[] {
  return [...CLAUDE_MODELS, ...(useSettings.getState().ai.customModels ?? [])];
}

/** The models the admin has allowed (never empty – falls back to all). */
export function availableModels(): ModelInfo[] {
  const enabled = useSettings.getState().ai.enabledModels;
  const all = allModels();
  const list = enabled?.length ? all.filter((m) => enabled.includes(m.id)) : all;
  return list.length ? list : all;
}

export function modelInfo(id: string): ModelInfo {
  return (
    allModels().find((m) => m.id === id) ?? {
      id,
      provider: id.startsWith('gemini') ? 'google' : 'anthropic',
      label: id,
      description: '',
      input: 0,
      output: 0,
      cacheRead: 0,
      cacheWrite: 0,
    }
  );
}

export interface TokenUsage {
  input_tokens?: number | null;
  output_tokens?: number | null;
  cache_read_input_tokens?: number | null;
  cache_creation_input_tokens?: number | null;
}

export function costUsd(model: string, u: TokenUsage): number {
  const m = modelInfo(model);
  return (
    ((u.input_tokens ?? 0) * m.input +
      (u.output_tokens ?? 0) * m.output +
      (u.cache_read_input_tokens ?? 0) * m.cacheRead +
      (u.cache_creation_input_tokens ?? 0) * m.cacheWrite) /
    1_000_000
  );
}
