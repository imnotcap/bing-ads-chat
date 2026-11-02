/**
 * The team's notes sheet ("Notatark til Google og Bing"): after every change Microsoft has
 * confirmed, the app adds one row per ad group at the bottom of the sheet's table – Dato,
 * Tid, Kampagne, Annoncegruppe, Emne, Status, Etiket, Kommentar – like the rows the team
 * writes by hand.
 *
 * Signed in with the same service account as the audit (gsc-chat), but with its own token
 * for Google Sheets only (the Google Ads token never gets this scope), and every request
 * passes `assertSheetCall` first: the one spreadsheet that was connected, and only reading
 * its layout and header and appending rows – never editing, clearing or deleting anything.
 */
import { GOOGLE_TOKEN_URL, GoogleAdsError, assertAllowedServiceAccount, signAssertion, type FetchLike, type GoogleToken, type ServiceAccountKey } from './googleAds';

export const SHEETS_SCOPE = 'https://www.googleapis.com/auth/spreadsheets';
const API = 'https://sheets.googleapis.com/v4/spreadsheets/';

/** The columns a note has, by their headings in the sheet. */
export const NOTE_FIELDS = ['Dato', 'Tid', 'Kampagne', 'Annoncegruppe', 'Emne', 'Status', 'Etiket', 'Kommentar'] as const;
export type NoteField = (typeof NOTE_FIELDS)[number];

/** What the app sends for a row; the Worker adds the date, time, status and who. */
export interface NoteInput {
  campaign: string;
  adGroup: string;
  /** What was changed: Produkter, Annoncegruppe, Kampagne, Søgeord … (matched to the sheet's own words). */
  topics: string[];
  comment: string;
}

export interface NoteSheet {
  spreadsheetId: string;
  sheetId: number;
  title: string;
  /** The sheet's own name (the document's title). */
  name: string;
  /** 1-based row of the headings, and each field's 0-based column. */
  headerRow: number;
  columns: Partial<Record<NoteField, number>>;
  /** The words already used in the dropdown columns – a new row uses the same ones. */
  known: { emne: string[]; status: string[]; etiket: string[]; at: number };
  connectedBy: string;
  connectedAt: number;
  lastWrite?: { at: number; rows: number } | null;
  error?: string | null;
}

export class SheetError extends GoogleAdsError {}

/* ----------------------------------- the url ----------------------------------- */

/** The spreadsheet id and tab (gid) from a link to the sheet. */
export function parseSheetUrl(url: string): { id: string; gid: number | null } {
  const m = /\/spreadsheets\/d\/([A-Za-z0-9_-]{20,})/.exec(url.trim());
  if (!m) throw new SheetError('Det er ikke et link til et Google Sheet. Kopiér adressen fra arket i browseren.', 'blocked');
  const gid = /[#?&]gid=(\d+)/.exec(url);
  return { id: m[1]!, gid: gid ? Number(gid[1]) : null };
}

/* --------------------------------- the one gate --------------------------------- */

/**
 * Every request to Google from here: the token, and for the connected spreadsheet only its
 * layout, a range of values, or an append. Anything else is refused before it leaves.
 */
export function assertSheetCall(spreadsheetId: string, url: string, init?: RequestInit): void {
  const method = (init?.method ?? 'GET').toUpperCase();
  if (url === GOOGLE_TOKEN_URL && method === 'POST') return;
  const base = API + spreadsheetId;
  if (method === 'GET' && (url.startsWith(`${base}?`) || url.startsWith(`${base}/values/`) || url.startsWith(`${base}/values:batchGet?`))) return;
  if (method === 'POST' && url.startsWith(`${base}/values/`) && /:append\?/.test(url) && /valueInputOption=USER_ENTERED/.test(url) && /insertDataOption=INSERT_ROWS/.test(url)) return;
  throw new SheetError(`Blokeret: notatarket må kun læses og have rækker tilføjet (${method} ${url.split('?')[0]}).`, 'blocked');
}

export function sheetFetch(fetchFn: FetchLike, spreadsheetId: string): FetchLike {
  return async (url, init) => {
    assertSheetCall(spreadsheetId, url, init);
    return fetchFn(url, init);
  };
}

/** A token for Google Sheets only – signed with the service account's key. */
export async function sheetsToken(fetchFn: FetchLike, key: ServiceAccountKey, nowMs: number): Promise<GoogleToken> {
  assertAllowedServiceAccount(key.clientEmail);
  const res = await fetchFn(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: await signAssertion(key, nowMs, SHEETS_SCOPE) }).toString(),
  });
  const body = (await res.json().catch(() => ({}))) as { access_token?: string; expires_in?: number; error?: string; error_description?: string };
  if (!res.ok || !body.access_token) throw new SheetError(`Google afviste service-kontoens nøgle til Google Sheets (${body.error_description ?? body.error ?? `HTTP ${res.status}`}).`, 'auth');
  return { value: body.access_token, expiresAt: nowMs + (body.expires_in ?? 3600) * 1000 };
}

async function call<T>(fetchFn: FetchLike, token: string, url: string, init: RequestInit = {}, who = ''): Promise<T> {
  const res = await fetchFn(url, { ...init, headers: { ...(init.headers ?? {}), Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } });
  const text = await res.text();
  if (!res.ok) {
    if (res.status === 403 || res.status === 404)
      throw new SheetError(`Service-kontoen har ikke adgang til arket. Del arket med ${who || 'service-kontoen'} som redaktør, og prøv igen.`, 'access');
    let why = text.slice(0, 200);
    try {
      why = (JSON.parse(text) as { error?: { message?: string } }).error?.message ?? why;
    } catch {
      /* the raw text */
    }
    throw new SheetError(`Google Sheets svarede ${res.status}: ${why}`, 'api');
  }
  return JSON.parse(text || '{}') as T;
}

/* ----------------------------------- the layout ----------------------------------- */

const quote = (title: string) => `'${title.replace(/'/g, "''")}'`;
const colName = (i: number) => {
  let s = '';
  for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
};
const norm = (v: unknown) => String(v ?? '').trim().toLowerCase();

/** The headings row (within the first rows) and the column of each field it names. */
export function findHeader(rows: unknown[][]): { headerRow: number; columns: Partial<Record<NoteField, number>> } | null {
  for (let r = 0; r < rows.length; r++) {
    const cells = (rows[r] ?? []).map(norm);
    const columns: Partial<Record<NoteField, number>> = {};
    for (const f of NOTE_FIELDS) {
      const i = cells.indexOf(f.toLowerCase());
      if (i >= 0) columns[f] = i;
    }
    if (columns.Dato !== undefined && columns.Kommentar !== undefined) return { headerRow: r + 1, columns };
  }
  return null;
}

/** The words used in a column, most used first (blank and the heading left out). */
function used(values: unknown[][] | undefined, heading: string): string[] {
  const count = new Map<string, number>();
  for (const row of values ?? []) {
    const v = String(row?.[0] ?? '').trim();
    if (v && v.toLowerCase() !== heading.toLowerCase()) count.set(v, (count.get(v) ?? 0) + 1);
  }
  return [...count].sort((a, b) => b[1] - a[1]).map(([v]) => v);
}

/** Reads the connected sheet's layout: the tab, its headings and the words its dropdown columns use. */
export async function readSheet(fetchFn: FetchLike, key: ServiceAccountKey, url: string, nowMs: number, by: string): Promise<NoteSheet> {
  const { id, gid } = parseSheetUrl(url);
  const f = sheetFetch(fetchFn, id);
  const token = (await sheetsToken(f, key, nowMs)).value;
  const meta = await call<{ properties?: { title?: string }; sheets?: { properties?: { sheetId?: number; title?: string } }[] }>(
    f,
    token,
    `${API}${id}?fields=properties.title,sheets.properties(sheetId,title)`,
    {},
    key.clientEmail,
  );
  const tabs = (meta.sheets ?? []).map((s) => s.properties ?? {});
  const tab = (gid !== null ? tabs.find((t) => t.sheetId === gid) : tabs[0]) ?? tabs[0];
  if (!tab?.title) throw new SheetError('Fandt ingen faner i arket.', 'api');
  const top = await call<{ values?: unknown[][] }>(f, token, `${API}${id}/values/${encodeURIComponent(`${quote(tab.title)}!A1:Z10`)}`, {}, key.clientEmail);
  const header = findHeader(top.values ?? []);
  if (!header) throw new SheetError(`Fandt ikke overskrifterne (Dato … Kommentar) i fanen "${tab.title}". Vælg linket til den fane, hvor noterne står.`, 'api');
  const sheet: NoteSheet = {
    spreadsheetId: id,
    sheetId: tab.sheetId ?? 0,
    title: tab.title,
    name: meta.properties?.title ?? '',
    ...header,
    known: { emne: [], status: [], etiket: [], at: 0 },
    connectedBy: by,
    connectedAt: nowMs,
  };
  sheet.known = await readKnown(f, token, sheet);
  return sheet;
}

/** The words in the Emne, Status and Etiket columns (one request). */
async function readKnown(f: FetchLike, token: string, s: NoteSheet): Promise<NoteSheet['known']> {
  const fields = ['Emne', 'Status', 'Etiket'] as const;
  const ranges = fields.map((k) => (s.columns[k] === undefined ? null : `${quote(s.title)}!${colName(s.columns[k]!)}${s.headerRow + 1}:${colName(s.columns[k]!)}`));
  const asked = ranges.filter((r): r is string => !!r);
  const res = asked.length
    ? await call<{ valueRanges?: { values?: unknown[][] }[] }>(f, token, `${API}${s.spreadsheetId}/values:batchGet?${asked.map((r) => `ranges=${encodeURIComponent(r)}`).join('&')}`)
    : { valueRanges: [] };
  let i = 0;
  const out = { emne: [] as string[], status: [] as string[], etiket: [] as string[], at: Date.now() };
  fields.forEach((k, j) => {
    if (!ranges[j]) return;
    out[k.toLowerCase() as 'emne' | 'status' | 'etiket'] = used(res.valueRanges?.[i++]?.values, k);
  });
  return out;
}

/* ----------------------------------- the rows ----------------------------------- */

/** The first of `wanted` the sheet already uses (in its own spelling) – else the first wanted. */
export function pickWord(wanted: string[], known: string[]): string {
  for (const w of wanted) {
    const hit = known.find((k) => norm(k) === norm(w));
    if (hit) return hit;
  }
  return wanted[0] ?? '';
}

/** A text cell that Sheets would read as a formula gets a leading apostrophe. */
const safe = (v: string) => (/^[=+\-@]/.test(v) ? `'${v}` : v);

const timeParts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Copenhagen', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });

/** Date (ISO – Sheets reads it as a date in every locale) and time in Denmark. */
export function danishNow(nowMs: number): { date: string; time: string } {
  const p = Object.fromEntries(timeParts.formatToParts(new Date(nowMs)).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}` };
}

/** The rows as the sheet's columns want them. */
export function sheetRows(s: NoteSheet, notes: NoteInput[], who: string, nowMs: number): string[][] {
  const { date, time } = danishNow(nowMs);
  const width = Math.max(...Object.values(s.columns).map((c) => c ?? 0)) + 1;
  const first = who.trim().split(/\s+/)[0] ?? '';
  return notes.map((n) => {
    const row = Array.from({ length: width }, () => '');
    const put = (f: NoteField, v: string) => {
      if (s.columns[f] !== undefined) row[s.columns[f]!] = safe(v);
    };
    put('Dato', date);
    put('Tid', time);
    put('Kampagne', n.campaign.slice(0, 300));
    put('Annoncegruppe', n.adGroup.slice(0, 300));
    put('Emne', pickWord(n.topics, s.known.emne));
    put('Status', pickWord(['Færdig'], s.known.status));
    put('Etiket', pickWord([first], s.known.etiket));
    put('Kommentar', n.comment.slice(0, 1000));
    return row;
  });
}

/** Adds the rows under the table (refreshing the dropdown words once a day). */
export async function appendNotes(fetchFn: FetchLike, key: ServiceAccountKey, s: NoteSheet, notes: NoteInput[], who: string, nowMs: number): Promise<NoteSheet> {
  const f = sheetFetch(fetchFn, s.spreadsheetId);
  const token = (await sheetsToken(f, key, nowMs)).value;
  const sheet = nowMs - s.known.at > 24 * 3600_000 ? { ...s, known: await readKnown(f, token, s) } : s;
  const range = encodeURIComponent(`${quote(sheet.title)}!A${sheet.headerRow}`);
  await call(f, token, `${API}${sheet.spreadsheetId}/values/${range}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`, {
    method: 'POST',
    body: JSON.stringify({ values: sheetRows(sheet, notes, who, nowMs) }),
  }, key.clientEmail);
  return { ...sheet, lastWrite: { at: nowMs, rows: notes.length }, error: null };
}
