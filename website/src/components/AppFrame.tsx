import { Minus, Square, X } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { LogoMark } from '@/components/layout/Logo';
import { cn } from '@site/lib/ui';

/** A Windows window around a recording of the app. */
export function AppFrame({ children, title = 'XavierOS', className }: { children: ReactNode; title?: string; className?: string }) {
  return (
    <div className={cn('overflow-hidden rounded-[22px] bg-white shadow-frame ring-1 ring-black/[0.07]', className)}>
      <div className="flex h-9 items-center gap-2 border-b border-line bg-[#fbfbfc] pl-3.5 text-[12px] font-semibold text-muted">
        <LogoMark className="size-4 rounded-[5px]" />
        <span className="flex-1 truncate">{title}</span>
        <span className="flex h-full" aria-hidden>
          <span className="grid w-10 place-items-center">
            <Minus className="size-3.5" />
          </span>
          <span className="grid w-10 place-items-center">
            <Square className="size-3" />
          </span>
          <span className="grid w-10 place-items-center">
            <X className="size-3.5" />
          </span>
        </span>
      </div>
      {children}
    </div>
  );
}

/**
 * A looping recording of the app (website/public/media, made by
 * scripts/record-site-media.mjs) – VP9 first, H.264 for Safari. Plays only while on screen.
 */
export function Clip({ name, className, label }: { name: string; className?: string; label: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    const io = new IntersectionObserver(([e]) => {
      if (e?.isIntersecting) void video.play().catch(() => {});
      else video.pause();
    });
    io.observe(video);
    return () => io.disconnect();
  }, [name]);
  return (
    <div className={cn('relative aspect-[16/10] bg-canvas', className)}>
      {failed ? (
        <div className="bg-aurora absolute inset-0 grid place-items-center text-[14px] font-semibold text-muted">{label}</div>
      ) : (
        <video
          key={name}
          ref={ref}
          className="absolute inset-0 size-full object-cover object-top"
          poster={`/media/${name}.jpg`}
          muted
          loop
          playsInline
          preload="metadata"
          aria-label={label}
        >
          <source src={`/media/${name}.webm`} type="video/webm" />
          {/* The last source failing means nothing can be played. */}
          <source src={`/media/${name}.mp4`} type="video/mp4" onError={() => setFailed(true)} />
        </video>
      )}
    </div>
  );
}
