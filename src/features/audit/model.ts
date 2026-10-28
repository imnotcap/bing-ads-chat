/**
 * What the audit page and its sidebar show: every Microsoft Advertising campaign with its
 * audit (from the workspace), the Google Ads campaign it is matched with – or the one
 * suggested – and its progress.
 */
import { useMemo } from 'react';
import { useCampaigns, type CampaignRow } from '@/hooks/useAdsData';
import { today } from '@/lib/format';
import { useAccount } from '@/stores/account';
import { auditRange, useAuditUi, useAudits, useGoogleCampaigns, type GoogleCampaign } from './data';
import { suggestMatch, type Suggestion } from './match';
import { progressOf, type CampaignAudit, type Progress } from './steps';

export interface AuditRow {
  bing: CampaignRow;
  audit: CampaignAudit | undefined;
  /** The confirmed Google counterpart (null: confirmed that there is none). */
  google: GoogleCampaign | null;
  /** A suggested counterpart, while the match is not decided. */
  suggestion: (Suggestion & { campaign: GoogleCampaign }) | null;
  progress: Progress;
  finished: boolean;
}

const isActive = (status: string) => status === 'Active';

export function useAuditModel() {
  const period = useAuditUi((s) => s.period);
  const range = auditRange(period, today());
  const googleConnected = useAccount((s) => !!s.workspace?.google?.connected);
  const bing = useCampaigns(range);
  const google = useGoogleCampaigns(range, googleConnected);
  const audits = useAudits();

  const rows = useMemo((): AuditRow[] => {
    const googleList = google.data?.campaigns ?? [];
    const googleById = new Map(googleList.map((g) => [g.id, g]));
    return (bing.data ?? [])
      .filter((c) => c.status !== 'Deleted')
      .map((c) => {
        const audit = audits.data?.get(c.id);
        const decided = audit?.googleId !== undefined;
        const s = decided ? null : suggestMatch(c, googleList);
        const progress = progressOf(audit, c.type);
        return {
          bing: c,
          audit,
          google: audit?.googleId ? (googleById.get(audit.googleId) ?? null) : null,
          suggestion: s ? { ...s, campaign: googleById.get(s.googleId)! } : null,
          progress,
          finished: progress.total > 0 && progress.done === progress.total,
        };
      })
      // Running campaigns first, then by spend.
      .sort((a, b) => Number(isActive(b.bing.status)) - Number(isActive(a.bing.status)) || (b.bing.metrics?.spend ?? 0) - (a.bing.metrics?.spend ?? 0));
  }, [bing.data, google.data, audits.data]);

  const totals = useMemo(() => {
    let done = 0;
    let total = 0;
    for (const r of rows) {
      done += r.progress.done;
      total += r.progress.total;
    }
    return { finished: rows.filter((r) => r.finished).length, campaigns: rows.length, done, total };
  }, [rows]);

  return { range, rows, totals, bing, google, audits, googleConnected };
}
