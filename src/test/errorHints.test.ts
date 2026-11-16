import { describe, expect, it } from 'vitest';
import { callKey, errorHint, withHint } from '@/ai/errorHints';

describe('what a failed call means – for the assistant', () => {
  it('explains an expired ad group: leave it alone', () => {
    const out = withHint('Microsoft Advertising (400): Operation not valid for an expired ad group (CampaignServiceAdGroupExpired)');
    expect(out).toMatch(/shows nothing and nothing in it can be changed/);
    expect(out).toMatch(/Do not retry/);
  });
  it('knows credentials, throttling, duplicates and stale ids', () => {
    expect(errorHint('InvalidCredentials (105)')).toMatch(/Forbindelser/);
    expect(errorHint('CallRateExceeded (117)')).toMatch(/throttling/);
    expect(errorHint('The keyword already exists (1542)')).toMatch(/already exists/);
    expect(errorHint('Annoncegruppe 9 findes ikke i kampagne 1')).toMatch(/Read the list again/);
  });
  it('adds nothing to a rejection or a rule block, and a default to the rest', () => {
    const rejected = 'The user REJECTED this change – nothing was changed.';
    expect(withHint(rejected)).toBe(rejected);
    expect(withHint('Noget gik galt')).toMatch(/Do not repeat the same call unchanged/);
  });
  it('gives the same key to the same call', () => {
    expect(callKey('update_ads', { a: 1 })).toBe(callKey('update_ads', { a: 1 }));
    expect(callKey('update_ads', { a: 1 })).not.toBe(callKey('update_ads', { a: 2 }));
  });
});
