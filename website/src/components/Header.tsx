import { AnimatePresence, motion } from 'framer-motion';
import { Menu, X } from 'lucide-react';
import { useState } from 'react';
import { ButtonLink, LogoMark, WEB_APP_URL, Wordmark, XavierShards, cn, ease } from '@/lib/ui';

export const NAV = [
  { label: 'Om appen', href: '#om' },
  { label: 'Funktioner', href: '#funktioner' },
  { label: 'Priser', href: '#priser' },
  { label: 'Blog', href: '/blog/' },
  { label: 'Web-app', href: WEB_APP_URL },
];

/**
 * A link to a section of the front page only works as a bare hash while we are on it.
 * From the blog it has to carry the path, or the browser looks for the section here.
 */
const linkTo = (href: string, home: boolean) => (home || !href.startsWith('#') ? href : `/${href}`);

export function Logo({ className, light, home = true }: { className?: string; light?: boolean; home?: boolean }) {
  return (
    <a href={home ? '#top' : '/'} className={cn('flex items-center gap-2', className)} aria-label="XavierOS – til forsiden">
      {light ? (
        <span className="grid size-7 shrink-0 place-items-center rounded-[28%] bg-white text-mark" aria-hidden="true">
          <XavierShards className="w-[58%]" />
        </span>
      ) : (
        <LogoMark className="size-7" />
      )}
      <Wordmark className={cn('text-[17px]', light && 'text-white')} />
    </a>
  );
}

/** Logo left, the sections in the middle, one button right – as in the reference. */
export function Header({ home = true }: { home?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <header className="relative z-40 bg-white">
      <div className="flex h-[68px] items-center justify-between px-5 sm:px-8 md:grid md:grid-cols-[1fr_auto_1fr] lg:px-14">
        <Logo home={home} />
        <nav aria-label="Hovedmenu" className="hidden items-center gap-9 md:flex">
          {NAV.map((n) => (
            <a key={n.href} href={linkTo(n.href, home)} className="text-[14px] font-medium text-ink-2 transition-colors hover:text-ink">
              {n.label}
            </a>
          ))}
        </nav>
        <div className="flex justify-end">
          <div className="hidden md:block">
            <ButtonLink href={linkTo('#kontakt', home)}>Book en demo</ButtonLink>
          </div>
          <button
            type="button"
            className="grid size-10 place-items-center rounded-full text-ink hover:bg-line-2 md:hidden"
            aria-label={open ? 'Luk menu' : 'Åbn menu'}
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </div>
      <AnimatePresence>
        {open && (
          <motion.nav
            aria-label="Mobilmenu"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3, ease }}
            className="overflow-hidden border-t border-line bg-white md:hidden"
          >
            <div className="grid gap-1 px-5 py-4">
              {NAV.map((n) => (
                <a key={n.href} href={linkTo(n.href, home)} onClick={() => setOpen(false)} className="py-2.5 text-[16px] font-medium text-ink">
                  {n.label}
                </a>
              ))}
              <div className="mt-3">
                <ButtonLink href={linkTo('#kontakt', home)} onClick={() => setOpen(false)}>
                  Book en demo
                </ButtonLink>
              </div>
            </div>
          </motion.nav>
        )}
      </AnimatePresence>
    </header>
  );
}
