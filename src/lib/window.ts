/** Native window controls for the frameless desktop window (no-ops in the browser). */
import { invoke } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { isTauri } from './platform';

const win = () => (isTauri ? getCurrentWindow() : null);

export const minimizeWindow = () => void win()?.minimize();
export const toggleMaximizeWindow = () => void win()?.toggleMaximize();
/** Closes the window – with "bliv i baggrunden" on, Rust hides it to the tray instead. */
export const closeWindow = () => void win()?.close();

/** Quits the app for real (also when it would otherwise stay in the tray). */
export const quitApp = () => (isTauri ? void invoke('quit_app') : undefined);

export function setCloseToTray(enabled: boolean) {
  if (isTauri) void invoke('set_close_to_tray', { enabled }).catch(() => undefined);
}

export async function isMaximized(): Promise<boolean> {
  return (await win()?.isMaximized()) ?? false;
}

/** Calls `cb` whenever the window is resized (maximize/restore). */
export function onWindowResized(cb: () => void): () => void {
  const w = win();
  if (!w) return () => {};
  let unlisten: (() => void) | undefined;
  void w.onResized(cb).then((u) => (unlisten = u));
  return () => unlisten?.();
}

/** The top bar is the title bar: keep Windows' own hidden (older versions could bring it back). */
export function ensureFrameless() {
  void win()?.setDecorations(false).catch(() => {});
}
