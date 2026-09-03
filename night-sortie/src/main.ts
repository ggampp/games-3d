import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { FXAAShader } from 'three/examples/jsm/shaders/FXAAShader.js';
import './style.css';
import { buildTerrain, buildLake, terrainHeight, RUNWAY_Z0 } from './world/terrain';
import { buildSky, buildStars, buildMoon, buildCityLights } from './world/sky';
import { Runway } from './world/runway';
import { F35 } from './aircraft/f35';
import { FlightModel } from './aircraft/flightModel';
import { ChaseCamera } from './camera';
import { Tracers, Sparks } from './particles';
import { Input } from './input/gamepad';
import { Haptics } from './input/haptics';
import { Synth } from './audio/synth';
import { Hud, type HudFrame } from './hud/hud';
import { Boot, Menu, controlsOverlayHtml } from './ui/menu';
import { loadSettings, saveSettings, settings, loadBests, saveBest } from './settings';
import type { Mission, MissionCtx, MissionDef } from './missions/mission';

/* ------------------------------------------------------------ renderer */
const canvas = document.getElementById('gl') as HTMLCanvasElement;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x0a0812, 0.000085);
const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.5, 60000);

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.55, 0.6, 0.85);
composer.addPass(bloom);
const fxaa = new ShaderPass(FXAAShader); composer.addPass(fxaa);
composer.addPass(new OutputPass());
function resize() {
  renderer.setSize(innerWidth, innerHeight); composer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  const pr = renderer.getPixelRatio(); (fxaa.material.uniforms.resolution.value as THREE.Vector2).set(1 / (innerWidth * pr), 1 / (innerHeight * pr));
}
window.addEventListener('resize', resize); resize();

/* ------------------------------------------------------------ world */
loadSettings();
const boot = new Boot(document.getElementById('boot')!);
boot.set(0.05, 'BUILDING TERRAIN');
await new Promise((r) => setTimeout(r, 30));
scene.add(buildTerrain(), buildLake());
boot.set(0.35, 'CITY LIGHTS');
await new Promise((r) => setTimeout(r, 20));
const sky = buildSky(), stars = buildStars(), city = buildCityLights();
scene.add(sky, stars, buildMoon(), city);
const runway = new Runway(); scene.add(runway.group);
boot.set(0.55, 'AIRCRAFT');
await new Promise((r) => setTimeout(r, 20));
const hemi = new THREE.HemisphereLight(0x22284a, 0x0a0810, 0.55); scene.add(hemi);
const moon = new THREE.DirectionalLight(0x8aa0ff, 0.55); moon.position.set(-1200, 1800, -2400); moon.castShadow = true;
moon.shadow.mapSize.set(2048, 2048); moon.shadow.camera.near = 10; moon.shadow.camera.far = 6000; moon.shadow.bias = -0.0008;
const sc = moon.shadow.camera; sc.left = sc.bottom = -160; sc.right = sc.top = 160;
scene.add(moon, moon.target);
const jet = new F35(); scene.add(jet.group);
const fm = new FlightModel();
const chase = new ChaseCamera(camera);
const tracers = new Tracers(); scene.add(tracers.mesh);
const sparks = new Sparks(); scene.add(sparks.points);
const input = new Input(canvas);
const haptics = new Haptics();
const synth = new Synth();
const hud = new Hud(document.getElementById('hud')!);
hud.root.classList.add('hidden');
const uiRoot = document.getElementById('ui')!;
const menu = new Menu(uiRoot, input, synth, haptics);
boot.set(0.75, 'COMPILING SHADERS');
await new Promise((r) => setTimeout(r, 20));
// precompile all shaders with the camera looking at the runway
fm.spawnRunway(); jet.group.position.copy(fm.s.pos);
camera.position.set(-40, 14, RUNWAY_Z0 - 60); camera.lookAt(0, 3, RUNWAY_Z0 - 400);
renderer.compile(scene, camera); composer.render();
boot.set(0.95, 'COMPILING SHADERS');
await new Promise((r) => setTimeout(r, 250));
boot.set(1, 'READY');

/* ------------------------------------------------------------ game state */
type State = 'menu' | 'flying' | 'paused' | 'debrief';
let state: State = 'menu';
let mission: Mission | null = null;
let missionDef: MissionDef | null = null;
let time = 0; let endTimer = 0;
const prevPos = new THREE.Vector3();
const playerFwd = new THREE.Vector3();
const gun = { rounds: 600, max: 600, reload: 0, cd: 0 };
let controlsShown = false; const controlsEl = document.createElement('div'); uiRoot.parentElement!.appendChild(controlsEl); controlsEl.style.cssText = 'position:fixed;inset:0;pointer-events:none;';
const ctx: MissionCtx = { scene, fm, hud, synth, haptics, input, sparks, prevPos, time: 0, playerFwd, composite: false };

hud.onSound = () => { settings.sound = !settings.sound; saveSettings(); synth.ensure(); synth.applyVolume(); hud.setSound(settings.sound); };
hud.onControls = () => toggleControls();
hud.onMenu = () => pause();
hud.setSound(settings.sound);
input.onGamepadChange = () => { /* pill updates every frame */ };
menu.onHidPair = () => haptics.pairHID();
menu.onLaunch = (def) => launch(def);
menu.onResume = () => { state = 'flying'; hud.root.classList.remove('hidden'); };
menu.onAbort = () => { endMission(); menu.showSelect(); };

function toggleControls() { controlsShown = !controlsShown; controlsEl.innerHTML = controlsShown ? controlsOverlayHtml(input.padConnected) : ''; }

function launch(def: MissionDef) {
  endMission();
  missionDef = def; mission = def.create();
  gun.rounds = gun.max; gun.reload = 0;
  hud.clearTicker();
  mission.start(ctx);
  input.throttleKey = fm.s.throttle;
  jet.group.position.copy(fm.s.pos); jet.group.quaternion.copy(fm.s.quat);
  prevPos.copy(fm.s.pos); chase.snap();
  menu.hide(); hud.root.classList.remove('hidden');
  state = 'flying'; endTimer = 0;
  synth.ensure();
}
function endMission() {
  if (mission) { mission.dispose(ctx); mission = null; }
  hud.root.classList.add('hidden');
  input.releasePointer();
}
function pause() { if (state !== 'flying') return; state = 'paused'; input.releasePointer(); menu.showPause(); }
function finishMission() {
  if (!mission || !mission.result || !missionDef) return;
  const r = mission.result;
  let isBest = false;
  if (missionDef.id !== 'free' && !(r.failed && missionDef.id !== 'dogfight')) isBest = saveBest(missionDef.id, r.score, { grade: r.grade, wave: r.wave });
  state = 'debrief'; input.releasePointer(); hud.root.classList.add('hidden');
  menu.showDebrief(r, isBest);
}

/* ------------------------------------------------------------ boot → menu */
await boot.hide();
menu.showSelect();
// idle camera for the menu: slow pan along the runway looking at the jet
let menuT = 0;

/* ------------------------------------------------------------ loop */
const timer = new THREE.Timer();
const tmpV = new THREE.Vector3();
function frame() {
  requestAnimationFrame(frame);
  try { step(); } catch (err) { console.error('frame error', err); }
}
function step() {
  timer.update();
  const dt = Math.min(0.05, timer.getDelta());
  time += dt; ctx.time = time;
  const inMenu = state !== 'flying';
  input.update(dt, inMenu);
  haptics.setPad(input.pad);
  (sky.material as THREE.ShaderMaterial).uniforms.uTime.value = time;
  (stars.material as THREE.ShaderMaterial).uniforms.uTime.value = time;
  (city.material as THREE.ShaderMaterial).uniforms.uTime.value = time;
  runway.update(dt);

  if (state === 'menu' || state === 'debrief') {
    menu.update();
    menuT += dt;
    // live runway camera behind the parked jet
    if (state === 'menu' && !mission) { fm.spawnRunway(); }
    jet.group.position.copy(fm.s.pos); jet.group.quaternion.copy(fm.s.quat); jet.update(dt, fm.s);
    const a = menuT * 0.05;
    camera.position.set(Math.sin(a) * 9 - 14, 7.5 + Math.sin(a * 0.7) * 0.8, RUNWAY_Z0 - 120 + 34 + Math.cos(a) * 4);
    camera.up.set(0, 1, 0); camera.lookAt(fm.s.pos.x + 2, fm.s.pos.y + 0.5, fm.s.pos.z - 260);
    camera.fov = 52; camera.updateProjectionMatrix();
    synth.update(dt, fm.s.n2 * 0.6, 0, 0, 0);
  } else if (state === 'paused') {
    menu.update();
  } else if (state === 'flying' && mission) {
    // ---- flight controls
    if (input.take('menu')) { pause(); }
    if (input.take('controls')) toggleControls();
    if (input.take('view')) chase.cycle();
    if (input.take('gear')) { fm.s.gearDown = !fm.s.gearDown; synth.uiMove(); }
    if (input.take('flaps')) { fm.s.flapsDown = !fm.s.flapsDown; synth.uiMove(); }
    if (input.take('brakes')) { fm.s.brakes = !fm.s.brakes; synth.uiMove(); }
    if (input.take('cycle')) mission.cycleTarget(1, ctx);
    if (input.take('cyclePrev')) mission.cycleTarget(-1, ctx);
    if (input.take('clear')) mission.clearTarget();
    if (input.take('pause')) pause();
    input.take('confirm'); input.take('up'); input.take('down'); input.take('left'); input.take('right');
    if (input.keys.has('KeyM')) { input.keys.delete('KeyM'); hud.onSound?.(); }

    prevPos.copy(fm.s.pos);
    if (!fm.s.crashed) fm.update(dt, input.state);
    fm.forward(playerFwd);
    jet.group.position.copy(fm.s.pos); jet.group.quaternion.copy(fm.s.quat); jet.update(dt, fm.s);
    moon.target.position.copy(fm.s.pos); moon.position.copy(fm.s.pos).add(tmpV.set(-600, 900, -1200));

    // ---- gun
    const showWeapon = mission.extras(ctx).showWeapon;
    if (gun.cd > 0) gun.cd -= dt;
    if (gun.reload > 0) { gun.reload -= dt; if (gun.reload <= 0) { gun.reload = 0; gun.rounds = gun.max; synth.reload(); hud.post('BARREL READY', 'bonus', 1.5); } }
    if (showWeapon && input.state.fire && gun.reload <= 0 && !fm.s.crashed) {
      if (gun.rounds <= 0) { gun.reload = 3.3; hud.post('RELOADING  3.3', 'warn', 1.5); }
      else if (gun.cd <= 0) {
        gun.cd = 1 / 50; gun.rounds--;
        const muzzle = fm.s.pos.clone().addScaledVector(playerFwd, 6).addScaledVector(fm.up(new THREE.Vector3()), 0.2).addScaledVector(fm.right(new THREE.Vector3()), -1.2);
        tracers.fire(muzzle, playerFwd, fm.s.vel);
        synth.gun(); haptics.kick(0.35, 0.03);
      }
    }
    input.take('fire');
    const drones = mission.drones();
    tracers.update(dt, (p0, p1) => {
      for (const d of drones) {
        if (!d.alive) continue;
        // segment-sphere test
        const seg = p1.clone().sub(p0); const L = seg.length(); if (L < 1e-3) continue;
        const t = THREE.MathUtils.clamp(d.pos.clone().sub(p0).dot(seg) / (L * L), 0, 1);
        const cp = p0.clone().addScaledVector(seg, t);
        if (cp.distanceTo(d.pos) < d.radius) { const killed = d.hit(); sparks.burst(cp, 8, 14, new THREE.Color(1, 0.85, 0.5), 0.4); mission!.onDroneHit(d, killed, ctx); return true; }
      }
      return false;
    }, terrainHeight, (p) => sparks.burst(p, 3, 6, new THREE.Color(1, 0.7, 0.4), 0.3));
    sparks.update(dt);

    // ---- mission
    mission.update(dt, ctx);
    if (fm.s.crashed && !mission.done) {
      sparks.burst(fm.s.pos, 200, 40, new THREE.Color(1, 0.5, 0.2), 1.5); synth.crash(); haptics.kick(1, 0.6); chase.shake = 3;
      mission.onCrash(ctx);
    }
    if (mission.done && endTimer === 0) endTimer = fm.s.crashed ? 2.2 : 1.6;
    if (endTimer > 0) { endTimer -= dt; if (endTimer <= 0) { endTimer = -1; finishMission(); } }

    // ---- camera / audio / haptics
    chase.update(dt, fm, input.state.camX, input.state.camY);
    synth.update(dt, fm.s.n2, fm.s.abLevel, fm.s.speedKt, fm.s.buffet);
    haptics.setEngine(0.15 + (fm.s.n2 - 0.62) / 0.38 * 0.45 + fm.s.abLevel * 0.4);
    if (fm.s.buffet > 0.3) haptics.buffet(fm.s.buffet);
    haptics.update(dt);

    // ---- HUD
    const ex = mission.extras(ctx);
    const best = loadBests()[missionDef!.id];
    const f: HudFrame = {
      fs: fm.s, fwd: playerFwd, vel: fm.s.vel, pos: fm.s.pos, targets: [], shoot: false,
      rounds: gun.rounds, maxRounds: gun.max, reload: gun.reload, shield: mission.shield, score: mission.score, best: best?.score ?? 0, bestWave: best?.wave,
      headerA: ex.headerA, headerB: ex.headerB, headerC: '', objective: ex.objective, markers: ex.markers, showWeapon: ex.showWeapon, msg: ex.msg, warn: ex.warn,
      gamepad: { connected: input.padConnected, dualsense: input.isDualSense, haptics: settings.haptics > 0, bluetooth: haptics.hid ? haptics.hidBluetooth : /Bluetooth|Wireless/i.test(input.padId) || true, webhid: haptics.connected, battery: haptics.battery },
    };
    mission.frame(f, ctx);
    hud.update(dt, f, camera, ex.ticker);
  }
  composer.render();
}
(window as unknown as { __ns: unknown }).__ns = { get mission() { return mission; }, get state() { return state; }, get time() { return time; }, fm, input, gun };
frame();
