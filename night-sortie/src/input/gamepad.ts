import { settings } from '../settings';

/** Unified input: keyboard + mouse + Gamepad API (standard mapping; DualSense preferred). */
export interface InputState {
  pitch: number; roll: number; yaw: number;     // -1..1
  throttle: number;                             // 0..1 absolute
  fire: boolean;
  camX: number; camY: number;                   // right stick
}
export type Action = 'fire' | 'cycle' | 'cyclePrev' | 'clear' | 'view' | 'menu' | 'gear' | 'flaps' | 'brakes' | 'controls' | 'confirm' | 'up' | 'down' | 'left' | 'right' | 'pause' | 'back';

export class Input {
  state: InputState = { pitch: 0, roll: 0, yaw: 0, throttle: 0, fire: false, camX: 0, camY: 0 };
  keys = new Set<string>();
  private pressed = new Set<Action>();
  private prevButtons: boolean[] = [];
  private mouseDX = 0; private mouseDY = 0;
  private mouseStick = { x: 0, y: 0 };
  private mouseDown = false;
  private wheel = 0;
  padIndex = -1;
  padId = '';
  padConnected = false;
  throttleKey = 0; // keyboard throttle accumulator 0..1
  pointerLocked = false;
  onGamepadChange?: (connected: boolean, id: string) => void;
  onAnyInput?: () => void;

  constructor(canvas: HTMLCanvasElement) {
    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      this.keys.add(e.code);
      const map: Record<string, Action> = { Space: 'fire', Tab: 'cycle', KeyC: 'clear', KeyV: 'view', Escape: 'menu', KeyG: 'gear', KeyF: 'flaps', KeyB: 'brakes', KeyH: 'controls', Enter: 'confirm', ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', KeyP: 'pause', Backspace: 'back' };
      const a = map[e.code]; if (a) { this.pressed.add(a); }
      if (e.code === 'Tab' || e.code === 'Space') e.preventDefault();
      this.onAnyInput?.();
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());
    canvas.addEventListener('mousedown', (e) => { if (e.button === 0) { this.mouseDown = true; this.pressed.add('fire'); } if (e.button === 2) this.mouseDown = true; if (!this.pointerLocked) canvas.requestPointerLock?.(); });
    window.addEventListener('mouseup', () => { this.mouseDown = false; });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('mousemove', (e) => { if (this.pointerLocked || this.mouseDown) { this.mouseDX += e.movementX; this.mouseDY += e.movementY; } });
    window.addEventListener('wheel', (e) => { this.wheel += e.deltaY; }, { passive: true });
    document.addEventListener('pointerlockchange', () => { this.pointerLocked = document.pointerLockElement === canvas; });
    window.addEventListener('gamepadconnected', (e) => { this.padIndex = e.gamepad.index; this.padId = e.gamepad.id; this.padConnected = true; this.onGamepadChange?.(true, e.gamepad.id); });
    window.addEventListener('gamepaddisconnected', (e) => { if (e.gamepad.index === this.padIndex) { this.padIndex = -1; this.padConnected = false; this.onGamepadChange?.(false, ''); } });
  }
  releasePointer() { if (this.pointerLocked) document.exitPointerLock?.(); }
  get isDualSense() { return /DualSense|054c|Wireless Controller/i.test(this.padId); }
  get pad(): Gamepad | null { if (this.padIndex < 0) return null; const gps = navigator.getGamepads?.(); return gps ? gps[this.padIndex] : null; }

  /** Edge-triggered action. */
  take(a: Action): boolean { if (this.pressed.has(a)) { this.pressed.delete(a); return true; } return false; }
  held(a: Action): boolean {
    if (a === 'fire') return this.state.fire;
    return false;
  }

  private dz(v: number) { const d = settings.deadzone; const s = Math.abs(v) < d ? 0 : (Math.abs(v) - d) / (1 - d) * Math.sign(v); return s * Math.abs(s); }

  update(dt: number, inMenu: boolean) {
    const s = this.state;
    // keyboard stick
    let kp = 0, kr = 0, ky = 0;
    if (this.keys.has('KeyW')) kp -= 1; if (this.keys.has('KeyS')) kp += 1;
    if (this.keys.has('KeyA')) kr -= 1; if (this.keys.has('KeyD')) kr += 1;
    if (this.keys.has('KeyQ') || this.keys.has('KeyZ')) ky -= 1; if (this.keys.has('KeyE') || this.keys.has('KeyX')) ky += 1;
    // mouse: accumulate into a virtual stick that recentres
    const sens = settings.mouseSens * 0.0035;
    this.mouseStick.x += this.mouseDX * sens; this.mouseStick.y += this.mouseDY * sens;
    this.mouseDX = 0; this.mouseDY = 0;
    const decay = Math.exp(-dt * 3.5);
    this.mouseStick.x *= decay; this.mouseStick.y *= decay;
    this.mouseStick.x = Math.max(-1, Math.min(1, this.mouseStick.x)); this.mouseStick.y = Math.max(-1, Math.min(1, this.mouseStick.y));
    // keyboard throttle
    if (this.keys.has('ShiftLeft') || this.keys.has('ShiftRight')) this.throttleKey += dt * 0.6;
    if (this.keys.has('ControlLeft') || this.keys.has('ControlRight')) this.throttleKey -= dt * 0.6;
    if (this.wheel !== 0) { this.throttleKey -= this.wheel * 0.0008; this.wheel = 0; }
    this.throttleKey = Math.max(0, Math.min(1, this.throttleKey));
    let pitch = kp + this.mouseStick.y, roll = kr + this.mouseStick.x, yaw = ky, thr = this.throttleKey;
    let fire = this.keys.has('Space') || this.mouseDown;
    let camX = 0, camY = 0;

    const gp = this.pad;
    if (gp) {
      const ax = gp.axes;
      const lx = this.dz(ax[0] ?? 0), ly = this.dz(ax[1] ?? 0), rx = this.dz(ax[2] ?? 0), ry = this.dz(ax[3] ?? 0);
      roll += lx; pitch += ly; camX = rx; camY = ry;
      const bt = (i: number) => gp.buttons[i]?.pressed ?? false;
      const bv = (i: number) => gp.buttons[i]?.value ?? 0;
      const l2 = bv(6), r2 = bv(7);
      if (l2 > 0.02 || gp.buttons[6]?.pressed) { thr = l2; this.throttleKey = l2; }
      if (r2 > 0.3) fire = true;
      // yaw on L1/R1? No: those cycle targets. Yaw from right stick X in flight.
      if (!inMenu) yaw += rx * 0.6;
      // edge-detected buttons
      const now: boolean[] = [];
      for (let i = 0; i < 17; i++) now[i] = bt(i);
      const edge = (i: number) => now[i] && !this.prevButtons[i];
      const nav: Array<[number, Action]> = [[0, 'confirm'], [1, 'clear'], [3, 'view'], [4, 'cyclePrev'], [5, 'cycle'], [9, 'menu'], [12, 'up'], [13, 'down'], [14, 'left'], [15, 'right'], [2, 'gear'], [8, 'controls']];
      for (const [i, a] of nav) if (edge(i)) { this.pressed.add(a); this.onAnyInput?.(); }
      if (edge(7)) this.pressed.add('fire');
      // menu navigation with left stick
      if (inMenu) {
        if (ly < -0.6 && !(this.prevButtons[100])) this.pressed.add('up'); if (ly > 0.6 && !(this.prevButtons[101])) this.pressed.add('down');
        if (lx < -0.6 && !(this.prevButtons[102])) this.pressed.add('left'); if (lx > 0.6 && !(this.prevButtons[103])) this.pressed.add('right');
        now[100] = ly < -0.6; now[101] = ly > 0.6; now[102] = lx < -0.6; now[103] = lx > 0.6;
      }
      this.prevButtons = now;
    }
    if (settings.invertPitch) pitch = -pitch;
    s.pitch = Math.max(-1, Math.min(1, pitch)); s.roll = Math.max(-1, Math.min(1, roll)); s.yaw = Math.max(-1, Math.min(1, yaw));
    s.throttle = thr; s.fire = fire && !inMenu; s.camX = camX; s.camY = camY;
  }
}
