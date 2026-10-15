import { motion } from 'motion/react';
import { Switch as SwitchPrimitive } from 'radix-ui';
import * as React from 'react';
import { cn } from '@/lib/utils';

export function Switch({ className, ...props }: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      className={cn(
        'peer inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent bg-[#dfe2ec] transition-colors data-[state=checked]:bg-brand disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb className="pointer-events-none block size-5 rounded-full bg-white shadow-[0_2px_6px_rgb(18_18_22/0.2)] transition-transform data-[state=checked]:translate-x-5 data-[state=unchecked]:translate-x-0" />
    </SwitchPrimitive.Root>
  );
}

/** Row with a label/description on the left and a switch on the right. */
export function SwitchRow({
  label,
  description,
  checked,
  onCheckedChange,
  disabled,
}: {
  label: string;
  description?: React.ReactNode;
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  const id = React.useId();
  return (
    <div className="flex items-start justify-between gap-6 py-3">
      <label htmlFor={id} className="grid gap-0.5">
        <span className="text-sm font-medium text-ink">{label}</span>
        {description && <span className="text-[12.5px] leading-relaxed text-muted">{description}</span>}
      </label>
      <Switch id={id} checked={checked} onCheckedChange={onCheckedChange} disabled={disabled} className="mt-0.5" />
    </div>
  );
}

/** Pill-shaped segmented control with a sliding indicator. */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  className,
  size = 'md',
  layoutId,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: React.ReactNode; title?: string }[];
  className?: string;
  size?: 'sm' | 'md';
  layoutId: string;
}) {
  return (
    <div role="radiogroup" className={cn('inline-flex rounded-xl bg-line-2 p-1', className)}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            title={o.title}
            onClick={() => onChange(o.value)}
            className={cn(
              'relative flex-1 whitespace-nowrap rounded-lg font-medium transition-colors',
              size === 'sm' ? 'h-7 px-2.5 text-[12px]' : 'h-8 px-3.5 text-[13px]',
              active ? 'text-ink' : 'text-muted hover:text-ink-2',
            )}
          >
            {active && (
              <motion.span
                layoutId={layoutId}
                className="absolute inset-0 rounded-lg bg-surface shadow-[0_1px_3px_rgb(18_18_22/0.1)]"
                transition={{ type: 'spring', stiffness: 500, damping: 38 }}
              />
            )}
            <span className="relative">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}

export function Badge({ className, tone = 'neutral', ...props }: React.HTMLAttributes<HTMLSpanElement> & { tone?: 'neutral' | 'brand' | 'positive' | 'negative' | 'warning' | 'violet' }) {
  const tones = {
    neutral: 'bg-neutral-bg text-ink-2',
    brand: 'bg-brand-50 text-brand',
    positive: 'bg-positive-bg text-positive',
    negative: 'bg-negative-bg text-negative',
    warning: 'bg-warning-bg text-warning',
    violet: 'bg-violet-50 text-violet',
  };
  return <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11.5px] font-medium', tones[tone], className)} {...props} />;
}

export function Kbd({ children }: { children: React.ReactNode }) {
  return <kbd className="rounded-md border border-line bg-surface px-1.5 py-0.5 font-sans text-[11px] text-muted shadow-[0_1px_0_rgb(18_18_22/0.06)]">{children}</kbd>;
}
