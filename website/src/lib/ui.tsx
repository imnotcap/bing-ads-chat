import { ArrowRight, Loader2 } from 'lucide-react';
import { motion } from 'motion/react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { A } from './router';

export { cn };

export const ease = [0.22, 1, 0.36, 1] as const;

export function Container({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn('mx-auto w-full max-w-[1160px] px-4 sm:px-6', className)}>{children}</div>;
}

/** The italic, coloured half of a headline. */
export function Accent({ children }: { children: ReactNode }) {
  return <em className="text-gradient pr-[0.06em] font-semibold italic">{children}</em>;
}

export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-[12.5px] font-semibold text-brand-600 shadow-card ring-1 ring-black/[0.04]', className)}>
      <span className="size-1.5 rounded-full bg-brand" />
      {children}
    </span>
  );
}

export function SectionHead({ eyebrow, title, lead, className }: { eyebrow?: string; title: ReactNode; lead?: ReactNode; className?: string }) {
  return (
    <Reveal className={cn('mx-auto flex max-w-2xl flex-col items-center text-center', className)}>
      {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
      <h2 className="mt-4 text-balance text-[32px] font-bold leading-[1.1] tracking-[-0.03em] text-ink sm:text-[44px]">{title}</h2>
      {lead && <p className="mt-4 text-pretty text-[16.5px] leading-relaxed text-muted">{lead}</p>}
    </Reveal>
  );
}

export function Reveal({ children, className, delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.7, delay, ease }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

const buttonBase =
  'inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-full font-semibold transition-[background,box-shadow,transform,color] active:translate-y-px disabled:pointer-events-none disabled:opacity-50';
const variants = {
  primary: 'bg-ink text-white hover:bg-[#2a2a31] shadow-[0_10px_24px_-12px_rgb(18_18_22/0.6)]',
  brand: 'bg-brand text-white hover:bg-brand-600 shadow-glow',
  ghost: 'bg-white text-ink ring-1 ring-black/[0.08] hover:ring-black/[0.16] shadow-card',
  soft: 'bg-brand-50 text-brand-600 hover:bg-brand-100',
  quiet: 'text-ink-2 hover:bg-black/[0.04] hover:text-ink',
  danger: 'bg-white text-negative ring-1 ring-negative/25 hover:bg-negative-bg',
};
const sizes = { sm: 'h-9 px-4 text-[13.5px]', md: 'h-11 px-5 text-[15px]', lg: 'h-[52px] px-7 text-[16px]' };

type Variant = keyof typeof variants;
type Size = keyof typeof sizes;

export function Button({
  variant = 'primary',
  size = 'md',
  loading,
  className,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size; loading?: boolean }) {
  return (
    <button type="button" className={cn(buttonBase, variants[variant], sizes[size], className)} disabled={loading || rest.disabled} {...rest}>
      {loading && <Loader2 className="size-4 animate-spin" />}
      {children}
    </button>
  );
}

export function ButtonLink({
  href,
  variant = 'primary',
  size = 'md',
  arrow,
  className,
  children,
  download,
}: {
  href: string;
  variant?: Variant;
  size?: Size;
  arrow?: boolean;
  className?: string;
  children: ReactNode;
  download?: boolean;
}) {
  return (
    <A href={href} download={download} className={cn(buttonBase, 'group', variants[variant], sizes[size], className)}>
      {children}
      {arrow && <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />}
    </A>
  );
}

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn('rounded-[28px] bg-white shadow-card ring-1 ring-black/[0.05]', className)}>{children}</div>;
}

export const usd = (v: number, digits = 0) => `$${v.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
