/**
 * Microsoft app credentials built into the app (GitHub secrets MS_CLIENT_ID /
 * MS_DEVELOPER_TOKEN → VITE_MS_*). The client id is also given to the Cloudflare
 * Worker, which accepts logins made with it; the developer token pre-fills the
 * shared Microsoft Advertising connection. Nobody's sign-in is ever built in.
 */
export const BUILTIN_MS = {
  clientId: (import.meta.env.VITE_MS_CLIENT_ID ?? '').trim(),
  developerToken: (import.meta.env.VITE_MS_DEVELOPER_TOKEN ?? '').trim(),
};
