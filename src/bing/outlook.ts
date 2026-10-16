/**
 * Reminders in the user's own Outlook calendar through Microsoft Graph
 * (POST /me/events). "Log ind med Microsoft" asks for Calendars.ReadWrite, so the
 * login's refresh token (ms_graph_refresh_token in the credential store) covers it.
 * If it is missing or revoked, Microsoft asks once more in the browser.
 */
import { useAccount } from '@/stores/account';
import { BUILTIN_MS } from './credentials';
import { GRAPH_CALENDAR_SCOPE, refreshAccessToken, signInInteractive, type OAuthConfig } from './oauth';
import { deleteSecret, getSecret, isTauri, setSecret } from '@/lib/platform';

let cached: { token: string; expires: number } | null = null;

function config(): OAuthConfig | null {
  const login = useAccount.getState().login;
  const clientId = login?.clientId || BUILTIN_MS.clientId;
  return clientId ? { clientId, tenant: login?.tenant || 'common' } : null;
}

/** Outlook reminders can be made from this app (desktop app, signed in with Microsoft). */
export function outlookAvailable() {
  return isTauri && !!config();
}

async function graphToken(interactive: boolean): Promise<string> {
  if (cached && cached.expires > Date.now() + 60_000) return cached.token;
  const cfg = config();
  if (!cfg) throw new Error('Microsoft-login er ikke sat op i appen.');
  const remember = async (t: { access_token: string; refresh_token?: string; expires_in?: number }) => {
    if (t.refresh_token) await setSecret('ms_graph_refresh_token', t.refresh_token);
    cached = { token: t.access_token, expires: Date.now() + (t.expires_in ?? 3600) * 1000 };
    return t.access_token;
  };
  const refresh = await getSecret('ms_graph_refresh_token').catch(() => null);
  if (refresh) {
    try {
      return await remember(await refreshAccessToken(cfg, refresh, GRAPH_CALENDAR_SCOPE));
    } catch {
      await deleteSecret('ms_graph_refresh_token').catch(() => {});
    }
  }
  if (!interactive) throw new Error('Outlook-kalenderen er ikke forbundet.');
  return remember(await signInInteractive(cfg, GRAPH_CALENDAR_SCOPE));
}

function toUtc(date: string, time: string) {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  const [hh, mm] = time.split(':').map(Number) as [number, number];
  return new Date(y, m - 1, d, hh, mm);
}

export interface OutlookEvent {
  subject: string;
  body: string;
  /** yyyy-mm-dd and HH:MM in local time */
  date: string;
  time: string;
  minutes?: number;
  reminderMinutes?: number;
}

/** Creates the event and returns a link that opens it in Outlook on the web. */
export async function addOutlookEvent(ev: OutlookEvent): Promise<{ id: string; webLink?: string }> {
  const start = toUtc(ev.date, ev.time);
  const end = new Date(start.getTime() + (ev.minutes ?? 30) * 60_000);
  const iso = (d: Date) => d.toISOString().replace('Z', '');
  const send = async (token: string) =>
    fetch('https://graph.microsoft.com/v1.0/me/events', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subject: ev.subject,
        body: { contentType: 'text', content: ev.body },
        start: { dateTime: iso(start), timeZone: 'UTC' },
        end: { dateTime: iso(end), timeZone: 'UTC' },
        isReminderOn: true,
        reminderMinutesBeforeStart: ev.reminderMinutes ?? 15,
        showAs: 'free',
        categories: ['Bing Ads Chat'],
      }),
    });
  let res = await send(await graphToken(true));
  if (res.status === 401) {
    cached = null;
    res = await send(await graphToken(true));
  }
  const json = (await res.json().catch(() => ({}))) as { id?: string; webLink?: string; error?: { message?: string } };
  if (!res.ok || !json.id) throw new Error(`Outlook: ${json.error?.message ?? `HTTP ${res.status}`}`);
  return { id: json.id, webLink: json.webLink };
}

/** Forgets the calendar token in memory (signing out removes the stored one). */
export function forgetOutlook() {
  cached = null;
}
