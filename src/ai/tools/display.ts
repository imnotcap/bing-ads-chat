/** Tools that render visuals in the chat (no account access). */
import { z } from 'zod';
import { defineRead } from './context';

const format = z.enum(['money', 'number', 'decimal', 'percent', 'ratio', 'text', 'date']).optional();
const column = z.object({ key: z.string(), label: z.string(), format });
const cell = z.union([z.string(), z.number(), z.null()]);

/** Display tools after which the assistant's turn ends (no follow-up request needed). */
export const TERMINAL_TOOLS = new Set(['suggest_next_steps']);

const FILE_TYPES = ['csv', 'tsv', 'txt', 'md', 'json', 'ics', 'html', 'xml'] as const;

export const displayTools = [
  defineRead({
    name: 'create_file',
    kind: 'display',
    description: `Give the user a file they can save (shown as a file card with "Gem fil", saved to Downloads › Bing Ads Chat). ALWAYS use this when the user asks for a file, a download, an export, something to import, a list to send on, or a calendar entry – never paste the file's content into your reply instead. Your reply text only says briefly what the file contains.
Formats (text only): csv/tsv for spreadsheets and imports (opens in Excel – use semicolon ";" as separator and decimal comma for Danish Excel, a header row, one record per line, quote fields containing ";"), txt, md (checklists, notes, reports), json, html, xml, and ics for calendar entries (VCALENDAR with VEVENT, DTSTART/DTEND as local time YYYYMMDDTHHMMSS, SUMMARY, DESCRIPTION, a VALARM reminder). Excel (.xlsx), Word and PDF files cannot be made – offer CSV or Markdown instead and say so.`,
    schema: z.object({
      fileName: z
        .string()
        .max(100)
        .regex(new RegExp(`^[^\\\\/:*?"<>|]+\\.(${FILE_TYPES.join('|')})$`, 'i'), 'File name with one of the allowed extensions, no folders')
        .describe(`Danish, descriptive file name with extension, e.g. "negative-soegeord-brand.csv". Allowed: ${FILE_TYPES.join(', ')}.`),
      content: z.string().min(1).max(200_000).describe('The complete file content.'),
      description: z.string().max(120).optional().describe('One short Danish line about the file, e.g. "42 søgeord til import i Microsoft Advertising".'),
    }),
    label: (i) => `Laver filen ${i.fileName}`,
    async run(input) {
      return {
        result: 'The file is shown to the user with a "Gem fil" button. Do not repeat its content in your reply.',
        summary: input.fileName,
        visual: { type: 'file', fileName: input.fileName, content: input.content, description: input.description },
      };
    },
  }),
  defineRead({
    name: 'suggest_next_steps',
    kind: 'display',
    description: `End your reply with this tool: it shows the user a short question and one-click buttons for the next steps (they are sent as the user's next message). Call it as the very LAST thing in a reply, alone, after your text – never write text after it and do not repeat the question in your text.
Give 2–4 concrete, specific suggestions based on what you just did or found (e.g. apply a recommendation, dig deeper, a related optimisation). Mark the single most valuable one as primary (shown as a full-width button). Labels are short Danish imperatives (max ~50 characters); prompt is the full Danish instruction sent to you when clicked.
After creating campaigns, the primary suggestion must be to title-optimise the new campaigns ("Titel-optimér de nye kampagner").`,
    schema: z.object({
      question: z.string().max(140).describe('Short Danish question, e.g. "Skal jeg lave flere ændringer?"'),
      suggestions: z
        .array(z.object({ label: z.string().max(60), prompt: z.string().max(600), primary: z.boolean().optional() }))
        .min(1)
        .max(4),
    }),
    label: () => 'Foreslår næste skridt',
    async run(input) {
      return {
        result: 'Shown to the user. Your turn is over – the user will pick a suggestion or write a reply.',
        summary: input.question,
        visual: { type: 'suggestions', question: input.question, items: input.suggestions },
      };
    },
  }),
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
