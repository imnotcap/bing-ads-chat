/**
 * The targeting page's draft (what the user set) against what Microsoft has, as the changes
 * to send (TargetChanges) and the lines for the confirmation and the change log.
 *
 * Microsoft's rules kept here: device adjustments only as the set of all three; the ad
 * schedule replaced block by block (an unchanged block keeps its id, a changed adjustment is
 * an update); at most 7 blocks per day.
 */
import type { AgeRange, CampaignTargets, DeviceName, GenderName, ScheduleBlock, TargetChanges, TargetCriterion } from '@/bing/types';
import type { ChangeLine } from '@/stores/activity';
import { AGES, AGE_LABEL, DEVICES, DEVICE_LABEL, GENDERS, GENDER_LABEL, WEEK, fromHourMap, toHourMap, tooManyBlocks, type HourMap } from './analysis';

export interface Draft {
  schedule: HourMap;
  devices: Record<DeviceName, number | null>;
  ages: Record<AgeRange, number | null>;
  genders: Record<GenderName, number | null>;
  /** Locations: removed ones are dropped from the list; new ones have no id. */
  locations: { id?: string; locationId: string; name: string; adjustment: number }[];
}

const DAY_DA: Record<string, string> = { Monday: 'Mandag', Tuesday: 'Tirsdag', Wednesday: 'Onsdag', Thursday: 'Torsdag', Friday: 'Fredag', Saturday: 'Lørdag', Sunday: 'Søndag' };
export const fmtAdj = (a: number | null | undefined) => (a === null || a === undefined ? '–' : a > 0 ? `+${a} %` : a < 0 ? `−${Math.abs(a)} %` : '0 %');
const hh = (h: number) => String(h).padStart(2, '0');
const describe = (blocks: ScheduleBlock[]) =>
  blocks.length ? [...blocks].sort((a, b) => a.from - b.from).map((b) => `${hh(b.from)}–${hh(b.to)} ${fmtAdj(b.adjustment)}`).join(' · ') : 'ingen annoncer';

export function draftOf(t: CampaignTargets): Draft {
  return {
    schedule: toHourMap(t.schedule),
    devices: Object.fromEntries(DEVICES.map((d) => [d, t.devices.find((x) => x.device === d)?.adjustment ?? null])) as Draft['devices'],
    ages: Object.fromEntries(AGES.map((a) => [a, t.ages?.find((x) => x.age === a)?.adjustment ?? null])) as Draft['ages'],
    genders: Object.fromEntries([...GENDERS, 'Unknown' as GenderName].map((g) => [g, t.genders?.find((x) => x.gender === g)?.adjustment ?? null])) as Draft['genders'],
    locations: t.locations.map((l) => ({ id: l.id, locationId: l.locationId, name: l.name, adjustment: l.adjustment })),
  };
}

export function changesOf(t: CampaignTargets, d: Draft, scope: string): { changes: TargetChanges; lines: ChangeLine[]; errors: string[] } {
  const changes: TargetChanges = { add: [], update: [], delete: [] };
  const lines: ChangeLine[] = [];
  const errors: string[] = [];
  const line = (field: string, before: string, after: string) => lines.push({ entity: 'Målretning', field: `${scope}${field}`, before, after });

  /* devices – all three together */
  const deviceChanged = DEVICES.some((dev) => (d.devices[dev] ?? null) !== (t.devices.find((x) => x.device === dev)?.adjustment ?? null));
  if (deviceChanged) {
    for (const dev of DEVICES) {
      const now = t.devices.find((x) => x.device === dev);
      const want = d.devices[dev] ?? 0;
      if (now && now.adjustment !== want) changes.update.push({ kind: 'device', device: dev, adjustment: want, id: now.id });
      else if (!now) changes.add.push({ kind: 'device', device: dev, adjustment: want });
      if ((now?.adjustment ?? null) !== want) line(`Enhed · ${DEVICE_LABEL[dev]}`, fmtAdj(now?.adjustment), fmtAdj(want));
    }
  }

  /* ages and genders: set, changed or removed (null) one by one */
  const each = (now: { id: string; adjustment: number } | undefined, w: number | null, mk: (adj: number) => TargetCriterion, label: string) => {
    if ((now?.adjustment ?? null) === w) return;
    if (now && w === null) changes.delete.push(now.id);
    else if (now) changes.update.push({ ...mk(w!), id: now.id });
    else changes.add.push(mk(w!));
    line(label, now ? fmtAdj(now.adjustment) : '–', w === null ? 'fjernet' : fmtAdj(w));
  };
  for (const age of AGES) each(t.ages?.find((x) => x.age === age), d.ages[age] ?? null, (adjustment) => ({ kind: 'age', age, adjustment }), `Alder · ${AGE_LABEL[age]}`);
  for (const gender of [...GENDERS, 'Unknown' as GenderName]) each(t.genders?.find((x) => x.gender === gender), d.genders[gender] ?? null, (adjustment) => ({ kind: 'gender', gender, adjustment }), `Køn · ${GENDER_LABEL[gender]}`);

  /* locations */
  for (const now of t.locations) {
    const w = d.locations.find((l) => l.id === now.id);
    if (!w) {
      changes.delete.push(now.id);
      line(`Lokation · ${now.name.split('|')[0]}`, fmtAdj(now.adjustment), 'fjernet');
    } else if (w.adjustment !== now.adjustment) {
      changes.update.push({ kind: 'location', locationId: now.locationId, adjustment: w.adjustment, id: now.id });
      line(`Lokation · ${now.name.split('|')[0]}`, fmtAdj(now.adjustment), fmtAdj(w.adjustment));
    }
  }
  for (const w of d.locations.filter((l) => !l.id)) {
    changes.add.push({ kind: 'location', locationId: w.locationId, adjustment: w.adjustment });
    line(`Lokation · ${w.name.split('|')[0]}`, '–', fmtAdj(w.adjustment));
  }

  /* the schedule, day by day */
  const want = fromHourMap(d.schedule);
  const crowded = tooManyBlocks(want);
  if (crowded.length) errors.push(`Microsoft tillader højst 7 tidsrum pr. dag – ${crowded.map((x) => DAY_DA[x]).join(', ')} har flere. Saml nogle af dem.`);
  for (const day of WEEK) {
    const before = t.schedule.filter((b) => b.day === day);
    const after = want.filter((b) => b.day === day);
    if (describe(before) === describe(after)) continue;
    const kept = new Set<string>();
    for (const b of after) {
      const same = before.find((x) => x.from === b.from && x.to === b.to && !kept.has(x.id));
      if (same) {
        kept.add(same.id);
        if (same.adjustment !== b.adjustment) changes.update.push({ kind: 'schedule', ...b, id: same.id });
      } else changes.add.push({ kind: 'schedule', ...b });
    }
    for (const x of before) if (!kept.has(x.id)) changes.delete.push(x.id);
    line(`Tidsplan · ${DAY_DA[day]}`, before.length || t.schedule.length ? describe(before) : 'hele døgnet', describe(after));
  }
  if (!t.schedule.length && want.length) lines.push({ entity: 'Målretning', field: `${scope}Tidsplan`, before: 'ingen (annoncer hele døgnet)', after: 'uden for tidsrummene vises ingen annoncer' });
  return { changes, lines, errors };
}
