/** Claude models offered in the app, with list prices (USD per million tokens). */

export type ModelId = 'claude-opus-5-5' | 'claude-sonnet-5-5' | 'claude-haiku-5-5' | 'claude-fable-5-1';
export type Effort = 'low' | 'medium' | 'high' | 'xhigh' | 'max';

export interface ModelInfo {
  id: ModelId;
  label: string;
  description: string;
  input: number;
  output: number;
  cacheRead: number;
  /** 5-minute cache writes cost 1.25× input. */
  cacheWrite: number;
}

export const MODELS: ModelInfo[] = [
  {
    id: 'claude-opus-5-5',
    label: 'Claude Opus 5.5',
    description: 'Anbefalet – stærk analyse og pålidelig brug af værktøjer.',
    input: 4,
    output: 20,
    cacheRead: 0.2,
    cacheWrite: 5,
  },
  {
    id: 'claude-sonnet-5-5',
    label: 'Claude Sonnet 5.5',
    description: 'Hurtig og billigere – god til daglige spørgsmål.',
    input: 2,
    output: 10,
    cacheRead: 0.2,
    cacheWrite: 2.5,
  },
  {
    id: 'claude-haiku-5-5',
    label: 'Claude Haiku 5.5',
    description: 'Lynhurtig og meget billig – til enkle opslag.',
    input: 0.1,
    output: 0.5,
    cacheRead: 0.01,
    cacheWrite: 0.125,
  },
  {
    id: 'claude-fable-5-1',
    label: 'Claude Fable 5.1',
    description: 'Mest kapable model – til de sværeste analyser. Dyrest.',
    input: 10,
    output: 50,
    cacheRead: 0.25,
    cacheWrite: 12.5,
  },
];

export const EFFORT_LABELS: Record<Effort, string> = {
  low: 'Lav – hurtigste svar',
  medium: 'Mellem – balanceret',
  high: 'Høj – grundig',
  xhigh: 'Meget høj – dybdegående',
  max: 'Maksimal – langsom og dyr',
};

export function modelInfo(id: string): ModelInfo {
  return MODELS.find((m) => m.id === id) ?? MODELS[0]!;
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
