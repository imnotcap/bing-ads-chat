import type { z } from 'zod';
import type { AdsBackend, Campaign, ReportRow, ReportSpec } from '@/bing/types';
import { DATE_PRESET_LABELS, presetRange, today, type DatePreset, type DateRange } from '@/lib/format';
import type { SpendRules } from '@/stores/settings';
import type { ChangeLine, UndoSpec } from '@/stores/activity';
import type { ChangePlan } from '../guardrails';
import type { ToolPreview, VisualSpec } from '../visuals';

export interface ToolContext {
  backend: AdsBackend;
  accountId: string;
  currency: string;
  rules: SpendRules;
  defaultPreset: DatePreset;
  conversationId?: string;
  signal?: AbortSignal;
  /** Per-turn cache for reads; cleared after every change. */
  memo: Map<string, Promise<unknown>>;
}

export interface ToolOutput {
  /** JSON-serialisable result returned to Claude. */
  result: unknown;
  /** One-line Danish summary shown on the tool card. */
  summary: string;
  preview?: ToolPreview;
  /** Rendered automatically in the chat. */
  visual?: VisualSpec;
}

export interface ExecutionResult {
  result: unknown;
  summary: string;
  undo?: UndoSpec;
  /** The lines that were confirmed applied (the activity log shows these instead of the plan). */
  changes?: ChangeLine[];
}

export interface PlannedChange {
  /** null = the call turned out to be read-only (generic API reads). */
  plan: ChangePlan | null;
  execute: () => Promise<ExecutionResult>;
}

interface BaseTool<S extends z.ZodType> {
  name: string;
  description: string;
  schema: S;
  /** Danish label for the tool card, e.g. "Henter kampagner". */
  label: (input: z.infer<S>) => string;
}

export interface ReadTool<S extends z.ZodType = z.ZodType> extends BaseTool<S> {
  kind: 'read' | 'display';
  run: (input: z.infer<S>, ctx: ToolContext) => Promise<ToolOutput>;
}

export interface WriteTool<S extends z.ZodType = z.ZodType> extends BaseTool<S> {
  kind: 'write';
  plan: (input: z.infer<S>, ctx: ToolContext) => Promise<PlannedChange>;
}

export type AnyTool = ReadTool | WriteTool;

export const defineRead = <S extends z.ZodType>(t: ReadTool<S>) => t as unknown as ReadTool;
export const defineWrite = <S extends z.ZodType>(t: WriteTool<S>) => t as unknown as WriteTool;

/* ------------------------------ shared helpers ------------------------------ */

export function memo<T>(ctx: ToolContext, key: string, fn: () => Promise<T>): Promise<T> {
  let p = ctx.memo.get(key) as Promise<T> | undefined;
  if (!p) {
    p = fn();
    ctx.memo.set(key, p);
    p.catch(() => ctx.memo.delete(key));
  }
  return p;
}

export const getCampaigns = (ctx: ToolContext) => memo(ctx, 'campaigns', () => ctx.backend.listCampaigns(ctx.accountId));

export async function getCampaign(ctx: ToolContext, id: string): Promise<Campaign> {
  const c = (await getCampaigns(ctx)).find((x) => x.id === String(id));
  if (!c) throw new Error(`Kampagne ${id} findes ikke på kontoen. Brug list_campaigns for at finde det rigtige id.`);
  return c;
}

export const getAdGroups = (ctx: ToolContext, campaignId: string) =>
  memo(ctx, `adgroups:${campaignId}`, () => ctx.backend.listAdGroups(ctx.accountId, campaignId));

export async function getAdGroup(ctx: ToolContext, campaignId: string, adGroupId: string) {
  const g = (await getAdGroups(ctx, campaignId)).find((x) => x.id === String(adGroupId));
  if (!g) throw new Error(`Annoncegruppe ${adGroupId} findes ikke i kampagne ${campaignId}. Brug list_ad_groups for at finde det rigtige id.`);
  return g;
}

export const getKeywords = (ctx: ToolContext, adGroupId: string) =>
  memo(ctx, `keywords:${adGroupId}`, () => ctx.backend.listKeywords(ctx.accountId, adGroupId));

export const getReport = (ctx: ToolContext, spec: ReportSpec): Promise<ReportRow[]> =>
  memo(ctx, `report:${JSON.stringify(spec)}`, () => ctx.backend.runReport(ctx.accountId, spec, ctx.signal));

export const PERIOD_DESCRIPTION =
  "Period: one of today, yesterday, last7, last14, last30, thisMonth, lastMonth, last90 – or a custom range 'YYYY-MM-DD..YYYY-MM-DD'. Defaults to the period selected in the app.";

export interface ResolvedPeriod extends DateRange {
  label: string;
}

export function resolvePeriod(period: string | undefined, ctx: ToolContext): ResolvedPeriod {
  const p = (period ?? '').trim();
  const custom = /^(\d{4}-\d{2}-\d{2})\s*(?:\.\.|to|–|--?)\s*(\d{4}-\d{2}-\d{2})$/.exec(p);
  if (custom) {
    const [from, to] = [custom[1]!, custom[2]!].sort() as [string, string];
    const end = to > today() ? today() : to;
    return { from, to: end, label: `${from} – ${end}` };
  }
  const preset = (p in DATE_PRESET_LABELS ? p : ctx.defaultPreset) as DatePreset;
  return { ...presetRange(preset), label: DATE_PRESET_LABELS[preset] };
}

/** Drops empty values so results sent to the model stay small. */
export function compact<T extends Record<string, unknown>>(row: T): Partial<T> {
  const out: Partial<T> = {};
  for (const [k, v] of Object.entries(row)) {
    if (v === undefined || v === null || v === '') continue;
    (out as Record<string, unknown>)[k] = v;
  }
  return out;
}

export function statusLabel(status: string | undefined): string {
  switch (status) {
    case 'Active':
      return 'Aktiv';
    case 'Paused':
      return 'Pauset';
    case 'Deleted':
      return 'Slettet';
    case 'BudgetPaused':
    case 'BudgetAndManualPaused':
      return 'Pauset (budget)';
    case 'Suspended':
      return 'Suspenderet';
    default:
      return status ?? '–';
  }
}
