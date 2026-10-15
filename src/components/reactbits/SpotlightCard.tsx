/** Card with a soft spotlight that follows the pointer (React Bits style). */
import { useRef, type HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export function SpotlightCard({
  className,
  spotlightColor = 'rgba(79, 107, 245, 0.12)',
  children,
  ...props
}: HTMLAttributes<HTMLDivElement> & { spotlightColor?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  return (
    <div
      ref={ref}
      onPointerMove={(e) => {
        const el = ref.current;
        if (!el) return;
        const r = el.getBoundingClientRect();
        el.style.setProperty('--mx', `${e.clientX - r.left}px`);
        el.style.setProperty('--my', `${e.clientY - r.top}px`);
      }}
      className={cn('group/spot relative overflow-hidden', className)}
      {...props}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover/spot:opacity-100"
        style={{ background: `radial-gradient(420px circle at var(--mx, 50%) var(--my, 50%), ${spotlightColor}, transparent 60%)` }}
      />
      {children}
    </div>
  );
}
