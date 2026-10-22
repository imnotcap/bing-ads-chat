/**
 * The web app's invitation to the Windows app: a colourful card that pops up at the
 * bottom of the sidebar (closed → a small pill that stays), and a matching button in
 * the icon rail for when the sidebar is hidden. Never shown inside the desktop app.
 */
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useState } from 'react';
import { ArrowDownToLine, Bell, Check, X, Zap } from '@/components/icons';
import { GradientASCII } from '@/components/reactbits';
import { Tooltip } from '@/components/ui/overlays';
import { isTauri } from '@/lib/platform';
import { cn } from '@/lib/utils';
import { SITE_URL } from '@/workspace/api';
import { XavierShards } from './Logo';

const DOWNLOAD_URL = `${SITE_URL}/XavierOS-Setup.exe`;
const CLOSED_KEY = 'xavieros.download-promo-closed';
/** Violet (the app's brand) through magenta and orange to teal. */
const COLORS = ['#3b1fd1', '#6d5cf6', '#c026d3', '#f43f5e', '#f59e0b', '#14b8a6'];
const GRADIENT = 'linear-gradient(125deg,#5b3df5 0%,#8b5cf6 28%,#d946ef 55%,#f97316 82%,#f59e0b 100%)';

const PERKS = [
  { icon: Zap, text: 'Hurtigere – og kører videre i baggrunden' },
  { icon: Bell, text: 'Notifikationer fra Windows' },
  { icon: Check, text: 'Opdaterer sig selv' },
];

interface Release {
  version: string;
  sizeMb?: string;
}

function useRelease(): Release | null {
  const [release, setRelease] = useState<Release | null>(null);
  useEffect(() => {
    fetch(`${SITE_URL}/version.json`, { cache: 'no-store' })
      .then((r) => (r.ok ? (r.json() as Promise<Release>) : null))
      .then(setRelease, () => undefined);
  }, []);
  return release;
}

function readClosed() {
  try {
    return localStorage.getItem(CLOSED_KEY) === '1';
  } catch {
    return false;
  }
}

function WindowsLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden fill="currentColor">
      <path d="M2 4.5 10 3.4v7.8H2zM11 3.25 22 1.7v9.5H11zM2 12.2h8V20l-8-1.1zM11 12.2h11v9.6L11 20.3z" />
    </svg>
  );
}

/** Bottom of the sidebar, in the browser only. */
export function DownloadPromo() {
  const release = useRelease();
  const [closed, setClosed] = useState(readClosed);
  // A short pause first, so it pops up rather than arriving with the page.
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setReady(true), 900);
    return () => clearTimeout(t);
  }, []);
  if (isTauri) return null;

  const setClosedSaved = (v: boolean) => {
    setClosed(v);
    try {
      localStorage.setItem(CLOSED_KEY, v ? '1' : '0');
    } catch {
      // Private window: it just pops up again next time.
    }
  };

  return (
    <div className="shrink-0 px-3 pb-3">
      <AnimatePresence mode="wait" initial={false}>
        {ready && !closed && (
          <motion.div
            key="card"
            initial={{ opacity: 0, y: 40, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.94 }}
            transition={{ type: 'spring', stiffness: 260, damping: 22 }}
            className="relative isolate overflow-hidden rounded-2xl p-[1.5px] shadow-[0_18px_40px_-14px_rgb(124_58_237/0.65)]"
            style={{ background: GRADIENT }}
          >
            {/* The app's ASCII effect, in white over the colours. */}
            <div className="relative overflow-hidden rounded-[14.5px] px-4 pb-4 pt-4 text-white" style={{ background: GRADIENT }}>
              <motion.div
                aria-hidden
                className="pointer-events-none absolute -inset-1/2 opacity-70 mix-blend-soft-light"
                style={{ background: 'conic-gradient(from 0deg,#22d3ee,#a855f7,#f43f5e,#facc15,#22d3ee)' }}
                animate={{ rotate: 360 }}
                transition={{ duration: 14, repeat: Infinity, ease: 'linear' }}
              />
              <GradientASCII
                colors={COLORS}
                shape="eclipse"
                characters=" ·:▪■"
                cellSize={11}
                density={0.7}
                glyphOpacity={0.4}
                gradientOpacity={0}
                grain={0}
                flicker={0.3}
                speed={0.9}
                lightMode
                inkColor="#ffffff"
                mouseInteraction
                clickEffect="wave"
                intro={false}
                className="absolute inset-0"
              />
              <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,transparent_35%,rgb(40_10_80/0.35)_100%)]" />
              <button
                type="button"
                onClick={() => setClosedSaved(true)}
                aria-label="Skjul"
                className="absolute right-2 top-2 z-10 grid size-7 place-items-center rounded-full text-white/75 transition-colors hover:bg-white/15 hover:text-white"
              >
                <X className="size-3.5" />
              </button>
              <div className="relative">
                <div className="flex items-center gap-2.5">
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white/95 text-[#1c191b] shadow-[0_6px_16px_-6px_rgb(0_0_0/0.5)]">
                    <XavierShards className="w-[58%]" />
                  </span>
                  <div className="min-w-0">
                    <div className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-white/85">Nyt · til Windows-pc</div>
                    <div className="text-[15.5px] font-bold leading-tight tracking-[-0.02em]">Hent desktop-appen</div>
                  </div>
                </div>
                <ul className="mt-3 grid gap-1.5">
                  {PERKS.map((p) => (
                    <li key={p.text} className="flex items-center gap-2 text-[12px] font-medium leading-snug text-white [text-shadow:0_1px_8px_rgb(60_10_100/0.35)]">
                      <p.icon className="size-3.5 shrink-0 text-white" />
                      {p.text}
                    </li>
                  ))}
                </ul>
                <motion.a
                  href={DOWNLOAD_URL}
                  download
                  whileHover={{ y: -1 }}
                  whileTap={{ scale: 0.97 }}
                  className="mt-3.5 flex h-10 items-center justify-center gap-2 rounded-xl bg-white text-[13.5px] font-bold text-[#2a1670] shadow-[0_10px_24px_-10px_rgb(0_0_0/0.6)] transition-colors hover:bg-amber-50"
                >
                  <WindowsLogo className="size-4 text-[#5b3df5]" />
                  Download til Windows
                </motion.a>
                <div className="mt-2 text-center text-[11px] font-medium text-white/85 tabular">
                  {release ? `Version ${release.version}${release.sizeMb ? ` · ${release.sizeMb} MB` : ''}` : 'Til Windows 10 og 11'}
                </div>
              </div>
            </div>
          </motion.div>
        )}
        {ready && closed && (
          <motion.a
            key="pill"
            href={DOWNLOAD_URL}
            download
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            transition={{ duration: 0.25 }}
            onContextMenu={(e) => {
              // Right-click brings the card back.
              e.preventDefault();
              setClosedSaved(false);
            }}
            className="flex h-9 items-center gap-2 rounded-xl px-3 text-[12.5px] font-semibold text-white shadow-[0_10px_22px_-12px_rgb(124_58_237/0.8)] transition-[filter] hover:brightness-110"
            style={{ background: GRADIENT }}
          >
            <WindowsLogo className="size-3.5" />
            <span className="flex-1">Hent appen til Windows</span>
            <ArrowDownToLine className="size-3.5" />
          </motion.a>
        )}
      </AnimatePresence>
    </div>
  );
}

/** In the icon rail (browser only): the download, also when the sidebar is hidden. */
export function DownloadRailButton({ className }: { className?: string }) {
  if (isTauri) return null;
  return (
    <Tooltip content="Hent appen til Windows" side="right">
      <a
        href={DOWNLOAD_URL}
        download
        aria-label="Hent appen til Windows"
        className={cn('relative mb-1 grid size-9 place-items-center rounded-xl text-white shadow-[0_8px_18px_-8px_rgb(124_58_237/0.9)] transition-transform hover:-translate-y-px', className)}
        style={{ background: GRADIENT }}
      >
        <ArrowDownToLine className="size-[17px]" />
        <span className="absolute -right-0.5 -top-0.5 size-2.5 animate-pulse rounded-full bg-amber-300 ring-2 ring-[#fafafb]" />
      </a>
    </Tooltip>
  );
}
