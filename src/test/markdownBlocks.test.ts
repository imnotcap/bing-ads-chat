import { describe, expect, it } from 'vitest';
import { splitBlocks } from '@/features/chat/Markdown';

describe('splitBlocks', () => {
  it('splits at blank lines and keeps every character', () => {
    const text = '# Titel\n\nAfsnit et\nlinje to\n\n| a | b |\n|---|---|\n| 1 | 2 |\n\n- x\n- y';
    const blocks = splitBlocks(text);
    expect(blocks).toHaveLength(4);
    expect(blocks.join('\n')).toBe(text);
  });

  it('keeps code fences with blank lines together', () => {
    const text = 'Før\n\n```js\nconst a = 1;\n\nconst b = 2;\n```\n\nEfter';
    expect(splitBlocks(text)).toEqual(['Før\n', '```js\nconst a = 1;\n\nconst b = 2;\n```\n', 'Efter']);
  });

  it('keeps an indented continuation with its list item', () => {
    const text = '1. Første\n\n   mere om første\n2. Anden';
    expect(splitBlocks(text)).toEqual([text]);
  });
});
