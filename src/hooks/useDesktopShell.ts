/** Desktop integration: tray actions, "kører i baggrunden" and the close-to-tray setting. */
import { listen } from '@tauri-apps/api/event';
import { useEffect } from 'react';
import { startNewConversation } from '@/components/layout/TopBar';
import { nativeNotify } from '@/components/notifications/toast';
import { isTauri } from '@/lib/platform';
import { setCloseToTray } from '@/lib/window';
import { useSettings } from '@/stores/settings';

const TRAY_HINT_KEY = 'bac.trayHintShown';

export function useDesktopShell() {
  const closeToTray = useSettings((s) => s.appearance.closeToTray);
  useEffect(() => setCloseToTray(closeToTray), [closeToTray]);

  useEffect(() => {
    if (!isTauri) return;
    const unlisten = [
      listen<string>('tray-action', (e) => {
        if (e.payload === 'new-chat') startNewConversation();
      }),
      listen('hidden-to-tray', () => {
        // Tell once where the app went – like Claude.
        try {
          if (localStorage.getItem(TRAY_HINT_KEY)) return;
          localStorage.setItem(TRAY_HINT_KEY, '1');
        } catch {
          return;
        }
        void nativeNotify('Bing Ads Chat kører stadig', 'Appen ligger ved uret. Klik på ikonet for at åbne den igen – eller højreklik → Afslut.');
      }),
    ];
    return () => unlisten.forEach((p) => void p.then((u) => u()));
  }, []);
}
