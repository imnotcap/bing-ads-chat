/**
 * Slider that stretches elastically when dragged past its ends (React Bits style).
 * Keyboard accessible (arrow keys, Home/End) with role="slider".
 */
import { animate, motion, useMotionValue, useTransform } from 'motion/react';
import { useRef, useState } from 'react';
import { cn } from '@/lib/utils';

const MAX_OVERFLOW = 40;

function decay(value: number, max: number) {
  if (max === 0) return 0;
  const entry = value / max;
  const sigmoid = 2 * (1 / (1 + Math.exp(-entry)) - 0.5);
  return sigmoid * max;
}

export function ElasticSlider({
  value,
  onChange,
  min = 0,
  max = 100,
  step = 1,
  format = (v) => String(v),
  label,
  className,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  format?: (v: number) => string;
  label: string;
  className?: string;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const overflow = useMotionValue(0);
  const region = useRef<'left' | 'middle' | 'right'>('middle');
  const scaleX = useTransform(overflow, (o) => {
    const w = trackRef.current?.getBoundingClientRect().width ?? 200;
    return 1 + Math.abs(o) / w;
  });
  const originX = useTransform(overflow, (o) => (o < 0 ? 'right' : 'left'));
  const pct = ((value - min) / (max - min)) * 100;

  const setFromClientX = (clientX: number) => {
    const r = trackRef.current?.getBoundingClientRect();
    if (!r) return;
    let raw = min + ((clientX - r.left) / r.width) * (max - min);
    raw = Math.round(raw / step) * step;
    onChange(Math.min(max, Math.max(min, raw)));
    if (clientX < r.left) {
      region.current = 'left';
      overflow.set(-decay(r.left - clientX, MAX_OVERFLOW));
    } else if (clientX > r.right) {
      region.current = 'right';
      overflow.set(decay(clientX - r.right, MAX_OVERFLOW));
    } else {
      region.current = 'middle';
      overflow.set(0);
    }
  };

  return (
    <div className={cn('flex items-center gap-4', className)}>
      <motion.div
        className="relative flex h-8 flex-1 touch-none items-center"
        style={{ scaleX, originX, scaleY: useTransform(scaleX, [1, 1.2], [1, 0.8]) }}
        onPointerDown={(e) => {
          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
          setDragging(true);
          setFromClientX(e.clientX);
        }}
        onPointerMove={(e) => dragging && setFromClientX(e.clientX)}
        onPointerUp={() => {
          setDragging(false);
          animate(overflow, 0, { type: 'spring', bounce: 0.5 });
        }}
      >
        <div ref={trackRef} className="relative h-2 w-full overflow-hidden rounded-full bg-line">
          <div className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-brand to-violet" style={{ width: `${pct}%` }} />
        </div>
        <div
          role="slider"
          tabIndex={0}
          aria-label={label}
          aria-valuemin={min}
          aria-valuemax={max}
          aria-valuenow={value}
          aria-valuetext={format(value)}
          onKeyDown={(e) => {
            const big = (max - min) / 10;
            const next =
              e.key === 'ArrowRight' || e.key === 'ArrowUp'
                ? value + step
                : e.key === 'ArrowLeft' || e.key === 'ArrowDown'
                  ? value - step
                  : e.key === 'PageUp'
                    ? value + big
                    : e.key === 'PageDown'
                      ? value - big
                      : e.key === 'Home'
                        ? min
                        : e.key === 'End'
                          ? max
                          : null;
            if (next === null) return;
            e.preventDefault();
            onChange(Math.min(max, Math.max(min, Math.round(next / step) * step)));
          }}
          className={cn(
            'absolute top-1/2 size-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-brand shadow-[0_2px_8px_rgb(109_92_246/0.45)] transition-transform',
            dragging && 'scale-110',
          )}
          style={{ left: `${pct}%` }}
        />
      </motion.div>
      <span className="w-16 text-right text-sm font-semibold tabular text-ink">{format(value)}</span>
    </div>
  );
}
