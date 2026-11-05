/**
 * Microsoft identity platform – OAuth 2.0 authorization code flow with PKCE for a
 * public (desktop) client. Register the app in Microsoft Entra ID with the platform
 * "Mobile and desktop applications" and the redirect URI `http://localhost`.
 * Docs: https://learn.microsoft.com/advertising/guides/authentication-oauth
 */
import { invoke } from '@tauri-apps/api/core';
import { isTauri, msFetch, startOAuthListener } from '@/lib/platform';
import { ADS_SCOPE } from '@/workspace/types';

/** Microsoft Graph: your own Outlook calendar, and mail sent from you to yourself. */
export const GRAPH_SCOPES = {
  calendar: 'https://graph.microsoft.com/Calendars.ReadWrite',
  mail: 'https://graph.microsoft.com/Mail.Send',
} as const;
export type GraphScope = keyof typeof GRAPH_SCOPES;
/** Everything the app asks Graph for, in one consent. */
export const GRAPH_ALL_SCOPE = `${GRAPH_SCOPES.calendar} ${GRAPH_SCOPES.mail} offline_access`;

/**
 * Signing in to the app: who you are (ID token for the workspace), your own Outlook
 * calendar and mail to yourself (follow-ups) – nothing else of yours.
 */
export const LOGIN_SCOPE = `openid profile email ${GRAPH_ALL_SCOPE}`;
/** The workspace's shared Microsoft Advertising connection. */
const MS_SCOPE = ADS_SCOPE;

export interface TokenResponse {
  access_token: string;
  /** With the openid scope: who signed in (checked by the workspace). */
  id_token?: string;
  refresh_token?: string;
  expires_in?: number;
}

export interface OAuthConfig {
  clientId: string;
  tenant?: string;
  clientSecret?: string | null;
}

function base64Url(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export async function createPkce(): Promise<{ verifier: string; challenge: string }> {
  const verifier = base64Url(crypto.getRandomValues(new Uint8Array(48)));
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  return { verifier, challenge: base64Url(new Uint8Array(digest)) };
}

function tenantOf(cfg: OAuthConfig) {
  return encodeURIComponent(cfg.tenant?.trim() || 'common');
}

export function buildAuthorizeUrl(cfg: OAuthConfig, redirectUri: string, challenge: string, state: string, scope = MS_SCOPE): string {
  const params = new URLSearchParams({
    client_id: cfg.clientId,
    response_type: 'code',
    redirect_uri: redirectUri,
    response_mode: 'query',
    scope,
    state,
    code_challenge: challenge,
    code_challenge_method: 'S256',
    prompt: 'select_account',
  });
  return `https://login.microsoftonline.com/${tenantOf(cfg)}/oauth2/v2.0/authorize?${params}`;
}

async function tokenRequest(cfg: OAuthConfig, form: Record<string, string>, scope = MS_SCOPE): Promise<TokenResponse> {
  const body = new URLSearchParams({ client_id: cfg.clientId, scope, ...form });
  if (cfg.clientSecret) body.set('client_secret', cfg.clientSecret);
  let status: number;
  let text: string;
  if (isTauri) {
    // From Rust: a browser-style Origin header makes Microsoft reject desktop apps (AADSTS90023).
    [status, text] = await invoke<[number, string]>('oauth_token', { tenant: cfg.tenant?.trim() || 'common', form: [...body.entries()] });
  } else {
    const res = await msFetch(`https://login.microsoftonline.com/${tenantOf(cfg)}/oauth2/v2.0/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
    status = res.status;
    text = await res.text();
  }
  const json = (() => {
    try {
      return JSON.parse(text) as TokenResponse & { error?: string; error_description?: string };
    } catch {
      return {} as TokenResponse & { error?: string; error_description?: string };
    }
  })();
  if (status < 200 || status >= 300 || !json.access_token) {
    const reason = json.error_description?.split('\r\n')[0] ?? json.error ?? `HTTP ${status}`;
    if (json.error === 'invalid_grant') throw new Error(`Microsoft-login er udløbet eller tilbagekaldt – log ind igen. (${reason})`);
    throw new Error(`Microsoft-login fejlede: ${reason}`);
  }
  return json;
}

export function refreshAccessToken(cfg: OAuthConfig, refreshToken: string, scope = MS_SCOPE): Promise<TokenResponse> {
  return tokenRequest(cfg, { grant_type: 'refresh_token', refresh_token: refreshToken }, scope);
}

/** Opens the Microsoft sign-in page (system browser, or a pop-up in the web app) and waits for the redirect. */
export async function signInInteractive(cfg: OAuthConfig, scope = MS_SCOPE): Promise<TokenResponse> {
  const { redirectUri, open, callback } = await startOAuthListener();
  const { verifier, challenge } = await createPkce();
  const state = base64Url(crypto.getRandomValues(new Uint8Array(16)));
  await open(buildAuthorizeUrl(cfg, redirectUri, challenge, state, scope));

  const params = await callback;
  const error = params.get('error');
  if (error === 'timeout') throw new Error('Login blev ikke gennemført inden for 5 minutter.');
  if (error) throw new Error(`Microsoft-login afbrudt: ${params.get('error_description') ?? error}`);
  if (params.get('state') !== state) throw new Error('Login-svaret matchede ikke (state). Prøv igen.');
  const code = params.get('code');
  if (!code) throw new Error('Microsoft returnerede ingen kode.');

  return tokenRequest(cfg, { grant_type: 'authorization_code', code, redirect_uri: redirectUri, code_verifier: verifier }, scope);
}
