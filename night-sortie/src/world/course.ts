import * as THREE from 'three';
import { terrainHeight, CORRIDOR_X0, CORRIDOR_X1, CORRIDOR_Z, RUNWAY_Z0 } from './terrain';

/** Translucent luminous rectangular frame. `heading` in degrees (0 = facing north, aircraft passes along -Z). */
export class Gate {
  group = new THREE.Group();
  passed = false;
  readonly normal = new THREE.Vector3();
  readonly center: THREE.Vector3;
  private frameMat: THREE.MeshBasicMaterial;
  private fillMat: THREE.MeshBasicMaterial;
  constructor(center: THREE.Vector3, public readonly headingDeg: number, public readonly width = 90, public readonly height = 60, color = 0x7ff3ff) {
    this.center = center.clone();
    const g = this.group;
    this.frameMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(3), toneMapped: false });
    this.fillMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.07, side: THREE.DoubleSide, depthWrite: false });
    const t = 1.4;
    const bar = (w: number, h: number, x: number, y: number) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, t), this.frameMat); m.position.set(x, y, 0); g.add(m); };
    bar(width, t, 0, height / 2); bar(width, t, 0, -height / 2); bar(t, height, width / 2, 0); bar(t, height, -width / 2, 0);
    // corner lamps
    for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      const l = new THREE.Mesh(new THREE.SphereGeometry(1.6, 8, 6), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(6), toneMapped: false }));
      l.position.set(sx * width / 2, sy * height / 2, 0); g.add(l);
    }
    const fill = new THREE.Mesh(new THREE.PlaneGeometry(width, height), this.fillMat); g.add(fill);
    // support pylons to the ground
    const groundY = terrainHeight(center.x, center.z);
    const legH = Math.max(1, center.y - height / 2 - groundY);
    const legMat = new THREE.MeshStandardMaterial({ color: 0x2a3138, roughness: 0.8 });
    for (const sx of [-1, 1]) { const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 1.2, legH, 6), legMat); leg.position.set(sx * width / 2, -height / 2 - legH / 2, 0); g.add(leg); }
    g.position.copy(center);
    g.rotation.y = -THREE.MathUtils.degToRad(headingDeg);
    this.normal.set(Math.sin(THREE.MathUtils.degToRad(headingDeg)), 0, -Math.cos(THREE.MathUtils.degToRad(headingDeg)));
  }
  setState(state: 'next' | 'idle' | 'done' | 'missed') {
    const c = state === 'next' ? new THREE.Color(0xffffff) : state === 'done' ? new THREE.Color(0x4dff7a) : state === 'missed' ? new THREE.Color(0xff5a5a) : new THREE.Color(0x7ff3ff);
    this.frameMat.color.copy(c).multiplyScalar(state === 'next' ? 5 : 2.5);
    this.fillMat.color.copy(c); this.fillMat.opacity = state === 'next' ? 0.14 : 0.06;
  }
  /** Returns true if the segment prev→cur crosses the gate plane inside the frame. */
  crossed(prev: THREE.Vector3, cur: THREE.Vector3): { hit: boolean; offset: number } {
    const dp = prev.clone().sub(this.center).dot(this.normal);
    const dc = cur.clone().sub(this.center).dot(this.normal);
    if (!(dp < 0 && dc >= 0)) return { hit: false, offset: 0 };
    const t = dp / (dp - dc);
    const p = prev.clone().lerp(cur, t).sub(this.center);
    const right = new THREE.Vector3(this.normal.z * -1, 0, this.normal.x).multiplyScalar(-1); // right of the normal
    const lx = p.dot(right), ly = p.y;
    const hit = Math.abs(lx) <= this.width / 2 && Math.abs(ly) <= this.height / 2;
    return { hit, offset: Math.hypot(lx / (this.width / 2), ly / (this.height / 2)) };
  }
}

/** Vertical lit pole with a sensor halo */
export class Pylon {
  group = new THREE.Group();
  readonly top: THREE.Vector3;
  private halo: THREE.Mesh;
  private haloMat: THREE.MeshBasicMaterial;
  done = false;
  constructor(x: number, z: number, h = 80) {
    const gy = terrainHeight(x, z);
    this.top = new THREE.Vector3(x, gy + h, z);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 2.4, h, 8), new THREE.MeshStandardMaterial({ color: 0x3a4148, roughness: 0.7 }));
    pole.position.set(x, gy + h / 2, z); this.group.add(pole);
    for (let i = 1; i <= 4; i++) {
      const l = new THREE.Mesh(new THREE.SphereGeometry(1.0, 6, 5), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xff5030).multiplyScalar(4), toneMapped: false }));
      l.position.set(x, gy + h * i / 4, z); this.group.add(l);
    }
    this.haloMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0x7ff3ff).multiplyScalar(2.5), toneMapped: false, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false });
    this.halo = new THREE.Mesh(new THREE.RingGeometry(9, 11, 40), this.haloMat);
    this.halo.rotation.x = -Math.PI / 2; this.halo.position.copy(this.top).add(new THREE.Vector3(0, 2, 0));
    this.group.add(this.halo);
  }
  setState(s: 'idle' | 'sel' | 'done') {
    this.haloMat.color.set(s === 'done' ? 0x4dff7a : s === 'sel' ? 0xffffff : 0x7ff3ff).multiplyScalar(s === 'sel' ? 5 : 2.5);
  }
  update(t: number) { this.halo.rotation.z = t * 0.6; }
}

/** Lit low-level corridor: paired chevrons along the valley floor. */
export class Corridor {
  group = new THREE.Group();
  readonly entry: Gate;
  readonly exit: Gate;
  readonly points: THREE.Vector3[] = [];
  constructor() {
    const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0x4dff7a).multiplyScalar(3), toneMapped: false });
    const matW = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffffff).multiplyScalar(2.5), toneMapped: false });
    const geo = new THREE.ConeGeometry(2.2, 6, 4);
    const n = Math.round(Math.abs(CORRIDOR_X1 - CORRIDOR_X0) / 150);
    for (let i = 0; i <= n; i++) {
      const x = CORRIDOR_X0 + (CORRIDOR_X1 - CORRIDOR_X0) * (i / n);
      const wobble = Math.sin(i * 0.55) * 90;
      const z = CORRIDOR_Z + wobble;
      const gy = terrainHeight(x, z);
      this.points.push(new THREE.Vector3(x, gy, z));
      for (const s of [-1, 1]) {
        const c = new THREE.Mesh(geo, i % 4 === 0 ? matW : mat);
        c.position.set(x, terrainHeight(x, z + s * 70) + 3, z + s * 70);
        c.rotation.z = s * 0.6; c.rotation.y = Math.PI / 2;
        this.group.add(c);
      }
    }
    const p0 = this.points[0], p1 = this.points[this.points.length - 1];
    this.entry = new Gate(new THREE.Vector3(p0.x + 150, p0.y + 55, p0.z), 270, 140, 90, 0x4dff7a);
    this.exit = new Gate(new THREE.Vector3(p1.x - 150, p1.y + 55, p1.z), 270, 140, 90, 0x4dff7a);
    this.group.add(this.entry.group, this.exit.group);
  }
}

/** Approach gate on final for runway 36 (3 km out, on a 3° glideslope). */
export function approachGate(): Gate {
  const dist = 3000;
  const alt = Math.tan(THREE.MathUtils.degToRad(3)) * dist + 15;
  return new Gate(new THREE.Vector3(0, alt, RUNWAY_Z0 + dist), 0, 110, 70, 0xffd36a);
}
