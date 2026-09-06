import * as THREE from 'three';

/**
 * Enemy projectiles: slow glowing orbs with weak homing, dodgeable with a hard turn. While a flare
 * is burning they home on the nearest flare instead of the player. Instanced.
 */
export class EnemyShots {
  mesh: THREE.InstancedMesh;
  readonly max = 64;
  readonly speed = 260; // m/s (~500 kt), fired with the drone's velocity added
  private pos: THREE.Vector3[] = []; private vel: THREE.Vector3[] = []; private life: number[] = [];
  private tmpM = new THREE.Matrix4(); private tmpQ = new THREE.Quaternion(); private axisZ = new THREE.Vector3(0, 0, 1);
  constructor() {
    const geo = new THREE.SphereGeometry(1.1, 8, 6); geo.scale(1, 1, 2.2);
    const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.0, 0.42, 0.18).multiplyScalar(7), toneMapped: false, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false });
    this.mesh = new THREE.InstancedMesh(geo, mat, this.max); this.mesh.frustumCulled = false;
    for (let i = 0; i < this.max; i++) { this.pos.push(new THREE.Vector3()); this.vel.push(new THREE.Vector3()); this.life.push(0); this.mesh.setMatrixAt(i, new THREE.Matrix4().makeScale(0, 0, 0)); }
  }
  get active() { let n = 0; for (const l of this.life) if (l > 0) n++; return n; }
  fire(origin: THREE.Vector3, dir: THREE.Vector3, shooterVel: THREE.Vector3) {
    const i = this.life.findIndex((l) => l <= 0); if (i < 0) return;
    this.pos[i].copy(origin).addScaledVector(dir, 12);
    this.vel[i].copy(shooterVel).multiplyScalar(0.5).addScaledVector(dir, this.speed);
    this.life[i] = 6;
  }
  clear() { for (let i = 0; i < this.max; i++) { this.life[i] = 0; this.mesh.setMatrixAt(i, this.tmpM.makeScale(0, 0, 0)); } this.mesh.instanceMatrix.needsUpdate = true; }
  /**
   * Advance. `flares` are decoy positions (empty when none burning). `onHitPlayer` / `onHitFlare`
   * are called with the impact point; `groundY` kills shots that hit the terrain.
   */
  update(dt: number, playerPos: THREE.Vector3, flares: THREE.Vector3[], groundY: (x: number, z: number) => number, onHitPlayer: (p: THREE.Vector3) => void, onHitFlare: (p: THREE.Vector3) => void) {
    for (let i = 0; i < this.max; i++) {
      if (this.life[i] <= 0) continue;
      this.life[i] -= dt;
      const p = this.pos[i], v = this.vel[i];
      // homing target: nearest flare if any, else the player
      let tgt = playerPos; let flareTgt = false;
      if (flares.length) { let bd = Infinity; for (const f of flares) { const d = f.distanceToSquared(p); if (d < bd) { bd = d; tgt = f; flareTgt = true; } } }
      const desired = tgt.clone().sub(p).normalize(); const cur = v.clone().normalize();
      const ang = cur.angleTo(desired); const maxAng = (flareTgt ? 1.4 : 0.55) * dt;
      if (ang > 1e-4) { cur.applyAxisAngle(cur.clone().cross(desired).normalize(), Math.min(ang, maxAng)); v.copy(cur).multiplyScalar(v.length()); }
      p.addScaledVector(v, dt);
      let dead = this.life[i] <= 0;
      if (!dead && flareTgt && p.distanceTo(tgt) < 25) { dead = true; onHitFlare(p); }
      if (!dead && p.distanceTo(playerPos) < 13) { dead = true; onHitPlayer(p); }
      if (!dead && p.y < groundY(p.x, p.z)) dead = true;
      if (dead) { this.life[i] = 0; this.mesh.setMatrixAt(i, this.tmpM.makeScale(0, 0, 0)); }
      else { this.tmpQ.setFromUnitVectors(this.axisZ, cur); this.tmpM.compose(p, this.tmpQ, new THREE.Vector3(1, 1, 1)); this.mesh.setMatrixAt(i, this.tmpM); }
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

/** Player countermeasures: bright decoys that fall away behind the jet and burn for a few seconds. */
export class Flares {
  group = new THREE.Group();
  private items: Array<{ sprite: THREE.Sprite; pos: THREE.Vector3; vel: THREE.Vector3; life: number }> = [];
  private mat: THREE.SpriteMaterial;
  constructor() {
    this.mat = new THREE.SpriteMaterial({ color: new THREE.Color(1, 0.8, 0.45).multiplyScalar(5), transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
  }
  get positions() { return this.items.map((f) => f.pos); }
  get active() { return this.items.length > 0; }
  deploy(pos: THREE.Vector3, vel: THREE.Vector3, up: THREE.Vector3, right: THREE.Vector3) {
    for (const sx of [-1, 1]) {
      const s = new THREE.Sprite(this.mat.clone()); s.scale.setScalar(9); this.group.add(s);
      const v = vel.clone().multiplyScalar(0.55).addScaledVector(up, -18).addScaledVector(right, sx * 22);
      this.items.push({ sprite: s, pos: pos.clone().addScaledVector(up, -1.5), vel: v, life: 3.2 });
    }
  }
  clear() { for (const f of this.items) this.group.remove(f.sprite); this.items.length = 0; }
  update(dt: number) {
    for (let i = this.items.length - 1; i >= 0; i--) {
      const f = this.items[i]; f.life -= dt;
      if (f.life <= 0) { this.group.remove(f.sprite); this.items.splice(i, 1); continue; }
      f.vel.y -= 9.81 * dt; f.vel.multiplyScalar(1 - dt * 0.9);
      f.pos.addScaledVector(f.vel, dt); f.sprite.position.copy(f.pos);
      const k = Math.min(1, f.life / 1.2);
      f.sprite.scale.setScalar((7 + Math.random() * 4) * (0.4 + 0.6 * k)); (f.sprite.material as THREE.SpriteMaterial).opacity = k;
    }
  }
}
