/** In-app updates (Rust: src-tauri/src/updater.rs). No-ops in the browser. */
import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { isTauri } from './platform';

export interface UpdateInfo {
  /** False in development/test builds without an update server. */
  configured: boolean;
  available: boolean;
  currentVersion: string;
  version: string | null;
  notes: string | null;
}

export interface UpdateProgress {
  stage: 'download' | 'install';
  downloaded: number;
  total: number | null;
  finished: boolean;
}

export const checkForUpdate = () => invoke<UpdateInfo>('check_for_update');
export const installUpdate = () => invoke<null>('install_update');
export const openDownloadPage = () => invoke<null>('open_download_page');

export function onUpdateProgress(handler: (p: UpdateProgress) => void): Promise<UnlistenFn> {
  if (!isTauri) return Promise.resolve(() => undefined);
  return listen<UpdateProgress>('update-progress', (e) => handler(e.payload));
}
