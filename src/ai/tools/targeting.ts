/**
 * A campaign's targeting: bid adjustments by device, the ad schedule and locations.
 * Microsoft takes them as "Targets" criterions; device adjustments only as the set of
 * all three. Everything is read back after sending. The team's standard (devices,
 * schedule, Danish regions – see ai/targetingDefaults.ts) is also set from here when the
 * assistant creates a campaign or ad groups.
 */
import { z } from 'zod';
import type { Campaign, CampaignTargets, DeviceName, GeoLocation, ScheduleBlock, WeekDay } from '@/bing/types';
import type { ChangeLine } from '@/stores/activity';
import {
  DAY_LABELS,
  DEVICE_LABELS,
  STANDARD_DEVICES,
  STANDARD_LOCATIONS,
  STANDARD_SCHEDULE,
  WEEK,
  describeDay,
  deviceChanges,
  fmtAdjustment,
  isEmptyChange,
  mergeChanges,
  scheduleChanges,
  scheduleGaps,
  scheduleOverlaps,
} from '../targetingDefaults';
import { readBack, report, verify, type LineCheck, type Verified } from './checks';
import { defineWrite, getCampaign, type ToolContext } from './context';

/** What the campaign should end up with (left out = unchanged). */
export interface WantedTargets {
  devices?: Partial<Record<DeviceName, number>>;
  schedule?: ScheduleBlock[];
  /** English names, added when missing (existing locations are kept). */
  locations?: string[];
}

export interface TargetingPlan {
  lines: ChangeLine[];
  notes: string[];
  /** The places found for the wanted names (looked up once, at planning). */
  places: GeoLocation[];
}

const EMPTY: CampaignTargets = { devices: [], schedule: [], locations: [] };

export async function readTargets(ctx: ToolContext, campaignId: string | null): Promise<CampaignTargets> {
  if (!campaignId || !ctx.backend.getCampaignTargets) return EMPTY;
  return ctx.backend.getCampaignTargets(ctx.accountId, campaignId);
}

/** The team standard for a campaign: devices always; the schedule and the Danish regions only where the campaign has none of its own. */
export function standardFor(current: CampaignTargets): WantedTargets {
  const ownLocations = current.locations.length > 0;
  return {
    devices: STANDARD_DEVICES,
    ...(current.schedule.length ? {} : { schedule: STANDARD_SCHEDULE }),
    ...(ownLocations ? {} : { locations: STANDARD_LOCATIONS }),
  };
}

/** Lines for the approval card (one per device, per day of the schedule, per location) and notes. */
export async function planTargeting(ctx: ToolContext, wanted: WantedTargets, current: CampaignTargets, scope: string): Promise<TargetingPlan> {
  const lines: ChangeLine[] = [];
  const notes: string[] = [];
  if (!ctx.backend.applyCampaignTargets) {
    notes.push('Enheder, tidsplan og lokationer kan ikke sættes på denne konto.');
    return { lines, notes, places: [] };
  }
  if (wanted.devices) {
    const full = { Computers: 0, Smartphones: 0, Tablets: 0, ...wanted.devices };
    for (const device of Object.keys(full) as DeviceName[]) {
      const now = current.devices.find((d) => d.device === device);
      if (now?.adjustment === full[device]) continue;
      lines.push({ entity: 'Målretning', field: `${scope}Enhed · ${DEVICE_LABELS[device]}`, before: now ? fmtAdjustment(now.adjustment) : '–', after: fmtAdjustment(full[device]) });
    }
  }
  if (wanted.schedule) {
    const overlaps = scheduleOverlaps(wanted.schedule);
    if (overlaps.length) throw new Error(`Tidsplanen har tidsrum, der overlapper: ${overlaps.join('; ')}. Microsoft afviser overlappende tidsrum.`);
    // Microsoft's limits: at most 7 blocks per day and 49 per campaign.
    const crowded = WEEK.filter((d) => wanted.schedule!.filter((b) => b.day === d).length > 7);
    if (crowded.length) throw new Error(`Microsoft tillader højst 7 tidsrum pr. dag – ${crowded.map((d) => DAY_LABELS[d]).join(', ')} har flere. Slå tidsrum med samme justering sammen.`);
    if (wanted.schedule.length > 49) throw new Error(`Microsoft tillader højst 49 tidsrum pr. kampagne – tidsplanen har ${wanted.schedule.length}.`);
    for (const d of WEEK) {
      const before = describeDay(current.schedule.filter((b) => b.day === d));
      const after = describeDay(wanted.schedule.filter((b) => b.day === d));
      if (before !== after) lines.push({ entity: 'Målretning', field: `${scope}Tidsplan · ${DAY_LABELS[d]}`, before: current.schedule.length ? before : 'hele dagen', after });
    }
    const gaps = scheduleGaps(wanted.schedule);
    if (gaps.length) notes.push(`Uden for tidsplanen vises ingen annoncer: ${gaps.join('; ')}.`);
  }
  let places: GeoLocation[] = [];
  if (wanted.locations?.length) {
    try {
      places = ctx.backend.findLocations ? await ctx.backend.findLocations(ctx.accountId, wanted.locations) : [];
    } catch (e) {
      notes.push(`Lokationerne kunne ikke slås op i Microsofts lokationsfil (${e instanceof Error ? e.message : String(e)}) – de er ikke sat.`);
    }
    const missing = wanted.locations.filter((n) => !places.some((p) => p.name.split('|')[0]!.trim().toLowerCase() === n.trim().toLowerCase() || p.name.toLowerCase() === n.trim().toLowerCase()));
    if (places.length && missing.length) notes.push(`Microsoft kender ikke: ${missing.join(', ')} – de er sprunget over.`);
    for (const p of places) {
      if (current.locations.some((l) => l.locationId === p.locationId)) continue;
      lines.push({ entity: 'Målretning', field: `${scope}Lokation`, before: '–', after: `${p.name.split('|')[0]} (0 %)` });
    }
  }
  return { lines, notes, places };
}

/**
 * Sends the wanted targeting to a campaign, worked out from what it has right now (so a
 * new campaign's own defaults are respected), and checks each line by reading it back.
 */
export async function applyTargeting(ctx: ToolContext, campaignId: string, wanted: WantedTargets, plan: TargetingPlan): Promise<Verified> {
  const empty: Verified = { applied: [], appliedIndexes: new Set(), confirmed: [], rejected: [], notApplied: [] };
  if (!plan.lines.length || !ctx.backend.applyCampaignTargets || !ctx.backend.getCampaignTargets) return empty;
  const current = await ctx.backend.getCampaignTargets(ctx.accountId, campaignId);
  const changes = mergeChanges(
    wanted.devices ? deviceChanges(current.devices, wanted.devices) : { add: [], update: [], delete: [] },
    wanted.schedule ? scheduleChanges(current.schedule, wanted.schedule) : { add: [], update: [], delete: [] },
    {
      add: plan.places.filter((p) => !current.locations.some((l) => l.locationId === p.locationId)).map((p) => ({ kind: 'location' as const, locationId: p.locationId, adjustment: 0 })),
      update: [],
      delete: [],
    },
  );
  const res = isEmptyChange(changes) ? {} : await ctx.backend.applyCampaignTargets(ctx.accountId, campaignId, changes);
  // Microsoft's errors don't map onto the card's lines one to one: each line is judged by reading back.
  const generic = { failed: (res.failed ?? []).map((f) => ({ ...f, index: null })) };
  const checks: LineCheck<CampaignTargets>[] = plan.lines.map((line) => ({ line, index: -1, verify: lineCheck(line, wanted, plan.places) }));
  const state = await readBack(() => ctx.backend.getCampaignTargets!(ctx.accountId, campaignId), checks, new Set());
  return verify(checks, generic, state);
}

function lineCheck(line: ChangeLine, wanted: WantedTargets, places: GeoLocation[]): (s: CampaignTargets) => string | null {
  const field = line.field.split(' · ');
  const label = field[field.length - 1]!;
  if (line.field.includes('Enhed · ')) {
    const device = (Object.keys(DEVICE_LABELS) as DeviceName[]).find((d) => DEVICE_LABELS[d] === label)!;
    const want = { Computers: 0, Smartphones: 0, Tablets: 0, ...wanted.devices }[device];
    return (s) => {
      const now = s.devices.find((d) => d.device === device);
      return now?.adjustment === want ? null : now ? fmtAdjustment(now.adjustment) : 'ikke sat';
    };
  }
  if (line.field.includes('Tidsplan · ')) {
    const day = WEEK.find((d) => DAY_LABELS[d] === label)!;
    return (s) => {
      const now = describeDay(s.schedule.filter((b) => b.day === day));
      return now === line.after ? null : now;
    };
  }
  const place = places.find((p) => `${p.name.split('|')[0]} (0 %)` === line.after);
  return (s) => (place && s.locations.some((l) => l.locationId === place.locationId) ? null : 'ikke tilføjet');
}

/** Combines the verification of the main change and of its targeting into one report. */
export function joinVerified(a: Verified, b: Verified): Verified {
  return {
    applied: [...a.applied, ...b.applied],
    appliedIndexes: a.appliedIndexes,
    confirmed: [...a.confirmed, ...b.confirmed],
    rejected: [...a.rejected, ...b.rejected],
    notApplied: [...a.notApplied, ...b.notApplied],
  };
}

const DAYS = z.enum(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']);

export const targetingTools = [
  defineWrite({
    name: 'set_campaign_targeting',
    kind: 'write',
    description: `Set a campaign's bid adjustments by device (computer, mobile, tablet), its ad schedule (days and hours with bid adjustments) and/or add locations – in one card the user approves; read back afterwards. Never use microsoft_ads_api for these.
- standard: true sets the team standard for whatever you leave out: mobile and tablet -90 %, computer 0 %; the standard ad schedule (only if the campaign has none); Denmark and its five regions (only if the campaign has no locations).
- devices: % per device (-100 … 900); all three are always sent together (missing = 0 %).
- schedule: the WHOLE schedule – it replaces the campaign's current one. Whole hours; "19–00" is from 19 to 24. Group days with the same blocks (e.g. Monday–Thursday). No ads are shown outside the blocks, so cover all 7 days × 24 hours unless the user wants pauses. Adjustment -90 … 900 (0 = no change).
- locations: English names as in Microsoft's location file (e.g. "Denmark", "Region Zealand", "Capital Region of Denmark"); they are added, existing ones are kept.`,
    schema: z.object({
      campaignId: z.string(),
      standard: z.boolean().optional().describe('Use the team standard for what you leave out.'),
      devices: z
        .object({
          computers: z.number().int().min(-100).max(900).optional(),
          smartphones: z.number().int().min(-100).max(900).optional(),
          tablets: z.number().int().min(-100).max(900).optional(),
        })
        .optional(),
      schedule: z
        .array(
          z.object({
            days: z.array(DAYS).min(1),
            from: z.number().int().min(0).max(23),
            to: z.number().int().min(1).max(24),
            adjustment: z.number().int().min(-90).max(900),
          }),
        )
        .max(84)
        .optional(),
      locations: z.array(z.string().min(2)).max(50).optional(),
      reason: z.string().describe('Why, in Danish – shown on the approval card.'),
    }),
    label: () => 'Sætter enheder, tidsplan og lokationer',
    async plan(input, ctx) {
      const c: Campaign = await getCampaign(ctx, input.campaignId);
      if (!ctx.backend.applyCampaignTargets) throw new Error('Enheder, tidsplan og lokationer kan ikke sættes på denne konto.');
      const current = await readTargets(ctx, c.id);
      const standard = input.standard ? standardFor(current) : {};
      for (const b of input.schedule ?? []) if (b.from >= b.to) throw new Error(`Tidsrummet ${b.from}–${b.to} slutter før det starter. Brug fx 19–24 for "19–00".`);
      const wanted: WantedTargets = {
        devices: input.devices
          ? { Computers: input.devices.computers ?? 0, Smartphones: input.devices.smartphones ?? 0, Tablets: input.devices.tablets ?? 0 }
          : standard.devices,
        schedule: input.schedule ? input.schedule.flatMap((b) => b.days.map((day: WeekDay) => ({ day, from: b.from, to: b.to, adjustment: b.adjustment }))) : standard.schedule,
        locations: input.locations ?? standard.locations,
      };
      const t = await planTargeting(ctx, wanted, current, '');
      if (!t.lines.length) throw new Error(`"${c.name}" har allerede ${input.standard ? 'standardopsætningen' : 'præcis denne opsætning'} – intet at ændre.${t.notes.length ? ` ${t.notes.join(' ')}` : ''}`);
      const increases = t.lines.some((l) => /\+/.test(String(l.after)));
      return {
        plan: {
          kind: 'update',
          title: `Enheder, tidsplan og lokationer · ${c.name}`,
          reason: input.reason,
          changes: t.lines,
          dailyBudgetDelta: 0,
          increasesSpend: increases,
          campaignIds: [c.id],
          notes: t.notes,
        },
        execute: async () => report(await applyTargeting(ctx, c.id, wanted, t), { noun: ['indstilling', 'indstillinger'], warnings: t.notes }),
      };
    },
  }),
];
