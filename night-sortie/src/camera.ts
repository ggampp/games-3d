import * as THREE from 'three';
import type { FlightModel } from './aircraft/flightModel';

export type ViewMode = 'chase' | 'near' | 'cockpit';
const MODES: ViewMode[] = ['chase', 'near', 'cockpit'];

export class ChaseCamera {
  mode: ViewMode = 'chase';
  private pos = new THREE.Vector3(); private vel = new THREE.Vector3();
  private look = new THREE.Vector3();
  private trimX = 0; private trimY = 0;
  private init = false;
  shake = 0;
  constructor(public cam: THREE.PerspectiveCamera) {}
  cycle() { this.mode = MODES[(MODES.indexOf(this.mode) + 1) % MODES.length]; this.init = false; }
  snap() { this.init = false; }
  update(dt: number, fm: FlightModel, camX: number, camY: number) {
    const s = fm.s;
    const fwd = fm.forward(new THREE.Vector3()), up = fm.up(new THREE.Vector3()), right = fm.right(new THREE.Vector3());
    this.trimX += (camX - this.trimX) * Math.min(1, dt * 6); this.trimY += (camY - this.trimY) * Math.min(1, dt * 6);
    if (this.mode === 'cockpit') {
      const p = s.pos.clone().addScaledVector(fwd, -3.2).addScaledVector(up, 1.35);
      const yaw = new THREE.Quaternion().setFromAxisAngle(up, -this.trimX * 1.4);
      const pitchQ = new THREE.Quaternion().setFromAxisAngle(right, -this.trimY * 0.8);
      const dir = fwd.clone().applyQuaternion(yaw).applyQuaternion(pitchQ);
      this.cam.position.copy(p); this.cam.up.copy(up); this.cam.lookAt(p.clone().add(dir));
      this.cam.fov = 70; this.cam.updateProjectionMatrix();
      return;
    }
    const near = this.mode === 'near';
    const back = near ? 16 : 30, height = near ? 4.5 : 8;
    // look-into-turn: rotate the chase offset slightly toward the roll direction
    const rollLean = THREE.MathUtils.degToRad(s.rollDeg) * 0.12 - s.ctrl.roll * 0.05;
    const yawTrim = -this.trimX * 1.2 + rollLean;
    const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yawTrim);
    // blend world-up into camera up to keep the horizon stable but roll with the jet a little
    const camUp = new THREE.Vector3(0, 1, 0).lerp(up, near ? 0.55 : 0.35).normalize();
    const desired = s.pos.clone().addScaledVector(fwd.clone().applyQuaternion(q), -back).addScaledVector(camUp, height + this.trimY * 4);
    // stay above terrain
    if (!this.init) { this.pos.copy(desired); this.vel.set(0, 0, 0); this.init = true; }
    // spring-damper
    const k = near ? 60 : 38, c = near ? 14 : 11;
    const acc = desired.clone().sub(this.pos).multiplyScalar(k).sub(this.vel.clone().multiplyScalar(c));
    this.vel.addScaledVector(acc, dt); this.pos.addScaledVector(this.vel, dt);
    const lookTarget = s.pos.clone().addScaledVector(fwd, near ? 12 : 26).addScaledVector(up, 1);
    this.look.lerp(lookTarget, Math.min(1, dt * 12));
    if (!this.init) this.look.copy(lookTarget);
    this.cam.position.copy(this.pos);
    if (this.shake > 0) { this.cam.position.addScaledVector(right, (Math.random() - 0.5) * this.shake).addScaledVector(camUp, (Math.random() - 0.5) * this.shake); this.shake = Math.max(0, this.shake - dt * 2); }
    this.cam.up.copy(camUp); this.cam.lookAt(this.look);
    const targetFov = 58 + Math.min(1, s.abLevel) * 6 + Math.min(12, s.speedKt / 70);
    this.cam.fov += (targetFov - this.cam.fov) * Math.min(1, dt * 3); this.cam.updateProjectionMatrix();
  }
}
