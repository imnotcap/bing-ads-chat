/**
 * The account's numbers day by day, kept here and fetched by the Worker itself.
 *
 * Before this, every app asked Microsoft for the same daily report on every page it
 * opened. Now the workspace holds 13 months of days, the apps only read them, and the
 * Worker fetches what is missing or out of date – once, for everyone:
 *
 * - The first time an account is opened: 13 months in one report (about 400 rows).
 * - Every weekday morning (and the first read of the day): the last 30 days again,
 *   because conversions keep arriving for days after the click.
 * - In office hours, at most every 30 minutes and only while someone is looking: today
 *   and the two days before.
 * - "Opdatér": the same, at most every 5 minutes.
 *
 * Outside weekdays 8–16 (Copenhagen time) nothing is fetched on its own, as for the rest
 * of the app (src/lib/refreshPolicy.ts) – what is stored is shown, and Opdatér still works.
 *
 * Fetching happens in steps on the Durable Object's alarm: order the report, ask whether
 * it is ready, download it. Each step is one or two calls, so no step waits on Microsoft
 * for long and none comes near the Worker's per-invocation limits. One report at a time,
 * a backoff when Microsoft says slow down, a stop when it refuses the keys, and a daily
 * ceiling on calls – so a fault can never turn into a stream of requests.
 */
import { DAILY_HISTORY_DAYS, buildDailyAccountRequest, dailyFromRows, type DailyView, type DayMetrics } from '../../src/bing/dailyReport';
import { parseCsv } from '../../src/bing/csv';
import { extractErrorMessages, isCredentialRejection, isThrottled } from '../../src/bing/msErrors';
import { extractFirstFile } from '../../src/bing/zip';
import { addDays, daysBetween, type DateRange } from '../../src/lib/format';
import type { FetchLike } from './connectors';

const REPORTING = 'https://reporting.api.bingads.microsoft.com/Reporting/v13';

/**
 * The parts of a Durable Object's storage used here, written out rather than taken from
 * Cloudflare's global types: the same shapes as SqlStorage and DurableObjectStorage, so
 * `ctx.storage` fits, and a test can run the real SQL on Node's own SQLite.
 */
type SqlValue = ArrayBuffer | string | number | null;
export interface Sql {
  exec<T extends Record<string, SqlValue>>(query: string, ...bindings: unknown[]): { toArray(): T[] };
}
export interface Storage {
  sql: Sql;
  transactionSync<T>(closure: () => T): T;
}

/** How far back an account is filled the first time (13 months). */
export const HISTORY_DAYS = DAILY_HISTORY_DAYS;
/** Read again every morning: conversions are attributed to the day of the click, days later. */
export const TRAILING_DAYS = 30;
/** Today and the days before it, during the day. */
export const RECENT_DAYS = 2;
/** The same half hour as the app's own refresh policy. */
export const RECENT_EVERY_MS = 30 * 60_000;
export const MANUAL_MIN_GAP_MS = 5 * 60_000;
/** After a failed sync nothing is tried on its own for this long (Opdatér still works). */
export const ERROR_COOLDOWN_MS = 15 * 60_000;
/** Calls to Microsoft per Copenhagen day for the whole workspace. A normal day uses well under a third. */
export const DAILY_CALL_BUDGET = 300;
/** The longest range one report is asked for. */
export const MAX_SPAN_DAYS = 400;
const MAX_POLLS = 60;
const MAX_TRIES = 6;
/** A job older than this is assumed lost (an alarm that never came) and is dropped. */
const JOB_LIFETIME_MS = 60 * 60_000;

/* ------------------------------------------------------------------ time */

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const copenhagenParts = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/Copenhagen',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  hourCycle: 'h23',
  weekday: 'short',
});

/** The calendar day, weekday (1 = Monday) and hour in Denmark – the Worker itself runs in UTC. */
export function copenhagen(now: number): { date: string; weekday: number; hour: number } {
  const p = Object.fromEntries(copenhagenParts.formatToParts(new Date(now)).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, weekday: WEEKDAYS.indexOf(p.weekday ?? '') + 1, hour: Number(p.hour) };
}

/** Weekdays 8–16 in Denmark: the only hours anything is fetched without someone asking. */
export const officeHours = (c: { weekday: number; hour: number }) => c.weekday >= 1 && c.weekday <= 5 && c.hour >= 8 && c.hour < 16;

const minDay = (a: string, b: string) => (a < b ? a : b);
const maxDay = (a: string, b: string) => (a > b ? a : b);

/* ------------------------------------------------------------------ tables */

export function initAdsDaily(sql: Sql) {
  sql.exec(`CREATE TABLE IF NOT EXISTS ads_daily (
    account_id TEXT NOT NULL,
    day TEXT NOT NULL,
    impressions REAL NOT NULL,
    clicks REAL NOT NULL,
    spend REAL NOT NULL,
    conversions REAL NOT NULL,
    revenue REAL NOT NULL,
    fetched_at INTEGER NOT NULL,
    PRIMARY KEY (account_id, day)
  )`);
  sql.exec(`CREATE TABLE IF NOT EXISTS ads_daily_state (
    account_id TEXT PRIMARY KEY,
    customer_id TEXT,
    trailing_on TEXT,
    recent_at INTEGER,
    error TEXT,
    error_at INTEGER
  )`);
  // report_id null = not ordered yet.
  sql.exec(`CREATE TABLE IF NOT EXISTS ads_daily_jobs (
    id INTEGER PRIMARY KEY,
    account_id TEXT NOT NULL,
    customer_id TEXT NOT NULL,
    from_day TEXT NOT NULL,
    to_day TEXT NOT NULL,
    reason TEXT NOT NULL,
    report_id TEXT,
    polls INTEGER NOT NULL DEFAULT 0,
    tries INTEGER NOT NULL DEFAULT 0,
    next_at INTEGER NOT NULL,
    created_at INTEGER NOT NULL
  )`);
  sql.exec('CREATE TABLE IF NOT EXISTS ads_daily_calls (day TEXT PRIMARY KEY, calls INTEGER NOT NULL)');
}

/** When the Microsoft Advertising connection changes or is removed. */
export function clearDaily(sql: Sql) {
  for (const t of ['ads_daily', 'ads_daily_state', 'ads_daily_jobs', 'ads_daily_calls']) sql.exec(`DELETE FROM ${t}`);
}

export interface SyncState {
  customerId: string | null;
  /** The Copenhagen day the last 30 days were last read in full. */
  trailingOn: string | null;
  /** When a sync that reached today last finished (ms). */
  recentAt: number | null;
  error: string | null;
  errorAt: number | null;
}

export interface Job {
  id: number;
  accountId: string;
  customerId: string;
  range: DateRange;
  reason: Reason;
  reportId: string | null;
  polls: number;
  tries: number;
  nextAt: number;
  createdAt: number;
}

type JobRow = {
  id: number;
  account_id: string;
  customer_id: string;
  from_day: string;
  to_day: string;
  reason: string;
  report_id: string | null;
  polls: number;
  tries: number;
  next_at: number;
  created_at: number;
};

const toJob = (r: JobRow): Job => ({
  id: r.id,
  accountId: r.account_id,
  customerId: r.customer_id,
  range: { from: r.from_day, to: r.to_day },
  reason: r.reason as Reason,
  reportId: r.report_id,
  polls: r.polls,
  tries: r.tries,
  nextAt: r.next_at,
  createdAt: r.created_at,
});

export function readDaily(sql: Sql, accountId: string, range: DateRange): (DayMetrics & { fetchedAt: number })[] {
  return sql
    .exec<{ day: string; impressions: number; clicks: number; spend: number; conversions: number; revenue: number; fetched_at: number }>(
      'SELECT day, impressions, clicks, spend, conversions, revenue, fetched_at FROM ads_daily WHERE account_id = ? AND day >= ? AND day <= ? ORDER BY day',
      accountId,
      range.from,
      range.to,
    )
    .toArray()
    .map(({ fetched_at, ...d }) => ({ ...d, fetchedAt: fetched_at }));
}

/** The first and last day stored for the account (every day in between is stored too). */
export function coverageOf(sql: Sql, accountId: string): DateRange | null {
  const r = sql.exec<{ f: string | null; t: string | null }>('SELECT MIN(day) AS f, MAX(day) AS t FROM ads_daily WHERE account_id = ?', accountId).toArray()[0];
  return r?.f && r.t ? { from: r.f, to: r.t } : null;
}

export function stateOf(sql: Sql, accountId: string): SyncState | null {
  const r = sql
    .exec<{ customer_id: string | null; trailing_on: string | null; recent_at: number | null; error: string | null; error_at: number | null }>(
      'SELECT customer_id, trailing_on, recent_at, error, error_at FROM ads_daily_state WHERE account_id = ?',
      accountId,
    )
    .toArray()[0];
  return r ? { customerId: r.customer_id, trailingOn: r.trailing_on, recentAt: r.recent_at, error: r.error, errorAt: r.error_at } : null;
}

/** Every account with a known customer – the ones the morning schedule keeps up to date. */
export function knownAccounts(sql: Sql): { accountId: string; customerId: string }[] {
  return sql
    .exec<{ account_id: string; customer_id: string }>('SELECT account_id, customer_id FROM ads_daily_state WHERE customer_id IS NOT NULL')
    .toArray()
    .map((r) => ({ accountId: r.account_id, customerId: r.customer_id }));
}

function setState(sql: Sql, accountId: string, patch: Partial<SyncState>) {
  const cur = stateOf(sql, accountId) ?? { customerId: null, trailingOn: null, recentAt: null, error: null, errorAt: null };
  const next = { ...cur, ...patch };
  sql.exec(
    'INSERT OR REPLACE INTO ads_daily_state (account_id, customer_id, trailing_on, recent_at, error, error_at) VALUES (?, ?, ?, ?, ?, ?)',
    accountId,
    next.customerId,
    next.trailingOn,
    next.recentAt,
    next.error,
    next.errorAt,
  );
}

export function recordError(sql: Sql, accountId: string, message: string, now: number) {
  setState(sql, accountId, { error: message.slice(0, 400), errorAt: now });
}

/** The account's job in progress, if any. A job that outlived any sensible report is dropped. */
export function activeJob(sql: Sql, accountId: string, now: number): Job | null {
  sql.exec('DELETE FROM ads_daily_jobs WHERE created_at < ?', now - JOB_LIFETIME_MS);
  const r = sql.exec<JobRow>('SELECT * FROM ads_daily_jobs WHERE account_id = ? ORDER BY id LIMIT 1', accountId).toArray()[0];
  return r ? toJob(r) : null;
}

/** The job whose next step is due first (for the alarm). */
export function nextJob(sql: Sql): Job | null {
  const r = sql.exec<JobRow>('SELECT * FROM ads_daily_jobs ORDER BY next_at, id LIMIT 1').toArray()[0];
  return r ? toJob(r) : null;
}

/* ------------------------------------------------------------------ deciding */

export type Reason = 'history' | 'older' | 'trailing' | 'recent';

export interface PlanInput {
  now: number;
  /** Today in Copenhagen. */
  today: string;
  office: boolean;
  /** What the person is looking at. */
  want: DateRange;
  coverage: DateRange | null;
  state: SyncState | null;
  /** A report for the account is already on its way. */
  active: boolean;
  /** The stored Microsoft keys are known to be refused. */
  blocked: boolean;
  /** Someone pressed Opdatér. */
  manual: boolean;
}

/**
 * What to fetch for an account, if anything. At most one report – the most important –
 * and none while one is already on its way: the next read plans the next.
 */
export function planSync(i: PlanInput): { range: DateRange; reason: Reason } | null {
  if (i.active) return null;
  if (!i.manual && i.blocked) return null;
  if (!i.manual && i.state?.errorAt && i.now - i.state.errorAt < ERROR_COOLDOWN_MS) return null;
  const want = { from: i.want.from, to: minDay(i.want.to, i.today) };
  const earliest = addDays(i.today, -MAX_SPAN_DAYS + 1);
  // From a day onwards, at most one report long. Starting after the last stored day keeps
  // the stored days without gaps; a range too long for one report is finished by the
  // next read, so it is never cut short at the front.
  const forward = (from: string) => ({ from, to: minDay(addDays(from, MAX_SPAN_DAYS - 1), i.today) });

  // Days nobody has fetched are fetched when someone looks at them, whatever the hour –
  // as everywhere else in the app.
  if (!i.coverage) return { range: { from: minDay(addDays(i.today, -HISTORY_DAYS), maxDay(want.from, earliest)), to: i.today }, reason: 'history' };
  if (want.from <= want.to && want.from < i.coverage.from) {
    const to = addDays(i.coverage.from, -1);
    return { range: { from: maxDay(want.from, addDays(to, -MAX_SPAN_DAYS + 1)), to }, reason: 'older' };
  }

  if (!i.office && !i.manual) return null;
  const after = addDays(i.coverage.to, 1);
  if (i.state?.trailingOn !== i.today) return { range: forward(minDay(addDays(i.today, -TRAILING_DAYS), after)), reason: 'trailing' };
  const gap = i.manual ? MANUAL_MIN_GAP_MS : RECENT_EVERY_MS;
  if (i.state?.recentAt && i.now - i.state.recentAt < gap) return null;
  return { range: forward(minDay(addDays(i.today, -RECENT_DAYS), after)), reason: 'recent' };
}

/**
 * Puts a report in the queue unless one for the account already is (checked again here:
 * two reads can plan at the same time while the customer id was being looked up).
 */
export function enqueue(storage: Storage, job: { accountId: string; customerId: string; range: DateRange; reason: Reason }, now: number): boolean {
  return storage.transactionSync(() => {
    if (activeJob(storage.sql, job.accountId, now)) return false;
    storage.sql.exec(
      'INSERT INTO ads_daily_jobs (account_id, customer_id, from_day, to_day, reason, next_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      job.accountId,
      job.customerId,
      job.range.from,
      job.range.to,
      job.reason,
      now,
      now,
    );
    setState(storage.sql, job.accountId, { customerId: job.customerId });
    return true;
  });
}

/* ------------------------------------------------------------------ calls */

function callsToday(sql: Sql, day: string): number {
  return sql.exec<{ calls: number }>('SELECT calls FROM ads_daily_calls WHERE day = ?', day).toArray()[0]?.calls ?? 0;
}

/** Counts one call against today's ceiling; false when the ceiling is reached. */
function spendCall(sql: Sql, now: number): boolean {
  const day = copenhagen(now).date;
  const used = callsToday(sql, day);
  if (used >= DAILY_CALL_BUDGET) return false;
  sql.exec('DELETE FROM ads_daily_calls WHERE day <> ?', day);
  sql.exec('INSERT OR REPLACE INTO ads_daily_calls (day, calls) VALUES (?, ?)', day, used + 1);
  return true;
}

export const callsUsed = (sql: Sql, now: number) => callsToday(sql, copenhagen(now).date);

export interface SyncDeps {
  fetch: FetchLike;
  /** An access token from the workspace's shared Microsoft sign-in; `fresh` = the last one was refused. */
  access: (fresh: boolean) => Promise<{ accessToken: string; developerToken: string }>;
  now: () => number;
}

type Outcome = { ok: true; body: unknown } | { ok: false; kind: 'throttle' | 'transient' | 'auth' | 'fatal' | 'budget'; message: string };

/** The Workspace's AuthError carries 409 when the keys are refused and 502 when Microsoft could not be reached. */
const accessFailure = (e: unknown): Outcome => {
  const status = (e as { status?: number })?.status;
  const message = e instanceof Error ? e.message : 'Microsoft kunne ikke kontaktes.';
  return { ok: false, kind: status === 409 ? 'auth' : 'transient', message };
};

async function reporting(sql: Sql, deps: SyncDeps, job: Job, path: string, body: unknown): Promise<Outcome> {
  for (const fresh of [false, true]) {
    if (!spendCall(sql, deps.now())) return { ok: false, kind: 'budget', message: `Dagens loft på ${DAILY_CALL_BUDGET} kald til Microsoft er nået – tallene opdateres igen i morgen.` };
    let access: { accessToken: string; developerToken: string };
    try {
      access = await deps.access(fresh);
    } catch (e) {
      return accessFailure(e);
    }
    let res: Response;
    try {
      res = await deps.fetch(`${REPORTING}/${path}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${access.accessToken}`,
          DeveloperToken: access.developerToken,
          CustomerId: job.customerId,
          CustomerAccountId: job.accountId,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(body),
      });
    } catch {
      return { ok: false, kind: 'transient', message: 'Microsoft Advertising kunne ikke kontaktes.' };
    }
    const text = await res.text();
    let parsed: unknown = null;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {
      parsed = text;
    }
    if (res.ok) return { ok: true, body: parsed };
    // An access token can expire between steps: one more try with a new one.
    if (res.status === 401 && !fresh) continue;
    const messages = extractErrorMessages(parsed);
    const detail = messages.join(' · ') || `HTTP ${res.status}`;
    if (isThrottled(res.status, messages)) return { ok: false, kind: 'throttle', message: `Microsoft bad os vente. (${detail})` };
    if (isCredentialRejection(res.status, messages)) return { ok: false, kind: 'auth', message: `Microsoft Advertising afviste nøglerne. (${detail})` };
    if (res.status >= 500) return { ok: false, kind: 'transient', message: `Microsoft Advertising svarede med en fejl. (${detail})` };
    return { ok: false, kind: 'fatal', message: `Microsoft Advertising afviste rapporten. (${detail})` };
  }
  return { ok: false, kind: 'auth', message: 'Microsoft Advertising afviste adgangen.' };
}

/** Writes the days of a finished report and what that means for the account's freshness. */
export function storeDays(storage: Storage, job: Job, days: DayMetrics[], now: number) {
  const today = copenhagen(now).date;
  storage.transactionSync(() => {
    for (const d of days) {
      storage.sql.exec(
        'INSERT OR REPLACE INTO ads_daily (account_id, day, impressions, clicks, spend, conversions, revenue, fetched_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        job.accountId,
        d.day,
        d.impressions,
        d.clicks,
        d.spend,
        d.conversions,
        d.revenue,
        now,
      );
    }
    const reachedToday = job.range.to >= today;
    const patch: Partial<SyncState> = { error: null, errorAt: null };
    if (reachedToday) patch.recentAt = now;
    if (reachedToday && job.range.from <= addDays(today, -TRAILING_DAYS)) patch.trailingOn = today;
    setState(storage.sql, job.accountId, patch);
    storage.sql.exec('DELETE FROM ads_daily_jobs WHERE id = ?', job.id);
  });
}

function fail(storage: Storage, job: Job, message: string, now: number) {
  storage.transactionSync(() => {
    storage.sql.exec('DELETE FROM ads_daily_jobs WHERE id = ?', job.id);
    recordError(storage.sql, job.accountId, message, now);
  });
}

/** Seconds to wait after the n-th setback: 30 s, 1, 2, 4, 8 … minutes, never more than 30. */
export const backoffMs = (tries: number) => Math.min(30_000 * 2 ** Math.max(0, tries - 1), 30 * 60_000);
const pollDelayMs = (polls: number) => Math.min(2_000 + polls * 1_000, 15_000);

function setback(storage: Storage, job: Job, o: Extract<Outcome, { ok: false }>, now: number) {
  if (o.kind === 'auth' || o.kind === 'fatal' || o.kind === 'budget' || job.tries + 1 > MAX_TRIES) return fail(storage, job, o.message, now);
  storage.sql.exec('UPDATE ads_daily_jobs SET tries = ?, next_at = ? WHERE id = ?', job.tries + 1, now + backoffMs(job.tries + 1), job.id);
}

/**
 * One step of a job: order the report, or ask whether it is ready – and when it is,
 * download it and store the days. Never throws: whatever goes wrong ends up on the job
 * (a later try) or on the account (an error the app shows).
 */
export async function stepJob(storage: Storage, deps: SyncDeps, job: Job): Promise<void> {
  const sql = storage.sql;
  try {
    if (!job.reportId) {
      const o = await reporting(sql, deps, job, 'GenerateReport/Submit', { ReportRequest: buildDailyAccountRequest(job.accountId, job.range) });
      if (!o.ok) return setback(storage, job, o, deps.now());
      const id = (o.body as { ReportRequestId?: string } | null)?.ReportRequestId;
      if (!id) return fail(storage, job, 'Microsoft Advertising: rapporten kunne ikke bestilles.', deps.now());
      sql.exec('UPDATE ads_daily_jobs SET report_id = ?, tries = 0, next_at = ? WHERE id = ?', id, deps.now() + pollDelayMs(0), job.id);
      return;
    }

    const o = await reporting(sql, deps, job, 'GenerateReport/Poll', { ReportRequestId: job.reportId });
    if (!o.ok) return setback(storage, job, o, deps.now());
    const status = (o.body as { ReportRequestStatus?: { Status?: string; ReportDownloadUrl?: string | null } } | null)?.ReportRequestStatus;
    if (status?.Status === 'Error') return fail(storage, job, 'Microsoft Advertising: rapportgenereringen fejlede.', deps.now());
    if (status?.Status !== 'Success') {
      if (job.polls + 1 >= MAX_POLLS) return fail(storage, job, 'Microsoft Advertising: rapporten blev ikke klar.', deps.now());
      sql.exec('UPDATE ads_daily_jobs SET polls = ?, next_at = ? WHERE id = ?', job.polls + 1, deps.now() + pollDelayMs(job.polls + 1), job.id);
      return;
    }

    // No download link: the period had no rows at all, which is also an answer.
    let raw: Record<string, string>[] = [];
    if (status.ReportDownloadUrl) {
      if (!spendCall(sql, deps.now())) return fail(storage, job, `Dagens loft på ${DAILY_CALL_BUDGET} kald til Microsoft er nået – tallene opdateres igen i morgen.`, deps.now());
      let res: Response;
      try {
        res = await deps.fetch(status.ReportDownloadUrl, { method: 'GET' });
      } catch {
        return setback(storage, job, { ok: false, kind: 'transient', message: 'Rapporten kunne ikke hentes.' }, deps.now());
      }
      if (!res.ok) return setback(storage, job, { ok: false, kind: 'transient', message: `Rapporten kunne ikke hentes (HTTP ${res.status}).` }, deps.now());
      raw = parseCsv(new TextDecoder().decode(await extractFirstFile(await res.arrayBuffer())));
    }
    storeDays(storage, job, dailyFromRows(raw, job.range), deps.now());
  } catch (e) {
    fail(storage, job, `Dagstallene kunne ikke opdateres: ${e instanceof Error ? e.message : String(e)}`, deps.now());
  }
}

export function viewOf(sql: Sql, accountId: string, range: DateRange, now: number): DailyView {
  const cph = copenhagen(now);
  const rows = readDaily(sql, accountId, { from: range.from, to: minDay(range.to, cph.date) });
  return {
    accountId,
    today: cph.date,
    days: rows.map((r) => ({ day: r.day, impressions: r.impressions, clicks: r.clicks, spend: r.spend, conversions: r.conversions, revenue: r.revenue })),
    coverage: coverageOf(sql, accountId),
    fetchedAt: rows.length ? Math.max(...rows.map((r) => r.fetchedAt)) : null,
    syncing: !!activeJob(sql, accountId, now),
    error: stateOf(sql, accountId)?.error ?? null,
    office: officeHours(cph),
  };
}

/** A range the app may ask for: real dates, in order, and not absurdly long. */
export function validRange(from: string | null, to: string | null): DateRange | null {
  const iso = /^\d{4}-\d{2}-\d{2}$/;
  if (!from || !to || !iso.test(from) || !iso.test(to) || from > to) return null;
  if (Number.isNaN(Date.parse(`${from}T00:00:00Z`)) || Number.isNaN(Date.parse(`${to}T00:00:00Z`))) return null;
  return daysBetween(from, to) <= 800 ? { from, to } : null;
}
