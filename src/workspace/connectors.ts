/**
 * The data sources the department connects (like Inventarland Dashboard's
 * integrations): what each needs, shown as a connector card in Indstillinger →
 * Forbindelser. Values are stored once in the workspace on Cloudflare and shared by
 * everyone; secret fields never leave Cloudflare again (the app only learns that
 * they are set). The Worker tests every connection against the real API
 * (cloudflare/src/connectors.ts) and checks them again every night.
 *
 * Keep this file free of app imports: the Worker bundles it on its own.
 */

export const CONNECTOR_IDS = [
  'google_ads',
  'meta_ads',
  'linkedin_ads',
  'daisycon',
  'search_console',
  'ga4',
  'ahrefs',
  'serper',
  'magento',
  'klaviyo',
  'pim',
] as const;
export type ConnectorId = (typeof CONNECTOR_IDS)[number];

/**
 * Archived: other marketing channels (Google Ads, Meta, LinkedIn, Daisycon, Klaviyo). The
 * focus is the Microsoft Advertising assistant, so these are out of sight – not in
 * Indstillinger, not tested at night, not given to the assistant. Nothing is deleted:
 * the code, the ids and any keys already saved stay, and taking an id out of this list
 * brings the connector back. SEO tools (Search Console, GA4, Ahrefs, Serper) and the
 * shop's own data (Magento, PIM) are not archived.
 */
export const ARCHIVED_CONNECTOR_IDS: readonly ConnectorId[] = ['google_ads', 'meta_ads', 'linkedin_ads', 'daisycon', 'klaviyo'];
export const isArchivedConnector = (id: string) => (ARCHIVED_CONNECTOR_IDS as readonly string[]).includes(id);
export const ACTIVE_CONNECTOR_IDS: readonly ConnectorId[] = CONNECTOR_IDS.filter((id) => !isArchivedConnector(id));

export type ConnectorGroup = 'ads' | 'seo' | 'shop';

export const CONNECTOR_GROUPS: Record<ConnectorGroup, string> = {
  ads: 'Annoncering',
  seo: 'SEO og analyse',
  shop: 'Webshop, e-mail og produkter',
};

export interface ConnectorField {
  key: string;
  label: string;
  /** Secret: kept on Cloudflare only, never sent back to the app. */
  secret?: boolean;
  required?: boolean;
  /** A JSON key file or other long text. */
  multiline?: boolean;
  placeholder?: string;
  help?: string;
}

export interface ConnectorDef {
  id: ConnectorId;
  name: string;
  /** One line, like Claude's connector list. */
  description: string;
  vendor: string;
  group: ConnectorGroup;
  fields: ConnectorField[];
  /** Short steps to get the values. */
  setup: string[];
  docs?: string;
  /** Connected by logging in (Daisycon): the refresh token comes from the login. */
  oauth?: boolean;
  /** Each test costs the account something (Serper: one search) – not re-checked every night. */
  paidTest?: boolean;
}

const serviceAccount = (what: string): ConnectorField => ({
  key: 'serviceAccount',
  label: 'Service account-nøgle (JSON)',
  secret: true,
  required: true,
  multiline: true,
  placeholder: '{ "type": "service_account", … }',
  help: `Hele indholdet af JSON-nøglefilen. Service accountens e-mail skal have adgang til ${what}.`,
});

export const CONNECTORS: ConnectorDef[] = [
  {
    id: 'google_ads',
    name: 'Google Ads',
    description: 'Kampagner, søgeord, forbrug og konverteringer',
    vendor: 'Google',
    group: 'ads',
    fields: [
      { key: 'customerId', label: 'Kunde-ID', required: true, placeholder: '123-456-7890' },
      { key: 'loginCustomerId', label: 'Manager-konto (MCC) ID', placeholder: '987-654-3210', help: 'Kun nødvendig hvis adgang sker via en managerkonto.' },
      {
        key: 'apiVersion',
        label: 'API-version',
        placeholder: 'tom = automatisk (v25)',
        help: 'Lad feltet stå tomt – appen bruger en understøttet version og skifter selv, hvis Google lukker den.',
      },
      // Same as Inventarland: no developer token – Google retired it on 9 Sep 2026; access follows
      // the Google Cloud project that owns the OAuth client.
      {
        key: 'clientId',
        label: 'OAuth client ID',
        secret: true,
        required: true,
        help: 'Fra det Google Cloud-projekt, hvor Google Ads API er aktiveret med mindst Explorer-adgang (Google Ads API › Overview).',
      },
      { key: 'clientSecret', label: 'OAuth client secret', secret: true, required: true },
      { key: 'refreshToken', label: 'OAuth refresh token', secret: true, required: true },
    ],
    setup: [
      'Aktivér Google Ads API i et Google Cloud-projekt, og opret et OAuth-klient-ID (typen "Desktop").',
      'Sæt OAuth-skærmen til "I produktion", ellers udløber refresh tokens efter 7 dage.',
      'Hent et refresh token for en bruger med adgang til kontoen (fx med OAuth Playground og scopet https://www.googleapis.com/auth/adwords).',
    ],
    docs: 'https://developers.google.com/google-ads/api/docs/start',
  },
  {
    id: 'meta_ads',
    name: 'Meta Ads',
    description: 'Facebook- og Instagram-annoncer, forbrug og køb',
    vendor: 'Meta',
    group: 'ads',
    fields: [
      { key: 'adAccountId', label: 'Annoncekonto-ID', required: true, placeholder: 'act_1234567890' },
      { key: 'apiVersion', label: 'Graph API-version', placeholder: 'v23.0' },
      { key: 'accessToken', label: 'System user access token', secret: true, required: true, help: 'Brug et langtidsgyldigt token fra en systembruger i Meta Business Manager.' },
    ],
    setup: ['Business Manager → Brugere → Systembrugere → opret en systembruger.', 'Tildel annoncekontoen, og generér et token med tilladelsen ads_read.'],
    docs: 'https://developers.facebook.com/docs/marketing-api/overview/authorization',
  },
  {
    id: 'linkedin_ads',
    name: 'LinkedIn Ads',
    description: 'B2B-kampagner, forbrug og leads',
    vendor: 'LinkedIn',
    group: 'ads',
    fields: [
      { key: 'adAccountId', label: 'Annoncekonto-ID', required: true, placeholder: '512345678' },
      { key: 'apiVersion', label: 'API-version (ÅÅÅÅMM)', placeholder: 'tom = automatisk', help: 'Lad den stå tom – appen bruger en understøttet version.' },
      { key: 'accessToken', label: 'Access token', secret: true, required: true, help: 'Med scopet r_ads_reporting (og r_ads). Gyldigt i 60 dage.' },
      { key: 'clientId', label: 'Client ID', secret: true, help: 'Valgfri: med client ID, secret og refresh token fornyes adgangen automatisk.' },
      { key: 'clientSecret', label: 'Client secret', secret: true },
      { key: 'refreshToken', label: 'Refresh token', secret: true },
    ],
    setup: ['Opret en app på linkedin.com/developers med produktet "Advertising API".', 'Generér et token med r_ads og r_ads_reporting for en bruger med adgang til annoncekontoen.'],
    docs: 'https://learn.microsoft.com/linkedin/marketing/getting-started',
  },
  {
    id: 'daisycon',
    name: 'Daisycon',
    description: 'Affiliate-salg og kommission per partner',
    vendor: 'Daisycon',
    group: 'ads',
    oauth: true,
    fields: [
      { key: 'advertiserId', label: 'Annoncør-ID', required: true },
      { key: 'apiBaseUrl', label: 'API-adresse', placeholder: 'https://services.daisycon.com' },
      { key: 'clientId', label: 'OAuth client ID', secret: true, required: true },
      { key: 'clientSecret', label: 'OAuth client secret', secret: true },
      {
        key: 'refreshToken',
        label: 'OAuth refresh token',
        secret: true,
        help: 'Udfyldes automatisk, når du klikker "Log ind hos Daisycon" og logger ind – eller indsæt et, der virker (fx fra Inventarland).',
      },
    ],
    setup: [
      'my.daisycon.com → Indstillinger → API-apps: opret en app med redirect-URI https://login.daisycon.com/oauth/cli.',
      'Gem annoncør-ID og client ID her, klik "Log ind hos Daisycon", og indsæt koden, Daisycon viser.',
    ],
    docs: 'https://developers.daisycon.com/',
  },
  {
    id: 'search_console',
    name: 'Search Console',
    description: 'Organiske søgninger, klik og placeringer i Google',
    vendor: 'Google',
    group: 'seo',
    fields: [
      { key: 'siteUrl', label: 'Ejendom', required: true, placeholder: 'sc-domain:inventarland.dk', help: 'Domæne-ejendom (sc-domain:…) eller URL-præfiks (https://www.…/).' },
      serviceAccount('ejendommen (Search Console → Indstillinger → Brugere og tilladelser)'),
    ],
    setup: ['Opret en service account i Google Cloud, og aktivér "Google Search Console API".', 'Tilføj service accountens e-mail som bruger på ejendommen i Search Console.', 'Download JSON-nøglen, og indsæt indholdet her.'],
    docs: 'https://developers.google.com/webmaster-tools/v1/how-tos/authorizing',
  },
  {
    id: 'ga4',
    name: 'Google Analytics 4',
    description: 'Besøg, kilder og konverteringer på webshoppen',
    vendor: 'Google',
    group: 'seo',
    fields: [{ key: 'propertyId', label: 'Property-ID', required: true, placeholder: '123456789', help: 'GA4 → Administrator → Ejendomsoplysninger.' }, serviceAccount('GA4-ejendommen som "Seer"')],
    setup: ['Opret en service account i Google Cloud, og aktivér "Google Analytics Data API".', 'Tilføj service accountens e-mail som "Seer" på GA4-ejendommen.', 'Download JSON-nøglen, og indsæt indholdet her.'],
    docs: 'https://developers.google.com/analytics/devguides/reporting/data/v1',
  },
  {
    id: 'ahrefs',
    name: 'Ahrefs',
    description: 'Backlinks, søgeordsplaceringer og konkurrenter',
    vendor: 'Ahrefs',
    group: 'seo',
    fields: [{ key: 'apiKey', label: 'API-nøgle', secret: true, required: true }],
    setup: ['Ahrefs → Account settings → API keys → opret en nøgle (kræver et abonnement med API-adgang).'],
    docs: 'https://docs.ahrefs.com/api/docs/introduction',
  },
  {
    id: 'serper',
    name: 'Serper',
    description: 'Google-søgeresultater i realtid',
    vendor: 'Serper',
    group: 'seo',
    paidTest: true,
    fields: [{ key: 'apiKey', label: 'API-nøgle', secret: true, required: true, help: 'En test bruger én søgning (1 kredit).' }],
    setup: ['serper.dev → Dashboard → API key.'],
    docs: 'https://serper.dev/',
  },
  {
    id: 'magento',
    name: 'Magento',
    description: 'Ordrer, omsætning og produkter fra webshoppen',
    vendor: 'Adobe Commerce',
    group: 'shop',
    fields: [
      {
        key: 'baseUrl',
        label: 'Magento-adresse',
        required: true,
        placeholder: 'https://m2.inventarland.dk',
        help: 'Adressen til selve Magento-installationen (samme som bruges til API og admin) – ikke webshoppens forside, hvis den kører separat.',
      },
      { key: 'storeCode', label: 'Store code', placeholder: 'tom = standardbutik' },
      {
        key: 'orderStatuses',
        label: 'Ordrestatusser der tæller som omsætning',
        placeholder: 'pending_xal, complete',
        help: 'Magentos statuskoder adskilt med komma. Tom = Pending XAL og Complete. Annullerede ordrer tæller aldrig med.',
      },
      // Same names and order as Magento shows under System › Integrationer › (integration) › Integrationsoplysninger.
      {
        key: 'consumerKey',
        label: 'Consumer Key',
        secret: true,
        required: true,
        help: 'Opret en integration i Magento-admin under System › Integrationer med læseadgang til ordrer og butikker, aktivér den, og kopiér de fire nøgler.',
      },
      { key: 'consumerSecret', label: 'Consumer Secret', secret: true, required: true },
      { key: 'accessToken', label: 'Access Token', secret: true, required: true },
      { key: 'accessTokenSecret', label: 'Access Token Secret', secret: true, required: true },
      {
        key: 'gaPropertyId',
        label: 'Google Analytics 4 – property-ID',
        placeholder: '123456789',
        help: 'Valgfri – giver besøgende, konverteringsrate og "aktive nu". Findes i GA4 under Administrator › Ejendomsoplysninger.',
      },
      {
        key: 'gaServiceAccount',
        label: 'Google Analytics – service account-nøgle (JSON)',
        secret: true,
        multiline: true,
        help: 'Indsæt hele indholdet af JSON-nøglefilen for en service account, der er tilføjet som "Seer" på GA4-ejendommen.',
      },
    ],
    setup: ['Magento-admin → System → Integrationer → Tilføj ny integration med læseadgang til Salg › Ordrer og Butikker.', 'Aktivér integrationen, og kopiér de fire nøgler.'],
    docs: 'https://developer.adobe.com/commerce/webapi/get-started/authentication/gs-authentication-oauth/',
  },
  {
    id: 'klaviyo',
    name: 'Klaviyo',
    description: 'Nyhedsbreve, flows og e-mailomsætning',
    vendor: 'Klaviyo',
    group: 'shop',
    fields: [
      { key: 'apiKey', label: 'Privat API-nøgle', secret: true, required: true, placeholder: 'pk_…', help: 'Med læseadgang (Read-only).' },
      { key: 'revision', label: 'API-revision', placeholder: '2025-07-15' },
    ],
    setup: ['Klaviyo → Indstillinger → API-nøgler → Opret privat API-nøgle med "Read-only Key".'],
    docs: 'https://developers.klaviyo.com/en/docs/authenticate_',
  },
  {
    id: 'pim',
    name: 'PIM (Chainbox)',
    description: 'Produktdata, attributter og berigelse',
    vendor: 'Chainbox',
    group: 'shop',
    fields: [
      { key: 'baseUrl', label: 'API-adresse', required: true, placeholder: 'https://api.…' },
      { key: 'testPath', label: 'Test-endpoint', placeholder: '/', help: 'En sti, der svarer 200 med nøglen, fx /products?limit=1.' },
      { key: 'headerName', label: 'Header til nøglen', placeholder: 'Authorization', help: 'Authorization sendes som "Bearer <nøgle>"; andre headers (fx X-API-Key) med nøglen alene.' },
      { key: 'apiKey', label: 'API-nøgle', secret: true, required: true },
    ],
    setup: ['Få API-adresse og nøgle fra Chainbox (jeres kontaktperson eller udvikleradgang).'],
  },
];

export const connectorDef = (id: ConnectorId) => CONNECTORS.find((c) => c.id === id)!;
export const isConnectorId = (v: string): v is ConnectorId => (CONNECTOR_IDS as readonly string[]).includes(v);
/** The connectors shown and used: everything that is not archived. */
export const ACTIVE_CONNECTORS: ConnectorDef[] = CONNECTORS.filter((c) => !isArchivedConnector(c.id));

export type ConnectorStatus = 'not_connected' | 'connected' | 'error' | 'needs_login';

/** What the app sees of a connection – never the secret values. */
export interface ConnectorSummary {
  id: ConnectorId;
  status: ConnectorStatus;
  /** E.g. "Inventarland ApS (DKK)". */
  accountLabel: string | null;
  config: Record<string, string>;
  /** Secret fields that have a value. */
  secretsSet: string[];
  lastError: string | null;
  connectedBy: string | null;
  connectedAt: number | null;
  checkedAt: number | null;
}

export interface ConnectorSaveResult {
  connector: ConnectorSummary;
  ok: boolean;
  message: string;
}

/** Daisycon's page that shows the login code (for apps without a web server). */
export const DAISYCON_REDIRECT_URI = 'https://login.daisycon.com/oauth/cli';
