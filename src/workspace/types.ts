/**
 * What the app and the Cloudflare Worker (cloudflare/src/workspace.ts) send each other.
 * Keep this file free of app imports: the Worker bundles it on its own.
 */
import type { PlanId } from './plans';

export type Role = 'admin' | 'member';
/** 'pending': signed in, but an admin has to let them in first. */
export type UserStatus = 'active' | 'pending';

export interface WorkspaceUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  status: UserStatus;
  createdAt: number;
  lastSeenAt: number;
}

/** A company using XavierOS – one workspace each (cloudflare/src/directory.ts). */
export interface CompanyInfo {
  id: string;
  name: string;
  plan: PlanId;
  createdAt: number;
  /** People with this e-mail domain join without an invitation (e.g. "inventarland.dk"). */
  domains: string[];
}

export interface Invitation {
  email: string;
  role: Role;
  invitedBy: string;
  at: number;
}

/** Signed in with Microsoft, but not part of a company yet: create one, or ask for an invitation. */
export interface NeedsCompany {
  needsCompany: true;
  email: string;
  name: string;
  /** Short-lived proof of the Microsoft sign-in, used to create the company. */
  ticket: string;
}

export interface BillingPurchase {
  at: number;
  priceUsd: number;
  creditUsd: number;
  /** Who bought it. */
  by: string;
}

/** The company's subscription and shared AI-usage pool this month (cloudflare/src/billing.ts). */
export interface BillingState {
  month: string;
  plan: PlanId;
  /** Billed seats (the plan's minimum, or the number of people). */
  seats: number;
  people: number;
  priceMonthlyUsd: number;
  pricePerSeatUsd: number;
  /** AI use in the pool this month (seats × the plan's included use). */
  includedUsd: number;
  usedUsd: number;
  includedLeftUsd: number;
  /** Bought credits not used yet. */
  creditUsd: number;
  remainingUsd: number;
  pack: { priceUsd: number; creditUsd: number };
  byPerson: { name: string; usedUsd: number }[];
  /** This month's purchases. */
  purchases: BillingPurchase[];
}

export interface SharedKeyInfo {
  /** Last four characters, so people can tell keys apart. */
  hint: string;
  by: string;
  at: number;
}

export type SharedKeyName = 'anthropic' | 'google';

/** The connections everyone in the app shares. Never contains the secrets themselves. */
export interface WorkspaceInfo {
  ads: {
    connected: boolean;
    /** The Microsoft user whose sign-in the workspace uses for Microsoft Advertising. */
    accountName: string | null;
    clientId: string | null;
    tenant: string;
    hasDeveloperToken: boolean;
    hasClientSecret: boolean;
    hasRefreshToken: boolean;
    /** Konto-ID and Kunde-ID (like Inventarland), when set. */
    accountId: string | null;
    customerId: string | null;
    /** Ad accounts the user behind the keys had when they were saved. */
    accounts: number | null;
    connectedBy: string | null;
    connectedAt: number | null;
    /** Set when Microsoft stopped accepting the stored sign-in. */
    error: string | null;
  };
  keys: Record<SharedKeyName, SharedKeyInfo | null>;
  /** Inventarland's API (webshop sales and the other ad channels), read with a shared Inventarland user. */
  inventarland: {
    connected: boolean;
    url: string;
    email: string | null;
    connectedBy: string | null;
    connectedAt: number | null;
    error: string | null;
  };
  /** Google Ads for the audit – read only, with a service account (cloudflare/src/googleAds.ts). */
  google: {
    connected: boolean;
    /** The service account's e-mail (the private key never leaves Cloudflare). */
    serviceAccount: string | null;
    projectId: string | null;
    customerId: string | null;
    loginCustomerId: string | null;
    accountName: string | null;
    currency: string | null;
    timeZone: string | null;
    connectedBy: string | null;
    connectedAt: number | null;
  };
}

export interface AdsAccess {
  accessToken: string;
  expiresAt: number;
  developerToken: string;
}

export interface SessionResponse {
  session: string;
  user: WorkspaceUser;
}

export interface PublicConfig {
  /** The app registration used for "Log ind med Microsoft". */
  clientId: string | null;
  tenant: string;
  /** Local development only: sign in with just an e-mail address. */
  devLogin: boolean;
}

/** Microsoft Advertising scope (the workspace's shared connection). */
export const ADS_SCOPE = 'https://ads.microsoft.com/msads.manage offline_access';

/** Inventarland's Cloudflare API (inventarland-dashboard, apps/worker). */
export const INVENTARLAND_URL = 'https://inventarland-api.scj-981.workers.dev';

/** Read-only views of Inventarland's API that the workspace passes on. */
export const INVENTARLAND_VIEWS = ['dashboard', 'channels', 'campaigns', 'sales', 'products'] as const;
export type InventarlandView = (typeof INVENTARLAND_VIEWS)[number];
