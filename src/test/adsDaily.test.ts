// @vitest-environment node
import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';
import { buildDailyAccountRequest, dailyFromRows } from '@/bing/dailyReport';
import { buildReportRequest } from '@/bing/reports';
import { addDays, daysBetween } from '@/lib/format';
import {
  DAILY_CALL_BUDGET,
  HISTORY_DAYS,
  MAX_SPAN_DAYS,
  TRAILING_DAYS,
  activeJob,
  backoffMs,
  callsUsed,
  copenhagen,
  coverageOf,
  enqueue,
  initAdsDaily,
  nextJob,
  officeHours,
  planSync,
  stateOf,
  stepJob,
  validRange,
  viewOf,
  type PlanInput,
  type Storage,
  type SyncDeps,
} from '../../cloudflare/src/adsDaily';

/* --------------------------------------------------------------- helpers */

/** A Durable Object's SQL storage on Node's own SQLite – the real statements run. */
function memoryStorage(): Storage & { db: DatabaseSync } {
  const db = new DatabaseSync(':memory:');
  const sql = {
    exec<T>(query: string, ...bindings: unknown[]) {
      const stmt = db.prepare(query);
      const rows = /^\s*SELECT/i.test(query) ? (stmt.all(...(bindings as never[])) as T[]) : (stmt.run(...(bindings as never[])), [] as T[]);
      return { toArray: () => rows };
    },
  };
  const storage = {
    db,
    sql: sql as Storage['sql'],
    transactionSync<T>(fn: () => T): T {
      db.exec('BEGIN');
      try {
        const r = fn();
        db.exec('COMMIT');
        return r;
      } catch (e) {
        db.exec('ROLLBACK');
        throw e;
      }
    },
  };
  initAdsDaily(storage.sql);
  return storage;
}

/** A ZIP holding one uncompressed file – the shape Microsoft delivers reports in. */
function storedZip(name: string, text: string): ArrayBuffer {
  const data = new TextEncoder().encode(text);
  const fname = new TextEncoder().encode(name);
  const local = new DataView(new ArrayBuffer(30));
  local.setUint32(0, 0x04034b50, true);
  local.setUint16(8, 0, true); // stored
  local.setUint32(18, data.length, true);
  local.setUint32(22, data.length, true);
  local.setUint16(26, fname.length, true);
  const cdOffset = 30 + fname.length + data.length;
  const cen = new DataView(new ArrayBuffer(46));
  cen.setUint32(0, 0x02014b50, true);
  cen.setUint16(10, 0, true);
  cen.setUint32(20, data.length, true);
  cen.setUint32(24, data.length, true);
  cen.setUint16(28, fname.length, true);
  cen.setUint32(42, 0, true);
  const eocd = new DataView(new ArrayBuffer(22));
  eocd.setUint32(0, 0x06054b50, true);
  eocd.setUint16(8, 1, true);
  eocd.setUint16(10, 1, true);
  eocd.setUint32(12, 46 + fname.length, true);
  eocd.setUint32(16, cdOffset, true);
  const parts = [new Uint8Array(local.buffer), fname, data, new Uint8Array(cen.buffer), fname, new Uint8Array(eocd.buffer)];
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out.buffer;
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

interface Call {
  url: string;
  headers: Record<string, string>;
  body: unknown;
}

/** A Microsoft that answers from a script, and remembers what it was asked. */
function fakeMicrosoft(script: ((call: Call) => Response | Promise<Response>)[]) {
  const calls: Call[] = [];
  const fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const call: Call = {
      url: String(input),
      headers: Object.fromEntries(Object.entries((init?.headers ?? {}) as Record<string, string>)),
      body: init?.body ? JSON.parse(String(init.body)) : null,
    };
    calls.push(call);
    const next = script.shift();
    if (!next) throw new Error(`Uventet kald: ${call.url}`);
    return next(call);
  };
  return { fetch, calls };
}

// Tuesday 27 October 2026, 10:00 in Copenhagen (09:00 UTC, winter time).
const NOW = Date.UTC(2026, 9, 27, 9, 0);
const TODAY = '2026-10-27';

function deps(fetch: SyncDeps['fetch'], now = NOW, fresh: boolean[] = []): SyncDeps {
  return {
    fetch,
    now: () => now,
    access: async (f) => {
      fresh.push(f);
      return { accessToken: f ? 'new-token' : 'token', developerToken: 'dev' };
    },
  };
}

const plan = (over: Partial<PlanInput>): PlanInput => ({
  now: NOW,
  today: TODAY,
  office: true,
  want: { from: '2026-10-01', to: TODAY },
  coverage: { from: addDays(TODAY, -HISTORY_DAYS), to: TODAY },
  state: { customerId: '9', trailingOn: TODAY, recentAt: NOW - 10 * 60_000, error: null, errorAt: null },
  active: false,
  blocked: false,
  manual: false,
  ...over,
});

const csv = (rows: string[][]) => ['TimePeriod,AccountName,Impressions,Clicks,Spend,Conversions,Revenue', ...rows.map((r) => r.join(','))].join('\r\n');

/* --------------------------------------------------------------- the report */

describe('daily report', () => {
  it('asks Microsoft for exactly the report the app has always asked for', () => {
    const range = { from: '2025-09-27', to: TODAY };
    expect(buildDailyAccountRequest('123', range)).toEqual(buildReportRequest('123', { kind: 'account', range, aggregation: 'Daily' }));
  });

  it('keeps every day of the range – a day without a row is a day without traffic', () => {
    const days = dailyFromRows(
      [
        { TimePeriod: '2026-10-25', Impressions: '100', Clicks: '5', Spend: '10.5', Conversions: '1.5', Revenue: '40' },
        // Microsoft can split a day; both halves count.
        { TimePeriod: '10/25/2026', Impressions: '20', Clicks: '1', Spend: '0.5', Conversions: '0', Revenue: '0' },
        { TimePeriod: '2026-09-01', Impressions: '999', Clicks: '9', Spend: '9', Conversions: '9', Revenue: '9' },
      ],
      { from: '2026-10-24', to: '2026-10-26' },
    );
    expect(days.map((d) => d.day)).toEqual(['2026-10-24', '2026-10-25', '2026-10-26']);
    expect(days[0]).toEqual({ day: '2026-10-24', impressions: 0, clicks: 0, spend: 0, conversions: 0, revenue: 0 });
    expect(days[1]).toEqual({ day: '2026-10-25', impressions: 120, clicks: 6, spend: 11, conversions: 1.5, revenue: 40 });
  });
});

/* --------------------------------------------------------------- time */

describe('Copenhagen time', () => {
  it('follows Danish winter and summer time and the date line at midnight', () => {
    expect(copenhagen(Date.UTC(2026, 9, 27, 7, 17))).toEqual({ date: '2026-10-27', weekday: 2, hour: 8 });
    expect(copenhagen(Date.UTC(2026, 6, 1, 7, 17))).toEqual({ date: '2026-07-01', weekday: 3, hour: 9 });
    expect(copenhagen(Date.UTC(2026, 9, 26, 23, 30)).date).toBe('2026-10-27');
  });

  it('counts weekdays 8–16 as office hours', () => {
    expect(officeHours({ weekday: 1, hour: 7 })).toBe(false);
    expect(officeHours({ weekday: 1, hour: 8 })).toBe(true);
    expect(officeHours({ weekday: 5, hour: 15 })).toBe(true);
    expect(officeHours({ weekday: 5, hour: 16 })).toBe(false);
    expect(officeHours({ weekday: 6, hour: 10 })).toBe(false);
  });
});

/* --------------------------------------------------------------- deciding */

describe('what to fetch', () => {
  it('fills 13 months the first time, whatever the hour', () => {
    const p = planSync(plan({ coverage: null, state: null, office: false }));
    expect(p).toEqual({ range: { from: addDays(TODAY, -HISTORY_DAYS), to: TODAY }, reason: 'history' });
    expect(daysBetween(p!.range.from, p!.range.to)).toBeLessThanOrEqual(MAX_SPAN_DAYS);
  });

  it('never orders a second report while one is on its way', () => {
    expect(planSync(plan({ active: true, coverage: null }))).toBeNull();
    expect(planSync(plan({ active: true, manual: true }))).toBeNull();
  });

  it('fetches older days when someone scrolls back to them', () => {
    const coverage = { from: '2025-10-01', to: TODAY };
    expect(planSync(plan({ coverage, want: { from: '2025-08-01', to: '2025-08-31' }, office: false }))).toEqual({
      range: { from: '2025-08-01', to: '2025-09-30' },
      reason: 'older',
    });
  });

  it('reads the last 30 days again once a day in office hours', () => {
    expect(planSync(plan({ state: { customerId: '9', trailingOn: '2026-10-26', recentAt: NOW - 60_000, error: null, errorAt: null } }))).toEqual({
      range: { from: addDays(TODAY, -TRAILING_DAYS), to: TODAY },
      reason: 'trailing',
    });
  });

  it('refreshes today at most every half hour – and only in office hours', () => {
    expect(planSync(plan({}))).toBeNull(); // 10 minutes ago
    const later = plan({ state: { customerId: '9', trailingOn: TODAY, recentAt: NOW - 31 * 60_000, error: null, errorAt: null } });
    expect(planSync(later)).toEqual({ range: { from: '2026-10-25', to: TODAY }, reason: 'recent' });
    expect(planSync({ ...later, office: false })).toBeNull();
  });

  it('lets Opdatér through outside office hours, but not more than every 5 minutes', () => {
    const state = { customerId: '9', trailingOn: TODAY, recentAt: NOW - 3 * 60_000, error: null, errorAt: null };
    expect(planSync(plan({ office: false, manual: true, state }))).toBeNull();
    expect(planSync(plan({ office: false, manual: true, state: { ...state, recentAt: NOW - 6 * 60_000 } }))?.reason).toBe('recent');
  });

  it('closes a gap after the last stored day instead of leaving it', () => {
    const p = planSync(plan({ coverage: { from: '2025-10-01', to: '2026-10-17' }, state: { customerId: '9', trailingOn: TODAY, recentAt: NOW - 40 * 60_000, error: null, errorAt: null } }));
    expect(p).toEqual({ range: { from: '2026-10-18', to: TODAY }, reason: 'recent' });
  });

  it('fills a very long gap forward in report-sized pieces, never cutting off the start', () => {
    const coverage = { from: '2024-01-01', to: '2024-12-31' };
    const p = planSync(plan({ coverage, want: { from: '2025-01-01', to: TODAY }, state: null }));
    expect(p!.range.from).toBe('2025-01-01');
    expect(daysBetween(p!.range.from, p!.range.to)).toBe(MAX_SPAN_DAYS);
  });

  it('waits after a failure and when the keys are refused – unless someone presses Opdatér', () => {
    const failed = { customerId: '9', trailingOn: null, recentAt: null, error: 'x', errorAt: NOW - 5 * 60_000 };
    expect(planSync(plan({ state: failed }))).toBeNull();
    expect(planSync(plan({ state: failed, manual: true }))?.reason).toBe('trailing');
    expect(planSync(plan({ blocked: true, state: { ...failed, errorAt: null } }))).toBeNull();
    expect(planSync(plan({ blocked: true, manual: true, state: { ...failed, errorAt: null } }))?.reason).toBe('trailing');
  });

  it('backs off 30 seconds, then doubling, never more than 30 minutes', () => {
    expect([1, 2, 3, 4, 8].map(backoffMs)).toEqual([30_000, 60_000, 120_000, 240_000, 1_800_000]);
  });

  it('accepts only real, ordered and not absurdly long ranges', () => {
    expect(validRange('2026-10-01', '2026-10-27')).toEqual({ from: '2026-10-01', to: '2026-10-27' });
    expect(validRange('2026-10-27', '2026-10-01')).toBeNull();
    expect(validRange('2026-10-1', '2026-10-27')).toBeNull();
    expect(validRange(null, '2026-10-27')).toBeNull();
    expect(validRange('2023-01-01', '2026-10-27')).toBeNull();
  });
});

/* --------------------------------------------------------------- fetching */

const ACCOUNT = { accountId: '187654321', customerId: '99' };

function queue(storage: Storage, range = { from: '2026-10-25', to: TODAY }, now = NOW) {
  expect(enqueue(storage, { ...ACCOUNT, range, reason: 'recent' }, now)).toBe(true);
  return nextJob(storage.sql)!;
}

describe('fetching a report', () => {
  it('orders, waits, downloads and stores every day – then marks the account fresh', async () => {
    const storage = memoryStorage();
    const ms = fakeMicrosoft([
      () => json({ ReportRequestId: 'R1' }),
      () => json({ ReportRequestStatus: { Status: 'Pending' } }),
      () => json({ ReportRequestStatus: { Status: 'Success', ReportDownloadUrl: 'https://download.example/r1.zip' } }),
      () => new Response(storedZip('r.csv', csv([['2026-10-26', 'Konto', '1000', '40', '200.5', '3.25', '900']]))),
    ]);
    const job = queue(storage);

    await stepJob(storage, deps(ms.fetch), job);
    expect(ms.calls[0]!.url).toMatch(/GenerateReport\/Submit$/);
    expect(ms.calls[0]!.headers).toMatchObject({ Authorization: 'Bearer token', DeveloperToken: 'dev', CustomerId: '99', CustomerAccountId: '187654321' });
    expect(ms.calls[0]!.body).toEqual({ ReportRequest: buildDailyAccountRequest('187654321', { from: '2026-10-25', to: TODAY }) });

    await stepJob(storage, deps(ms.fetch), nextJob(storage.sql)!); // Pending
    expect(nextJob(storage.sql)!.polls).toBe(1);
    await stepJob(storage, deps(ms.fetch), nextJob(storage.sql)!); // Success + download

    expect(nextJob(storage.sql)).toBeNull();
    const view = viewOf(storage.sql, ACCOUNT.accountId, { from: '2026-10-25', to: TODAY }, NOW);
    expect(view.days).toEqual([
      { day: '2026-10-25', impressions: 0, clicks: 0, spend: 0, conversions: 0, revenue: 0 },
      { day: '2026-10-26', impressions: 1000, clicks: 40, spend: 200.5, conversions: 3.25, revenue: 900 },
      { day: '2026-10-27', impressions: 0, clicks: 0, spend: 0, conversions: 0, revenue: 0 },
    ]);
    expect(view).toMatchObject({ syncing: false, error: null, today: TODAY, office: true, fetchedAt: NOW, coverage: { from: '2026-10-25', to: TODAY } });
    expect(stateOf(storage.sql, ACCOUNT.accountId)).toMatchObject({ recentAt: NOW, trailingOn: null, error: null });
    expect(callsUsed(storage.sql, NOW)).toBe(4);
  });

  it('marks the 30-day read as done only when it reached back 30 days', async () => {
    const storage = memoryStorage();
    const ms = fakeMicrosoft([() => json({ ReportRequestId: 'R' }), () => json({ ReportRequestStatus: { Status: 'Success', ReportDownloadUrl: null } })]);
    queue(storage, { from: addDays(TODAY, -TRAILING_DAYS), to: TODAY });
    await stepJob(storage, deps(ms.fetch), nextJob(storage.sql)!);
    await stepJob(storage, deps(ms.fetch), nextJob(storage.sql)!);
    // No download link = no traffic at all in the period: zeros, not a gap.
    expect(coverageOf(storage.sql, ACCOUNT.accountId)).toEqual({ from: addDays(TODAY, -TRAILING_DAYS), to: TODAY });
    expect(stateOf(storage.sql, ACCOUNT.accountId)).toMatchObject({ trailingOn: TODAY, recentAt: NOW });
  });

  it('overwrites a day when it is read again (late conversions), never duplicates it', async () => {
    const storage = memoryStorage();
    for (const revenue of ['100', '160']) {
      const ms = fakeMicrosoft([
        () => json({ ReportRequestId: 'R' }),
        () => json({ ReportRequestStatus: { Status: 'Success', ReportDownloadUrl: 'https://d/x.zip' } }),
        () => new Response(storedZip('r.csv', csv([['2026-10-26', 'K', '10', '1', '5', '1', revenue]]))),
      ]);
      queue(storage, { from: '2026-10-26', to: '2026-10-26' });
      await stepJob(storage, deps(ms.fetch), nextJob(storage.sql)!);
      await stepJob(storage, deps(ms.fetch), nextJob(storage.sql)!);
    }
    const days = viewOf(storage.sql, ACCOUNT.accountId, { from: '2026-10-01', to: TODAY }, NOW).days;
    expect(days).toHaveLength(1);
    expect(days[0]!.revenue).toBe(160);
  });

  it('keeps one job per account', () => {
    const storage = memoryStorage();
    queue(storage);
    expect(enqueue(storage, { ...ACCOUNT, range: { from: '2026-10-01', to: TODAY }, reason: 'trailing' }, NOW)).toBe(false);
    expect(enqueue(storage, { accountId: '555', customerId: '99', range: { from: '2026-10-01', to: TODAY }, reason: 'trailing' }, NOW)).toBe(true);
  });

  it('drops a job that was lost (no alarm for an hour)', () => {
    const storage = memoryStorage();
    queue(storage, undefined, NOW - 61 * 60_000);
    expect(activeJob(storage.sql, ACCOUNT.accountId, NOW)).toBeNull();
  });

  it('waits and tries again when Microsoft says slow down – and gives up after six times', async () => {
    const storage = memoryStorage();
    queue(storage);
    for (let n = 1; n <= 6; n++) {
      const ms = fakeMicrosoft([() => json({ Errors: [{ Code: 117, Message: 'CallRateExceeded' }] }, 400)]);
      await stepJob(storage, deps(ms.fetch), nextJob(storage.sql)!);
      expect(nextJob(storage.sql)).toMatchObject({ tries: n, nextAt: NOW + backoffMs(n), reportId: null });
    }
    const ms = fakeMicrosoft([() => new Response('', { status: 429 })]);
    await stepJob(storage, deps(ms.fetch), nextJob(storage.sql)!);
    expect(nextJob(storage.sql)).toBeNull();
    expect(stateOf(storage.sql, ACCOUNT.accountId)!.error).toMatch(/vente/);
  });

  it('tries once with a new token when the old one has expired', async () => {
    const storage = memoryStorage();
    const fresh: boolean[] = [];
    const ms = fakeMicrosoft([() => new Response('', { status: 401 }), () => json({ ReportRequestId: 'R9' })]);
    queue(storage);
    await stepJob(storage, deps(ms.fetch, NOW, fresh), nextJob(storage.sql)!);
    expect(fresh).toEqual([false, true]);
    expect(ms.calls[1]!.headers.Authorization).toBe('Bearer new-token');
    expect(nextJob(storage.sql)!.reportId).toBe('R9');
  });

  it('stops at once when Microsoft refuses the keys – retrying could get them locked', async () => {
    const storage = memoryStorage();
    const ms = fakeMicrosoft([() => json({ Errors: [{ Code: 105, Message: 'InvalidCredentials' }] }, 400)]);
    queue(storage);
    await stepJob(storage, deps(ms.fetch), nextJob(storage.sql)!);
    expect(ms.calls).toHaveLength(1);
    expect(nextJob(storage.sql)).toBeNull();
    expect(stateOf(storage.sql, ACCOUNT.accountId)!.error).toMatch(/afviste nøglerne/);
  });

  it('tells a refused sign-in (stop) from Microsoft being out of reach (try later)', async () => {
    for (const [status, stays] of [
      [409, false],
      [502, true],
    ] as const) {
      const storage = memoryStorage();
      queue(storage);
      const failing: SyncDeps = {
        fetch: async () => {
          throw new Error('no call expected');
        },
        now: () => NOW,
        access: async () => {
          throw Object.assign(new Error('nej'), { status });
        },
      };
      await stepJob(storage, failing, nextJob(storage.sql)!);
      expect(!!nextJob(storage.sql)).toBe(stays);
    }
  });

  it('gives up on a report Microsoft could not build', async () => {
    const storage = memoryStorage();
    const ms = fakeMicrosoft([() => json({ ReportRequestId: 'R' }), () => json({ ReportRequestStatus: { Status: 'Error' } })]);
    queue(storage);
    await stepJob(storage, deps(ms.fetch), nextJob(storage.sql)!);
    await stepJob(storage, deps(ms.fetch), nextJob(storage.sql)!);
    expect(nextJob(storage.sql)).toBeNull();
    expect(stateOf(storage.sql, ACCOUNT.accountId)!.error).toMatch(/fejlede/);
  });

  it('makes no call at all once the day’s ceiling is reached', async () => {
    const storage = memoryStorage();
    storage.sql.exec('INSERT INTO ads_daily_calls (day, calls) VALUES (?, ?)', TODAY, DAILY_CALL_BUDGET);
    const ms = fakeMicrosoft([]);
    queue(storage);
    await stepJob(storage, deps(ms.fetch), nextJob(storage.sql)!);
    expect(ms.calls).toHaveLength(0);
    expect(nextJob(storage.sql)).toBeNull();
    expect(stateOf(storage.sql, ACCOUNT.accountId)!.error).toMatch(/loft/);
  });
});
