import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Account } from '@/bing/types';

export interface ConnectionState {
  /** 'demo' uses the built-in demo account; 'live' talks to Microsoft Advertising (the workspace's shared connection). */
  mode: 'demo' | 'live';
  /** The user picked the demo account themselves – don't switch to live when the workspace is connected. */
  preferDemo: boolean;
  /** The Microsoft user behind the shared Microsoft Advertising connection. */
  msUserName: string | null;
  accounts: Account[];
  accountId: string | null;
  /** The workspace has a Claude API key. */
  hasAnthropicKey: boolean;
  /** Microsoft app settings this PC used before connections were shared (moved to the workspace once). */
  legacyMs: { clientId: string; tenant: string } | null;
  /** Bumped whenever credentials change so cached backends are rebuilt. */
  revision: number;
  set: (patch: Partial<Omit<ConnectionState, 'set' | 'bump'>>) => void;
  bump: () => void;
}

export const useConnection = create<ConnectionState>()(
  persist(
    (set) => ({
      mode: 'demo',
      preferDemo: false,
      msUserName: null,
      accounts: [],
      accountId: null,
      hasAnthropicKey: false,
      legacyMs: null,
      revision: 0,
      set: (patch) => set(patch),
      bump: () => set((s) => ({ revision: s.revision + 1 })),
    }),
    {
      name: 'bac.connection',
      version: 2,
      partialize: ({ mode, preferDemo, msUserName, accounts, accountId, legacyMs }) => ({ mode, preferDemo, msUserName, accounts, accountId, legacyMs }),
      // v2: the Microsoft Advertising sign-in became the workspace's (shared on Cloudflare).
      migrate: (persisted, version) => {
        const p = (persisted ?? {}) as Partial<ConnectionState> & { msClientId?: string; msTenant?: string };
        if (version < 2) {
          const { msClientId, msTenant, ...rest } = p;
          return { ...rest, preferDemo: false, legacyMs: { clientId: msClientId ?? '', tenant: msTenant || 'common' } } as ConnectionState;
        }
        return p as ConnectionState;
      },
    },
  ),
);

export function useCurrentAccount(): Account | null {
  return useConnection((s) => s.accounts.find((a) => a.id === s.accountId) ?? null);
}
