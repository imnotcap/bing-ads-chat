import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      // The plans the Worker bills by and the app shows. The site quotes the same file,
      // so a price can never be changed in one place and stay wrong in another.
      '@shared': fileURLToPath(new URL('../src/workspace', import.meta.url)),
    },
  },
  server: { port: 5190, strictPort: true, fs: { allow: ['..'] } },
  preview: { port: 5191, strictPort: true },
  build: { target: 'es2022', sourcemap: false },
});
