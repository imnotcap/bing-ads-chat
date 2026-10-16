// @vitest-environment node
import { beforeAll, describe, expect, it } from 'vitest';
import { verifyMicrosoftIdToken } from '../../cloudflare/src/auth';

const CLIENT = '11111111-2222-3333-4444-555555555555';
const TID = '9188040d-6c67-4c5b-b112-36a304b66dad';

let keys: JsonWebKey[];
let sign: (claims: Record<string, unknown>, kid?: string) => Promise<string>;
let otherSign: typeof sign;

const b64url = (bytes: Uint8Array) => Buffer.from(bytes).toString('base64url');
const part = (o: unknown) => b64url(new TextEncoder().encode(JSON.stringify(o)));

async function signer(kid: string) {
  const pair = await crypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify']);
  const jwk = { ...(await crypto.subtle.exportKey('jwk', pair.publicKey)), kid };
  const fn = async (claims: Record<string, unknown>, useKid = kid) => {
    const head = `${part({ alg: 'RS256', kid: useKid, typ: 'JWT' })}.${part(claims)}`;
    const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', pair.privateKey, new TextEncoder().encode(head));
    return `${head}.${b64url(new Uint8Array(sig))}`;
  };
  return { jwk, fn };
}

beforeAll(async () => {
  const a = await signer('key-a');
  const b = await signer('key-b');
  keys = [a.jwk];
  sign = a.fn;
  otherSign = b.fn;
});

const now = Math.floor(Date.now() / 1000);
const claims = (over: Record<string, unknown> = {}) => ({
  aud: CLIENT,
  iss: `https://login.microsoftonline.com/${TID}/v2.0`,
  tid: TID,
  oid: '00000000-0000-0000-aaaa-000000000001',
  exp: now + 3600,
  nbf: now - 10,
  name: 'Jonas Hansen',
  preferred_username: 'Jonas@Inventarland.dk',
  ...over,
});
const verify = (token: string) => verifyMicrosoftIdToken(token, { clientIds: [CLIENT], keys: async () => keys });

describe('Microsoft ID token', () => {
  it('accepts a valid token and reads who signed in', async () => {
    await expect(verify(await sign(claims()))).resolves.toEqual({ oid: '00000000-0000-0000-aaaa-000000000001', tid: TID, email: 'jonas@inventarland.dk', name: 'Jonas Hansen' });
  });

  it('rejects a token for another app', async () => {
    await expect(verify(await sign(claims({ aud: 'someone-else' })))).rejects.toThrow(/anden app/);
  });

  it('rejects an expired token', async () => {
    await expect(verify(await sign(claims({ exp: now - 3600 })))).rejects.toThrow(/udløbet/);
  });

  it('rejects a token from another issuer', async () => {
    await expect(verify(await sign(claims({ iss: 'https://evil.example/v2.0' })))).rejects.toThrow(/kommer ikke fra Microsoft/);
  });

  it('rejects a forged or tampered token', async () => {
    // Signed with a key Microsoft never published, but claiming Microsoft's key id.
    await expect(verify(await otherSign(claims(), 'key-a'))).rejects.toThrow(/ikke signeret/);
    // Valid signature, changed claims.
    const [h, , s] = (await sign(claims())).split('.');
    await expect(verify(`${h}.${part(claims({ oid: 'admin' }))}.${s}`)).rejects.toThrow(/ikke signeret/);
    // Unknown key id.
    await expect(verify(await otherSign(claims()))).rejects.toThrow(/ikke signeret/);
    await expect(verify('not-a-token')).rejects.toThrow(/læses/);
  });
});
