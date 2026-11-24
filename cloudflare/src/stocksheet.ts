/**
 * The team's sold-out sheet ("udsolgt-ark") in Google Sheets: one row per product, columns
 * A–E. D is the status – Udsolgt, Fjernet or På lager – and E a date (when the product is
 * expected back). The item id (varenummer) and the name are found among A–C by their
 * headings, or by what the values look like.
 *
 * READ ONLY: signed in with the same service account as the notes sheet (gsc-chat), and every
 * request passes `assertStockSheetCall` first – the connected spreadsheet's layout and values
 * are read, nothing is ever written, cleared or deleted. Excluding and re-activating products
 * happens in Microsoft Advertising, from the app, after approval on a card.
 */
import { GOOGLE_TOKEN_URL, type FetchLike, type ServiceAccountKey } from './googleAds';
import { SheetError, parseSheetUrl, sheetsError, sheetsToken } from './notesheet';
import type { StockRow, StockStatus } from '../../src/workspace/types';

export type { StockRow, StockStatus };

const API = 'https://sheets.googleapis.com/v4/spreadsheets/';

export interface StockSheet {
  spreadsheetId: string;
  sheetId: number;
  /** The tab's title. */
  title: string;
  /** The document's title. */
  name: string;
  connectedBy: string;
  connectedAt: number;
  error?: string | null;
}

/* --------------------------------- the one gate --------------------------------- */

/** Only the token, and reading the connected spreadsheet's layout and values. */
export function assertStockSheetCall(spreadsheetId: string, url: string, init?: RequestInit): void {
  const method = (init?.method ?? 'GET').toUpperCase();
  if (url === GOOGLE_TOKEN_URL && method === 'POST') return;
  const base = API + spreadsheetId;
  if (method === 'GET' && (url.startsWith(`${base}?`) || url.startsWith(`${base}/values/`))) return;
  throw new SheetError(`Blokeret: udsolgt-arket må kun læses (${method} ${url.split('?')[0]}).`, 'blocked');
}

function gated(fetchFn: FetchLike, spreadsheetId: string): FetchLike {
  return async (url, init) => {
    assertStockSheetCall(spreadsheetId, url, init);
    return fetchFn(url, init);
  };
}

async function get<T>(f: FetchLike, token: string, url: string, who: string): Promise<T> {
  const res = await f(url, { headers: { Authorization: `Bearer ${token}` } });
  const text = await res.text();
  if (!res.ok) throw sheetsError(res.status, text, who);
  return JSON.parse(text || '{}') as T;
}

const quote = (title: string) => `'${title.replace(/'/g, "''")}'`;

/* ---------------------------------- the values ---------------------------------- */

/** Udsolgt / Fjernet / På lager – also with small spelling differences. */
export function parseStatus(v: unknown): StockStatus {
  const s = String(v ?? '').trim().toLowerCase();
  if (!s) return 'unknown';
  if (/udsolgt|sold ?out|ikke på lager|ikke paa lager|out of stock/.test(s)) return 'soldout';
  if (/fjern|udgå|udga|slettet|removed|discontinued/.test(s)) return 'removed';
  if (/på lager|paa lager|pa lager|in stock|tilbage/.test(s)) return 'instock';
  return 'unknown';
}

const MONTHS: Record<string, number> = { jan: 1, feb: 2, mar: 3, apr: 4, maj: 5, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, okt: 10, oct: 10, nov: 11, dec: 12 };
const iso = (y: number, m: number, d: number) => {
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d ? dt.toISOString().slice(0, 10) : null;
};

/**
 * Column E as an ISO date: a Sheets date (a serial number, days since 30-12-1899), or a date
 * typed as text – "24-11-2026", "24.11.26", "24/11", "2026-11-24", "24. nov. 2026". A date
 * without a year is this year's (next year's, when it is more than two months ago).
 */
export function parseDate(v: unknown, today: string): string | null {
  if (typeof v === 'number' && v > 20000 && v < 80000) return new Date(Date.UTC(1899, 11, 30) + Math.round(v) * 86_400_000).toISOString().slice(0, 10);
  const s = String(v ?? '').trim().toLowerCase();
  if (!s) return null;
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s);
  if (m) return iso(Number(m[1]), Number(m[2]), Number(m[3]));
  const thisYear = Number(today.slice(0, 4));
  const withYear = (d: number, mo: number, y: number | null) => {
    if (y !== null) return iso(y < 100 ? 2000 + y : y, mo, d);
    const guess = iso(thisYear, mo, d);
    if (!guess) return null;
    const ago = (Date.parse(today) - Date.parse(guess)) / 86_400_000;
    return ago > 60 ? iso(thisYear + 1, mo, d) : guess;
  };
  m = /^(\d{1,2})[-./ ](\d{1,2})(?:[-./ ](\d{2,4}))?$/.exec(s);
  if (m) return withYear(Number(m[1]), Number(m[2]), m[3] ? Number(m[3]) : null);
  m = /^(\d{1,2})\.?\s*([a-zæøå]{3})[a-zæøå]*\.?(?:\s+(\d{2,4}))?$/.exec(s);
  if (m && MONTHS[m[2]!]) return withYear(Number(m[1]), MONTHS[m[2]!]!, m[3] ? Number(m[3]) : null);
  return null;
}

const ID_HEADINGS = /^(varenr|varenummer|vare-?nr\.?|vare ?id|item ?id|sku|produkt-?id|produktnummer|id|ean|offer ?id)\.?$/i;
const NAME_HEADINGS = /^(navn|produkt|produktnavn|titel|title|vare|varenavn|beskrivelse|name)$/i;
const looksLikeId = (v: string) => /^[A-Za-z0-9][A-Za-z0-9._\-/]{2,49}$/.test(v) && /\d/.test(v);

/**
 * The rows of the sheet (A–E as returned by Sheets): a heading row is recognised and skipped,
 * the item id column is the one headed like "Varenummer" – else the column among A–C whose
 * values look most like ids – and the name the other column with the longest texts.
 */
export function stockRows(values: unknown[][], today: string): StockRow[] {
  const text = (v: unknown) => String(v ?? '').trim();
  let header = -1;
  let idCol = -1;
  let nameCol = -1;
  for (let r = 0; r < Math.min(values.length, 10); r++) {
    const cells = (values[r] ?? []).slice(0, 3).map(text);
    const i = cells.findIndex((c) => ID_HEADINGS.test(c));
    if (i >= 0 || (parseStatus(values[r]?.[3]) === 'unknown' && /status/i.test(text(values[r]?.[3])))) {
      header = r;
      idCol = i;
      nameCol = cells.findIndex((c) => NAME_HEADINGS.test(c));
      break;
    }
  }
  const data = values.map((row, r) => ({ row, r })).filter(({ r }) => r > header);
  if (idCol < 0) {
    const score = [0, 1, 2].map((c) => data.filter(({ row }) => looksLikeId(text(row?.[c]))).length);
    idCol = score.indexOf(Math.max(...score));
  }
  if (nameCol < 0 || nameCol === idCol) {
    const avg = [0, 1, 2].map((c) => (c === idCol ? -1 : data.reduce((n, { row }) => n + text(row?.[c]).length, 0)));
    nameCol = avg.indexOf(Math.max(...avg));
  }
  const out: StockRow[] = [];
  for (const { row, r } of data) {
    const itemId = text(row?.[idCol]);
    const statusText = text(row?.[3]);
    if (!itemId || !statusText) continue;
    out.push({ row: r + 1, itemId, title: text(row?.[nameCol]) || itemId, status: parseStatus(statusText), statusText, date: parseDate(row?.[4], today) });
  }
  return out;
}

/* ------------------------------------ reading ------------------------------------ */

/** Checks the link: the tab exists and its columns A–E can be read. */
export async function connectStockSheet(fetchFn: FetchLike, key: ServiceAccountKey, url: string, nowMs: number, by: string): Promise<StockSheet> {
  const { id, gid } = parseSheetUrl(url);
  const f = gated(fetchFn, id);
  const token = (await sheetsToken(f, key, nowMs)).value;
  const meta = await get<{ properties?: { title?: string }; sheets?: { properties?: { sheetId?: number; title?: string } }[] }>(
    f,
    token,
    `${API}${id}?fields=properties(title),sheets.properties(sheetId,title)`,
    key.clientEmail,
  );
  const tabs = (meta.sheets ?? []).map((s) => s.properties ?? {});
  const tab = (gid !== null ? tabs.find((t) => t.sheetId === gid) : tabs[0]) ?? tabs[0];
  if (!tab?.title) throw new SheetError('Fandt ingen faner i arket.', 'api');
  const sheet: StockSheet = { spreadsheetId: id, sheetId: tab.sheetId ?? 0, title: tab.title, name: meta.properties?.title ?? '', connectedBy: by, connectedAt: nowMs };
  const rows = await readStockRows(fetchFn, key, sheet, nowMs);
  if (!rows.some((r) => r.status !== 'unknown'))
    throw new SheetError(`Fandt ingen rækker med Udsolgt, Fjernet eller På lager i kolonne D i fanen "${tab.title}". Vælg linket til den fane, hvor produkterne står.`, 'api');
  return sheet;
}

/** All rows of the connected tab (A–E), with dates as Sheets stores them. */
export async function readStockRows(fetchFn: FetchLike, key: ServiceAccountKey, s: StockSheet, nowMs: number): Promise<StockRow[]> {
  const f = gated(fetchFn, s.spreadsheetId);
  const token = (await sheetsToken(f, key, nowMs)).value;
  const range = encodeURIComponent(`${quote(s.title)}!A1:E5000`);
  const res = await get<{ values?: unknown[][] }>(f, token, `${API}${s.spreadsheetId}/values/${range}?valueRenderOption=UNFORMATTED_VALUE&dateTimeRenderOption=SERIAL_NUMBER`, key.clientEmail);
  const today = new Date(nowMs).toISOString().slice(0, 10);
  return stockRows(res.values ?? [], today);
}
