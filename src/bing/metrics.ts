import { ratio, round } from '@/lib/utils';
import type { DerivedMetrics, Metrics } from './types';

export const EMPTY_METRICS: Metrics = { impressions: 0, clicks: 0, spend: 0, conversions: 0, revenue: 0 };

export function addMetrics(a: Metrics, b: Partial<Metrics>): Metrics {
  return {
    impressions: a.impressions + (b.impressions ?? 0),
    clicks: a.clicks + (b.clicks ?? 0),
    spend: a.spend + (b.spend ?? 0),
    conversions: a.conversions + (b.conversions ?? 0),
    revenue: a.revenue + (b.revenue ?? 0),
  };
}

export function sumMetrics(rows: Partial<Metrics>[]): Metrics {
  return rows.reduce<Metrics>((acc, r) => addMetrics(acc, r), { ...EMPTY_METRICS });
}

export function derive(m: Metrics): DerivedMetrics {
  const r = (v: number | null, d: number) => (v === null ? null : round(v, d));
  return {
    impressions: Math.round(m.impressions),
    clicks: Math.round(m.clicks),
    spend: round(m.spend, 2),
    conversions: round(m.conversions, 2),
    revenue: round(m.revenue, 2),
    ctr: r(ratio(m.clicks, m.impressions), 4),
    cpc: r(ratio(m.spend, m.clicks), 2),
    cpa: r(ratio(m.spend, m.conversions), 2),
    roas: r(ratio(m.revenue, m.spend), 2),
    convRate: r(ratio(m.conversions, m.clicks), 4),
  };
}

/** Relative change, e.g. 0.12 for +12 %. */
export function change(current: number | null, previous: number | null): number | null {
  if (current === null || previous === null || previous === 0) return null;
  return round((current - previous) / Math.abs(previous), 4);
}
