/**
 * Native bridge. Inside the Tauri desktop app requests to Microsoft go through the
 * HTTP plugin (scoped in capabilities/default.json) and secrets live in Windows
 * Credential Manager. In the browser – the web app on app.xavieros.dk, or `pnpm dev` –
 * Microsoft requests go through `/__proxy` (the Worker, or the Vite dev server) and
 * secrets are kept in the site's own localStorage.
 */
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { fetch as tauriFetch } from '@tauri-apps/plugin-http';
import { openUrl } from '@tauri-apps/plugin-opener';

export const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

/** The browser version the Worker serves (app.xavieros.dk) – `pnpm build:web`. */
export const isWebApp = !isTauri && import.meta.env.MODE === 'web';

/**
 * app_session: this PC's sign-in to the shared workspace on Cloudflare.
 * ms_graph_refresh_token: the user's own Microsoft login (their Outlook calendar).
 * The rest are from before connections were shared; only read to move them to the workspace.
 */
export type SecretName = 'app_session' | 'ms_graph_refresh_token' | 'anthropic_api_key' | 'google_api_key' | 'ms_refresh_token' | 'ms_developer_token' | 'ms_client_secret';

const DEV_PREFIX = 'bac.dev-secret.';

export async function getSecret(name: SecretName): Promise<string | null> {
  if (isTauri) return invoke<string | null>('secret_get', { name });
  try {
    return localStorage.getItem(DEV_PREFIX + name);
  } catch {
    return null;
  }
}

export async function setSecret(name: SecretName, value: string): Promise<void> {
  if (isTauri) return invoke('secret_set', { name, value });
  localStorage.setItem(DEV_PREFIX + name, value);
}

export async function deleteSecret(name: SecretName): Promise<void> {
  if (isTauri) return invoke('secret_delete', { name });
  localStorage.removeItem(DEV_PREFIX + name);
}

/** fetch() for Microsoft hosts (no CORS there). */
export function msFetch(url: string, init?: RequestInit): Promise<Response> {
  if (isTauri) return tauriFetch(url, init);
  return fetch(`/__proxy?url=${encodeURIComponent(url)}`, init);
}

export async function openExternal(url: string): Promise<void> {
  if (isTauri) {
    await openUrl(url);
    return;
  }
  window.open(url, '_blank', 'noopener');
}

export interface OAuthListener {
  /** Where Microsoft sends the sign-in answer. */
  redirectUri: string;
  /** Shows Microsoft's sign-in page. */
  open: (url: string) => Promise<void>;
  /** The answer's query string (code + state, or error). */
  callback: Promise<URLSearchParams>;
}

/** Thrown when a newer sign-in replaced one still waiting in the browser. */
export class OAuthCancelled extends Error {}

/**
 * Gets ready for a Microsoft sign-in. Desktop: a loopback listener on localhost and the
 * system browser. Browser: a pop-up window that comes back to this page
 * (finishOAuthPopup) – registered in Entra under "Mobile and desktop applications".
 */
export async function startOAuthListener(): Promise<OAuthListener> {
  if (!isTauri) return startPopupListener();
  let resolveFn: (v: URLSearchParams) => void = () => {};
  const callback = new Promise<URLSearchParams>((resolve) => {
    resolveFn = resolve;
  });
  const unlisten = await listen<string>('oauth-callback', (e) => {
    unlisten();
    resolveFn(new URLSearchParams(e.payload));
  });
  const port = await invoke<number>('oauth_listen');
  return { redirectUri: `http://localhost:${port}`, open: openExternal, callback };
}

const OAUTH_CHANNEL = 'xavieros-oauth';
let cancelPending: (() => void) | null = null;

function startPopupListener(): OAuthListener {
  cancelPending?.();
  // Opened at once, while the click still counts as the user's; sent to Microsoft by open().
  const popup = window.open('', 'xavieros-login', 'popup,width=520,height=700');
  if (!popup) throw new Error('Browseren blokerede login-vinduet. Tillad pop-up-vinduer for denne side, og prøv igen.');
  // Microsoft's pages cut the link between the two windows (COOP), so the answer comes
  // back over a channel between pages of this site rather than window.opener.
  const channel = new BroadcastChannel(OAUTH_CHANNEL);
  const callback = new Promise<URLSearchParams>((resolve, reject) => {
    const done = () => {
      clearTimeout(timer);
      channel.close();
      cancelPending = null;
    };
    const timer = setTimeout(() => {
      done();
      resolve(new URLSearchParams({ error: 'timeout' }));
    }, 5 * 60_000);
    channel.onmessage = (e: MessageEvent) => {
      done();
      resolve(new URLSearchParams(String(e.data)));
    };
    cancelPending = () => {
      done();
      reject(new OAuthCancelled('Login startet igen.'));
    };
  });
  return {
    redirectUri: `${location.origin}${location.pathname}`,
    open: async (url) => {
      popup.location.href = url;
    },
    callback,
  };
}

/**
 * In the login pop-up, back from Microsoft: hands the answer to the app's window and
 * closes. True when this page is that pop-up (the app should not start in it).
 */
export function finishOAuthPopup(): boolean {
  if (isTauri) return false;
  const params = new URLSearchParams(location.search);
  if (!params.has('state') || !(params.has('code') || params.has('error'))) return false;
  const channel = new BroadcastChannel(OAUTH_CHANNEL);
  channel.postMessage(params.toString());
  channel.close();
  window.close();
  return true;
}

/**
 * Saves an exported file. Desktop: "Downloads/XavierOS" (returns the path).
 * Browser: a normal download (returns null).
 */
export async function saveExport(fileName: string, contents: string): Promise<string | null> {
  if (isTauri) return invoke<string>('export_save', { fileName, contents });
  const ext = fileName.split('.').pop()?.toLowerCase() ?? '';
  const types: Record<string, string> = { csv: 'text/csv', tsv: 'text/tab-separated-values', json: 'application/json', ics: 'text/calendar', html: 'text/html', xml: 'application/xml', txt: 'text/plain' };
  const url = URL.createObjectURL(new Blob([contents], { type: `${types[ext] ?? 'text/markdown'};charset=utf-8` }));
  const a = Object.assign(document.createElement('a'), { href: url, download: fileName });
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return null;
}

/** Opens the exports folder in Explorer, optionally with one file selected. */
export async function openExportsFolder(select?: string): Promise<void> {
  if (!isTauri) throw new Error('Mappen kan kun åbnes fra desktop-appen.');
  await invoke('export_open_folder', { select: select ?? null });
}
