import { describe, expect, it } from 'vitest';
import { periodOf } from '@/features/dashboard/period';

describe('dashboard period', () => {
  it('runs the current week from Monday until today and compares with the same days', () => {
    const p = periodOf('week', 0, '2026-10-22'); // Thursday
    expect(p.range).toEqual({ from: '2026-10-19', to: '2026-10-22' });
    expect(p.previous).toEqual({ from: '2026-10-12', to: '2026-10-15' });
    expect(p.current).toBe(true);
  });

  it('steps back to whole weeks', () => {
    const p = periodOf('week', 1, '2026-10-22');
    expect(p.range).toEqual({ from: '2026-10-12', to: '2026-10-18' });
    expect(p.previous).toEqual({ from: '2026-10-05', to: '2026-10-11' });
  });

  it('compares a month with the same WEEKDAYS whole weeks before – never date against date', () => {
    const weekday = (iso: string) => new Date(`${iso}T12:00:00Z`).getUTCDay();
    // November 2026 so far (Sun 1 – Fri 27): 5 weeks back, Sun 27 Sep – Fri 23 Oct.
    const nov = periodOf('month', 0, '2026-11-27');
    expect(nov).toMatchObject({ range: { from: '2026-11-01', to: '2026-11-27' }, previous: { from: '2026-09-27', to: '2026-10-23' }, weeksBack: 5, length: 30 });
    expect(weekday(nov.previous.from)).toBe(weekday(nov.range.from));
    expect(weekday(nov.previous.to)).toBe(weekday(nov.range.to));
    // The whole month before for the chart: as many days, weekday by weekday, ending before the month starts.
    expect(nov.previousFull).toEqual({ from: '2026-09-27', to: '2026-10-26' });
    expect(nov.previousFull.to < nov.range.from).toBe(true);
    expect(nov.compareLabel).toBe('5 uger før');
    // A whole March against the same 31 weekdays 5 weeks before; a 28-day February against 4 weeks before.
    const mar = periodOf('month', 7, '2026-10-22');
    expect(mar).toMatchObject({ range: { from: '2026-03-01', to: '2026-03-31' }, previous: { from: '2026-01-25', to: '2026-02-24' } });
    expect(weekday(mar.previous.from)).toBe(weekday(mar.range.from));
    expect(periodOf('month', 8, '2026-10-22')).toMatchObject({ range: { from: '2026-02-01', to: '2026-02-28' }, previous: { from: '2026-01-04', to: '2026-01-31' }, weeksBack: 4 });
    // The 1st alone: the same weekday 5 weeks before.
    const first = periodOf('month', 0, '2026-12-01');
    expect(first.previous).toEqual({ from: '2026-10-27', to: '2026-10-27' });
    expect(weekday(first.previous.from)).toBe(weekday('2026-12-01'));
  });

  it('names only the days that count – not the rest of the week or month', () => {
    expect(periodOf('week', 0, '2026-11-02')).toMatchObject({ range: { from: '2026-11-02', to: '2026-11-02' }, previous: { from: '2026-10-26', to: '2026-10-26' }, untilToday: true });
    expect(periodOf('week', 0, '2026-11-02').label).toMatch(/^2\. nov\.? 2026$/);
    expect(periodOf('week', 0, '2026-11-04').label).toMatch(/^2\. nov\.? – 4\. nov\.? 2026$/);
    expect(periodOf('week', 1, '2026-11-04')).toMatchObject({ untilToday: false });
    expect(periodOf('week', 1, '2026-11-04').label).toMatch(/^26\. okt\.? – 1\. nov\.? 2026$/);
    expect(periodOf('month', 0, '2026-11-02').label).toMatch(/^1\. nov\.? – 2\. nov\.? 2026$/);
    expect(periodOf('month', 1, '2026-11-02').label).toBe('Oktober 2026');
  });
});
