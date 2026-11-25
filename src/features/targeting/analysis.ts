/**
 * The targeting page (TargetingPage.tsx) and review_targeting: where a campaign's – or an ad
 * group's – money goes by hour and weekday, device, age, gender and region, which bid
 * adjustments to lower or raise, and whether each kind of targeting lives on the campaign or
 * on its ad groups.
 *
 * Microsoft: an ad group's own targets of a type REPLACE the campaign's of that type for that
 * ad group (no union). Ad schedule: once a schedule exists, no ads show outside its blocks;
 * at most 7 blocks per day. Adjustments: devices −100 … +900 (−100 = excluded), the rest
 * −90 … +900. Under automated bidding they are signals, not fixed multipliers.
 */
import type { AgeRange, CampaignTargets, DeviceName, GenderName, Metrics, ReportRow, ScheduleBlock, WeekDay } from '@/bing/types';

export type TargetDim = 'schedule' | 'device' | 'age' | 'gender' | 'location';

export const WEEK: WeekDay[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
export const DAY_SHORT: Record<WeekDay, string> = { Monday: 'Man', Tuesday: 'Tir', Wednesday: 'Ons', Thursday: 'Tor', Friday: 'Fre', Saturday: 'Lør', Sunday: 'Søn' };
export const DEVICE_LABEL: Record<DeviceName, string> = { Computers: 'Computer', Smartphones: 'Mobil', Tablets: 'Tablet' };
export const AGE_LABEL: Record<AgeRange, string> = {
  EighteenToTwentyFour: '18–24',
  TwentyFiveToThirtyFour: '25–34',
  ThirtyFiveToFortyNine: '35–49',
  FiftyToSixtyFour: '50–64',
  SixtyFiveAndAbove: '65+',
  Unknown: 'Ukendt',
};
export const GENDER_LABEL: Record<GenderName, string> = { Male: 'Mand', Female: 'Kvinde', Unknown: 'Ukendt' };
export const AGES = Object.keys(AGE_LABEL) as AgeRange[];
export const GENDERS: GenderName[] = ['Male', 'Female'];
export const DEVICES: DeviceName[] = ['Computers', 'Smartphones', 'Tablets'];
/** The day's blocks the schedule suggestions use (the team's standard schedule has the same). */
export const HOUR_BLOCKS: [number, number][] = [
  [0, 6],
  [6, 9],
  [9, 12],
  [12, 16],
  [16, 19],
  [19, 24],
];
export const MIN_ADJ: Record<TargetDim, number> = { schedule: -90, device: -100, age: -90, gender: -90, location: -90 };
export const MAX_ADJ = 900;
/** Segment adjustments: at least 30 conversions or 300 clicks (the playbook), steps of at most ±20 points. */
export const SEG_MIN_CONV = 30;
export const SEG_MIN_CLICKS = 300;
export const SEG_STEP = 20;

const EMPTY: Metrics = { impressions: 0, clicks: 0, spend: 0, conversions: 0, revenue: 0 };
const add = (a: Metrics, b: Partial<Metrics>): Metrics => ({
  impressions: a.impressions + (b.impressions ?? 0),
  clicks: a.clicks + (b.clicks ?? 0),
  spend: a.spend + (b.spend ?? 0),
  conversions: a.conversions + (b.conversions ?? 0),
  revenue: a.revenue + (b.revenue ?? 0),
});

/* ----------------------------------- report values ----------------------------------- */

export function deviceOf(v: string | undefined): DeviceName | null {
  const s = (v ?? '').toLowerCase();
  return s.startsWith('computer') ? 'Computers' : s.startsWith('smartphone') || s.startsWith('mobil') ? 'Smartphones' : s.startsWith('tablet') ? 'Tablets' : null;
}

export function ageOf(v: string | undefined): AgeRange | null {
  const s = (v ?? '').replace(/\s/g, '');
  const map: Record<string, AgeRange> = { '18-24': 'EighteenToTwentyFour', '25-34': 'TwentyFiveToThirtyFour', '35-49': 'ThirtyFiveToFortyNine', '50-64': 'FiftyToSixtyFour', '65+': 'SixtyFiveAndAbove', Unknown: 'Unknown' };
  return map[s] ?? (AGES.includes(s as AgeRange) ? (s as AgeRange) : null);
}

export function genderOf(v: string | undefined): GenderName | null {
  const s = (v ?? '').toLowerCase();
  return s === 'male' || s === 'mand' ? 'Male' : s === 'female' || s === 'kvinde' ? 'Female' : s ? 'Unknown' : null;
}

/** The five Danish regions under one key whatever language the name is in ("Hovedstaden", "Capital Region of Denmark|Denmark"). */
export function regionKey(name: string): string {
  const s = name.split('|')[0]!.toLowerCase();
  if (/hovedstad|capital/.test(s)) return 'capital';
  if (/midtjylland|central denmark/.test(s)) return 'central';
  if (/nordjylland|north denmark/.test(s)) return 'north';
  if (/syddanmark|southern denmark/.test(s)) return 'south';
  if (/sjælland|zealand/.test(s)) return 'zealand';
  return s.trim();
}

export const REGION_LABEL: Record<string, string> = { capital: 'Hovedstaden', central: 'Midtjylland', north: 'Nordjylland', south: 'Syddanmark', zealand: 'Sjælland' };

/** Monday-first weekday of an ISO date. */
export function weekdayOf(iso: string): WeekDay {
  const d = new Date(`${iso}T12:00:00Z`).getUTCDay();
  return WEEK[(d + 6) % 7]!;
}

/* --------------------------------------- levels --------------------------------------- */

export interface LevelInfo {
  /** The campaign has targets of this kind. */
  campaign: boolean;
  /** Ad groups with their own targets of this kind (they replace the campaign's). */
  groups: { id: string; name: string }[];
}

export const has = (t: CampaignTargets | null | undefined, dim: TargetDim): boolean => {
  if (!t) return false;
  if (dim === 'schedule') return t.schedule.length > 0;
  if (dim === 'device') return t.devices.length > 0;
  if (dim === 'location') return t.locations.length > 0;
  if (dim === 'age') return (t.ages ?? []).length > 0;
  return (t.genders ?? []).length > 0;
};

/** Per kind of targeting: on the campaign, and/or on which ad groups. */
export function targetLevels(campaign: CampaignTargets, groups: { id: string; name: string; targets: CampaignTargets | null }[]): Record<TargetDim, LevelInfo> {
  const dims: TargetDim[] = ['schedule', 'device', 'location', 'age', 'gender'];
  return Object.fromEntries(dims.map((d) => [d, { campaign: has(campaign, d), groups: groups.filter((g) => has(g.targets, d)).map((g) => ({ id: g.id, name: g.name })) }])) as Record<TargetDim, LevelInfo>;
}

/** Which level's targets apply to an ad group for a kind: its own when it has any, else the campaign's. */
export function sourceOf(dim: TargetDim, campaign: CampaignTargets, group: CampaignTargets | null): 'adgroup' | 'campaign' | 'none' {
  if (group && has(group, dim)) return 'adgroup';
  return has(campaign, dim) ? 'campaign' : 'none';
}

/* ------------------------------------- the schedule ------------------------------------- */

/** Per weekday 24 hours: the adjustment, or null for "no ads". `none`: no schedule at all (ads every hour at 0 %). */
export interface HourMap {
  none: boolean;
  days: Record<WeekDay, (number | null)[]>;
  /** The schedule had quarter hours – the grid shows whole hours. */
  rounded: boolean;
}

export function toHourMap(schedule: ScheduleBlock[]): HourMap {
  const none = schedule.length === 0;
  const days = Object.fromEntries(WEEK.map((d) => [d, Array.from({ length: 24 }, () => (none ? 0 : null))])) as HourMap['days'];
  let rounded = false;
  for (const b of schedule) {
    if (b.from % 1 || b.to % 1) rounded = true;
    for (let h = Math.floor(b.from); h < Math.ceil(b.to); h++) if (h >= 0 && h < 24) days[b.day][h] = b.adjustment;
  }
  return { none, days, rounded };
}

/** The hour map as blocks (equal neighbouring hours together). An untouched "no schedule" stays empty. */
export function fromHourMap(map: HourMap): ScheduleBlock[] {
  if (map.none) return [];
  const out: ScheduleBlock[] = [];
  for (const day of WEEK) {
    const hours = map.days[day];
    for (let h = 0; h < 24; ) {
      const v = hours[h];
      if (v === null || v === undefined) {
        h++;
        continue;
      }
      let end = h + 1;
      while (end < 24 && hours[end] === v) end++;
      out.push({ day, from: h, to: end, adjustment: v });
      h = end;
    }
  }
  return out;
}

/** Days with more than Microsoft's 7 blocks. */
export function tooManyBlocks(blocks: ScheduleBlock[]): WeekDay[] {
  return WEEK.filter((d) => blocks.filter((b) => b.day === d).length > 7);
}

/** Spend etc. per weekday × hour (Monday first) from the hourly report. */
export function weekGrid(rows: ReportRow[]): Record<WeekDay, Metrics[]> {
  const grid = Object.fromEntries(WEEK.map((d) => [d, Array.from({ length: 24 }, () => ({ ...EMPTY }))])) as Record<WeekDay, Metrics[]>;
  for (const r of rows) {
    if (!r.date || r.hour === undefined || r.hour === null) continue;
    const day = weekdayOf(r.date);
    const h = Number(r.hour);
    if (h >= 0 && h < 24) grid[day][h] = add(grid[day][h]!, r);
  }
  return grid;
}

/* ------------------------------------- segments ------------------------------------- */

export interface Segment {
  dim: TargetDim;
  /** The criterion value: a device, age, gender, region key, "hours:9-12" or "day:Monday". */
  key: string;
  label: string;
  m: Metrics;
}

export function segmentsOf(dim: TargetDim, rows: ReportRow[]): Segment[] {
  const by = new Map<string, Segment>();
  const put = (key: string, label: string, r: Partial<Metrics>) => {
    const s = by.get(key) ?? { dim, key, label, m: { ...EMPTY } };
    s.m = add(s.m, r);
    by.set(key, s);
  };
  for (const r of rows) {
    if (dim === 'device') {
      const d = deviceOf(r.device);
      if (d) put(d, DEVICE_LABEL[d], r);
    } else if (dim === 'age') {
      const a = ageOf(r.ageGroup);
      if (a) put(a, AGE_LABEL[a], r);
    } else if (dim === 'gender') {
      const g = genderOf(r.gender);
      if (g) put(g, GENDER_LABEL[g], r);
    } else if (dim === 'location') {
      if (r.region) {
        const k = regionKey(r.region);
        put(k, REGION_LABEL[k] ?? r.region, r);
      }
    } else if (r.date && r.hour !== undefined && r.hour !== null) {
      const h = Number(r.hour);
      const block = HOUR_BLOCKS.find(([a, b]) => h >= a && h < b)!;
      put(`hours:${block[0]}-${block[1]}`, `kl. ${String(block[0]).padStart(2, '0')}–${String(block[1]).padStart(2, '0')}`, r);
      const day = weekdayOf(r.date);
      put(`day:${day}`, DAY_SHORT[day], r);
    }
  }
  return [...by.values()].sort((a, b) => b.m.spend - a.m.spend);
}

/* ------------------------------------- suggestions ------------------------------------- */

export interface Suggestion {
  dim: TargetDim;
  key: string;
  label: string;
  current: number | null;
  suggested: number;
  delta: number;
  spendShare: number;
  /** Kroner spent in the segment – what is at stake, to sort by. */
  spend: number;
  why: string;
}

/** Value per krone: revenue per spend, or conversions per spend when no revenue is tracked. */
const value = (m: Metrics, useRevenue: boolean) => (m.spend > 0 ? (useRevenue ? m.revenue : m.conversions) / m.spend : 0);
const round5 = (v: number) => Math.round(v / 5) * 5;

/**
 * Where to lower or raise: a segment's value per krone against the whole campaign's (or ad
 * group's). The adjustment moves toward what the segment earns – (1 + now) × index − 1 – in
 * steps of at most ±20 points, only with 30 conversions or 300 clicks in the segment, and only
 * when the move is at least 10 points. 0 conversions on 300 clicks: −20.
 */
export function suggestAdjustments(segs: Segment[], current: (s: Segment) => number | null): Suggestion[] {
  const total = segs.reduce((t, s) => add(t, s.m), { ...EMPTY });
  // The schedule's hour blocks and weekdays are two views of the same money – shares per view.
  const totalOf = (s: Segment) => segs.filter((x) => x.key.split(':')[0] === s.key.split(':')[0] || (s.dim !== 'schedule' && x.dim === s.dim)).reduce((t, x) => add(t, x.m), { ...EMPTY });
  const useRevenue = total.revenue > 0;
  const out: Suggestion[] = [];
  for (const s of segs) {
    const base = s.dim === 'schedule' ? totalOf(s) : total;
    const enough = s.m.conversions >= SEG_MIN_CONV || s.m.clicks >= SEG_MIN_CLICKS;
    if (!enough || base.spend <= 0) continue;
    const now = current(s) ?? 0;
    const share = s.m.spend / base.spend;
    let target: number;
    let why: string;
    if (s.m.conversions <= 0) {
      target = now - SEG_STEP;
      why = `${Math.round(s.m.clicks)} klik for ${Math.round(s.m.spend)} kr. uden salg (${Math.round(share * 100)} % af forbruget).`;
    } else {
      const index = value(s.m, useRevenue) / value(base, useRevenue);
      target = ((1 + now / 100) * index - 1) * 100;
      why = `${useRevenue ? `ROAS ${(s.m.revenue / s.m.spend).toFixed(1)} mod ${(base.revenue / base.spend).toFixed(1)}` : `CPA ${Math.round(s.m.spend / s.m.conversions)} mod ${Math.round(base.spend / base.conversions)} kr.`} i alt – ${Math.round(share * 100)} % af forbruget.`;
    }
    const delta = round5(Math.max(-SEG_STEP, Math.min(SEG_STEP, target - now)));
    const suggested = Math.max(s.dim === 'device' ? -90 : MIN_ADJ[s.dim], Math.min(MAX_ADJ, now + delta));
    if (Math.abs(suggested - now) < 10) continue;
    out.push({ dim: s.dim, key: s.key, label: s.label, current: current(s), suggested, delta: suggested - now, spendShare: share, spend: s.m.spend, why });
  }
  return out.sort(bySpendAtStake);
}

/** Lowering first (money saved), then raising – each by the kroner in the segment. */
export const bySpendAtStake = (a: Suggestion, b: Suggestion) => Number(a.delta > 0) - Number(b.delta > 0) || b.spend - a.spend;

/** The adjustment a schedule segment has now: the most common one over its hours (null = no schedule there). */
export function scheduleAdjustment(map: HourMap, key: string): number | null {
  const values: number[] = [];
  if (key.startsWith('hours:')) {
    const [a, b] = key.slice(6).split('-').map(Number) as [number, number];
    for (const d of WEEK) for (let h = a; h < b; h++) if (map.days[d][h] !== null) values.push(map.days[d][h]!);
  } else {
    const d = key.slice(4) as WeekDay;
    for (const v of map.days[d] ?? []) if (v !== null) values.push(v);
  }
  if (!values.length) return null;
  const count = new Map<number, number>();
  for (const v of values) count.set(v, (count.get(v) ?? 0) + 1);
  return [...count].sort((x, y) => y[1] - x[1])[0]![0];
}

/** A schedule suggestion applied to the hour map: the hours of the block (or the day) move by its delta; hours without ads stay without. */
export function applyScheduleSuggestion(map: HourMap, s: Pick<Suggestion, 'key' | 'delta'>): HourMap {
  const days = Object.fromEntries(WEEK.map((d) => [d, [...map.days[d]]])) as HourMap['days'];
  const move = (v: number | null) => (v === null ? null : Math.max(-90, Math.min(MAX_ADJ, v + s.delta)));
  if (s.key.startsWith('hours:')) {
    const [a, b] = s.key.slice(6).split('-').map(Number) as [number, number];
    for (const d of WEEK) for (let h = a; h < b; h++) days[d][h] = move(days[d][h]!);
  } else {
    const d = s.key.slice(4) as WeekDay;
    days[d] = days[d].map(move);
  }
  return { none: false, days, rounded: map.rounded };
}
