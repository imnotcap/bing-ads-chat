import { cn } from '@/lib/utils';

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 1024 1024" className={cn('size-9', className)} aria-hidden>
      <defs>
        <linearGradient id="lm-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#8b7bff" />
          <stop offset="1" stopColor="#6d5cf6" />
        </linearGradient>
      </defs>
      <rect x="64" y="64" width="896" height="896" rx="240" fill="url(#lm-bg)" />
      <path d="M300 330c0-44 36-80 80-80h264c44 0 80 36 80 80v220c0 44-36 80-80 80H468l-112 92c-12 10-30 1-30-14v-78h-6c-11 0-20-9-20-20z" fill="#fff" />
      <path d="M420 520V420M512 520V370M604 520v-70" stroke="#6d5cf6" strokeWidth="46" strokeLinecap="round" />
    </svg>
  );
}

export function Logo() {
  return (
    <div className="flex items-center gap-2.5">
      <LogoMark className="size-8" />
      <div className="text-[15px] font-semibold tracking-[-0.01em] text-ink">Bing Ads Chat</div>
    </div>
  );
}
