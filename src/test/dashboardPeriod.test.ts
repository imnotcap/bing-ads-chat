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

  it('compares a month with the same days of the month before', () => {
    expect(periodOf('month', 0, '2026-10-22')).toMatchObject({ range: { from: '2026-10-01', to: '2026-10-22' }, previous: { from: '2026-09-01', to: '2026-09-22' }, length: 31 });
    expect(periodOf('month', 7, '2026-10-22')).toMatchObject({ range: { from: '2026-03-01', to: '2026-03-31' }, previous: { from: '2026-02-01', to: '2026-02-28' } });
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
