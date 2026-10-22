import { QueryClient } from '@tanstack/react-query';
import { AUTO_REFRESH_MS, autoRefreshAllowed } from './refreshPolicy';

/**
 * Data counts as fresh for 30 minutes, and loaded data is only fetched again by itself
 * on weekdays 8–16 (lib/refreshPolicy.ts; the timer is useAutoRefresh). Opdatér always works.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: AUTO_REFRESH_MS,
      gcTime: 24 * 3600_000,
      retry: 1,
      refetchOnWindowFocus: false,
      refetchOnMount: () => autoRefreshAllowed(),
      refetchOnReconnect: () => autoRefreshAllowed(),
    },
  },
});
