import * as THREE from 'three';
import { terrainHeight } from '../world/terrain';
import { RUNWAY_WIDTH, RUNWAY_Z0, RUNWAY_Z1 } from '../world/terrain';

export const KT = 1.943844;    // m/s → knots
export const FT = 3.280839;    // m → feet
const G0 = 9.80665;

export interface FlightState {
  pos: THREE.Vector3; vel: THREE.Vector3; quat: THREE.Quaternion;
  throttle: number;        // commanded 0..1 (A/B beyond 0.9)
  n2: number;              // engine spool 0..1
  fuel: number;            // 0..100
  gearDown: boolean; gearPos: number; // 0 up..1 down (animated)
  flapsDown: boolean; flapPos: number;
  brakes: boolean;
  onGround: boolean; crashed: boolean;
  speedKt: number; altFt: number; radarAltFt: number; vsFpm: number; headingDeg: number; pitchDeg: number; rollDeg: number;
  mach: number; g: number; alpha: number; ab: boolean; abLevel: number; buffet: number;
  ctrl: { pitch: number; roll: number; yaw: number };
  landedStats?: { sinkFpm: number; offCentre: number; speedKt: number };
}

const MASS = 20000, S = 42.7;
const THRUST_MIL = 125000, THRUST_AB = 190000;
const CLA = 4.6;             // per rad
const ALPHA_STALL = 0.36;    // ~20°
const CD0 = 0.022, KIND = 0.11;

export class FlightModel {
  s: FlightState;
  private tmpF = new THREE.Vector3(); private tmpU = new THREE.Vector3(); private tmpR = new THREE.Vector3();
  private prevVel = new THREE.Vector3();
  gLoad = 1;
  private touchdownSink = 0;
  private wasAirborne = false;
  private windTime = 0;

  constructor() {
    this.s = {
      pos: new THREE.Vector3(0, 2.2, RUNWAY_Z0 - 120), vel: new THREE.Vector3(), quat: new THREE.Quaternion(),
      throttle: 0, n2: 0.62, fuel: 100, gearDown: true, gearPos: 1, flapsDown: false, flapPos: 0, brakes: true,
      onGround: true, crashed: false, speedKt: 0, altFt: 0, radarAltFt: 0, vsFpm: 0, headingDeg: 0, pitchDeg: 0, rollDeg: 0,
      mach: 0, g: 1, alpha: 0, ab: false, abLevel: 0, buffet: 0, ctrl: { pitch: 0, roll: 0, yaw: 0 },
    };
  }

  /** Place the aircraft on runway 36 threshold, brakes set, engine idle. */
  spawnRunway() {
    const s = this.s;
    s.pos.set(0, 2.2, RUNWAY_Z0 - 120); s.vel.set(0, 0, 0); s.quat.identity();
    s.throttle = 0; s.n2 = 0.62; s.fuel = 100; s.gearDown = true; s.gearPos = 1; s.flapsDown = false; s.flapPos = 0; s.brakes = true;
    s.onGround = true; s.crashed = false; s.landedStats = undefined; this.wasAirborne = false;
  }
  /** Airborne spawn: position, heading deg, speed kt, altitude metres ASL */
  spawnAirborne(x: number, z: number, altM: number, headingDeg: number, speedKt: number) {
    const s = this.s;
    s.pos.set(x, altM, z);
    s.quat.setFromAxisAngle(new THREE.Vector3(0, 1, 0), -THREE.MathUtils.degToRad(headingDeg));
    const fwd = this.forward();
    s.vel.copy(fwd).multiplyScalar(speedKt / KT);
    s.throttle = 0.75; s.n2 = 0.85; s.fuel = 100; s.gearDown = false; s.gearPos = 0; s.flapsDown = false; s.flapPos = 0; s.brakes = false;
    s.onGround = false; s.crashed = false; s.landedStats = undefined; this.wasAirborne = true;
  }

  forward(out = this.tmpF) { return out.set(0, 0, -1).applyQuaternion(this.s.quat); }
  up(out = this.tmpU) { return out.set(0, 1, 0).applyQuaternion(this.s.quat); }
  right(out = this.tmpR) { return out.set(1, 0, 0).applyQuaternion(this.s.quat); }

  get agl() { return this.s.pos.y - terrainHeight(this.s.pos.x, this.s.pos.z); }
  get onRunway() { const p = this.s.pos; return Math.abs(p.x) < RUNWAY_WIDTH / 2 + 4 && p.z < RUNWAY_Z0 + 5 && p.z > RUNWAY_Z1 - 5; }

  update(dt: number, ctrl: { pitch: number; roll: number; yaw: number; throttle: number }) {
    const s = this.s;
    if (s.crashed) return;
    this.windTime += dt;
    // --- engine ---
    s.throttle = ctrl.throttle;
    const n2Target = 0.62 + s.throttle * 0.38;
    const spool = s.throttle > s.n2 ? 0.6 : 0.9;
    s.n2 += (n2Target - s.n2) * Math.min(1, dt * spool);
    s.ab = s.throttle > 0.9 && s.fuel > 0;
    s.abLevel += ((s.ab ? (s.throttle - 0.9) / 0.1 : 0) - s.abLevel) * Math.min(1, dt * 4);
    const thrustN = s.fuel > 0 ? ((s.n2 - 0.62) / 0.38) * THRUST_MIL + s.abLevel * (THRUST_AB - THRUST_MIL) : 0;
    s.fuel = Math.max(0, s.fuel - dt * (0.004 + s.n2 * 0.02 + s.abLevel * 0.08));
    // --- gear / flaps animation ---
    s.gearPos += ((s.gearDown ? 1 : 0) - s.gearPos) * Math.min(1, dt * 0.9);
    if (Math.abs(s.gearPos - (s.gearDown ? 1 : 0)) < 0.01) s.gearPos = s.gearDown ? 1 : 0;
    s.flapPos += ((s.flapsDown ? 1 : 0) - s.flapPos) * Math.min(1, dt * 1.5);

    const fwd = this.forward(new THREE.Vector3()), up = this.up(new THREE.Vector3()), right = this.right(new THREE.Vector3());
    const V = s.vel.length();
    const rho = 1.225 * Math.exp(-s.pos.y / 9000);
    const q = 0.5 * rho * V * V;
    const qn = Math.min(1, q / 12000); // control authority scale (full at ~ 270 kt)

    // --- angle of attack / sideslip ---
    let alpha = 0, beta = 0;
    if (V > 1) {
      const vb = new THREE.Vector3(s.vel.dot(right), s.vel.dot(up), s.vel.dot(fwd)); // right, up, forward
      alpha = Math.atan2(-vb.y, vb.z); // positive when velocity is below the nose
      beta = Math.atan2(vb.x, vb.z);
    }
    s.alpha = alpha;
    // --- aero coefficients ---
    const flapCL = s.flapPos * 0.45;
    let cl: number;
    const aEff = alpha + flapCL * 0.12;
    if (Math.abs(aEff) < ALPHA_STALL) cl = CLA * aEff; else cl = Math.sign(aEff) * (CLA * ALPHA_STALL * Math.max(0.35, 1 - (Math.abs(aEff) - ALPHA_STALL) * 2.2));
    cl += flapCL;
    const gearDrag = s.gearPos * 0.02, flapDrag = s.flapPos * 0.02, brakeDrag = (s.brakes && !s.onGround) ? 0.06 : 0;
    const machNow = V / 340;
    const waveDrag = machNow > 0.85 ? (machNow - 0.85) * 0.45 : 0;
    const cd = CD0 + KIND * cl * cl + gearDrag + flapDrag + brakeDrag + waveDrag + Math.abs(beta) * 0.3;
    const lift = q * S * cl, drag = q * S * cd, side = -q * S * 0.9 * beta;

    // --- forces ---
    const acc = new THREE.Vector3(0, -G0, 0);
    acc.addScaledVector(fwd, thrustN / MASS);
    if (V > 0.5) {
      const vDir = s.vel.clone().normalize();
      const liftDir = up.clone().sub(vDir.clone().multiplyScalar(up.dot(vDir))).normalize();
      acc.addScaledVector(liftDir, lift / MASS);
      acc.addScaledVector(vDir, -drag / MASS);
      acc.addScaledVector(right, side / MASS);
    }

    // --- rotation: rate control scaled by dynamic pressure ---
    const c = s.ctrl; const k = Math.min(1, dt * 8);
    c.pitch += (ctrl.pitch - c.pitch) * k; c.roll += (ctrl.roll - c.roll) * k; c.yaw += (ctrl.yaw - c.yaw) * k;
    const stallFactor = Math.abs(alpha) > ALPHA_STALL ? 0.45 : 1;
    let pitchRate = -c.pitch * THREE.MathUtils.degToRad(48) * (0.25 + 0.75 * qn) * stallFactor;
    let rollRate = c.roll * THREE.MathUtils.degToRad(210) * (0.2 + 0.8 * qn) * stallFactor;
    let yawRate = c.yaw * THREE.MathUtils.degToRad(18) * (0.3 + 0.7 * qn);
    // aerodynamic stability: weathervane into the airflow, damp alpha
    if (V > 5 && !s.onGround) { pitchRate -= alpha * 2.2 * qn; yawRate -= beta * 2.5 * qn; }
    // stall wing rock
    s.buffet = V > 20 ? THREE.MathUtils.clamp((Math.abs(alpha) - ALPHA_STALL * 0.75) / (ALPHA_STALL * 0.35), 0, 1) : 0;
    if (s.buffet > 0 && !s.onGround) { rollRate += Math.sin(this.windTime * 9) * s.buffet * 0.8; pitchRate += Math.sin(this.windTime * 13) * s.buffet * 0.25; }
    // compressibility: soft nose-heaviness at high mach
    if (machNow > 0.95) pitchRate -= Math.min(0.06, (machNow - 0.95) * 0.15);

    // --- ground handling ---
    const gy = terrainHeight(s.pos.x, s.pos.z);
    const gearH = 2.2;
    if (s.onGround) {
      // stay on the surface
      s.pos.y = gy + gearH;
      // keep wings level & pitch to ground unless rotating
      const e = new THREE.Euler().setFromQuaternion(s.quat, 'YXZ');
      const wantPitch = V > 65 ? Math.max(0, -c.pitch * 0.24) : 0; // allow rotation past ~125 kt
      e.x += (wantPitch - e.x) * Math.min(1, dt * 3); e.z += (0 - e.z) * Math.min(1, dt * 5);
      s.quat.setFromEuler(e);
      // nosewheel steering
      const steer = (c.yaw + c.roll * 0.5) * THREE.MathUtils.degToRad(28) * Math.min(1, 30 / Math.max(V, 1)) * Math.min(1, V / 4);
      e.y -= steer * dt; s.quat.setFromEuler(e);
      // velocity constrained to heading, ground friction & brakes
      const f2 = this.forward(new THREE.Vector3()); f2.y = 0; f2.normalize();
      let vAlong = s.vel.dot(f2);
      const accAlong = acc.dot(f2) - Math.sign(vAlong) * (s.brakes ? 4.0 : 0.25) * (Math.abs(vAlong) > 0.3 ? 1 : 0);
      vAlong += accAlong * dt;
      if (s.brakes && Math.abs(vAlong) < 0.6 && thrustN / MASS < 3.5) vAlong = 0;
      if (vAlong < 0) vAlong = 0;
      s.vel.copy(f2).multiplyScalar(vAlong);
      // lift-off
      const liftAcc = (V > 0.5 ? lift / MASS : 0);
      if (liftAcc > G0 * 1.02 && e.x > 0.02) { s.onGround = false; this.wasAirborne = true; s.vel.y = 1.5; }
      if (!this.onRunway && V > 30) { this.crash(); return; }
      s.pos.addScaledVector(s.vel, dt);
      s.pos.y = gy + gearH;
    } else {
      // integrate rotation in body axes
      const dq = new THREE.Quaternion();
      const rot = new THREE.Vector3(pitchRate, yawRate * -1, -rollRate).multiplyScalar(dt);
      const ang = rot.length();
      if (ang > 0) { dq.setFromAxisAngle(rot.normalize(), ang); s.quat.multiply(dq).normalize(); }
      s.vel.addScaledVector(acc, dt);
      s.pos.addScaledVector(s.vel, dt);
      // touchdown / crash
      const agl = s.pos.y - gy;
      if (agl <= gearH) {
        const e = new THREE.Euler().setFromQuaternion(s.quat, 'YXZ');
        const sink = -s.vel.y;
        const gearOK = s.gearPos > 0.95;
        const attitudeOK = Math.abs(e.z) < THREE.MathUtils.degToRad(12) && e.x > -0.05 && e.x < THREE.MathUtils.degToRad(16);
        if (gearOK && attitudeOK && sink < 6.5 && this.onRunway && V < 130) {
          s.onGround = true; s.pos.y = gy + gearH; s.vel.y = 0;
          this.touchdownSink = sink;
          s.landedStats = { sinkFpm: sink * FT * 60, offCentre: Math.abs(s.pos.x), speedKt: V * KT };
          e.x = 0; e.z = 0; s.quat.setFromEuler(e);
        } else { this.crash(); return; }
      }
    }
    // --- derived instruments ---
    const dv = s.vel.clone().sub(this.prevVel).divideScalar(Math.max(dt, 1e-4));
    dv.y += G0;
    const gNow = dv.dot(up) / G0;
    this.gLoad += (gNow - this.gLoad) * Math.min(1, dt * 6);
    this.prevVel.copy(s.vel);
    const e = new THREE.Euler().setFromQuaternion(s.quat, 'YXZ');
    s.speedKt = V * KT; s.altFt = s.pos.y * FT; s.radarAltFt = Math.max(0, (s.pos.y - gy - gearH * 0.9) * FT);
    s.vsFpm = s.vel.y * FT * 60; s.headingDeg = ((-THREE.MathUtils.radToDeg(e.y)) % 360 + 360) % 360;
    s.pitchDeg = THREE.MathUtils.radToDeg(e.x); s.rollDeg = -THREE.MathUtils.radToDeg(e.z);
    s.mach = machNow; s.g = s.onGround ? 1 : this.gLoad;
  }
  get touchdownSinkRate() { return this.touchdownSink; }
  get everAirborne() { return this.wasAirborne; }
  crash() { this.s.crashed = true; this.s.vel.set(0, 0, 0); }
}
