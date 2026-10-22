/**
 * The dashboard's period: a calendar week (Monday–Sunday) or month, stepped back and
 * forth with the arrows, compared with the same days of the week/month before – so
 * Monday is compared with Monday, also while the current week is still running.
 */
import { addDays, daysBetween, parseIso, toIso, today, type DateRange } from '@/lib/format';

export type Granularity = 'week' | 'month';

export interface Period {
  range: DateRange;
  /** The same days of the week/month before (what the numbers are compared with). */
  previous: DateRange;
  /** The whole week/month before (its line in the chart). */
  previousFull: DateRange;
  /** Days in the whole week/month (the chart's x-axis), even if it has not ended yet. */
  length: number;
  label: string;
  /** The current week/month (no step forward from here). */
  current: boolean;
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
    const year = parseIso(end).getFullYear();
    return {
      range: { from, to },
      previous: { from: addDays(from, -7), to: addDays(to, -7) },
      previousFull: { from: addDays(from, -7), to: addDays(from, -1) },
      length: 7,
      label: `${dayMonth.format(parseIso(from))} – ${dayMonth.format(parseIso(end))} ${year}`,
      current: offset === 0,
    };
  }
  const r = parseIso(ref);
  const first = new Date(r.getFullYear(), r.getMonth() - offset, 1);
  const last = new Date(first.getFullYear(), first.getMonth() + 1, 0);
  const from = toIso(first);
  const end = toIso(last);
  const to = end < ref ? end : ref;
  const prevFirst = new Date(first.getFullYear(), first.getMonth() - 1, 1);
  const prevLast = new Date(first.getFullYear(), first.getMonth(), 0);
  const span = daysBetween(from, to);
  // The same days of the month before (31 March → the last day of February).
  const sameDay = addDays(toIso(prevFirst), span - 1);
  const prevTo = sameDay < toIso(prevLast) ? sameDay : toIso(prevLast);
  const label = monthYear.format(first);
  return {
    range: { from, to },
    previous: { from: toIso(prevFirst), to: prevTo },
    previousFull: { from: toIso(prevFirst), to: toIso(prevLast) },
    length: last.getDate(),
    label: label.charAt(0).toUpperCase() + label.slice(1),
    current: offset === 0,
  };
}

/** Labels for the chart's x-axis. */
export function axisLabels(granularity: Granularity, length: number): string[] {
  if (granularity === 'week') return ['Man', 'Tir', 'Ons', 'Tor', 'Fre', 'Lør', 'Søn'];
  return Array.from({ length }, (_, i) => String(i + 1));
}
