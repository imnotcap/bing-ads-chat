/**
 * Dropdowns, selects, dialogs and tooltips: Radix primitives for accessibility,
 * animated with motion.
 */
import { AnimatePresence, motion } from 'motion/react';
import { Check, ChevronDown, X } from 'lucide-react';
import { Dialog as DialogPrimitive, DropdownMenu as Menu, Tooltip as TooltipPrimitive } from 'radix-ui';
import * as React from 'react';
import { cn } from '@/lib/utils';
import { EASE } from '../motion';

/* --------------------------------- Dropdown --------------------------------- */

const MenuOpenContext = React.createContext(false);

export function DropdownMenu({ children, open: controlled, onOpenChange, ...props }: React.ComponentProps<typeof Menu.Root>) {
  const [uncontrolled, setUncontrolled] = React.useState(false);
  const open = controlled ?? uncontrolled;
  const setOpen = (v: boolean) => {
    setUncontrolled(v);
    onOpenChange?.(v);
  };
  return (
    <Menu.Root open={open} onOpenChange={setOpen} modal={false} {...props}>
      <MenuOpenContext.Provider value={open}>{children}</MenuOpenContext.Provider>
    </Menu.Root>
  );
}

export const DropdownMenuTrigger = Menu.Trigger;

export function DropdownMenuContent({
  className,
  children,
  align = 'start',
  sideOffset = 8,
  ...props
}: React.ComponentProps<typeof Menu.Content>) {
  const open = React.useContext(MenuOpenContext);
  return (
    <AnimatePresence>
      {open && (
        <Menu.Portal forceMount>
          <Menu.Content asChild forceMount align={align} sideOffset={sideOffset} {...props}>
            <motion.div
              initial={{ opacity: 0, y: -6, scale: 0.97, filter: 'blur(3px)' }}
              animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
              exit={{ opacity: 0, y: -4, scale: 0.98, filter: 'blur(2px)', transition: { duration: 0.12 } }}
              transition={{ duration: 0.22, ease: EASE }}
              className={cn(
                'z-50 min-w-[220px] origin-[var(--radix-dropdown-menu-content-transform-origin)] overflow-hidden rounded-xl border border-line bg-white/95 p-1 shadow-pop backdrop-blur-xl',
                className,
              )}
            >
              {children}
            </motion.div>
          </Menu.Content>
        </Menu.Portal>
      )}
    </AnimatePresence>
  );
}

export function DropdownMenuItem({ className, inset, ...props }: React.ComponentProps<typeof Menu.Item> & { inset?: boolean }) {
  return (
    <Menu.Item
      className={cn(
        'relative flex cursor-pointer select-none items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13.5px] text-ink-2 outline-none transition-colors data-[disabled]:pointer-events-none data-[highlighted]:bg-line-2 data-[highlighted]:text-ink data-[disabled]:opacity-50 [&_svg]:size-4 [&_svg]:text-muted',
        inset && 'pl-9',
        className,
      )}
      {...props}
    />
  );
}

export function DropdownMenuLabel({ className, ...props }: React.ComponentProps<typeof Menu.Label>) {
  return <Menu.Label className={cn('px-2.5 pb-1 pt-2 text-[12px] font-medium text-muted', className)} {...props} />;
}

export function DropdownMenuSeparator({ className, ...props }: React.ComponentProps<typeof Menu.Separator>) {
  return <Menu.Separator className={cn('my-1.5 h-px bg-line', className)} {...props} />;
}

/* ---------------------------------- Select ---------------------------------- */

export interface SelectOption<T extends string> {
  value: T;
  label: React.ReactNode;
  description?: React.ReactNode;
  icon?: React.ReactNode;
}

/** Dropdown-based select with optional descriptions per option. */
export function Select<T extends string>({
  value,
  onChange,
  options,
  placeholder = 'Vælg …',
  className,
  contentClassName,
  align = 'start',
  'aria-label': ariaLabel,
  triggerVariant = 'field',
}: {
  value: T | null;
  onChange: (v: T) => void;
  options: SelectOption<T>[];
  placeholder?: string;
  className?: string;
  contentClassName?: string;
  align?: 'start' | 'end' | 'center';
  'aria-label'?: string;
  triggerVariant?: 'field' | 'pill';
}) {
  const current = options.find((o) => o.value === value);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={ariaLabel}
          className={cn(
            'group inline-flex items-center gap-2 text-left text-sm text-ink outline-none transition-[border-color,box-shadow,background-color]',
            triggerVariant === 'field'
              ? 'h-10 w-full justify-between rounded-xl border border-line bg-surface px-3.5 shadow-[0_1px_2px_rgb(18_18_22/0.03)] hover:border-black/10 focus-visible:border-brand/50 focus-visible:ring-4 focus-visible:ring-brand/10 data-[state=open]:border-brand/40 data-[state=open]:ring-4 data-[state=open]:ring-brand/10'
              : 'h-8 rounded-lg px-2.5 text-[12.5px] font-medium text-muted hover:bg-line-2 hover:text-ink data-[state=open]:bg-line-2 data-[state=open]:text-ink',
            className,
          )}
        >
          <span className="flex min-w-0 items-center gap-2 truncate">
            {current?.icon}
            <span className="truncate">{current ? current.label : <span className="text-subtle">{placeholder}</span>}</span>
          </span>
          <ChevronDown className="size-4 shrink-0 text-muted transition-transform duration-200 group-data-[state=open]:rotate-180" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align} className={cn('max-h-[380px] overflow-y-auto', contentClassName)}>
        {options.map((o) => (
          <DropdownMenuItem key={o.value} onSelect={() => onChange(o.value)} className="items-start">
            {o.icon && <span className="mt-0.5">{o.icon}</span>}
            <span className="grid flex-1 gap-0.5">
              <span className={cn('text-[13.5px]', o.value === value ? 'font-semibold text-ink' : '')}>{o.label}</span>
              {o.description && <span className="text-[12px] leading-snug text-muted">{o.description}</span>}
            </span>
            {o.value === value && <Check className="mt-0.5 !text-brand" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/* ---------------------------------- Dialog ---------------------------------- */

export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  className,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {open && (
          <DialogPrimitive.Portal forceMount>
            <DialogPrimitive.Overlay asChild forceMount>
              <motion.div
                className="fixed inset-0 z-50 bg-[#121216]/25 backdrop-blur-[3px]"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
              />
            </DialogPrimitive.Overlay>
            <DialogPrimitive.Content asChild forceMount>
              <motion.div
                className={cn(
                  'fixed left-1/2 top-1/2 z-50 w-[min(520px,calc(100vw-32px))] rounded-3xl border border-black/[0.05] bg-surface p-6 shadow-pop outline-none',
                  className,
                )}
                initial={{ opacity: 0, scale: 0.96, x: '-50%', y: '-46%' }}
                animate={{ opacity: 1, scale: 1, x: '-50%', y: '-50%' }}
                exit={{ opacity: 0, scale: 0.97, x: '-50%', y: '-48%', transition: { duration: 0.15 } }}
                transition={{ duration: 0.3, ease: EASE }}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="grid gap-1">
                    <DialogPrimitive.Title className="text-[18px] font-semibold tracking-[-0.01em] text-ink">{title}</DialogPrimitive.Title>
                    {description ? (
                      <DialogPrimitive.Description className="text-[13.5px] leading-relaxed text-muted">{description}</DialogPrimitive.Description>
                    ) : (
                      <DialogPrimitive.Description className="sr-only">{typeof title === 'string' ? title : 'Dialog'}</DialogPrimitive.Description>
                    )}
                  </div>
                  <DialogPrimitive.Close className="rounded-lg p-1.5 text-muted transition-colors hover:bg-line-2 hover:text-ink" aria-label="Luk">
                    <X className="size-4" />
                  </DialogPrimitive.Close>
                </div>
                {children && <div className="mt-5">{children}</div>}
                {footer && <div className="mt-6 flex justify-end gap-2">{footer}</div>}
              </motion.div>
            </DialogPrimitive.Content>
          </DialogPrimitive.Portal>
        )}
      </AnimatePresence>
    </DialogPrimitive.Root>
  );
}

/* --------------------------------- Tooltip --------------------------------- */

export function TooltipProvider({ children }: { children: React.ReactNode }) {
  return <TooltipPrimitive.Provider delayDuration={350}>{children}</TooltipPrimitive.Provider>;
}

export function Tooltip({ content, children, side = 'top' }: { content: React.ReactNode; children: React.ReactElement; side?: 'top' | 'right' | 'bottom' | 'left' }) {
  return (
    <TooltipPrimitive.Root>
      <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          side={side}
          sideOffset={8}
          className="z-[60] max-w-xs rounded-lg bg-[#121216] px-2.5 py-1.5 text-[12px] font-medium text-white shadow-pop data-[state=delayed-open]:animate-[fade-in_120ms_ease-out]"
        >
          {content}
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}
