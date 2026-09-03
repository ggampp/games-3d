import * as THREE from 'three';

/** Tracers (short pale-gold dashes) and impact sparks. Instanced. */
export class Tracers {
  mesh: THREE.InstancedMesh;
  private pos: THREE.Vector3[] = []; private vel: THREE.Vector3[] = []; private life: number[] = [];
  private free: number[] = [];
  private tmpM = new THREE.Matrix4(); private tmpQ = new THREE.Quaternion(); private up = new THREE.Vector3(0, 0, 1);
  readonly max = 220;
  readonly speed = 1050; // m/s muzzle velocity
  constructor() {
    const geo = new THREE.CylinderGeometry(0.06, 0.06, 6, 5); geo.rotateX(Math.PI / 2);
    const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.0, 0.85, 0.5).multiplyScalar(6), toneMapped: false, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false });
    this.mesh = new THREE.InstancedMesh(geo, mat, this.max);
    this.mesh.frustumCulled = false;
    for (let i = 0; i < this.max; i++) { this.pos.push(new THREE.Vector3()); this.vel.push(new THREE.Vector3()); this.life.push(0); this.free.push(i); this.mesh.setMatrixAt(i, new THREE.Matrix4().makeScale(0, 0, 0)); }
  }
  fire(origin: THREE.Vector3, dir: THREE.Vector3, shipVel: THREE.Vector3) {
    const i = this.free.pop(); if (i === undefined) return;
    const spread = 0.004;
    const d = dir.clone().add(new THREE.Vector3((Math.random() - 0.5) * spread, (Math.random() - 0.5) * spread, (Math.random() - 0.5) * spread)).normalize();
    this.pos[i].copy(origin); this.vel[i].copy(shipVel).addScaledVector(d, this.speed); this.life[i] = 2.2;
  }
  /** Advances tracers; calls `hitTest(p0, p1)` for each; when it returns true the round is consumed. */
  update(dt: number, hitTest: (p0: THREE.Vector3, p1: THREE.Vector3) => boolean, groundY: (x: number, z: number) => number, onGround?: (p: THREE.Vector3) => void) {
    const p1 = new THREE.Vector3();
    for (let i = 0; i < this.max; i++) {
      if (this.life[i] <= 0) continue;
      this.life[i] -= dt;
      this.vel[i].y -= 9.81 * dt;
      p1.copy(this.pos[i]).addScaledVector(this.vel[i], dt);
      let dead = this.life[i] <= 0;
      if (!dead && hitTest(this.pos[i], p1)) dead = true;
      if (!dead && p1.y < groundY(p1.x, p1.z)) { dead = true; onGround?.(p1); }
      if (dead) { this.life[i] = 0; this.free.push(i); this.mesh.setMatrixAt(i, this.tmpM.makeScale(0, 0, 0)); }
      else {
        this.pos[i].copy(p1);
        this.tmpQ.setFromUnitVectors(this.up, this.vel[i].clone().normalize());
        this.tmpM.compose(p1, this.tmpQ, new THREE.Vector3(1, 1, 1));
        this.mesh.setMatrixAt(i, this.tmpM);
      }
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

export class Sparks {
  points: THREE.Points;
  private pos: Float32Array; private vel: Float32Array; private life: Float32Array; private col: Float32Array;
  readonly max = 600;
  constructor() {
    this.pos = new Float32Array(this.max * 3); this.vel = new Float32Array(this.max * 3); this.life = new Float32Array(this.max); this.col = new Float32Array(this.max * 3);
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(this.col, 3));
    const m = new THREE.PointsMaterial({ size: 1.4, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, sizeAttenuation: true });
    this.points = new THREE.Points(g, m); this.points.frustumCulled = false;
    for (let i = 0; i < this.max; i++) this.pos[i * 3 + 1] = -1e5;
  }
  burst(p: THREE.Vector3, n: number, speed: number, color: THREE.Color, lifeS = 0.6) {
    let made = 0;
    for (let i = 0; i < this.max && made < n; i++) {
      if (this.life[i] > 0) continue;
      this.life[i] = lifeS * (0.5 + Math.random());
      this.pos[i * 3] = p.x; this.pos[i * 3 + 1] = p.y; this.pos[i * 3 + 2] = p.z;
      const a = Math.random() * Math.PI * 2, b = Math.acos(Math.random() * 2 - 1), sp = speed * (0.3 + Math.random());
      this.vel[i * 3] = Math.sin(b) * Math.cos(a) * sp; this.vel[i * 3 + 1] = Math.cos(b) * sp; this.vel[i * 3 + 2] = Math.sin(b) * Math.sin(a) * sp;
      this.col[i * 3] = color.r * 4; this.col[i * 3 + 1] = color.g * 4; this.col[i * 3 + 2] = color.b * 4;
      made++;
    }
  }
  update(dt: number) {
    for (let i = 0; i < this.max; i++) {
      if (this.life[i] <= 0) continue;
      this.life[i] -= dt;
      if (this.life[i] <= 0) { this.pos[i * 3 + 1] = -1e5; continue; }
      this.vel[i * 3 + 1] -= 9.81 * dt;
      this.pos[i * 3] += this.vel[i * 3] * dt; this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt; this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      const f = 0.85;
      this.col[i * 3] *= 1 - (1 - f) * dt * 8; this.col[i * 3 + 1] *= 1 - (1 - f) * dt * 8; this.col[i * 3 + 2] *= 1 - (1 - f) * dt * 8;
    }
    (this.points.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    (this.points.geometry.attributes.color as THREE.BufferAttribute).needsUpdate = true;
  }
}
