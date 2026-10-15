/// <reference types="vitest/config" />
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';
import { defineConfig, type Plugin } from 'vite';

const host = process.env.TAURI_DEV_HOST;

/** Hosts the dev proxy may reach. Mirrors the HTTP scope in src-tauri/capabilities/default.json. */
const PROXY_ALLOW = [
  /^https:\/\/[a-z0-9.-]+\.api\.bingads\.microsoft\.com\//,
  /^https:\/\/[a-z0-9.-]+\.api\.sandbox\.bingads\.microsoft\.com\//,
  /^https:\/\/login\.microsoftonline\.com\//,
  /^https:\/\/[a-z0-9.-]+\.blob\.core\.windows\.net\//,
];
const FORWARD_HEADERS = ['authorization', 'developertoken', 'customerid', 'customeraccountid', 'content-type', 'accept'];

/**
 * Browser-only development (`pnpm dev`): Microsoft Advertising does not send CORS
 * headers, so requests go through this tiny allow-listed proxy. Inside the desktop
 * app the Tauri HTTP plugin is used instead and this code never runs.
 */
function microsoftDevProxy(): Plugin {
  return {
    name: 'microsoft-dev-proxy',
    configureServer(server) {
      server.middlewares.use('/__proxy', async (req, res) => {
        try {
          const target = new URL(req.url ?? '', 'http://x').searchParams.get('url') ?? '';
          if (!PROXY_ALLOW.some((re) => re.test(target))) {
            res.statusCode = 403;
            res.end('Host not allowed');
            return;
          }
          const chunks: Buffer[] = [];
          for await (const chunk of req) chunks.push(chunk as Buffer);
          const headers: Record<string, string> = {};
          for (const name of FORWARD_HEADERS) {
            const v = req.headers[name];
            if (typeof v === 'string') headers[name] = v;
          }
          const method = req.method ?? 'GET';
          const upstream = await fetch(target, {
            method,
            headers,
            body: method === 'GET' || method === 'HEAD' ? undefined : Buffer.concat(chunks),
          });
          res.statusCode = upstream.status;
          res.setHeader('content-type', upstream.headers.get('content-type') ?? 'application/octet-stream');
          res.end(Buffer.from(await upstream.arrayBuffer()));
        } catch (err) {
          res.statusCode = 502;
          res.end(String(err));
        }
      });
    },
  };
}

// https://v2.tauri.app/start/frontend/vite/
export default defineConfig({
  plugins: [react(), tailwindcss(), microsoftDevProxy()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  clearScreen: false,
  server: {
    port: 1430,
    strictPort: true,
    host: host || false,
    hmr: host ? { protocol: 'ws', host, port: 1431 } : undefined,
    watch: { ignored: ['**/src-tauri/**'] },
  },
  envPrefix: ['VITE_', 'TAURI_ENV_'],
  build: {
    // WebView2 is evergreen Chromium on Windows.
    target: 'chrome120',
    minify: !process.env.TAURI_ENV_DEBUG,
    sourcemap: !!process.env.TAURI_ENV_DEBUG,
    chunkSizeWarningLimit: 2500,
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: false,
  },
});
