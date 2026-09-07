// NIEVE — Buenos Aires, zona cero. Reimplementação de estudo em Three.js puro.
import * as THREE from 'three';
import { S, GUN, EVAC_TIME, PLAZA, resetRun, pickup, on } from './state.js';
import { buildWorld, pickups } from './world.js';
import { initEnemies, resetEnemies, updateEnemies, director, beetles } from './enemies.js';
import { createPlayer, input } from './player.js';
import * as audio from './audio.js';

const $ = (id) => document.getElementById(id);
const canvas = $('gl');
const isMobile = /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent) || !window.matchMedia('(pointer:fine)').matches;
if (isMobile) { $('menu').classList.add('hidden'); $('mobile').classList.remove('hidden'); }

// ---------- render ----------
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.9;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.autoClear = false;

const scene = new THREE.Scene();
scene.background = new THREE.Color('#0a151e');
scene.fog = new THREE.FogExp2('#0d1a24', 0.024);
const camera = new THREE.PerspectiveCamera(72, innerWidth / innerHeight, 0.05, 700);

scene.add(new THREE.HemisphereLight('#34506a', '#0c1014', 0.9));
const meteorLight = new THREE.DirectionalLight('#ff5a3a', 0.7);
meteorLight.position.set(60, 95, -420); meteorLight.target.position.set(0, 0, -100); scene.add(meteorLight, meteorLight.target);
const moon = new THREE.DirectionalLight('#8fb0c8', 0.35); moon.position.set(-40, 80, 30); scene.add(moon);

const world = buildWorld(scene);
initEnemies(scene);
const player = createPlayer(camera, scene, canvas);

addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });

// ---------- HUD ----------
const hud = {
  hp: $('hp'), track: $('health-track'), stamina: $('stamina-bar'), effort: $('effort'), ammo: $('ammo'), reserve: $('reserve'),
  cartridges: $('cartridges'), ammoLabel: $('ammo-label'), prompt: $('prompt'), promptText: $('prompt').querySelector('span'), notice: $('notice'),
  horde: $('horde-label'), fog: $('visor-fog'), hurt: $('hurt'), flash: $('flash'),
};
for (let i = 0; i < 10; i++) hud.track.appendChild(document.createElement('i'));
for (let i = 0; i < GUN.magazine; i++) hud.cartridges.appendChild(document.createElement('i'));
const hordeText = { quiet: 'EN SILENCIO', recovery: 'EN SILENCIO', warning: 'SE ACERCAN', assault: 'HORDA', siege: 'CERCO · PLAZA' };
function updateHUD() {
  hud.hp.textContent = Math.ceil(S.health);
  [...hud.track.children].forEach((el, i) => el.classList.toggle('on', i < Math.ceil(S.health / 10)));
  hud.stamina.style.width = `${S.stamina}%`;
  hud.effort.textContent = S.exhausted ? 'RECUPERANDO EL ALIENTO' : S.running ? 'ESFUERZO ELEVADO' : 'RESPIRACIÓN ESTABLE';
  hud.effort.className = `tiny-label effort ${S.exhausted ? 'exh' : S.running ? 'hot' : ''}`;
  hud.ammo.textContent = String(S.ammo).padStart(2, '0'); hud.reserve.textContent = String(S.reserve).padStart(2, '0');
  [...hud.cartridges.children].forEach((el, i) => el.classList.toggle('filled', i < S.ammo));
  hud.ammoLabel.textContent = S.reloading > 0 ? 'RECARGANDO…' : S.ammo === 0 ? 'R · RECARGAR' : '12 GA · CARTUCHOS';
  hud.prompt.classList.toggle('hidden', !S.prompt); hud.promptText.textContent = S.prompt;
  hud.notice.classList.toggle('hidden', S.noticeTime <= 0); hud.notice.textContent = S.notice;
  let ht = hordeText[S.hordePhase] || 'EN SILENCIO';
  if (S.hordePhase === 'siege' && S.siegeStart >= 0) ht += ` · ${Math.max(0, Math.ceil(EVAC_TIME - (S.elapsed - S.siegeStart)))}s`;
  if (S.hordePhase === 'assault') ht += ` ${S.hordeNumber} · ${S.enemies}`;
  hud.horde.textContent = ht; hud.horde.className = `horde ${S.hordePhase}`;
  // visor
  hud.fog.style.opacity = S.fog.toFixed(3); hud.fog.style.backdropFilter = `blur(${(S.fog * 6).toFixed(1)}px)`;
  hud.hurt.style.opacity = (S.hurt * 0.9 + (S.health < 30 ? 0.25 + 0.15 * Math.sin(S.elapsed * 6) : 0)).toFixed(3);
  hud.flash.style.opacity = (S.flash * 0.6).toFixed(3);
}

// ---------- overlays / modos ----------
const overlays = { menu: $('menu'), pause: $('pause'), dead: $('dead'), win: $('win') };
function show(name) { for (const k in overlays) overlays[k].classList.toggle('hidden', k !== name); $('hud').classList.toggle('hidden', !!name); }
function setMode(m) { S.mode = m; show(m === 'playing' ? null : m); if (m !== 'playing') document.exitPointerLock?.(); }

function startRun() {
  resetRun(); resetEnemies(); player.reset(); pickupTimers.fill(0);
  audio.initAudio(); audio.fadeAmbience(1);
  setMode('playing'); lock();
}
function lock() { canvas.requestPointerLock?.(); }
function resume() { audio.initAudio(); setMode('playing'); lock(); }

$('btn-start').onclick = startRun;
$('btn-retry').onclick = startRun;
$('btn-again').onclick = () => setMode('menu');
$('btn-restart').onclick = startRun;
$('btn-continue').onclick = resume;
$('btn-how').onclick = () => $('how').classList.toggle('hidden');
$('btn-mute').onclick = (e) => { S.muted = !S.muted; audio.applyMute(); e.target.textContent = S.muted ? 'ACTIVAR SONIDO' : 'SILENCIAR'; };
document.addEventListener('pointerlockchange', () => { if (document.pointerLockElement !== canvas && S.mode === 'playing') setMode('pause'); });
addEventListener('keydown', (e) => { if (e.code === 'Escape' && S.mode === 'pause') resume(); });
canvas.addEventListener('click', () => { if (S.mode === 'playing' && document.pointerLockElement !== canvas) lock(); });

// ---------- pickups ----------
const pickupTimers = new Float32Array(pickups.length);
function updatePickups(dt) {
  let best = -1, bd = 2.7;
  pickups.forEach((p, i) => {
    pickupTimers[i] = Math.max(0, pickupTimers[i] - dt);
    world.pickupMeshes[i].visible = pickupTimers[i] === 0;
    const d = Math.hypot(p.x - player.P.x, p.z - player.P.z);
    if (!pickupTimers[i] && d < bd) { best = i; bd = d; }
    world.pickupMeshes[i].rotation.y += dt * 0.6;
  });
  S.prompt = best < 0 ? '' : pickups[best].kind === 'ammo' ? 'RECOGER MUNICIÓN' : 'RECOGER BOTIQUÍN';
  if (input.interact) { if (best >= 0 && pickup(pickups[best].kind)) pickupTimers[best] = 110; input.interact = false; }
}

// ---------- fim de jogo ----------
on((ev) => {
  if (ev.type === 'eaten') {
    setTimeout(() => { $('dead-stats').textContent = `Sobreviviste ${Math.floor(S.elapsed)} s · ${S.kills} cascarudos abatidos · horda ${S.hordeNumber}`; setMode('dead'); }, 2200);
  }
});
function checkEvac() {
  if (S.hordePhase === 'siege' && S.siegeStart >= 0 && S.elapsed - S.siegeStart >= EVAC_TIME) {
    $('win-stats').textContent = `Llegaste a la Plaza de la República y resististe el cerco. ${Math.floor(S.elapsed)} s en la nieve · ${S.kills} cascarudos abatidos.`;
    setMode('win');
  }
}

// ---------- loop ----------
const clock = new THREE.Clock();
let t = 0;
function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, clock.getDelta()); t += dt;
  if (S.mode === 'menu') {
    // câmera de menu: passeio lento pela avenida olhando o Obelisco
    const a = t * 0.05; camera.position.set(Math.sin(a) * 6, 2.4 + Math.sin(t * 0.3) * 0.2, 60 - (t * 0.4) % 120);
    camera.rotation.set(-0.05, Math.sin(a) * 0.08, 0);
  } else {
    player.update(dt);
    if (S.mode === 'playing') { updatePickups(dt); checkEvac(); }
    updateEnemies(dt, player.P);
  }
  world.update(dt, t, camera.position);
  // névoa mais densa perto da praça e durante o cerco
  const nearPlaza = Math.max(0, 1 - Math.hypot(camera.position.x - PLAZA.x, camera.position.z - PLAZA.z) / 80);
  scene.fog.density = 0.022 + nearPlaza * 0.008 + S.siege * 0.006;
  meteorLight.intensity = 0.6 + 0.25 * Math.sin(t * 0.7) + S.siege * 0.5;
  audio.updateAudio({ x: camera.position.x, z: camera.position.z, yaw: player.P.yaw });
  updateHUD();
  renderer.clear();
  renderer.render(scene, camera);
  if (S.mode !== 'menu') { renderer.clearDepth(); renderer.render(player.gunScene, player.gunCam); }
}
frame();

// hook de QA (Playwright)
window.__nieve = { S, director, beetles, player: player.P, fire: player.fire };
