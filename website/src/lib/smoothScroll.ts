/**
 * Smooth scrolling for the page's own links (#om, #kontakt …). Animated here rather than
 * with CSS scroll-behavior, so it also glides inside an embedded preview and while the
 * mobile menu folds away: the target is measured again on every frame.
 */
const DURATION = 750;
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

function targetY(hash: string): number | null {
  if (hash === '#top' || hash === '#') return 0;
  const el = document.getElementById(decodeURIComponent(hash.slice(1)));
  return el ? el.getBoundingClientRect().top + window.scrollY : null;
}

export function scrollToHash(hash: string) {
  if (targetY(hash) === null) return false;
  const start = window.scrollY;
  const t0 = performance.now();
  const step = (now: number) => {
    const p = Math.min(1, (now - t0) / DURATION);
    const end = targetY(hash) ?? start;
    window.scrollTo(0, start + (end - start) * easeInOut(p));
    if (p < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
  history.replaceState(null, '', hash === '#top' ? location.pathname + location.search : hash);
  return true;
}

/** Catches clicks on every in-page link. Returns the clean-up. */
export function enableSmoothScroll() {
  const onClick = (e: MouseEvent) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const a = (e.target as Element | null)?.closest?.('a[href^="#"]');
    const hash = a?.getAttribute('href');
    if (hash && scrollToHash(hash)) e.preventDefault();
  };
  document.addEventListener('click', onClick);
  return () => document.removeEventListener('click', onClick);
}
