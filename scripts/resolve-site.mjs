#!/usr/bin/env node
/**
 * Finds where the app is published on YOUR Cloudflare account – from the API token alone:
 *   1. the account the token belongs to (or CLOUDFLARE_ACCOUNT_ID if set)
 *   2. the account's workers.dev subdomain (created if the account has none yet)
 * → https://<workerName>.<subdomain>.workers.dev – or the app's own domain once it answers
 *   (release.config.json → appDomain, e.g. https://app.xavieros.dk)
 *
 * Writes the address into src-tauri/tauri.release.conf.json (the update feed the app
 * checks) and, in GitHub Actions, exports BING_ADS_CHAT_SITE_URL + CLOUDFLARE_ACCOUNT_ID.
 *
 *   CLOUDFLARE_API_TOKEN=… node scripts/resolve-site.mjs
 */
import { appendFileSync, readFileSync, writeFileSync } from 'node:fs';

const token = process.env.CLOUDFLARE_API_TOKEN;
if (!token) throw new Error('CLOUDFLARE_API_TOKEN mangler – tilføj den som GitHub-secret (se docs/RELEASE.md).');
const config = JSON.parse(readFileSync(new URL('../release.config.json', import.meta.url), 'utf8'));

async function cf(path, init = {}) {
  const res = await fetch(`https://api.cloudflare.com/client/v4${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...init.headers },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body.success === false) {
    const msg = (body.errors ?? []).map((e) => `${e.code}: ${e.message}`).join('; ') || res.statusText;
    const err = new Error(`Cloudflare ${path}: ${msg}`);
    err.status = res.status;
    err.codes = (body.errors ?? []).map((e) => e.code);
    throw err;
  }
  return body.result;
}

let accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
if (!accountId) {
  const accounts = await cf('/accounts?per_page=50');
  if (!accounts?.length) throw new Error('API-tokenet har ikke adgang til nogen Cloudflare-konto. Brug skabelonen "Edit Cloudflare Workers".');
  if (accounts.length > 1) {
    console.log(`Tokenet har adgang til ${accounts.length} konti – bruger "${accounts[0].name}". Sæt CLOUDFLARE_ACCOUNT_ID for at vælge en anden.`);
  }
  accountId = accounts[0].id;
  console.log(`Cloudflare-konto: ${accounts[0].name}`);
}

let subdomain;
try {
  subdomain = (await cf(`/accounts/${accountId}/workers/subdomain`)).subdomain;
} catch (e) {
  if (e.status !== 404 && !e.codes?.includes(10007)) throw e;
}
if (!subdomain) {
  // A brand-new account has no workers.dev address yet – register one (must be unique on Cloudflare).
  const wanted = `bingadschat-${accountId.slice(0, 8)}`;
  subdomain = (await cf(`/accounts/${accountId}/workers/subdomain`, { method: 'PUT', body: JSON.stringify({ subdomain: wanted }) })).subdomain;
  console.log(`Oprettede workers.dev-adressen ${subdomain}.workers.dev`);
}

const workersDev = `https://${config.workerName}.${subdomain}.workers.dev`;

/*
 * The app's own domain (release.config.json → appDomain, e.g. app.xavieros.dk). Safe in steps:
 *   - the zone (xavieros.dk) is not on this Cloudflare account yet → nothing changes
 *   - the zone is active → the Worker is deployed with the domain attached (publish.mjs)
 *   - the domain answers → the app is built against it, with workers.dev as the update fallback
 * So a build never points the app at an address that doesn't work yet.
 */
let appDomain = '';
let siteUrl = workersDev;
if (config.appDomain) {
  const zoneName = config.appDomain.split('.').slice(-2).join('.');
  try {
    const zones = await cf(`/zones?name=${zoneName}&account.id=${accountId}`);
    const zone = zones?.[0];
    if (!zone) console.log(`::warning::${zoneName} er ikke tilføjet til Cloudflare-kontoen endnu – appen bliver på ${workersDev} (se docs/RELEASE.md → Eget domæne).`);
    else if (zone.status !== 'active') console.log(`::warning::${zoneName} venter på at navneserverne skiftes (status: ${zone.status}) – appen bliver på ${workersDev} indtil videre.`);
    else appDomain = config.appDomain;
  } catch (e) {
    console.log(`::warning::Kunne ikke læse ${zoneName} på Cloudflare (${e.message}). Giv API-tokenet adgang til zonen (Zone → Zone → Read, DNS → Edit, Workers Routes → Edit) – appen bliver på ${workersDev} indtil videre.`);
  }
  if (appDomain) {
    const live = await fetch(`https://${appDomain}/version.json`, { signal: AbortSignal.timeout(10_000) })
      .then((r) => r.ok)
      .catch(() => false);
    if (live) siteUrl = `https://${appDomain}`;
    else console.log(`${appDomain} sættes op ved denne udgivelse – appen skifter til den ved næste udgivelse.`);
  }
}

const confPath = new URL('../src-tauri/tauri.release.conf.json', import.meta.url);
const conf = JSON.parse(readFileSync(confPath, 'utf8'));
// Tried in order: the own domain first, workers.dev if it can't be reached.
conf.plugins.updater.endpoints = [...new Set([`${siteUrl}/updates/latest.json`, `${workersDev}/updates/latest.json`])];
writeFileSync(confPath, `${JSON.stringify(conf, null, 2)}\n`);
console.log(`Udgives på ${siteUrl}${appDomain ? ` (domæne: ${appDomain})` : ''}`);

if (process.env.GITHUB_ENV) appendFileSync(process.env.GITHUB_ENV, `BING_ADS_CHAT_SITE_URL=${siteUrl}\nCLOUDFLARE_ACCOUNT_ID=${accountId}\nBING_ADS_CHAT_APP_DOMAIN=${appDomain}\n`);
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `**Download-side:** ${siteUrl}\n`);
