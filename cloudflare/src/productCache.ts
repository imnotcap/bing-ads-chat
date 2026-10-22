/**
 * The product overview (Shopping / Performance Max), kept in the workspace's SQLite
 * database. The account has thousands of products and Microsoft's product report takes
 * a while, so the first app to open the Produkter page sends what it got (only the
 * products that sold something or moved) and everyone else reads it from here.
 * One snapshot per account and period; only the newest few periods are kept.
 */

export function initProductCache(sql: SqlStorage) {
  sql.exec(`CREATE TABLE IF NOT EXISTS ads_products (
    account_id TEXT NOT NULL,
    period TEXT NOT NULL,
    id TEXT NOT NULL,
    data TEXT NOT NULL,
    PRIMARY KEY (account_id, period, id)
  )`);
  sql.exec(`CREATE TABLE IF NOT EXISTS ads_product_snapshots (
    account_id TEXT NOT NULL,
    period TEXT NOT NULL,
    fetched_at INTEGER NOT NULL,
    scanned INTEGER NOT NULL,
    count INTEGER NOT NULL,
    PRIMARY KEY (account_id, period)
  )`);
}

export interface ProductSnapshot {
  accountId: string;
  period: string;
  /** When the products were read from Microsoft (ms); null = nothing stored yet. */
  fetchedAt: number | null;
  /** How many products Microsoft reported before filtering. */
  scanned: number;
  products: unknown[];
}

const MAX_PRODUCTS = 20_000;
const MAX_ROW_CHARS = 40_000;
const KEEP_PERIODS = 6;

const validPeriod = (p: string) => /^\d{4}-\d{2}-\d{2}_\d{4}-\d{2}-\d{2}$/.test(p);

export function readProducts(sql: SqlStorage, accountId: string, period: string): ProductSnapshot {
  const meta = sql
    .exec<{ fetched_at: number; scanned: number }>('SELECT fetched_at, scanned FROM ads_product_snapshots WHERE account_id = ? AND period = ?', accountId, period)
    .toArray()[0];
  if (!meta) return { accountId, period, fetchedAt: null, scanned: 0, products: [] };
  const rows = sql.exec<{ data: string }>('SELECT data FROM ads_products WHERE account_id = ? AND period = ?', accountId, period).toArray();
  return { accountId, period, fetchedAt: meta.fetched_at, scanned: meta.scanned, products: rows.map((r) => JSON.parse(r.data) as unknown) };
}

/** Replaces the stored products of an account and period. Returns an error message for bad input. */
export function writeProducts(storage: DurableObjectStorage, accountId: string, period: string, fetchedAt: number, scanned: number, products: unknown): string | null {
  if (!/^\d+$/.test(accountId)) return 'Ugyldigt konto-id.';
  if (!validPeriod(period)) return 'Ugyldig periode.';
  if (!Array.isArray(products) || products.length > MAX_PRODUCTS) return 'Ugyldig produktliste.';
  const rows: { id: string; data: string }[] = [];
  for (const p of products as Record<string, unknown>[]) {
    const id = typeof p?.id === 'string' ? p.id : '';
    const data = JSON.stringify(p);
    if (!id || id.length > 200 || typeof p.title !== 'string' || data.length > MAX_ROW_CHARS) return 'Ugyldigt produkt i listen.';
    rows.push({ id, data });
  }
  const at = Math.min(Number.isFinite(fetchedAt) ? fetchedAt : Date.now(), Date.now());
  storage.transactionSync(() => {
    const stored = storage.sql
      .exec<{ fetched_at: number }>('SELECT fetched_at FROM ads_product_snapshots WHERE account_id = ? AND period = ?', accountId, period)
      .toArray()[0];
    // Never older than what is stored (two apps may refresh at the same time).
    if (stored && stored.fetched_at > at) return;
    storage.sql.exec('DELETE FROM ads_products WHERE account_id = ? AND period = ?', accountId, period);
    for (const r of rows) storage.sql.exec('INSERT OR REPLACE INTO ads_products (account_id, period, id, data) VALUES (?, ?, ?, ?)', accountId, period, r.id, r.data);
    storage.sql.exec(
      'INSERT OR REPLACE INTO ads_product_snapshots (account_id, period, fetched_at, scanned, count) VALUES (?, ?, ?, ?, ?)',
      accountId,
      period,
      at,
      Number.isFinite(scanned) ? Math.max(0, Math.round(scanned)) : rows.length,
      rows.length,
    );
    // Only the newest periods are worth keeping.
    const old = storage.sql
      .exec<{ period: string }>('SELECT period FROM ads_product_snapshots WHERE account_id = ? ORDER BY fetched_at DESC LIMIT -1 OFFSET ?', accountId, KEEP_PERIODS)
      .toArray();
    for (const o of old) {
      storage.sql.exec('DELETE FROM ads_products WHERE account_id = ? AND period = ?', accountId, o.period);
      storage.sql.exec('DELETE FROM ads_product_snapshots WHERE account_id = ? AND period = ?', accountId, o.period);
    }
  });
  return null;
}

/** When the Microsoft Advertising connection changes or is removed. */
export function clearProducts(sql: SqlStorage) {
  sql.exec('DELETE FROM ads_products');
  sql.exec('DELETE FROM ads_product_snapshots');
}
