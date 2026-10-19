/**
 * What the app and the Cloudflare Worker (cloudflare/src/workspace.ts) send each other.
 * Keep this file free of app imports: the Worker bundles it on its own.
 */

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
