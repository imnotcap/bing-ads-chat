#!/usr/bin/env node
/**
 * Publishes a signed Windows build to Cloudflare (the static Worker in cloudflare/).
 *
 *   node scripts/publish.mjs [bundleDir] [--no-deploy]
 *
 * bundleDir holds the NSIS installer and its updater signature (*.exe.sig) from
 * `tauri build --config src-tauri/tauri.release.conf.json`. Writes:
 *   cloudflare/public/updates/latest.json            signed update feed the app checks
 *   cloudflare/public/updates/XavierOS_<v>_x64-setup.exe
 *   cloudflare/public/XavierOS-Setup.exe             download page installer
 *   cloudflare/public/Bing-Ads-Chat-Setup.exe        same file under the old name (old links)
 *   cloudflare/public/version.json                   shown on the download page
 *   cloudflare/public/app/                           the web app (bundleDir/app, from pnpm build:web)
 * and deploys the Worker with wrangler (needs CLOUDFLARE_API_TOKEN, and BING_ADS_CHAT_SITE_URL +
 * CLOUDFLARE_ACCOUNT_ID from scripts/resolve-site.mjs).
 * Release notes come from RELEASE_NOTES (CI: the commit message).
 */
import { execSync } from 'node:child_process';
import { copyFileSync, cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const bundleDir = resolve(root, args.find((a) => !a.startsWith('--')) ?? 'release');
const deploy = !args.includes('--no-deploy');

const files = existsSync(bundleDir) ? readdirSync(bundleDir) : [];
const setup = files.find((f) => /_\d+\.\d+\.\d+_x64-setup\.exe$/.test(f));
const sig = files.find((f) => /_x64-setup\.exe\.sig$/.test(f));
if (!setup || !sig) throw new Error(`Mangler den signerede installer (*_x64-setup.exe + .sig) i ${bundleDir}`);
const version = /_(\d+\.\d+\.\d+)_x64-setup\.exe$/.exec(setup)[1];

/** Commit message → short release notes (no co-author/session trailers). */
function notesFrom(message) {
  const lines = (message ?? '')
    .split('\n')
    .filter((l) => !/^(Co-Authored-By|Claude-Session|Signed-off-by):/i.test(l.trim()))
    .join('\n')
    .trim();
  return lines.slice(0, 1500) || 'Forbedringer og fejlrettelser.';
}
const notes = notesFrom(process.env.RELEASE_NOTES);
const pubDate = new Date().toISOString();
if (!process.env.BING_ADS_CHAT_SITE_URL) throw new Error('BING_ADS_CHAT_SITE_URL mangler – kør scripts/resolve-site.mjs først.');
const site = process.env.BING_ADS_CHAT_SITE_URL.replace(/\/$/, '');
const pub = join(root, 'cloudflare/public');
console.log(`Udgiver XavierOS ${version}`);

// Update feed – a versioned file name so no cache can serve an old installer.
const updates = join(pub, 'updates');
rmSync(updates, { recursive: true, force: true });
mkdirSync(updates, { recursive: true });
const updateName = `XavierOS_${version}_x64-setup.exe`;
copyFileSync(join(bundleDir, setup), join(updates, updateName));
const feed = {
  version,
  notes,
  pub_date: pubDate,
  platforms: {
    'windows-x86_64': { signature: readFileSync(join(bundleDir, sig), 'utf8').trim(), url: `${site}/updates/${updateName}` },
  },
};
writeFileSync(join(updates, 'latest.json'), `${JSON.stringify(feed, null, 2)}\n`);

// Download page: the themed installer (installer/) when built, the classic NSIS one as fallback.
const themed = files.find((f) => f === 'XavierOS-Installer.exe');
copyFileSync(join(bundleDir, themed ?? setup), join(pub, 'XavierOS-Setup.exe'));
// The app was called Bing Ads Chat before – old links keep working.
copyFileSync(join(bundleDir, themed ?? setup), join(pub, 'Bing-Ads-Chat-Setup.exe'));
copyFileSync(join(bundleDir, setup), join(pub, 'XavierOS-Setup-klassisk.exe'));
const sizeMb = (statSync(join(bundleDir, themed ?? setup)).size / 1048576).toFixed(1).replace('.', ',');
writeFileSync(join(pub, 'version.json'), `${JSON.stringify({ version, date: pubDate, notes, sizeMb }, null, 2)}\n`);

// The web app (app.xavieros.dk, and /app/ on every address) – same version as the desktop app.
const webApp = join(bundleDir, 'app');
rmSync(join(pub, 'app'), { recursive: true, force: true });
if (existsSync(join(webApp, 'index.html'))) cpSync(webApp, join(pub, 'app'), { recursive: true });
else console.log('::warning::Web-appen mangler i udgivelsen (pnpm build:web) – kun desktop-appen udgives.');

if (deploy) {
  if (!process.env.CLOUDFLARE_API_TOKEN) throw new Error('CLOUDFLARE_API_TOKEN mangler – tilføj den som GitHub-secret (se docs/RELEASE.md).');
  // The workspace accepts Microsoft logins made with the app's own registration.
  // Without it nobody could sign in to the new version – stop before anything is deployed.
  const clientId = (process.env.MS_CLIENT_ID ?? '').trim();
  if (!clientId) throw new Error('MS_CLIENT_ID mangler – tilføj den som GitHub-secret (se docs/RELEASE.md). Intet er udgivet.');
  if (!/^[0-9a-f-]{36}(,[0-9a-f-]{36})*$/i.test(clientId)) throw new Error('MS_CLIENT_ID ligner ikke et Application (client) ID. Intet er udgivet.');
  // The app's own domain (e.g. app.xavieros.dk), when its zone is active on the account (resolve-site.mjs).
  const domain = (process.env.BING_ADS_CHAT_APP_DOMAIN ?? '').trim();
  const domainFlag = /^[a-z0-9.-]+$/i.test(domain) ? ` --domain ${domain}` : '';
  execSync(`npx --yes wrangler@4 deploy --config cloudflare/wrangler.jsonc --var MS_CLIENT_ID:${clientId}${domainFlag}`, {
    cwd: root,
    stdio: 'inherit',
    env: { ...process.env, CI: '1' },
  });
}

console.log(`
✔ XavierOS ${version} er udgivet.
  Download-side:   ${site}
  Opdateringsfeed: ${site}/updates/latest.json
  Web-app:         ${site}/app/
`);
