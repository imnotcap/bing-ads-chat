import { useEffect, useState } from 'react';
import { DEMO_ACCOUNTS } from '@/bing/demo/seed';
import { getBackend } from '@/bing/backend';
import { getSecret } from '@/lib/platform';
import { errorMessage } from '@/lib/utils';
import { useConnection } from '@/stores/connection';

/** Reads which credentials exist and makes sure an account is selected. */
export function useBootstrap(): { ready: boolean; error: string | null } {
  const mode = useConnection((s) => s.mode);
  const revision = useConnection((s) => s.revision);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [anthropic, refresh, dev] = await Promise.all([
        getSecret('anthropic_api_key').catch(() => null),
        getSecret('ms_refresh_token').catch(() => null),
        getSecret('ms_developer_token').catch(() => null),
      ]);
      if (cancelled) return;
      const set = useConnection.getState().set;
      set({ hasAnthropicKey: !!anthropic, hasMsRefreshToken: !!refresh, hasDeveloperToken: !!dev });

      if (mode === 'demo') {
        const { accountId } = useConnection.getState();
        set({ accounts: DEMO_ACCOUNTS, accountId: DEMO_ACCOUNTS.some((a) => a.id === accountId) ? accountId : DEMO_ACCOUNTS[0]!.id });
        setReady(true);
        return;
      }
      setReady(true);
      try {
        const accounts = await (await getBackend()).listAccounts();
        if (cancelled) return;
        const { accountId } = useConnection.getState();
        set({ accounts, accountId: accounts.some((a) => a.id === accountId) ? accountId : (accounts[0]?.id ?? null) });
        setError(null);
      } catch (e) {
        if (!cancelled) setError(errorMessage(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [mode, revision]);

  return { ready, error };
}
