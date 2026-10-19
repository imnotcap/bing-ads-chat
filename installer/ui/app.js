// XavierOS installer – a step-by-step guide. Talks to src/main.rs.
const { invoke } = window.__TAURI__.core;
const { listen } = window.__TAURI__.event;
const { getCurrentWindow } = window.__TAURI__.window;
const $ = (id) => document.getElementById(id);
const ORDER = ['welcome', 'terms', 'location', 'install', 'done'];

const state = { step: 'welcome', info: null, installing: false, installed: false };

function render() {
  const index = ORDER.indexOf(state.step);
  document.querySelectorAll('.page').forEach((p) => p.classList.toggle('active', p.dataset.page === state.step));
  document.querySelectorAll('#steps li').forEach((li, i) => {
    li.classList.toggle('active', i === index);
    li.classList.toggle('complete', i < index);
  });
  const next = $('next');
  $('back').hidden = index === 0 || state.step === 'done' || state.installing || state.installed;
  $('cancel').hidden = state.step === 'done' || state.installed;
  $('cancel').disabled = state.installing;
  next.disabled = state.installing || (state.step === 'terms' && !$('accept').checked);
  next.textContent =
    state.step === 'install' ? (state.installing ? 'Installerer …' : state.info?.installedVersion ? 'Opdatér' : 'Installér') : state.step === 'done' ? 'Afslut' : 'Næste';
  if (state.step === 'install' && !state.installing && !state.installed) fillSummary();
}

function fillSummary() {
  const info = state.info ?? {};
  $('sum-version').textContent = info.installedVersion ? `${info.installedVersion} → ${info.version}` : info.version || '–';
  $('sum-dir').textContent = $('dir').value;
  $('sum-shortcuts').textContent = $('desktop').checked ? 'Start-menu og skrivebord' : 'Start-menu';
  $('sum-size').textContent = `ca. ${info.sizeMb ?? '?'} MB`;
}

async function go(step) {
  if (step === 'install' && state.step === 'location') {
    try {
      await invoke('check_dir', { dir: $('dir').value });
    } catch (e) {
      showDirError(String(e));
      return;
    }
  }
  state.step = step;
  render();
}

function showDirError(msg) {
  const hint = $('dir-hint');
  hint.textContent = msg;
  hint.classList.add('bad');
}

let pct = 0;
let timer = null;
const TARGET = { extract: 15, install: 85, shortcuts: 93, cleanup: 98, done: 100 };
function onStep(step) {
  const keys = ['extract', 'install', 'shortcuts', 'cleanup'];
  const idx = keys.indexOf(step);
  document.querySelectorAll('#log li').forEach((li, i) => {
    li.classList.toggle('complete', step === 'done' || i < idx);
    li.classList.toggle('running', i === idx);
  });
  const target = TARGET[step] ?? pct;
  clearInterval(timer);
  timer = setInterval(() => {
    pct += Math.max(0.3, (target - pct) * 0.07);
    if (pct >= target) {
      pct = target;
      clearInterval(timer);
    }
    $('fill').style.width = `${pct}%`;
  }, 80);
}

async function install() {
  state.installing = true;
  $('error').hidden = true;
  $('summary').hidden = true;
  $('progress').hidden = false;
  $('install-title').textContent = state.info?.installedVersion ? 'Opdaterer …' : 'Installerer …';
  $('install-desc').textContent = 'Det tager under et minut. Luk ikke vinduet.';
  pct = 0;
  onStep('extract');
  render();
  try {
    await invoke('install', { dir: $('dir').value, desktopShortcut: $('desktop').checked });
    onStep('done');
    state.installing = false;
    state.installed = true;
    setTimeout(() => go('done'), 600);
  } catch (e) {
    clearInterval(timer);
    state.installing = false;
    $('install-title').textContent = 'Installationen stoppede';
    $('install-desc').textContent = 'Du kan prøve igen eller gå tilbage og vælge en anden mappe.';
    $('error').textContent = String(e);
    $('error').hidden = false;
    render();
  }
}

$('next').addEventListener('click', async () => {
  if (state.step === 'install') return install();
  if (state.step === 'done') {
    if ($('launch').checked) await invoke('launch', { dir: $('dir').value }).catch(() => invoke('quit'));
    else invoke('quit');
    return;
  }
  go(ORDER[ORDER.indexOf(state.step) + 1]);
});
$('back').addEventListener('click', () => {
  if (state.step === 'install') {
    $('summary').hidden = false;
    $('progress').hidden = true;
    $('error').hidden = true;
    $('install-title').textContent = 'Klar til at installere';
    $('install-desc').textContent = 'Tjek valgene, og klik Installér.';
  }
  go(ORDER[ORDER.indexOf(state.step) - 1]);
});
$('accept').addEventListener('change', render);
$('dir').addEventListener('input', () => {
  $('dir-hint').classList.remove('bad');
  $('dir-hint').textContent = '';
});
$('browse').addEventListener('click', async () => {
  const picked = await window.__TAURI__.dialog.open({ directory: true, title: 'Vælg installationsmappe', defaultPath: $('dir').value });
  if (typeof picked === 'string') {
    // Install into a "XavierOS" folder inside the chosen one (like most installers).
    $('dir').value = /xavieros$/i.test(picked) ? picked : `${picked.replace(/[\\/]+$/, '')}\\XavierOS`;
    $('dir-hint').classList.remove('bad');
    $('dir-hint').textContent = '';
  }
});
const quit = () => !state.installing && invoke('quit');
$('cancel').addEventListener('click', quit);
$('close').addEventListener('click', quit);
$('min').addEventListener('click', () => getCurrentWindow().minimize());

listen('install-step', (e) => onStep(e.payload));

invoke('info').then((info) => {
  state.info = info;
  $('dir').value = info.installDir;
  $('version').textContent = info.version ? `Version ${info.version}` : '';
  if (info.installedVersion) {
    $('welcome-title').textContent = 'Opdatér XavierOS';
    $('welcome-desc').textContent = `Version ${info.installedVersion} er installeret. Guiden opdaterer til version ${info.version} – dine samtaler, indstillinger og nøgler bevares.`;
    $('dir-hint').textContent = 'Den nuværende installation opdateres i samme mappe.';
  } else {
    $('dir-hint').textContent = `Kræver ca. ${info.sizeMb} MB.`;
  }
  render();
});
render();
