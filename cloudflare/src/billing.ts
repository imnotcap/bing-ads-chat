/**
 * The company's AI usage pool (one Workspace = one company). Every seat of the plan
 * adds AI use to the month's pool; when it is used up an admin buys extra-usage packs,
 * whose credits don't expire and are only spent once the month's included use is gone.
 * Use is logged per person (for the overview) and purchases with who and when (for
 * invoicing – there is no card payment yet). The real API bill comes from
 * Anthropic/Google as before.
 */
import { EXTRA_USAGE_PACK, PLANS, billedSeats, includedUsage, monthlyPrice, type PlanId } from '../../src/workspace/plans';
import type { BillingPurchase, BillingState } from '../../src/workspace/types';

export function initBilling(sql: SqlStorage) {
  sql.exec(`CREATE TABLE IF NOT EXISTS pool_usage (
    month TEXT NOT NULL,
    user_id TEXT NOT NULL,
    used_usd REAL NOT NULL DEFAULT 0,
    PRIMARY KEY (month, user_id)
  )`);
  sql.exec(`CREATE TABLE IF NOT EXISTS pool_wallet (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    bought_usd REAL NOT NULL DEFAULT 0,
    spent_usd REAL NOT NULL DEFAULT 0
  )`);
  sql.exec(`CREATE TABLE IF NOT EXISTS pool_purchases (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    at INTEGER NOT NULL,
    month TEXT NOT NULL,
    user_id TEXT NOT NULL,
    price_usd REAL NOT NULL,
    credit_usd REAL NOT NULL
  )`);
}

export const monthOf = (t = Date.now()) => new Date(t).toISOString().slice(0, 7);

const round = (v: number) => Math.round(v * 10000) / 10000;

function monthUsed(sql: SqlStorage, month: string) {
  return sql.exec<{ total: number | null }>('SELECT SUM(used_usd) AS total FROM pool_usage WHERE month = ?', month).toArray()[0]?.total ?? 0;
}

function wallet(sql: SqlStorage) {
  return sql.exec<{ bought_usd: number; spent_usd: number }>('SELECT bought_usd, spent_usd FROM pool_wallet WHERE id = 1').toArray()[0] ?? { bought_usd: 0, spent_usd: 0 };
}

export interface PoolPerson {
  id: string;
  name: string;
}

export function billingState(sql: SqlStorage, plan: PlanId, people: PoolPerson[], month = monthOf()): BillingState {
  const seats = billedSeats(plan, people.length);
  const includedUsd = includedUsage(plan, people.length);
  const usedUsd = monthUsed(sql, month);
  const w = wallet(sql);
  const creditUsd = Math.max(0, w.bought_usd - w.spent_usd);
  const includedLeftUsd = Math.max(0, includedUsd - usedUsd);
  const names = new Map(people.map((p) => [p.id, p.name]));
  const byPerson = sql
    .exec<{ user_id: string; used_usd: number }>('SELECT user_id, used_usd FROM pool_usage WHERE month = ? ORDER BY used_usd DESC', month)
    .toArray()
    .map((r) => ({ name: names.get(r.user_id) ?? 'Tidligere medarbejder', usedUsd: round(r.used_usd) }));
  const purchases: BillingPurchase[] = sql
    .exec<{ at: number; user_id: string; price_usd: number; credit_usd: number }>('SELECT at, user_id, price_usd, credit_usd FROM pool_purchases WHERE month = ? ORDER BY at', month)
    .toArray()
    .map((p) => ({ at: p.at, priceUsd: p.price_usd, creditUsd: p.credit_usd, by: names.get(p.user_id) ?? 'Tidligere medarbejder' }));
  return {
    month,
    plan,
    seats,
    people: people.length,
    priceMonthlyUsd: monthlyPrice(plan, people.length),
    pricePerSeatUsd: PLANS[plan].priceUsd,
    includedUsd,
    usedUsd: round(usedUsd),
    includedLeftUsd: round(includedLeftUsd),
    creditUsd: round(creditUsd),
    remainingUsd: round(includedLeftUsd + creditUsd),
    pack: EXTRA_USAGE_PACK,
    byPerson,
    purchases,
  };
}

/** Adds the cost of one AI request. What goes beyond the month's included use is paid with credits. */
export function recordUsage(storage: DurableObjectStorage, includedUsd: number, userId: string, costUsd: number, month = monthOf()) {
  storage.transactionSync(() => {
    const before = monthUsed(storage.sql, month);
    const after = before + costUsd;
    const overflow = Math.max(0, after - includedUsd) - Math.max(0, before - includedUsd);
    storage.sql.exec(
      'INSERT INTO pool_usage (month, user_id, used_usd) VALUES (?, ?, ?) ON CONFLICT (month, user_id) DO UPDATE SET used_usd = used_usd + excluded.used_usd',
      month,
      userId,
      costUsd,
    );
    if (overflow > 0) {
      storage.sql.exec('INSERT INTO pool_wallet (id, bought_usd, spent_usd) VALUES (1, 0, ?) ON CONFLICT (id) DO UPDATE SET spent_usd = spent_usd + excluded.spent_usd', overflow);
    }
  });
}

/** One pack of extra use for the pool (logged for invoicing). Credits spent beyond what was bought are settled first. */
export function buyPack(storage: DurableObjectStorage, userId: string, at = Date.now()) {
  storage.transactionSync(() => {
    storage.sql.exec('INSERT INTO pool_purchases (at, month, user_id, price_usd, credit_usd) VALUES (?, ?, ?, ?, ?)', at, monthOf(at), userId, EXTRA_USAGE_PACK.priceUsd, EXTRA_USAGE_PACK.creditUsd);
    storage.sql.exec('INSERT INTO pool_wallet (id, bought_usd, spent_usd) VALUES (1, ?, 0) ON CONFLICT (id) DO UPDATE SET bought_usd = bought_usd + excluded.bought_usd', EXTRA_USAGE_PACK.creditUsd);
  });
}

/** Every purchase, newest first – for invoicing. */
export function allPurchases(sql: SqlStorage, names: Map<string, string>, limit = 500): (BillingPurchase & { month: string })[] {
  return sql
    .exec<{ at: number; month: string; user_id: string; price_usd: number; credit_usd: number }>('SELECT at, month, user_id, price_usd, credit_usd FROM pool_purchases ORDER BY at DESC LIMIT ?', limit)
    .toArray()
    .map((p) => ({ at: p.at, month: p.month, priceUsd: p.price_usd, creditUsd: p.credit_usd, by: names.get(p.user_id) ?? 'Tidligere medarbejder' }));
}
