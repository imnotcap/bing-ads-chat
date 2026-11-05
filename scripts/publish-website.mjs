#!/usr/bin/env node
/**
 * Builds and publishes the website (website/) as its own static Worker.
 *
 *   node scripts/publish-website.mjs
 *
 * Needs CLOUDFLARE_API_TOKEN (+ CLOUDFLARE_ACCOUNT_ID and BING_ADS_CHAT_SITE_URL from
 * scripts/resolve-site.mjs). The site's links to the web app and the installer point at
 * BING_ADS_CHAT_SITE_URL. When the app's domain is active (BING_ADS_CHAT_APP_DOMAIN), the
 * site gets xavieros.dk and www.xavieros.dk – if Cloudflare refuses them (e.g. an old DNS
 * record on the domain), the site is still published on workers.dev and a warning says why.
 */
import { execSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const site = (process.env.BING_ADS_CHAT_SITE_URL ?? '').replace(/\/$/, '');
const appDomain = (process.env.BING_ADS_CHAT_APP_DOMAIN ?? '').trim();
const run = (cmd, env = {}) => execSync(cmd, { cwd: root, stdio: 'inherit', env: { ...process.env, CI: '1', ...env } });

// The site's own domain sits next to the app's (app.xavieros.dk → xavieros.dk).
const zone = /^app\.([a-z0-9.-]+)$/i.exec(appDomain)?.[1];

run('pnpm --dir website install --frozen-lockfile');
// VITE_PUBLIC_URL is where the pages say they live: the canonical link, the sitemap and
// the structured data are built from it, so it has to be the address visitors are served.
run('pnpm --dir website build', {
  ...(site ? { VITE_SITE_URL: site } : {}),
  ...(zone ? { VITE_PUBLIC_URL: `https://${zone}` } : {}),
});

const deploy = 'npx --yes wrangler@4 deploy --config website/wrangler.jsonc';
if (zone) {
  try {
    run(`${deploy} --domain ${zone} --domain www.${zone}`);
    console.log(`✔ Hjemmesiden er udgivet på https://${zone}`);
    process.exit(0);
  } catch {
    console.log(`::warning::Cloudflare tog ikke imod ${zone} til hjemmesiden (fx en gammel DNS-post på domænet) – den udgives på workers.dev i stedet. Se docs/RELEASE.md → Hjemmesiden.`);
  }
}
run(deploy);
console.log('✔ Hjemmesiden er udgivet på workers.dev (se adressen ovenfor).');
