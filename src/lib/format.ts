/** Danish number, currency and date formatting. */

const nf0 = new Intl.NumberFormat('da-DK', { maximumFractionDigits: 0 });
const nf1 = new Intl.NumberFormat('da-DK', { maximumFractionDigits: 1 });
const nf2 = new Intl.NumberFormat('da-DK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function fmtNumber(v: number | null | undefined, decimals = 0): string {
  if (v === null || v === undefined || Number.isNaN(v)) return '–';
  if (decimals === 0) return nf0.format(v);
  if (decimals === 1) return nf1.format(v);
  return nf2.format(v);
}

export function fmtCompact(v: number | null | undefined): string {
  if (v === null || v === undefined || Number.isNaN(v)) return '–';
  return new Intl.NumberFormat('da-DK', { notation: 'compact', maximumFractionDigits: 1 }).format(v);
}

export function fmtMoney(v: number | null | undefined, currency = 'DKK', decimals?: number): string {
  if (v === null || v === undefined || Number.isNaN(v)) return '–';
  const d = decimals ?? (Math.abs(v) >= 1000 || Number.isInteger(v) ? 0 : 2);
  return new Intl.NumberFormat('da-DK', {
    style: 'currency',
    currency,
    minimumFractionDigits: d,
    maximumFractionDigits: d,
  }).format(v);
}

export function fmtPercent(v: number | null | undefined, decimals = 1): string {
  if (v === null || v === undefined || Number.isNaN(v)) return '–';
  return `${new Intl.NumberFormat('da-DK', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(v * 100)}\u00a0%`;
}

export function fmtUsd(v: number): string {
  return new Intl.NumberFormat('da-DK', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: v < 1 ? 3 : 2 }).format(v);
}

const dateFmt = new Intl.DateTimeFormat('da-DK', { day: 'numeric', month: 'short' });
const dateLong = new Intl.DateTimeFormat('da-DK', { day: 'numeric', month: 'long', year: 'numeric' });
const timeFmt = new Intl.DateTimeFormat('da-DK', { hour: '2-digit', minute: '2-digit' });

export function fmtDate(iso: string): string {
  return dateFmt.format(parseIso(iso));
}

export function fmtDateLong(iso: string): string {
  return dateLong.format(parseIso(iso));
}

export function fmtTime(ts: number): string {
  return timeFmt.format(new Date(ts));
}

export function fmtRelative(ts: number): string {
  const diff = Date.now() - ts;
  const min = Math.round(diff / 60_000);
  if (min < 1) return 'lige nu';
  if (min < 60) return `${min} min. siden`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h} t. siden`;
  const d = Math.round(h / 24);
  if (d === 1) return 'i går';
  if (d < 7) return `${d} dage siden`;
  return dateFmt.format(new Date(ts));
}

/* ---------- ISO dates (local calendar days, no time zone surprises) ---------- */

export function parseIso(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1);
}

export function toIso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function addDays(iso: string, days: number): string {
  const d = parseIso(iso);
  d.setDate(d.getDate() + days);
  return toIso(d);
}

export function today(): string {
  return toIso(new Date());
}

export function daysBetween(from: string, to: string): number {
  return Math.round((parseIso(to).getTime() - parseIso(from).getTime()) / 86_400_000) + 1;
}

export function eachDay(from: string, to: string): string[] {
  const out: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}

export interface DateRange {
  from: string;
  to: string;
}

export type DatePreset = 'today' | 'yesterday' | 'last7' | 'last14' | 'last30' | 'thisMonth' | 'lastMonth' | 'last90';

export const DATE_PRESET_LABELS: Record<DatePreset, string> = {
  today: 'I dag',
  yesterday: 'I går',
  last7: 'Seneste 7 dage',
  last14: 'Seneste 14 dage',
  last30: 'Seneste 30 dage',
  thisMonth: 'Denne måned',
  lastMonth: 'Sidste måned',
  last90: 'Seneste 90 dage',
};

export function presetRange(preset: DatePreset, ref = today()): DateRange {
  const yesterday = addDays(ref, -1);
  const d = parseIso(ref);
  switch (preset) {
    case 'today':
      return { from: ref, to: ref };
    case 'yesterday':
      return { from: yesterday, to: yesterday };
    case 'last7':
      return { from: addDays(ref, -7), to: yesterday };
    case 'last14':
      return { from: addDays(ref, -14), to: yesterday };
    case 'last30':
      return { from: addDays(ref, -30), to: yesterday };
    case 'last90':
      return { from: addDays(ref, -90), to: yesterday };
    case 'thisMonth':
      return { from: toIso(new Date(d.getFullYear(), d.getMonth(), 1)), to: ref };
    case 'lastMonth':
      return {
        from: toIso(new Date(d.getFullYear(), d.getMonth() - 1, 1)),
        to: toIso(new Date(d.getFullYear(), d.getMonth(), 0)),
      };
  }
}

/** The equally long period right before `range`. */
export function previousRange(range: DateRange): DateRange {
  const len = daysBetween(range.from, range.to);
  return { from: addDays(range.from, -len), to: addDays(range.from, -1) };
}

export function monthKey(iso = today()): string {
  return iso.slice(0, 7);
}

export function daysInMonth(iso = today()): number {
  const d = parseIso(iso);
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
}
