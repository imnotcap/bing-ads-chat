import { describe, expect, it } from 'vitest';
import { applyOp, parseOp } from '@/features/audit/ops';
import { nameScore, suggestMatch } from '@/features/audit/match';
import { AUDIT_STEPS, progressOf, type CampaignAudit } from '@/features/audit/steps';
import { changeAudit, readAudits, type AuditStorage } from '../../cloudflare/src/audit';

function memoryStorage(): AuditStorage & { data: Map<string, unknown> } {
  const data = new Map<string, unknown>();
  return {
    data,
    get: async <T,>(k: string) => data.get(k) as T | undefined,
    put: async <T,>(k: string, v: T) => void data.set(k, structuredClone(v)),
    list: async <T,>({ prefix }: { prefix: string }) => new Map([...data].filter(([k]) => k.startsWith(prefix)) as [string, T][]),
  };
}

describe('the audit checklist', () => {
  it('has the team’s 21 steps, in order', () => {
    expect(AUDIT_STEPS).toHaveLength(21);
    expect(AUDIT_STEPS[0]!.title).toBe('Afklar kampagnematch');
    expect(AUDIT_STEPS[14]!.title).toBe('Shopping og produkter');
    expect(AUDIT_STEPS.at(-1)!.title).toBe('Opfølgning');
  });

  it('counts only the steps that apply to the kind of campaign', () => {
    // Search: no Shopping and no PMax step. Shopping: no keywords and no PMax.
    expect(progressOf(undefined, 'Search')).toEqual({ done: 0, total: 19 });
    expect(progressOf(undefined, 'Shopping')).toEqual({ done: 0, total: 19 });
    expect(progressOf(undefined, 'PerformanceMax')).toEqual({ done: 0, total: 20 });
    const audit: CampaignAudit = { bingId: '1', steps: { match: { status: 'done', by: 'A', at: 1 }, devices: { status: 'na', by: 'A', at: 1 } } };
    expect(progressOf(audit, 'Search')).toEqual({ done: 2, total: 19 });
  });

  it('checks every change before it is stored', () => {
    expect(parseOp({ type: 'step', bingId: '1', step: 'budget', status: 'done' })).toEqual({ type: 'step', bingId: '1', step: 'budget', status: 'done' });
    expect(parseOp({ type: 'step', bingId: '1', step: 'nope', status: 'done' })).toBe('Ukendt trin.');
    expect(parseOp({ type: 'step', bingId: '1', step: 'budget', status: 'maybe' })).toBe('Ugyldig status.');
    expect(parseOp({ type: 'match', bingId: 'abc', googleId: '2' })).toBe('Ugyldigt kampagne-id.');
    expect(parseOp({ type: 'match', bingId: '1', googleId: 'x' })).toBe('Ugyldigt Google-kampagne-id.');
    expect(parseOp({ type: 'note', bingId: '1', text: 'x'.repeat(4001) })).toMatch(/højst/);
    expect(parseOp({ type: 'drop', bingId: '1' })).toBe('Ukendt ændring.');
  });

  it('marks the first step done when the match is decided – also "no counterpart"', () => {
    const a = applyOp(undefined, { type: 'match', bingId: '1', googleId: null }, 'Casper', 5);
    expect(a.googleId).toBeNull();
    expect(a.steps.match).toEqual({ status: 'done', by: 'Casper', at: 5 });
    const b = applyOp(a, { type: 'unmatch', bingId: '1' }, 'Casper', 6);
    expect(b.googleId).toBeUndefined();
    expect(b.steps.match).toBeUndefined();
    expect(a.steps.match).toBeDefined(); // the old one is untouched
  });

  it('keeps two people’s ticks apart and stores one entry per campaign', async () => {
    const storage = memoryStorage();
    await changeAudit(storage, { type: 'step', bingId: '7', step: 'budget', status: 'done' }, 'A', 1);
    await changeAudit(storage, { type: 'step', bingId: '7', step: 'geo', status: 'na' }, 'B', 2);
    await changeAudit(storage, { type: 'note', bingId: '8', text: '  Udelukkede varer mangler  ' }, 'A', 3);
    await changeAudit(storage, { type: 'step', bingId: '7', step: 'budget', status: null }, 'B', 4);
    const audits = await readAudits(storage);
    expect([...storage.data.keys()].sort()).toEqual(['audit:c:7', 'audit:c:8']);
    expect(audits.find((a) => a.bingId === '7')!.steps).toEqual({ geo: { status: 'na', by: 'B', at: 2 } });
    expect(audits.find((a) => a.bingId === '8')!.note).toEqual({ text: 'Udelukkede varer mangler', by: 'A', at: 3 });
  });
});

describe('suggested matches', () => {
  const google = [
    { id: '1', name: 'DK | Shopping | Kontorstole', channel: 'SHOPPING' },
    { id: '2', name: 'DK | Søg | Kontorstole', channel: 'SEARCH' },
    { id: '3', name: 'DK | PMax | Alle produkter', channel: 'PERFORMANCE_MAX' },
  ];

  it('finds the campaign with the same name, ignoring platform words', () => {
    expect(nameScore('Bing - DK | Shopping | Kontorstole', 'DK | Shopping | Kontorstole')).toBe(1);
    expect(suggestMatch({ name: 'DK | Shopping | Kontorstole', type: 'Shopping' }, google)?.googleId).toBe('1');
    expect(suggestMatch({ name: 'MSA DK | Søg | Kontorstole', type: 'Search' }, google)?.googleId).toBe('2');
  });

  it('lets the kind of campaign break a tie', () => {
    expect(suggestMatch({ name: 'DK Kontorstole', type: 'Search' }, google)?.googleId).toBe('2');
    expect(suggestMatch({ name: 'DK Kontorstole', type: 'Shopping' }, google)?.googleId).toBe('1');
  });

  it('suggests nothing rather than a weak guess', () => {
    expect(suggestMatch({ name: 'Brand', type: 'Search' }, google)).toBeNull();
  });
});
