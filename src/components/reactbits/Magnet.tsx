/** Pulls its child gently toward the pointer when nearby (React Bits style). */
import { motion, useMotionValue, useReducedMotionConfig, useSpring } from 'motion/react';
import { useRef, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function Magnet({ children, strength = 4, padding = 40, className, disabled }: { children: ReactNode; strength?: number; padding?: number; className?: string; disabled?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotionConfig();
  const x = useSpring(useMotionValue(0), { stiffness: 300, damping: 20 });
  const y = useSpring(useMotionValue(0), { stiffness: 300, damping: 20 });
  const off = disabled || reduce;
  return (
    <motion.div
      ref={ref}
      className={cn('inline-flex', className)}
      style={{ x, y, margin: -padding, padding }}
      onPointerMove={(e) => {
        if (off || !ref.current) return;
        const r = ref.current.getBoundingClientRect();
        x.set((e.clientX - (r.left + r.width / 2)) / strength);
        y.set((e.clientY - (r.top + r.height / 2)) / strength);
      }}
      onPointerLeave={() => {
        x.set(0);
        y.set(0);
      }}
    >
      {children}
    </motion.div>
  );
}
