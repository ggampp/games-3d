import * as THREE from 'three';
import type { FlightState } from '../aircraft/flightModel';
import { settings } from '../settings';

export interface HudTarget { world: THREE.Vector3; label: string; color: string; rangeKm: number; closureKt: number; locked: boolean }
export interface HudFrame {
  fs: FlightState; fwd: THREE.Vector3; vel: THREE.Vector3; pos: THREE.Vector3;
  targets: HudTarget[]; lead?: THREE.Vector3; shoot: boolean;
  rounds: number; maxRounds: number; reload: number; // seconds remaining (0 = ready)
  shield: number; score: number; best: number; bestWave?: number;
  headerA: string; headerB: string; headerC: string; // e.g. "WAVE 1 · 3 DRONES", "3 LEFT · 3 AIRBORNE"
  objective: string[];
  markers: Array<{ world: THREE.Vector3; label: string; color: string }>; // gates / pylons etc.
  gamepad: { connected: boolean; dualsense: boolean; haptics: boolean; bluetooth: boolean; webhid: boolean; battery: number };
  warn?: string; msg?: string;
  showWeapon: boolean;
}

function el(tag: string, cls: string, parent: HTMLElement, html = '') { const e = document.createElement(tag); e.className = cls; e.innerHTML = html; parent.appendChild(e); return e; }
const fmt = (n: number) => Math.round(n).toLocaleString('en-US').replace(/,/g, ' ');

export class Hud {
  root: HTMLElement;
  private tl: HTMLElement; private ticker: HTMLElement; private banner: HTMLElement; private pill: HTMLElement; private tapeS: HTMLElement; private tapeA: HTMLElement;
  private stripS: HTMLElement; private stripA: HTMLElement; private boxS: HTMLElement; private boxA: HTMLElement; private bl: HTMLElement; private br: HTMLElement; private wpn: HTMLElement; private hintbar: HTMLElement; private brr: HTMLElement; private obj: HTMLElement; private msg: HTMLElement; private warn: HTMLElement;
  private canvas: HTMLCanvasElement; private ctx: CanvasRenderingContext2D;
  private tickerLines: Array<{ text: string; cls: string; t: number }> = [];
  private bannerT = 0;
  private soundBtn: HTMLButtonElement;
  onSound?: () => void; onControls?: () => void; onMenu?: () => void;
  private lastTapeKey = '';

  constructor(root: HTMLElement) {
    this.root = root;
    this.canvas = document.createElement('canvas'); this.canvas.className = 'hudc'; root.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d')!;
    this.tl = el('div', 'tl', root);
    this.ticker = el('div', 'ticker', root);
    this.banner = el('div', 'banner', root, '<div class="w"></div><div class="n"></div>');
    const tr = el('div', 'tr', root);
    this.pill = el('div', 'pill', tr);
    const chrome = el('div', 'chrome', tr);
    this.soundBtn = document.createElement('button'); this.soundBtn.textContent = 'SOUND ON'; this.soundBtn.onclick = () => this.onSound?.(); chrome.appendChild(this.soundBtn);
    const cb = document.createElement('button'); cb.innerHTML = 'CONTROLS<span>H</span>'; cb.onclick = () => this.onControls?.(); chrome.appendChild(cb);
    const mb = document.createElement('button'); mb.innerHTML = 'MENU<span>ESC</span>'; mb.onclick = () => this.onMenu?.(); chrome.appendChild(mb);
    this.tapeS = el('div', 'tape spd', root, '<div class="lab">KT</div>'); this.stripS = el('div', 'strip', this.tapeS); this.boxS = el('div', 'box', this.tapeS);
    this.tapeA = el('div', 'tape alt', root, '<div class="lab">FT</div>'); this.stripA = el('div', 'strip', this.tapeA); this.boxA = el('div', 'box', this.tapeA);
    this.bl = el('div', 'bl', root); this.br = el('div', 'br', root);
    this.wpn = el('div', 'wpn', root);
    this.hintbar = el('div', 'hintbar', root);
    this.brr = el('div', 'brr', root);
    this.obj = el('div', 'obj', root);
    this.msg = el('div', 'msg', root); this.warn = el('div', 'warnc', root);
    this.buildTapes();
    window.addEventListener('resize', () => this.resize()); this.resize();
  }
  private resize() { const dpr = Math.min(2, window.devicePixelRatio || 1); this.canvas.width = innerWidth * dpr; this.canvas.height = innerHeight * dpr; this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0); }
  private buildTapes() {
    // speed: 0..1200 kt, 10 kt per tick, pixel per kt = 1.6
    const ppk = 1.6; let h = '';
    for (let v = 0; v <= 1200; v += 10) { const maj = v % 50 === 0; h += `<div class="tick${maj ? ' maj' : ''}" style="top:${-v * ppk}px">${maj ? `<span>${v}</span>` : ''}</div>`; }
    this.stripS.innerHTML = h;
    const ppf = 0.11; h = '';
    for (let v = -1000; v <= 45000; v += 100) { const maj = v % 500 === 0; h += `<div class="tick${maj ? ' maj' : ''}" style="top:${-v * ppf}px">${maj ? `<span>${v}</span>` : ''}</div>`; }
    this.stripA.innerHTML = h;
  }
  setSound(on: boolean) { this.soundBtn.textContent = on ? 'SOUND ON' : 'SOUND OFF'; }
  post(text: string, cls: 'main' | 'kill' | 'bonus' | 'warn' = 'main', life = 2.6) { this.tickerLines.push({ text, cls, t: life }); if (this.tickerLines.length > 4) this.tickerLines.shift(); }
  showBanner(big: string, small: string) { (this.banner.children[0] as HTMLElement).textContent = big; (this.banner.children[1] as HTMLElement).textContent = small; this.banner.classList.add('show'); this.bannerT = 2.6; }
  clearTicker() { this.tickerLines.length = 0; }

  update(dt: number, f: HudFrame, cam: THREE.PerspectiveCamera, persistentTicker: string) {
    const fs = f.fs;
    // --- top-left
    const pips = [0, 1, 2].map((i) => `<span class="pip${i < f.shield ? ' on' : ''}"></span>`).join('');
    this.tl.innerHTML = `<div class="t1">NIGHT AIR RACE   COURSE 7</div><div class="t2">NIGHT SORTIE</div>${f.headerA}\n${f.headerB}\n<span>${fmt(f.score)} PTS</span>     <span class="gold">BEST ${fmt(f.best)}${f.bestWave ? ' · WAVE ' + f.bestWave : ''}</span>\nSHIELD  <span class="pips">${pips}</span>`;
    // --- ticker
    for (const l of this.tickerLines) l.t -= dt;
    this.tickerLines = this.tickerLines.filter((l) => l.t > 0);
    let th = persistentTicker ? `<div class="main">${persistentTicker}</div>` : '';
    for (const l of this.tickerLines) th += `<div class="${l.cls}" style="opacity:${Math.min(1, l.t * 2)}">${l.text}</div>`;
    this.ticker.innerHTML = th;
    if (this.bannerT > 0) { this.bannerT -= dt; if (this.bannerT <= 0) this.banner.classList.remove('show'); }
    // --- pill
    const g = f.gamepad;
    if (g.connected) {
      this.pill.classList.remove('off');
      const bat = g.battery >= 0 ? ` · ${g.battery}%` : '';
      this.pill.innerHTML = `<span class="dot">●</span> CONNECTED  ·  HAPTICS ${g.haptics ? 'ON' : 'OFF'}<span class="dim">${g.dualsense ? 'DualSense' : 'Gamepad'} · ${g.bluetooth ? 'Bluetooth' : 'USB'}${g.webhid ? ' · WebHID' : ''}${bat}</span>`;
    } else this.pill.classList.add('off');
    // --- tapes
    const showTapes = settings.showTapes;
    this.tapeS.style.display = this.tapeA.style.display = showTapes ? '' : 'none';
    if (showTapes) {
      this.stripS.style.transform = `translateY(${fs.speedKt * 1.6}px)`; this.boxS.textContent = String(Math.round(fs.speedKt));
      this.stripA.style.transform = `translateY(${fs.altFt * 0.11}px)`; this.boxA.textContent = String(Math.round(fs.altFt));
    }
    const mil = (fs.n2 - 0.62) / 0.38; const ab = fs.ab;
    const thrPct = Math.round(fs.throttle * 100);
    const barPct = ab ? 100 : Math.round(Math.max(0, mil) * 100);
    const tapeKey = `${Math.round(fs.mach * 100)}|${fs.g.toFixed(1)}|${barPct}|${thrPct}|${Math.round(fs.n2 * 100)}|${Math.round(fs.fuel)}|${ab}`;
    if (tapeKey !== this.lastTapeKey) {
      this.lastTapeKey = tapeKey;
      this.bl.innerHTML = `M  ${fs.mach.toFixed(2)}\nG  ${fs.g.toFixed(1)}\n<span class="${ab ? 'ab-txt' : ''}">${ab ? 'A/B' : 'MIL'}</span><span class="bar${ab ? ' ab' : ''}"><i style="width:${barPct}%"></i></span>\n<span class="${ab ? 'ab-txt' : ''}">${thrPct}%</span>\nN2 ${Math.round(fs.n2 * 100)}\nFUEL ${Math.round(fs.fuel)}`;
    }
    const vs = Math.round(fs.vsFpm / 10) * 10;
    this.br.innerHTML = `R ${Math.round(fs.radarAltFt)}\n${vs >= 0 ? '+' : '−'}${Math.abs(vs)}\nGEAR ${fs.gearPos > 0.97 ? 'DOWN' : fs.gearPos < 0.03 ? 'UP' : 'TRANS'}\nFLAPS ${fs.flapsDown ? 'DOWN' : 'UP'}${fs.brakes ? '\nBRAKES' : ''}`;
    // --- weapon
    if (f.showWeapon) {
      this.wpn.style.display = '';
      const pct = (f.rounds / f.maxRounds) * 100;
      const status = f.reload > 0 ? `<span class="rel">RELOADING ${f.reload.toFixed(1)}</span>` : `${f.rounds}`;
      this.wpn.innerHTML = `<div class="row2"><span>ROUNDS</span><span>${status}</span></div><div class="wbar"><i style="width:${f.reload > 0 ? (1 - f.reload / 3.3) * 100 : pct}%"></i></div><div class="row2"><span>BARREL</span><span>${f.reload > 0 ? 'RELOADING 3 / 3' : 'TRAINING ROUNDS'}</span></div>`;
    } else this.wpn.style.display = 'none';
    // --- hints
    this.hintbar.innerHTML = g.connected
      ? `<b>R2</b> fire · <b>L1 R1</b> cycle drone · <b>○</b> clear · <b>L2</b> throttle · <b>△</b> view · <b>□</b> gear · <b>Options</b> menu`
      : `<b>Space / left mouse</b> fire · <b>Tab</b> cycle drone · <b>C</b> clear · <b>Shift / Ctrl</b> throttle · <b>V</b> view · <b>G</b> gear · <b>F</b> flaps · <b>B</b> brakes`;
    if (g.connected) { const b = g.battery >= 0 ? g.battery : 100; this.brr.innerHTML = `${g.dualsense ? 'DUALSENSE' : 'GAMEPAD'}  ·  ${g.bluetooth ? 'BLUETOOTH' : 'USB'}<span class="bat"><i style="width:${b * 0.2}px"></i></span>`; }
    else this.brr.innerHTML = 'KEYBOARD  ·  MOUSE';
    this.obj.innerHTML = f.objective.map((l) => l.replace(/^\*(.*)$/, '<span class="k">$1</span>')).join('\n');
    this.msg.textContent = f.msg ?? ''; this.warn.textContent = f.warn ?? '';
    this.drawCanvas(f, cam);
  }

  private project(p: THREE.Vector3, cam: THREE.PerspectiveCamera, out = new THREE.Vector3()) {
    out.copy(p).project(cam);
    const behind = out.z > 1;
    return { x: (out.x + 1) / 2 * innerWidth, y: (1 - out.y) / 2 * innerHeight, behind };
  }

  private drawCanvas(f: HudFrame, cam: THREE.PerspectiveCamera) {
    const c = this.ctx; const W = innerWidth, H = innerHeight;
    c.clearRect(0, 0, W, H);
    const col = getComputedStyle(document.documentElement).getPropertyValue('--hud').trim() || '#7ff3ff';
    const gold = '#ffd36a';
    c.lineWidth = 1.2; c.strokeStyle = col; c.fillStyle = col; c.shadowColor = col; c.shadowBlur = 6;
    c.font = '11px "JetBrains Mono", monospace'; c.textAlign = 'center'; c.textBaseline = 'middle';
    const fs = f.fs; const cx = W / 2, cy = H / 2;
    // pixels per degree from the camera's vertical fov
    const ppd = H / cam.fov;
    // --- heading tape (top centre)
    const tapeY = 72, tapeW = 360;
    c.save(); c.beginPath(); c.rect(cx - tapeW / 2, tapeY - 22, tapeW, 44); c.clip();
    const pxPerDeg = 6;
    for (let d = -28; d <= 28; d++) {
      const hdg = Math.round(fs.headingDeg) + d;
      const x = cx + (hdg - fs.headingDeg) * pxPerDeg;
      const h360 = ((hdg % 360) + 360) % 360;
      if (h360 % 10 === 0) {
        c.beginPath(); c.moveTo(x, tapeY + 8); c.lineTo(x, tapeY + 16); c.stroke();
        const label = h360 === 0 ? 'N' : h360 === 90 ? 'E' : h360 === 180 ? 'S' : h360 === 270 ? 'W' : String(h360 / 10).padStart(2, '0');
        c.fillText(label, x, tapeY - 2);
      } else if (h360 % 5 === 0) { c.beginPath(); c.moveTo(x, tapeY + 11); c.lineTo(x, tapeY + 16); c.stroke(); }
    }
    c.restore();
    c.beginPath(); c.moveTo(cx - tapeW / 2, tapeY + 17); c.lineTo(cx + tapeW / 2, tapeY + 17); c.stroke();
    c.strokeRect(cx - 22, tapeY + 20, 44, 18); c.fillStyle = '#000a'; c.fillRect(cx - 21, tapeY + 21, 42, 16); c.fillStyle = col;
    c.font = 'bold 12px "JetBrains Mono", monospace'; c.fillText(String(Math.round(fs.headingDeg) % 360).padStart(3, '0'), cx, tapeY + 29); c.font = '11px "JetBrains Mono", monospace';
    // --- attitude indicator (small circle left of tape)
    const ax = cx - tapeW / 2 - 70, ay = tapeY + 6, ar = 24;
    c.save(); c.beginPath(); c.arc(ax, ay, ar, 0, Math.PI * 2); c.stroke(); c.clip();
    c.translate(ax, ay); c.rotate(-THREE.MathUtils.degToRad(fs.rollDeg));
    const py = fs.pitchDeg * 0.9;
    c.fillStyle = 'rgba(127,243,255,0.10)'; c.fillRect(-ar, py, ar * 2, ar * 2);
    c.strokeStyle = col; c.beginPath(); c.moveTo(-ar, py); c.lineTo(ar, py); c.stroke();
    for (const p of [-20, -10, 10, 20]) { c.beginPath(); c.moveTo(-6, py - p * 0.9); c.lineTo(6, py - p * 0.9); c.stroke(); }
    c.restore();
    c.fillStyle = col; c.beginPath(); c.moveTo(ax - 10, ay); c.lineTo(ax - 3, ay); c.lineTo(ax, ay + 3); c.lineTo(ax + 3, ay); c.lineTo(ax + 10, ay); c.stroke();
    c.font = '10px "JetBrains Mono", monospace'; c.textAlign = 'right';
    c.fillText(`α ${fs.alpha >= 0 ? '' : '−'}${Math.abs(THREE.MathUtils.radToDeg(fs.alpha)).toFixed(1)}`, ax - 34, ay - 6);
    c.fillText(`${Math.abs(Math.round(fs.rollDeg))}° ${fs.rollDeg < -0.5 ? 'L' : fs.rollDeg > 0.5 ? 'R' : ' '}  ${fs.pitchDeg >= 0 ? '' : '−'}${Math.abs(Math.round(fs.pitchDeg))}°`, ax - 34, ay + 8);
    c.textAlign = 'center'; c.font = '11px "JetBrains Mono", monospace';
    // --- pitch ladder (rotated by roll, offset by pitch)
    c.save(); c.translate(cx, cy); c.rotate(-THREE.MathUtils.degToRad(fs.rollDeg));
    c.beginPath(); c.rect(-260, -220, 520, 440); c.clip();
    for (let p = -90; p <= 90; p += 5) {
      const y = (fs.pitchDeg - p) * ppd;
      if (Math.abs(y) > 240) continue;
      const wdt = p === 0 ? 150 : 60; const gap = 38;
      c.globalAlpha = p === 0 ? 1 : 0.7; c.setLineDash(p < 0 ? [6, 4] : []);
      c.beginPath(); c.moveTo(-wdt - gap, y); c.lineTo(-gap, y); c.moveTo(gap, y); c.lineTo(wdt + gap, y);
      if (p !== 0) { const tick = p > 0 ? 6 : -6; c.moveTo(-gap, y); c.lineTo(-gap, y + tick); c.moveTo(gap, y); c.lineTo(gap, y + tick); }
      c.stroke(); c.setLineDash([]);
      if (p !== 0) { c.fillText(String(Math.abs(p)), -wdt - gap - 14, y); c.fillText(String(Math.abs(p)), wdt + gap + 14, y); }
    }
    c.globalAlpha = 1; c.restore();
    // --- gun cross (boresight)
    const bore = this.project(f.pos.clone().addScaledVector(f.fwd, 1500), cam);
    if (!bore.behind) {
      c.beginPath(); c.moveTo(bore.x - 12, bore.y); c.lineTo(bore.x - 4, bore.y); c.moveTo(bore.x + 4, bore.y); c.lineTo(bore.x + 12, bore.y); c.moveTo(bore.x, bore.y - 12); c.lineTo(bore.x, bore.y - 4); c.moveTo(bore.x, bore.y + 4); c.lineTo(bore.x, bore.y + 12); c.stroke();
    }
    // --- flight path marker
    if (f.vel.length() > 5) {
      const fp = this.project(f.pos.clone().addScaledVector(f.vel.clone().normalize(), 1500), cam);
      if (!fp.behind) { c.beginPath(); c.arc(fp.x, fp.y, 6, 0, Math.PI * 2); c.moveTo(fp.x - 16, fp.y); c.lineTo(fp.x - 6, fp.y); c.moveTo(fp.x + 6, fp.y); c.lineTo(fp.x + 16, fp.y); c.moveTo(fp.x, fp.y - 6); c.lineTo(fp.x, fp.y - 12); c.stroke(); }
    }
    // --- course markers (gates / pylons / formation box)
    for (const m of f.markers) {
      const p = this.project(m.world, cam);
      c.strokeStyle = m.color; c.fillStyle = m.color; c.shadowColor = m.color;
      if (p.behind || p.x < 0 || p.x > W || p.y < 0 || p.y > H) this.edgeArrow(c, p, m.label, W, H);
      else { c.beginPath(); c.moveTo(p.x, p.y - 10); c.lineTo(p.x + 10, p.y); c.lineTo(p.x, p.y + 10); c.lineTo(p.x - 10, p.y); c.closePath(); c.stroke(); c.font = '10px "JetBrains Mono", monospace'; c.fillText(m.label, p.x, p.y + 22); c.font = '11px "JetBrains Mono", monospace'; }
    }
    // --- targets
    for (const t of f.targets) {
      const p = this.project(t.world, cam);
      const colT = t.color;
      c.strokeStyle = colT; c.fillStyle = colT; c.shadowColor = colT;
      const onScreen = !p.behind && p.x > 0 && p.x < W && p.y > 0 && p.y < H;
      if (!onScreen) { if (t.locked) this.edgeArrow(c, p, `${t.rangeKm.toFixed(1)} KM`, W, H); continue; }
      const s = t.locked ? 22 : 12; const k = 7;
      c.lineWidth = t.locked ? 1.6 : 1;
      c.beginPath();
      // square bracket corners
      c.moveTo(p.x - s, p.y - s + k); c.lineTo(p.x - s, p.y - s); c.lineTo(p.x - s + k, p.y - s);
      c.moveTo(p.x + s - k, p.y - s); c.lineTo(p.x + s, p.y - s); c.lineTo(p.x + s, p.y - s + k);
      c.moveTo(p.x + s, p.y + s - k); c.lineTo(p.x + s, p.y + s); c.lineTo(p.x + s - k, p.y + s);
      c.moveTo(p.x - s + k, p.y + s); c.lineTo(p.x - s, p.y + s); c.lineTo(p.x - s, p.y + s - k);
      c.stroke(); c.lineWidth = 1.2;
      if (t.locked) {
        c.fillStyle = gold; c.shadowColor = gold; c.font = '11px "JetBrains Mono", monospace';
        c.fillText(t.label, p.x, p.y - s - 10);
        c.fillStyle = colT; c.shadowColor = colT;
        c.fillText(`${t.rangeKm.toFixed(1)} KM   ${t.closureKt >= 0 ? '+' : '−'}${Math.abs(Math.round(t.closureKt))} KT`, p.x, p.y + s + 12);
      }
    }
    // --- lead-computing pipper
    if (f.lead) {
      const p = this.project(f.lead, cam);
      if (!p.behind) {
        const pc = f.shoot ? '#ffffff' : gold;
        c.strokeStyle = pc; c.fillStyle = pc; c.shadowColor = pc; c.lineWidth = 1.4;
        c.beginPath(); c.arc(p.x, p.y, 5, 0, Math.PI * 2); c.stroke(); c.beginPath(); c.arc(p.x, p.y, 1.5, 0, Math.PI * 2); c.fill();
        c.beginPath(); c.moveTo(p.x, p.y - 9); c.lineTo(p.x, p.y - 5); c.moveTo(p.x, p.y + 5); c.lineTo(p.x, p.y + 9); c.moveTo(p.x - 9, p.y); c.lineTo(p.x - 5, p.y); c.moveTo(p.x + 5, p.y); c.lineTo(p.x + 9, p.y); c.stroke();
        if (f.shoot) { c.font = 'bold 13px "JetBrains Mono", monospace'; c.fillText('SHOOT', p.x, p.y + 24); }
        c.lineWidth = 1.2;
      }
    }
    c.strokeStyle = col; c.fillStyle = col; c.shadowColor = col;
    // --- stall / warnings in the ladder
    if (fs.buffet > 0.4 && !fs.onGround) { c.fillStyle = '#ff5a5a'; c.shadowColor = '#ff5a5a'; c.font = 'bold 13px "JetBrains Mono", monospace'; c.fillText('STALL', cx, cy + 150); }
    if (fs.radarAltFt < 300 && !fs.onGround && fs.gearPos < 0.5 && fs.vsFpm < -500) { c.fillStyle = '#ffb340'; c.shadowColor = '#ffb340'; c.font = 'bold 13px "JetBrains Mono", monospace'; c.fillText('PULL UP', cx, cy + 170); }
  }

  private edgeArrow(c: CanvasRenderingContext2D, p: { x: number; y: number; behind: boolean }, label: string, W: number, H: number) {
    const cx = W / 2, cy = H / 2;
    let dx = p.x - cx, dy = p.y - cy;
    if (p.behind) { dx = -dx; dy = -dy; }
    const ang = Math.atan2(dy, dx);
    const rx = W / 2 - 60, ry = H / 2 - 90;
    const t = Math.min(rx / Math.abs(Math.cos(ang) || 1e-6), ry / Math.abs(Math.sin(ang) || 1e-6));
    const x = cx + Math.cos(ang) * t, y = cy + Math.sin(ang) * t;
    c.save(); c.translate(x, y); c.rotate(ang);
    c.beginPath(); c.moveTo(-8, -9); c.lineTo(6, 0); c.lineTo(-8, 9); c.stroke();
    c.restore();
    c.font = '10px "JetBrains Mono", monospace'; c.fillText(label, x - Math.cos(ang) * 26, y - Math.sin(ang) * 26 + 4); c.font = '11px "JetBrains Mono", monospace';
  }
}
