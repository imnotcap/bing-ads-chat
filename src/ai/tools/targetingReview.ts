/**
 * review_targeting: where a campaign's (or one ad group's) money goes by hour and weekday,
 * device, age, gender and region, which bid adjustments to lower or raise – and on which level
 * each kind of targeting lives (campaign, or ad groups with their own that replace it). The same
 * analysis as the Målretning page (features/targeting/analysis.ts). Read only.
 */
import { z } from 'zod';
import type { CampaignTargets, ReportRow } from '@/bing/types';
import { addDays, today } from '@/lib/format';
import { bySpendAtStake, regionKey, scheduleAdjustment, segmentsOf, sourceOf, suggestAdjustments, targetLevels, toHourMap, type Segment, type TargetDim } from '@/features/targeting/analysis';
import { fmtAdj } from '@/features/targeting/changes';
import { compact, defineRead, getAdGroups, getCampaign, getReport, type ToolContext } from './context';

const EMPTY: CampaignTargets = { devices: [], schedule: [], locations: [], ages: [], genders: [] };
const DIMS: TargetDim[] = ['schedule', 'device', 'location', 'age', 'gender'];

async function targetsOf(ctx: ToolContext, campaignId: string, adGroupId?: string): Promise<CampaignTargets | null> {
  if (!ctx.backend.getTargets) return null;
  return { ...EMPTY, ...(await ctx.backend.getTargets(ctx.accountId, { campaignId, adGroupId })) };
}

export const targetingReviewTools = [
  defineRead({
    name: 'review_targeting',
    kind: 'read',
    description: `Where a campaign's – or one ad group's – money goes in the last 30 days by time of day and weekday (ad schedule), device, region, age and gender, and which bid adjustments to lower or raise. Also says on which LEVEL each kind of targeting lives: on the campaign, or on ad groups with their own (an ad group's own schedule/devices/locations/ages/genders REPLACE the campaign's of that kind for it – Microsoft). Use it for "hvor bruger vi pengene", "hvornår på dagen", "skal mobil ned", "tidsplanen", "alder/køn". Suggestions need 30 conversions or 300 clicks in the segment and move at most ±20 points – propose them with set_campaign_targeting (devices, schedule, locations – with adGroupId when it lives on the ad group); the user can also do it on the app's Målretning page (Dashboard → Microsoft Ads → Målretning).`,
    schema: z.object({
      campaignId: z.string(),
      adGroupId: z.string().optional().describe("One ad group only (its numbers, and its own targets or the campaign's it inherits)."),
    }),
    label: () => 'Ser på tidsplan, enheder, lokationer, alder og køn',
    async run(input, ctx) {
      const c = await getCampaign(ctx, input.campaignId);
      const to = addDays(today(), -1);
      const range = { from: addDays(to, -29), to };
      const report = (kind: 'adgrouphourly' | 'adgroupdevice' | 'adgroupagegender' | 'adgroupgeo') =>
        getReport(ctx, { kind, range, aggregation: 'Summary', campaignIds: [c.id] })
          .then((rows: ReportRow[]) => rows.filter((r) => !input.adGroupId || r.adGroupId === input.adGroupId))
          .catch(() => [] as ReportRow[]);
      const groups = await getAdGroups(ctx, c.id);
      const live = groups.filter((g) => g.status !== 'Deleted');
      if (input.adGroupId && !live.some((g) => g.id === input.adGroupId)) throw new Error(`Annoncegruppe ${input.adGroupId} findes ikke i "${c.name}".`);
      const [hourly, device, ageGender, geo, campaign] = await Promise.all([report('adgrouphourly'), report('adgroupdevice'), report('adgroupagegender'), report('adgroupgeo'), targetsOf(ctx, c.id)]);
      // Each ad group's own targets, to see the level of each kind (at most 4 at a time).
      const own: { id: string; name: string; targets: CampaignTargets | null }[] = [];
      for (let i = 0; i < live.length; i += 4) {
        own.push(...(await Promise.all(live.slice(i, i + 4).map(async (g) => ({ id: g.id, name: g.name, targets: await targetsOf(ctx, c.id, g.id).catch(() => null) })))));
      }
      const levels = campaign ? targetLevels(campaign, own) : null;
      const groupTargets = input.adGroupId ? (own.find((g) => g.id === input.adGroupId)?.targets ?? null) : null;
      // The targets that apply to the selection, kind by kind.
      const effective = (dim: TargetDim): CampaignTargets => (campaign && input.adGroupId && sourceOf(dim, campaign, groupTargets) === 'adgroup' ? groupTargets! : (campaign ?? EMPTY));
      const segs: Record<TargetDim, Segment[]> = {
        schedule: segmentsOf('schedule', hourly),
        device: segmentsOf('device', device),
        location: segmentsOf('location', geo),
        age: segmentsOf('age', ageGender),
        gender: segmentsOf('gender', ageGender),
      };
      const map = toHourMap(effective('schedule').schedule);
      const current = (s: Segment): number | null => {
        const t = effective(s.dim);
        if (s.dim === 'schedule') return scheduleAdjustment(map, s.key);
        if (s.dim === 'device') return t.devices.find((d) => d.device === s.key)?.adjustment ?? null;
        if (s.dim === 'age') return t.ages?.find((a) => a.age === s.key)?.adjustment ?? null;
        if (s.dim === 'gender') return t.genders?.find((g) => g.gender === s.key)?.adjustment ?? null;
        return t.locations.find((l) => regionKey(l.name) === s.key)?.adjustment ?? null;
      };
      const suggestions = DIMS.flatMap((d) => suggestAdjustments(segs[d], current))
        .filter((s) => s.dim !== 'schedule' || map.none || s.current !== null)
        .sort(bySpendAtStake);
      const total = segs.device.reduce((n, s) => n + s.m.spend, 0);
      const view = (list: Segment[], base = total) =>
        list.slice(0, 8).map((s) => compact({ segment: s.label, spend: Math.round(s.m.spend), share: base ? `${Math.round((s.m.spend / base) * 100)} %` : null, conversions: Math.round(s.m.conversions * 10) / 10, roas: s.m.spend ? Math.round((s.m.revenue / s.m.spend) * 100) / 100 : null, adjustmentNow: fmtAdj(current(s)) }));
      const hours = segs.schedule.filter((s) => s.key.startsWith('hours:'));
      const days = segs.schedule.filter((s) => s.key.startsWith('day:'));
      return {
        result: {
          campaign: c.name,
          ...(input.adGroupId ? { adGroup: own.find((g) => g.id === input.adGroupId)?.name } : {}),
          period: range,
          spend: Math.round(total),
          levels: levels
            ? Object.fromEntries(
                DIMS.map((d) => [
                  d,
                  input.adGroupId
                    ? sourceOf(d, campaign!, groupTargets) === 'adgroup'
                      ? "the ad group's own (replaces the campaign's)"
                      : sourceOf(d, campaign!, groupTargets) === 'campaign'
                        ? 'inherited from the campaign'
                        : 'not set'
                    : compact({ campaign: levels[d].campaign, adGroupsWithOwn: levels[d].groups.length ? levels[d].groups.map((g) => `${g.name} (id ${g.id})`) : undefined }),
                ]),
              )
            : 'Targets can only be read on the real account.',
          timeOfDay: view(hours, hours.reduce((n, s) => n + s.m.spend, 0)),
          weekday: view(days, days.reduce((n, s) => n + s.m.spend, 0)),
          devices: view(segs.device),
          regions: view(segs.location),
          ages: view(segs.age),
          genders: view(segs.gender),
          suggestions: suggestions.slice(0, 12).map((s) => ({ kind: s.dim, segment: s.label, from: fmtAdj(s.current ?? 0), to: fmtAdj(s.suggested), why: s.why })),
          notes: [
            "Schedule suggestions are per hour block (all days) or per weekday (all hours): to apply one, give set_campaign_targeting the WHOLE schedule – it replaces the current one.",
            'Ages and genders: set them with microsoft_ads_api (Age/Gender criterions) or on the Målretning page.',
            'Under automated bidding adjustments are signals, not fixed multipliers; -100 % on a device always excludes it.',
          ],
        },
        summary: `${c.name}${input.adGroupId ? ' › annoncegruppe' : ''} · ${suggestions.length} forslag`,
      };
    },
  }),
];
