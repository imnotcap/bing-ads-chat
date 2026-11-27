/** "2. nov. 2026" or "2. – 4. nov. 2026": only the days that count. */
function daysLabel(from: string, to: string): string {
  const year = parseIso(to).getFullYear();
  return from === to ? `${dayMonth.format(parseIso(from))} ${year}` : `${dayMonth.format(parseIso(from))} – ${dayMonth.format(parseIso(to))} ${year}`;
}

/**
 * The dashboard's period: a calendar week (Monday–Sunday) or month, stepped back and
 * forth with the arrows, compared with the SAME WEEKDAYS a whole number of weeks before –
 * Monday with Monday, also while the period is still running. A week: the week before. A
 * month: 4 weeks before (28-day February) or 5 weeks before (29–31 days) – never by date,
 * which would set a Tuesday the 8th against a Sunday the 8th and mix in other weekends.
 */
import { addDays, parseIso, toIso, today, type DateRange } from '@/lib/format';

export type Granularity = 'week' | 'month';

export interface Period {
  range: DateRange;
  /** The same weekdays a whole number of weeks before (what the numbers are compared with). */
  previous: DateRange;
  /** The whole span before, weekday by weekday (its line in the chart). */
  previousFull: DateRange;
  /** How many weeks back the comparison is (1 for a week, 4 or 5 for a month). */
  weeksBack: number;
  /** "Ugen før" / "5 uger før (samme ugedage)" – and the dates compared with, "27. sep. – 23. okt.". */
  compareLabel: string;
  previousLabel: string;
  /** Days in the whole week/month (the chart's x-axis), even if it has not ended yet. */
  length: number;
  label: string;
  /** The current week/month (no step forward from here). */
  current: boolean;
  /** The period ends today, which is not over yet – its numbers are still coming in. */
  untilToday: boolean;
}

const dayMonth = new Intl.DateTimeFormat('da-DK', { day: 'numeric', month: 'short' });
const monthYear = new Intl.DateTimeFormat('da-DK', { month: 'long', year: 'numeric' });

function mondayOf(iso: string) {
  const day = (parseIso(iso).getDay() + 6) % 7;
  return addDays(iso, -day);
}

/** What a period is compared with: the period before, or the same period last year (52 weeks back). */
export type Compare = 'previous' | 'lastYear';

/** Same weekdays a year back: 52 weeks = 364 days (Black Friday against Black Friday, Monday against Monday). */
export const YEAR_WEEKS = 52;

export function periodOf(granularity: Granularity, offset: number, ref = today(), compare: Compare = 'previous'): Period {
  let from: string;
  let to: string;
  let length: number;
  let label: string;
  if (granularity === 'week') {
    from = addDays(mondayOf(ref), -7 * offset);
    const end = addDays(from, 6);
    to = end < ref ? end : ref;
    length = 7;
    label = daysLabel(from, to);
  } else {
    const r = parseIso(ref);
    const first = new Date(r.getFullYear(), r.getMonth() - offset, 1);
    const last = new Date(first.getFullYear(), first.getMonth() + 1, 0);
    from = toIso(first);
    const end = toIso(last);
    to = end < ref ? end : ref;
    length = last.getDate();
    const name = monthYear.format(first);
    // A month that is still running shows the days so far; a whole month its name.
    label = to < end ? daysLabel(from, to) : name.charAt(0).toUpperCase() + name.slice(1);
  }
  // Whole weeks back, so every day stands against the same weekday: a week 1 week, a month 4 or 5 weeks
  // (at least its length – never overlapping itself), last year 52 weeks.
  const weeksBack = compare === 'lastYear' ? YEAR_WEEKS : granularity === 'week' ? 1 : Math.ceil(length / 7);
  const shift = weeksBack * 7;
  const previous = { from: addDays(from, -shift), to: addDays(to, -shift) };
  return {
    range: { from, to },
    previous,
    previousFull: { from: addDays(from, -shift), to: addDays(from, -shift + length - 1) },
    weeksBack,
    compareLabel: compare === 'lastYear' ? 'Sidste år' : granularity === 'week' ? 'Ugen før' : `${weeksBack} uger før`,
    previousLabel: daysLabel(previous.from, previous.to),
    length,
    label,
    current: offset === 0,
    untilToday: to === ref,
  };
}

/** Labels for the chart's x-axis. */
export function axisLabels(granularity: Granularity, length: number): string[] {
  if (granularity === 'week') return ['Man', 'Tir', 'Ons', 'Tor', 'Fre', 'Lør', 'Søn'];
  return Array.from({ length }, (_, i) => String(i + 1));
}
