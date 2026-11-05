import { describe, expect, it } from 'vitest';
import { settingsFacts } from '@/features/audit/settings';

const m = (impressions: number, clicks: number, spend: number, conversions: number, revenue: number) => ({ impressions, clicks, spend, conversions, revenue });

describe('the campaign setup, side by side', () => {
  // The Shopping campaign from the audit: Mål-ROAS 4 on both sides, 30 days.
  const facts = settingsFacts({
    currency: 'DKK',
    days: 30,
    microsoft: { bidStrategy: { type: 'TargetRoas', targetRoas: 4 }, dailyBudget: 375, metrics: m(26163, 95, 1488, 0, 1387), impressionShare: 22, lostToBudget: 2, lostToRank: 76 },
    google: { bidStrategy: 'TARGET_ROAS', targetRoas: 4, targetCpa: null, dailyBudget: 2000, metrics: m(183589, 2080, 33858, 37.3, 112591) },
  });
  const all = facts.join('\n');

  it('says the strategy is the same, and that Microsoft is far from its target', () => {
    expect(facts[0]).toBe('Samme budstrategi begge steder (Mål-ROAS (4)).');
    expect(all).toMatch(/Microsoft når ROAS 0,93 mod målet 4,00 – et godt stykke under/);
  });

  it('says there is too little data for the strategy, and what holds it back', () => {
    expect(all).toMatch(/Kun 0 konverteringer pr\. 30 dage i Microsoft – under de 15/);
    expect(all).toMatch(/mister 76 % af de mulige visninger på rang/);
    expect(all).not.toMatch(/på budget\./);
    expect(all).toMatch(/bruger kun 13 % af dagsbudgettet/);
  });

  it('compares price and pull per click with Google', () => {
    expect(all).toMatch(/Gns\. CPC: Microsoft 15,66\s?kr\., Google 16,28\s?kr\./);
    expect(all).toMatch(/CTR er 0,36 % i Microsoft mod 1,13 % i Google/);
  });

  it('names a different strategy or target', () => {
    const f = settingsFacts({
      currency: 'DKK',
      days: 30,
      microsoft: { bidStrategy: { type: 'MaxClicks' }, dailyBudget: 100, metrics: m(1000, 50, 2900, 3, 9000), impressionShare: null, lostToBudget: 35, lostToRank: null },
      google: { bidStrategy: 'MAXIMIZE_CONVERSION_VALUE', targetRoas: 5, targetCpa: null, dailyBudget: 300, metrics: m(1, 1, 1, 1, 1) },
    });
    expect(f[0]).toBe('Forskellig budstrategi: Microsoft Maksimér klik, Google Maksimér konverteringsværdi.');
    expect(f.join('\n')).toMatch(/mister 35 % af de mulige visninger på budget/);
    expect(f.join('\n')).toMatch(/budgettet er fuldt brugt/);
  });
});
