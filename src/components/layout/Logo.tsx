import { cn } from '@/lib/utils';

/** The XavierOS mark: four shards forming an X (same shapes as the app icon and splash). */
export function XavierShards({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 352 294" className={className} aria-hidden fill="currentColor">
      <polygon points="4,37 121,5 197,65 164,150" />
      <polygon points="234,31 351,0 279,179 198,121" />
      <polygon points="73,115 154,173 118,263 1,294" />
      <polygon points="155,229 188,144 348,257 231,289" />
    </svg>
  );
}

/** The app icon: the white mark on a near-black tile. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <span className={cn('grid size-9 shrink-0 place-items-center rounded-[28%] bg-[#1c191b] text-white', className)} aria-hidden>
      <XavierShards className="w-[58%]" />
    </span>
  );
}

/** "XavierOS" – bold name, light "OS". */
export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn('tracking-[-0.03em] text-ink', className)}>
      <span className="font-bold">Xavier</span>
      <span className="font-light">OS</span>
    </span>
  );
}

export function Logo() {
  return (
    <div className="flex items-center gap-2.5">
      <LogoMark className="size-8" />
      <Wordmark className="text-[16px]" />
    </div>
  );
}
