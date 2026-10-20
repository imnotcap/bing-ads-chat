import { Menu, X } from 'lucide-react';
import { AnimatePresence, motion, useMotionValueEvent, useScroll } from 'motion/react';
import { useEffect, useState } from 'react';
import { LogoMark, Wordmark } from '@/components/layout/Logo';
import { useSignedIn } from '@site/lib/api';
import { A, usePath } from '@site/lib/router';
import { ButtonLink, cn, ease } from '@site/lib/ui';

const NAV = [
  { label: 'Funktioner', href: '/#funktioner' },
  { label: 'Sådan virker det', href: '/#saadan' },
  { label: 'Priser', href: '/priser' },
  { label: 'Download', href: '/download' },
  { label: 'FAQ', href: '/#faq' },
];

export function Logo({ className }: { className?: string }) {
  return (
    <A href="/" className={cn('flex items-center gap-2.5', className)} aria-label="XavierOS – til forsiden">
      <LogoMark className="size-8" />
      <Wordmark className="text-[19px]" />
    </A>
  );
}

export function Header() {
  const { scrollY } = useScroll();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const path = usePath();
  const signedIn = useSignedIn();
  useMotionValueEvent(scrollY, 'change', (y) => setScrolled(y > 8));
  useEffect(() => setOpen(false), [path]);

  return (
    <header className="sticky top-0 z-40 px-3 pt-3 sm:px-5">
      <div
        className={cn(
          'mx-auto flex h-14 max-w-[1160px] items-center justify-between rounded-full pl-5 pr-2 ring-1 transition-[background,box-shadow] duration-300',
          scrolled || open ? 'bg-white/90 shadow-pop ring-black/[0.06] backdrop-blur-xl' : 'bg-white/70 ring-black/[0.04] backdrop-blur',
        )}
      >
        <Logo />
        <nav aria-label="Hovedmenu" className="hidden items-center lg:flex">
          {NAV.map((n) => (
            <A
              key={n.href}
              href={n.href}
              className={cn(
                'rounded-full px-3 py-2 text-[14px] font-semibold transition-colors hover:bg-black/[0.04] hover:text-ink',
                path === n.href ? 'bg-black/[0.05] text-ink' : 'text-ink-2',
              )}
            >
              {n.label}
            </A>
          ))}
        </nav>
        <div className="hidden items-center gap-2 lg:flex">
          <A href={signedIn ? '/konto' : '/login'} className="rounded-full px-3 py-2 text-[14px] font-semibold text-ink-2 hover:bg-black/[0.04] hover:text-ink">
            {signedIn ? 'Min konto' : 'Log ind'}
          </A>
          <ButtonLink href="/download" size="sm" className="h-10">
            Hent XavierOS
          </ButtonLink>
        </div>
        <button
          type="button"
          className="grid size-10 place-items-center rounded-full text-ink hover:bg-black/[0.05] lg:hidden"
          aria-label={open ? 'Luk menu' : 'Åbn menu'}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </div>
      <AnimatePresence>
        {open && (
          <motion.nav
            aria-label="Mobilmenu"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3, ease }}
            className="mx-auto mt-2 max-w-[1160px] overflow-hidden rounded-3xl bg-white shadow-pop ring-1 ring-black/[0.06] lg:hidden"
          >
            <div className="grid gap-1 px-5 py-4">
              {NAV.map((n) => (
                <A key={n.href} href={n.href} onClick={() => setOpen(false)} className="rounded-xl px-3 py-3 text-[16px] font-semibold text-ink hover:bg-black/[0.04]">
                  {n.label}
                </A>
              ))}
              <A href={signedIn ? '/konto' : '/login'} className="rounded-xl px-3 py-3 text-[16px] font-semibold text-ink hover:bg-black/[0.04]">
                {signedIn ? 'Min konto' : 'Log ind'}
              </A>
              <ButtonLink href="/download" className="mt-2" arrow>
                Hent XavierOS til Windows
              </ButtonLink>
            </div>
          </motion.nav>
        )}
      </AnimatePresence>
    </header>
  );
}
