/**
 * Reviews a responsive search ad before it is made: what Microsoft requires, what it
 * rejects, and what – from the studies and tests we could find – tends to perform.
 *
 * Three levels, so nothing is stated as stronger than its evidence:
 * - error: Microsoft would refuse it (or the ad could not serve as written).
 * - warning: a real risk – a rejection, a claim nobody has backed, an ad that does not fit
 *   the keywords it is for.
 * - tip: practitioner advice (Optmyzr, Adalysis, Microsoft's own recommendations) – it
 *   improves the odds, it is not a rule, and some of it rests on vendor studies.
 *
 * Pure functions, so the rules can be tested. Used by the review_ad_copy tool (the
 * assistant checks a draft before proposing it) and by create_responsive_search_ad (the
 * same check, shown on the approval card).
 */

export type Pin = 1 | 2 | 3 | null;
export type Level = 'error' | 'warning' | 'tip';

export interface Issue {
  level: Level;
  code: string;
  text: string;
}

export type Angle = 'keyword' | 'offer' | 'delivery' | 'trust' | 'cta' | 'brand';

export interface EvidenceItem {
  /** The claim as it is written in the ad, e.g. "Fri fragt over 499 kr". */
  claim: string;
  /** A short quote from the landing page that backs it, e.g. "Fri fragt ved køb over 499 kr.". */
  quote: string;
  url?: string;
}

export interface ReviewInput {
  headlines: string[];
  headlinePins?: Pin[];
  descriptions: string[];
  descriptionPins?: Pin[];
  /** The ad group's active keywords; `weight` is how much each matters (clicks, say). */
  keywords?: { text: string; weight?: number }[];
  /** The other ads in the ad group. */
  existing?: { headlines: string[]; descriptions: string[]; enabled: boolean }[];
  evidence?: EvidenceItem[];
  brand?: string;
}

export interface Claim {
  text: string;
  supported: boolean;
}

export interface Review {
  issues: Issue[];
  headlineCount: number;
  shortHeadlines: number;
  /** Which of the angles each headline/description carries. */
  angles: Record<Angle, string[]>;
  missingAngles: Angle[];
  keywordCoverage: { total: number; covered: number; share: number; uncovered: string[] } | null;
  claims: Claim[];
}

/* --------------------------------- text helpers --------------------------------- */

/** Dynamic text ({KeyWord:Default}) counts – and reads – as its default text. */
export const plain = (text: string) => text.replace(/\{[^}:]*:([^}]*)\}/g, '$1').trim();

const words = (text: string) => plain(text).toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean);

const STOP = new Set(['til', 'med', 'og', 'i', 'på', 'for', 'af', 'en', 'et', 'den', 'det', 'de', 'at', 'som', 'fra', 'om', 'the', 'and', 'of', 'to', 'a']);
const content = (text: string) => words(text).filter((w) => !STOP.has(w));

/** Two words are the same word for our purposes: equal, or one the other's start (kontorstol / kontorstole). */
function sameWord(a: string, b: string): boolean {
  if (a === b) return true;
  const [short, long] = a.length <= b.length ? [a, b] : [b, a];
  return short.length >= 4 && long.length - short.length <= 3 && long.startsWith(short);
}

const hasWord = (list: string[], w: string) => list.some((x) => sameWord(x, w));

/** Share of the smaller text's words the other one has (1 = one is inside the other). */
function overlap(a: string, b: string): number {
  const wa = content(a);
  const wb = content(b);
  if (!wa.length || !wb.length) return 0;
  const [small, big] = wa.length <= wb.length ? [wa, wb] : [wb, wa];
  return small.filter((w) => hasWord(big, w)).length / small.length;
}

const jaccard = (a: string, b: string): number => {
  const wa = new Set(content(a));
  const wb = new Set(content(b));
  if (!wa.size || !wb.size) return 0;
  const inter = [...wa].filter((w) => [...wb].some((x) => sameWord(w, x))).length;
  return inter / (wa.size + wb.size - inter);
};

/** Headlines that say (nearly) the same thing – the second one adds no combination worth testing. */
export function nearDuplicates(texts: string[]): [string, string][] {
  const out: [string, string][] = [];
  for (let i = 0; i < texts.length; i++)
    for (let j = i + 1; j < texts.length; j++) {
      const a = texts[i]!;
      const b = texts[j]!;
      const small = Math.min(content(a).length, content(b).length);
      // Same words, or one is inside the other (with at least two words, so "Køb" alone is not "inside" everything).
      if (jaccard(a, b) >= 0.75 || (small >= 2 && overlap(a, b) === 1)) out.push([a, b]);
    }
  return out;
}

/* ----------------------------------- pinning ----------------------------------- */

/**
 * Microsoft needs at least one headline that may show in each position (1–3), and one
 * description for each position (1–2): a headline pinned to a position can only show there,
 * an unpinned one anywhere. Returns the positions nothing can fill.
 */
export function unfillablePositions(pins: Pin[], positions: number): number[] {
  const out: number[] = [];
  for (let p = 1; p <= positions; p++) if (!pins.some((x) => x === null || x === p)) out.push(p);
  return out;
}

/* ----------------------------------- angles ----------------------------------- */

const ANGLE_PATTERNS: Record<Exclude<Angle, 'keyword' | 'brand'>, RegExp> = {
  offer: /(fri fragt|gratis|rabat|tilbud|\bspar\b|udsalg|\d\s*%|\bfra\s+\d|\bkr\b|\bdkk\b|,-)/i,
  delivery: /(levering|leveres|levér|på lager|lagervare|hurtig|næste dag|i morgen|samme dag|\d\s*[-–]\s*\d\s*(hverdage|dage))/i,
  trust: /(garanti|anmeld|trustpilot|kunder|års erfaring|\d\s*år\b|siden\s+\d{4}|testet|certific|returret|sikker|autoriser|prisvind|vinder|stjerne|★)/i,
  cta: /(^(køb|bestil|se|find|få|hent|læs|prøv|vælg|sammenlign|kontakt|ring|bliv|tilføj|beregn|book|opdag|udforsk)\b|\b(køb nu|bestil nu|se udvalget|se alle|få tilbud|kontakt os|læs mere|bestil i dag)\b)/i,
};

/* ----------------------------------- claims ----------------------------------- */

const FAMILIES: Record<string, RegExp> = {
  money: /^(kr\.?|dkk|,-)$/i,
  percent: /^(%|procent)$/i,
  time: /^(dages|dage|dags|dag|hverdage|timer|time|uger|uge)$/i,
  years: /^(år|års)$/i,
  count: /^stk\.?$/i,
};

interface RawClaim {
  text: string;
  /** For a number claim: its digits (1.499 → 1499) and unit family. */
  digits?: string;
  family?: string;
  /** For a phrase claim: what the page must say. */
  stem?: RegExp;
}

const PHRASES: [RegExp, RegExp][] = [
  [/(fri|gratis)\s+(fragt|levering)|fragtfri/i, /(fri|gratis)\s+(fragt|levering)|fragtfri/i],
  [/\bgratis\b/i, /gratis|\bfri\b/i],
  [/garanti/i, /garanti/i],
  [/returret|\bretur\b/i, /returret|\bretur/i],
  [/på lager/i, /på lager|lagervare|lager/i],
  [/(næste dag|i morgen|samme dag)/i, /(næste dag|i morgen|samme dag|\bdag\b)/i],
  [/trustpilot/i, /trustpilot/i],
];

/** The factual claims in the ad: numbers with a unit (price, days, %), and promises (free shipping, guarantee). */
export function extractClaims(texts: string[]): RawClaim[] {
  const out: RawClaim[] = [];
  const seen = new Set<string>();
  const add = (c: RawClaim) => {
    const k = `${c.family ?? ''}|${c.digits ?? ''}|${c.stem?.source ?? ''}`;
    if (!seen.has(k)) {
      seen.add(k);
      out.push(c);
    }
  };
  for (const raw of texts) {
    const t = plain(raw);
    for (const m of t.matchAll(/(\d[\d.,]*)\s*(%|procent|kr\.?|dkk|,-|dages|dage|dags|dag|hverdage|timer|time|uger|uge|år|års|stk\.?)(?![\p{L}])/giu)) {
      const family = Object.entries(FAMILIES).find(([, re]) => re.test(m[2]!))?.[0];
      const digits = m[1]!.replace(/[.,]+$/, '').replace(/\./g, '').replace(',', '.');
      if (family) add({ text: m[0]!.trim(), digits, family });
    }
    for (const [find, stem] of PHRASES) {
      const m = find.exec(t);
      if (m) add({ text: m[0]!.trim(), stem });
    }
  }
  return out;
}

function supported(claim: RawClaim, evidence: EvidenceItem[]): boolean {
  return evidence.some((e) => {
    const q = plain(e.quote).toLowerCase();
    if (claim.stem) return claim.stem.test(q);
    const nums = [...q.matchAll(/\d[\d.,]*/g)].map((m) => m[0].replace(/[.,]+$/, '').replace(/\./g, '').replace(',', '.'));
    if (!nums.includes(claim.digits!)) return false;
    // The unit must be on the page too (499 kr, not just a 499 in a product number).
    const unit: Record<string, RegExp> = {
      money: /(\bkr\b|dkk|,-)/,
      percent: /(%|procent)/,
      time: /(dag|dage|dages|dags|hverdag|time|timer|uge|uger)/,
      years: /(\bår\b|\bårs\b)/,
      count: /(\bstk\b)/,
    };
    return unit[claim.family!]!.test(q);
  });
}

/* ------------------------------------ review ------------------------------------ */

const SHOUTING = /\b[A-ZÆØÅ]{4,}\b/g;
const URGENCY = /(sidste chance|kun i dag|skynd dig|nu eller aldrig|før det er for sent|begrænset antal|ikke gå glip|handl nu)/i;
const SUPERLATIVE = /(\bbedste\b|\bbedst\b|\bbilligste\b|\bbilligst\b|laveste pris|nr\.?\s*1\b|\bførende\b|markedets|danmarks (største|bedste))/i;
const PHONE = /\b\d{2}[\s.]?\d{2}[\s.]?\d{2}[\s.]?\d{2}\b/;

const quoteAll = (list: string[]) => list.map((t) => `"${t}"`).join(', ');

export function reviewAd(input: ReviewInput): Review {
  const issues: Issue[] = [];
  const add = (level: Level, code: string, text: string) => issues.push({ level, code, text });
  const headlines = input.headlines;
  const descriptions = input.descriptions;
  const all = [...headlines, ...descriptions];
  const hPins = headlines.map((_, i) => input.headlinePins?.[i] ?? null);
  const dPins = descriptions.map((_, i) => input.descriptionPins?.[i] ?? null);

  /* ---- what Microsoft requires: an ad that cannot serve is an error ---- */
  const hGaps = unfillablePositions(hPins, 3);
  if (headlines.length >= 3 && hGaps.length)
    add('error', 'pin_headlines', `Overskrifterne er fastgjort, så ingen kan vises i position ${hGaps.join(' og ')}. Microsoft kræver mindst én overskrift, der må stå i hver position – fjern nogle af fastgørelserne.`);
  const dGaps = unfillablePositions(dPins, 2);
  if (descriptions.length >= 2 && dGaps.length)
    add('error', 'pin_descriptions', `Beskrivelserne er fastgjort, så ingen kan vises i position ${dGaps.join(' og ')} – fjern nogle af fastgørelserne.`);

  /* ---- structure ---- */
  if (headlines.length < 8)
    add('warning', 'few_headlines', `Kun ${headlines.length} overskrifter. Microsoft anbefaler mindst 8–10 forskellige – med flere har den flere kombinationer at vælge mellem.`);
  const dupes = nearDuplicates(headlines);
  if (dupes.length)
    add('warning', 'near_duplicates', `Næsten ens overskrifter: ${dupes.slice(0, 4).map(([a, b]) => `"${a}" / "${b}"`).join(', ')}. Microsoft anbefaler forskellige overskrifter uden samme ordlyd – skriv dem om, så de siger noget forskelligt.`);
  // A description may use a headline's words if it adds something – it repeats one when it says nothing more.
  const echoes = descriptions.filter((d) => headlines.some((h) => content(h).length >= 3 && jaccard(h, d) >= 0.7));
  if (echoes.length) add('tip', 'description_repeats_headline', `Beskrivelsen gentager en overskrift: ${quoteAll(echoes.slice(0, 3))}. Brug den til noget nyt – et argument eller en opfordring.`);
  if (descriptions.length < 4) add('tip', 'few_descriptions', `${descriptions.length} beskrivelser – 4 forskellige giver flere kombinationer.`);
  const short = headlines.filter((h) => plain(h).length <= 20).length;
  if (short < 3) add('tip', 'few_short_headlines', 'Færre end 3 korte overskrifter (højst 20 tegn). Korte overskrifter lader Microsoft sætte flere sammen, og de passer på mobilen.');

  /* ---- pinning: a little, not a lot ---- */
  const pinnedH = hPins.filter(Boolean).length;
  if (pinnedH > 3) add('warning', 'many_pins', `${pinnedH} overskrifter er fastgjort. Jo flere fastgørelser, jo færre kombinationer kan Microsoft teste – fastgør kun det, der skal vises (fx søgeordet og et lovkrav).`);
  const pinnedD = dPins.filter(Boolean).length;
  if (pinnedD) add('tip', 'pinned_descriptions', 'Beskrivelser er fastgjort. Det er sjældent nødvendigt – gør det kun, hvis en tekst skal vises (fx et lovkrav).');
  const sharePos1 = hPins.filter((p) => p === 1).length;
  if (sharePos1 > 1) add('tip', 'shared_position_1', `${sharePos1} overskrifter er fastgjort til position 1 – de skifter, så den første ikke altid vises.`);

  /* ---- wording Microsoft's style rules reject ---- */
  const bang = headlines.filter((h) => h.includes('!'));
  if (bang.length) add('warning', 'exclamation', `Udråbstegn i overskrift: ${quoteAll(bang.slice(0, 3))}. Microsofts stilregler afviser unødvendige symboler og gentagen tegnsætning, og udråbstegn i en overskrift kan give en afvisning – fjern dem.`);
  const repeated = all.filter((t) => /[!?.]{2,}/.test(t));
  if (repeated.length) add('warning', 'repeated_punctuation', `Gentaget tegnsætning: ${quoteAll(repeated.slice(0, 3))}.`);
  const brand = (input.brand ?? '').toUpperCase();
  const shouting = [...new Set(all.flatMap((t) => plain(t).match(SHOUTING) ?? []))].filter((w) => w !== brand);
  if (shouting.length) add('warning', 'caps', `Ord med store bogstaver: ${shouting.slice(0, 5).join(', ')}. Microsoft kræver korrekt brug af store og små bogstaver.`);
  const stutter = all.filter((t) => words(t).some((w, i, ws) => i > 0 && w === ws[i - 1] && w.length >= 3));
  if (stutter.length) add('warning', 'repeated_words', `Samme ord to gange i træk: ${quoteAll(stutter.slice(0, 3))}.`);
  const urgent = all.filter((t) => URGENCY.test(t));
  if (urgent.length) add('warning', 'urgency', `Presserende sprog: ${quoteAll(urgent.slice(0, 3))}. Microsoft kan afvise tekster, der presser – brug kun et tilbud med en rigtig slutdato, og skriv datoen.`);
  const phone = all.filter((t) => PHONE.test(t));
  if (phone.length) add('warning', 'phone', `Telefonnummer i annoncens tekst: ${quoteAll(phone.slice(0, 2))}. Det er begrænset i flere markeder hos Microsoft – brug en opkaldsudvidelse.`);

  /* ---- claims: each needs proof from the landing page ---- */
  const rawClaims = extractClaims(all);
  const evidence = input.evidence ?? [];
  const claims: Claim[] = rawClaims.map((c) => ({ text: c.text, supported: supported(c, evidence) }));
  const open = claims.filter((c) => !c.supported);
  if (open.length && !evidence.length)
    add('warning', 'claims_unchecked', `Påstande uden dokumentation fra landingssiden: ${open.map((c) => `"${c.text}"`).join(', ')}. Læs siden, og giv et kort citat for hver – ellers må de ikke stå i annoncen.`);
  else if (open.length) add('warning', 'claims_unbacked', `Citaterne dækker ikke: ${open.map((c) => `"${c.text}"`).join(', ')}. Tallet og enheden skal stå på siden.`);
  const boast = all.filter((t) => SUPERLATIVE.test(t));
  if (boast.length) add('warning', 'superlative', `Overdrivelser, der kræver dokumentation: ${quoteAll(boast.slice(0, 3))}. Uden dokumentation kan de afvises og er vildledende.`);
  if (rawClaims.some((c) => c.family === 'money') && !all.some((t) => /moms/i.test(t))) add('tip', 'vat', 'Annoncen nævner en pris uden at sige, om den er ekskl. eller inkl. moms.');

  /* ---- the keywords it is for ---- */
  let keywordCoverage: Review['keywordCoverage'] = null;
  const keywords = (input.keywords ?? []).filter((k) => content(k.text).length);
  if (keywords.length) {
    const textWords = all.flatMap(content);
    const covered = keywords.filter((k) => content(k.text).every((w) => hasWord(textWords, w)));
    const weight = (k: { weight?: number }) => k.weight ?? 1;
    const total = keywords.reduce((s, k) => s + weight(k), 0);
    const share = total ? covered.reduce((s, k) => s + weight(k), 0) / total : 0;
    const uncovered = keywords
      .filter((k) => !covered.includes(k))
      .sort((a, b) => weight(b) - weight(a))
      .slice(0, 8)
      .map((k) => k.text);
    keywordCoverage = { total: keywords.length, covered: covered.length, share, uncovered };
    if (keywords.length >= 3 && share < 0.6)
      add('warning', 'keyword_coverage', `Annoncen indeholder kun ${Math.round(share * 100)} % af gruppens søgeord (vægtet efter klik). Mangler: ${uncovered.slice(0, 5).join(', ')}. Annoncen skal ligne det, folk søger efter – ellers falder relevans og kvalitetsresultat.`);
  }

  /* ---- the angles ---- */
  const kwTexts = keywords.map((k) => k.text);
  const angles: Review['angles'] = { keyword: [], offer: [], delivery: [], trust: [], cta: [], brand: [] };
  for (const t of all) {
    for (const a of ['offer', 'delivery', 'trust', 'cta'] as const) if (ANGLE_PATTERNS[a].test(plain(t))) angles[a].push(t);
    if (input.brand && words(t).includes(input.brand.toLowerCase())) angles.brand.push(t);
  }
  for (const h of headlines) if (kwTexts.some((k) => content(k).length && content(k).every((w) => hasWord(content(h), w)))) angles.keyword.push(h);
  const required: Angle[] = ['offer', 'trust', 'cta'];
  const missingAngles = required.filter((a) => !angles[a].length);
  if (missingAngles.length) {
    const label: Record<Angle, string> = { keyword: 'søgeord', offer: 'tilbud/pris', delivery: 'levering', trust: 'tillid (garanti, anmeldelser, erfaring)', cta: 'opfordring til handling', brand: 'brand' };
    add('tip', 'angles', `Mangler en vinkel: ${missingAngles.map((a) => label[a]).join(', ')}. Annoncer med forskellige budskaber (tilbud, tillid, handling) giver Microsoft noget at teste imellem – men kun, hvis det kan dokumenteres på siden.`);
  }

  /* ---- the other ads in the ad group ---- */
  const running = (input.existing ?? []).filter((a) => a.enabled);
  if (input.existing) {
    if (running.length >= 3) add('warning', 'ad_limit', 'Gruppen har allerede 3 aktive responsive annoncer – Microsofts maksimum. Sæt den svageste på pause først, ellers afvises oprettelsen.');
    const similarExisting = running.filter((a) => a.headlines.length && headlines.filter((h) => a.headlines.some((x) => jaccard(h, x) >= 0.75)).length / headlines.length >= 0.6);
    if (similarExisting.length) add('warning', 'like_existing', 'Mindst 60 % af overskrifterne står allerede i en aktiv annonce i gruppen. En annonce, der ligner, tester ingenting – giv den en anden vinkel (fx kvalitet mod pris).');
    else if (running.length === 1) add('tip', 'second_ad', 'Gruppen har én aktiv annonce. To annoncer med forskellige vinkler er en god ramme at teste i (Microsoft tillader tre; at en tredje giver mindre, er kun set i sekundære kilder).');
    else if (running.length === 0) add('tip', 'first_ad', 'Det er gruppens første annonce – planlæg en anden med en anden vinkel, når den har fået trafik.');
  }

  const order: Record<Level, number> = { error: 0, warning: 1, tip: 2 };
  issues.sort((a, b) => order[a.level] - order[b.level]);
  return { issues, headlineCount: headlines.length, shortHeadlines: short, angles, missingAngles, keywordCoverage, claims };
}

/** The issues of the given levels as short Danish lines (for the approval card and the assistant). */
export const issueLines = (review: Review, levels: Level[] = ['error', 'warning']): string[] => review.issues.filter((i) => levels.includes(i.level)).map((i) => i.text);
