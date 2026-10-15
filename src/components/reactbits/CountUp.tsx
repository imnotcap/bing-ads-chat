/** Counts from the previous value to the new one (React Bits style, motion values). */
import { animate, motion, useMotionValue, useReducedMotionConfig, useTransform } from 'motion/react';
import { useEffect } from 'react';
import { EASE } from '../motion';

export function CountUp({
  value,
  format,
  duration = 1,
  className,
}: {
  value: number | null;
  format: (v: number | null) => string;
  duration?: number;
  className?: string;
}) {
  const reduce = useReducedMotionConfig();
  const mv = useMotionValue(reduce ? (value ?? 0) : 0);
  const text = useTransform(mv, (v) => format(v));
  useEffect(() => {
    if (value === null) return;
    if (reduce) {
      mv.set(value);
      return;
    }
    const controls = animate(mv, value, { duration, ease: EASE });
    return () => controls.stop();
  }, [value, reduce, duration, mv]);
  return (
    <span className={className} aria-label={format(value)}>
      <motion.span aria-hidden>{value === null ? format(null) : text}</motion.span>
    </span>
  );
}
