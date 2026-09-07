// Áudio 100% procedural (Web Audio): vento, passos, tiro, recarga, besouros, respiração na máscara
import { S, on } from './state.js';

let ctx, master, sfx, amb, windGain, breathGain, breathFilter, noise, started = false;

function makeNoise() {
  const b = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return b;
}

export function initAudio() {
  if (started) { ctx.resume(); return; }
  started = true;
  ctx = new (window.AudioContext || window.webkitAudioContext)();
  master = ctx.createGain(); master.connect(ctx.destination);
  sfx = ctx.createGain(); sfx.connect(master);
  amb = ctx.createGain(); amb.gain.value = 0; amb.connect(master);
  noise = makeNoise();

  // vento: ruído em passa-banda com LFO na frequência
  const wind = ctx.createBufferSource(); wind.buffer = noise; wind.loop = true;
  const wf = ctx.createBiquadFilter(); wf.type = 'bandpass'; wf.frequency.value = 320; wf.Q.value = 0.6;
  const lfo = ctx.createOscillator(); lfo.frequency.value = 0.09;
  const lg = ctx.createGain(); lg.gain.value = 180; lfo.connect(lg); lg.connect(wf.frequency); lfo.start();
  windGain = ctx.createGain(); windGain.gain.value = 0.35;
  wind.connect(wf); wf.connect(windGain); windGain.connect(amb); wind.start();

  // respiração na máscara
  const br = ctx.createBufferSource(); br.buffer = noise; br.loop = true;
  breathFilter = ctx.createBiquadFilter(); breathFilter.type = 'lowpass'; breathFilter.frequency.value = 500;
  breathGain = ctx.createGain(); breathGain.gain.value = 0;
  br.connect(breathFilter); breathFilter.connect(breathGain); breathGain.connect(amb); br.start();

  // drone grave do meteoro
  const drone = ctx.createOscillator(); drone.type = 'sawtooth'; drone.frequency.value = 38;
  const df = ctx.createBiquadFilter(); df.type = 'lowpass'; df.frequency.value = 90;
  const dg = ctx.createGain(); dg.gain.value = 0.12;
  drone.connect(df); df.connect(dg); dg.connect(amb); drone.start();

  on(handle);
  applyMute();
}

export function applyMute() { if (master) master.gain.value = S.muted ? 0 : 1; }
export function fadeAmbience(v) { if (amb) amb.gain.linearRampToValueAtTime(v, ctx.currentTime + 1.2); }

function env(g, t0, a, peak, d) {
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.linearRampToValueAtTime(peak, t0 + a);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + a + d);
}
function burst(peak, dur, type, freq, q = 1, t0 = ctx.currentTime, dest = sfx) {
  const s = ctx.createBufferSource(); s.buffer = noise;
  const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
  const g = ctx.createGain(); env(g, t0, 0.005, peak, dur);
  s.connect(f); f.connect(g); g.connect(dest); s.start(t0); s.stop(t0 + dur + 0.1);
}
function tone(type, f0, f1, peak, dur, t0 = ctx.currentTime, dest = sfx) {
  const o = ctx.createOscillator(); o.type = type;
  o.frequency.setValueAtTime(f0, t0); o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t0 + dur);
  const g = ctx.createGain(); env(g, t0, 0.004, peak, dur);
  o.connect(g); g.connect(dest); o.start(t0); o.stop(t0 + dur + 0.1);
}

export function shot() {
  const t = ctx.currentTime;
  burst(1.0, 0.18, 'lowpass', 900, 0.7, t);
  burst(0.5, 0.06, 'highpass', 2500, 1, t);
  tone('sine', 140, 40, 0.9, 0.25, t);
  burst(0.18, 0.45, 'bandpass', 500, 0.8, t + 0.16); // eco na avenida
  burst(0.08, 0.7, 'bandpass', 300, 0.8, t + 0.4);
}
export function empty() { tone('square', 900, 700, 0.12, 0.04); }
export function reloadClicks() {
  const t = ctx.currentTime;
  tone('square', 700, 300, 0.15, 0.03, t + 0.15);
  tone('square', 500, 250, 0.15, 0.03, t + 0.7);
  burst(0.2, 0.08, 'highpass', 3000, 1, t + 1.6);
  tone('square', 900, 400, 0.2, 0.04, t + 2.2);
}
export function footstep(running) {
  if (!ctx) return;
  burst(running ? 0.35 : 0.22, 0.09, 'lowpass', 700 + Math.random() * 300, 0.5);
  burst(0.12, 0.05, 'highpass', 4000 + Math.random() * 2000, 1);
}
export function pickupSound() { tone('triangle', 500, 800, 0.2, 0.12); tone('triangle', 800, 1200, 0.15, 0.15, ctx.currentTime + 0.1); }
export function hurtSound() { tone('sawtooth', 120, 60, 0.4, 0.3); burst(0.3, 0.2, 'lowpass', 400, 1); }

function pannerAt(x, z) {
  const p = ctx.createPanner();
  p.panningModel = 'HRTF'; p.distanceModel = 'exponential';
  p.refDistance = 3; p.maxDistance = 60; p.rolloffFactor = 1.3;
  p.positionX.value = x; p.positionY.value = 0.6; p.positionZ.value = z;
  p.connect(sfx); return p;
}
export function creature(x, z, attack = false) {
  if (!ctx) return;
  const t = ctx.currentTime; const p = pannerAt(x, z);
  for (let i = 0; i < (attack ? 6 : 3); i++) {
    const s = ctx.createBufferSource(); s.buffer = noise;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 8;
    f.frequency.value = attack ? 1800 + i * 200 : 1200 + Math.random() * 600;
    const g = ctx.createGain(); env(g, t + i * 0.05, 0.004, attack ? 0.9 : 0.4, 0.06);
    s.connect(f); f.connect(g); g.connect(p); s.start(t + i * 0.05); s.stop(t + i * 0.05 + 0.15);
  }
  if (attack) tone('sawtooth', 220, 90, 0.5, 0.4, t, p);
}
export function beastStep(x, z) {
  if (!ctx) return;
  const t = ctx.currentTime; const p = pannerAt(x, z);
  const s = ctx.createBufferSource(); s.buffer = noise;
  const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 2500;
  const g = ctx.createGain(); env(g, t, 0.003, 0.25, 0.05);
  s.connect(f); f.connect(g); g.connect(p); s.start(t); s.stop(t + 0.1);
}
export function hordeCall(x, z) {
  const t = ctx.currentTime; const p = pannerAt(x, z);
  const o = ctx.createOscillator(); o.type = 'sawtooth';
  o.frequency.setValueAtTime(160, t);
  o.frequency.linearRampToValueAtTime(420, t + 0.9);
  o.frequency.exponentialRampToValueAtTime(90, t + 1.8);
  const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 600; f.Q.value = 2;
  const g = ctx.createGain(); env(g, t, 0.2, 0.8, 1.6);
  o.connect(f); f.connect(g); g.connect(p); o.start(t); o.stop(t + 2);
}
export function radioStatic() { burst(0.25, 0.6, 'bandpass', 2000, 0.4); }

export function updateAudio(listener) {
  if (!ctx) return;
  const L = ctx.listener;
  if (L.positionX) {
    L.positionX.value = listener.x; L.positionY.value = 1.6; L.positionZ.value = listener.z;
    L.forwardX.value = -Math.sin(listener.yaw); L.forwardY.value = 0; L.forwardZ.value = -Math.cos(listener.yaw);
    L.upX.value = 0; L.upY.value = 1; L.upZ.value = 0;
  }
  const b = S.mode === 'playing' ? 0.06 + S.exertion * 0.45 : 0;
  breathGain.gain.value = b * (0.35 + 0.65 * S.breath);
  breathFilter.frequency.value = 350 + S.breath * 500 + S.exertion * 600;
  windGain.gain.value = 0.3 + 0.25 * S.siege;
}

function handle(ev) {
  if (!ctx) return;
  switch (ev.type) {
    case 'shot': shot(); break;
    case 'empty': empty(); break;
    case 'reload': reloadClicks(); break;
    case 'pickup': pickupSound(); break;
    case 'damage': hurtSound(); break;
    case 'horde': hordeCall(ev.x, ev.z); break;
    case 'flee': radioStatic(); break;
    case 'eaten': tone('sawtooth', 80, 30, 0.8, 1.2); break;
  }
}
