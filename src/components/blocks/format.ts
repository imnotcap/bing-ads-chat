import type { ValueFormat } from '@/ai/visuals';
import { fmtDate, fmtMoney, fmtNumber, fmtPercent } from '@/lib/format';

export function formatValue(v: unknown, format: ValueFormat | undefined, currency = 'DKK'): string {
  if (v === null || v === undefined || v === '') return '–';
  if (typeof v !== 'number') {
    if (format === 'date' && typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)) return fmtDate(v);
    return String(v);
  }
  switch (format) {
    case 'money':
      return fmtMoney(v, currency);
    case 'percent':
      return fmtPercent(v);
    case 'ratio':
      return `${fmtNumber(v, 2)}x`;
    case 'decimal':
      return fmtNumber(v, Number.isInteger(v) ? 0 : 1);
    case 'number':
      return fmtNumber(v);
    default:
      return Number.isInteger(v) ? fmtNumber(v) : fmtNumber(v, 2);
  }
}
