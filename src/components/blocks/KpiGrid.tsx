import { motion } from 'motion/react';
import type { KpiItem } from '@/ai/visuals';
import { CountUp } from '@/components/reactbits';
import { cn } from '@/lib/utils';
import { fadeUp, stagger } from '../motion';
import { ChangeBadge } from './ChangeBadge';
import { formatValue } from './format';

export function KpiGrid({ items, currency, className, compact }: { items: KpiItem[]; currency: string; className?: string; compact?: boolean }) {
  return (
    <motion.div
      variants={stagger(0.05)}
      initial="hidden"
      animate="show"
      className={cn('grid gap-2.5', compact ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-3', className)}
    >
      {items.map((k) => (
        <motion.div key={k.label} variants={fadeUp}>
          <div className="h-full rounded-xl border border-line bg-surface px-4 py-3.5">
            <div className="relative">
              <div className="text-[12px] font-medium text-muted">{k.label}</div>
              <div className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-1">
                <CountUp
                  value={k.value}
                  format={(v) => formatValue(v === null ? null : k.format === 'number' ? Math.round(v) : v, k.format, currency)}
                  className={cn('font-medium tracking-[-0.02em] text-ink tabular', compact ? 'text-[18px]' : 'text-[21px]')}
                />
                <ChangeBadge change={k.change} invert={k.invert} />
              </div>
            </div>
          </div>
        </motion.div>
      ))}
    </motion.div>
  );
}
