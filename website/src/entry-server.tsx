/**
 * The page rendered to HTML ahead of time, so every address on the site answers with its
 * own finished document: the title, the description and the text are in the response, not
 * only in the JavaScript. That is what a search engine indexes most reliably, and what a
 * visitor sees before the scripts have loaded.
 *
 * Used by scripts/prerender.mjs after the normal build. The browser hydrates the same
 * markup, so the ASCII fields and the animations take over where the HTML left off.
 */
import { renderToString } from 'react-dom/server';
import { App } from './App';
import { allRoutes, headFor, pathOf } from './lib/site';

export function renderPage(path: string) {
  return renderToString(<App path={path} />);
}

export { allRoutes, headFor, pathOf };
