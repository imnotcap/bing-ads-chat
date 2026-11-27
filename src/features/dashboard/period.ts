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

export function periodOf(granularity: Granularity, offset: number, ref = today()): Period {
  if (granularity === 'week') {
    const from = addDays(mondayOf(ref), -7 * offset);
    const end = addDays(from, 6);
    const to = end < ref ? end : ref;
    return {
      range: { from, to },
      previous: { from: addDays(from, -7), to: addDays(to, -7) },
      previousFull: { from: addDays(from, -7), to: addDays(from, -1) },
      weeksBack: 1,
      compareLabel: 'Ugen før',
      previousLabel: daysLabel(addDays(from, -7), addDays(to, -7)),
      length: 7,
      label: daysLabel(from, to),
      current: offset === 0,
      untilToday: to === ref,
    };
  }
  const r = parseIso(ref);
  const first = new Date(r.getFullYear(), r.getMonth() - offset, 1);
  const last = new Date(first.getFullYear(), first.getMonth() + 1, 0);
  const from = toIso(first);
  const end = toIso(last);
  const to = end < ref ? end : ref;
  const length = last.getDate();
  // Whole weeks back, at least the month's length: the same weekdays, and never overlapping the month itself.
  const weeksBack = Math.ceil(length / 7);
  const shift = weeksBack * 7;
  const previous = { from: addDays(from, -shift), to: addDays(to, -shift) };
  const label = monthYear.format(first);
  return {
    range: { from, to },
    previous,
    previousFull: { from: addDays(from, -shift), to: addDays(from, -shift + length - 1) },
    weeksBack,
    compareLabel: `${weeksBack} uger før`,
    previousLabel: daysLabel(previous.from, previous.to),
    length,
    // A month that is still running shows the days so far; a whole month its name.
    label: to < end ? daysLabel(from, to) : label.charAt(0).toUpperCase() + label.slice(1),
    current: offset === 0,
    untilToday: to === ref,
  };
}

/** Labels for the chart's x-axis. */
export function axisLabels(granularity: Granularity, length: number): string[] {
  if (granularity === 'week') return ['Man', 'Tir', 'Ons', 'Tor', 'Fre', 'Lør', 'Søn'];
  return Array.from({ length }, (_, i) => String(i + 1));
}
