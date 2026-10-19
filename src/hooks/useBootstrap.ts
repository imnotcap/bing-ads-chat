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
  // The Konto-ID entered under Forbindelser → Microsoft Advertising.
  const preferred = useAccount((s) => s.workspace?.ads.accountId ?? null);
  const workspaceLoaded = useAccount((s) => !!s.workspace);
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
      // Which account to use comes from the workspace – wait for it.
      if (!workspaceLoaded) return;
      try {
        const accounts = await (await getBackend()).listAccounts();
        if (cancelled) return;
        // Only the account set up under Forbindelser (Konto-ID) – no switching between accounts.
        const own = preferred ? accounts.find((a) => a.id === preferred) : accounts.length === 1 ? accounts[0] : undefined;
        if (!own) {
          set({ accounts: [], accountId: null });
          setError(
            preferred
              ? `Konto-ID ${preferred} findes ikke for Microsoft-brugeren bag nøglerne. Ret den under Indstillinger → Forbindelser → Microsoft Advertising.`
              : accounts.length
                ? 'Microsoft-brugeren har adgang til flere annoncekonti. Udfyld Konto-ID og Kunde-ID under Indstillinger → Forbindelser → Microsoft Advertising, så appen ved hvilken konto den skal bruge.'
                : 'Microsoft-brugeren bag nøglerne har ingen annoncekonti.',
          );
          return;
        }
        set({ accounts: [own], accountId: own.id });
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
  }, [mode, revision, signedIn, preferred, workspaceLoaded]);

  return { ready, error };
}
