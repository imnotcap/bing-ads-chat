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
    connectedBy: string | null;
    connectedAt: number | null;
    /** Set when Microsoft stopped accepting the stored sign-in. */
    error: string | null;
  };
  keys: Record<SharedKeyName, SharedKeyInfo | null>;
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
