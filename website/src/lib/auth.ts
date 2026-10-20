/**
 * "Log ind med Microsoft" on the website: the authorization code flow with PKCE in the
 * browser (the app registration needs <site>/login as a "Single-page application"
 * redirect URI). Only who you are is asked for; the Worker checks the ID token and
 * finds your company – or hands back a ticket to create one.
 */
import type { PlanId } from '@/workspace/plans';
import type { NeedsCompany, PublicConfig, SessionResponse } from '@/workspace/types';
import { api, setSession } from './api';

const FLOW = 'xos_ms_flow';
const SIGNUP = 'xos_signup';

let config: Promise<PublicConfig> | null = null;
export function loadConfig() {
  config ??= api<PublicConfig>('/config', { auth: false }).catch((e: unknown) => {
    config = null;
    throw e;
  });
  return config;
}

const redirectUri = () => `${location.origin}/login`;

function base64Url(bytes: Uint8Array) {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export async function startMicrosoftLogin(next = '/konto') {
  const cfg = await loadConfig();
  if (!cfg.clientId) throw new Error('Login er ikke sat op endnu (Cloudflare-workeren mangler MS_CLIENT_ID).');
  const verifier = base64Url(crypto.getRandomValues(new Uint8Array(48)));
  const challenge = base64Url(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))));
  const state = base64Url(crypto.getRandomValues(new Uint8Array(16)));
  sessionStorage.setItem(FLOW, JSON.stringify({ verifier, state, next }));
  const params = new URLSearchParams({
    client_id: cfg.clientId,
    response_type: 'code',
    redirect_uri: redirectUri(),
    response_mode: 'query',
    scope: 'openid profile email',
    state,
    code_challenge: challenge,
    code_challenge_method: 'S256',
    prompt: 'select_account',
  });
  location.assign(`https://login.microsoftonline.com/${encodeURIComponent(cfg.tenant || 'common')}/oauth2/v2.0/authorize?${params}`);
}

export type SignInResult = { kind: 'signedIn'; next: string } | { kind: 'needsCompany' };

/** Back from Microsoft with ?code=…&state=… */
export async function finishMicrosoftLogin(search: URLSearchParams): Promise<SignInResult> {
  const error = search.get('error_description') ?? search.get('error');
  if (error) throw new Error(error.includes('AADSTS65004') ? 'Du afviste login hos Microsoft.' : `Microsoft afviste login: ${error.split('\n')[0]}`);
  const flow = JSON.parse(sessionStorage.getItem(FLOW) ?? 'null') as { verifier: string; state: string; next: string } | null;
  sessionStorage.removeItem(FLOW);
  if (!flow || flow.state !== search.get('state')) throw new Error('Login-forsøget udløb. Prøv igen.');
  const cfg = await loadConfig();
  const res = await fetch(`https://login.microsoftonline.com/${encodeURIComponent(cfg.tenant || 'common')}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: cfg.clientId ?? '',
      grant_type: 'authorization_code',
      code: search.get('code') ?? '',
      redirect_uri: redirectUri(),
      code_verifier: flow.verifier,
      scope: 'openid profile email',
    }),
  });
  const tokens = (await res.json().catch(() => ({}))) as { id_token?: string; error_description?: string };
  if (!res.ok || !tokens.id_token) throw new Error(tokens.error_description?.split('\n')[0] ?? 'Microsoft sendte ikke, hvem du er. Prøv igen.');
  return answered(await api<SessionResponse | NeedsCompany>('/auth/session', { method: 'POST', auth: false, body: JSON.stringify({ idToken: tokens.id_token }) }), flow.next);
}

/** Local development only (the Worker runs with DEV_LOGIN=1). */
export async function devSignIn(email: string, name: string, next = '/konto'): Promise<SignInResult> {
  return answered(await api<SessionResponse | NeedsCompany>('/auth/dev', { method: 'POST', auth: false, body: JSON.stringify({ email, name }) }), next);
}

function answered(res: SessionResponse | NeedsCompany, next: string): SignInResult {
  if ('needsCompany' in res) {
    sessionStorage.setItem(SIGNUP, JSON.stringify({ ...res, next, at: Date.now() }));
    return { kind: 'needsCompany' };
  }
  setSession(res.session);
  return { kind: 'signedIn', next };
}

/** Who is creating a company (signed in with Microsoft less than 30 minutes ago). */
export function pendingSignup(): (NeedsCompany & { at: number }) | null {
  const s = JSON.parse(sessionStorage.getItem(SIGNUP) ?? 'null') as (NeedsCompany & { at: number }) | null;
  return s && Date.now() - s.at < 29 * 60_000 ? s : null;
}

export async function createCompany(name: string, plan: PlanId) {
  const pending = pendingSignup();
  if (!pending) throw new Error('Log ind med Microsoft igen – det er for længe siden.');
  const res = await api<SessionResponse>('/signup', { method: 'POST', auth: false, body: JSON.stringify({ ticket: pending.ticket, name, plan }) });
  sessionStorage.removeItem(SIGNUP);
  setSession(res.session);
  return res.user;
}
