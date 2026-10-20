/**
 * XavierOS subscriptions, shared by the app, the website and the Cloudflare Worker.
 * A company pays per seat (active person); every seat adds AI use to the company's
 * shared pool for the month. When the pool is used up, an admin buys extra-usage
 * packs. The AI itself runs on the company's (or our) API key – these prices are what
 * the company pays for XavierOS, with a margin on the AI use.
 */
export type PlanId = 'solo' | 'teams';

export interface PlanDef {
  id: PlanId;
  name: string;
  tagline: string;
  /** Per seat per month. */
  priceUsd: number;
  /** AI use each seat adds to the shared pool per month. */
  includedUsd: number;
  minSeats: number;
  maxSeats: number;
  features: string[];
}

export const PLANS: Record<PlanId, PlanDef> = {
  solo: {
    id: 'solo',
    name: 'Solo',
    tagline: 'For den selvstændige annoncør',
    priceUsd: 39,
    includedUsd: 25,
    minSeats: 1,
    maxSeats: 1,
    features: [
      'AI-rådgiver til hele Microsoft Advertising',
      'Alle ændringer kræver din godkendelse',
      'Søgeordsundersøgelse, auktionsindsigt og websøgning',
      'Dashboard, planlægning og opfølgninger',
      '$25 AI-forbrug om måneden',
    ],
  },
  teams: {
    id: 'teams',
    name: 'Teams',
    tagline: 'For marketingteams og bureauer',
    priceUsd: 35,
    includedUsd: 25,
    minSeats: 2,
    maxSeats: 250,
    features: [
      'Alt i Solo',
      'Fælles forbindelser, playbooks og budgetgrænser',
      'Delte planlægningstavler og roller',
      'Fælles forbrugspulje: $25 AI-forbrug pr. medarbejder',
      'Administrér medarbejdere og forbrug samlet',
    ],
  },
};

/** One pack of extra AI use for the company's pool. */
export const EXTRA_USAGE_PACK = { priceUsd: 25, creditUsd: 20 };

export const isPlanId = (v: unknown): v is PlanId => v === 'solo' || v === 'teams';

/** Seats that are billed: never fewer than the plan's minimum. */
export const billedSeats = (plan: PlanId, people: number) => Math.min(PLANS[plan].maxSeats, Math.max(PLANS[plan].minSeats, people));

export const monthlyPrice = (plan: PlanId, people: number) => PLANS[plan].priceUsd * billedSeats(plan, people);

export const includedUsage = (plan: PlanId, people: number) => PLANS[plan].includedUsd * billedSeats(plan, people);

/**
 * How much of one AI request is paid with bought credits: only the part that goes beyond
 * the month's included use (usedBefore is the pool's use before this request).
 */
export const creditSpent = (usedBefore: number, costUsd: number, includedUsd: number) =>
  Math.max(0, usedBefore + costUsd - includedUsd) - Math.max(0, usedBefore - includedUsd);
