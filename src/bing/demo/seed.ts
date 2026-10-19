/**
 * Demo account "Nordlys Interiør" – a Danish office furniture webshop. The structure
 * is mutable (the assistant can change it); the performance profiles are fixed and
 * turned into deterministic daily metrics by ./simulate.ts.
 */
import { addDays, today } from '@/lib/format';
import type { Account, Ad, AdGroup, Campaign, Keyword, NegativeKeyword } from '../types';

export const DEMO_ACCOUNTS: Account[] = [
  { id: '1000001', name: 'Nordlys Interiør', number: 'F120A7B9', customerId: '2000001', currency: 'DKK', status: 'Active', timeZone: 'BrusselsCopenhagenMadridParis' },
  { id: '1000002', name: 'Nordlys Outlet', number: 'F120A7C4', customerId: '2000001', currency: 'DKK', status: 'Active', timeZone: 'BrusselsCopenhagenMadridParis' },
];

/** Performance profile of the smallest simulated unit (a keyword, or an ad group without keywords). */
export interface UnitProfile {
  impressions: number;
  ctr: number;
  cpc: number;
  cvr: number;
  aov: number;
}

export interface SearchTermProfile {
  term: string;
  /** Share of the keyword's traffic. */
  share: number;
  /** Conversion-rate multiplier relative to the keyword. */
  cvr: number;
}

export interface DemoState {
  version: 1;
  campaigns: (Campaign & { accountId: string })[];
  adGroups: AdGroup[];
  keywords: Keyword[];
  ads: Ad[];
  negatives: Record<string, (NegativeKeyword & { addedAt: string })[]>;
  /** Entity id → first date it no longer delivers (paused/deleted). */
  pausedSince: Record<string, string>;
  /** Entity id → creation date (no history before it). */
  bornOn: Record<string, string>;
  /** Campaign id → budget changes over time. */
  budgetLog: Record<string, { date: string; budget: number }[]>;
  nextId: number;
}

export const UNIT_PROFILES: Record<string, UnitProfile> = {
  // Brand – cheap clicks, high intent
  k1001: { impressions: 210, ctr: 0.21, cpc: 2.2, cvr: 0.035, aov: 1400 },
  k1002: { impressions: 120, ctr: 0.12, cpc: 2.6, cvr: 0.025, aov: 1300 },
  k1003: { impressions: 60, ctr: 0.15, cpc: 2.4, cvr: 0.03, aov: 1600 },
  // Kontorstole – big and mixed
  k1101: { impressions: 520, ctr: 0.055, cpc: 6.5, cvr: 0.018, aov: 1900 },
  k1102: { impressions: 380, ctr: 0.048, cpc: 6, cvr: 0.015, aov: 1800 },
  k1103: { impressions: 1400, ctr: 0.031, cpc: 5.2, cvr: 0.007, aov: 1700 },
  k1104: { impressions: 210, ctr: 0.061, cpc: 5.5, cvr: 0.02, aov: 2400 },
  k1105: { impressions: 640, ctr: 0.039, cpc: 4, cvr: 0.004, aov: 900 },
  k1201: { impressions: 460, ctr: 0.044, cpc: 4.5, cvr: 0.009, aov: 1500 },
  k1202: { impressions: 900, ctr: 0.036, cpc: 3.8, cvr: 0.003, aov: 1300 },
  // Hæve-sænkeborde – budget-limited, strong ROAS
  k1301: { impressions: 700, ctr: 0.072, cpc: 7.5, cvr: 0.022, aov: 3200 },
  k1302: { impressions: 520, ctr: 0.064, cpc: 7, cvr: 0.02, aov: 3000 },
  k1303: { impressions: 430, ctr: 0.05, cpc: 6.5, cvr: 0.016, aov: 2800 },
  k1401: { impressions: 160, ctr: 0.058, cpc: 8, cvr: 0.018, aov: 3800 },
  // Konkurrenter – wasteful
  k1501: { impressions: 900, ctr: 0.026, cpc: 4.8, cvr: 0.003, aov: 1500 },
  k1502: { impressions: 640, ctr: 0.024, cpc: 4.5, cvr: 0.0035, aov: 1400 },
  k1503: { impressions: 300, ctr: 0.029, cpc: 6, cvr: 0.004, aov: 2600 },
  // Lamper (paused)
  k1601: { impressions: 260, ctr: 0.041, cpc: 2.6, cvr: 0.015, aov: 520 },
  k1602: { impressions: 190, ctr: 0.038, cpc: 2.4, cvr: 0.014, aov: 460 },
  // Ad groups without keywords: Shopping, Performance Max, Audience
  g107: { impressions: 9000, ctr: 0.012, cpc: 2.4, cvr: 0.012, aov: 1600 },
  g108: { impressions: 4100, ctr: 0.009, cpc: 3, cvr: 0.01, aov: 1700 },
  g109: { impressions: 3600, ctr: 0.004, cpc: 2, cvr: 0.006, aov: 1500 },
  // Outlet account
  k2001: { impressions: 340, ctr: 0.06, cpc: 2.8, cvr: 0.02, aov: 900 },
  k2002: { impressions: 280, ctr: 0.05, cpc: 2.4, cvr: 0.015, aov: 800 },
};

export const SEARCH_TERMS: Record<string, SearchTermProfile[]> = {
  k1001: [
    { term: 'nordlys interiør', share: 0.82, cvr: 1 },
    { term: 'nordlys interiør rabatkode', share: 0.18, cvr: 0.8 },
  ],
  k1002: [
    { term: 'nordlys møbler', share: 0.7, cvr: 1.1 },
    { term: 'nordlys møbler åbningstider', share: 0.3, cvr: 0.6 },
  ],
  k1003: [{ term: 'nordlys kontorstol', share: 1, cvr: 1 }],
  k1101: [
    { term: 'ergonomisk kontorstol', share: 0.75, cvr: 1.1 },
    { term: 'bedste ergonomiske kontorstol', share: 0.25, cvr: 0.8 },
  ],
  k1102: [
    { term: 'ergonomisk kontorstol med armlæn', share: 0.55, cvr: 1.1 },
    { term: 'ergonomisk kontorstol test', share: 0.45, cvr: 0.7 },
  ],
  k1103: [
    { term: 'kontorstol', share: 0.38, cvr: 1.3 },
    { term: 'kontorstol tilbud', share: 0.16, cvr: 1.6 },
    { term: 'brugt kontorstol', share: 0.14, cvr: 0 },
    { term: 'kontorstol ikea', share: 0.11, cvr: 0.2 },
    { term: 'kontorstol reservedele', share: 0.09, cvr: 0 },
    { term: 'gratis kontorstol', share: 0.07, cvr: 0 },
    { term: 'kontorstol job', share: 0.05, cvr: 0 },
  ],
  k1104: [{ term: 'kontorstol med nakkestøtte', share: 1, cvr: 1 }],
  k1105: [
    { term: 'billig kontorstol', share: 0.6, cvr: 1.2 },
    { term: 'billig kontorstol brugt', share: 0.4, cvr: 0 },
  ],
  k1201: [
    { term: 'gamingstol', share: 0.7, cvr: 1.1 },
    { term: 'gamingstol børn', share: 0.3, cvr: 0.6 },
  ],
  k1202: [
    { term: 'gaming stol', share: 0.45, cvr: 1.3 },
    { term: 'gaming stol ps5 spil', share: 0.2, cvr: 0 },
    { term: 'gaming stol reparation', share: 0.15, cvr: 0 },
    { term: 'gaming stol jysk', share: 0.2, cvr: 0.3 },
  ],
  k1301: [{ term: 'hæve sænkebord', share: 1, cvr: 1 }],
  k1302: [
    { term: 'hæve-sænkebord', share: 0.6, cvr: 1 },
    { term: 'hæve-sænkebord 160x80', share: 0.4, cvr: 1.2 },
  ],
  k1303: [
    { term: 'elektrisk skrivebord', share: 0.7, cvr: 1 },
    { term: 'elektrisk skrivebord gaming', share: 0.3, cvr: 0.8 },
  ],
  k1401: [{ term: 'hæve sænkebord hjørne', share: 1, cvr: 1 }],
  k1501: [
    { term: 'ikea kontorstol', share: 0.45, cvr: 0.6 },
    { term: 'ikea markus kontorstol', share: 0.35, cvr: 0.4 },
    { term: 'ikea kundeservice', share: 0.2, cvr: 0 },
  ],
  k1502: [
    { term: 'jysk kontorstol', share: 0.6, cvr: 0.7 },
    { term: 'jysk åbningstider', share: 0.4, cvr: 0 },
  ],
  k1503: [{ term: 'bilka hæve sænkebord', share: 1, cvr: 1 }],
  k1601: [{ term: 'skrivebordslampe', share: 1, cvr: 1 }],
  k1602: [{ term: 'led kontorlampe', share: 1, cvr: 1 }],
  k2001: [
    { term: 'kontorstol outlet', share: 0.7, cvr: 1 },
    { term: 'outlet møbler', share: 0.3, cvr: 0.8 },
  ],
  k2002: [{ term: 'brugte kontormøbler', share: 1, cvr: 1 }],
};

const rsa = (id: string, adGroupId: string, headlines: string[], descriptions: string[], url: string, path1: string): Ad => ({
  id,
  adGroupId,
  type: 'ResponsiveSearch',
  status: 'Active',
  headlines,
  descriptions,
  finalUrls: [url],
  path1,
  path2: null,
});

export function createSeedState(): DemoState {
  const A1 = '1000001';
  const A2 = '1000002';
  const campaigns: DemoState['campaigns'] = [
    { accountId: A1, id: '101', name: 'Brand – Nordlys', status: 'Active', type: 'Search', dailyBudget: 200, bidStrategy: { type: 'EnhancedCpc' }, languages: ['Danish'] },
    { accountId: A1, id: '102', name: 'Kontorstole – Generisk', status: 'Active', type: 'Search', dailyBudget: 1200, bidStrategy: { type: 'MaxConversions' }, languages: ['Danish'] },
    { accountId: A1, id: '103', name: 'Hæve-sænkeborde', status: 'Active', type: 'Search', dailyBudget: 400, bidStrategy: { type: 'TargetCpa', targetCpa: 350 }, languages: ['Danish'] },
    { accountId: A1, id: '104', name: 'Shopping – Alle produkter', status: 'Active', type: 'Shopping', dailyBudget: 600, bidStrategy: { type: 'MaxConversionValue', targetRoas: 6 }, languages: ['Danish'] },
    { accountId: A1, id: '105', name: 'Konkurrenter', status: 'Active', type: 'Search', dailyBudget: 200, bidStrategy: { type: 'EnhancedCpc' }, languages: ['Danish'] },
    { accountId: A1, id: '106', name: 'Kontorlamper', status: 'Paused', type: 'Search', dailyBudget: 100, bidStrategy: { type: 'EnhancedCpc' }, languages: ['Danish'] },
    { accountId: A1, id: '107', name: 'Performance Max – Bestsellere', status: 'Active', type: 'PerformanceMax', dailyBudget: 350, bidStrategy: { type: 'MaxConversionValue' }, languages: ['Danish'] },
    { accountId: A1, id: '108', name: 'Remarketing – Besøgende', status: 'Active', type: 'Audience', dailyBudget: 120, bidStrategy: { type: 'ManualCpc' }, languages: ['Danish'] },
    { accountId: A2, id: '201', name: 'Outlet – Kontormøbler', status: 'Active', type: 'Search', dailyBudget: 120, bidStrategy: { type: 'MaxClicks', maxCpc: 4 }, languages: ['Danish'] },
  ];

  const adGroups: AdGroup[] = [
    { id: '1010', campaignId: '101', name: 'Brand', status: 'Active', cpcBid: 2.5 },
    { id: '1020', campaignId: '102', name: 'Ergonomiske kontorstole', status: 'Active', cpcBid: 5.5 },
    { id: '1021', campaignId: '102', name: 'Gamingstole', status: 'Active', cpcBid: 4 },
    { id: '1030', campaignId: '103', name: 'Hæve-sænkeborde', status: 'Active', cpcBid: 6 },
    { id: '1031', campaignId: '103', name: 'Hjørneborde', status: 'Active', cpcBid: 6 },
    { id: '1050', campaignId: '105', name: 'Konkurrentnavne', status: 'Active', cpcBid: 4.5 },
    { id: '1060', campaignId: '106', name: 'Lamper', status: 'Active', cpcBid: 2.5 },
    { id: '1040', campaignId: '104', name: 'Alle produkter', status: 'Active', cpcBid: 2.2 },
    { id: '1070', campaignId: '107', name: 'Asset group – Bestsellere', status: 'Active', cpcBid: null },
    { id: '1080', campaignId: '108', name: 'Besøgende seneste 30 dage', status: 'Active', cpcBid: 2 },
    { id: '2010', campaignId: '201', name: 'Outlet', status: 'Active', cpcBid: 3 },
  ];

  const kw = (id: string, adGroupId: string, text: string, matchType: Keyword['matchType'], bid: number | null, qualityScore: number, status = 'Active'): Keyword => ({
    id,
    adGroupId,
    text,
    matchType,
    bid,
    qualityScore,
    status,
  });

  const keywords: Keyword[] = [
    kw('k1001', '1010', 'nordlys interiør', 'Exact', 2, 10),
    kw('k1002', '1010', 'nordlys møbler', 'Phrase', 2.5, 9),
    kw('k1003', '1010', 'nordlys kontorstol', 'Phrase', 2.5, 9),
    kw('k1101', '1020', 'ergonomisk kontorstol', 'Exact', 6, 8),
    kw('k1102', '1020', 'ergonomisk kontorstol', 'Phrase', 5.5, 7),
    kw('k1103', '1020', 'kontorstol', 'Broad', 4.5, 5),
    kw('k1104', '1020', 'kontorstol med nakkestøtte', 'Phrase', 5, 8),
    kw('k1105', '1020', 'billig kontorstol', 'Phrase', 3.5, 4),
    kw('k1201', '1021', 'gamingstol', 'Phrase', 4, 6),
    kw('k1202', '1021', 'gaming stol', 'Broad', 3.5, 4),
    kw('k1301', '1030', 'hæve sænkebord', 'Exact', 6.5, 9),
    kw('k1302', '1030', 'hæve-sænkebord', 'Phrase', 6, 8),
    kw('k1303', '1030', 'elektrisk skrivebord', 'Phrase', 5.5, 7),
    kw('k1401', '1031', 'hæve sænkebord hjørne', 'Phrase', 6.5, 8),
    kw('k1501', '1050', 'ikea kontorstol', 'Broad', 4.5, 3),
    kw('k1502', '1050', 'jysk kontorstol', 'Broad', 4, 3),
    kw('k1503', '1050', 'bilka hæve sænkebord', 'Phrase', 5, 4),
    kw('k1601', '1060', 'skrivebordslampe', 'Phrase', 2.5, 7),
    kw('k1602', '1060', 'led kontorlampe', 'Phrase', 2.5, 7),
    kw('k2001', '2010', 'kontorstol outlet', 'Phrase', 3, 8),
    kw('k2002', '2010', 'brugte kontormøbler', 'Phrase', 2.5, 7),
  ];

  const ads: Ad[] = [
    rsa('a101', '1010', ['Nordlys Interiør – Officiel', 'Fri fragt over 999 kr.', 'Dansk design til kontoret'], ['Kvalitetsmøbler til hjemmekontoret. 5 års garanti og 30 dages returret.', 'Besøg vores showroom i Aarhus eller køb online.'], 'https://nordlys-interior.dk', 'kontor'),
    rsa('a102', '1020', ['Ergonomiske Kontorstole', 'Testvinder 2026', 'Prøv stolen i 30 dage'], ['Find den rigtige ergonomiske kontorstol. Rådgivning fra fysioterapeut.', 'Fri fragt og levering på 1-3 hverdage.'], 'https://nordlys-interior.dk/kontorstole', 'kontorstole'),
    rsa('a103', '1020', ['Kontorstole fra 999 kr.', 'Stort udvalg på lager', 'Nordlys Interiør'], ['Over 120 kontorstole på lager. Hurtig levering i hele Danmark.', '5 års garanti på alle stole.'], 'https://nordlys-interior.dk/kontorstole', 'tilbud'),
    rsa('a104', '1021', ['Gamingstole i topkvalitet', 'Ergonomisk gaming', 'Fri fragt'], ['Gamingstole med ergonomisk støtte til lange sessioner.', 'Se udvalget online.'], 'https://nordlys-interior.dk/gamingstole', 'gaming'),
    rsa('a105', '1030', ['Hæve-sænkeborde', 'Elektriske borde fra 2.499 kr.', 'Levering på 2 dage'], ['Stille motor, 10 års garanti på stel. Mange størrelser og bordplader.', 'Gratis montering i Storkøbenhavn.'], 'https://nordlys-interior.dk/haeve-saenkeborde', 'borde'),
    rsa('a106', '1031', ['Hjørne hæve-sænkeborde', 'Plads til to skærme', 'Fri fragt'], ['L-formede elektriske skriveborde til hjemmekontoret.', 'Køb online i dag.'], 'https://nordlys-interior.dk/hjorneborde', 'hjorne'),
    rsa('a107', '1050', ['Alternativ til IKEA & JYSK', 'Bedre kvalitet – samme pris', 'Nordlys Interiør'], ['Sammenlign selv: kontorstole med 5 års garanti.', 'Fri fragt over 999 kr.'], 'https://nordlys-interior.dk/kontorstole', 'sammenlign'),
    rsa('a108', '1060', ['LED Kontorlamper', 'Skrivebordslamper', 'Fri fragt'], ['Lamper der skåner øjnene.', 'Mange modeller på lager.'], 'https://nordlys-interior.dk/lamper', 'lamper'),
    rsa('a201', '2010', ['Outlet – Kontormøbler', 'Op til 60 % rabat', 'Få styk tilbage'], ['Udstillingsmodeller og returvarer med fuld garanti.', 'Hent i Aarhus eller få leveret.'], 'https://nordlys-interior.dk/outlet', 'outlet'),
  ];

  return {
    version: 1,
    campaigns,
    adGroups,
    keywords,
    ads,
    negatives: {},
    // "Kontorlamper" was paused three weeks ago.
    pausedSince: { '106': addDays(today(), -21) },
    bornOn: {},
    budgetLog: {},
    nextId: 5000,
  };
}
