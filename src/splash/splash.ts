/**
 * XavierOS opening animation (splash.html): the four shards fly in and lock into the X,
 * the logo slides aside and the name appears. Then the window tells the app to show the
 * main window (src-tauri/src/splash.rs) and disappears. Pure CSS animation – this file
 * only lays out the name and times the hand-over.
 */
import '@fontsource-variable/figtree';
import './splash.css';

const NAME = 'XavierOS';
/** When the animation has finished and the app should appear (ms). */
const HAND_OVER = 2650;

type TauriWindow = Window & { __TAURI_INTERNALS__?: { invoke: (cmd: string) => Promise<unknown> } };

function buildWord() {
  const word = document.querySelector<HTMLElement>('.word')!;
  [...NAME].forEach((c, i) => {
    const span = document.createElement('span');
    span.className = i >= NAME.length - 2 ? 'ch os' : 'ch';
    span.textContent = c;
    span.style.setProperty('--i', String(i));
    word.append(span);
  });
  return word;
}

async function start() {
  const word = buildWord();
  // The logo starts in the middle on its own, then slides left as the name comes in.
  await document.fonts.ready.catch(() => undefined);
  const gap = 26;
  document.documentElement.style.setProperty('--shift', `${(word.getBoundingClientRect().width + gap) / 2}px`);

  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  setTimeout(
    () => {
      document.querySelector('.stage')!.classList.add('leave');
      setTimeout(() => void finish(), 380);
    },
    reduced ? 1200 : HAND_OVER,
  );
}

async function finish() {
  const tauri = (window as TauriWindow).__TAURI_INTERNALS__;
  if (tauri) await tauri.invoke('splash_finished').catch(() => undefined);
  // In a browser (preview) start over, so the animation can be watched again.
  else if (new URLSearchParams(location.search).has('loop')) setTimeout(() => location.reload(), 600);
}

void start();
