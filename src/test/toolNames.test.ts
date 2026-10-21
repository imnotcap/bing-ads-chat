import { describe, expect, it } from 'vitest';
import { withoutToolNames } from '@/features/chat/toolNames';

describe('tool names in replies', () => {
  it('leaves out lines that are just a tool name', () => {
    expect(withoutToolNames('Bemærk: websøgning er slået fra.\n\nsuggest_next_steps:\n\n')).toBe('Bemærk: websøgning er slået fra.\n\n');
    expect(withoutToolNames('Tekst\n`list_campaigns()`\n**find_campaigns_and_ad_groups**:\nMere')).toBe('Tekst\nMere');
  });

  it('keeps tool names inside normal sentences and other text', () => {
    const t = 'Jeg kan bruge auktionsindsigt.\n- Søgeord: suggest_next_steps er ikke et ord her';
    expect(withoutToolNames(t)).toBe(t);
  });
});
