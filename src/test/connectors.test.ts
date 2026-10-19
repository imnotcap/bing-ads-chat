// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { emptyState, linkedinVersion, mergeInput, runTest, toSummary, type ConnState, type FetchLike } from '../../cloudflare/src/connectors';
import { adsProbe, adsRefresh, mergeAdsKeys } from '../../cloudflare/src/microsoftAds';
import { CONNECTORS, CONNECTOR_IDS, connectorDef } from '@/workspace/connectors';

/** A fake API: answers by URL, remembers the requests. */
function fakeFetch(routes: [RegExp, (init?: RequestInit) => { status?: number; body: unknown; raw?: string }][]) {
  const calls: { url: string; init?: RequestInit }[] = [];
  const fn: FetchLike = async (url, init) => {
    calls.push({ url, init });
    const route = routes.find(([re]) => re.test(url));
    if (!route) return new Response('not found', { status: 404 });
    const r = route[1](init);
    return new Response(r.raw ?? JSON.stringify(r.body), { status: r.status ?? 200 });
  };
  return { fn, calls };
}

const state = (config: Record<string, string>, secrets: Record<string, string>): ConnState => ({ ...emptyState(), config, secrets, status: 'connected' });
const header = (init: RequestInit | undefined, name: string) => new Headers(init?.headers).get(name);

describe('connector definitions', () => {
  it('covers every source with a name, fields and setup steps', () => {
    expect(CONNECTORS.map((c) => c.id)).toEqual([...CONNECTOR_IDS]);
    for (const c of CONNECTORS) {
      expect(c.fields.some((f) => f.required)).toBe(true);
      expect(c.setup.length).toBeGreaterThan(0);
    }
  });
});

describe('saving a connection', () => {
  const def = connectorDef('meta_ads');
  it('asks for the required fields', () => {
    expect(() => mergeInput(def, emptyState(), { config: { adAccountId: 'act_1' } })).toThrow(/System user access token/);
  });
  it('keeps a stored secret when the field is left empty, and clears emptied settings', () => {
    const before = state({ adAccountId: 'act_1', apiVersion: 'v22.0' }, { accessToken: 'secret-1' });
    const merged = mergeInput(def, before, { config: { adAccountId: 'act_2', apiVersion: '' }, secrets: { accessToken: '' } });
    expect(merged).toEqual({ config: { adAccountId: 'act_2' }, secrets: { accessToken: 'secret-1' } });
  });
  it('never sends secret values to the app', () => {
    const summary = toSummary('meta_ads', state({ adAccountId: 'act_1' }, { accessToken: 'secret-1' }));
    expect(JSON.stringify(summary)).not.toContain('secret-1');
    expect(summary.secretsSet).toEqual(['accessToken']);
  });
});

describe('connection tests', () => {
  it('Klaviyo: private key and revision header, account name', async () => {
    const api = fakeFetch([[/klaviyo\.com\/api\/accounts/, () => ({ body: { data: [{ attributes: { contact_information: { organization_name: 'Inventarland' }, preferred_currency: 'DKK' } }] } })]]);
    const r = await runTest('klaviyo', state({}, { apiKey: 'pk_abc' }), api.fn);
    expect(r).toMatchObject({ ok: true, state: { status: 'connected', accountLabel: 'Inventarland (DKK)' } });
    expect(header(api.calls[0]!.init, 'Authorization')).toBe('Klaviyo-API-Key pk_abc');
    expect(header(api.calls[0]!.init, 'revision')).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('Meta: an inactive ad account is reported', async () => {
    const api = fakeFetch([[/graph\.facebook\.com\/v23\.0\/act_123/, () => ({ body: { name: 'Inventarland', currency: 'DKK', account_status: 2 } })]]);
    const r = await runTest('meta_ads', state({ adAccountId: '123' }, { accessToken: 't' }), api.fn);
    expect(r.ok).toBe(false);
    expect(r.state.status).toBe('error');
    expect(r.message).toMatch(/ikke aktiv/);
  });

  it('a rejected key asks for a new login (and the reason is shown)', async () => {
    const api = fakeFetch([[/ahrefs\.com/, () => ({ status: 401, body: { error: 'Invalid API key' } })]]);
    const r = await runTest('ahrefs', state({}, { apiKey: 'bad' }), api.fn);
    expect(r.state.status).toBe('needs_login');
    expect(r.state.lastError).toMatch(/Invalid API key/);
  });

  it('Google Ads: refreshes the login and moves on from a closed API version', async () => {
    const api = fakeFetch([
      [/oauth2\.googleapis\.com\/token/, () => ({ body: { access_token: 'access' } })],
      [/\/v25\//, () => ({ status: 404, body: null, raw: '<html>Not found</html>' })],
      [/\/v26\/customers\/1234567890\/googleAds:searchStream/, () => ({ body: [{ results: [{ customer: { descriptiveName: 'Inventarland ApS', currencyCode: 'DKK' } }] }] })],
    ]);
    const r = await runTest('google_ads', state({ customerId: '123-456-7890', loginCustomerId: '999-000-1111' }, { clientId: 'c', clientSecret: 's', refreshToken: 'r' }), api.fn);
    expect(r).toMatchObject({ ok: true, state: { accountLabel: 'Inventarland ApS (DKK)' } });
    const search = api.calls.find((c) => c.url.includes('/v26/'))!;
    expect(header(search.init, 'Authorization')).toBe('Bearer access');
    expect(header(search.init, 'login-customer-id')).toBe('9990001111');
  });

  it('Magento: signs the request with OAuth 1.0a', async () => {
    const api = fakeFetch([[/m2\.example\.dk\/rest\/V1\/orders/, () => ({ body: { total_count: 1234 } })]]);
    const r = await runTest('magento', state({ baseUrl: 'https://m2.example.dk/' }, { consumerKey: 'ck', consumerSecret: 'cs', accessToken: 'at', accessTokenSecret: 'ats' }), api.fn);
    expect(r.state.accountLabel).toBe('m2.example.dk · 1.234 ordrer');
    expect(header(api.calls[0]!.init, 'Authorization')).toMatch(/^OAuth oauth_consumer_key="ck".*oauth_signature_method="HMAC-SHA1".*oauth_signature="[^"]+"/);
  });

  it('LinkedIn: keeps a renewed token and uses a supported version', async () => {
    const api = fakeFetch([
      [/linkedin\.com\/oauth\/v2\/accessToken/, () => ({ body: { access_token: 'new-access', refresh_token: 'new-refresh' } })],
      [/api\.linkedin\.com\/rest\/adAccounts\/512/, () => ({ body: { name: 'Inventarland', currency: 'DKK' } })],
    ]);
    const r = await runTest('linkedin_ads', state({ adAccountId: '512' }, { accessToken: 'old', clientId: 'id', clientSecret: 's', refreshToken: 'old-refresh' }), api.fn, Date.UTC(2026, 9, 16));
    expect(r.ok).toBe(true);
    expect(r.state.secrets).toMatchObject({ accessToken: 'new-access', refreshToken: 'new-refresh' });
    expect(header(api.calls[1]!.init, 'LinkedIn-Version')).toBe('202607');
    expect(linkedinVersion('202601')).toBe('202601');
  });

  it('Daisycon waits for the login before testing', async () => {
    const r = await runTest('daisycon', state({ advertiserId: '1' }, { clientId: 'c' }), fakeFetch([]).fn);
    expect(r.state.status).toBe('needs_login');
  });

  it('PIM: the key goes in the chosen header', async () => {
    const api = fakeFetch([[/pim\.example\.dk\/products/, () => ({ body: { items: [] } })]]);
    const r = await runTest('pim', state({ baseUrl: 'https://pim.example.dk', testPath: '/products?limit=1', headerName: 'X-API-Key' }, { apiKey: 'k1' }), api.fn);
    expect(r.ok).toBe(true);
    expect(header(api.calls[0]!.init, 'X-API-Key')).toBe('k1');
  });

  it('Search Console and GA4: sign in with the service account key', async () => {
    const pair = await crypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify']);
    const der = Buffer.from(await crypto.subtle.exportKey('pkcs8', pair.privateKey)).toString('base64');
    const sa = JSON.stringify({ type: 'service_account', client_email: 'bot@proj.iam.gserviceaccount.com', private_key: `-----BEGIN PRIVATE KEY-----\n${der}\n-----END PRIVATE KEY-----\n` });
    let assertion = '';
    const api = fakeFetch([
      [
        /oauth2\.googleapis\.com\/token/,
        (init) => {
          assertion = new URLSearchParams(String(init?.body)).get('assertion') ?? '';
          return { body: { access_token: 'g-token' } };
        },
      ],
      [/webmasters\/v3\/sites\/sc-domain%3Ainventarland\.dk/, () => ({ body: { siteUrl: 'sc-domain:inventarland.dk', permissionLevel: 'siteFullUser' } })],
      [/analyticsdata\.googleapis\.com\/v1beta\/properties\/123:runReport/, () => ({ body: { rows: [{ metricValues: [{ value: '4321' }] }] } })],
    ]);
    const sc = await runTest('search_console', state({ siteUrl: 'sc-domain:inventarland.dk' }, { serviceAccount: sa }), api.fn);
    expect(sc).toMatchObject({ ok: true, state: { accountLabel: 'sc-domain:inventarland.dk · fulluser' } });
    const [h, p, sig] = assertion.split('.');
    expect(JSON.parse(Buffer.from(p!, 'base64url').toString())).toMatchObject({ iss: 'bot@proj.iam.gserviceaccount.com', scope: 'https://www.googleapis.com/auth/webmasters.readonly' });
    const valid = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', pair.publicKey, Buffer.from(sig!, 'base64url'), new TextEncoder().encode(`${h}.${p}`));
    expect(valid).toBe(true);
    const ga = await runTest('ga4', state({ propertyId: '123' }, { serviceAccount: sa }), api.fn);
    expect(ga.state.accountLabel).toBe('Property 123 · 4.321 besøg sidste 7 dage');
    const bad = await runTest('ga4', state({ propertyId: '123' }, { serviceAccount: '{nope' }), api.fn);
    expect(bad.message).toMatch(/gyldig JSON/);
  });
});

describe('Microsoft Advertising with typed-in keys', () => {
  const keys = { developerToken: 'dev', clientId: 'app', refreshToken: 'r1', tenant: 'common' };
  const msApi = (customer: (path: string) => { status?: number; body: unknown }) =>
    fakeFetch([
      [/login\.microsoftonline\.com\/common\/oauth2\/v2\.0\/token/, () => ({ body: { access_token: 'acc', refresh_token: 'r2', expires_in: 3600 } })],
      [/CustomerManagement\/v13\/User\/Query/, () => customer('user')],
      [/CustomerManagement\/v13\/Accounts\/Search/, () => customer('accounts')],
    ]);

  it('keeps stored secrets when the fields are left empty and asks for what is missing', () => {
    expect(mergeAdsKeys({ ...keys, clientSecret: 's' }, { developerToken: '', clientId: 'app2', refreshToken: '' })).toEqual({ ...keys, clientId: 'app2', clientSecret: 's' });
    expect(mergeAdsKeys({ ...keys, clientSecret: 's' }, { clientSecret: null })).toEqual(keys);
    expect(() => mergeAdsKeys(undefined, { developerToken: 'dev' })).toThrow('Udfyld: Application (client) ID, Refresh token.');
  });

  it('tests the keys: refresh, who the user is and the ad accounts', async () => {
    const api = msApi((what) => (what === 'user' ? { body: { User: { Id: 42, Name: { FirstName: 'Casper', LastName: 'Johansen' } } } } : { body: { Accounts: [{ Id: 1 }, { Id: 2 }] } }));
    const r = await adsProbe(api.fn, { ...keys, clientSecret: 'sec' });
    expect(r).toMatchObject({ accessToken: 'acc', refreshToken: 'r2', name: 'Casper Johansen', accounts: 2 });
    const form = new URLSearchParams(String(api.calls[0]!.init?.body));
    expect(form.get('client_secret')).toBe('sec');
    expect(form.get('scope')).toMatch(/msads\.manage/);
    expect(header(api.calls[1]!.init, 'DeveloperToken')).toBe('dev');
    expect(JSON.parse(String(api.calls[2]!.init?.body)).Predicates[0].Value).toBe('42');
  });

  it('explains a rejected developer token (105) and an expired refresh token', async () => {
    const bad = msApi(() => ({ status: 400, body: { Errors: [{ Code: 105, Message: 'Authentication failed.' }] } }));
    await expect(adsProbe(bad.fn, keys)).rejects.toMatchObject({ kind: 'auth', message: expect.stringMatching(/developer tokenet er forkert.*\(105\)/) });
    const expired = fakeFetch([[/oauth2\/v2\.0\/token/, () => ({ status: 400, body: { error: 'invalid_grant', error_description: 'AADSTS70000: expired' } })]]);
    await expect(adsRefresh(expired.fn, keys)).rejects.toMatchObject({ kind: 'auth', message: expect.stringMatching(/udløbet.*AADSTS70000/) });
  });
});
