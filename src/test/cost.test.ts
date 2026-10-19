import { describe, expect, it } from 'vitest';
import { costUsd } from '@/ai/models';

describe('costUsd', () => {
  it('prices one-hour cache writes at 2× input', () => {
    // Opus 5.5: $4 input, $5 per 5-minute write.
    const fiveMin = costUsd('claude-opus-5-5', { cache_creation_input_tokens: 1_000_000 });
    const hour = costUsd('claude-opus-5-5', { cache_creation_input_tokens: 1_000_000, cache_creation: { ephemeral_1h_input_tokens: 1_000_000 } });
    expect(fiveMin).toBeCloseTo(5);
    expect(hour).toBeCloseTo(8);
  });

  it('adds up every step when the conversation was compacted', () => {
    const cost = costUsd('claude-opus-5-5', {
      input_tokens: 1_000_000,
      iterations: [{ input_tokens: 1_000_000, output_tokens: 0 }, { input_tokens: 1_000_000 }],
    });
    expect(cost).toBeCloseTo(8);
  });
});
