/** Visual blocks the assistant can render inside the chat. */

export type ValueFormat = 'money' | 'number' | 'decimal' | 'percent' | 'ratio' | 'text' | 'date';

export interface VisualColumn {
  key: string;
  label: string;
  format?: ValueFormat;
}

export interface KpiItem {
  label: string;
  value: number | null;
  format: ValueFormat;
  /** Relative change vs. comparison period (0.12 = +12 %). */
  change?: number | null;
  /** When true a decrease is good (e.g. CPA, spend). */
  invert?: boolean;
}

export type VisualSpec =
  | { type: 'kpis'; title?: string; items: KpiItem[] }
  | {
      type: 'chart';
      title?: string;
      chart: 'line' | 'area' | 'bar';
      xKey: string;
      series: VisualColumn[];
      data: Record<string, string | number | null>[];
    }
  | { type: 'table'; title?: string; columns: VisualColumn[]; rows: Record<string, string | number | null>[] }
  | { type: 'suggestions'; question: string; items: SuggestionItem[] };

/** A follow-up the user can pick with one click. */
export interface SuggestionItem {
  label: string;
  prompt: string;
  /** Shown as a full-width primary button. */
  primary?: boolean;
}

/** Compact table shown when a tool card is expanded. */
export interface ToolPreview {
  columns: VisualColumn[];
  rows: Record<string, unknown>[];
  total?: number;
}
