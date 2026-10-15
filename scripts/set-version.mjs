#!/usr/bin/env node
/**
 * Gives every CI build its own, ever-increasing version so installed apps see it
 * as an update:  <major>.<minor> from src-tauri/tauri.conf.json + the build number.
 *
 *   node scripts/set-version.mjs 42   → 0.2.42
 *
 * Bump major/minor in tauri.conf.json for bigger jumps (the patch is replaced).
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { appendFileSync } from 'node:fs';

const build = Number(process.argv[2]);
if (!Number.isInteger(build) || build < 0) throw new Error('Brug: node scripts/set-version.mjs <byggenummer>');
const path = new URL('../src-tauri/tauri.conf.json', import.meta.url);
const conf = JSON.parse(readFileSync(path, 'utf8'));
const [major, minor] = conf.version.split('.');
conf.version = `${major}.${minor}.${build}`;
writeFileSync(path, `${JSON.stringify(conf, null, 2)}\n`);
console.log(`Version ${conf.version}`);
if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `version=${conf.version}\n`);
