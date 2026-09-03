export class Input {
  readonly keys = new Set<string>();
  mouseDX = 0;
  mouseDY = 0;
  firing = false;
  locked = false;
  /** Joystick virtual (-1..1). */
  stickX = 0;
  stickZ = 0;
  private jumpPressed = false;
  private reloadPressed = false;
  private interactPressed = false;
  private altPressed = false;
  private queued = false;
  private canvas: HTMLElement;
  private lookPointer: number | null = null;
  private lastX = 0;
  private lastY = 0;

  constructor(canvas: HTMLElement) {
    this.canvas = canvas;
    window.addEventListener('keydown', (e) => {
      this.keys.add(e.code);
      if (e.code === 'Space' && !e.repeat) this.jumpPressed = true;
      if (e.code === 'KeyR' && !e.repeat) this.reloadPressed = true;
      if (e.code === 'KeyE' && !e.repeat) this.interactPressed = true;
      if (e.code === 'KeyQ' && !e.repeat) this.altPressed = true;
      if (['Space', 'KeyW', 'KeyA', 'KeyS', 'KeyD', 'ShiftLeft', 'ControlLeft'].includes(e.code)) e.preventDefault();
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => {
      this.keys.clear();
      this.firing = false;
    });
    canvas.addEventListener('pointerdown', (e) => {
      if (this.lookPointer !== null) return;
      this.lookPointer = e.pointerId;
      this.lastX = e.clientX;
      this.lastY = e.clientY;
    });
    canvas.addEventListener('pointermove', (e) => {
      if (this.locked || this.lookPointer !== e.pointerId) return;
      this.mouseDX += e.clientX - this.lastX;
      this.mouseDY += e.clientY - this.lastY;
      this.lastX = e.clientX;
      this.lastY = e.clientY;
    });
    const release = (e: PointerEvent) => {
      if (e.pointerId === this.lookPointer) this.lookPointer = null;
    };
    canvas.addEventListener('pointerup', release);
    canvas.addEventListener('pointercancel', release);
    document.addEventListener('contextmenu', (e) => { if (this.locked) e.preventDefault(); });
    document.addEventListener('pointerdown', (e) => {
      if (this.locked && e.button === 2) { this.altPressed = true; return; }
      if (!this.locked || e.button !== 0) return;
      const t = e.target;
      if (t instanceof HTMLElement && t.closest('button, .stick')) return;
      this.firing = true;
      this.queued = true;
    });
    window.addEventListener('pointerup', (e) => { if (e.pointerType === 'mouse') this.firing = false; });
    window.addEventListener('pointercancel', () => { this.firing = false; });
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === canvas;
      if (!this.locked) this.firing = false;
    });
    document.addEventListener('mousemove', (e) => {
      if (!this.locked) return;
      this.mouseDX += e.movementX;
      this.mouseDY += e.movementY;
    });
  }

  isHolding(): boolean {
    return this.firing || this.queued || this.padFire;
  }

  consumeQueued(): void {
    this.queued = false;
  }

  consumeLook(): { dx: number; dy: number } {
    const dx = this.mouseDX;
    const dy = this.mouseDY;
    this.mouseDX = 0;
    this.mouseDY = 0;
    return { dx, dy };
  }

  /** Gamepad: eixos e botões (padrão "standard"). */
  private padMove = { x: 0, z: 0 };
  private padRun = false;
  private padCrouch = false;
  private padFire = false;
  private padPrev = new Set<number>();
  padSlotDelta = 0;
  padConnected = false;

  pollGamepad(dt: number): void {
    const pads = navigator.getGamepads?.() ?? [];
    const gp = pads.find((p) => p && p.connected);
    if (!gp) { this.padConnected = false; this.padMove.x = this.padMove.z = 0; return; }
    this.padConnected = true;
    const dz = (v: number) => (Math.abs(v) < 0.14 ? 0 : v);
    this.padMove.x = dz(gp.axes[0] ?? 0);
    this.padMove.z = -dz(gp.axes[1] ?? 0);
    const lx = dz(gp.axes[2] ?? 0);
    const ly = dz(gp.axes[3] ?? 0);
    // Curva de resposta e sensibilidade em px equivalentes por segundo.
    this.mouseDX += lx * Math.abs(lx) * 1400 * dt;
    this.mouseDY += ly * Math.abs(ly) * 1100 * dt;
    const b = (i: number) => !!gp.buttons[i]?.pressed;
    const pressed = (i: number) => b(i) && !this.padPrev.has(i);
    if (pressed(0)) this.jumpPressed = true;          // A
    if (pressed(2)) this.reloadPressed = true;        // X
    if (pressed(3)) this.interactPressed = true;      // Y
    if (pressed(1)) this.altPressed = true;           // B
    if (pressed(4)) this.padSlotDelta -= 1;           // LB
    if (pressed(5)) this.padSlotDelta += 1;           // RB
    this.padRun = b(10);                              // L3
    this.padCrouch = b(11) || b(6);                   // R3 ou LT
    const fireNow = b(7) || (gp.buttons[7]?.value ?? 0) > 0.4; // RT
    if (fireNow && !this.padFire) this.queued = true;
    this.padFire = fireNow;
    this.padPrev.clear();
    for (let i = 0; i < gp.buttons.length; i++) if (b(i)) this.padPrev.add(i);
  }

  /** Vetor de movimento combinando teclado, joystick e gamepad. */
  move(): { x: number; z: number } {
    let x = this.stickX + this.padMove.x;
    let z = this.stickZ + this.padMove.z;
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) z += 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) z -= 1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) x += 1;
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) x -= 1;
    return { x: Math.max(-1, Math.min(1, x)), z: Math.max(-1, Math.min(1, z)) };
  }

  get run(): boolean {
    return this.keys.has('ShiftLeft') || this.keys.has('ShiftRight') || this.padRun;
  }

  get crouch(): boolean {
    return this.keys.has('ControlLeft') || this.keys.has('KeyC') || this.padCrouch;
  }

  /** Pulo: verdadeiro só no frame em que foi apertado. */
  consumeJump(): boolean {
    const j = this.jumpPressed;
    this.jumpPressed = false;
    return j;
  }

  pressJump(): void {
    this.jumpPressed = true;
  }

  consumeReload(): boolean { const r = this.reloadPressed; this.reloadPressed = false; return r; }
  consumeInteract(): boolean { const r = this.interactPressed; this.interactPressed = false; return r; }
  consumeAlt(): boolean { const r = this.altPressed; this.altPressed = false; return r; }
  pressReload(): void { this.reloadPressed = true; }
  pressInteract(): void { this.interactPressed = true; }
  pressAlt(): void { this.altPressed = true; }

  setStick(x: number, z: number): void {
    this.stickX = x;
    this.stickZ = z;
  }

  setFiring(down: boolean): void {
    this.firing = down;
    if (down) this.queued = true;
  }

  requestLock(): void {
    this.canvas.requestPointerLock();
  }
}
