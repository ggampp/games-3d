import type { PhysicsSim } from '../physics/sim.ts';

export const PLAYER_HEIGHT = 1.7;
export const CROUCH_HEIGHT = 1.15;
export const EYE_OFFSET = 0.12; // olho abaixo do topo da cápsula

const WALK = 4.4;
const RUN = 6.8;
const CROUCH = 2.2;
const ACCEL = 14;
const AIR_ACCEL = 4;
const GRAVITY = 18;
const JUMP_VEL = 5.6;
const COYOTE = 0.12;
const JUMP_BUFFER = 0.12;

export interface MoveInput {
  /** -1..1 no plano local (x = direita, z = frente). */
  x: number;
  z: number;
  run: boolean;
  crouch: boolean;
  jump: boolean;
}

export interface PlayerEvents {
  step?: (kind: 'sand' | 'wood' | 'stone') => void;
  jump?: () => void;
  land?: (impact: number) => void;
}

/** Direção plana a partir do yaw (sem pitch). */
export function planarBasis(yaw: number): { fx: number; fz: number; rx: number; rz: number } {
  const fx = -Math.sin(yaw);
  const fz = -Math.cos(yaw);
  return { fx, fz, rx: -fz, rz: fx };
}

/** Aproxima `v` de `target` a `rate` por segundo. */
export function approach(v: number, target: number, rate: number, dt: number): number {
  const d = target - v;
  const step = rate * dt;
  if (Math.abs(d) <= step) return target;
  return v + Math.sign(d) * step;
}

export class Player {
  private physics: PhysicsSim;
  private vx = 0;
  private vy = 0;
  private vz = 0;
  private grounded = false;
  private airTime = 0;
  private sinceGround = 0;
  private jumpQueued = 0;
  private crouched = false;
  private bobPhase = 0;
  private stepDist = 0;
  private landDip = 0;
  private events: PlayerEvents;
  /** Altura atual (agacha suavemente). */
  height = PLAYER_HEIGHT;
  /** > 0 enquanto uma força externa (gancho) manda no movimento. */
  pulled = 0;
  speedNorm = 0;

  constructor(physics: PhysicsSim, events: PlayerEvents = {}) {
    this.physics = physics;
    this.events = events;
  }

  spawn(x: number, z: number, y = 0): void {
    this.physics.createPlayer(x, y + PLAYER_HEIGHT / 2, z);
    this.physics.setPlayerPosition(x, y + PLAYER_HEIGHT / 2 + 0.05, z);
    this.vx = this.vy = this.vz = 0;
    this.grounded = false;
    this.landDip = 0;
  }

  update(dt: number, yaw: number, input: MoveInput, groundKind: () => 'deck' | 'plaza' | 'sand' | 'voxel' | 'air'): void {
    const { fx, fz, rx, rz } = planarBasis(yaw);
    let mx = input.x;
    let mz = input.z;
    const len = Math.hypot(mx, mz);
    if (len > 1) { mx /= len; mz /= len; }

    // Agachar: só levanta se houver espaço (tenta e desiste se bloquear).
    const wantCrouch = input.crouch;
    if (wantCrouch !== this.crouched) {
      this.crouched = wantCrouch;
      this.physics.setPlayerHeight(wantCrouch ? CROUCH_HEIGHT : PLAYER_HEIGHT);
    }
    const targetH = this.crouched ? CROUCH_HEIGHT : PLAYER_HEIGHT;
    this.height = approach(this.height, targetH, 4, dt);

    const max = this.crouched ? CROUCH : input.run && len > 0.1 ? RUN : WALK;
    const tx = (fx * mz + rx * mx) * max;
    const tz = (fz * mz + rz * mx) * max;
    if (this.pulled > 0) {
      this.pulled -= dt;
      // Só um leve controle no ar; a velocidade externa fica.
      this.vx += tx * dt * 1.5;
      this.vz += tz * dt * 1.5;
      this.vx *= 1 - dt * 0.4;
      this.vz *= 1 - dt * 0.4;
    } else {
      const accel = this.grounded ? ACCEL : AIR_ACCEL;
      this.vx = approach(this.vx, tx, accel * max, dt);
      this.vz = approach(this.vz, tz, accel * max, dt);
    }

    if (input.jump) this.jumpQueued = JUMP_BUFFER;
    else this.jumpQueued = Math.max(0, this.jumpQueued - dt);

    if (this.grounded) this.sinceGround = 0;
    else this.sinceGround += dt;

    if (this.jumpQueued > 0 && this.sinceGround < COYOTE && this.vy <= 0.5) {
      this.vy = JUMP_VEL;
      this.jumpQueued = 0;
      this.sinceGround = COYOTE;
      this.grounded = false;
      this.events.jump?.();
    }

    if (this.pulled > 0) this.vy -= GRAVITY * 0.45 * dt;
    else if (!this.grounded) this.vy -= GRAVITY * dt;
    else if (this.vy < 0) this.vy = -0.5; // encosta no chão

    const desired = { x: this.vx * dt, y: this.vy * dt, z: this.vz * dt };
    const wasGrounded = this.grounded;
    const fallSpeed = this.vy;
    const res = this.physics.movePlayer(desired);
    this.grounded = res.grounded;
    if (this.grounded && this.vy < 0 && this.pulled <= 0) this.vy = 0;
    if (!this.grounded && res.moved.y > desired.y + 1e-4 && this.vy > 0) this.vy = 0; // bateu a cabeça
    // Escorrega ao bater na parede (perde a componente bloqueada).
    if (Math.abs(res.moved.x - desired.x) > 1e-4) this.vx *= 0.5;
    if (Math.abs(res.moved.z - desired.z) > 1e-4) this.vz *= 0.5;

    if (!wasGrounded && this.grounded) {
      const impact = Math.max(0, -fallSpeed);
      this.airTime = 0;
      if (impact > 2.5) {
        this.landDip = Math.min(0.12, impact * 0.018);
        this.events.land?.(impact);
      }
    }
    if (!this.grounded) this.airTime += dt;

    // Passos e head-bob.
    const speed = Math.hypot(res.moved.x, res.moved.z) / Math.max(dt, 1e-4);
    this.speedNorm = Math.min(1, speed / RUN);
    if (this.grounded && speed > 0.4) {
      this.bobPhase += dt * (5.4 + speed * 0.9);
      this.stepDist += speed * dt;
      const stride = this.crouched ? 1.1 : input.run ? 2.1 : 1.6;
      if (this.stepDist > stride) {
        this.stepDist = 0;
        const g = groundKind();
        this.events.step?.(g === 'deck' || g === 'voxel' ? 'wood' : g === 'plaza' ? 'stone' : 'sand');
      }
    } else {
      this.stepDist = Math.min(this.stepDist, 0.9);
    }
    this.landDip = approach(this.landDip, 0, 0.5, dt);
  }

  /** Empurrão externo (gancho, explosão). */
  impulse(x: number, y: number, z: number, external = true): void {
    this.vx += x;
    this.vy += y;
    this.vz += z;
    if (external) this.pulled = 0.25;
    if (y > 0.5) { this.grounded = false; this.sinceGround = COYOTE; }
  }

  velocity(): { x: number; y: number; z: number } {
    return { x: this.vx, y: this.vy, z: this.vz };
  }

  /** Posição do olho (com bob e dip). */
  eye(): { x: number; y: number; z: number; roll: number } {
    const p = this.physics.playerPosition();
    const bobY = Math.sin(this.bobPhase * 2) * 0.018 * this.speedNorm;
    const bobX = Math.cos(this.bobPhase) * 0.012 * this.speedNorm;
    const top = p.y - PLAYER_HEIGHT / 2 + this.height;
    return {
      x: p.x + bobX,
      y: top - EYE_OFFSET + bobY - this.landDip,
      z: p.z,
      roll: Math.cos(this.bobPhase) * 0.006 * this.speedNorm,
    };
  }

  get isGrounded(): boolean {
    return this.grounded;
  }

  get isCrouched(): boolean {
    return this.crouched;
  }

  position(): { x: number; y: number; z: number } {
    return this.physics.playerPosition();
  }
}
