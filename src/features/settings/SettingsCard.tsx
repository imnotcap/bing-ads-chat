/** A titled section on a settings page. */
import { cn } from '@/lib/utils';

export function Card({ title, description, children, className, action }: { title: string; description?: React.ReactNode; children: React.ReactNode; className?: string; action?: React.ReactNode }) {
  return (
    <section className={cn('border-b border-line py-7 first:pt-1 last:border-0', className)}>
      <div className="mb-4 flex items-start gap-4">
        <div className="flex-1">
          <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-ink">{title}</h2>
          {description && <p className="mt-1 text-[13px] leading-relaxed text-muted">{description}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
