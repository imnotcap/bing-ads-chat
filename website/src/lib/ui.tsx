import { clsx, type ClassValue } from 'clsx';
import { motion, useInView } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react';
import { ScrambleText } from '@/components/ascii/ScrambleText';

export const cn = (...v: ClassValue[]) => clsx(v);

export const ease = [0.22, 1, 0.36, 1] as const;

/**
 * The app's server (download page, installer, web app). Set at build time from the same
 * address the app is released on (scripts/resolve-site.mjs): workers.dev until
 * app.xavieros.dk answers, then the domain.
 */
const SITE_URL = ((import.meta.env.VITE_SITE_URL as string | undefined) || 'https://bing-ads-chat.casperjohansen.workers.dev').replace(/\/$/, '');

/** The Windows installer on the app's own download site. */
export const DOWNLOAD_URL = `${SITE_URL}/XavierOS-Setup.exe`;

/** The web app (the same app in the browser) – /app/ works on every address of the server. */
export const WEB_APP_URL = `${SITE_URL}/app/`;

/** Where demo requests go. TODO: replace with the real sales address before launch. */
export const CONTACT_EMAIL = 'kontakt@xavieros.dk';

/** Children fade up as the block scrolls into view (once). */
export function Reveal({ children, className, delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.7, ease, delay }}
    >
      {children}
    </motion.div>
  );
}

/** The small section label above a heading (plain text, as in the reference). */
export function Label({ children, className, tone = 'dark' }: { children: string; className?: string; tone?: 'dark' | 'light' }) {
  return (
    <p className={cn('text-[13px] font-medium', tone === 'dark' ? 'text-subtle' : 'text-white/55', className)}>
      <ScrambleText text={children} />
    </p>
  );
}

/** The quieter half of a two-tone heading. */
export function Accent({ children }: { children: ReactNode }) {
  return <span className="text-subtle">{children}</span>;
}

export function Container({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('w-full px-5 sm:px-8 lg:px-14', className)}>{children}</div>;
}

type ButtonProps = {
  children: ReactNode;
  href: string;
  /** light: white with a hairline and a black circle · outline: transparent · dark: black with a white circle. */
  variant?: 'light' | 'outline' | 'dark';
  /** The circle at the end: an arrow (default), a play triangle or a custom icon. */
  icon?: ReactNode;
  className?: string;
  download?: boolean;
  onClick?: () => void;
};

/** The reference's buttons: label + a small round icon at the end. */
export function ButtonLink({ children, href, variant = 'light', icon, className, download, onClick }: ButtonProps) {
  return (
    <a
      href={href}
      download={download || undefined}
      onClick={onClick}
      className={cn(
        'group inline-flex h-11 items-center gap-3 rounded-full pl-5 pr-1.5 text-[14px] font-medium transition-colors',
        variant === 'light' && 'border border-black/10 bg-white text-ink hover:border-black/25',
        variant === 'outline' && 'border border-current/20 text-current hover:bg-black/[0.03]',
        variant === 'dark' && 'bg-ink text-white hover:bg-ink-2',
        className,
      )}
    >
      {children}
      <span
        className={cn(
          'grid size-8 place-items-center rounded-full transition-transform duration-300 group-hover:translate-x-0.5',
          variant === 'light' && 'bg-ink text-white',
          variant === 'outline' && 'border border-current/30',
          variant === 'dark' && 'bg-white text-ink',
        )}
      >
        {icon ?? <ArrowRight className="size-3.5" strokeWidth={2.2} />}
      </span>
    </a>
  );
}

/** A heading in two tones: the first words dark, the rest grey. */
export function TwoTone({ dark, light, className, as: Tag = 'h2' }: { dark: string; light: string; className?: string; as?: 'h1' | 'h2' | 'h3' }) {
  return (
    <Tag className={cn('text-balance font-medium tracking-[-0.035em]', className)}>
      {dark} <span className="text-subtle">{light}</span>
    </Tag>
  );
}

/** The XavierOS mark: four shards forming an X (same shapes as the app icon). */
export function XavierShards({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 352 294" className={className} aria-hidden="true" fill="currentColor">
      <polygon points="4,37 121,5 197,65 164,150" />
      <polygon points="234,31 351,0 279,179 198,121" />
      <polygon points="73,115 154,173 118,263 1,294" />
      <polygon points="155,229 188,144 348,257 231,289" />
    </svg>
  );
}

export function LogoMark({ className }: { className?: string }) {
  return (
    <span className={cn('grid size-8 shrink-0 place-items-center rounded-[28%] bg-mark text-white', className)} aria-hidden="true">
      <XavierShards className="w-[58%]" />
    </span>
  );
}

/** "XavierOS" – bold name, light "OS" (as in the app). */
export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn('tracking-[-0.03em] text-ink', className)}>
      <span className="font-bold">Xavier</span>
      <span className="font-light">OS</span>
    </span>
  );
}

export function WindowsLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" fill="currentColor">
      <path d="M2 4.5 10 3.4v7.8H2zM11 3.25 22 1.7v9.5H11zM2 12.2h8V20l-8-1.1zM11 12.2h11v9.6L11 20.3z" />
    </svg>
  );
}

/**
 * The animated clips. Video rather than GIF: a GIF is capped at 256 colours and whole
 * centiseconds per frame, which is what made the old ones look soft and jerky. The same
 * clip as 60 fps video at more than twice the resolution is a fraction of the size.
 *
 * `src` is the name without an extension – `.webm`, `.mp4` and a `.jpg` poster (the
 * first frame) sit next to each other. It starts when it scrolls into view, plays once –
 * never on a loop – and then stays on its last frame.
 *
 * It plays also when Windows' "animation effects" are off (prefers-reduced-motion): a
 * still of the first frame showed nothing of what the clip is there to show, and a clip
 * that runs once and stops is not the ongoing motion that setting is about.
 */
function clipSources(src: string) {
  const base = `${import.meta.env.BASE_URL}${src.replace(/^\//, '')}`;
  return { webm: `${base}.webm`, mp4: `${base}.mp4`, poster: `${base}.jpg` };
}

function ClipVideo({ src, alt, className, style, replay }: { src: string; alt: string; className?: string; style?: CSSProperties; replay?: string | number }) {
  const { webm, mp4, poster } = clipSources(src);
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    // React only sets `muted` as a property. Safari wants the attribute as well before it
    // lets a video start on its own, so it is set here – and the start asked for outright
    // rather than left to the autoplay attribute alone.
    v.muted = true;
    v.defaultMuted = true;
    v.setAttribute('muted', '');
    v.play().catch(() => {
      /* the browser refused; the first frame stays, as with any blocked autoplay */
    });
  }, [src, replay]);
  return (
    <video
      key={`${src}#${replay ?? ''}`}
      ref={ref}
      autoPlay
      muted
      playsInline
      poster={poster}
      preload="auto"
      aria-label={alt}
      className={className}
      style={style}
    >
      <source src={webm} type="video/webm" />
      <source src={mp4} type="video/mp4" />
    </video>
  );
}

/** A clip in a box of its own, like an image with an aspect ratio. */
export function Clip({ src, alt, width, height, className }: { src: string; alt: string; width: number; height: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.35 });
  return (
    <div ref={ref} className={cn('relative w-full', className)} style={{ aspectRatio: `${width} / ${height}` }}>
      {inView && <ClipVideo src={src} alt={alt} className="absolute inset-0 block size-full" />}
    </div>
  );
}

/** A clip that fills its box (object-fit: cover). A new `replay` value starts it again. */
export function CoverClip({ src, alt, className, position = 'center', replay }: { src: string; alt: string; className?: string; position?: string; replay?: string | number }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.3 });
  return (
    <div ref={ref} className={cn('absolute inset-0', className)}>
      {inView && <ClipVideo src={src} alt={alt} replay={replay} className="size-full object-cover" style={{ objectPosition: position }} />}
    </div>
  );
}
