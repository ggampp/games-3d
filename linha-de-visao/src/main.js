import { LEVELS } from './levels.js';
import { buildLevel } from './core/level.js';
import { ViewController } from './core/view.js';
import { Ball } from './core/ball.js';
import { DEG } from './core/math.js';
import { GameScene } from './render/scene.js';
import { initAudio, sfx, setMuted, isMuted } from './audio.js';

const $ = (id) => document.getElementById(id);
const canvas = $('view');
const scene = new GameScene(canvas);

// ---------- progresso (só conveniência local) ----------
const SAVE_KEY = 'linha-de-visao:v1';
function loadProgress() {
  try {
    const p = JSON.parse(localStorage.getItem(SAVE_KEY));
    if (p && typeof p.unlocked === 'number') return p;
  } catch { /* sem storage */ }
  return { unlocked: 1, stars: {} };
}
const progress = loadProgress();
function saveProgress() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(progress)); } catch { /* sem storage */ }
}

// ---------- estado ----------
let levelIndex = 0;
let level = null;
let view = null;
let ball = null;
let winTimer = -1;
let time = 0;
let lastSnap = null;

function startLevel(i) {
  levelIndex = i;
  level = buildLevel(LEVELS[i]);
  view = new ViewController(level);
  ball = new Ball(level);
  winTimer = -1;
  lastSnap = null;
  scene.loadLevel(level);
  scene.resetPin();
  scene.lastSpin = 0;
  $('lvl-num').textContent = `Fase ${i + 1}/${LEVELS.length}`;
  $('lvl-name').textContent = LEVELS[i].name;
  $('hint').textContent = LEVELS[i].hint;
  updateFalls();
  $('menu').hidden = true;
  $('win').hidden = true;
}

function restart() {
  if (!level) return;
  ball = new Ball(level);
  scene.resetPin();
  scene.lastSpin = 0;
  winTimer = -1;
  $('win').hidden = true;
  updateFalls();
}

function updateFalls() {
  const f = ball?.falls ?? 0;
  $('lvl-falls').textContent = f ? `${f} queda${f > 1 ? 's' : ''}` : '';
}

function starsFor(falls) {
  return falls === 0 ? 3 : falls <= 2 ? 2 : 1;
}

function renderMenu() {
  const box = $('levels');
  box.innerHTML = '';
  LEVELS.forEach((l, i) => {
    const b = document.createElement('button');
    b.className = 'lvl';
    const st = progress.stars[l.id] ?? 0;
    b.innerHTML = `${i + 1}<small>${st ? '★'.repeat(st) + '☆'.repeat(3 - st) : ''}</small>`;
    b.title = l.name;
    b.disabled = i + 1 > progress.unlocked;
    b.addEventListener('click', () => {
      initAudio();
      startLevel(i);
    });
    box.appendChild(b);
  });
}

function showWin() {
  const falls = ball.falls;
  const st = starsFor(falls);
  const id = LEVELS[levelIndex].id;
  progress.stars[id] = Math.max(progress.stars[id] ?? 0, st);
  progress.unlocked = Math.max(progress.unlocked, Math.min(levelIndex + 2, LEVELS.length));
  saveProgress();
  const last = levelIndex === LEVELS.length - 1;
  $('win-title').textContent = last ? 'Fim da linha!' : 'Strike!';
  $('win-stars').innerHTML = '★'.repeat(st) + `<span class="off">${'★'.repeat(3 - st)}</span>`;
  $('win-sub').textContent = falls === 0
    ? 'Sem nenhuma queda.'
    : `${falls} queda${falls > 1 ? 's' : ''}.` + (last ? '' : ' Tente sem cair para 3 estrelas.');
  $('btn-next').textContent = last ? 'Fases' : 'Próxima ▶';
  $('win').hidden = false;
}

function toast(text) {
  const t = $('toast');
  t.textContent = text;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 900);
}

// ---------- input ----------
let drag = null;
canvas.addEventListener('pointerdown', (e) => {
  initAudio();
  drag = { id: e.pointerId, x: e.clientX, y: e.clientY };
  canvas.setPointerCapture(e.pointerId);
  canvas.classList.add('dragging');
});
canvas.addEventListener('pointermove', (e) => {
  if (!drag || e.pointerId !== drag.id || !view) return;
  const dx = e.clientX - drag.x;
  const dy = e.clientY - drag.y;
  drag.x = e.clientX;
  drag.y = e.clientY;
  view.rotate(-dx * 0.0075, dy * 0.006);
});
const endDrag = (e) => {
  if (!drag || e.pointerId !== drag.id) return;
  drag = null;
  canvas.classList.remove('dragging');
  view?.release();
};
canvas.addEventListener('pointerup', endDrag);
canvas.addEventListener('pointercancel', endDrag);

const keys = new Set();
const ROT_KEYS = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'KeyA', 'KeyD', 'KeyW', 'KeyS'];
window.addEventListener('keydown', (e) => {
  initAudio();
  if (ROT_KEYS.includes(e.code)) {
    keys.add(e.code);
    e.preventDefault();
  } else if (e.code === 'Space') {
    e.preventDefault();
    if (!$('win').hidden) $('btn-next').click();
    else ball?.release();
  } else if (e.code === 'KeyR') {
    restart();
  } else if (e.code === 'Escape') {
    renderMenu();
    $('menu').hidden = !$('menu').hidden;
  }
});
window.addEventListener('keyup', (e) => {
  if (!keys.delete(e.code)) return;
  if (!ROT_KEYS.some((k) => keys.has(k))) view?.release();
});
window.addEventListener('blur', () => {
  if (keys.size) view?.release();
  keys.clear();
});

$('btn-release').addEventListener('click', () => {
  initAudio();
  ball?.release();
});
$('btn-restart').addEventListener('click', restart);
$('btn-menu').addEventListener('click', () => {
  renderMenu();
  $('menu').hidden = false;
});
$('menu').addEventListener('click', (e) => {
  if (e.target === $('menu') && level) $('menu').hidden = true;
});
$('btn-sound').addEventListener('click', () => {
  initAudio();
  setMuted(!isMuted());
  $('btn-sound').style.opacity = isMuted() ? 0.4 : 1;
});
$('btn-again').addEventListener('click', restart);
$('btn-next').addEventListener('click', () => {
  if (levelIndex < LEVELS.length - 1) startLevel(levelIndex + 1);
  else {
    $('win').hidden = true;
    renderMenu();
    $('menu').hidden = false;
  }
});
window.addEventListener('resize', () => scene.resize());

// ---------- loop ----------
const EVENT_SFX = { release: 'release', link: 'link', gap: 'gap', bounce: 'bounce', fall: 'fall', respawn: 'respawn' };
let last = performance.now();
function frame(now) {
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;
  time += dt;
  if (level) {
    const kYaw = (keys.has('ArrowLeft') || keys.has('KeyA') ? 1 : 0) - (keys.has('ArrowRight') || keys.has('KeyD') ? 1 : 0);
    const kPitch = (keys.has('ArrowDown') || keys.has('KeyS') ? 1 : 0) - (keys.has('ArrowUp') || keys.has('KeyW') ? 1 : 0);
    if (kYaw || kPitch) view.rotate(kYaw * 95 * DEG * dt, kPitch * 55 * DEG * dt);
    if (!$('menu').hidden) view.rotate(0.18 * dt, 0);

    view.update(dt);
    if (view.snapped !== lastSnap) {
      if (view.snapped) sfx.snap();
      lastSnap = view.snapped;
    }
    ball.update(dt, view);
    for (const ev of ball.events) {
      if (EVENT_SFX[ev.type]) sfx[EVENT_SFX[ev.type]]();
      if (ev.type === 'respawn') updateFalls();
      if (ev.type === 'win') {
        sfx.strike();
        scene.knockPin(ball.fwd);
        toast('Strike!');
        winTimer = 1.4;
      }
    }
    ball.events.length = 0;
    if (winTimer > 0) {
      winTimer -= dt;
      if (winTimer <= 0) showWin();
    }
    $('btn-release').disabled = ball.state !== 'ready';
    scene.sync(dt, { ball, view, time, snappedGap: view.snapped?.kind === 'gap' });
  }
  scene.render();
  requestAnimationFrame(frame);
}

// Fase 1 ao fundo do menu, girando devagar até o jogador escolher.
startLevel(0);
renderMenu();
$('menu').hidden = false;
window.__game = { get view() { return view; }, get ball() { return ball; }, get level() { return level; }, startLevel };
requestAnimationFrame(frame);
