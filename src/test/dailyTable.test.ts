import { describe, expect, it } from 'vitest';
import type { DayMetrics } from '@/bing/dailyReport';
import { DEFAULT_ROAS_SCALE, dayRows, isoWeek, monthRows, roasColor, totalOf, validScale, weekRows, weekStart } from '@/features/dashboard/daily';
import { eachDay } from '@/lib/format';
import { daysFromReport } from '@/workspace/daily';

const zero = (day: string): DayMetrics => ({ day, impressions: 0, clicks: 0, spend: 0, conversions: 0, revenue: 0 });

/**
 * October 2026 from the Google Ads overview the team used: the month's totals, spread
 * over its weeks the way that overview showed them (weeks 40–44, impressions per week).
 */
const OCTOBER = { impressions: 4_635_043, clicks: 46_623, spend: 722_956.27, conversions: 623.14, revenue: 2_256_137.65 };
const WEEK_IMPRESSIONS: [string, number][] = [
  ['2026-10-01', 567_578], // week 40 – only its October days
  ['2026-10-05', 1_234_329], // week 41 (a Monday)
  ['2026-10-12', 1_278_238], // week 42
  ['2026-10-19', 1_267_970], // week 43
  ['2026-10-26', 286_928], // week 44 – running
];

function october(): DayMetrics[] {
  const days = eachDay('2026-10-01', '2026-10-27').map(zero);
  const byDay = new Map(days.map((d) => [d.day, d]));
  for (const [day, impressions] of WEEK_IMPRESSIONS) byDay.get(day)!.impressions = impressions;
  // Everything else on one day: the month's sums are what matter.
  Object.assign(byDay.get('2026-10-15')!, { clicks: OCTOBER.clicks, spend: OCTOBER.spend, conversions: OCTOBER.conversions, revenue: OCTOBER.revenue });
  return days;
}

describe('weeks and dates', () => {
  it('starts weeks on Monday', () => {
    expect(weekStart('2026-10-27')).toBe('2026-10-26');
    expect(weekStart('2026-11-01')).toBe('2026-10-26'); // Sunday
    expect(weekStart('2026-10-26')).toBe('2026-10-26');
  });

  it('numbers weeks as Danish calendars do, also across new year', () => {
    expect(isoWeek('2026-10-27')).toEqual({ year: 2026, week: 44 });
    expect(isoWeek('2026-10-01')).toEqual({ year: 2026, week: 40 });
    expect(isoWeek('2026-01-01')).toEqual({ year: 2026, week: 1 });
    expect(isoWeek('2027-01-01')).toEqual({ year: 2026, week: 53 });
    expect(isoWeek('2024-12-30')).toEqual({ year: 2025, week: 1 });
  });
});

describe('the tables', () => {
  it('gives the same October as the overview the team knows – ratios from sums', () => {
    const [oct] = monthRows(october(), '2026-10-27');
    expect(oct!.label).toBe('Oktober 2026');
    expect(oct!.metrics.impressions).toBe(OCTOBER.impressions);
    expect(oct!.metrics.ctr).toBeCloseTo(0.0101, 4); // 1,01 %
    expect(oct!.metrics.cpc).toBe(15.51);
    expect(oct!.metrics.cpa).toBe(1160.18); // Pris / konv.
    expect(oct!.metrics.roas).toBe(3.12);
    expect(oct!.partial).toBe(true); // the month is still running
  });

  it('adds the weeks up to the month, newest first, and marks the cut-off and running weeks', () => {
    const weeks = weekRows(october(), '2026-10-27');
    expect(weeks.map((w) => w.label)).toEqual(['Uge 44', 'Uge 43', 'Uge 42', 'Uge 41', 'Uge 40']);
    expect(weeks.map((w) => w.metrics.impressions)).toEqual([286_928, 1_267_970, 1_278_238, 1_234_329, 567_578]);
    expect(totalOf(weeks).impressions).toBe(OCTOBER.impressions);
    expect(weeks[0]!.partial).toBe(true); // running
    expect(weeks[1]!.partial).toBe(false);
    expect(weeks[4]!.partial).toBe(true); // Monday 29 September is not stored
    expect(weeks[0]!.detail).toBe('26. okt. – 1. nov.');
  });

  it('lists a month day by day, newest first, with the weekday and today as not final', () => {
    const days = dayRows(october(), '2026-10', '2026-10-27');
    expect(days).toHaveLength(27);
    expect(days[0]).toMatchObject({ label: '27. okt. 2026', detail: 'Tirsdag', partial: true });
    expect(days[1]).toMatchObject({ key: '2026-10-26', detail: 'Mandag', partial: false });
    expect(days.at(-1)!.key).toBe('2026-10-01');
    expect(totalOf(days).roas).toBe(3.12);
  });

  it('ends December on the 31st and keeps only the newest months asked for', () => {
    const days = eachDay('2025-11-15', '2026-01-10').map(zero);
    const months = monthRows(days, '2026-01-10', 2);
    expect(months.map((m) => [m.key, m.from, m.to])).toEqual([
      ['2026-01', '2026-01-01', '2026-01-31'],
      ['2025-12', '2025-12-01', '2025-12-31'],
    ]);
    expect(months[1]!.partial).toBe(false);
    expect(monthRows(days, '2026-01-10')[2]!.partial).toBe(true); // November starts before the first stored day
  });

  it('turns a backend report into one entry per day', () => {
    const days = daysFromReport([{ date: '2026-10-26', impressions: 5, clicks: 1, spend: 2, conversions: 0.5, revenue: 9 }], { from: '2026-10-25', to: '2026-10-26' });
    expect(days).toEqual([zero('2026-10-25'), { day: '2026-10-26', impressions: 5, clicks: 1, spend: 2, conversions: 0.5, revenue: 9 }]);
  });
});

/* ------------------------------------------------------------------ colour */

const rgb = (c: string) => c.match(/\d+/g)!.map(Number) as [number, number, number];
const luminance = ([r, g, b]: number[]) => {
  const lin = (v: number) => ((v /= 255) <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  return 0.2126 * lin(r!) + 0.7152 * lin(g!) + 0.0722 * lin(b!);
};
const INK = luminance([0x12, 0x12, 0x16]);

describe('ROAS colour', () => {
  it('runs red → orange → yellow → green over the default 2 – 3,5', () => {
    expect(roasColor(1.07, DEFAULT_ROAS_SCALE)).toBe('rgb(243 112 104)');
    expect(roasColor(2, DEFAULT_ROAS_SCALE)).toBe('rgb(243 112 104)');
    expect(roasColor(2.5, DEFAULT_ROAS_SCALE)).toBe('rgb(246 164 82)');
    expect(roasColor(3, DEFAULT_ROAS_SCALE)).toBe('rgb(244 205 92)');
    expect(roasColor(3.5, DEFAULT_ROAS_SCALE)).toBe('rgb(110 196 120)');
    expect(roasColor(9, DEFAULT_ROAS_SCALE)).toBe('rgb(56 170 104)');
    // The team's own reading of October: 2,43 orange-red, 3,12 yellow, 4,3 green.
    const [r1, g1] = rgb(roasColor(2.43, DEFAULT_ROAS_SCALE)!);
    expect(r1).toBeGreaterThan(240);
    expect(g1).toBeLessThan(164);
    expect(rgb(roasColor(3.12, DEFAULT_ROAS_SCALE)!)[1]).toBeGreaterThan(195);
    expect(rgb(roasColor(4.3, DEFAULT_ROAS_SCALE)!)[0]).toBeLessThan(110);
  });

  it('has no colour without spend', () => {
    expect(roasColor(null, DEFAULT_ROAS_SCALE)).toBeNull();
  });

  it('follows a scale set for the account, and refuses one where green is not above red', () => {
    expect(roasColor(5, { red: 5, green: 8 })).toBe('rgb(243 112 104)');
    expect(validScale({ red: 4, green: 3 })).toEqual(DEFAULT_ROAS_SCALE);
    expect(validScale({ red: Number.NaN, green: 3 })).toEqual(DEFAULT_ROAS_SCALE);
    expect(validScale({ red: 1.5, green: 4 })).toEqual({ red: 1.5, green: 4 });
  });

  it('keeps the figure readable everywhere on the scale (contrast 4,5:1 or better)', () => {
    for (let roas = 0; roas <= 6; roas += 0.01) {
      const contrast = (luminance(rgb(roasColor(roas, DEFAULT_ROAS_SCALE)!)) + 0.05) / (INK + 0.05);
      expect(contrast).toBeGreaterThanOrEqual(4.5);
    }
  });
});
