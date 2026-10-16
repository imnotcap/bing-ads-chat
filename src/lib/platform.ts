/**
 * Native bridge. Inside the Tauri desktop app requests to Microsoft go through the
 * HTTP plugin (scoped in capabilities/default.json) and secrets live in Windows
 * Credential Manager. In a plain browser (`pnpm dev`) Microsoft requests use the
 * Vite dev proxy and secrets fall back to localStorage – development only.
 */
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { fetch as tauriFetch } from '@tauri-apps/plugin-http';
import { openUrl } from '@tauri-apps/plugin-opener';

export const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

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

/**
 * Starts the loopback listener for the Microsoft sign-in redirect.
 * Resolves with the port and a promise for the callback query string.
 */
export async function startOAuthListener(): Promise<{ port: number; callback: Promise<URLSearchParams> }> {
  if (!isTauri) throw new Error('Microsoft-login kræver desktop-appen. I browseren kan du indsætte et refresh token under "Avanceret".');
  let resolveFn: (v: URLSearchParams) => void = () => {};
  const callback = new Promise<URLSearchParams>((resolve) => {
    resolveFn = resolve;
  });
  const unlisten = await listen<string>('oauth-callback', (e) => {
    unlisten();
    resolveFn(new URLSearchParams(e.payload));
  });
  const port = await invoke<number>('oauth_listen');
  return { port, callback };
}

/**
 * Saves an exported file. Desktop: "Downloads/Bing Ads Chat" (returns the path).
 * Browser: a normal download (returns null).
 */
export async function saveExport(fileName: string, contents: string): Promise<string | null> {
  if (isTauri) return invoke<string>('export_save', { fileName, contents });
  const url = URL.createObjectURL(new Blob([contents], { type: 'text/markdown;charset=utf-8' }));
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
