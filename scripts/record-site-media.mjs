#!/usr/bin/env node
/**
 * Records the looping clips of the app shown on the website (website/public/media).
 *
 *   node scripts/record-site-media.mjs [scene …]
 *
 * Needs, running locally:
 *   - the Worker:  wrangler dev --config cloudflare/wrangler.jsonc --var DEV_LOGIN:1 …  (:8787)
 *   - the app:     VITE_SITE_URL=http://localhost:8787 VITE_ANTHROPIC_BASE_URL=http://localhost:8790 pnpm dev  (:1430)
 *   - the scripted Claude:  node scripts/site-media-mock.mjs  (:8790; the app runs in demo mode)
 * and Playwright (PLAYWRIGHT_MODULE=<path to playwright/index.mjs> if it isn't installed here)
 * and ffmpeg. Each scene becomes <name>.mp4 (H.264), <name>.webm (VP9) and <name>.jpg (poster).
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'website/public/media');
const APP = process.env.APP_URL ?? 'http://localhost:1430';
const SIZE = { width: 1440, height: 900 };
const OUT_WIDTH = 1280;
mkdirSync(out, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function ask(p, text) {
  const box = p.getByRole('textbox', { name: 'Besked til assistenten' });
  await box.click();
  await box.pressSequentially(text, { delay: 42 });
  await sleep(400);
  await box.press('Enter');
}

/** Moves the mouse smoothly onto an element and clicks it (the recording shows no cursor, but hover states). */
async function press(p, locator) {
  await locator.scrollIntoViewIfNeeded();
  await locator.hover();
  await sleep(350);
  await locator.click();
}

const SCENES = {
  async hero(p) {
    await ask(p, 'Hvordan går kontoen de sidste 30 dage?');
    await p.getByRole('button', { name: /Hæv budgettet på Kontorstole/ }).waitFor({ timeout: 60_000 });
    await sleep(3500);
  },
  async negatives(p) {
    await ask(p, 'Find negative søgeord i søgetermerne');
    const approve = p.getByRole('button', { name: /Tilføj \d+ negative søgeord/ });
    await approve.waitFor({ timeout: 60_000 });
    await sleep(1500);
    const card = p.locator('div.rounded-2xl', { has: p.getByRole('heading', { name: /^Negative søgeord ·/ }) }).last();
    const boxes = card.locator('tbody input[type=checkbox]');
    await press(p, boxes.nth(1));
    await sleep(500);
    await press(p, boxes.nth(4));
    await sleep(500);
    await press(p, card.getByRole('button', { name: /Tilføj manuelle negative søgeord/ }));
    const manual = card.getByRole('textbox', { name: 'Manuelt negativt søgeord' });
    await manual.pressSequentially('gratis', { delay: 60 });
    await manual.press('Enter');
    await sleep(900);
    await press(p, approve);
    await sleep(4500);
  },
  async ads(p) {
    await ask(p, 'Skriv en ny annonce til ergonomiske kontorstole');
    const approve = p.getByRole('button', { name: /^Godkend/ }).last();
    await approve.waitFor({ timeout: 60_000 });
    await sleep(2200);
    const fix = p.getByRole('button', { name: 'Ret', exact: true }).first();
    if (await fix.count()) {
      await press(p, fix);
      await sleep(1200);
    }
    await press(p, approve);
    await sleep(4000);
  },
  async approval(p) {
    await ask(p, 'Hæv budgettet på Kontorstole – Generisk');
    const approve = p.getByRole('button', { name: /^Godkend/ }).last();
    await approve.waitFor({ timeout: 60_000 });
    await sleep(2500);
    await press(p, approve);
    await sleep(4500);
  },
  async dashboard(p) {
    await press(p, p.getByRole('tab', { name: 'Dashboard' }).first());
    await sleep(3500);
    await p.mouse.move(700, 520, { steps: 25 });
    await sleep(800);
    await p.mouse.move(980, 520, { steps: 30 });
    await sleep(1000);
    await p.mouse.wheel(0, 420);
    await sleep(2200);
    await p.mouse.wheel(0, 420);
    await sleep(2500);
  },
  async followup(p) {
    await ask(p, 'Lav en opfølgning om 14 dage, så vi kan se effekten');
    const create = p.getByRole('button', { name: /Opret opfølgning/ });
    await create.waitFor({ timeout: 60_000 });
    await sleep(2200);
    await press(p, create);
    await sleep(4500);
  },
};

/**
 * Records with Chromium's screencast (a JPEG each time the page changes) and turns the
 * frames into a video with their real timing.
 */
async function record(name) {
  const dir = mkdtempSync(join(tmpdir(), 'xos-rec-'));
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM ?? undefined,
    args: ['--use-gl=angle', '--use-angle=swiftshader'],
  });
  const ctx = await browser.newContext({ viewport: SIZE, deviceScaleFactor: 1, locale: 'da-DK' });
  await ctx.addInitScript(() => localStorage.setItem('bac.settings', JSON.stringify({ state: { onboarded: true }, version: 3 })));
  const p = await ctx.newPage();
  p.on('pageerror', (e) => console.log(`  [${name}] pageerror`, String(e).slice(0, 200)));
  await p.goto(APP);
  await p.fill('#dev-email', 'casper@inventarland.dk');
  await p.fill('#dev-name', 'Casper Johansen');
  await p.getByRole('button', { name: 'Log ind', exact: true }).click();
  await p.getByRole('textbox', { name: 'Besked til assistenten' }).waitFor({ timeout: 30_000 });
  await p.keyboard.press('Control+n');
  await sleep(1800);

  const frames = [];
  const cdp = await ctx.newCDPSession(p);
  cdp.on('Page.screencastFrame', ({ data, metadata, sessionId }) => {
    const file = join(dir, `f${String(frames.length).padStart(5, '0')}.jpg`);
    writeFileSync(file, Buffer.from(data, 'base64'));
    frames.push({ file, t: metadata.timestamp });
    void cdp.send('Page.screencastFrameAck', { sessionId }).catch(() => {});
  });
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 92, maxWidth: SIZE.width, maxHeight: SIZE.height, everyNthFrame: 1 });
  await sleep(600);
  await SCENES[name](p);
  await cdp.send('Page.stopScreencast');
  await browser.close();

  // ffconcat: each frame shown until the next one arrived.
  const list = frames.map((f, i) => `file '${f.file}'\nduration ${Math.max(0.01, (frames[i + 1]?.t ?? f.t + 1) - f.t).toFixed(3)}`);
  writeFileSync(join(dir, 'list.txt'), `ffconcat version 1.0\n${list.join('\n')}\nfile '${frames.at(-1).file}'\n`);
  const mp4 = join(out, `${name}.mp4`);
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', join(dir, 'list.txt'), '-an', '-vf', `fps=30,scale=${OUT_WIDTH}:-2,format=yuv420p`, '-c:v', 'libx264', '-preset', 'slow', '-crf', '26', '-movflags', '+faststart', mp4]);
  // VP9 too: browsers without H.264 (e.g. Chromium builds) play the WebM.
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', mp4, '-c:v', 'libvpx-vp9', '-b:v', '0', '-crf', '38', '-row-mt', '1', '-deadline', 'good', '-an', join(out, `${name}.webm`)]);
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-sseof', '-0.3', '-i', mp4, '-frames:v', '1', '-q:v', '4', join(out, `${name}.jpg`)]);
  rmSync(dir, { recursive: true, force: true });
  console.log(`✔ ${name}.mp4 (${frames.length} billeder)`);
}

const wanted = process.argv.slice(2);
for (const name of wanted.length ? wanted : Object.keys(SCENES)) {
  if (!SCENES[name]) throw new Error(`Ukendt scene: ${name}`);
  await record(name);
}
