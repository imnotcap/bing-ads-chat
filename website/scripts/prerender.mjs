#!/usr/bin/env node
/**
 * Writes one finished HTML document per address, plus sitemap.xml and robots.txt.
 *
 *   vite build && vite build --ssr src/entry-server.tsx --outDir dist-ssr && node scripts/prerender.mjs
 *
 * Cloudflare serves dist/ as static files and only falls back to index.html for an
 * address that has none, so dist/blog/<slug>/index.html is what a visitor – and a
 * crawler – is actually served for that URL, with the text already in it.
 *
 * The head of each page comes from src/lib/site.ts, the same file the browser uses.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');

const { renderPage, allRoutes, headFor, pathOf } = await import(pathToFileURL(join(root, 'dist-ssr/entry-server.js')).href);

const template = await readFile(join(dist, 'index.html'), 'utf8');

const escape = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** The head of one page: the parts that differ per address, in one block. */
function headTags({ title, description, canonical, ogType, jsonLd }) {
  const tags = [
    `<title>${escape(title)}</title>`,
    `<meta name="description" content="${escape(description)}" />`,
    `<link rel="canonical" href="${canonical}" />`,
    `<meta property="og:type" content="${ogType}" />`,
    `<meta property="og:title" content="${escape(title)}" />`,
    `<meta property="og:description" content="${escape(description)}" />`,
    `<meta property="og:url" content="${canonical}" />`,
    `<meta property="og:site_name" content="XavierOS" />`,
    `<meta property="og:locale" content="da_DK" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${escape(title)}" />`,
    `<meta name="twitter:description" content="${escape(description)}" />`,
  ];
  for (const data of jsonLd) {
    // `<` cannot appear raw inside a script element, whatever it is escaped as elsewhere.
    tags.push(`<script type="application/ld+json">${JSON.stringify(data).replace(/</g, '\\u003c')}</script>`);
  }
  return tags.join('\n    ');
}

const pages = allRoutes();
for (const route of pages) {
  const path = pathOf(route);
  const head = headFor(route);
  const html = renderPage(path);
  const page = template
    // The fallback title and description in index.html are replaced, not added to, or the
    // page would carry two of each and a crawler would have to pick.
    .replace(/[ \t]*<title>[\s\S]*?<\/title>\n?/, '')
    .replace(/[ \t]*<meta name="description"[\s\S]*?\/>\n?/, '')
    .replace('</head>', `  ${headTags(head)}\n  </head>`)
    .replace('<div id="root"></div>', `<div id="root">${html}</div>`);
  const file = join(dist, path === '/' ? 'index.html' : `${path.replace(/^\/|\/$/g, '')}/index.html`);
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, page);
  console.log(`  ${path} → ${(Buffer.byteLength(page) / 1024).toFixed(0)} kB`);
}

const origin = headFor({ kind: 'home' }).canonical.replace(/\/$/, '');
const urls = pages
  .map((route) => {
    const head = headFor(route);
    const date = route.kind === 'post' ? (route.post.updated ?? route.post.date) : new Date().toISOString().slice(0, 10);
    const priority = route.kind === 'home' ? '1.0' : route.kind === 'blog' ? '0.8' : '0.7';
    return `  <url>\n    <loc>${head.canonical}</loc>\n    <lastmod>${date}</lastmod>\n    <priority>${priority}</priority>\n  </url>`;
  })
  .join('\n');
await writeFile(join(dist, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`);
await writeFile(join(dist, 'robots.txt'), `User-agent: *\nAllow: /\n\nSitemap: ${origin}/sitemap.xml\n`);

console.log(`✔ ${pages.length} sider skrevet, plus sitemap.xml og robots.txt (${origin})`);
