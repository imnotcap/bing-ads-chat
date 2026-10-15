/** Tools that render visuals in the chat (no account access). */
import { z } from 'zod';
import { defineRead } from './context';

const format = z.enum(['money', 'number', 'decimal', 'percent', 'ratio', 'text', 'date']).optional();
const column = z.object({ key: z.string(), label: z.string(), format });
const cell = z.union([z.string(), z.number(), z.null()]);

export const displayTools = [
  defineRead({
    name: 'show_kpis',
    kind: 'display',
    description:
      "Show KPI tiles to the user. format: money (account currency), number, decimal, percent (0.12 = 12 %), ratio (ROAS 4.2 → '4,20x'). change is the relative change (0.1 = +10 %); set invert for metrics where lower is better (CPA, CPC, spend).",
    schema: z.object({
      title: z.string().optional(),
      items: z
        .array(z.object({ label: z.string(), value: z.number().nullable(), format: format.default('number'), change: z.number().nullable().optional(), invert: z.boolean().optional() }))
        .min(1)
        .max(8),
    }),
    label: () => 'Viser nøgletal',
    async run(input) {
      return {
        result: 'Vist for brugeren.',
        summary: input.title ?? 'Nøgletal',
        visual: { type: 'kpis', title: input.title, items: input.items.map((i) => ({ ...i, format: i.format ?? 'number' })) },
      };
    },
  }),
  defineRead({
    name: 'show_chart',
    kind: 'display',
    description:
      'Show a chart to the user. chart: line or area for trends over time, bar for comparisons. data is an array of rows; xKey names the x-axis field; series lists the numeric fields to plot (max 4).',
    schema: z.object({
      title: z.string().optional(),
      chart: z.enum(['line', 'area', 'bar']),
      xKey: z.string(),
      series: z.array(column).min(1).max(4),
      data: z.array(z.record(z.string(), cell)).min(1).max(400),
    }),
    label: () => 'Tegner graf',
    async run(input) {
      return { result: 'Vist for brugeren.', summary: input.title ?? 'Graf', visual: { type: 'chart', ...input } };
    },
  }),
  defineRead({
    name: 'show_table',
    kind: 'display',
    description: 'Show a formatted table to the user (better than a markdown table for numbers and many rows).',
    schema: z.object({
      title: z.string().optional(),
      columns: z.array(column).min(1).max(10),
      rows: z.array(z.record(z.string(), cell)).min(1).max(300),
    }),
    label: () => 'Viser tabel',
    async run(input) {
      return { result: 'Vist for brugeren.', summary: input.title ?? 'Tabel', visual: { type: 'table', ...input } };
    },
  }),
];
