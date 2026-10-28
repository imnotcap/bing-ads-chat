// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  GOOGLE_TOKEN_URL,
  GoogleAdsError,
  GoogleAdsReader,
  assertReadOnly,
  explainGoogleError,
  googleAccessToken,
  parseServiceAccountKey,
  googleDimension,
  readCampaigns,
  readListingGroups,
  readNegatives,
  readOnlyFetch,
  readSearchTerms,
  signAssertion,
  type FetchLike,
} from '../../cloudflare/src/googleAds';

const SEARCH = 'https://googleads.googleapis.com/v25/customers/1234567890/googleAds:searchStream';
const select = (query = 'SELECT campaign.id FROM campaign') => ({ method: 'POST', body: JSON.stringify({ query }) });

async function makeKey() {
  const pair = (await crypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify'])) as CryptoKeyPair;
  const der = Buffer.from(await crypto.subtle.exportKey('pkcs8', pair.privateKey)).toString('base64');
  const pem = `-----BEGIN PRIVATE KEY-----\n${der.match(/.{1,64}/g)!.join('\n')}\n-----END PRIVATE KEY-----\n`;
  const json = JSON.stringify({ type: 'service_account', project_id: 'proj', private_key_id: 'kid1', private_key: pem, client_email: 'gsc-chat@search-console-mcp-abc123.iam.gserviceaccount.com' });
  return { json, publicKey: pair.publicKey };
}

describe('Google Ads is read only', () => {
  it('lets through only the token exchange and a GAQL SELECT', () => {
    expect(() => assertReadOnly(GOOGLE_TOKEN_URL, { method: 'POST' })).not.toThrow();
    expect(() => assertReadOnly(SEARCH, select())).not.toThrow();
    expect(() => assertReadOnly(SEARCH, select('  select customer.id from customer'))).not.toThrow();
  });

  it.each([
    ['a mutate of everything', 'https://googleads.googleapis.com/v25/customers/1234567890/googleAds:mutate'],
    ['a campaign mutate', 'https://googleads.googleapis.com/v25/customers/1234567890/campaigns:mutate'],
    ['a budget mutate', 'https://googleads.googleapis.com/v25/customers/1234567890/campaignBudgets:mutate'],
    ['a criterion mutate', 'https://googleads.googleapis.com/v25/customers/1234567890/adGroupCriteria:mutate'],
    ['an offline upload', 'https://googleads.googleapis.com/v25/customers/1234567890:uploadClickConversions'],
    ['a new client account', 'https://googleads.googleapis.com/v25/customers/1234567890:createCustomerClient'],
    ['a look-alike host', 'https://googleads.googleapis.com.evil.dk/v25/customers/1234567890/googleAds:searchStream'],
    ['a path trick', `${SEARCH}/../campaigns:mutate`],
  ])('refuses %s before it is sent', async (_, url) => {
    expect(() => assertReadOnly(url, select())).toThrow(GoogleAdsError);
    let sent = 0;
    const guarded = readOnlyFetch(async () => {
      sent++;
      return new Response('{}');
    });
    await expect(guarded(url, select())).rejects.toThrow(/kun læse/);
    expect(sent).toBe(0);
  });

  it('refuses anything but a SELECT, and other methods', () => {
    expect(() => assertReadOnly(SEARCH, { method: 'POST', body: JSON.stringify({ query: 'DELETE campaign' }) })).toThrow(GoogleAdsError);
    expect(() => assertReadOnly(SEARCH, { method: 'POST', body: '{not json' })).toThrow(GoogleAdsError);
    expect(() => assertReadOnly(SEARCH, { method: 'DELETE', body: JSON.stringify({ query: 'SELECT x FROM y' }) })).toThrow(GoogleAdsError);
    expect(() => assertReadOnly(GOOGLE_TOKEN_URL, { method: 'GET' })).toThrow(GoogleAdsError);
  });
});

describe('signing in with the service account', () => {
  it('reads the JSON key and refuses other files', () => {
    expect(() => parseServiceAccountKey('nope')).toThrow(/gyldig JSON/);
    expect(() => parseServiceAccountKey('{"type":"authorized_user"}')).toThrow(/service-konto/);
    expect(() => parseServiceAccountKey('{"type":"service_account","client_email":"x@y.iam.gserviceaccount.com"}')).toThrow(/private nøgle/);
  });

  it('accepts only the gsc-chat service account – at saving and at every sign-in', async () => {
    const { json } = await makeKey();
    expect(parseServiceAccountKey(json).clientEmail).toBe('gsc-chat@search-console-mcp-abc123.iam.gserviceaccount.com');
    for (const other of ['other@search-console-mcp-abc123.iam.gserviceaccount.com', 'gsc-chat@another-project.iam.gserviceaccount.com', 'gsc-chat@search-console-mcp-abc123.iam.gserviceaccount.com.evil.dk']) {
      expect(() => parseServiceAccountKey(json.replace('gsc-chat@search-console-mcp-abc123.iam.gserviceaccount.com', other))).toThrow(/Kun service-kontoen|mangler service-kontoens e-mail/);
    }
    // A key that got past saving some other way is still refused before Google is asked.
    let asked = 0;
    const key = { ...parseServiceAccountKey(json), clientEmail: 'other@x.iam.gserviceaccount.com' };
    await expect(googleAccessToken(async () => (asked++, Response.json({ access_token: 't' })), key, 0)).rejects.toThrow(/Kun service-kontoen/);
    expect(asked).toBe(0);
  });

  it('signs a JWT Google can verify, for the adwords scope', async () => {
    const { json, publicKey } = await makeKey();
    const key = parseServiceAccountKey(json);
    const jwt = await signAssertion(key, Date.UTC(2026, 9, 28, 12));
    const [h, c, s] = jwt.split('.');
    const decode = (p: string) => JSON.parse(Buffer.from(p, 'base64url').toString()) as Record<string, unknown>;
    expect(decode(h!)).toEqual({ alg: 'RS256', typ: 'JWT', kid: 'kid1' });
    expect(decode(c!)).toMatchObject({ iss: 'gsc-chat@search-console-mcp-abc123.iam.gserviceaccount.com', scope: 'https://www.googleapis.com/auth/adwords', aud: GOOGLE_TOKEN_URL });
    const ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', publicKey, Buffer.from(s!, 'base64url'), new TextEncoder().encode(`${h}.${c}`));
    expect(ok).toBe(true);
  });

  it('swaps the JWT for an access token, and says so plainly when Google refuses', async () => {
    const key = parseServiceAccountKey((await makeKey()).json);
    let form = '';
    const ok: FetchLike = async (_, init) => {
      form = String(init?.body);
      return Response.json({ access_token: 'ya29.x', expires_in: 3599 });
    };
    expect(await googleAccessToken(ok, key, 1000)).toEqual({ value: 'ya29.x', expiresAt: 1000 + 3599_000 });
    expect(new URLSearchParams(form).get('grant_type')).toBe('urn:ietf:params:oauth:grant-type:jwt-bearer');
    const refused: FetchLike = async () => Response.json({ error: 'invalid_grant', error_description: 'Invalid JWT Signature.' }, { status: 400 });
    await expect(googleAccessToken(refused, key, 1000)).rejects.toThrow(/Invalid JWT Signature/);
  });
});

describe('reading campaigns', () => {
  const setup = [
    {
      results: [
        {
          campaign: { id: '11', name: 'DK | Shopping | Kontorstole', status: 'ENABLED', advertisingChannelType: 'SHOPPING', biddingStrategyType: 'TARGET_ROAS', targetRoas: { targetRoas: 3.5 } },
          campaignBudget: { amountMicros: '1500000000', explicitlyShared: false, period: 'DAILY' },
        },
        {
          campaign: { id: '12', name: 'DK | Søg | Brand', status: 'PAUSED', advertisingChannelType: 'SEARCH', biddingStrategyType: 'MAXIMIZE_CONVERSIONS', maximizeConversions: { targetCpaMicros: '120000000' } },
          campaignBudget: { amountMicros: '200000000', explicitlyShared: true, period: 'DAILY' },
        },
      ],
    },
  ];
  const stats = [{ results: [{ campaign: { id: '11' }, metrics: { impressions: '1000', clicks: '50', costMicros: '750500000', conversions: 4.5, conversionsValue: 3200.5 } }] }];

  it('combines the setup with the period’s numbers – campaigns without traffic too', async () => {
    const queries: string[] = [];
    const fetchFn: FetchLike = async (url, init) => {
      const q = (JSON.parse(String(init!.body)) as { query: string }).query;
      queries.push(q);
      expect(url).toBe(SEARCH);
      expect((init!.headers as Record<string, string>)['login-customer-id']).toBe('9876543210');
      return Response.json(q.includes('metrics.') ? stats : setup);
    };
    const reader = new GoogleAdsReader(fetchFn, async () => 'token', { customerId: '123-456-7890', loginCustomerId: '987-654-3210' });
    const campaigns = await readCampaigns(reader, '2026-09-28', '2026-10-27');
    expect(queries[1]).toContain("segments.date BETWEEN '2026-09-28' AND '2026-10-27'");
    expect(campaigns).toEqual([
      {
        id: '11',
        name: 'DK | Shopping | Kontorstole',
        status: 'ENABLED',
        channel: 'SHOPPING',
        dailyBudget: 1500,
        sharedBudget: false,
        bidStrategy: 'TARGET_ROAS',
        portfolio: false,
        targetRoas: 3.5,
        targetCpa: null,
        metrics: { impressions: 1000, clicks: 50, spend: 750.5, conversions: 4.5, revenue: 3200.5 },
      },
      {
        id: '12',
        name: 'DK | Søg | Brand',
        status: 'PAUSED',
        channel: 'SEARCH',
        dailyBudget: 200,
        sharedBudget: true,
        bidStrategy: 'MAXIMIZE_CONVERSIONS',
        portfolio: false,
        targetRoas: null,
        targetCpa: 120,
        metrics: { impressions: 0, clicks: 0, spend: 0, conversions: 0, revenue: 0 },
      },
    ]);
  });

  it('moves on to a newer API version when Google answers an old one with its HTML 404 page', async () => {
    const tried: string[] = [];
    const fetchFn: FetchLike = async (url) => {
      tried.push(url.split('/')[3]!);
      return url.includes('/v25/') ? new Response('<html>404</html>', { status: 404 }) : Response.json([{ results: [] }]);
    };
    const reader = new GoogleAdsReader(fetchFn, async () => 'token', { customerId: '1234567890' });
    await reader.rows('SELECT customer.id FROM customer');
    expect(tried).toEqual(['v25', 'v26']);
    expect(reader.version).toBe('v26');
  });

  it('refuses a period that is not two dates (nothing reaches the query)', async () => {
    const reader = new GoogleAdsReader(async () => Response.json([]), async () => 't', { customerId: '1234567890' });
    await expect(readCampaigns(reader, "2026-01-01' OR 1=1", '2026-01-02')).rejects.toThrow(/Ugyldig periode/);
  });

  it('explains the errors a new setup meets', () => {
    const disabled = JSON.stringify({ error: { code: 403, status: 'PERMISSION_DENIED', message: 'Google Ads API has not been used in project 123 before or it is disabled.' } });
    expect(explainGoogleError(403, disabled).message).toMatch(/ikke slået til/);
    const denied = JSON.stringify([{ error: { code: 403, status: 'PERMISSION_DENIED', details: [{ errors: [{ errorCode: { authorizationError: 'USER_PERMISSION_DENIED' }, message: "User doesn't have permission to access customer." }] }] } }]);
    expect(explainGoogleError(403, denied).message).toMatch(/Kun læseadgang/);
  });
});

describe('reading one campaign’s insides', () => {
  /** Answers each GAQL query with the rows of the first matching rule. */
  const fake = (rules: [RegExp, unknown[]][]) => {
    const queries: string[] = [];
    const fetchFn: FetchLike = async (_, init) => {
      const q = (JSON.parse(String(init!.body)) as { query: string }).query;
      queries.push(q);
      return Response.json([{ results: rules.find(([re]) => re.test(q))?.[1] ?? [] }]);
    };
    return { reader: new GoogleAdsReader(fetchFn, async () => 't', { customerId: '1234567890' }), queries };
  };

  it('reads a Shopping product tree with its excluded items', async () => {
    const { reader, queries } = fake([
      [
        /FROM ad_group_criterion/,
        [
          { adGroup: { id: '5', name: 'Alle' }, adGroupCriterion: { criterionId: '1', negative: false, listingGroup: { type: 'SUBDIVISION' } } },
          { adGroup: { id: '5', name: 'Alle' }, adGroupCriterion: { criterionId: '2', negative: true, listingGroup: { type: 'UNIT', parentAdGroupCriterion: 'customers/1234567890/adGroupCriteria/5~1', caseValue: { productItemId: { value: 'SKU-100' } } } } },
          { adGroup: { id: '5', name: 'Alle' }, adGroupCriterion: { criterionId: '3', negative: false, listingGroup: { type: 'UNIT', parentAdGroupCriterion: 'customers/1234567890/adGroupCriteria/5~1', caseValue: { productItemId: {} } } } },
        ],
      ],
    ]);
    const nodes = await readListingGroups(reader, '1234567890', '77', false);
    expect(queries[0]).toContain("campaign.id = 77 AND ad_group_criterion.type = 'LISTING_GROUP'");
    expect(nodes).toEqual([
      { id: '5~1', parentId: null, group: 'Alle', unit: false, excluded: false, dim: 'all', value: '' },
      { id: '5~2', parentId: '5~1', group: 'Alle', unit: true, excluded: true, dim: 'id', value: 'sku-100' },
      { id: '5~3', parentId: '5~1', group: 'Alle', unit: true, excluded: false, dim: 'id', value: '' },
    ]);
  });

  it('reads Performance Max listing groups (excluded units) by asset group', async () => {
    const { reader, queries } = fake([
      [
        /FROM asset_group_listing_group_filter/,
        [
          { assetGroup: { id: '8', name: 'Bestsellere' }, assetGroupListingGroupFilter: { id: '1', type: 'SUBDIVISION' } },
          { assetGroup: { id: '8', name: 'Bestsellere' }, assetGroupListingGroupFilter: { id: '2', type: 'UNIT_EXCLUDED', parentListingGroupFilter: 'customers/1234567890/assetGroupListingGroupFilters/8~1', caseValue: { productBrand: { value: 'Acme' } } } },
        ],
      ],
    ]);
    const nodes = await readListingGroups(reader, '123-456-7890', '77', true);
    expect(queries[0]).toContain("asset_group.campaign = 'customers/1234567890/campaigns/77'");
    expect(nodes[1]).toEqual({ id: '8~2', parentId: '8~1', group: 'Bestsellere', unit: true, excluded: true, dim: 'brand', value: 'acme' });
  });

  it('maps every product dimension', () => {
    expect(googleDimension({ productType: { level: 'LEVEL2', value: 'Stole' } })).toEqual({ dim: 'type2', value: 'stole' });
    expect(googleDimension({ productCustomAttribute: { index: 'INDEX0', value: 'Udsalg' } })).toEqual({ dim: 'label0', value: 'udsalg' });
    expect(googleDimension({ productCondition: { condition: 'USED' } })).toEqual({ dim: 'condition', value: 'used' });
    expect(googleDimension({ productCategory: { level: 'LEVEL1', categoryId: '536' } })).toEqual({ dim: 'category1', value: '536' });
  });

  it('reads negatives on the campaign, its ad groups and its shared lists', async () => {
    const { reader, queries } = fake([
      [/FROM campaign_criterion/, [{ campaignCriterion: { keyword: { text: 'IKEA', matchType: 'EXACT' } } }]],
      [/FROM ad_group_criterion/, [{ adGroup: { name: 'Stole' }, adGroupCriterion: { keyword: { text: 'gaming', matchType: 'PHRASE' } } }]],
      [/FROM campaign_shared_set/, [{ sharedSet: { id: '42', name: 'Generelle' } }]],
      [/FROM shared_criterion/, [{ sharedSet: { id: '42' }, sharedCriterion: { keyword: { text: 'gratis', matchType: 'BROAD' } } }]],
    ]);
    expect(await readNegatives(reader, '77')).toEqual([
      { text: 'ikea', matchType: 'exact', level: 'campaign' },
      { text: 'gaming', matchType: 'phrase', level: 'adgroup', adGroupName: 'Stole' },
      { text: 'gratis', matchType: 'broad', level: 'list', listName: 'Generelle' },
    ]);
    expect(queries[3]).toContain('shared_set.id IN (42)');
  });

  it('adds search terms up across ad groups', async () => {
    const m = (clicks: string, costMicros: string, conversions: number) => ({ impressions: '10', clicks, costMicros, conversions, conversionsValue: conversions * 100 });
    const { reader } = fake([
      [/FROM search_term_view/, [{ searchTermView: { searchTerm: 'Kontorstol' }, metrics: m('3', '30000000', 1) }, { searchTermView: { searchTerm: 'kontorstol' }, metrics: m('2', '20000000', 0) }]],
    ]);
    expect(await readSearchTerms(reader, '77', '2026-10-01', '2026-10-27')).toEqual([{ term: 'kontorstol', impressions: 20, clicks: 5, spend: 50, conversions: 1, revenue: 100 }]);
  });

  it('refuses a campaign id that is not a number (nothing reaches the query)', async () => {
    const { reader, queries } = fake([]);
    await expect(readNegatives(reader, '1 OR 1=1')).rejects.toThrow(/Ugyldigt kampagne-id/);
    expect(queries).toEqual([]);
  });
});
