import { describe, expect, it } from 'vitest';
import { blocks, compareAds, compareExclusions, compareKeywords, compareNegatives, compareSearchTerms, exclusionsOf, normUrl, pairGroups } from '@/features/audit/compare';
import { bingDimension, type DListingNode, type DNegative } from '@/features/audit/detail';
import { toListingNodes } from '@/features/audit/bingDetail';

const node = (id: string, parentId: string | null, dim: string, value: string, o: Partial<DListingNode> = {}): DListingNode => ({ id, parentId, group: 'Alle produkter', unit: true, excluded: false, dim, value, ...o });

describe('excluded products', () => {
  // Google: all products → by item id: two excluded SKUs, everything else bid on.
  const google = [
    node('g1', null, 'all', '', { unit: false }),
    node('g2', 'g1', 'id', 'sku-100', { excluded: true }),
    node('g3', 'g1', 'id', 'sku-200', { excluded: true }),
    node('g4', 'g1', 'id', ''),
  ];

  it('finds the path to each excluded unit', () => {
    expect(exclusionsOf(google)).toEqual([
      { group: 'Alle produkter', path: [{ dim: 'id', value: 'sku-100' }] },
      { group: 'Alle produkter', path: [{ dim: 'id', value: 'sku-200' }] },
    ]);
  });

  it('lists what Google excludes and Bing does not', () => {
    const bing = [node('b1', null, 'all', '', { unit: false }), node('b2', 'b1', 'id', 'sku-100', { excluded: true }), node('b3', 'b1', 'id', '')];
    const r = compareExclusions(google, bing);
    expect(r.missingInBing.map((g) => g.path)).toEqual([[{ dim: 'id', value: 'sku-200' }]]);
    expect(r.covered).toBe(1);
    expect(r.googleTotal).toBe(2);
    expect(r.onlyInBing).toEqual([]);
  });

  it('counts a broader Bing exclusion as covering (a whole brand excluded)', () => {
    const g = [node('1', null, 'all', '', { unit: false }), node('2', '1', 'brand', 'acme', { unit: false }), node('3', '2', 'id', 'sku-1', { excluded: true }), node('4', '2', 'id', '')];
    const b = [node('1', null, 'all', '', { unit: false }), node('2', '1', 'brand', 'acme', { excluded: true }), node('3', '1', 'brand', '')];
    const r = compareExclusions(g, b);
    expect(r.missingInBing).toEqual([]);
    expect(r.onlyInBing.map((x) => x.path)).toEqual([[{ dim: 'brand', value: 'acme' }]]);
  });

  it('marks category exclusions as not comparable (Google names them by number)', () => {
    const g = [node('1', null, 'all', '', { unit: false }), node('2', '1', 'category1', '536', { excluded: true })];
    expect(compareExclusions(g, []).missingInBing[0]!.comparable).toBe(false);
  });

  it('reads Microsoft’s operands and works out units from the tree when Microsoft does not say', () => {
    expect(['All', 'Id', 'Brand', 'ProductType2', 'CustomLabel0', 'CategoryL3', 'Condition'].map(bingDimension)).toEqual(['all', 'id', 'brand', 'type2', 'label0', 'category3', 'condition']);
    const nodes = toListingNodes([
      { id: 'a', parentId: null, group: 'AG', unit: null, excluded: false, operand: 'All', attribute: '' },
      { id: 'b', parentId: 'a', group: 'AG', unit: null, excluded: true, operand: 'Id', attribute: 'SKU-100' },
    ]);
    expect(nodes.map((n) => [n.unit, n.dim, n.value])).toEqual([
      [false, 'all', ''],
      [true, 'id', 'sku-100'],
    ]);
  });
});

describe('negative keywords', () => {
  const g: DNegative[] = [
    { text: 'gratis', matchType: 'broad', level: 'list', listName: 'Generelle' },
    { text: 'brugt kontorstol', matchType: 'phrase', level: 'campaign' },
    { text: 'ikea', matchType: 'exact', level: 'campaign' },
    { text: 'gaming', matchType: 'phrase', level: 'adgroup', adGroupName: 'Kontorstole' },
  ];

  it('lists Google negatives Bing lacks, with what to add in Bing', () => {
    const b: DNegative[] = [
      { text: 'Gratis', matchType: 'phrase', level: 'campaign' },
      { text: 'ikea', matchType: 'phrase', level: 'list', listName: 'Konkurrenter' },
      { text: 'brugt kontorstol', matchType: 'exact', level: 'campaign' }, // exact does not cover Google's phrase
      { text: 'gaming', matchType: 'phrase', level: 'adgroup', adGroupName: 'Andet' }, // another ad group
      { text: 'leje', matchType: 'phrase', level: 'campaign' },
    ];
    const r = compareNegatives(g, b);
    expect(r.missingInBing.map((n) => [n.text, n.matchType, n.suggested, n.sources.join()])).toEqual([
      ['brugt kontorstol', 'phrase', 'phrase', 'Kampagne'],
      ['gaming', 'phrase', 'phrase', 'Annoncegruppe: Kontorstole'],
    ]);
    expect(r.covered).toBe(2);
    expect(r.onlyInBing.map((n) => n.text)).toEqual(['leje']);
  });

  it('suggests phrase for Google’s broad negatives (Bing has no broad negatives)', () => {
    expect(compareNegatives(g, []).missingInBing.find((n) => n.text === 'gratis')!.suggested).toBe('phrase');
  });

  it('knows what each match type stops', () => {
    expect(blocks({ text: 'gratis', matchType: 'broad' }, 'kontorstol gratis levering')).toBe(true);
    expect(blocks({ text: 'stol gratis', matchType: 'broad' }, 'gratis kontor stol')).toBe(true);
    expect(blocks({ text: 'stol gratis', matchType: 'phrase' }, 'gratis kontor stol')).toBe(false);
    expect(blocks({ text: 'kontor stol', matchType: 'phrase' }, 'billig kontor stol tilbud')).toBe(true);
    expect(blocks({ text: 'stol', matchType: 'phrase' }, 'kontorstol')).toBe(false); // whole words only
    expect(blocks({ text: 'ikea', matchType: 'exact' }, 'ikea stol')).toBe(false);
  });
});

describe('ad groups and keywords', () => {
  const google = {
    adGroups: [
      { id: '1', name: 'Ergonomiske kontorstole', status: 'active' },
      { id: '2', name: 'Gamingstole', status: 'active' },
    ],
    keywords: [
      { adGroupId: '1', text: 'ergonomisk kontorstol', matchType: 'exact' as const, status: 'active', metrics: { impressions: 1, clicks: 40, spend: 300, conversions: 6, revenue: 9000 } },
      { adGroupId: '1', text: 'kontorstol med nakkestøtte', matchType: 'phrase' as const, status: 'active', metrics: { impressions: 1, clicks: 9, spend: 90, conversions: 1, revenue: 1500 } },
      { adGroupId: '1', text: 'billig kontorstol', matchType: 'phrase' as const, status: 'paused' },
      { adGroupId: '2', text: 'gamerstol', matchType: 'broad' as const, status: 'active' },
    ],
  };
  const bing = {
    adGroups: [{ id: '10', name: 'Ergonomiske Kontorstole', status: 'active' }],
    keywords: [
      { adGroupId: '10', text: 'ergonomisk kontorstol', matchType: 'phrase' as const, status: 'active' },
      { adGroupId: '10', text: 'kontorstol sort', matchType: 'broad' as const, status: 'active' },
    ],
  };

  it('pairs ad groups by name, and leaves the unmatched ones alone', () => {
    expect(pairGroups(google.adGroups, bing.adGroups).map((p) => [p.google?.name ?? null, p.bing?.name ?? null])).toEqual([
      ['Ergonomiske kontorstole', 'Ergonomiske Kontorstole'],
      ['Gamingstole', null],
    ]);
  });

  it('lists active Google keywords Bing lacks – most converting first – and match type differences', () => {
    const r = compareKeywords(google, bing);
    expect(r.missingInBing.map((k) => [k.text, k.bingGroup])).toEqual([
      ['kontorstol med nakkestøtte', 'Ergonomiske Kontorstole'],
      ['gamerstol', null],
    ]);
    expect(r.matchTypeDiffs).toEqual([{ text: 'ergonomisk kontorstol', googleGroup: 'Ergonomiske kontorstole', bingGroup: 'Ergonomiske Kontorstole', google: ['exact'], bing: ['phrase'] }]);
    expect(r.onlyInBing.map((k) => k.text)).toEqual(['kontorstol sort']);
  });
});

describe('search terms', () => {
  const t = (term: string, clicks: number, spend: number, conversions: number) => ({ term, impressions: clicks * 10, clicks, spend, conversions, revenue: conversions * 1000 });

  it('finds terms that convert in Google but never show in Bing, and Bing spend Google excludes', () => {
    const google = [t('ergonomisk kontorstol', 50, 400, 5), t('kontorstol tilbud', 30, 200, 0), t('hæve sænkebord hvid', 20, 150, 2)];
    const bing = [t('ergonomisk kontorstol', 10, 80, 1), t('gratis kontorstol', 12, 60, 0), t('ikea kontorstol', 8, 40, 0)];
    const gNeg: DNegative[] = [
      { text: 'gratis', matchType: 'broad', level: 'list', listName: 'Generelle' },
      { text: 'ikea', matchType: 'phrase', level: 'campaign' },
    ];
    const bNeg: DNegative[] = [{ text: 'ikea', matchType: 'phrase', level: 'campaign' }];
    const r = compareSearchTerms(google, bing, gNeg, bNeg);
    expect(r.convertingOnlyInGoogle.map((x) => x.term)).toEqual(['hæve sænkebord hvid']);
    expect(r.excludedInGoogleOnly.map((x) => [x.term, x.negative.text])).toEqual([['gratis kontorstol', 'gratis']]);
  });
});

describe('ads', () => {
  it('lists the headlines and landing pages Google uses that Bing does not, per ad group', () => {
    const google = {
      adGroups: [{ id: '1', name: 'Kontorstole', status: 'active' }],
      ads: [{ adGroupId: '1', status: 'active', type: 'RESPONSIVE_SEARCH_AD', headlines: ['Fri fragt', 'Ergonomiske stole'], descriptions: ['Levering 1-2 dage'], finalUrls: ['https://www.shop.dk/kontorstole/?utm_source=g'] }],
    };
    const bing = {
      adGroups: [{ id: '9', name: 'Kontorstole', status: 'active' }],
      ads: [{ adGroupId: '9', status: 'active', type: 'ResponsiveSearch', headlines: ['fri fragt'], descriptions: [], finalUrls: ['https://shop.dk/stole'] }],
    };
    expect(compareAds(google, bing)).toEqual([
      {
        googleGroup: 'Kontorstole',
        bingGroup: 'Kontorstole',
        googleAds: 1,
        bingAds: 1,
        missingHeadlines: ['Ergonomiske stole'],
        missingDescriptions: ['Levering 1-2 dage'],
        urlsOnlyGoogle: ['shop.dk/kontorstole'],
        urlsOnlyBing: ['shop.dk/stole'],
      },
    ]);
    expect(normUrl('HTTPS://www.Shop.dk/a/#x')).toBe('shop.dk/a');
  });
});
