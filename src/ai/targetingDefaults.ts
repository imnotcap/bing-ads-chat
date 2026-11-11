/**
 * The team's standard targeting, set when the assistant creates a campaign or an ad
 * group (and on request with set_campaign_targeting):
 *   - devices: computers 0 %, smartphones and tablets -90 %
 *   - the ad schedule below (the same as in Microsoft Advertising: Campaign → Ad schedule)
 *   - locations: Denmark and its five regions, all 0 %
 */
import type { CampaignTargets, DeviceName, ScheduleBlock, TargetChanges, WeekDay } from '@/bing/types';

export const WEEK: WeekDay[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
export const DAY_LABELS: Record<WeekDay, string> = {
  Monday: 'Mandag',
  Tuesday: 'Tirsdag',
  Wednesday: 'Onsdag',
  Thursday: 'Torsdag',
  Friday: 'Fredag',
  Saturday: 'Lørdag',
  Sunday: 'Søndag',
};
export const DEVICE_LABELS: Record<DeviceName, string> = { Computers: 'Computer', Smartphones: 'Mobil', Tablets: 'Tablet' };

export const STANDARD_DEVICES: Record<DeviceName, number> = { Computers: 0, Smartphones: -90, Tablets: -90 };

/** The day's six blocks: 00–06, 06–09, 09–12, 12–16, 16–19, 19–24. */
const HOURS: [number, number][] = [
  [0, 6],
  [6, 9],
  [9, 12],
  [12, 16],
  [16, 19],
  [19, 24],
];
const day = (d: WeekDay, adjustments: number[]): ScheduleBlock[] => HOURS.map(([from, to], i) => ({ day: d, from, to, adjustment: adjustments[i]! }));

export const STANDARD_SCHEDULE: ScheduleBlock[] = [
  ...(['Monday', 'Tuesday', 'Wednesday', 'Thursday'] as const).flatMap((d) => day(d, [-35, 0, 0, 0, -25, -25])),
  ...day('Friday', [0, 0, 0, 0, -25, -55]),
  ...day('Saturday', [-55, -55, -55, -55, -55, -55]),
  ...day('Sunday', [-55, -55, -55, -55, -40, -40]),
];

/** English names as in Microsoft's locations file. */
export const STANDARD_LOCATIONS = ['Denmark', 'Capital Region of Denmark', 'Central Denmark Region', 'North Denmark Region', 'Region of Southern Denmark', 'Region Zealand'];

export const fmtHour = (h: number) => `${String(h).padStart(2, '0')}`;
export const fmtAdjustment = (a: number) => (a > 0 ? `+${a} %` : a < 0 ? `−${Math.abs(a)} %` : '0 %');
const sameBlock = (a: ScheduleBlock, b: ScheduleBlock) => a.day === b.day && a.from === b.from && a.to === b.to;

/** "00–06 −35 % · 06–16 0 % · 16–24 −25 %" – neighbouring blocks with the same adjustment shown together. */
export function describeDay(blocks: ScheduleBlock[]): string {
  const sorted = [...blocks].sort((a, b) => a.from - b.from);
  const merged: ScheduleBlock[] = [];
  for (const b of sorted) {
    const last = merged[merged.length - 1];
    if (last && last.to === b.from && last.adjustment === b.adjustment) last.to = b.to;
    else merged.push({ ...b });
  }
  return merged.length ? merged.map((b) => `${fmtHour(b.from)}–${fmtHour(b.to)} ${fmtAdjustment(b.adjustment)}`).join(' · ') : 'ingen annoncer';
}

/** Hours of each day the schedule does not cover – no ads are shown then. */
export function scheduleGaps(blocks: ScheduleBlock[]): string[] {
  if (!blocks.length) return [];
  const out: string[] = [];
  for (const d of WEEK) {
    const covered = new Array<boolean>(24).fill(false);
    for (const b of blocks.filter((x) => x.day === d)) for (let h = b.from; h < b.to; h++) covered[h] = true;
    const gaps: string[] = [];
    for (let h = 0; h < 24; h++) {
      if (covered[h]) continue;
      let end = h;
      while (end < 24 && !covered[end]) end++;
      gaps.push(`${fmtHour(h)}–${fmtHour(end)}`);
      h = end;
    }
    if (gaps.length) out.push(`${DAY_LABELS[d]} ${gaps.join(', ')}`);
  }
  return out;
}

/** Blocks that overlap on the same day (Microsoft refuses them). */
export function scheduleOverlaps(blocks: ScheduleBlock[]): string[] {
  const out: string[] = [];
  for (const d of WEEK) {
    const list = blocks.filter((b) => b.day === d).sort((a, b) => a.from - b.from);
    for (let i = 1; i < list.length; i++) if (list[i]!.from < list[i - 1]!.to) out.push(`${DAY_LABELS[d]} ${fmtHour(list[i - 1]!.from)}–${fmtHour(list[i - 1]!.to)} og ${fmtHour(list[i]!.from)}–${fmtHour(list[i]!.to)}`);
  }
  return out;
}

/** Devices: all three, as wanted (missing ones 0 %). */
export function deviceChanges(current: CampaignTargets['devices'], wanted: Partial<Record<DeviceName, number>>): TargetChanges {
  const out: TargetChanges = { add: [], update: [], delete: [] };
  const full = { Computers: 0, Smartphones: 0, Tablets: 0, ...wanted };
  const byDevice = new Map(current.map((d) => [d.device, d]));
  // Microsoft adds device criterions only as a set of three; with all three present they are updated one by one.
  if (current.length < 3) {
    out.delete.push(...current.map((d) => d.id));
    for (const device of Object.keys(full) as DeviceName[]) out.add.push({ kind: 'device', device, adjustment: full[device] });
    return out;
  }
  for (const device of Object.keys(full) as DeviceName[]) {
    const now = byDevice.get(device)!;
    if (now.adjustment !== full[device]) out.update.push({ kind: 'device', device, adjustment: full[device], id: now.id });
  }
  return out;
}

/** The schedule becomes exactly `wanted`: same blocks keep their id (adjustment updated), the rest is replaced. */
export function scheduleChanges(current: CampaignTargets['schedule'], wanted: ScheduleBlock[]): TargetChanges {
  const out: TargetChanges = { add: [], update: [], delete: [] };
  for (const c of current) if (!wanted.some((w) => sameBlock(w, c))) out.delete.push(c.id);
  for (const w of wanted) {
    const now = current.find((c) => sameBlock(c, w));
    if (!now) out.add.push({ kind: 'schedule', ...w });
    else if (now.adjustment !== w.adjustment) out.update.push({ kind: 'schedule', ...w, id: now.id });
  }
  return out;
}

export const mergeChanges = (...list: TargetChanges[]): TargetChanges => ({
  add: list.flatMap((c) => c.add),
  update: list.flatMap((c) => c.update),
  delete: list.flatMap((c) => c.delete),
});

export const isEmptyChange = (c: TargetChanges) => !c.add.length && !c.update.length && !c.delete.length;

/** Does the campaign already use the standard devices? */
export const hasStandardDevices = (devices: CampaignTargets['devices']) =>
  devices.length === 3 && devices.every((d) => d.adjustment === STANDARD_DEVICES[d.device]);
