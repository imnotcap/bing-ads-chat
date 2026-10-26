import '@fontsource-variable/figtree';
import '@fontsource-variable/figtree/wght-italic.css';
import './styles.css';
import { StrictMode } from 'react';
import { createRoot, hydrateRoot } from 'react-dom/client';
import { App } from './App';

const root = document.getElementById('root');
if (root) {
  const page = (
    <StrictMode>
      <App />
    </StrictMode>
  );
  // Every address is prerendered (scripts/prerender.mjs), so the markup is already here
  // and is taken over rather than thrown away and drawn again.
  if (root.firstChild) hydrateRoot(root, page);
  else createRoot(root).render(page);
}
