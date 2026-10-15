import * as React from 'react';
import { cn } from '@/lib/utils';

export const inputClass =
  'h-10 w-full rounded-[10px] border border-line bg-surface px-3.5 text-sm text-ink outline-none transition-[border-color,box-shadow] placeholder:text-subtle hover:border-black/15 focus:border-brand/50 focus:ring-4 focus:ring-brand/10 disabled:opacity-60';

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(({ className, ...props }, ref) => (
  <input ref={ref} className={cn(inputClass, className)} {...props} />
));
Input.displayName = 'Input';

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(({ className, ...props }, ref) => (
  <textarea ref={ref} className={cn(inputClass, 'h-auto min-h-24 resize-y py-2.5 leading-relaxed', className)} {...props} />
));
Textarea.displayName = 'Textarea';

/** Number input that allows empty (= no limit). */
export function NumberInput({
  value,
  onChange,
  placeholder = 'Ingen grænse',
  suffix,
  min = 0,
  step = 1,
  className,
  ...rest
}: {
  value: number | null;
  onChange: (v: number | null) => void;
  placeholder?: string;
  suffix?: string;
  min?: number;
  step?: number;
  className?: string;
  'aria-label'?: string;
  id?: string;
}) {
  const [text, setText] = React.useState(value === null ? '' : String(value).replace('.', ','));
  React.useEffect(() => {
    setText((t) => {
      const parsed = t.trim() === '' ? null : Number(t.replace(/\./g, '').replace(',', '.'));
      return parsed === value ? t : value === null ? '' : String(value).replace('.', ',');
    });
  }, [value]);
  return (
    <div className={cn('relative', className)}>
      <input
        {...rest}
        inputMode="decimal"
        className={cn(inputClass, suffix && 'pr-12', 'tabular')}
        placeholder={placeholder}
        value={text}
        onChange={(e) => {
          const t = e.target.value;
          setText(t);
          if (t.trim() === '') return onChange(null);
          const n = Number(t.replace(/\./g, '').replace(',', '.'));
          if (Number.isFinite(n) && n >= min) onChange(Math.round(n / step) * step);
        }}
      />
      {suffix && <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-[13px] text-muted">{suffix}</span>}
    </div>
  );
}

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn('text-[13px] font-medium text-ink-2', className)} {...props} />;
}

export function Field({ label, hint, children, htmlFor, className }: { label: string; hint?: React.ReactNode; children: React.ReactNode; htmlFor?: string; className?: string }) {
  return (
    <div className={cn('grid content-start gap-1.5', className)}>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {hint && <p className="text-[12px] leading-relaxed text-muted">{hint}</p>}
    </div>
  );
}
