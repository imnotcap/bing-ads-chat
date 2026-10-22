import { useEffect } from 'react';
import { queryClient } from '@/lib/queryClient';
import { AUTO_REFRESH_MS, autoRefreshAllowed } from '@/lib/refreshPolicy';

/**
 * Fetches what is on screen again every 30 minutes – only on weekdays 8–16
 * (lib/refreshPolicy.ts). Outside those hours nothing is fetched by itself.
 */
export function useAutoRefresh() {
  useEffect(() => {
    let last = Date.now();
    const tick = () => {
      if (!autoRefreshAllowed() || Date.now() - last < AUTO_REFRESH_MS) return;
      last = Date.now();
      void queryClient.refetchQueries({ type: 'active', stale: true });
    };
    const t = setInterval(tick, 60_000);
    return () => clearInterval(t);
  }, []);
}
