import { describe, expect, it } from 'vitest';
import { extractClaims, issueLines, nearDuplicates, plain, reviewAd, unfillablePositions, type Pin, type ReviewInput } from '@/ai/adCopy';

/** An ad that follows the advice: varied, backed by the page, the keywords in it, pinned lightly. */
const GOOD: ReviewInput = {
  headlines: ['Kontorstole', 'Ergonomiske kontorstole', 'Se hele udvalget', 'Fri fragt over 499 kr', 'Levering på 1-2 hverdage', '30 dages returret', 'Kontorstole til ryggen', 'Stole med nakkestøtte', 'Test din stol hos os', 'Få hjælp af en rådgiver'],
  headlinePins: [1, null, null, null, null, null, null, null, null, null],
  descriptions: ['Find stolen, der passer til din ryg. Kontorstole fra kendte mærker.', 'Fri fragt ved køb over 499 kr. ekskl. moms – hurtig levering.', 'Prøv stolen i 30 dage, og send den tilbage, hvis den ikke passer.', 'Få en gratis rådgivning, og se vores udvalg af ergonomiske stole.'],
  keywords: [{ text: 'kontorstol', weight: 50 }, { text: 'ergonomisk kontorstol', weight: 30 }, { text: 'kontorstol med nakkestøtte', weight: 10 }],
  evidence: [
    { claim: 'Fri fragt over 499 kr', quote: 'Fri fragt ved køb over 499 kr.' },
    { claim: 'Levering 1-2 hverdage', quote: 'Levering: 1-2 hverdage' },
    { claim: '30 dages returret', quote: '30 dages returret på alle stole' },
    { claim: 'gratis rådgivning', quote: 'Gratis rådgivning – ring eller skriv' },
  ],
  existing: [{ headlines: ['Billige skriveborde', 'Køb skriveborde'], descriptions: [], enabled: true }],
};
const codes = (r: ReturnType<typeof reviewAd>, ...levels: string[]) => r.issues.filter((i) => levels.includes(i.level)).map((i) => i.code);

describe('an ad that follows the evidence', () => {
  it('has nothing to correct – only the tip about a second ad, because the group has one', () => {
    const r = reviewAd(GOOD);
    expect(codes(r, 'error', 'warning')).toEqual([]);
    expect(codes(r, 'tip')).toEqual(['second_ad']);
    expect(r.claims.every((c) => c.supported)).toBe(true);
    expect(r.keywordCoverage).toMatchObject({ total: 3, covered: 3 });
  });
});

describe('pinning', () => {
  it('knows which positions nothing can fill', () => {
    expect(unfillablePositions([1, 1, 1], 3)).toEqual([2, 3]);
    expect(unfillablePositions([1, null, null], 3)).toEqual([]);
    expect(unfillablePositions([1, 2, 3], 3)).toEqual([]);
    expect(unfillablePositions([1, 1, 2], 3)).toEqual([3]);
    expect(unfillablePositions([1, 2], 2)).toEqual([]);
  });

  it('refuses an ad where every headline is pinned to position 1', () => {
    const r = reviewAd({ ...GOOD, headlinePins: GOOD.headlines.map(() => 1 as Pin) });
    expect(codes(r, 'error')).toContain('pin_headlines');
  });

  it('warns about many pins, and tips about pinned descriptions', () => {
    const r = reviewAd({ ...GOOD, headlinePins: [1, 2, 3, 1, null, null, null, null, null, null], descriptionPins: [1, null, null, null] });
    expect(codes(r, 'warning')).toContain('many_pins');
    expect(codes(r, 'tip')).toContain('pinned_descriptions');
  });

  it('refuses descriptions that are all pinned to the same position', () => {
    const r = reviewAd({ ...GOOD, descriptionPins: [1, 1, 1, 1] });
    expect(codes(r, 'error')).toContain('pin_descriptions');
  });
});

describe('structure', () => {
  it('asks for more headlines than five – Microsoft recommends 8–10 different ones', () => {
    const r = reviewAd({ ...GOOD, headlines: GOOD.headlines.slice(0, 5), headlinePins: [1, null, null, null, null] });
    expect(codes(r, 'warning')).toContain('few_headlines');
  });

  it('finds headlines that say the same thing, but not ones that only share a word', () => {
    expect(nearDuplicates(['Køb kontorstole online', 'Køb kontorstole', 'Køb skriveborde'])).toEqual([['Køb kontorstole online', 'Køb kontorstole']]);
    expect(nearDuplicates(['Kontorstole', 'Kontorstole til kontoret'])).toEqual([]);
    expect(nearDuplicates(['Ergonomiske kontorstole', 'Ergonomisk kontorstol'])).toHaveLength(1);
  });

  it('tips about few short headlines and about a description that repeats a headline', () => {
    const r = reviewAd({ ...GOOD, headlines: GOOD.headlines.map((h) => `${h} her hos os alle dage`), descriptions: ['Se hele udvalget her hos os alle dage nu', ...GOOD.descriptions.slice(1)] });
    expect(codes(r, 'tip')).toContain('few_short_headlines');
    expect(codes(r, 'tip')).toContain('description_repeats_headline');
  });
});

describe('wording Microsoft rejects', () => {
  const bad = (headlines: string[]) => reviewAd({ ...GOOD, headlines: [...GOOD.headlines.slice(0, 10 - headlines.length), ...headlines] });

  it('warns about shouting, urgency, phone numbers and repeated words – one "!" per sentence is allowed, "!!" is not', () => {
    expect(codes(bad(['Køb nu!']), 'warning')).not.toContain('exclamation');
    expect(codes(bad(['Køb nu!']), 'tip')).toContain('exclamation');
    expect(codes(bad(['Køb nu!!']), 'error')).toContain('repeated_punctuation');
    expect(codes(bad(['Vil du spare?!']), 'error')).toContain('repeated_punctuation');
    expect(codes(bad(['KØB DE BEDSTE STOLE']), 'warning')).toContain('caps');
    expect(codes(bad(['Sidste chance for rabat']), 'warning')).toContain('urgency');
    expect(codes(bad(['Ring 12 34 56 78']), 'warning')).toContain('phone');
    expect(codes(bad(['Køb køb stole']), 'warning')).toContain('repeated_words');
    expect(codes(bad(['Bedste kontorstole']), 'warning')).toContain('superlative');
  });

  it('lets the brand stand in capitals', () => {
    const r = reviewAd({ ...GOOD, brand: 'Ikea', headlines: [...GOOD.headlines.slice(0, 9), 'IKEA kontorstole'] });
    expect(codes(r, 'warning')).not.toContain('caps');
  });

  it('reads dynamic text as its default', () => {
    expect(plain('{KeyWord:Kontorstole}')).toBe('Kontorstole');
    expect(plain('Køb {KeyWord:stole} nu')).toBe('Køb stole nu');
  });

  it('reads a countdown as the time left – its colons are not a default text', () => {
    expect(plain('Black Week slutter om {COUNTDOWN(2026-11-27 23:59:59,5)}')).toBe('Black Week slutter om X dage');
    expect(plain('{GLOBAL_COUNTDOWN(2026-11-27 23:59:59,5)} tilbage')).toBe('X dage tilbage');
  });

  it('allows one price or percentage per text, and says so when the ad mixes them', () => {
    expect(codes(bad(['Spar 25 % – nu 50 %']), 'warning')).toContain('one_price');
    expect(codes(bad(['Nu 899 kr før 1.299 kr']), 'warning')).toContain('one_price');
    expect(codes(bad(['Spar 25 % i dag', 'Fra 499 kr']), 'tip')).toContain('one_price');
    expect(codes(bad(['Spar 25 % i dag']), 'warning')).not.toContain('one_price');
  });

  it('refuses æ/ø/å in the final URL and paths, and a display URL over 67 characters', () => {
    expect(codes(reviewAd({ ...GOOD, finalUrl: 'https://shop.dk/møbler' }), 'error')).toContain('ascii_url');
    expect(codes(reviewAd({ ...GOOD, finalUrl: 'https://shop.dk/x', path1: 'Kontormøbler' }), 'error')).toContain('ascii_url');
    expect(codes(reviewAd({ ...GOOD, finalUrl: 'https://shop.dk/moebler', path1: 'Kontormobler' }), 'error')).toEqual([]);
    const long = 'https://www.' + 'a'.repeat(45) + '.dk/x';
    expect(codes(reviewAd({ ...GOOD, finalUrl: long, path1: 'Kontorstole', path2: 'Ergonomiske' }), 'error')).toContain('display_url_length');
  });
});

describe('claims need proof from the landing page', () => {
  it('finds numbers with a unit and promises, once each', () => {
    const claims = extractClaims(['Fri fragt over 499 kr', '30 dages returret', 'Levering 1-2 dage', 'Fri fragt']);
    expect(claims.map((c) => c.text)).toEqual(['499 kr', 'Fri fragt', '30 dages', 'returret', '2 dage']);
  });

  it('says nothing is checked when no evidence is given', () => {
    const r = reviewAd({ ...GOOD, evidence: undefined });
    expect(codes(r, 'warning')).toContain('claims_unchecked');
    expect(r.claims.every((c) => !c.supported)).toBe(true);
  });

  it('does not accept a quote with another number, or the number without its unit', () => {
    const wrongNumber = reviewAd({ ...GOOD, evidence: [{ claim: 'x', quote: 'Fri fragt ved køb over 599 kr.' }] });
    expect(wrongNumber.claims.find((c) => c.text === '499 kr')!.supported).toBe(false);
    const noUnit = reviewAd({ ...GOOD, evidence: [{ claim: 'x', quote: 'Varenummer 499 – fri fragt' }] });
    expect(noUnit.claims.find((c) => c.text === '499 kr')!.supported).toBe(false);
    expect(noUnit.claims.find((c) => c.text === 'Fri fragt')!.supported).toBe(true);
    expect(codes(wrongNumber, 'warning')).toContain('claims_unbacked');
  });

  it('tips about VAT when a price is named without it', () => {
    const r = reviewAd({ ...GOOD, descriptions: GOOD.descriptions.map((d) => d.replace('ekskl. moms ', '')) });
    expect(codes(r, 'tip')).toContain('vat');
    expect(codes(reviewAd(GOOD), 'tip')).not.toContain('vat');
  });
});

describe('the keywords the ad is for', () => {
  it('warns when the ad leaves out most of the ad group’s keywords (weighted by clicks)', () => {
    const r = reviewAd({ ...GOOD, headlines: ['Skriveborde', 'Hæve sænkeborde', 'Se hele udvalget', 'Fri fragt over 499 kr', '30 dages returret', 'Levering på 1-2 hverdage', 'Elektriske skriveborde', 'Borde til kontoret'], headlinePins: undefined, descriptions: ['Find det rigtige bord.', 'Fri fragt ved køb over 499 kr. ekskl. moms.'] });
    expect(codes(r, 'warning')).toContain('keyword_coverage');
    expect(r.keywordCoverage!.uncovered[0]).toBe('kontorstol');
  });

  it('counts a plural or a longer form as the same word', () => {
    const r = reviewAd({ ...GOOD, keywords: [{ text: 'kontorstole' }, { text: 'ergonomiske kontorstol' }, { text: 'nakkestøtte' }] });
    expect(r.keywordCoverage!.covered).toBe(3);
  });

  it('lists the angles the ad does not use', () => {
    const r = reviewAd({ ...GOOD, headlines: ['Kontorstole', 'Ergonomiske kontorstole', 'Kontorstole til ryggen', 'Stole med nakkestøtte', 'Stole til kontoret', 'Stole til hjemmekontoret', 'Gaming stole', 'Stole i sort'], descriptions: ['Kontorstole til enhver smag.', 'Stole i mange farver.', 'Mange modeller at vælge imellem.', 'Stole til ryg og nakke.'], evidence: [] });
    expect(r.missingAngles).toEqual(['offer', 'trust', 'cta']);
    expect(codes(r, 'tip')).toContain('angles');
  });
});

describe('the other ads in the ad group', () => {
  const ad = (headlines: string[], enabled = true) => ({ headlines, descriptions: [], enabled });

  it('warns when the group is full – Microsoft allows three running responsive ads', () => {
    const r = reviewAd({ ...GOOD, existing: [ad(['A b']), ad(['C d']), ad(['E f'])] });
    expect(codes(r, 'warning')).toContain('ad_limit');
    expect(codes(reviewAd({ ...GOOD, existing: [ad(['A b']), ad(['C d']), ad(['E f'], false)] }), 'warning')).not.toContain('ad_limit');
  });

  it('warns when most headlines are already in a running ad, and tips about a different angle otherwise', () => {
    expect(codes(reviewAd({ ...GOOD, existing: [ad(GOOD.headlines.slice(0, 7))] }), 'warning')).toContain('like_existing');
    expect(codes(reviewAd({ ...GOOD, existing: [ad(['Billige skriveborde'])] }), 'tip')).toContain('second_ad');
    expect(codes(reviewAd({ ...GOOD, existing: [] }), 'tip')).toContain('first_ad');
  });

  it('puts the errors first, and hands out the lines for the card', () => {
    const r = reviewAd({ ...GOOD, headlines: GOOD.headlines.slice(0, 5), headlinePins: [1, 1, 1, 1, 1] });
    expect(r.issues[0]!.level).toBe('error');
    expect(issueLines(r).length).toBeGreaterThanOrEqual(2);
    expect(issueLines(r, ['tip']).every((t) => typeof t === 'string')).toBe(true);
  });
});
