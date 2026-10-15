#!/usr/bin/env node
/**
 * Finds where the app is published on YOUR Cloudflare account – from the API token alone:
 *   1. the account the token belongs to (or CLOUDFLARE_ACCOUNT_ID if set)
 *   2. the account's workers.dev subdomain (created if the account has none yet)
 * → https://<workerName>.<subdomain>.workers.dev
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

const siteUrl = `https://${config.workerName}.${subdomain}.workers.dev`;
const confPath = new URL('../src-tauri/tauri.release.conf.json', import.meta.url);
const conf = JSON.parse(readFileSync(confPath, 'utf8'));
conf.plugins.updater.endpoints = [`${siteUrl}/updates/latest.json`];
writeFileSync(confPath, `${JSON.stringify(conf, null, 2)}\n`);
console.log(`Udgives på ${siteUrl}`);

if (process.env.GITHUB_ENV) appendFileSync(process.env.GITHUB_ENV, `BING_ADS_CHAT_SITE_URL=${siteUrl}\nCLOUDFLARE_ACCOUNT_ID=${accountId}\n`);
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `**Download-side:** ${siteUrl}\n`);
