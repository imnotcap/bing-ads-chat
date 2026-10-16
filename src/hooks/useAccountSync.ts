import { useEffect } from 'react';
import { useAccount } from '@/stores/account';
import { restoreSession } from '@/workspace/account';
import { refreshWorkspace } from '@/workspace/shared';

/**
 * Checks the sign-in when the app starts (someone remembered on this PC opens straight
 * away and is checked in the background) and fetches the shared connections again
 * when the window gets focus, so a colleague's changes reach everyone.
 */
export function useAccountSync() {
  useEffect(() => {
    const { user, status, set } = useAccount.getState();
    if (status === 'loading' && user?.status === 'active') set({ status: 'ready' });
    void restoreSession();

    let last = Date.now();
    const onFocus = () => {
      if (useAccount.getState().status !== 'ready' || Date.now() - last < 60_000) return;
      last = Date.now();
      void refreshWorkspace().catch(() => {});
    };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, []);
}
