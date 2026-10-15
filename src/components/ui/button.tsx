import { cva, type VariantProps } from 'class-variance-authority';
import { Slot } from 'radix-ui';
import * as React from 'react';
import { cn } from '@/lib/utils';

export const buttonVariants = cva(
  'inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-[10px] text-sm font-medium transition-[background-color,border-color,color,box-shadow,transform,opacity] duration-150 select-none disabled:pointer-events-none disabled:opacity-45 active:scale-[0.98] [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*=size-])]:size-4',
  {
    variants: {
      variant: {
        default: 'bg-ink text-white shadow-[0_1px_2px_rgb(18_18_22/0.2)] hover:bg-ink/85',
        /** Accent action (lavender). */
        gradient: 'bg-brand text-white shadow-[0_1px_2px_rgb(109_92_246/0.3)] hover:bg-brand-600',
        secondary: 'border border-line bg-surface text-ink hover:bg-line-2',
        ghost: 'text-ink-2 hover:bg-line-2 hover:text-ink',
        outline: 'border border-line bg-transparent text-ink hover:bg-line-2',
        destructive: 'bg-negative text-white hover:bg-negative/90',
        positive: 'bg-ink text-white hover:bg-ink/85',
        link: 'h-auto px-0 text-brand underline-offset-4 hover:underline',
      },
      size: {
        xs: 'h-7 rounded-lg px-2.5 text-[12px]',
        sm: 'h-8 px-3 text-[13px]',
        md: 'h-10 px-4',
        lg: 'h-11 px-5 text-[15px]',
        icon: 'size-10',
        'icon-sm': 'size-8 rounded-lg',
        'icon-xs': 'size-7 rounded-lg',
      },
    },
    defaultVariants: { variant: 'default', size: 'md' },
  },
);

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(({ className, variant, size, asChild = false, type, ...props }, ref) => {
  const Comp = asChild ? Slot.Root : 'button';
  return <Comp ref={ref} type={asChild ? undefined : (type ?? 'button')} className={cn(buttonVariants({ variant, size }), className)} {...props} />;
});
Button.displayName = 'Button';
