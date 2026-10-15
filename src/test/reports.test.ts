import { describe, expect, it } from 'vitest';
import { buildReportRequest, normalizeReportDate, normalizeReportRows } from '@/bing/reports';
import { extractErrorMessages } from '@/bing/client';
import { resolvePeriod } from '@/ai/tools/context';

describe('reports', () => {
  it('builds a summary request without TimePeriod', () => {
    const req = buildReportRequest('123', { kind: 'keyword', range: { from: '2026-10-01', to: '2026-10-07' }, aggregation: 'Summary', campaignIds: ['9'] });
    expect(req.Type).toBe('KeywordPerformanceReportRequest');
    expect(req.Columns).not.toContain('TimePeriod');
    expect(req.Scope).toEqual({ AccountIds: null, Campaigns: [{ AccountId: 123, CampaignId: 9 }] });
    expect((req.Time as { CustomDateRangeStart: unknown }).CustomDateRangeStart).toEqual({ Day: 1, Month: 10, Year: 2026 });
  });

  it('uses aggregation for hour of day', () => {
    const req = buildReportRequest('1', { kind: 'hourofday', range: { from: '2026-10-01', to: '2026-10-07' }, aggregation: 'Summary' });
    expect(req.Aggregation).toBe('HourOfDay');
    expect(req.Columns).toContain('TimePeriod');
  });

  it('normalises CSV rows', () => {
    const rows = normalizeReportRows('searchterm', [
      { TimePeriod: '10/7/2026', SearchQuery: 'kontorstol', Keyword: 'kontorstol', Impressions: '1,000', Clicks: '50', Spend: '200.5', Conversions: '2', Revenue: '1000' },
    ]);
    expect(rows[0]).toMatchObject({ date: '2026-10-07', searchTerm: 'kontorstol', impressions: 1000, clicks: 50, spend: 200.5, cpa: 100.25, roas: 4.99 });
    expect(normalizeReportDate('2026-01-02')).toBe('2026-01-02');
  });

  it('extracts nested Microsoft error messages', () => {
    const msgs = extractErrorMessages({ Errors: [{ Code: 1100, Message: 'Invalid campaign id' }], OperationErrors: [{ ErrorCode: 'CampaignIdInvalid', Message: 'Bad id' }] });
    expect(msgs).toEqual(['Invalid campaign id (1100)', 'Bad id (CampaignIdInvalid)']);
  });

  it('parses custom periods', () => {
    const ctx = { defaultPreset: 'last7' } as never;
    expect(resolvePeriod('2026-09-01..2026-09-30', ctx)).toMatchObject({ from: '2026-09-01', to: '2026-09-30' });
    expect(resolvePeriod(undefined, ctx).label).toBe('Seneste 7 dage');
  });
});
