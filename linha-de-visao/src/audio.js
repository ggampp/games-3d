// Sons sintetizados com WebAudio (sem arquivos). Inicializa no primeiro gesto do usuário.
let ctx = null;
let master = null;
let muted = false;

export function initAudio() {
  if (ctx) {
    if (ctx.state === 'suspended') ctx.resume();
    return;
  }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = muted ? 0 : 0.5;
  master.connect(ctx.destination);
}

export function setMuted(m) {
  muted = m;
  if (master) master.gain.value = m ? 0 : 0.5;
}
export const isMuted = () => muted;

function tone(freq, dur, { type = 'sine', vol = 0.3, slide = 0, delay = 0 } = {}) {
  if (!ctx) return;
  const t = ctx.currentTime + delay;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + dur + 0.05);
}

function noise(dur, { vol = 0.3, freq = 1200, delay = 0 } = {}) {
  if (!ctx) return;
  const t = ctx.currentTime + delay;
  const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * dur), ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length) ** 2;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const f = ctx.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.value = freq;
  const g = ctx.createGain();
  g.gain.value = vol;
  src.connect(f).connect(g).connect(master);
  src.start(t);
}

export const sfx = {
  snap: () => tone(1320, 0.07, { type: 'triangle', vol: 0.12 }),
  release: () => tone(520, 0.12, { type: 'triangle', vol: 0.2, slide: 200 }),
  link: () => {
    tone(784, 0.18, { vol: 0.22 });
    tone(1175, 0.28, { vol: 0.18, delay: 0.07 });
  },
  gap: () => tone(330, 0.4, { type: 'sine', vol: 0.15, slide: 330 }),
  bounce: () => tone(160, 0.12, { type: 'square', vol: 0.08, slide: -60 }),
  fall: () => tone(700, 0.9, { type: 'sine', vol: 0.18, slide: -560 }),
  respawn: () => tone(440, 0.1, { type: 'triangle', vol: 0.12 }),
  strike: () => {
    noise(0.5, { vol: 0.8, freq: 900 });
    noise(0.3, { vol: 0.5, freq: 2600, delay: 0.04 });
    [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.5, { vol: 0.16, delay: 0.25 + i * 0.09 }));
  },
};
