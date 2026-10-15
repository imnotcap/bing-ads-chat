/**
 * Microsoft Advertising app credentials.
 *
 * The app's own Application (client) ID and developer token can be built into the
 * app (GitHub secrets MS_CLIENT_ID / MS_DEVELOPER_TOKEN → VITE_MS_*), so signing in
 * is just "Log ind med Microsoft". Values entered under Indstillinger → Forbindelser
 * take precedence. The user's own sign-in (refresh token) is never built in.
 */
import { getSecret } from '@/lib/platform';
import { useConnection } from '@/stores/connection';

export const BUILTIN_MS = {
  clientId: (import.meta.env.VITE_MS_CLIENT_ID ?? '').trim(),
  developerToken: (import.meta.env.VITE_MS_DEVELOPER_TOKEN ?? '').trim(),
};

/** True when this build can sign in with one click (no fields to fill in). */
export const hasBuiltinMicrosoft = !!(BUILTIN_MS.clientId && BUILTIN_MS.developerToken);

export function effectiveClientId(clientId = useConnection.getState().msClientId): string {
  return clientId.trim() || BUILTIN_MS.clientId;
}

export async function effectiveDeveloperToken(): Promise<string | null> {
  return (await getSecret('ms_developer_token').catch(() => null)) || BUILTIN_MS.developerToken || null;
}
