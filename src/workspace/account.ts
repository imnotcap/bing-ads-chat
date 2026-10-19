/**
 * Signing in to the app. "Log ind med Microsoft" gives you an account in the
 * department's workspace (the ID token, checked by the Worker) and lets the app put
 * reminders in your own Outlook calendar (Calendars.ReadWrite) – nothing else.
 */
import { BUILTIN_MS } from '@/bing/credentials';
import { resetBackendCache } from '@/bing/backend';
import { forgetOutlook } from '@/bing/outlook';
import { LOGIN_SCOPE, signInInteractive } from '@/bing/oauth';
import { DEMO_ACCOUNTS } from '@/bing/demo/seed';
import { deleteSecret, setSecret } from '@/lib/platform';
import { queryClient } from '@/lib/queryClient';
import { useAccount } from '@/stores/account';
import { useConnection } from '@/stores/connection';
import { api, ApiError, getSession, loadConfig, setSession } from './api';
import { loadLimits } from './limits';
import { moveLocalConnections, refreshWorkspace } from './shared';
import type { SessionResponse, UserStatus, WorkspaceUser } from './types';

async function started(res: SessionResponse) {
  await setSession(res.session);
  useAccount.getState().set({ user: res.user, status: res.user.status === 'active' ? 'ready' : 'pending', offline: false, reason: null });
  if (res.user.status === 'active') await afterSignIn();
}

/** Loads the shared connections (and moves this PC's old keys there the first time). */
async function afterSignIn() {
  await refreshWorkspace();
  await moveLocalConnections().catch(() => {});
  void loadLimits();
}

export async function signIn(): Promise<WorkspaceUser> {
  const cfg = await loadConfig();
  const clientId = cfg.clientId || BUILTIN_MS.clientId;
  if (!clientId) throw new Error('Login er ikke sat op endnu: Cloudflare-workeren mangler MS_CLIENT_ID (se docs/RELEASE.md).');
  const tokens = await signInInteractive({ clientId, tenant: cfg.tenant }, LOGIN_SCOPE);
  if (!tokens.id_token) throw new Error('Microsoft sendte ikke, hvem du er (intet ID-token). Prøv igen.');
  // The same sign-in gives access to the user's Outlook calendar.
  if (tokens.refresh_token) await setSecret('ms_graph_refresh_token', tokens.refresh_token);
  useAccount.getState().set({ login: { clientId, tenant: cfg.tenant } });
  const res = await api<SessionResponse>('/auth/session', { method: 'POST', auth: false, body: JSON.stringify({ idToken: tokens.id_token }) });
  await started(res);
  return res.user;
}

/** Local development only (the Worker runs with DEV_LOGIN=1): sign in with an e-mail address. */
export async function devSignIn(email: string, name: string): Promise<WorkspaceUser> {
  const res = await api<SessionResponse>('/auth/dev', { method: 'POST', auth: false, body: JSON.stringify({ email, name }) });
  await started(res);
  return res.user;
}

/** On start (and "Tjek igen"): is this PC still signed in, and has an admin let them in? */
export async function restoreSession() {
  const account = useAccount.getState();
  if (!(await getSession())) {
    account.signedOut();
    return;
  }
  try {
    const { user } = await api<{ user: WorkspaceUser }>('/me');
    const was = useAccount.getState().status;
    useAccount.getState().set({ user, status: user.status === 'active' ? 'ready' : 'pending', offline: false });
    if (user.status === 'active') {
      if (was !== 'ready') await afterSignIn();
      else void afterSignIn().catch(() => {});
    }
  } catch (e) {
    // No connection: keep working with what this PC remembers.
    if (e instanceof ApiError && e.status === 0 && account.user) {
      useAccount.getState().set({ status: account.user.status === 'active' ? 'ready' : 'pending', offline: true });
    } else if (useAccount.getState().status === 'loading') {
      useAccount.getState().signedOut(e instanceof Error ? e.message : undefined);
    }
  }
}

export async function signOut() {
  await api('/auth/logout', { method: 'POST' }).catch(() => {});
  await setSession(null);
  await deleteSecret('ms_graph_refresh_token').catch(() => {});
  forgetOutlook();
  resetBackendCache();
  useConnection.getState().set({ mode: 'demo', accounts: DEMO_ACCOUNTS, accountId: DEMO_ACCOUNTS[0]!.id, msUserName: null, hasAnthropicKey: false });
  useConnection.getState().bump();
  queryClient.clear();
  useAccount.getState().signedOut();
}

/* -------------------------------- people (admins) -------------------------------- */

export async function listUsers(): Promise<WorkspaceUser[]> {
  return (await api<{ users: WorkspaceUser[] }>('/users')).users;
}

export async function updateUser(id: string, patch: { role?: WorkspaceUser['role']; status?: UserStatus }): Promise<WorkspaceUser[]> {
  return (await api<{ users: WorkspaceUser[] }>(`/users/${id}`, { method: 'PATCH', body: JSON.stringify(patch) })).users;
}

export async function removeUser(id: string): Promise<WorkspaceUser[]> {
  return (await api<{ users: WorkspaceUser[] }>(`/users/${id}`, { method: 'DELETE' })).users;
}
