/**
 * The two Cloudflare Durable Object types the Worker's cache modules use – enough for the
 * app's typecheck when a test imports them (src/test/doWrites.test.ts). The Worker itself
 * is checked against @cloudflare/workers-types.
 */
interface SqlStorageCursor<T> {
  toArray(): T[];
}
interface SqlStorage {
  exec<T = Record<string, unknown>>(query: string, ...bindings: unknown[]): SqlStorageCursor<T>;
}
interface DurableObjectStorage {
  sql: SqlStorage;
  transactionSync<T>(fn: () => T): T;
}
