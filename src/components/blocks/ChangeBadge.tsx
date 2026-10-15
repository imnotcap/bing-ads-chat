import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import { fmtPercent } from '@/lib/format';
import { cn } from '@/lib/utils';

export function ChangeBadge({ change, invert = false, className }: { change: number | null | undefined; invert?: boolean; className?: string }) {
  if (change === null || change === undefined) return null;
  const flat = Math.abs(change) < 0.005;
  const good = flat ? null : invert ? change < 0 : change > 0;
  const Icon = flat ? Minus : change > 0 ? ArrowUpRight : ArrowDownRight;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[11.5px] font-semibold tabular',
        good === null ? 'bg-neutral-bg text-neutral' : good ? 'bg-positive-bg text-positive' : 'bg-negative-bg text-negative',
        className,
      )}
    >
      <Icon className="size-3" strokeWidth={2.4} />
      {fmtPercent(Math.abs(change), Math.abs(change) < 0.1 ? 1 : 0)}
    </span>
  );
}
