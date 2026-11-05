import { describe, expect, it } from 'vitest';
import { parseServiceAccountKey, assertReadOnly } from '../../cloudflare/src/googleAds';
import { appendNotes, assertSheetCall, danishNow, findHeader, parseSheetUrl, pickWord, readSheet, sheetDate, sheetRows, sheetsError, type NoteSheet } from '../../cloudflare/src/notesheet';
import { noteRows } from '@/ai/notes';

const ID = '1AbCdEfGhIjKlMnOpQrStUvWxYz0123456789';

async function makeKey() {
  const pair = (await crypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify'])) as CryptoKeyPair;
  const der = Buffer.from(await crypto.subtle.exportKey('pkcs8', pair.privateKey)).toString('base64');
  const pem = `-----BEGIN PRIVATE KEY-----\n${der.match(/.{1,64}/g)!.join('\n')}\n-----END PRIVATE KEY-----\n`;
  return parseServiceAccountKey(JSON.stringify({ type: 'service_account', project_id: 'search-console-mcp-505407', private_key_id: 'k1', private_key: pem, client_email: 'gsc-chat@search-console-mcp-505407.iam.gserviceaccount.com' }));
}

const SHEET: NoteSheet = {
  spreadsheetId: ID,
  sheetId: 0,
  title: 'Ark1',
  name: 'Notatark til Google og Bing',
  headerRow: 2,
  columns: { Dato: 0, Tid: 1, Kampagne: 2, Annoncegruppe: 3, Emne: 4, Status: 5, Etiket: 6, Kommentar: 7 },
  known: { emne: ['Produkter', 'Annoncegruppe', 'Kampagne'], status: ['Færdig', 'Opfølgning'], etiket: ['Casper'], at: Date.now() },
  connectedBy: 'Casper',
  connectedAt: 0,
};

/** Google, faked: answers the token, the layout, the values and the append – and records every call. */
function fakeGoogle() {
  const calls: { url: string; method: string; body?: string }[] = [];
  const fetchFn = async (url: string, init?: RequestInit) => {
    calls.push({ url, method: (init?.method ?? 'GET').toUpperCase(), body: init?.body ? String(init.body) : undefined });
    const ok = (b: unknown) => new Response(JSON.stringify(b), { status: 200 });
    if (url.startsWith('https://oauth2.googleapis.com/token')) return ok({ access_token: 't', expires_in: 3600 });
    if (url.includes(':append?')) return ok({ updates: { updatedRows: 1 } });
    if (url.includes('values:batchGet')) return ok({ valueRanges: [{ values: [['Produkter'], ['Produkter'], ['Kampagne']] }, { values: [['Færdig'], ['Opfølgning']] }, { values: [['Casper']] }] });
    if (url.includes('/values/')) return ok({ values: [[], ['Dato', 'Tid', 'Kampagne', 'Annoncegruppe', 'Emne', 'Status', 'Etiket', 'Kommentar']] });
    return ok({ properties: { title: 'Notatark til Google og Bing', locale: 'da_DK' }, sheets: [{ properties: { sheetId: 0, title: 'Ark1' } }, { properties: { sheetId: 77, title: 'Andet' } }] });
  };
  return { calls, fetchFn };
}

describe('the notes sheet – only reading its layout and adding rows', () => {
  it('reads the id and tab from a link', () => {
    expect(parseSheetUrl(`https://docs.google.com/spreadsheets/d/${ID}/edit#gid=77`)).toEqual({ id: ID, gid: 77 });
    expect(() => parseSheetUrl('https://example.com')).toThrow(/ikke et link til et Google Sheet/);
  });

  it('lets nothing through but the layout, values and an append to the connected sheet', () => {
    const base = `https://sheets.googleapis.com/v4/spreadsheets/${ID}`;
    expect(() => assertSheetCall(ID, `${base}?fields=sheets.properties`)).not.toThrow();
    expect(() => assertSheetCall(ID, `${base}/values/Ark1!A1:Z10`)).not.toThrow();
    expect(() => assertSheetCall(ID, `${base}/values/Ark1!A2:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`, { method: 'POST' })).not.toThrow();
    // Writing over cells, clearing, deleting, batchUpdate, another sheet – refused.
    expect(() => assertSheetCall(ID, `${base}/values/Ark1!A5?valueInputOption=USER_ENTERED`, { method: 'PUT' })).toThrow(/Blokeret/);
    expect(() => assertSheetCall(ID, `${base}/values/Ark1!A5:clear`, { method: 'POST' })).toThrow(/Blokeret/);
    expect(() => assertSheetCall(ID, `${base}:batchUpdate`, { method: 'POST' })).toThrow(/Blokeret/);
    expect(() => assertSheetCall(ID, `${base}/values/Ark1!A2:append?valueInputOption=USER_ENTERED&insertDataOption=OVERWRITE`, { method: 'POST' })).toThrow(/Blokeret/);
    expect(() => assertSheetCall(ID, 'https://sheets.googleapis.com/v4/spreadsheets/someOtherSheetId1234567890/values/A1', {})).toThrow(/Blokeret/);
    expect(() => assertSheetCall(ID, 'https://googleads.googleapis.com/v21/customers/1/googleAds:mutate', { method: 'POST' })).toThrow(/Blokeret/);
  });

  it('leaves Google Ads read only – a Sheets call is refused by the Ads gate too', () => {
    expect(() => assertReadOnly(`https://sheets.googleapis.com/v4/spreadsheets/${ID}/values/A1:append`, { method: 'POST' })).toThrow(/kun læse fra Google Ads/);
  });

  it('finds the headings, wherever the table starts', () => {
    expect(findHeader([['Tabel1'], ['Dato', 'Tid', 'Kampagne', 'Annoncegruppe', 'Emne', 'Status', 'Etiket', 'Kommentar']])).toEqual({ headerRow: 2, columns: SHEET.columns });
    expect(findHeader([['a', 'b']])).toBeNull();
  });

  it('uses the words the sheet already uses', () => {
    expect(pickWord(['Negative søgeord', 'Søgeord', 'Annoncegruppe'], SHEET.known.emne)).toBe('Annoncegruppe');
    expect(pickWord(['casper'], SHEET.known.etiket)).toBe('Casper');
    expect(pickWord(['Søgeord'], [])).toBe('Søgeord');
  });

  it('builds a row like the team\'s own, with Danish date and time', () => {
    const now = Date.UTC(2026, 10, 2, 12, 36); // 13:36 in Copenhagen
    expect(danishNow(now)).toEqual({ date: '2026-11-02', time: '13:36' });
    const [row] = sheetRows(SHEET, [{ campaign: 'Shopping | Lager', adGroup: 'Pallestativer', topics: ['Produkter'], comment: 'Tilføjede c073283018 m. bud på 10,05 kr.' }], 'Casper Hansen', now);
    expect(row).toEqual(['2-11-2026', '13:36', 'Shopping | Lager', 'Pallestativer', 'Produkter', 'Færdig', 'Casper', 'Tilføjede c073283018 m. bud på 10,05 kr.']);
    // A comment that would be read as a formula stays text.
    expect(sheetRows(SHEET, [{ campaign: '', adGroup: '', topics: [], comment: '=HYPERLINK("x")' }], 'C', now)[0]![7]).toBe('\'=HYPERLINK("x")');
  });

  it('writes the date day-month-year like the team – but never so it reads as another date', () => {
    expect(sheetDate('2026-11-02', 'da_DK')).toBe('2-11-2026');
    expect(sheetDate('2026-10-29', undefined)).toBe('29-10-2026');
    expect(sheetDate('2026-11-02', 'en_US')).toBe('2026-11-02');
  });

  it('reads the layout of the linked tab, then appends below the table', async () => {
    const key = await makeKey();
    const g = fakeGoogle();
    const sheet = await readSheet(g.fetchFn, key, `https://docs.google.com/spreadsheets/d/${ID}/edit#gid=0`, Date.now(), 'Casper');
    expect(sheet).toMatchObject({ title: 'Ark1', headerRow: 2, name: 'Notatark til Google og Bing', locale: 'da_DK' });
    expect(sheet.known.emne[0]).toBe('Produkter');
    const after = await appendNotes(g.fetchFn, key, sheet, [{ campaign: 'K', adGroup: 'G', topics: ['Produkter'], comment: 'Ekskluderede 1' }], 'Casper', Date.now());
    const append = g.calls.find((c) => c.url.includes(':append?'))!;
    expect(append.method).toBe('POST');
    expect(decodeURIComponent(append.url)).toContain("'Ark1'!A2:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS");
    expect(JSON.parse(append.body!).values[0][7]).toBe('Ekskluderede 1');
    expect(after.lastWrite?.rows).toBe(1);
    // Only GETs and the one append went to Sheets.
    expect(g.calls.filter((c) => c.url.includes('sheets.googleapis.com') && c.method !== 'GET')).toHaveLength(1);
  });

  it('tells a Sheets API that is turned off apart from a sheet that is not shared', () => {
    const disabled = JSON.stringify({
      error: {
        code: 403,
        message: 'Google Sheets API has not been used in project 123456789012 before or it is disabled. Enable it by visiting https://console.developers.google.com/apis/api/sheets.googleapis.com/overview?project=123456789012 then retry.',
        status: 'PERMISSION_DENIED',
        details: [{ '@type': 'type.googleapis.com/google.rpc.ErrorInfo', reason: 'SERVICE_DISABLED', metadata: { consumer: 'projects/123456789012', service: 'sheets.googleapis.com' } }],
      },
    });
    expect(sheetsError(403, disabled, 'gsc-chat@x').message).toMatch(/Google Sheets API er ikke slået til.*\(123456789012\).*sheets\.googleapis\.com\?project=123456789012/);
    const denied = JSON.stringify({ error: { code: 403, message: 'The caller does not have permission', status: 'PERMISSION_DENIED' } });
    expect(sheetsError(403, denied, 'gsc-chat@x').message).toMatch(/Del arket med gsc-chat@x som redaktør.*The caller does not have permission/);
  });

  it('says what to do when the sheet is not shared with the service account', async () => {
    const key = await makeKey();
    const fetchFn = async (url: string) =>
      url.startsWith('https://oauth2') ? new Response(JSON.stringify({ access_token: 't', expires_in: 3600 })) : new Response('{"error":{"message":"The caller does not have permission","status":"PERMISSION_DENIED"}}', { status: 403 });
    await expect(readSheet(fetchFn, key, `https://docs.google.com/spreadsheets/d/${ID}/edit`, Date.now(), 'C')).rejects.toThrow(/Del arket med gsc-chat@search-console-mcp-505407/);
  });
});

describe('the rows for a confirmed change', () => {
  it('writes product groups the way the team does', () => {
    const rows = noteRows(
      [
        { entity: 'Produktgruppe', field: 'Pallestativer · Byd på varenummer c073283018', after: 'c073283018', cells: { group: 'Pallestativer', kind: 'Byd', bid: 10.05 } },
        { entity: 'Produktgruppe', field: 'Pallestativer · Byd på varenummer c073283019', after: 'c073283019', cells: { group: 'Pallestativer', kind: 'Byd', bid: 10.05 } },
        { entity: 'Produktgruppe', field: 'Højborde · Udeluk', after: '2714230214', cells: { group: 'Højborde', kind: 'Udeluk', bid: null } },
      ],
      'Shopping | Lager & Værksted | Lagerreoler',
      'DKK',
    );
    expect(rows).toEqual([
      { campaign: 'Shopping | Lager & Værksted | Lagerreoler', adGroup: 'Pallestativer', topics: ['Produkter'], comment: expect.stringMatching(/^Tilføjede c073283018, c073283019 m\. bud på 10,05\s?kr\.$/) },
      { campaign: 'Shopping | Lager & Værksted | Lagerreoler', adGroup: 'Højborde', topics: ['Produkter'], comment: 'Ekskluderede 2714230214' },
    ]);
  });

  it('writes negatives and bid changes', () => {
    const rows = noteRows(
      [
        { entity: 'Negativt søgeord', field: 'x', after: 'gratis', cells: { target: 'Hele kampagnen', matchType: 'Phrase' } },
        { entity: 'Søgeord', field: 'kontorstol · bud', before: 8, after: 10.05 },
      ],
      'Kontorstole',
      'DKK',
    );
    expect(rows[0]).toMatchObject({ adGroup: '', topics: ['Negative søgeord', 'Søgeord', 'Annoncegruppe'], comment: 'Tilføjede negative søgeord: gratis (phrase)' });
    expect(rows[1]!.comment).toMatch(/^Ændrede bud fra 8\s?kr\. til 10,05\s?kr\.$/);
  });
});
