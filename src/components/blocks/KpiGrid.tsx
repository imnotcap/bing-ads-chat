import { motion } from 'motion/react';
import type { KpiItem } from '@/ai/visuals';
import { CountUp } from '@/components/reactbits';
import { SpotlightCard } from '@/components/reactbits';
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
          <SpotlightCard className="h-full rounded-2xl border border-black/[0.05] bg-surface px-4 py-3.5 shadow-[0_1px_2px_rgb(16_24_64/0.04)]">
            <div className="relative">
              <div className="text-[12px] font-medium text-muted">{k.label}</div>
              <div className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-1">
                <CountUp
                  value={k.value}
                  format={(v) => formatValue(v === null ? null : k.format === 'number' ? Math.round(v) : v, k.format, currency)}
                  className={cn('font-semibold tracking-[-0.02em] text-ink tabular', compact ? 'text-[18px]' : 'text-[21px]')}
                />
                <ChangeBadge change={k.change} invert={k.invert} />
              </div>
            </div>
          </SpotlightCard>
        </motion.div>
      ))}
    </motion.div>
  );
}
