/**
 * The Microsoft Advertising campaigns, kept in the workspace's SQLite database so the
 * app doesn't ask Microsoft for every campaign (hundreds) on every chat message.
 * The app reads the snapshot from here and sends a new one after it has fetched the
 * campaigns from Microsoft (when the snapshot is old, or after a change it made).
 */

/** Campaigns per account; `data` is the app's Campaign object as JSON. */
export function initAdsCache(sql: SqlStorage) {
  sql.exec(`CREATE TABLE IF NOT EXISTS ads_campaigns (
    account_id TEXT NOT NULL,
    id TEXT NOT NULL,
    name TEXT NOT NULL,
    status TEXT NOT NULL,
    data TEXT NOT NULL,
    PRIMARY KEY (account_id, id)
  )`);
  sql.exec(`CREATE TABLE IF NOT EXISTS ads_snapshots (
    account_id TEXT PRIMARY KEY,
    fetched_at INTEGER NOT NULL,
    count INTEGER NOT NULL
  )`);
}

export interface CampaignSnapshot {
  accountId: string;
  /** When the campaigns were read from Microsoft (ms); null = nothing stored yet. */
  fetchedAt: number | null;
  campaigns: unknown[];
}

const MAX_CAMPAIGNS = 20_000;
const MAX_ROW_CHARS = 20_000;

export function readCampaigns(sql: SqlStorage, accountId: string): CampaignSnapshot {
  const meta = sql.exec<{ fetched_at: number }>('SELECT fetched_at FROM ads_snapshots WHERE account_id = ?', accountId).toArray()[0];
  if (!meta) return { accountId, fetchedAt: null, campaigns: [] };
  const rows = sql.exec<{ data: string }>('SELECT data FROM ads_campaigns WHERE account_id = ? ORDER BY name', accountId).toArray();
  return { accountId, fetchedAt: meta.fetched_at, campaigns: rows.map((r) => JSON.parse(r.data) as unknown) };
}

/** Replaces the stored campaigns of an account. Returns an error message for bad input. */
export function writeCampaigns(storage: DurableObjectStorage, accountId: string, fetchedAt: number, campaigns: unknown): string | null {
  if (!/^\d+$/.test(accountId)) return 'Ugyldigt konto-id.';
  if (!Array.isArray(campaigns) || campaigns.length > MAX_CAMPAIGNS) return 'Ugyldig kampagneliste.';
  const rows: { id: string; name: string; status: string; data: string }[] = [];
  for (const c of campaigns as Record<string, unknown>[]) {
    const id = typeof c?.id === 'string' ? c.id : '';
    const data = JSON.stringify(c);
    if (!/^\d+$/.test(id) || typeof c.name !== 'string' || data.length > MAX_ROW_CHARS) return 'Ugyldig kampagne i listen.';
    rows.push({ id, name: c.name, status: typeof c.status === 'string' ? c.status : '', data });
  }
  // Never older than what is stored (two apps may refresh at the same time).
  const at = Math.min(Number.isFinite(fetchedAt) ? fetchedAt : Date.now(), Date.now());
  storage.transactionSync(() => {
    const stored = storage.sql.exec<{ fetched_at: number }>('SELECT fetched_at FROM ads_snapshots WHERE account_id = ?', accountId).toArray()[0];
    if (stored && stored.fetched_at > at) return;
    storage.sql.exec('DELETE FROM ads_campaigns WHERE account_id = ?', accountId);
    for (const r of rows) storage.sql.exec('INSERT INTO ads_campaigns (account_id, id, name, status, data) VALUES (?, ?, ?, ?, ?)', accountId, r.id, r.name, r.status, r.data);
    storage.sql.exec('INSERT OR REPLACE INTO ads_snapshots (account_id, fetched_at, count) VALUES (?, ?, ?)', accountId, at, rows.length);
  });
  return null;
}

/** When the Microsoft Advertising connection changes or is removed. */
export function clearCampaigns(sql: SqlStorage) {
  sql.exec('DELETE FROM ads_campaigns');
  sql.exec('DELETE FROM ads_snapshots');
}
