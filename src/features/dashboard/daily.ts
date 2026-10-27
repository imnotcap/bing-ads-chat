/**
 * The daily overview's tables: the stored days (workspace/daily.ts) summed into days,
 * weeks and months, and the colour that tells a good ROAS from a bad one at a glance.
 *
 * Every row is the sum of its days' five measures, and every ratio is worked out from
 * those sums – so a week's ROAS is the week's revenue over the week's spend, never an
 * average of seven daily figures, and the weeks of a month add up to the month.
 */
import { derive, sumMetrics } from '@/bing/metrics';
import type { DayMetrics } from '@/bing/dailyReport';
import type { DerivedMetrics, Metrics } from '@/bing/types';

export type Grain = 'day' | 'week' | 'month';

export interface PeriodRow {
  key: string;
  /** "27. okt. 2026", "Uge 44", "Oktober 2026". */
  label: string;
  /** The weekday of a day ("Tirsdag"), the dates of a week ("26. okt. – 1. nov."). */
  detail: string | null;
  from: string;
  to: string;
  sum: Metrics;
  metrics: DerivedMetrics;
  /** Still running (today, this week, this month) or only partly stored: the numbers will change. */
  partial: boolean;
}

/* ------------------------------------------------------------------ dates */

const utc = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1));
};
const isoOf = (d: Date) => d.toISOString().slice(0, 10);
const shift = (iso: string, days: number) => {
  const d = utc(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return isoOf(d);
};

/** Monday of the day's week (Danish weeks start on Monday). */
export function weekStart(iso: string): string {
  return shift(iso, -((utc(iso).getUTCDay() + 6) % 7));
}

/** The ISO week number – the one Danish calendars show (week 1 holds the year's first Thursday). */
export function isoWeek(iso: string): { year: number; week: number } {
  const thursday = utc(shift(weekStart(iso), 3));
  const jan1 = Date.UTC(thursday.getUTCFullYear(), 0, 1);
  return { year: thursday.getUTCFullYear(), week: Math.floor((thursday.getTime() - jan1) / 86_400_000 / 7) + 1 };
}

const dayLabel = new Intl.DateTimeFormat('da-DK', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
const shortLabel = new Intl.DateTimeFormat('da-DK', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const weekdayLabel = new Intl.DateTimeFormat('da-DK', { weekday: 'long', timeZone: 'UTC' });
const monthLabel = new Intl.DateTimeFormat('da-DK', { month: 'long', year: 'numeric', timeZone: 'UTC' });
const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/* ------------------------------------------------------------------ rows */

function row(key: string, label: string, detail: string | null, from: string, to: string, days: DayMetrics[], partial: boolean): PeriodRow {
  const sum = sumMetrics(days);
  return { key, label, detail, from, to, sum, metrics: derive(sum), partial };
}

/** Groups days by a key, newest group first. */
function groups(days: DayMetrics[], keyOf: (day: string) => string): [string, DayMetrics[]][] {
  const map = new Map<string, DayMetrics[]>();
  for (const d of days) {
    const k = keyOf(d.day);
    const list = map.get(k);
    if (list) list.push(d);
    else map.set(k, [d]);
  }
  return [...map.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1));
}

/** The days of one month ("2026-10"), newest first; today is marked as not final. */
export function dayRows(days: DayMetrics[], month: string, today: string): PeriodRow[] {
  return days
    .filter((d) => d.day.startsWith(`${month}-`) && d.day <= today)
    .sort((a, b) => (a.day < b.day ? 1 : -1))
    .map((d) => row(d.day, dayLabel.format(utc(d.day)), capital(weekdayLabel.format(utc(d.day))), d.day, d.day, [d], d.day === today));
}

/**
 * The newest `count` weeks with stored days. A week is not final while it is running, or
 * when the store does not reach back to its Monday (the first week of the history).
 */
export function weekRows(days: DayMetrics[], today: string, count = 13): PeriodRow[] {
  const stored = days.filter((d) => d.day <= today);
  const first = stored.reduce<string | null>((m, d) => (m === null || d.day < m ? d.day : m), null);
  const thisYear = today.slice(0, 4);
  return groups(stored, weekStart)
    .slice(0, count)
    .map(([monday, list]) => {
      const sunday = shift(monday, 6);
      const { year, week } = isoWeek(monday);
      const label = `Uge ${week}${String(year) === thisYear ? '' : ` · ${year}`}`;
      const detail = `${shortLabel.format(utc(monday))} – ${shortLabel.format(utc(sunday))}`;
      return row(monday, label, detail, monday, sunday, list, sunday >= today || (first !== null && monday < first));
    });
}

/** The newest `count` months with stored days; the running month (or one only partly stored) is not final. */
export function monthRows(days: DayMetrics[], today: string, count = 13): PeriodRow[] {
  const stored = days.filter((d) => d.day <= today);
  const first = stored.reduce<string | null>((m, d) => (m === null || d.day < m ? d.day : m), null);
  return groups(stored, (day) => day.slice(0, 7))
    .slice(0, count)
    .map(([month, list]) => {
      const [y, m] = month.split('-').map(Number);
      const from = `${month}-01`;
      // Day 0 of the next month is the last of this one (December rolls into the next year).
      const last = isoOf(new Date(Date.UTC(y ?? 1970, m ?? 1, 0)));
      return row(month, capital(monthLabel.format(utc(from))), null, from, last, list, last >= today || (first !== null && from < first));
    });
}

/** The rows' sum – the table's Total line. */
export function totalOf(rows: PeriodRow[]): DerivedMetrics {
  return derive(sumMetrics(rows.map((r) => r.sum)));
}

/* ------------------------------------------------------------------ ROAS colour */

/** Where red ends and green begins – set per account under the table. */
export interface RoasScale {
  red: number;
  green: number;
}

export const DEFAULT_ROAS_SCALE: RoasScale = { red: 2, green: 3.5 };

/** A scale someone typed in: positive numbers, green above red. */
export function validScale(s: Partial<RoasScale> | null | undefined): RoasScale {
  const red = Number(s?.red);
  const green = Number(s?.green);
  return Number.isFinite(red) && Number.isFinite(green) && red >= 0 && green > red ? { red, green } : DEFAULT_ROAS_SCALE;
}

/**
 * Red, orange, yellow, green and a deeper green a whole point above. Light enough for the
 * figure on top to stay readable everywhere on the scale (6:1 or better against the ink).
 */
const COLORS: [number, number, number][] = [
  [243, 112, 104],
  [246, 164, 82],
  [244, 205, 92],
  [110, 196, 120],
  [56, 170, 104],
];

/** The cell colour for a ROAS on a scale, or null when there is no ROAS (no spend). */
export function roasColor(roas: number | null, scale: RoasScale): string | null {
  if (roas === null || !Number.isFinite(roas)) return null;
  const { red, green } = validScale(scale);
  const step = (green - red) / 3;
  const at = [red, red + step, red + 2 * step, green, green + 1];
  let i = 0;
  while (i < at.length - 1 && roas > at[i + 1]!) i++;
  const lo = COLORS[i]!;
  const hi = COLORS[Math.min(i + 1, COLORS.length - 1)]!;
  const t = i >= at.length - 1 ? 0 : Math.min(1, Math.max(0, (roas - at[i]!) / (at[i + 1]! - at[i]!)));
  const mix = lo.map((c, k) => Math.round(c + (hi[k]! - c) * t));
  return `rgb(${mix[0]} ${mix[1]} ${mix[2]})`;
}
