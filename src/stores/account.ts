/**
 * Who is signed in to the app (Microsoft login → account in the shared workspace)
 * and the shared connections everyone uses.
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { PublicConfig, WorkspaceInfo, WorkspaceUser } from '@/workspace/types';

export type AccountStatus = 'loading' | 'signedOut' | 'pending' | 'ready';

interface AccountState {
  status: AccountStatus;
  user: WorkspaceUser | null;
  /** Shared connections (Microsoft Advertising, AI keys) – no secrets. */
  workspace: WorkspaceInfo | null;
  /** The app registration used to sign in (kept for the Outlook calendar). */
  login: Pick<PublicConfig, 'clientId' | 'tenant'> | null;
  /** The server couldn't be reached; working from what this PC remembers. */
  offline: boolean;
  /** Why the user was signed out (shown on the login screen). */
  reason: string | null;
  set: (patch: Partial<Omit<AccountState, 'set' | 'signedOut'>>) => void;
  signedOut: (reason?: string) => void;
}

export const useAccount = create<AccountState>()(
  persist(
    (set) => ({
      status: 'loading',
      user: null,
      workspace: null,
      login: null,
      offline: false,
      reason: null,
      set: (patch) => set(patch),
      signedOut: (reason) => set({ status: 'signedOut', user: null, workspace: null, offline: false, reason: reason ?? null }),
    }),
    {
      name: 'bac.account',
      version: 1,
      partialize: ({ user, workspace, login }) => ({ user, workspace, login }),
    },
  ),
);

export const isAdmin = (u: WorkspaceUser | null) => u?.role === 'admin' && u.status === 'active';
