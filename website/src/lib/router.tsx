/**
 * A tiny router for the website's handful of pages (the Worker serves index.html for
 * every path that isn't a file).
 */
import { type AnchorHTMLAttributes, type MouseEvent, useMemo, useSyncExternalStore } from 'react';

const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());
window.addEventListener('popstate', notify);

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function navigate(to: string, { replace = false } = {}) {
  const url = new URL(to, location.href);
  if (url.origin !== location.origin) {
    location.href = url.href;
    return;
  }
  if (replace) history.replaceState(null, '', url);
  else history.pushState(null, '', url);
  notify();
  if (url.hash) document.getElementById(url.hash.slice(1))?.scrollIntoView({ behavior: 'smooth' });
  else if (!replace) window.scrollTo({ top: 0 });
}

/** The current path, without a trailing slash ("/" stays "/"). */
export function usePath(): string {
  return useSyncExternalStore(subscribe, () => location.pathname.replace(/(.)\/+$/, '$1'));
}

export function useSearch(): URLSearchParams {
  const search = useSyncExternalStore(subscribe, () => location.search);
  return useMemo(() => new URLSearchParams(search), [search]);
}

/** A link that stays inside the website without reloading the page. */
export function A({ href, onClick, ...rest }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) {
  const internal = href.startsWith('/') && !href.startsWith('//') && !/\.(exe|msi|json|png|mp4|webm|gif)$/.test(href) && !rest.download;
  return (
    <a
      href={href}
      onClick={(e: MouseEvent<HTMLAnchorElement>) => {
        onClick?.(e);
        if (!internal || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || rest.target) return;
        e.preventDefault();
        navigate(href);
      }}
      {...rest}
    />
  );
}
