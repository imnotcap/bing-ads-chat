/**
 * Budgetvagt: while the app is open, checks month-to-date spend every 30 minutes.
 * Warns once per month at the warning threshold and – when enabled – pauses all
 * active campaigns once the monthly budget is used.
 */
import { useEffect } from 'react';
import { toast } from '@/components/notifications/toast';
import { getBackend } from '@/bing/backend';
import { getSpendStatus, invalidateSpendCache } from '@/bing/spend';
import { fmtMoney, monthKey } from '@/lib/format';
import { queryClient } from '@/lib/queryClient';
import { errorMessage } from '@/lib/utils';
import { useActivity } from '@/stores/activity';
import { useConnection } from '@/stores/connection';
import { useSettings } from '@/stores/settings';

const INTERVAL = 30 * 60_000;
const FLAG = 'bac.budgetvagt';

function flagged(key: string): boolean {
  try {
    return localStorage.getItem(`${FLAG}.${key}`) === '1';
  } catch {
    return false;
  }
}
function setFlag(key: string) {
  try {
    localStorage.setItem(`${FLAG}.${key}`, '1');
  } catch {
    /* ignore */
  }
}

export async function checkBudget(): Promise<void> {
  const { accountId, mode, accounts } = useConnection.getState();
  const rules = useSettings.getState().spend;
  if (!accountId || rules.monthlyBudget === null) return;
  const currency = accounts.find((a) => a.id === accountId)?.currency ?? 'DKK';
  const backend = await getBackend();
  invalidateSpendCache();
  const status = await getSpendStatus(backend, accountId, rules.monthlyBudget);
  const share = status.monthToDateSpend / rules.monthlyBudget;
  const key = `${mode}.${accountId}.${monthKey()}`;

  if (share >= rules.warnAtPct / 100 && share < 1 && !flagged(`warn.${key}`)) {
    setFlag(`warn.${key}`);
    toast.warning(`Du har brugt ${Math.round(share * 100)} % af månedsbudgettet`, {
      description: `${fmtMoney(status.monthToDateSpend, currency)} af ${fmtMoney(rules.monthlyBudget, currency)}. Prognose: ${fmtMoney(status.forecastByRunRate, currency)}.`,
      duration: 12_000,
    });
  }

  if (share >= 1 && rules.autoPauseAtMonthlyBudget && !flagged(`pause.${key}`)) {
    setFlag(`pause.${key}`);
    const campaigns = (await backend.listCampaigns(accountId)).filter((c) => c.status === 'Active' && !rules.protectedCampaignIds.includes(c.id));
    if (!campaigns.length) return;
    try {
      await backend.updateCampaigns(accountId, campaigns.map((c) => ({ campaignId: c.id, status: 'Paused' })));
      useActivity.getState().add({
        source: 'budgetvagt',
        mode,
        accountId,
        tool: 'update_campaigns',
        summary: `Budgetvagt: ${campaigns.length} kampagner sat på pause (månedsbudget brugt)`,
        changes: campaigns.map((c) => ({ entity: 'Kampagne', entityId: c.id, field: `${c.name} · status`, before: 'Aktiv', after: 'Pauset' })),
        status: 'success',
        undo: { tool: 'update_campaigns', input: { changes: campaigns.map((c) => ({ campaignId: c.id, status: 'Active' })), reason: 'Fortryd budgetvagt' } },
      });
      toast.error('Månedsbudgettet er brugt – alle aktive kampagner er sat på pause', { duration: 20_000 });
    } catch (e) {
      toast.error('Budgetvagten kunne ikke pause kampagnerne', { description: errorMessage(e) });
    }
    void queryClient.invalidateQueries();
  }
}

export function useBudgetWatch() {
  const accountId = useConnection((s) => s.accountId);
  const monthlyBudget = useSettings((s) => s.spend.monthlyBudget);
  useEffect(() => {
    if (!accountId || monthlyBudget === null) return;
    const run = () => void checkBudget().catch(() => undefined);
    const first = setTimeout(run, 8_000);
    const t = setInterval(run, INTERVAL);
    return () => {
      clearTimeout(first);
      clearInterval(t);
    };
  }, [accountId, monthlyBudget]);
}
