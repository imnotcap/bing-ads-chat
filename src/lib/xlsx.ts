/**
 * Reads an Excel workbook (.xlsx / .xlsm) in the app – no library: the file is a zip of XML.
 * Every sheet becomes rows of text, dates as YYYY-MM-DD, and the whole workbook a text the
 * assistant reads like a CSV export: one block per sheet, columns separated by tabs.
 */
import { extractAll } from '@/bing/zip';

export interface Sheet {
  name: string;
  rows: string[][];
}

const decoder = new TextDecoder();
const xml = (bytes: Uint8Array | undefined) => (bytes ? new DOMParser().parseFromString(decoder.decode(bytes), 'application/xml') : null);
const els = (doc: Document | Element | null, tag: string) => (doc ? [...doc.getElementsByTagName(tag)] : []);

/** "C12" → 2 (zero-based column). */
function colIndex(ref: string): number {
  const letters = /^[A-Z]+/.exec(ref)?.[0] ?? 'A';
  let n = 0;
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

/** How a number cell is shown: a date, a time, a percentage – or as it is. Built-in ids from ECMA-376. */
type Kind = 'date' | 'time' | 'percent' | 'number';
const DATE_IDS = new Set([14, 15, 16, 17, 22, 27, 30, 36, 50, 57]);
const TIME_IDS = new Set([18, 19, 20, 21, 45, 46, 47]);
function kindOf(id: number, code: string | undefined): Kind {
  if (DATE_IDS.has(id)) return 'date';
  if (TIME_IDS.has(id)) return 'time';
  if (id === 9 || id === 10) return 'percent';
  if (!code) return 'number';
  const plain = code.replace(/"[^"]*"|\[[^\]]*\]|\\./g, '');
  if (plain.includes('%')) return 'percent';
  if (/[dy]/i.test(plain)) return 'date';
  if (/[hs]/i.test(plain)) return 'time';
  return 'number';
}

function show(v: number, kind: Kind): string {
  if (kind === 'date') return excelDate(v);
  if (kind === 'time') {
    const mins = Math.round((v % 1) * 1440);
    return `${String(Math.floor(mins / 60) % 24).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;
  }
  if (kind === 'percent') return `${String(Math.round(v * 10000) / 100).replace('.', ',')} %`;
  return String(v);
}

/** Excel's day number → YYYY-MM-DD (with a time when it has one). */
export function excelDate(serial: number): string {
  const ms = Math.round((serial - 25569) * 86_400_000);
  const d = new Date(ms);
  const day = d.toISOString().slice(0, 10);
  const time = d.toISOString().slice(11, 16);
  return time === '00:00' ? day : `${day} ${time}`;
}

export async function readWorkbook(data: ArrayBuffer): Promise<Sheet[]> {
  const files = await extractAll(data);
  const book = xml(files.get('xl/workbook.xml'));
  if (!book) throw new Error('Ikke en Excel-fil (.xlsx).');
  // Shared strings (with rich text runs joined).
  const shared = els(xml(files.get('xl/sharedStrings.xml')), 'si').map((si) => els(si, 't').map((t) => t.textContent ?? '').join(''));
  // Which cell styles are dates.
  const styles = xml(files.get('xl/styles.xml'));
  const custom = new Map(els(styles, 'numFmt').map((f) => [Number(f.getAttribute('numFmtId')), f.getAttribute('formatCode') ?? '']));
  const xfs = els(els(styles, 'cellXfs')[0] ?? null, 'xf').map((xf) => {
    const id = Number(xf.getAttribute('numFmtId') ?? 0);
    return kindOf(id, custom.get(id));
  });
  // Sheet names → their files, through the workbook's relationships.
  const rels = new Map(els(xml(files.get('xl/_rels/workbook.xml.rels')), 'Relationship').map((r) => [r.getAttribute('Id') ?? '', r.getAttribute('Target') ?? '']));
  const sheets: Sheet[] = [];
  for (const s of els(book, 'sheet')) {
    const rid = s.getAttribute('r:id') ?? s.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id') ?? '';
    const target = (rels.get(rid) ?? '').replace(/^\/?xl\//, '').replace(/^\//, '');
    const doc = xml(files.get(`xl/${target}`));
    if (!doc) continue;
    const rows: string[][] = [];
    for (const row of els(doc, 'row')) {
      const r = Number(row.getAttribute('r') ?? rows.length + 1) - 1;
      const cells: string[] = [];
      for (const c of els(row, 'c')) {
        const ref = c.getAttribute('r');
        const i = ref ? colIndex(ref) : cells.length;
        const type = c.getAttribute('t');
        const v = els(c, 'v')[0]?.textContent ?? '';
        let text: string;
        if (type === 's') text = shared[Number(v)] ?? '';
        else if (type === 'inlineStr') text = els(c, 't').map((t) => t.textContent ?? '').join('');
        else if (type === 'b') text = v === '1' ? 'SAND' : 'FALSK';
        else if (type === 'str' || type === 'e') text = v;
        else if (v !== '' && !Number.isNaN(Number(v))) text = show(Number(v), xfs[Number(c.getAttribute('s') ?? 0)] ?? 'number');
        else text = v;
        cells[i] = text.replace(/\s+/g, (m) => (m.includes('\n') ? ' / ' : ' ')).trim();
      }
      rows[r] = Array.from(cells, (x) => x ?? '');
    }
    sheets.push({ name: s.getAttribute('name') ?? `Ark ${sheets.length + 1}`, rows: Array.from(rows, (x) => x ?? []) });
  }
  return sheets;
}

/** The workbook as text for the assistant: every sheet, its size, and its rows separated by tabs. */
export function workbookText(fileName: string, sheets: Sheet[]): string {
  const parts = [`Excel-projektmappe "${fileName}" med ${sheets.length} ark: ${sheets.map((s) => `"${s.name}"`).join(', ')}.`];
  for (const s of sheets) {
    const rows = s.rows.map((r) => {
      let end = r.length;
      while (end > 0 && !r[end - 1]) end--;
      return r.slice(0, end);
    });
    while (rows.length && !rows[rows.length - 1]!.length) rows.pop();
    const filled = rows.filter((r) => r.length);
    const width = Math.max(0, ...filled.map((r) => r.length));
    parts.push(`\n### Ark "${s.name}" (${filled.length} rækker, ${width} kolonner; kolonner adskilt med tabulator)`);
    parts.push(rows.map((r) => r.join('\t')).join('\n') || '(tomt ark)');
  }
  return parts.join('\n');
}
