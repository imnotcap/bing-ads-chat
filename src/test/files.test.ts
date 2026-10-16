import { describe, expect, it } from 'vitest';
import { getTool } from '@/ai/tools';
import { enabledTools } from '@/ai/connectors';
import type { ReadTool, ToolContext } from '@/ai/tools/context';

const tool = getTool('create_file') as ReadTool;

describe('create_file', () => {
  it('accepts text files and refuses folders and other types', () => {
    expect(tool.schema.safeParse({ fileName: 'negative-søgeord.csv', content: 'Søgeord;Match\nbrugt;Phrase' }).success).toBe(true);
    expect(tool.schema.safeParse({ fileName: 'Påmindelse.ics', content: 'BEGIN:VCALENDAR' }).success).toBe(true);
    expect(tool.schema.safeParse({ fileName: 'mappe/fil.csv', content: 'x' }).success).toBe(false);
    expect(tool.schema.safeParse({ fileName: 'rapport.xlsx', content: 'x' }).success).toBe(false);
    expect(tool.schema.safeParse({ fileName: 'virus.exe', content: 'x' }).success).toBe(false);
  });

  it('shows the file as a card instead of text', async () => {
    const out = await tool.run({ fileName: 'tjekliste.md', content: '- [ ] Tjek CPA', description: 'Tjekliste' }, {} as ToolContext);
    expect(out.visual).toEqual({ type: 'file', fileName: 'tjekliste.md', content: '- [ ] Tjek CPA', description: 'Tjekliste' });
  });

  it('is available even when visuals are switched off', () => {
    expect(enabledTools({ visuals: false }).some((t) => t.name === 'create_file')).toBe(true);
  });
});
