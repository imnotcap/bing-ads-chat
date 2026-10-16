/**
 * The user's own Outlook through Microsoft Graph: reminders in their calendar
 * (POST /me/events) and follow-up mails from them to themselves (POST /me/sendMail).
 * "Log ind med Microsoft" asks for Calendars.ReadWrite and Mail.Send, so the login's
 * refresh token (ms_graph_refresh_token in the credential store) covers both. If a
 * permission is missing (signed in before it was asked for) or the token was revoked,
 * Microsoft asks once more in the browser.
 */
import { useAccount } from '@/stores/account';
import { BUILTIN_MS } from './credentials';
import { GRAPH_ALL_SCOPE, GRAPH_SCOPES, refreshAccessToken, signInInteractive, type GraphScope, type OAuthConfig } from './oauth';
import { getSecret, isTauri, setSecret } from '@/lib/platform';

const cached = new Map<GraphScope, { token: string; expires: number }>();

function config(): OAuthConfig | null {
  const login = useAccount.getState().login;
  const clientId = login?.clientId || BUILTIN_MS.clientId;
  return clientId ? { clientId, tenant: login?.tenant || 'common' } : null;
}

/** Outlook reminders and mails can be made from this app (desktop app, signed in with Microsoft). */
export function outlookAvailable() {
  return isTauri && !!config();
}

async function graphToken(scope: GraphScope, interactive: boolean): Promise<string> {
  const hit = cached.get(scope);
  if (hit && hit.expires > Date.now() + 60_000) return hit.token;
  const cfg = config();
  if (!cfg) throw new Error('Microsoft-login er ikke sat op i appen.');
  const remember = async (t: { access_token: string; refresh_token?: string; expires_in?: number }) => {
    if (t.refresh_token) await setSecret('ms_graph_refresh_token', t.refresh_token);
    cached.set(scope, { token: t.access_token, expires: Date.now() + (t.expires_in ?? 3600) * 1000 });
    return t.access_token;
  };
  const refresh = await getSecret('ms_graph_refresh_token').catch(() => null);
  if (refresh) {
    try {
      return await remember(await refreshAccessToken(cfg, refresh, `${GRAPH_SCOPES[scope]} offline_access`));
    } catch (e) {
      // Not allowed yet (or revoked): ask in the browser below – the stored token stays for what it covers.
      if (!interactive) throw e;
    }
  }
  if (!interactive) throw new Error('Outlook er ikke forbundet.');
  const t = await signInInteractive(cfg, GRAPH_ALL_SCOPE);
  if (t.refresh_token) await setSecret('ms_graph_refresh_token', t.refresh_token);
  // The interactive token is for the first scope asked; get the one we need from the new refresh token.
  return t.refresh_token ? remember(await refreshAccessToken(cfg, t.refresh_token, `${GRAPH_SCOPES[scope]} offline_access`)) : remember(t);
}

async function graphFetch(scope: GraphScope, path: string, body: unknown): Promise<Response> {
  const send = async (token: string) =>
    fetch(`https://graph.microsoft.com/v1.0${path}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  let res = await send(await graphToken(scope, true));
  if (res.status === 401 || res.status === 403) {
    cached.delete(scope);
    res = await send(await graphToken(scope, true));
  }
  return res;
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
  const send = () =>
    graphFetch('calendar', '/me/events', {
        subject: ev.subject,
        body: { contentType: 'text', content: ev.body },
        start: { dateTime: iso(start), timeZone: 'UTC' },
        end: { dateTime: iso(end), timeZone: 'UTC' },
        isReminderOn: true,
        reminderMinutesBeforeStart: ev.reminderMinutes ?? 15,
        showAs: 'free',
        categories: ['Bing Ads Chat'],
    });
  const res = await send();
  const json = (await res.json().catch(() => ({}))) as { id?: string; webLink?: string; error?: { message?: string } };
  if (!res.ok || !json.id) throw new Error(`Outlook: ${json.error?.message ?? `HTTP ${res.status}`}`);
  return { id: json.id, webLink: json.webLink };
}

export interface SelfMail {
  subject: string;
  /** Simple HTML. */
  html: string;
}

/**
 * Sends a mail from the signed-in user to themselves (never to anyone else) –
 * e.g. a follow-up with what was changed and when to check it.
 */
export async function sendMailToSelf(mail: SelfMail): Promise<string> {
  const to = useAccount.getState().user?.email;
  if (!to) throw new Error('Du er ikke logget ind.');
  const res = await graphFetch('mail', '/me/sendMail', {
    message: { subject: mail.subject, body: { contentType: 'HTML', content: mail.html }, toRecipients: [{ emailAddress: { address: to } }] },
    saveToSentItems: false,
  });
  if (!res.ok) {
    const json = (await res.json().catch(() => ({}))) as { error?: { code?: string; message?: string } };
    if (json.error?.code === 'MailboxNotEnabledForRESTAPI' || json.error?.code === 'ResourceNotFound') throw new Error('Din Microsoft-konto har ingen Outlook-postkasse, så der kan ikke sendes mail fra den.');
    throw new Error(`Mail: ${json.error?.message ?? `HTTP ${res.status}`}`);
  }
  return to;
}

/** Forgets the Graph tokens in memory (signing out removes the stored one). */
export function forgetOutlook() {
  cached.clear();
}
