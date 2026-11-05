/**
 * The small, dependency-free pieces of Microsoft's report format: dates in and numbers
 * out. Kept apart from reports.ts so the Cloudflare Worker can use them too – it is
 * bundled without the app's `@/` path alias.
 */

export function msDate(iso: string) {
  const [y, m, d] = iso.split('-').map(Number);
  return { Day: d, Month: m, Year: y };
}

export function toNumber(v: string | undefined): number {
  if (!v) return 0;
  const n = Number(v.replace(/[%,\s]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

/** Accepts "2026-10-07" or "10/7/2026" (format depends on report locale). */
export function normalizeReportDate(value: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(value);
  if (m) return `${m[3]}-${m[1]?.padStart(2, '0')}-${m[2]?.padStart(2, '0')}`;
  return value;
}
