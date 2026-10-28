/**
 * The audit's data: the checklist from the workspace (shared by the team) and Google's
 * campaigns – read only, fetched by the workspace and kept there for a day.
 */
import { useQuery } from '@tanstack/react-query';
import { create } from 'zustand';
import { api } from '@/workspace/api';
import { queryClient } from '@/lib/queryClient';
import { addDays, type DateRange } from '@/lib/format';
import { useAccount } from '@/stores/account';
import { useConnection } from '@/stores/connection';
import { bingAds, bingNegatives, bingProducts, bingSearchTerms, bingStructure } from './bingDetail';
import type { DetailData, DetailPart } from './detail';
import { applyOp, type AuditOp } from './ops';
import type { CampaignAudit } from './steps';

/* --------------------------------- checklist --------------------------------- */

const AUDIT_KEY = ['audit'] as const;

export function useAudits() {
  return useQuery({
    queryKey: AUDIT_KEY,
    queryFn: async () => new Map((await api<{ audits: CampaignAudit[] }>('/workspace/audit')).audits.map((a) => [a.bingId, a])),
    // Someone else may have ticked steps since – the checklist is cheap to fetch.
    staleTime: 30_000,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  });
}

/** Applies a change at once, then stores it; on a failure the checklist is fetched again. */
export async function changeAudit(op: AuditOp) {
  const by = useAccount.getState().user?.name ?? '';
  await queryClient.cancelQueries({ queryKey: AUDIT_KEY });
  queryClient.setQueryData<Map<string, CampaignAudit>>(AUDIT_KEY, (old) => {
    const next = new Map(old);
    next.set(op.bingId, applyOp(old?.get(op.bingId), op, by, Date.now()));
    return next;
  });
  try {
    const { audit } = await api<{ audit: CampaignAudit }>('/workspace/audit', { method: 'POST', body: JSON.stringify(op) });
    queryClient.setQueryData<Map<string, CampaignAudit>>(AUDIT_KEY, (old) => new Map(old).set(audit.bingId, audit));
  } catch (e) {
    void queryClient.invalidateQueries({ queryKey: AUDIT_KEY });
    throw e;
  }
}

/* ---------------------------------- Google ---------------------------------- */

export interface GoogleMetrics {
  impressions: number;
  clicks: number;
  spend: number;
  conversions: number;
  revenue: number;
}

export interface GoogleCampaign {
  id: string;
  name: string;
  status: string;
  channel: string;
  dailyBudget: number | null;
  sharedBudget: boolean;
  bidStrategy: string;
  portfolio: boolean;
  targetRoas: number | null;
  targetCpa: number | null;
  metrics: GoogleMetrics;
}

export interface GoogleCampaigns {
  fetchedAt: number;
  account: { customerId: string; name: string; currency: string; timeZone: string };
  campaigns: GoogleCampaign[];
  /** Set when Google did not answer and this is the last stored copy. */
  error?: string;
}

const googleKey = (range: DateRange) => ['google-campaigns', range.from, range.to] as const;

export function useGoogleCampaigns(range: DateRange, enabled: boolean) {
  return useQuery({
    queryKey: googleKey(range),
    enabled,
    queryFn: () => api<GoogleCampaigns>(`/workspace/google/campaigns?from=${range.from}&to=${range.to}`),
    retry: false,
  });
}

/** Opdatér: reads Google again (the workspace allows it once every 10 minutes). */
export async function refreshGoogle(range: DateRange) {
  const fresh = await api<GoogleCampaigns>(`/workspace/google/campaigns?from=${range.from}&to=${range.to}&refresh=1`);
  queryClient.setQueryData(googleKey(range), fresh);
}

/* ------------------------------- one campaign's insides ------------------------------- */

const dated = (part: DetailPart) => part === 'structure' || part === 'searchterms';

const googleDetailKey = (googleId: string, part: DetailPart, range: DateRange, pmax: boolean) =>
  ['google-detail', googleId, part, pmax, ...(dated(part) ? [range.from, range.to] : [])] as const;

/** One part of a Google campaign (read only; the workspace keeps it for a day). */
export function useGoogleDetail<P extends DetailPart>(googleId: string | null | undefined, part: P, range: DateRange, pmax: boolean, enabled: boolean) {
  return useQuery({
    queryKey: googleDetailKey(googleId ?? '', part, range, pmax),
    enabled: enabled && !!googleId,
    retry: false,
    queryFn: () =>
      api<{ fetchedAt: number; data: DetailData[P]; error?: string }>(
        `/workspace/google/campaign?id=${googleId}&part=${part}&from=${range.from}&to=${range.to}${pmax ? '&pmax=1' : ''}`,
      ),
  });
}

/** One part of the Microsoft campaign, read with the app's own connection. */
export function useBingDetail<P extends DetailPart>(campaignId: string, part: P, range: DateRange, pmax: boolean, enabled: boolean) {
  const accountId = useConnection((s) => s.accountId);
  const mode = useConnection((s) => s.mode);
  return useQuery({
    queryKey: ['bing-detail', mode, accountId, campaignId, part, pmax, ...(dated(part) ? [range.from, range.to] : [])],
    enabled: enabled && !!accountId,
    retry: false,
    queryFn: async (): Promise<DetailData[P]> => {
      const id = accountId!;
      const load: { [K in DetailPart]: () => Promise<DetailData[K]> } = {
        structure: () => bingStructure(id, campaignId),
        negatives: () => bingNegatives(id, campaignId),
        products: () => bingProducts(id, campaignId, pmax),
        searchterms: () => bingSearchTerms(id, campaignId, range),
        ads: () => bingAds(id, campaignId),
      };
      return load[part]();
    },
  });
}

/** Opdatér for one campaign: both sides read again (Google at most every 10 minutes). */
export async function refreshDetail(googleId: string | null | undefined, campaignId: string, part: DetailPart, range: DateRange, pmax: boolean) {
  await Promise.all([
    googleId
      ? api<unknown>(`/workspace/google/campaign?id=${googleId}&part=${part}&from=${range.from}&to=${range.to}${pmax ? '&pmax=1' : ''}&refresh=1`).then((fresh) =>
          queryClient.setQueryData(googleDetailKey(googleId, part, range, pmax), fresh),
        )
      : null,
    queryClient.invalidateQueries({ queryKey: ['bing-detail'], predicate: (q) => q.queryKey.includes(campaignId) && q.queryKey.includes(part) }),
  ]);
}

/* ---------------------------------- period ---------------------------------- */

export type AuditPeriod = '30' | '90' | 'year';

export const PERIOD_LABELS: Record<AuditPeriod, string> = { '30': 'Seneste 30 dage', '90': 'Seneste 90 dage', year: 'År til dato' };

/** Complete days only (up to yesterday), the same on both sides. */
export function auditRange(period: AuditPeriod, today: string): DateRange {
  const to = addDays(today, -1);
  if (period === 'year') {
    const jan1 = `${today.slice(0, 4)}-01-01`;
    return { from: jan1 > to ? to : jan1, to };
  }
  return { from: addDays(today, -Number(period)), to };
}

/* ---------------------------------- page state ---------------------------------- */

export type CompareTab = 'products' | 'negatives' | 'keywords' | 'searchterms' | 'ads';

export const useAuditUi = create<{
  selected: string | null;
  period: AuditPeriod;
  /** The comparison open on the campaign page. */
  tab: CompareTab | null;
  select: (id: string | null) => void;
  setPeriod: (p: AuditPeriod) => void;
  setTab: (t: CompareTab | null) => void;
}>((set) => ({
  selected: null,
  period: '30',
  tab: null,
  select: (selected) => set({ selected }),
  setPeriod: (period) => set({ period }),
  setTab: (tab) => set({ tab }),
}));
