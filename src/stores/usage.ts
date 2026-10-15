import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { costUsd, type TokenUsage } from '@/ai/models';
import { monthKey } from '@/lib/format';

export interface UsageBucket {
  requests: number;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  costUsd: number;
}

const EMPTY: UsageBucket = { requests: 0, inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, costUsd: 0 };

interface UsageState {
  /** month (YYYY-MM) → model → bucket */
  months: Record<string, Record<string, UsageBucket>>;
  record: (model: string, usage: TokenUsage) => number;
  reset: () => void;
}

export const useUsage = create<UsageState>()(
  persist(
    (set) => ({
      months: {},
      record: (model, usage) => {
        const cost = costUsd(model, usage);
        const m = monthKey();
        set((s) => {
          const month = { ...(s.months[m] ?? {}) };
          const b = month[model] ?? EMPTY;
          month[model] = {
            requests: b.requests + 1,
            inputTokens: b.inputTokens + (usage.input_tokens ?? 0),
            outputTokens: b.outputTokens + (usage.output_tokens ?? 0),
            cacheReadTokens: b.cacheReadTokens + (usage.cache_read_input_tokens ?? 0),
            cacheWriteTokens: b.cacheWriteTokens + (usage.cache_creation_input_tokens ?? 0),
            costUsd: b.costUsd + cost,
          };
          return { months: { ...s.months, [m]: month } };
        });
        return cost;
      },
      reset: () => set({ months: {} }),
    }),
    { name: 'bac.usage', version: 1 },
  ),
);

export function monthTotal(months: UsageState['months'], key = monthKey()): UsageBucket {
  return Object.values(months[key] ?? {}).reduce<UsageBucket>(
    (acc, b) => ({
      requests: acc.requests + b.requests,
      inputTokens: acc.inputTokens + b.inputTokens,
      outputTokens: acc.outputTokens + b.outputTokens,
      cacheReadTokens: acc.cacheReadTokens + b.cacheReadTokens,
      cacheWriteTokens: acc.cacheWriteTokens + b.cacheWriteTokens,
      costUsd: acc.costUsd + b.costUsd,
    }),
    EMPTY,
  );
}
