/** Multi-step flow with animated step indicators and sliding content (React Bits style). */
import { AnimatePresence, motion } from 'motion/react';
import { Check } from '@/components/icons';
import { Children, useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { EASE } from '../motion';

export function Stepper({
  children,
  step,
  onStepChange,
  labels,
  footer,
  className,
}: {
  children: ReactNode;
  step: number;
  onStepChange?: (s: number) => void;
  labels?: string[];
  footer?: ReactNode;
  className?: string;
}) {
  const steps = Children.toArray(children);
  const [direction, setDirection] = useState(1);
  const [prev, setPrev] = useState(step);
  if (prev !== step) {
    setDirection(step > prev ? 1 : -1);
    setPrev(step);
  }

  return (
    <div className={cn('flex flex-col', className)}>
      <div className="flex items-center gap-2 px-1">
        {steps.map((_, i) => {
          const done = i < step;
          const active = i === step;
          return (
            <div key={i} className="flex flex-1 items-center gap-2 last:flex-none">
              <button
                type="button"
                disabled={i > step}
                onClick={() => onStepChange?.(i)}
                className="group flex items-center gap-2 disabled:cursor-default"
                aria-current={active ? 'step' : undefined}
              >
                <motion.span
                  className="grid size-8 place-items-center rounded-full text-[13px] font-semibold"
                  animate={{
                    backgroundColor: done || active ? '#121216' : '#f0f0f4',
                    color: done || active ? '#ffffff' : '#70707c',
                    scale: active ? 1.08 : 1,
                  }}
                  transition={{ duration: 0.3 }}
                >
                  {done ? <Check className="size-4" strokeWidth={2.6} /> : i + 1}
                </motion.span>
                {labels?.[i] && <span className={cn('hidden text-[13px] font-medium sm:inline', active ? 'text-ink' : 'text-muted')}>{labels[i]}</span>}
              </button>
              {i < steps.length - 1 && (
                <div className="relative h-[2px] flex-1 overflow-hidden rounded-full bg-line">
                  <motion.div className="absolute inset-y-0 left-0 bg-ink" initial={false} animate={{ width: done ? '100%' : '0%' }} transition={{ duration: 0.4, ease: EASE }} />
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div className="relative mt-8 min-h-[320px] overflow-hidden">
        <AnimatePresence mode="wait" custom={direction} initial={false}>
          <motion.div
            key={step}
            custom={direction}
            variants={{
              enter: (d: number) => ({ x: d * 40, opacity: 0, filter: 'blur(4px)' }),
              center: { x: 0, opacity: 1, filter: 'blur(0px)' },
              exit: (d: number) => ({ x: d * -40, opacity: 0, filter: 'blur(4px)' }),
            }}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.35, ease: EASE }}
          >
            {steps[step]}
          </motion.div>
        </AnimatePresence>
      </div>
      {footer}
    </div>
  );
}
