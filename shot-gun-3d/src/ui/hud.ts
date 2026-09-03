import './styles.css';
import type { WeaponDef, WeaponId } from '../weapons/catalog.ts';
import { WEAPONS } from '../weapons/catalog.ts';

export interface HudState {
  weapon: WeaponDef;
  integrity: number;
  score: number;
  paused: boolean;
  locked: boolean;
  collapsed: boolean;
  muted: boolean;
  /** Estrutura sob a mira. */
  target: { name: string; integrity: number } | null;
  toast: string | null;
  mode: 'playground' | 'contract';
  contract: { text: string; done: boolean; time: number; best: number | null } | null;
  ammo: { mag: number; reserve: number; reloading: boolean; gauge: number; kind: string; infinite: boolean };
  /** Dica de interação (E). */
  prompt: string | null;
  /** Bananas de dinamite com detonador remoto colocadas. */
  remoteSticks: number;
  fireCount: number;
}

export interface HudHandlers {
  onSelect: (id: WeaponId) => void;
  onReset: () => void;
  onMute: () => void;
  onFire: (down: boolean) => void;
  onMove: (x: number, z: number) => void;
  onJump: () => void;
  onMode: () => void;
  onReload: () => void;
  onInteract: () => void;
  onDetonate: () => void;
}

export class Hud {
  readonly canvas: HTMLCanvasElement;
  readonly isTouch: boolean;
  private root: HTMLElement;
  private titleEl: HTMLElement;
  private meterFill: HTMLElement;
  private scoreEl: HTMLElement;
  private overlay: HTMLElement;
  private overlayText: HTMLElement;
  private overlayHint: HTMLElement;
  private targetEl: HTMLElement;
  private targetName: HTMLElement;
  private targetFill: HTMLElement;
  private toastEl: HTMLElement;
  private contractEl: HTMLElement;
  private modeBtn: HTMLButtonElement;
  private ammoEl: HTMLElement;
  private promptEl: HTMLElement;
  private boomBtn: HTMLButtonElement;
  private fireWarn: HTMLElement;
  private slots = new Map<WeaponId, HTMLButtonElement>();
  private h: HudHandlers;
  private lastToast = '';
  private toastTimer = 0;

  constructor(parent: HTMLElement, handlers: HudHandlers) {
    this.h = handlers;
    this.isTouch = window.matchMedia?.('(pointer: coarse)').matches ?? false;

    this.root = document.createElement('div');
    this.root.id = 'hud';
    if (this.isTouch) this.root.classList.add('touch');
    parent.appendChild(this.root);

    this.canvas = document.createElement('canvas');
    this.canvas.id = 'view';
    this.root.appendChild(this.canvas);

    this.titleEl = el('div', 'weapon-title', 'Shotgun');
    this.root.appendChild(this.titleEl);

    const meter = el('div', 'integrity');
    meter.innerHTML = '<span>vila</span>';
    this.meterFill = el('div', 'integrity-fill');
    meter.appendChild(this.meterFill);
    this.root.appendChild(meter);

    this.scoreEl = el('div', 'score', '0');
    this.root.appendChild(this.scoreEl);

    this.targetEl = el('div', 'target hidden');
    this.targetName = el('div', 'target-name', '');
    const tbar = el('div', 'target-bar');
    this.targetFill = el('div', 'target-fill');
    tbar.appendChild(this.targetFill);
    this.targetEl.appendChild(this.targetName);
    this.targetEl.appendChild(tbar);
    this.root.appendChild(this.targetEl);

    this.toastEl = el('div', 'toast hidden', '');
    this.root.appendChild(this.toastEl);

    this.contractEl = el('div', 'contract hidden', '');
    this.root.appendChild(this.contractEl);

    this.ammoEl = el('div', 'ammo', '');
    this.root.appendChild(this.ammoEl);

    this.promptEl = el('div', 'prompt hidden', '');
    this.root.appendChild(this.promptEl);

    this.fireWarn = el('div', 'fire-warn hidden', '');
    this.root.appendChild(this.fireWarn);

    const bar = el('div', 'hotbar');
    for (const w of WEAPONS) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'slot';
      btn.dataset.id = w.id;
      btn.innerHTML = `<span class="num">${w.slot}</span>
        <span class="ico" aria-hidden="true">${iconFor(w.id)}</span>
        <span class="lab">${w.label}</span>`;
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.h.onSelect(w.id);
      });
      bar.appendChild(btn);
      this.slots.set(w.id, btn);
    }
    this.root.appendChild(bar);

    const tools = el('div', 'tools');
    tools.appendChild(this.toolBtn('⌫', 'reconstruir', () => this.h.onReset()));
    tools.appendChild(this.toolBtn('M', 'som', () => this.h.onMute()));
    this.modeBtn = this.toolBtn('T', 'modo', () => this.h.onMode());
    tools.appendChild(this.modeBtn);
    this.root.appendChild(tools);

    // Controles de toque: joystick à esquerda, pulo e fogo à direita.
    const stick = el('div', 'stick');
    const knob = el('div', 'stick-knob');
    stick.appendChild(knob);
    this.root.appendChild(stick);
    let stickId: number | null = null;
    let cx = 0;
    let cy = 0;
    const R = 46;
    const setStick = (dx: number, dy: number) => {
      const len = Math.hypot(dx, dy);
      const k = len > R ? R / len : 1;
      knob.style.transform = `translate(${dx * k}px, ${dy * k}px)`;
      this.h.onMove((dx * k) / R, (-dy * k) / R);
    };
    stick.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      stickId = e.pointerId;
      const r = stick.getBoundingClientRect();
      cx = r.left + r.width / 2;
      cy = r.top + r.height / 2;
      try { stick.setPointerCapture(e.pointerId); } catch { /* evento sintético */ }
      setStick(e.clientX - cx, e.clientY - cy);
    });
    stick.addEventListener('pointermove', (e) => {
      if (e.pointerId !== stickId) return;
      e.preventDefault();
      setStick(e.clientX - cx, e.clientY - cy);
    });
    const endStick = (e: PointerEvent) => {
      if (e.pointerId !== stickId) return;
      stickId = null;
      knob.style.transform = '';
      this.h.onMove(0, 0);
    };
    stick.addEventListener('pointerup', endStick);
    stick.addEventListener('pointercancel', endStick);

    const jump = document.createElement('button');
    jump.type = 'button';
    jump.className = 'jump-btn';
    jump.textContent = 'PULO';
    jump.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.h.onJump();
    });
    this.root.appendChild(jump);

    this.boomBtn = document.createElement('button');
    this.boomBtn.type = 'button';
    this.boomBtn.className = 'boom-btn hidden';
    this.boomBtn.textContent = 'BOOM';
    this.boomBtn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.h.onDetonate();
    });
    this.root.appendChild(this.boomBtn);

    const act = document.createElement('button');
    act.type = 'button';
    act.className = 'act-btn';
    act.textContent = 'USAR';
    act.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.h.onInteract();
    });
    this.root.appendChild(act);

    const reload = document.createElement('button');
    reload.type = 'button';
    reload.className = 'reload-btn';
    reload.textContent = 'RECARGA';
    reload.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.h.onReload();
    });
    this.root.appendChild(reload);

    const fire = document.createElement('button');
    fire.type = 'button';
    fire.className = 'fire-btn';
    fire.textContent = 'FOGO';
    fire.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.h.onFire(true);
    });
    fire.addEventListener('pointerup', (e) => {
      e.stopPropagation();
      this.h.onFire(false);
    });
    fire.addEventListener('pointercancel', () => this.h.onFire(false));
    this.root.appendChild(fire);

    this.overlay = el('div', 'overlay');
    this.overlayText = el('p', 'overlay-copy', 'Clique para entrar na vila');
    this.overlayHint = el('p', 'overlay-hint', this.isTouch
      ? 'joystick anda · arraste para mirar · FOGO atira · PULO pula · USAR interage · 1–8 armas'
      : 'WASD anda · Shift corre · Espaço pula · Ctrl agacha · mouse mira · 1–8 armas · R recarrega · E usa · Q/botão direito detona · L hora do dia · T modo · Backspace reconstrói');
    this.overlay.appendChild(this.overlayText);
    this.overlay.appendChild(this.overlayHint);
    this.root.appendChild(this.overlay);

    const cross = el('div', 'crosshair');
    this.root.appendChild(cross);
  }

  private toolBtn(key: string, label: string, fn: () => void): HTMLButtonElement {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'tool';
    b.innerHTML = `<kbd>${key}</kbd> ${label}`;
    b.addEventListener('click', (e) => {
      e.stopPropagation();
      fn();
    });
    return b;
  }

  render(state: HudState): void {
    this.titleEl.textContent = state.weapon.label;
    this.meterFill.style.width = `${Math.round(state.integrity * 100)}%`;
    this.scoreEl.textContent = String(state.score).padStart(4, '0');
    for (const [id, btn] of this.slots) {
      btn.classList.toggle('active', id === state.weapon.id);
    }
    const playing = state.locked || this.isTouch;
    this.overlay.classList.toggle('hidden', playing && !state.paused && !state.collapsed);
    if (state.collapsed) {
      this.overlayText.textContent = 'A vila caiu. R para reconstruir.';
    } else if (state.paused) {
      this.overlayText.textContent = 'Pausado';
    } else if (!playing) {
      this.overlayText.textContent = 'Clique para entrar na vila';
    }

    if (state.target) {
      this.targetEl.classList.remove('hidden');
      this.targetName.textContent = state.target.name;
      this.targetFill.style.width = `${Math.round(state.target.integrity * 100)}%`;
    } else {
      this.targetEl.classList.add('hidden');
    }

    if (state.toast && state.toast !== this.lastToast) {
      this.lastToast = state.toast;
      this.toastEl.textContent = state.toast;
      this.toastEl.classList.remove('hidden');
      window.clearTimeout(this.toastTimer);
      this.toastTimer = window.setTimeout(() => {
        this.toastEl.classList.add('hidden');
        this.lastToast = '';
      }, 2200);
    }

    this.modeBtn.innerHTML = `<kbd>T</kbd> ${state.mode === 'contract' ? 'contrato' : 'livre'}`;
    if (state.mode === 'contract' && state.contract) {
      const c = state.contract;
      this.contractEl.classList.remove('hidden');
      const t = `${Math.floor(c.time / 60)}:${String(Math.floor(c.time % 60)).padStart(2, '0')}`;
      const best = c.best !== null ? ` · melhor ${Math.floor(c.best / 60)}:${String(Math.floor(c.best % 60)).padStart(2, '0')}` : '';
      this.contractEl.innerHTML = c.done
        ? `<strong>Cumprido em ${t}!</strong>${best} · T para outro`
        : `<strong>Contrato:</strong> ${c.text} · <b>${t}</b>${best}`;
    } else {
      this.contractEl.classList.add('hidden');
    }

    const a = state.ammo;
    if (a.kind === 'beam') {
      this.ammoEl.innerHTML = `<span class="gauge"><i style="width:${Math.round(a.gauge * 100)}%;background:${a.gauge > 0.85 ? '#ff5a3a' : '#4ec4ff'}"></i></span><small>calor</small>`;
    } else if (a.kind === 'water') {
      this.ammoEl.innerHTML = `<span class="gauge"><i style="width:${Math.round(a.gauge * 100)}%;background:#4ea8ff"></i></span><small>${a.gauge <= 0 ? 'encha no poço (E)' : 'tanque'}</small>`;
    } else if (a.infinite) {
      this.ammoEl.innerHTML = '<b>∞</b>';
    } else {
      this.ammoEl.innerHTML = `<b>${a.mag}</b> / ${a.reserve}${a.reloading ? ' <small>recarregando…</small>' : a.mag === 0 ? ' <small>R recarrega</small>' : ''}`;
    }

    if (state.prompt) {
      this.promptEl.textContent = state.prompt;
      this.promptEl.classList.remove('hidden');
    } else {
      this.promptEl.classList.add('hidden');
    }
    this.boomBtn.classList.toggle('hidden', state.remoteSticks === 0);
    this.boomBtn.textContent = `BOOM ×${state.remoteSticks}`;
    if (state.fireCount > 0) {
      this.fireWarn.classList.remove('hidden');
      this.fireWarn.textContent = `🔥 ${state.fireCount}`;
    } else {
      this.fireWarn.classList.add('hidden');
    }
  }
}

function iconFor(id: WeaponId): string {
  switch (id) {
    case 'bullet': return '•';
    case 'shotgun': return '≡';
    case 'rifle': return '—';
    case 'bomb': return '*';
    case 'laser': return '▸';
    case 'water': return '≈';
    case 'hook': return '⌐';
    case 'detonator': return '⏚';
  }
}

function el(tag: string, className: string, text?: string): HTMLElement {
  const node = document.createElement(tag);
  node.className = className;
  if (text) node.textContent = text;
  return node;
}
