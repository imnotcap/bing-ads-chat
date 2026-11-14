import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { classify } from '@/lib/attachments';
import { excelDate, readWorkbook, workbookText } from '@/lib/xlsx';

const file = () => {
  const b = readFileSync('src/test/fixtures/sample.xlsx');
  return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
};

describe('Excel workbooks', () => {
  it('reads every sheet, with dates, times, percentages and line breaks as text', async () => {
    const sheets = await readWorkbook(file());
    expect(sheets.map((s) => s.name)).toEqual(['Kampagner', 'Tom', 'Søgeord']);
    expect(sheets[0]!.rows[1]).toEqual(['Search | Test', '2026-11-16', '3000', '3', '06:00', '-40 %']);
    expect(sheets[0]!.rows[2]).toEqual(['Linje med / linjeskift', '', '', 'SAND']);
    expect(sheets[2]!.rows[0]).toEqual(['kontorstol', '', 'Exact']);
  });

  it('gives the assistant one block per sheet, columns separated by tabs', async () => {
    const text = workbookText('plan.xlsx', await readWorkbook(file()));
    expect(text).toMatch(/^Excel-projektmappe "plan.xlsx" med 3 ark: "Kampagner", "Tom", "Søgeord"\./);
    expect(text).toContain('### Ark "Kampagner" (3 rækker, 6 kolonner');
    expect(text).toContain('Search | Test\t2026-11-16\t3000');
    expect(text).toContain('(tomt ark)');
  });

  it('accepts .xlsx as an attachment and converts Excel day numbers', () => {
    expect(classify({ name: 'Black Weeks.xlsx', type: '' })).toBe('text');
    expect(excelDate(46342)).toBe('2026-11-16');
  });
});
