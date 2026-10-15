/** Native window controls for the frameless desktop window (no-ops in the browser). */
import { getCurrentWindow } from '@tauri-apps/api/window';
import { isTauri } from './platform';

const win = () => (isTauri ? getCurrentWindow() : null);

export const minimizeWindow = () => void win()?.minimize();
export const toggleMaximizeWindow = () => void win()?.toggleMaximize();
export const closeWindow = () => void win()?.close();

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
