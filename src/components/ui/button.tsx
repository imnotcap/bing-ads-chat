import { cva, type VariantProps } from 'class-variance-authority';
import { Slot } from 'radix-ui';
import * as React from 'react';
import { cn } from '@/lib/utils';

export const buttonVariants = cva(
  'inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-medium transition-[background-color,border-color,color,box-shadow,transform,opacity] duration-150 select-none disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98] [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*=size-])]:size-4',
  {
    variants: {
      variant: {
        default: 'bg-brand text-white shadow-[0_1px_2px_rgb(79_107_245/0.3),0_8px_20px_-10px_rgb(79_107_245/0.7)] hover:bg-brand-600',
        gradient:
          'bg-[linear-gradient(110deg,#4f6bf5,#7c5cf6)] text-white shadow-[0_8px_22px_-10px_rgb(91_92_246/0.8)] hover:brightness-110',
        secondary: 'border border-line bg-surface text-ink shadow-[0_1px_2px_rgb(16_24_64/0.04)] hover:border-brand/25 hover:bg-brand-50/60',
        ghost: 'text-ink-2 hover:bg-brand-50 hover:text-brand',
        outline: 'border border-line bg-transparent text-ink hover:bg-line-2',
        destructive: 'bg-negative text-white hover:bg-negative/90',
        positive: 'bg-positive text-white hover:bg-positive/90',
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
