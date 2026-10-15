/** Changes the user makes directly in the UI – applied immediately and logged. */
import { toast } from '@/components/notifications/toast';
import { undoActivity } from '@/ai/agent';
import { getBackend } from '@/bing/backend';
import { invalidateSpendCache } from '@/bing/spend';
import type { Campaign, CampaignPatch } from '@/bing/types';
import { statusLabel } from '@/ai/tools/context';
import { queryClient } from '@/lib/queryClient';
import { errorMessage } from '@/lib/utils';
import { useActivity, type ChangeLine } from '@/stores/activity';
import { useConnection } from '@/stores/connection';

export async function userUpdateCampaigns(campaigns: Campaign[], patches: CampaignPatch[], summary: string): Promise<boolean> {
  const { accountId, mode } = useConnection.getState();
  if (!accountId) return false;
  const changes: ChangeLine[] = [];
  const undo: Record<string, unknown>[] = [];
  for (const p of patches) {
    const c = campaigns.find((x) => x.id === p.campaignId);
    if (!c) continue;
    const inv: Record<string, unknown> = { campaignId: c.id };
    if (p.status && p.status !== c.status) {
      changes.push({ entity: 'Kampagne', entityId: c.id, field: `${c.name} · status`, before: statusLabel(c.status), after: statusLabel(p.status) });
      inv.status = c.status === 'Active' ? 'Active' : 'Paused';
    }
    if (p.dailyBudget !== undefined && p.dailyBudget !== c.dailyBudget) {
      changes.push({ entity: 'Kampagne', entityId: c.id, field: `${c.name} · dagsbudget`, before: c.dailyBudget, after: p.dailyBudget });
      if (c.dailyBudget) inv.dailyBudget = c.dailyBudget;
    }
    if (Object.keys(inv).length > 1) undo.push(inv);
  }
  if (!changes.length) return true;
  try {
    await (await getBackend()).updateCampaigns(accountId, patches);
    const entry = useActivity.getState().add({
      source: 'user',
      mode,
      accountId,
      tool: 'update_campaigns',
      summary,
      changes,
      status: 'success',
      undo: undo.length ? { tool: 'update_campaigns', input: { changes: undo, reason: 'Fortryd' } } : undefined,
    });
    invalidateSpendCache();
    void queryClient.invalidateQueries();
    toast.success(summary, {
      action: entry.undo
        ? {
            label: 'Fortryd',
            onClick: () =>
              void undoActivity(entry.id)
                .then(() => toast.success('Fortrudt'))
                .catch((e) => toast.error(errorMessage(e))),
          }
        : undefined,
    });
    return true;
  } catch (e) {
    useActivity.getState().add({ source: 'user', mode, accountId, tool: 'update_campaigns', summary, changes, status: 'failed', error: errorMessage(e) });
    toast.error('Ændringen fejlede', { description: errorMessage(e) });
    return false;
  }
}
