/**
 * Google Ads for the assistant – read only, through the workspace (cloudflare/src/googleAds.ts
 * lets nothing but reading through). There is no way to change Google from here, by design.
 */
import type { DetailData, DetailPart } from '@/features/audit/detail';
import type { GoogleCampaigns } from '@/features/audit/data';
import type { CampaignAudit } from '@/features/audit/steps';
import type { DateRange } from '@/lib/format';
import { useAccount } from '@/stores/account';
import { api } from '@/workspace/api';

export function requireGoogle() {
  if (!useAccount.getState().workspace?.google?.connected)
    throw new Error('Google Ads er ikke forbundet til XavierOS. En administrator forbinder den under Audit (kun læsning) – indtil da kan der ikke sammenlignes med Google.');
}

export const googleCampaigns = (range: DateRange) => api<GoogleCampaigns>(`/workspace/google/campaigns?from=${range.from}&to=${range.to}`);

export const googleDetail = <P extends DetailPart>(googleId: string, part: P, range: DateRange, pmax: boolean) =>
  api<{ fetchedAt: number; data: DetailData[P]; error?: string }>(`/workspace/google/campaign?id=${googleId}&part=${part}&from=${range.from}&to=${range.to}${pmax ? '&pmax=1' : ''}`);

/** The Google campaign chosen for a Microsoft campaign on the audit page: an id, null (no counterpart) or undefined (not decided). */
export async function auditGoogleMatch(bingId: string): Promise<string | null | undefined> {
  const { audits } = await api<{ audits: CampaignAudit[] }>('/workspace/audit');
  return audits.find((a) => a.bingId === bingId)?.googleId;
}
