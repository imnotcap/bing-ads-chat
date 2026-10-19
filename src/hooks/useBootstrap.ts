import { useEffect, useState } from 'react';
import { DEMO_ACCOUNTS } from '@/bing/demo/seed';
import { getBackend } from '@/bing/backend';
import { MsApiError } from '@/bing/client';
import { ERROR_105 } from '@/workspace/shared';
import { errorMessage } from '@/lib/utils';
import { useAccount } from '@/stores/account';
import { useConnection } from '@/stores/connection';

/** Makes sure an ad account is selected (demo, or the workspace's shared Microsoft Advertising). */
export function useBootstrap(): { ready: boolean; error: string | null } {
  const mode = useConnection((s) => s.mode);
  const revision = useConnection((s) => s.revision);
  const signedIn = useAccount((s) => s.status === 'ready');
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const set = useConnection.getState().set;
      if (mode === 'demo' || !signedIn) {
        const { accountId } = useConnection.getState();
        set({ accounts: DEMO_ACCOUNTS, accountId: DEMO_ACCOUNTS.some((a) => a.id === accountId) ? accountId : DEMO_ACCOUNTS[0]!.id });
        setError(null);
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
        if (cancelled) return;
        // 105 / 401: Microsoft accepted the sign-in, but Microsoft Advertising does not.
        const rejected = e instanceof MsApiError && (e.status === 401 || /\(105\)|InvalidCredentials/.test(e.message));
        setError(rejected ? `${ERROR_105} Ret nøglerne under Indstillinger → Forbindelser → Microsoft Advertising.` : errorMessage(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [mode, revision, signedIn]);

  return { ready, error };
}
