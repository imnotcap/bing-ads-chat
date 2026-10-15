import { useEffect } from 'react';
import { checkForUpdate, type UpdateInfo } from '@/lib/updater';
import { isTauri } from '@/lib/platform';
import { useUpdate } from '@/stores/update';

const FIRST_CHECK_MS = 3_000;
const CHECK_EVERY_MS = 30 * 60 * 1000;
/** Returning to the app re-checks, at most this often. */
const FOCUS_CHECK_MIN_MS = 5 * 60 * 1000;

/**
 * Handles a check result: a version we haven't offered yet opens the update
 * dialog right away. Returns true if an update is available.
 */
export function offerUpdate(info: UpdateInfo): boolean {
  if (!info.configured || !info.available || !info.version) return false;
  const { available, setAvailable, openPrompt } = useUpdate.getState();
  if (available?.version === info.version) return true;
  setAvailable({ version: info.version, notes: info.notes });
  openPrompt();
  return true;
}

/** Checks the signed update feed shortly after start, every 30 minutes and when the user returns. */
export function useAutoUpdate() {
  useEffect(() => {
    if (!isTauri) return;
    let lastCheck = 0;
    const check = async () => {
      lastCheck = Date.now();
      try {
        offerUpdate(await checkForUpdate());
      } catch {
        // Offline or update server unreachable – try again later.
      }
    };
    const onVisible = () => {
      if (!document.hidden && Date.now() - lastCheck > FOCUS_CHECK_MIN_MS) void check();
    };
    const first = setTimeout(() => void check(), FIRST_CHECK_MS);
    const interval = setInterval(() => void check(), CHECK_EVERY_MS);
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    return () => {
      clearTimeout(first);
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
    };
  }, []);
}
