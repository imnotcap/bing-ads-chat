/// <reference types="vitest/config" />
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';
import { defineConfig, type Plugin } from 'vite';
import { FORWARD_HEADERS, PROXY_ALLOW } from './src/lib/msProxy';

const host = process.env.TAURI_DEV_HOST;
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
// `--mode web` (pnpm build:web): the browser version the Worker serves on app.xavieros.dk.
export default defineConfig(({ mode }) => {
  const web = mode === 'web';
  return {
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
      // WebView2 is evergreen Chromium on Windows; the web app also runs in Safari and Firefox.
      target: web ? ['chrome120', 'safari16', 'firefox120'] : 'chrome120',
      minify: !process.env.TAURI_ENV_DEBUG,
      sourcemap: !!process.env.TAURI_ENV_DEBUG,
      chunkSizeWarningLimit: 2500,
      // The app, and the opening animation shown in its own transparent window (desktop only).
      rollupOptions: { input: web ? { main: 'index.html' } : ({ main: 'index.html', splash: 'splash.html' } as Record<string, string>) },
    },
    test: {
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.ts'],
      css: false,
    },
  };
});
