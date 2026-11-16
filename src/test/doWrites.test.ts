// @vitest-environment node
/**
 * Durable Objects bill every row written: the shared caches must write only what changed.
 * Run against a real SQLite database (node:sqlite), counting the rows each write touches.
 */
import { describe, expect, it } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { initAdsCache, readCampaigns, writeCampaigns } from '../../cloudflare/src/adsCache';
import { initProductCache, readProducts, writeProducts } from '../../cloudflare/src/productCache';

function fakeStorage() {
  const db = new DatabaseSync(':memory:');
  const counter = { written: 0 };
  const sql = {
    exec(query: string, ...args: unknown[]) {
      const st = db.prepare(query);
      if (/^\s*select/i.test(query)) {
        const rows = st.all(...(args as never[]));
        return { toArray: () => rows };
      }
      if (/^\s*create/i.test(query)) db.exec(query);
      else counter.written += Number(st.run(...(args as never[])).changes);
      return { toArray: () => [] };
    },
  };
  const storage = { sql, transactionSync: <T>(fn: () => T) => fn() } as unknown as DurableObjectStorage;
  return { storage, sql: sql as unknown as SqlStorage, counter };
}

const campaign = (id: string, budget = 100) => ({ id, name: `Kampagne ${id}`, status: 'Active', dailyBudget: budget });
const product = (id: string, clicks = 1) => ({ id, title: `Produkt ${id}`, metrics: { clicks } });

describe('the shared caches write only what changed', () => {
  it('campaigns: the same list again writes one row (the time it was read), a change writes that campaign', () => {
    const { storage, sql, counter } = fakeStorage();
    initAdsCache(sql);
    const list = Array.from({ length: 300 }, (_, i) => campaign(String(1000 + i)));
    expect(writeCampaigns(storage, '42', 1_000, list)).toBeNull();
    expect(counter.written).toBe(301);
    counter.written = 0;
    writeCampaigns(storage, '42', 2_000, list);
    expect(counter.written).toBe(1);
    counter.written = 0;
    const changed = list.map((c, i) => (i === 7 ? campaign(c.id, 250) : c)).filter((c) => c.id !== '1299');
    writeCampaigns(storage, '42', 3_000, changed);
    expect(counter.written).toBe(3); // one updated, one removed, the snapshot
    const back = readCampaigns(sql, '42');
    expect(back.fetchedAt).toBe(3_000);
    expect(back.campaigns).toHaveLength(299);
    expect((back.campaigns as { id: string; dailyBudget: number }[]).find((c) => c.id === '1007')!.dailyBudget).toBe(250);
  });

  it('products: the same period again writes one row; new numbers on a few products write those', () => {
    const { storage, sql, counter } = fakeStorage();
    initProductCache(sql);
    const period = '2026-11-01_2026-11-15';
    const list = Array.from({ length: 2000 }, (_, i) => product(`P${i}`));
    expect(writeProducts(storage, '42', period, 1_000, 5000, list)).toBeNull();
    counter.written = 0;
    writeProducts(storage, '42', period, 2_000, 5000, list);
    expect(counter.written).toBe(1);
    counter.written = 0;
    writeProducts(storage, '42', period, 3_000, 5000, list.map((p, i) => (i < 5 ? product(p.id, 9) : p)));
    expect(counter.written).toBe(6);
    expect(readProducts(sql, '42', period).products).toHaveLength(2000);
  });
});
