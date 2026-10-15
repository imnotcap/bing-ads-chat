/** Month-to-date spend, budget pacing and month-end forecast for one account. */
import { daysInMonth, monthKey, parseIso, presetRange, today } from '@/lib/format';
import type { AdsBackend, Campaign } from './types';

export interface SpendStatus {
  month: string;
  monthToDateSpend: number;
  monthToDateRevenue: number;
  monthToDateConversions: number;
  daysElapsed: number;
  daysLeftInMonth: number;
  totalActiveDailyBudget: number;
  activeCampaigns: number;
  /** Spend so far + current daily run-rate for the remaining days. */
  forecastByRunRate: number;
  /** Spend so far + all active daily budgets fully used for the remaining days (upper bound). */
  forecastByBudgets: number;
  monthlyBudget: number | null;
  shareOfMonthlyBudget: number | null;
}

const cache = new Map<string, { at: number; value: Promise<SpendStatus> }>();
const TTL = 10 * 60_000;

export function invalidateSpendCache() {
  cache.clear();
}

export function activeDailyBudget(campaigns: Campaign[]): number {
  return campaigns.filter((c) => c.status === 'Active').reduce((s, c) => s + (c.dailyBudget ?? 0), 0);
}

export function getSpendStatus(backend: AdsBackend, accountId: string, monthlyBudget: number | null): Promise<SpendStatus> {
  const key = `${backend.mode}:${accountId}:${monthlyBudget}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL) return hit.value;
  const value = computeSpendStatus(backend, accountId, monthlyBudget);
  cache.set(key, { at: Date.now(), value });
  value.catch(() => cache.delete(key));
  return value;
}

async function computeSpendStatus(backend: AdsBackend, accountId: string, monthlyBudget: number | null): Promise<SpendStatus> {
  const ref = today();
  const range = presetRange('thisMonth', ref);
  const [campaigns, rows] = await Promise.all([
    backend.listCampaigns(accountId),
    backend.runReport(accountId, { kind: 'account', range, aggregation: 'Summary' }),
  ]);
  const spend = rows.reduce((s, r) => s + (r.spend ?? 0), 0);
  const revenue = rows.reduce((s, r) => s + (r.revenue ?? 0), 0);
  const conversions = rows.reduce((s, r) => s + (r.conversions ?? 0), 0);
  const dayOfMonth = parseIso(ref).getDate();
  const totalDays = daysInMonth(ref);
  // Today is still running: count it as half a day for the run-rate.
  const elapsed = Math.max(0.5, dayOfMonth - 0.5);
  const left = totalDays - dayOfMonth + 0.5;
  const budgets = activeDailyBudget(campaigns);
  return {
    month: monthKey(ref),
    monthToDateSpend: spend,
    monthToDateRevenue: revenue,
    monthToDateConversions: conversions,
    daysElapsed: dayOfMonth,
    daysLeftInMonth: Math.round(left * 10) / 10,
    totalActiveDailyBudget: budgets,
    activeCampaigns: campaigns.filter((c) => c.status === 'Active').length,
    forecastByRunRate: spend + (spend / elapsed) * left,
    forecastByBudgets: spend + budgets * left,
    monthlyBudget,
    shareOfMonthlyBudget: monthlyBudget ? spend / monthlyBudget : null,
  };
}
