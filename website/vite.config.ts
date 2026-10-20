import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { rmSync } from 'node:fs';
import { fileURLToPath, URL } from 'node:url';
import { defineConfig, type Plugin } from 'vite';

const outDir = fileURLToPath(new URL('../cloudflare/public', import.meta.url));

/** Removes the previous build's files – but not the installer and update feed next to them. */
function cleanPreviousBuild(): Plugin {
  return {
    name: 'clean-previous-site-build',
    apply: 'build',
    buildStart() {
      for (const dir of ['assets', 'media']) rmSync(`${outDir}/${dir}`, { recursive: true, force: true });
    },
  };
}

/**
 * The website (marketing, prices, download, sign-up and the account area), served by
 * the Cloudflare Worker next to the installer and the update feed. `pnpm site:build`
 * writes it into cloudflare/public without touching the files the release puts there.
 * Locally: `pnpm site:dev` with `wrangler dev` on :8787 for /api.
 */
export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  plugins: [react(), tailwindcss(), cleanPreviousBuild()],
  resolve: {
    alias: {
      '@site': fileURLToPath(new URL('./src', import.meta.url)),
      '@': fileURLToPath(new URL('../src', import.meta.url)),
    },
  },
  server: {
    port: 4620,
    strictPort: true,
    proxy: { '/api': process.env.SITE_API ?? 'http://localhost:8787', '/version.json': process.env.SITE_API ?? 'http://localhost:8787' },
  },
  build: {
    outDir,
    emptyOutDir: false,
    assetsDir: 'assets',
    chunkSizeWarningLimit: 1200,
  },
});
