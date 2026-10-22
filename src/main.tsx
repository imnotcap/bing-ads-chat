import '@fontsource-variable/figtree';
import '@fontsource-variable/figtree/wght-italic.css';
import './styles/globals.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { finishOAuthPopup } from './lib/platform';

// The web app's Microsoft login pop-up only hands the answer back (and closes).
if (finishOAuthPopup()) {
  document.getElementById('root')!.textContent = 'Login fuldført – du kan lukke dette vindue.';
} else {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
