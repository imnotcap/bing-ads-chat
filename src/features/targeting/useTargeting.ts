/**
 * The targeting page's data: one campaign's targets and each ad group's own (to see which
 * level each kind lives on), and the campaign's last 30 days by hour, device, age/gender and
 * region – per ad group, so an ad group can be looked at on its own.
 */
import { useQuery } from '@tanstack/react-query';
import { getBackend } from '@/bing/backend';
import type { AdGroup, CampaignTargets, ReportKind, ReportRow } from '@/bing/types';
import { addDays, today } from '@/lib/format';
import { useConnection } from '@/stores/connection';

export interface TargetingData {
  campaign: CampaignTargets;
  groups: { id: string; name: string; status: string; targets: CampaignTargets | null }[];
}

const EMPTY: CampaignTargets = { devices: [], schedule: [], locations: [], ages: [], genders: [] };

/** At most `limit` at a time. */
async function pool<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i]!);
      }
    }),
  );
  return out;
}

export function useTargets(campaignId: string | null) {
  const accountId = useConnection((s) => s.accountId);
  const mode = useConnection((s) => s.mode);
  return useQuery({
    queryKey: ['targeting', mode, accountId, campaignId],
    enabled: !!accountId && !!campaignId,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<TargetingData> => {
      const backend = await getBackend();
      if (!backend.getTargets) throw new Error('Målretning kan ikke læses for denne forbindelse.');
      const [campaign, adGroups] = await Promise.all([backend.getTargets(accountId!, { campaignId: campaignId! }), backend.listAdGroups(accountId!, campaignId!)]);
      const live = adGroups.filter((g: AdGroup) => g.status !== 'Deleted');
      const targets = await pool(live, 4, (g) => backend.getTargets!(accountId!, { campaignId: campaignId!, adGroupId: g.id }).catch(() => null));
      return { campaign: { ...EMPTY, ...campaign }, groups: live.map((g, i) => ({ id: g.id, name: g.name, status: g.status, targets: targets[i] ?? null })) };
    },
  });
}

export const REPORT_DAYS = 30;

export function useSegmentReport(kind: Extract<ReportKind, 'adgrouphourly' | 'adgroupdevice' | 'adgroupagegender' | 'adgroupgeo'>, campaignId: string | null) {
  const accountId = useConnection((s) => s.accountId);
  const mode = useConnection((s) => s.mode);
  const to = addDays(today(), -1);
  const from = addDays(to, -(REPORT_DAYS - 1));
  return useQuery({
    queryKey: ['targeting-report', kind, mode, accountId, campaignId, from, to],
    enabled: !!accountId && !!campaignId,
    staleTime: 30 * 60_000,
    queryFn: async (): Promise<ReportRow[]> => (await getBackend()).runReport(accountId!, { kind, range: { from, to }, aggregation: 'Summary', campaignIds: [campaignId!] }),
  });
}
