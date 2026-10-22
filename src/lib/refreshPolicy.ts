/**
 * When the app may call the APIs on its own: on weekdays 8–16 (this PC's time), at
 * most every 30 minutes. Outside those hours what is already loaded stays on screen
 * and new data is only fetched when someone presses Opdatér (or asks the assistant).
 * Data a page has never loaded is still fetched when the page is opened.
 */
export const AUTO_REFRESH_MS = 30 * 60_000;

export function autoRefreshAllowed(now = new Date()): boolean {
  const day = now.getDay();
  const hour = now.getHours();
  return day >= 1 && day <= 5 && hour >= 8 && hour < 16;
}
