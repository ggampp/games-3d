import * as THREE from 'three';
import type { Drone } from '../drones/drone';

/* ------------------------------------------------------------------ geometry (shared) */
const bodyGeo = (() => { const g = new THREE.CylinderGeometry(0.1, 0.1, 2.2, 8); g.rotateX(Math.PI / 2); return g; })();
const noseGeo = (() => { const g = new THREE.ConeGeometry(0.1, 0.55, 8); g.rotateX(Math.PI / 2); g.translate(0, 0, 1.38); return g; })();
const finGeo = (() => { const g = new THREE.BoxGeometry(0.55, 0.04, 0.45); g.translate(0.3, 0, -0.9); return g; })();
const canardGeo = (() => { const g = new THREE.BoxGeometry(0.36, 0.03, 0.3); g.translate(0.2, 0, 0.75); return g; })();
const bodyMat = new THREE.MeshStandardMaterial({ color: 0xd8dde2, roughness: 0.5, metalness: 0.4, flatShading: true });
const finMat = new THREE.MeshStandardMaterial({ color: 0x30363c, roughness: 0.7, metalness: 0.3, flatShading: true });
const seekerMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.4, 0.95, 1).multiplyScalar(4), toneMapped: false });

const TRAIL = 26;

/** One guided training round in flight. */
class Round {
  group = new THREE.Group();
  pos = new THREE.Vector3(); vel = new THREE.Vector3();
  life = 14; armT = 1.5; motor = 1.6;
  target: Drone | null = null;
  locked = false;
  private trail: THREE.Line;
  private trailPos: Float32Array;
  private plume: THREE.Sprite;
  private plumeMat: THREE.SpriteMaterial;
  private q = new THREE.Quaternion(); private axisZ = new THREE.Vector3(0, 0, 1);

  constructor() {
    const g = this.group;
    g.add(new THREE.Mesh(bodyGeo, bodyMat));
    g.add(new THREE.Mesh(noseGeo, bodyMat));
    const seeker = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 6), seekerMat); seeker.position.z = 1.62; g.add(seeker);
    for (let i = 0; i < 4; i++) {
      const a = i * Math.PI / 2 + Math.PI / 4;
      const f = new THREE.Mesh(finGeo, finMat); f.rotation.z = a; g.add(f);
      const c = new THREE.Mesh(canardGeo, finMat); c.rotation.z = a; g.add(c);
    }
    this.plumeMat = new THREE.SpriteMaterial({ color: new THREE.Color(1, 0.72, 0.35).multiplyScalar(6), transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
    this.plume = new THREE.Sprite(this.plumeMat); this.plume.scale.setScalar(3.4); this.plume.position.z = -1.5; g.add(this.plume);
    // luminous trail: a fixed-length polyline dragged behind the round
    this.trailPos = new Float32Array(TRAIL * 3);
    const tg = new THREE.BufferGeometry(); tg.setAttribute('position', new THREE.BufferAttribute(this.trailPos, 3));
    this.trail = new THREE.Line(tg, new THREE.LineBasicMaterial({ color: new THREE.Color(0.75, 0.9, 1).multiplyScalar(3), transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
    this.trail.frustumCulled = false;
  }
  get trailObject() { return this.trail; }

  launch(origin: THREE.Vector3, dir: THREE.Vector3, shipVel: THREE.Vector3, target: Drone | null) {
    this.pos.copy(origin); this.vel.copy(shipVel).addScaledVector(dir, 190);
    this.life = 14; this.armT = 1.5; this.motor = 1.6; this.target = target; this.locked = false;
    for (let i = 0; i < TRAIL; i++) { this.trailPos[i * 3] = origin.x; this.trailPos[i * 3 + 1] = origin.y; this.trailPos[i * 3 + 2] = origin.z; }
    this.group.position.copy(origin);
    this.sync();
  }
  private sync() {
    const d = this.vel.clone().normalize();
    this.q.setFromUnitVectors(this.axisZ, d); this.group.quaternion.copy(this.q);
    this.group.position.copy(this.pos);
  }
  /** Advance one step. Returns 'live' | 'expired' | 'hit'. */
  step(dt: number): 'live' | 'expired' | 'hit' {
    this.life -= dt;
    if (this.life <= 0) return 'expired';
    if (this.armT > 0) this.armT -= dt;
    // motor boost then coast
    if (this.motor > 0) { this.motor -= dt; this.vel.addScaledVector(this.vel.clone().normalize(), 210 * dt); }
    this.vel.y -= 3.2 * dt;              // light gravity, it is a powered round
    this.vel.multiplyScalar(1 - dt * 0.09); // drag
    // guidance: proportional-ish steering once armed and locked on a live drone
    const t = this.target;
    if (t && t.alive) {
      if (this.armT <= 0) {
        this.locked = true;
        const speed = this.vel.length();
        const rel = t.pos.clone().sub(this.pos);
        const closing = Math.max(60, speed - t.vel.clone().dot(rel.clone().normalize()));
        const lead = t.pos.clone().addScaledVector(t.vel, Math.min(3, rel.length() / closing));
        const want = lead.sub(this.pos).normalize();
        const cur = this.vel.clone().normalize();
        const ang = cur.angleTo(want);
        if (ang > 1e-4) {
          const axis = cur.clone().cross(want).normalize();
          cur.applyAxisAngle(axis, Math.min(ang, 4.2 * dt));
          this.vel.copy(cur).multiplyScalar(speed);
        }
      }
    } else this.target = null;
    this.pos.addScaledVector(this.vel, dt);
    // proximity fuse
    if (t && t.alive && this.armT <= 0 && this.pos.distanceTo(t.pos) < 26 + t.radius) return 'hit';
    this.sync();
    // trail: shift the buffer and push the tail position
    this.trailPos.copyWithin(3, 0, (TRAIL - 1) * 3);
    this.trailPos[0] = this.pos.x - this.vel.x * 0.01; this.trailPos[1] = this.pos.y - this.vel.y * 0.01; this.trailPos[2] = this.pos.z - this.vel.z * 0.01;
    (this.trail.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    const burn = Math.max(0, this.motor / 1.6);
    this.plume.scale.setScalar(2.2 + burn * 4 + Math.random() * 0.6);
    this.plumeMat.opacity = 0.35 + burn * 0.6;
    return 'live';
  }
}

/**
 * The player's guided training rounds: a small, limited magazine of self-guiding practice rounds.
 * They fly straight for 1.5 s, then lock onto the drone they were fired at and steer to a proximity
 * fuse. Everything is procedural geometry; the trail is an additive polyline.
 */
export class GuidedRounds {
  group = new THREE.Group();
  private live: Round[] = [];
  private pool: Round[] = [];

  /** Fire one round at `target`. */
  fire(origin: THREE.Vector3, dir: THREE.Vector3, shipVel: THREE.Vector3, target: Drone | null) {
    const r = this.pool.pop() ?? new Round();
    r.launch(origin, dir, shipVel, target);
    this.group.add(r.group, r.trailObject);
    this.live.push(r);
  }
  get count() { return this.live.length; }
  /** True while at least one round is still steering toward its drone (drives the HUD cue). */
  get tracking() { return this.live.some((r) => r.locked && r.target?.alive); }
  clear() { for (const r of this.live) this.retire(r); this.live.length = 0; }
  private retire(r: Round) { this.group.remove(r.group, r.trailObject); this.pool.push(r); }

  /**
   * Advance all rounds. `onHit` is called with the drone and the burst point; `groundY` retires
   * rounds that hit the terrain (reported through `onMiss`).
   */
  update(dt: number, groundY: (x: number, z: number) => number, onHit: (d: Drone, p: THREE.Vector3) => void, onMiss?: (p: THREE.Vector3) => void) {
    for (let i = this.live.length - 1; i >= 0; i--) {
      const r = this.live[i];
      const res = r.step(dt);
      if (res === 'hit') { const t = r.target!; onHit(t, r.pos.clone()); this.retire(r); this.live.splice(i, 1); continue; }
      if (res === 'expired' || r.pos.y < groundY(r.pos.x, r.pos.z)) { onMiss?.(r.pos.clone()); this.retire(r); this.live.splice(i, 1); }
    }
  }
}
