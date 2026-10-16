/**
 * Checks a Microsoft ID token (the "who are you" part of the Microsoft login in the
 * app): RS256 signature against Microsoft's published keys, the audience (our app
 * registration's client id), issuer, and expiry. Returns who signed in.
 *
 * Docs: https://learn.microsoft.com/entra/identity-platform/id-token-claims-reference
 */

const KEYS_URL = 'https://login.microsoftonline.com/common/discovery/v2.0/keys';
const SKEW_S = 300;

export interface MicrosoftIdentity {
  /** Object id of the user in their tenant – stable across sign-ins. */
  oid: string;
  tid: string;
  email: string;
  name: string;
}

function b64urlBytes(s: string): Uint8Array {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4);
  const bin = atob(b64);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

function b64urlJson<T>(s: string): T {
  return JSON.parse(new TextDecoder().decode(b64urlBytes(s))) as T;
}

let cachedKeys: { keys: JsonWebKey[]; at: number } | null = null;

/** Microsoft's signing keys, kept for 12 hours (and fetched again when a key id is unknown). */
export const microsoftKeys = async (fresh = false): Promise<JsonWebKey[]> => {
  if (!fresh && cachedKeys && Date.now() - cachedKeys.at < 12 * 3600_000) return cachedKeys.keys;
  const res = await fetch(KEYS_URL);
  if (!res.ok) throw new AuthError('Kunne ikke hente Microsofts nøgler.', 502);
  const body = (await res.json()) as { keys?: JsonWebKey[] };
  cachedKeys = { keys: body.keys ?? [], at: Date.now() };
  return cachedKeys.keys;
};

export class AuthError extends Error {
  constructor(
    message: string,
    readonly status = 401,
  ) {
    super(message);
  }
}

interface Header {
  alg?: string;
  kid?: string;
}

interface Claims {
  aud?: string;
  iss?: string;
  exp?: number;
  nbf?: number;
  oid?: string;
  tid?: string;
  sub?: string;
  email?: string;
  preferred_username?: string;
  name?: string;
}

export async function verifyMicrosoftIdToken(
  token: string,
  opts: { clientIds: string[]; keys?: (fresh: boolean) => Promise<JsonWebKey[]>; now?: number },
): Promise<MicrosoftIdentity> {
  const parts = token.split('.');
  if (parts.length !== 3) throw new AuthError('Login-beviset kunne ikke læses.');
  const [h, p, s] = parts as [string, string, string];
  let header: Header;
  let claims: Claims;
  try {
    header = b64urlJson<Header>(h);
    claims = b64urlJson<Claims>(p);
  } catch {
    throw new AuthError('Login-beviset kunne ikke læses.');
  }
  if (header.alg !== 'RS256' || !header.kid) throw new AuthError('Login-beviset er ikke signeret af Microsoft.');

  const getKeys = opts.keys ?? microsoftKeys;
  let jwk = (await getKeys(false)).find((k) => (k as { kid?: string }).kid === header.kid);
  jwk ??= (await getKeys(true)).find((k) => (k as { kid?: string }).kid === header.kid);
  if (!jwk) throw new AuthError('Login-beviset er ikke signeret af Microsoft.');

  const key = await crypto.subtle.importKey('jwk', { kty: jwk.kty, n: jwk.n, e: jwk.e }, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
  const ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, b64urlBytes(s), new TextEncoder().encode(`${h}.${p}`));
  if (!ok) throw new AuthError('Login-beviset er ikke signeret af Microsoft.');

  const now = Math.floor((opts.now ?? Date.now()) / 1000);
  if (!claims.aud || !opts.clientIds.includes(claims.aud)) throw new AuthError('Login-beviset er udstedt til en anden app.');
  if (typeof claims.exp !== 'number' || claims.exp + SKEW_S < now) throw new AuthError('Login-beviset er udløbet. Log ind igen.');
  if (typeof claims.nbf === 'number' && claims.nbf - SKEW_S > now) throw new AuthError('Login-beviset er endnu ikke gyldigt.');
  if (!claims.tid || !claims.oid) throw new AuthError('Login-beviset mangler bruger-id.');
  if (claims.iss !== `https://login.microsoftonline.com/${claims.tid}/v2.0`) throw new AuthError('Login-beviset kommer ikke fra Microsoft.');

  const email = (claims.email ?? claims.preferred_username ?? '').trim().toLowerCase();
  if (!email.includes('@')) throw new AuthError('Microsoft-kontoen har ingen e-mailadresse.');
  return { oid: claims.oid, tid: claims.tid, email, name: (claims.name ?? '').trim() || email.split('@')[0]! };
}
