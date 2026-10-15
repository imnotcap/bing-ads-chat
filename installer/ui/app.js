// Bing Ads Chat installer UI. Talks to src/main.rs through window.__TAURI__.
const { invoke } = window.__TAURI__.core;
const { listen } = window.__TAURI__.event;
const $ = (id) => document.getElementById(id);

// Faint ASCII horizon behind the orb, like the chat's start screen.
(function ascii() {
  const chars = ' =+xX0S8#@';
  const rows = [];
  for (let r = 0; r < 9; r++) {
    let line = '';
    for (let c = 0; c < 64; c++) {
      const band = 1 - Math.abs(r - 4) / 4.5;
      const n = Math.random() * band;
      line += n > 0.35 ? chars[Math.min(chars.length - 1, Math.floor(n * chars.length))] : ' ';
    }
    rows.push(line);
  }
  $('ascii').textContent = rows.join('\n');
})();

function show(id) {
  document.querySelectorAll('.screen').forEach((s) => s.classList.toggle('active', s.id === id));
  document.body.classList.toggle('busy', id === 'progress');
  document.body.classList.toggle('done-state', id === 'done');
}

let pct = 0;
let timer = null;
const STEPS = { extract: ['Pakker ud', 18], install: ['Installerer Bing Ads Chat', 92], done: ['Færdig', 100] };
function setStep(step) {
  const [label, target] = STEPS[step] ?? STEPS.install;
  $('step').textContent = label;
  clearInterval(timer);
  // Eases towards the step's target while the silent installer works.
  timer = setInterval(() => {
    pct += Math.max(0.4, (target - pct) * 0.06);
    if (pct >= target) {
      pct = target;
      clearInterval(timer);
    }
    $('fill').style.width = `${pct}%`;
    $('pct').textContent = `${Math.round(pct)} %`;
  }, 90);
}

async function run() {
  pct = 0;
  show('progress');
  setStep('extract');
  try {
    await invoke('install');
    setStep('done');
    setTimeout(() => show('done'), 500);
  } catch (e) {
    clearInterval(timer);
    $('error-text').textContent = String(e);
    show('error');
  }
}

listen('install-step', (e) => setStep(e.payload));

invoke('info').then((info) => {
  if (info.installed) {
    $('welcome-title').textContent = 'Opdatér Bing Ads Chat';
    $('install').textContent = 'Opdatér';
  }
  $('version').textContent = info.version ? `Version ${info.version} · installeres kun for din Windows-bruger` : 'Installeres kun for din Windows-bruger';
});

$('install').addEventListener('click', run);
$('retry').addEventListener('click', run);
$('launch').addEventListener('click', () => invoke('launch').catch((e) => alert(e)));
for (const id of ['close', 'finish', 'error-close']) $(id).addEventListener('click', () => invoke('quit'));
