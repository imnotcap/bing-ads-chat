import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Account } from '@/bing/types';

export interface ConnectionState {
  /** 'demo' uses the built-in demo account; 'live' talks to Microsoft Advertising. */
  mode: 'demo' | 'live';
  msClientId: string;
  msTenant: string;
  msUserName: string | null;
  accounts: Account[];
  accountId: string | null;
  hasAnthropicKey: boolean;
  hasMsRefreshToken: boolean;
  hasDeveloperToken: boolean;
  /** Bumped whenever credentials change so cached backends are rebuilt. */
  revision: number;
  set: (patch: Partial<Omit<ConnectionState, 'set' | 'bump'>>) => void;
  bump: () => void;
}

export const useConnection = create<ConnectionState>()(
  persist(
    (set) => ({
      mode: 'demo',
      msClientId: '',
      msTenant: 'common',
      msUserName: null,
      accounts: [],
      accountId: null,
      hasAnthropicKey: false,
      hasMsRefreshToken: false,
      hasDeveloperToken: false,
      revision: 0,
      set: (patch) => set(patch),
      bump: () => set((s) => ({ revision: s.revision + 1 })),
    }),
    {
      name: 'bac.connection',
      version: 1,
      partialize: ({ mode, msClientId, msTenant, msUserName, accounts, accountId }) => ({ mode, msClientId, msTenant, msUserName, accounts, accountId }),
    },
  ),
);

export function useCurrentAccount(): Account | null {
  return useConnection((s) => s.accounts.find((a) => a.id === s.accountId) ?? null);
}
