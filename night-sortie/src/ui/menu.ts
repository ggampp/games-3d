import { MISSIONS } from '../missions';
import type { MissionDef, MissionResult } from '../missions/mission';
import { settings, saveSettings, loadBests, type HudColor } from '../settings';
import type { Input } from '../input/gamepad';
import type { Synth } from '../audio/synth';
import type { Haptics } from '../input/haptics';

const fmt = (n: number) => Math.round(n).toLocaleString('en-US').replace(/,/g, ' ');

export class Boot {
  private bar: HTMLElement; private pct: HTMLElement; private status: HTMLElement;
  constructor(private root: HTMLElement) {
    root.innerHTML = `<div class="boot-inner"><div class="boot-rule"></div><div class="boot-sub">F-35A LIGHTNING II  ·  NIGHT AIR RACE</div><div class="boot-title">NIGHT SORTIE</div><div class="boot-status"><span class="st">COMPILING SHADERS</span><span class="pc">0%</span></div><div class="boot-bar"><i></i></div><div class="boot-rule"></div></div>`;
    this.bar = root.querySelector('.boot-bar > i')!; this.pct = root.querySelector('.pc')!; this.status = root.querySelector('.st')!;
  }
  set(p: number, text?: string) { this.bar.style.width = `${Math.round(p * 100)}%`; this.pct.textContent = `${Math.round(p * 100)}%`; if (text) this.status.textContent = text; }
  async hide() { this.root.classList.add('fade'); await new Promise((r) => setTimeout(r, 900)); this.root.classList.add('hidden'); }
}

type Screen = 'select' | 'settings' | 'howto' | 'debrief' | 'pause' | 'none';

export class Menu {
  screen: Screen = 'none';
  sel = MISSIONS.findIndex((m) => m.id === 'dogfight');
  private settingSel = 0;
  onLaunch?: (def: MissionDef) => void;
  onResume?: () => void; onAbort?: () => void; onHidPair?: () => Promise<boolean>;
  private el: HTMLElement | null = null;
  constructor(private root: HTMLElement, private input: Input, private synth: Synth, private haptics: Haptics) {}

  private mount(html: string) { this.root.innerHTML = html; this.el = this.root.firstElementChild as HTMLElement; this.root.classList.remove('hidden'); }
  hide() { this.screen = 'none'; this.root.innerHTML = ''; this.root.classList.add('hidden'); }

  showSelect() {
    this.screen = 'select';
    const bests = loadBests();
    const cards = MISSIONS.map((m, i) => {
      const b = bests[m.id];
      const bestLine = b ? `BEST ${fmt(b.score)}${b.grade ? ' · ' + b.grade : ''}${b.wave ? ' · WAVE ' + b.wave : ''}` : (m.sampleBest ?? '');
      return `<div class="card${i === this.sel ? ' sel' : ''}" data-i="${i}"><h3>${m.title}</h3><p>${m.blurb}</p><div class="score">${m.scoring}</div>${bestLine ? `<div class="best">${bestLine}</div>` : ''}</div>`;
    }).join('');
    this.mount(`<div class="overlay"><div class="panel">
      <div class="meta"><span>MISSION SELECT</span><span><b>NIGHT COURSE 7</b></span><span>02:40 LOCAL</span><span>CLEAR</span><span>WIND CALM</span></div>
      <div class="title">NIGHT SORTIE</div>
      <div class="cards">${cards}</div>
      <div class="foot"><button class="btn" data-a="howto">[ HOW TO FLY ]</button><button class="btn" data-a="settings">[ SETTINGS ]</button>
      <div class="hint">Start position: ${settings.startAirborne ? 'airborne over the field' : 'runway 36, engine running, brakes set'} — change it in Settings<br><kbd>↑↓</kbd> / D-pad to choose &nbsp;&nbsp; <kbd>Enter</kbd> / ✕ to fly</div></div>
    </div></div>`);
    this.el!.querySelectorAll<HTMLElement>('.card').forEach((c) => { c.onclick = () => { this.sel = Number(c.dataset.i); this.launch(); }; c.onmouseenter = () => { this.sel = Number(c.dataset.i); this.refreshSel(); }; });
    this.el!.querySelector<HTMLElement>('[data-a=howto]')!.onclick = () => this.showHowTo();
    this.el!.querySelector<HTMLElement>('[data-a=settings]')!.onclick = () => this.showSettings();
  }
  private refreshSel() { this.el?.querySelectorAll<HTMLElement>('.card').forEach((c) => c.classList.toggle('sel', Number(c.dataset.i) === this.sel)); }
  private launch() { this.synth.ensure(); this.synth.uiConfirm(); this.onLaunch?.(MISSIONS[this.sel]); }

  showHowTo() {
    this.screen = 'howto';
    this.mount(`<div class="overlay"><div class="panel"><div class="meta"><span>HOW TO FLY</span></div><div class="title">NIGHT SORTIE</div><div class="prose">
      <h4>TAKEOFF</h4><p>Brakes off (<b>B</b>), throttle to MIL or A/B (<b>Shift</b> / <b>L2</b>). Rotate gently at ~150 kt, positive climb, gear up (<b>G</b>). Keep the nose 10° up until 250 kt.</p>
      <h4>GATES</h4><p>Luminous frames. Fly through the white (next) one; centred passes pay extra. A missed gate is skipped, not retried. The HUD diamond marks the next gate; off-screen, an arrow points to it.</p>
      <h4>PYLONS</h4><p>Put the boresight circle on the selected pylon from within 3 km and hold 1.2 s. <b>Tab</b> / <b>L1 R1</b> switches pylon.</p>
      <h4>FORMATION BOX</h4><p>The pace jet flies 250 kt. Slide into the wireframe box off its right wing, match speed (throttle ~55%), and hold. Avoid sitting directly behind it: wake hits cost points.</p>
      <h4>LANDING</h4><p>Through the approach gate at 3 km, gear (<b>G</b>) and flaps (<b>F</b>), 3° glideslope: ~700 fpm at 150 kt. Aim for the touchdown bars, flare to under 300 fpm, idle, brakes (<b>B</b>). Runway 36 is straight north (heading 000).</p>
      <h4>DOGFIGHT · LEAD PURSUIT</h4><p>Get behind the drone, then put the gun cross on the gold lead reticle — not on the drone itself. The reticle shows where the training rounds will meet the target; <b>SHOOT</b> appears when you are lined up. Chained disables within 6 s multiply the score. Do not ram: three shield hits end the sortie.</p>
      <h4>ENGINE</h4><p>MIL is 0–90 % throttle. Above 90 % the afterburner lights: much more thrust, much more fuel. The N2 gauge shows spool; the nozzle plume and the amber bar show the burner.</p>
      </div><div class="foot"><button class="btn primary" data-a="back">[ BACK ]</button><div class="hint"><kbd>Esc</kbd> / ○ back</div></div></div></div>`);
    this.el!.querySelector<HTMLElement>('[data-a=back]')!.onclick = () => this.showSelect();
  }

  showSettings() {
    this.screen = 'settings';
    const rows: Array<{ k: string; label: string; val: () => string; change: (d: number) => void }> = [
      { k: 'invert', label: 'INVERT PITCH', val: () => (settings.invertPitch ? 'ON' : 'OFF'), change: () => { settings.invertPitch = !settings.invertPitch; } },
      { k: 'sens', label: 'MOUSE SENSITIVITY', val: () => settings.mouseSens.toFixed(2), change: (d) => { settings.mouseSens = Math.max(0.2, Math.min(2.5, settings.mouseSens + d * 0.1)); } },
      { k: 'dz', label: 'PAD DEADZONE', val: () => settings.deadzone.toFixed(2), change: (d) => { settings.deadzone = Math.max(0, Math.min(0.35, settings.deadzone + d * 0.02)); } },
      { k: 'hap', label: 'HAPTIC INTENSITY', val: () => `${Math.round(settings.haptics * 100)}%`, change: (d) => { settings.haptics = Math.max(0, Math.min(1, settings.haptics + d * 0.1)); } },
      { k: 'start', label: 'START POSITION', val: () => (settings.startAirborne ? 'AIRBORNE' : 'RUNWAY 36'), change: () => { settings.startAirborne = !settings.startAirborne; } },
      { k: 'vol', label: 'VOLUME', val: () => `${Math.round(settings.volume * 100)}%`, change: (d) => { settings.volume = Math.max(0, Math.min(1, settings.volume + d * 0.1)); this.synth.applyVolume(); } },
      { k: 'hud', label: 'HUD COLOR', val: () => settings.hudColor.toUpperCase(), change: (d) => { const c: HudColor[] = ['cyan', 'green', 'amber']; settings.hudColor = c[((c.indexOf(settings.hudColor) + d) % 3 + 3) % 3]; } },
      { k: 'tapes', label: 'SPEED / ALT TAPES', val: () => (settings.showTapes ? 'SHOWN' : 'HIDDEN'), change: () => { settings.showTapes = !settings.showTapes; } },
      { k: 'hid', label: 'DUALSENSE WEBHID', val: () => (this.haptics.connected ? `PAIRED${this.haptics.battery >= 0 ? ' · ' + this.haptics.battery + '%' : ''}` : this.haptics.hidSupported ? 'PAIR…' : 'UNSUPPORTED'), change: () => { void this.onHidPair?.().then(() => this.render()); } },
    ];
    const render = () => {
      const html = rows.map((r, i) => `<div class="row${i === this.settingSel ? ' sel' : ''}" data-i="${i}"><span>${r.label}</span><span class="val">◂ ${r.val()} ▸</span></div>`).join('');
      this.mount(`<div class="overlay"><div class="panel"><div class="meta"><span>SETTINGS</span><span>${this.input.padConnected ? '<b>' + (this.input.isDualSense ? 'DUALSENSE' : 'GAMEPAD') + ' CONNECTED</b>' : 'NO GAMEPAD'}</span></div><div class="title">NIGHT SORTIE</div><div class="settings">${html}</div>
        <div class="foot"><button class="btn primary" data-a="back">[ BACK ]</button><div class="hint"><kbd>↑↓</kbd> choose &nbsp; <kbd>←→</kbd> / click change &nbsp; <kbd>Esc</kbd> back</div></div></div></div>`);
      this.el!.querySelectorAll<HTMLElement>('.row').forEach((e) => { e.onclick = (ev) => { const i = Number(e.dataset.i); this.settingSel = i; const rect = e.getBoundingClientRect(); rows[i].change(ev.clientX > rect.left + rect.width * 0.6 ? 1 : -1); saveSettings(); this.synth.uiMove(); render(); }; });
      this.el!.querySelector<HTMLElement>('[data-a=back]')!.onclick = () => { saveSettings(); this.showSelect(); };
    };
    this.render = render; render();
    this.settingsRows = rows;
  }
  private render: () => void = () => { /* set in showSettings */ };
  private settingsRows: Array<{ change: (d: number) => void }> = [];

  showDebrief(r: MissionResult, isBest: boolean) {
    this.screen = 'debrief';
    this.mount(`<div class="overlay"><div class="panel debrief" style="width:min(640px,92vw)"><div class="meta" style="justify-content:center"><span>DEBRIEF</span></div>
      <div class="big">${r.title}</div>${r.grade ? `<div class="grade">${r.grade}</div>` : ''}
      <div class="lines">${r.lines.join('<br>')}<br><br><span style="color:var(--gold)">${fmt(r.score)} PTS${isBest ? '  ·  NEW BEST' : ''}</span></div>
      <div class="foot" style="justify-content:center"><button class="btn primary" data-a="menu">[ MISSION SELECT ]</button><button class="btn" data-a="again">[ FLY AGAIN ]</button></div><div class="hint" style="text-align:center;margin:12px auto 0"><kbd>Enter</kbd> / ✕ mission select &nbsp; <kbd>R</kbd> / △ fly again</div></div></div>`);
    this.el!.querySelector<HTMLElement>('[data-a=menu]')!.onclick = () => this.showSelect();
    this.el!.querySelector<HTMLElement>('[data-a=again]')!.onclick = () => this.launch();
  }
  showPause() {
    this.screen = 'pause';
    this.mount(`<div class="overlay"><div class="panel" style="width:min(520px,92vw);text-align:center"><div class="meta" style="justify-content:center"><span>PAUSED</span></div><div class="title">NIGHT SORTIE</div>
      <div class="foot" style="justify-content:center"><button class="btn primary" data-a="resume">[ RESUME ]</button><button class="btn" data-a="settings">[ SETTINGS ]</button><button class="btn" data-a="abort">[ ABORT · MISSION SELECT ]</button></div>
      <div class="hint" style="text-align:center;margin:12px auto 0"><kbd>Esc</kbd> / Options resume</div></div></div>`);
    this.el!.querySelector<HTMLElement>('[data-a=resume]')!.onclick = () => { this.hide(); this.onResume?.(); };
    this.el!.querySelector<HTMLElement>('[data-a=abort]')!.onclick = () => { this.onAbort?.(); };
    this.el!.querySelector<HTMLElement>('[data-a=settings]')!.onclick = () => { this.showSettings(); this.settingsReturn = 'pause'; };
  }
  private settingsReturn: 'select' | 'pause' = 'select';

  /** Keyboard / gamepad navigation. Call every frame while a screen is up. */
  update() {
    const t = (a: Parameters<Input['take']>[0]) => this.input.take(a);
    switch (this.screen) {
      case 'select': {
        const cols = innerWidth > 1000 ? 4 : 2; let moved = false;
        if (t('right')) { this.sel = (this.sel + 1) % MISSIONS.length; moved = true; }
        if (t('left')) { this.sel = (this.sel - 1 + MISSIONS.length) % MISSIONS.length; moved = true; }
        if (t('down')) { this.sel = Math.min(MISSIONS.length - 1, this.sel + cols); moved = true; }
        if (t('up')) { this.sel = Math.max(0, this.sel - cols); moved = true; }
        if (moved) { this.synth.ensure(); this.synth.uiMove(); this.refreshSel(); }
        if (t('confirm')) this.launch();
        t('menu'); t('clear'); t('view'); t('fire'); t('cycle'); t('cyclePrev'); t('gear');
        break;
      }
      case 'settings': {
        let ch = false;
        if (t('down')) { this.settingSel = Math.min(this.settingsRows.length - 1, this.settingSel + 1); ch = true; }
        if (t('up')) { this.settingSel = Math.max(0, this.settingSel - 1); ch = true; }
        if (t('right')) { this.settingsRows[this.settingSel].change(1); ch = true; }
        if (t('left')) { this.settingsRows[this.settingSel].change(-1); ch = true; }
        if (t('confirm')) { this.settingsRows[this.settingSel].change(1); ch = true; }
        if (ch) { saveSettings(); this.synth.uiMove(); this.render(); }
        if (t('menu') || t('clear') || t('back')) { saveSettings(); if (this.settingsReturn === 'pause') { this.settingsReturn = 'select'; this.showPause(); } else this.showSelect(); }
        break;
      }
      case 'howto': if (t('menu') || t('clear') || t('back') || t('confirm')) this.showSelect(); break;
      case 'debrief':
        if (t('confirm')) this.showSelect();
        if (t('view') || this.input.keys.has('KeyR')) { this.input.keys.delete('KeyR'); this.launch(); }
        t('menu'); t('clear'); t('fire');
        break;
      case 'pause':
        if (t('menu') || t('confirm')) { this.hide(); this.onResume?.(); }
        if (t('clear') || t('back')) this.onAbort?.();
        break;
      default: break;
    }
  }
}

export function controlsOverlayHtml(pad: boolean) {
  return `<div class="controls-ov"><h4>CONTROLS</h4>
  <div><b>Pitch / roll</b>${pad ? 'Left stick' : 'Mouse (click canvas to capture) · W A S D'}</div>
  <div><b>Yaw</b>${pad ? 'Right stick X' : 'Q / E  or  Z / X'}</div>
  <div><b>Throttle</b>${pad ? 'L2 analog' : 'Shift up · Ctrl down · mouse wheel'}</div>
  <div><b>Fire training rounds</b>${pad ? 'R2' : 'Space · left mouse'}</div>
  <div><b>Cycle drone / pylon</b>${pad ? 'L1 / R1' : 'Tab'}</div>
  <div><b>Clear lock</b>${pad ? '○' : 'C'}</div>
  <div><b>Gear · Flaps · Brakes</b>${pad ? '□ gear · F · B on keyboard' : 'G · F · B'}</div>
  <div><b>View</b>${pad ? '△' : 'V'}</div>
  <div><b>Menu · Controls</b>${pad ? 'Options · Share' : 'Esc · H'}</div>
  <div style="margin-top:8px;color:#7fa2ae">Press H to close</div></div>`;
}
