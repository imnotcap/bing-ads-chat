import { useQuery } from '@tanstack/react-query';
import { getBackend } from '@/bing/backend';
import { derive, sumMetrics } from '@/bing/metrics';
import { getSpendStatus } from '@/bing/spend';
import type { Campaign, ReportRow } from '@/bing/types';
import { presetRange, previousRange, type DateRange } from '@/lib/format';
import { useConnection } from '@/stores/connection';
import { useSettings } from '@/stores/settings';

function useKeyBase() {
  const mode = useConnection((s) => s.mode);
  const accountId = useConnection((s) => s.accountId);
  const revision = useConnection((s) => s.revision);
  return { mode, accountId, revision, base: [mode, accountId, revision] as const };
}

export function useSelectedRange(): DateRange & { preset: ReturnType<typeof useSettings.getState>['datePreset'] } {
  const preset = useSettings((s) => s.datePreset);
  return { ...presetRange(preset), preset };
}

export interface CampaignRow extends Campaign {
  metrics: ReportRow | null;
}

export function useCampaigns(range: DateRange) {
  const { accountId, base } = useKeyBase();
  return useQuery({
    queryKey: ['campaigns', ...base, range.from, range.to],
    enabled: !!accountId,
    queryFn: async (): Promise<CampaignRow[]> => {
      const backend = await getBackend();
      const [campaigns, rows] = await Promise.all([
        backend.listCampaigns(accountId!),
        backend.runReport(accountId!, { kind: 'campaign', range, aggregation: 'Summary' }),
      ]);
      const byId = new Map(rows.map((r) => [r.campaignId, r]));
      return campaigns.map((c) => ({ ...c, metrics: byId.get(c.id) ?? null })).sort((a, b) => (b.metrics?.spend ?? 0) - (a.metrics?.spend ?? 0));
    },
  });
}

export function useAccountTrend(range: DateRange) {
  const { accountId, base } = useKeyBase();
  return useQuery({
    queryKey: ['trend', ...base, range.from, range.to],
    enabled: !!accountId,
    queryFn: async () => {
      const backend = await getBackend();
      const prev = previousRange(range);
      const [daily, previous] = await Promise.all([
        backend.runReport(accountId!, { kind: 'account', range, aggregation: 'Daily' }),
        backend.runReport(accountId!, { kind: 'account', range: prev, aggregation: 'Summary' }),
      ]);
      return { daily, totals: derive(sumMetrics(daily)), previous: derive(sumMetrics(previous)) };
    },
  });
}

export function useSpendStatus() {
  const { accountId, base } = useKeyBase();
  const monthlyBudget = useSettings((s) => s.spend.monthlyBudget);
  return useQuery({
    queryKey: ['spend', ...base, monthlyBudget],
    enabled: !!accountId,
    queryFn: async () => getSpendStatus(await getBackend(), accountId!, monthlyBudget),
  });
}
