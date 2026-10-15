import { describe, expect, it } from 'vitest';
import { classify, readAttachment, toContentBlocks, type Attachment } from '@/lib/attachments';

describe('attachments', () => {
  it('classifies supported files', () => {
    expect(classify({ name: 'a.png', type: 'image/png' })).toBe('image');
    expect(classify({ name: 'rapport.PDF', type: '' })).toBe('pdf');
    expect(classify({ name: 'søgeord.csv', type: '' })).toBe('text');
    expect(classify({ name: 'data.xlsx', type: '' })).toBeNull();
  });

  it('reads text files and rejects Office files with a helpful message', async () => {
    const a = await readAttachment(new File(['a,b\n1,2'], 'data.csv', { type: 'text/csv' }));
    expect(a).toMatchObject({ kind: 'text', name: 'data.csv', data: 'a,b\n1,2' });
    await expect(readAttachment(new File(['x'], 'ark.xlsx'))).rejects.toThrow(/CSV/);
  });

  it('builds Messages API blocks', () => {
    const list: Attachment[] = [
      { id: '1', name: 'a.png', kind: 'image', size: 1, mediaType: 'image/png', data: 'AAA' },
      { id: '2', name: 'b.pdf', kind: 'pdf', size: 1, mediaType: 'application/pdf', data: 'BBB' },
      { id: '3', name: 'c.csv', kind: 'text', size: 1, mediaType: 'text/plain', data: 'x,y' },
    ];
    expect(toContentBlocks(list)).toEqual([
      { type: 'image', source: { type: 'base64', media_type: 'image/png', data: 'AAA' } },
      { type: 'document', title: 'b.pdf', source: { type: 'base64', media_type: 'application/pdf', data: 'BBB' } },
      { type: 'document', title: 'c.csv', source: { type: 'text', media_type: 'text/plain', data: 'x,y' } },
    ]);
  });
});
