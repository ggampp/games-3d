import * as THREE from 'three';
import { terrainHeight } from '../world/terrain';
import { KT } from '../aircraft/flightModel';

export type DroneType = 'PATROL' | 'EVADER' | 'AGGRESSOR' | 'BOSS';
export const DRONE_INFO: Record<DroneType, { pts: number; hp: number; speedKt: number; turn: number; radius: number; color: number; scale: number }> = {
  PATROL: { pts: 250, hp: 3, speedKt: 210, turn: 0.45, radius: 7, color: 0xffd36a, scale: 1 },
  EVADER: { pts: 350, hp: 3, speedKt: 290, turn: 0.9, radius: 6.5, color: 0x7ff3ff, scale: 0.9 },
  AGGRESSOR: { pts: 400, hp: 3, speedKt: 340, turn: 0.8, radius: 6.5, color: 0xff7a5a, scale: 1 },
  BOSS: { pts: 1500, hp: 12, speedKt: 300, turn: 0.55, radius: 13, color: 0xff4dd2, scale: 2.4 },
};

/** Something a drone can chase or shoot at (the player, or the pace jet in ESCORT). */
export interface DroneTarget { pos: THREE.Vector3; vel: THREE.Vector3; fwd: THREE.Vector3 }

const haloGeo = new THREE.SphereGeometry(4.5, 12, 8);
const hullMat = new THREE.MeshStandardMaterial({ color: 0x2a3038, roughness: 0.55, metalness: 0.55, flatShading: true });
const darkMat = new THREE.MeshStandardMaterial({ color: 0x15181c, roughness: 0.8, metalness: 0.4, flatShading: true });
const lampGeo = new THREE.SphereGeometry(0.22, 6, 5);

function tri(points: Array<[number, number]>, thickness: number): THREE.BufferGeometry {
  const shape = new THREE.Shape(); shape.moveTo(points[0][0], points[0][1]); for (let i = 1; i < points.length; i++) shape.lineTo(points[i][0], points[i][1]); shape.closePath();
  const g = new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: false }); g.translate(0, 0, -thickness / 2); return g;
}

/**
 * Distinct procedural silhouettes per drone type. All models have their nose at +Z; the group is
 * oriented along the velocity every frame. Returns the spinning parts (rotors) and the BOSS turrets.
 */
function buildBody(type: DroneType, accent: THREE.Material): { root: THREE.Group; spinners: THREE.Object3D[]; turrets: THREE.Group[] } {
  const root = new THREE.Group(); const spinners: THREE.Object3D[] = []; const turrets: THREE.Group[] = [];
  const add = (geo: THREE.BufferGeometry, mat: THREE.Material, x = 0, y = 0, z = 0, parent: THREE.Object3D = root) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); parent.add(m); return m; };
  switch (type) {
    case 'PATROL': {
      // quad-rotor scout: hexagonal body, four arms with ring rotors, sensor ball underneath
      add(new THREE.CylinderGeometry(1.5, 1.3, 0.8, 6), hullMat);
      add(new THREE.CylinderGeometry(0.5, 0.5, 0.25, 6), accent, 0, 0.5, 0);
      add(new THREE.SphereGeometry(0.55, 8, 6), darkMat, 0, -0.65, 0.4);
      for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]] as Array<[number, number]>) {
        const arm = add(new THREE.BoxGeometry(3.2, 0.22, 0.34), hullMat, sx * 1.35, 0, sz * 1.35); arm.rotation.y = -sx * sz * Math.PI / 4;
        const ring = add(new THREE.TorusGeometry(1.05, 0.1, 5, 14), darkMat, sx * 2.5, 0.05, sz * 2.5); ring.rotation.x = Math.PI / 2;
        const prop = add(new THREE.BoxGeometry(1.9, 0.04, 0.22), accent, sx * 2.5, 0.12, sz * 2.5); spinners.push(prop);
        add(lampGeo, accent, sx * 2.5, -0.2, sz * 2.5);
      }
      break;
    }
    case 'EVADER': {
      // dart: long thin body, three swept fins, canards
      const body = add(new THREE.CylinderGeometry(0.22, 0.85, 5.6, 6), hullMat); body.rotation.x = Math.PI / 2;
      const nose = add(new THREE.ConeGeometry(0.22, 1.3, 6), accent, 0, 0, 3.45); nose.rotation.x = Math.PI / 2;
      const tail = add(new THREE.CylinderGeometry(0.85, 0.5, 0.7, 6), darkMat, 0, 0, -3.1); tail.rotation.x = Math.PI / 2;
      for (let i = 0; i < 3; i++) {
        const a = i * Math.PI * 2 / 3 + Math.PI / 2;
        const fin = add(tri([[0.6, -3.2], [2.6, -3.4], [2.9, -2.6], [0.75, -0.8]], 0.08), hullMat); fin.rotation.z = a;
        add(lampGeo, accent, Math.cos(a) * 2.8, Math.sin(a) * 2.8, -3.0);
      }
      for (const sx of [-1, 1]) { const c = add(tri([[0.5, 1.4], [1.5, 1.2], [1.6, 1.6], [0.55, 2.1]], 0.06), hullMat); c.scale.x = sx; }
      add(new THREE.BoxGeometry(0.08, 0.3, 1.6), accent, 0, 0.6, 0.6);
      break;
    }
    case 'AGGRESSOR': {
      // flying-wing chevron with twin gun pods and small fins
      const wing = add(tri([[0, 3.2], [4.2, -1.4], [3.4, -2.2], [0, -0.7], [-3.4, -2.2], [-4.2, -1.4]], 0.5), hullMat); wing.rotation.x = Math.PI / 2;
      const hump = add(new THREE.SphereGeometry(0.9, 8, 6), darkMat, 0, 0.35, 0.4); hump.scale.set(0.9, 0.55, 1.6);
      add(new THREE.BoxGeometry(0.5, 0.12, 1.2), accent, 0, 0.62, 1.2);
      for (const sx of [-1, 1]) {
        const pod = add(new THREE.CylinderGeometry(0.28, 0.32, 2.4, 8), darkMat, sx * 2.2, -0.2, 0.2); pod.rotation.x = Math.PI / 2;
        add(new THREE.CylinderGeometry(0.1, 0.1, 0.8, 6), accent, sx * 2.2, -0.2, 1.7).rotation.x = Math.PI / 2;
        add(lampGeo, accent, sx * 2.2, -0.2, 2.15);
        const fin = add(tri([[0, -1.2], [1.0, -2.2], [0, -2.2]], 0.06), hullMat, sx * 3.0, 0.25, 0); fin.rotation.y = Math.PI / 2; fin.rotation.z = sx * 0.5;
      }
      add(new THREE.BoxGeometry(1.0, 0.25, 0.4), accent, 0, 0.05, -1.9);
      break;
    }
    default: {
      // BOSS: octagonal hull with keel, stub wings with engine pods, two tracking turrets, antennas
      const hull = add(new THREE.CylinderGeometry(2.1, 2.5, 7.5, 8), hullMat); hull.rotation.x = Math.PI / 2;
      const nose = add(new THREE.CylinderGeometry(0.9, 2.1, 2.6, 8), darkMat, 0, 0, 5.0); nose.rotation.x = Math.PI / 2;
      add(new THREE.BoxGeometry(1.4, 1.2, 5.5), darkMat, 0, -2.4, -0.5);
      add(new THREE.BoxGeometry(0.5, 0.6, 3.5), accent, 0, -3.1, -0.5);
      for (const sx of [-1, 1]) {
        const wingG = add(tri([[0, 2.0], [4.6, 0.2], [4.6, -1.8], [0, -2.6]], 0.35), hullMat, sx * 2.0, -0.4, -1.0); wingG.rotation.x = Math.PI / 2; wingG.scale.x = sx;
        const pod = add(new THREE.CylinderGeometry(0.55, 0.7, 3.2, 8), darkMat, sx * 5.6, -0.4, -2.0); pod.rotation.x = Math.PI / 2;
        add(new THREE.CylinderGeometry(0.45, 0.45, 0.3, 8), accent, sx * 5.6, -0.4, -3.7).rotation.x = Math.PI / 2;
        add(lampGeo, accent, sx * 6.4, -0.3, -1.0);
        const ant = add(new THREE.CylinderGeometry(0.05, 0.05, 2.2, 4), darkMat, sx * 1.2, 3.1, -2.6); ant.rotation.z = sx * 0.2;
        add(lampGeo, accent, sx * 1.2 + sx * 0.22, 4.15, -2.6);
        // turrets on the upper hull, front and rear
        const t = new THREE.Group(); t.position.set(sx * 0.9, 2.05, sx > 0 ? 1.6 : -1.4); root.add(t); turrets.push(t);
        add(new THREE.CylinderGeometry(0.85, 0.95, 0.5, 8), darkMat, 0, 0, 0, t);
        add(new THREE.SphereGeometry(0.7, 8, 6), hullMat, 0, 0.45, 0, t);
        for (const bx of [-0.25, 0.25]) { const b = add(new THREE.CylinderGeometry(0.09, 0.11, 2.4, 6), darkMat, bx, 0.5, 1.3, t); b.rotation.x = Math.PI / 2; add(lampGeo, accent, bx, 0.5, 2.55, t); }
      }
      for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; add(lampGeo, accent, Math.cos(a) * 2.35, Math.sin(a) * 2.35, 2.4); }
      add(new THREE.TorusGeometry(2.4, 0.12, 5, 8), accent, 0, 0, -2.5);
    }
  }
  root.traverse((o) => { if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).castShadow = true; });
  return { root, spinners, turrets };
}

export class Drone {
  readonly type: DroneType;
  readonly patrolCenter: THREE.Vector3;
  group = new THREE.Group();
  pos = new THREE.Vector3(); vel = new THREE.Vector3();
  hp: number; alive = true; dying = 0;
  private accentMat: THREE.MeshBasicMaterial; private haloMat: THREE.MeshBasicMaterial;
  private body: THREE.Group; private spinners: THREE.Object3D[]; private turrets: THREE.Group[];
  private wp = 0; private jinkT = 0; private jink = new THREE.Vector3(); private t = Math.random() * 10;
  private flare: THREE.Sprite;
  private bank = 0; private lastDir = new THREE.Vector3();
  hitFlash = 0; rammedCooldown = 0;
  /** Set by the AI when it wants to shoot; consumed by the game loop, which spawns the projectile. */
  fireRequest = false; private fireCd = 2 + Math.random() * 2; private burst = 0;
  /** Optional override: AGGRESSORs chase and shoot this instead of the player (ESCORT sortie). */
  attackTarget: DroneTarget | null = null;
  readonly info; readonly speed;
  constructor(type: DroneType, pos: THREE.Vector3, heading: number, patrolCenter: THREE.Vector3) {
    this.type = type; this.patrolCenter = patrolCenter;
    this.info = DRONE_INFO[type]; this.hp = this.info.hp; this.speed = this.info.speedKt / KT;
    this.pos.copy(pos);
    this.vel.set(Math.sin(heading), 0, -Math.cos(heading)).multiplyScalar(this.speed);
    const c = new THREE.Color(this.info.color);
    this.accentMat = new THREE.MeshBasicMaterial({ color: c.clone().multiplyScalar(4), toneMapped: false });
    const built = buildBody(type, this.accentMat); this.body = built.root; this.spinners = built.spinners; this.turrets = built.turrets; this.group.add(this.body);
    this.haloMat = new THREE.MeshBasicMaterial({ color: c.clone().multiplyScalar(1.5), transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, side: THREE.BackSide });
    this.group.add(new THREE.Mesh(haloGeo, this.haloMat));
    // engine spark (sprite-like point, always visible against the hills)
    const spr = new THREE.SpriteMaterial({ color: c.clone().multiplyScalar(3), transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, sizeAttenuation: true });
    this.flare = new THREE.Sprite(spr); this.flare.scale.setScalar(14); this.flare.position.z = -2.5; this.group.add(this.flare);
    this.group.scale.setScalar(this.info.scale);
    this.group.position.copy(this.pos);
    this.lastDir.copy(this.vel).normalize();
  }

  get radius() { return this.info.radius; }

  /** Apply damage; returns true when this hit destroyed the drone. */
  hit(dmg = 1): boolean {
    this.hp -= dmg; this.hitFlash = 0.15;
    if (this.hp <= 0) { this.alive = false; this.dying = 0.5; return true; }
    return false;
  }

  private steerTo(target: THREE.Vector3, dt: number, turnScale = 1) {
    const desired = target.clone().sub(this.pos).normalize();
    const cur = this.vel.clone().normalize();
    const maxAng = this.info.turn * turnScale * dt;
    const ang = cur.angleTo(desired);
    if (ang > 1e-4) {
      const axis = cur.clone().cross(desired).normalize();
      cur.applyAxisAngle(axis, Math.min(ang, maxAng));
    }
    this.vel.copy(cur).multiplyScalar(this.speed);
  }

  update(dt: number, player: DroneTarget) {
    this.t += dt;
    if (!this.alive) {
      this.dying -= dt; this.group.scale.setScalar(this.info.scale * Math.max(0.01, this.dying * 2 + 0.2)); this.pos.y -= 30 * dt; this.group.position.copy(this.pos); this.group.rotation.z += dt * 6; return;
    }
    if (this.hitFlash > 0) this.hitFlash -= dt;
    if (this.rammedCooldown > 0) this.rammedCooldown -= dt;
    if (this.fireCd > 0) this.fireCd -= dt;
    const tgt = this.attackTarget ?? player;
    const toTgt = tgt.pos.clone().sub(this.pos); const dist = toTgt.length();
    let target: THREE.Vector3; let turnScale = 1;
    const pc = this.patrolCenter;
    const racetrack = (r: number, alt: number) => {
      const corners = [new THREE.Vector3(pc.x + r, alt, pc.z + r * 0.5), new THREE.Vector3(pc.x + r, alt, pc.z - r * 0.5), new THREE.Vector3(pc.x - r, alt, pc.z - r * 0.5), new THREE.Vector3(pc.x - r, alt, pc.z + r * 0.5)];
      const c = corners[this.wp % 4];
      if (c.clone().sub(this.pos).setY(0).length() < 250) this.wp++;
      return c;
    };
    switch (this.type) {
      case 'PATROL': target = racetrack(1500, pc.y); break;
      case 'EVADER': {
        this.jinkT -= dt;
        if (this.jinkT <= 0) { this.jinkT = 0.9 + Math.random() * 1.4; this.jink.set((Math.random() - 0.5) * 2, (Math.random() - 0.6) * 1.2, (Math.random() - 0.5) * 2).normalize(); }
        if (dist < 2200) {
          // run away from the player's nose, jinking and diving
          const away = this.pos.clone().sub(player.pos).normalize();
          target = this.pos.clone().addScaledVector(away, 600).addScaledVector(this.jink, 350);
          turnScale = 1.3;
        } else target = racetrack(2000, pc.y);
        break;
      }
      case 'AGGRESSOR': {
        // cut across the target's nose: aim ~700 m ahead of it
        const lead = tgt.pos.clone().addScaledVector(tgt.fwd, 700).addScaledVector(tgt.vel, 1.2);
        target = dist > 500 ? lead : this.pos.clone().addScaledVector(this.vel, 1).add(new THREE.Vector3(0, 60, 0));
        if (dist < 900 && this.rammedCooldown <= 0) turnScale = 1.4;
        // slow, dodgeable shots in bursts of two when the target sits inside the nose cone
        const noseAng = this.vel.clone().normalize().angleTo(toTgt.clone().normalize());
        if (dist < 1500 && dist > 120 && noseAng < THREE.MathUtils.degToRad(11) && this.fireCd <= 0) {
          if (this.burst > 0) { this.burst--; this.fireCd = 0.28; this.fireRequest = true; if (this.burst === 0) this.fireCd = 2.2; }
          else this.burst = 2;
        }
        break;
      }
      default: { // BOSS: racetrack but periodically turns in on the player; turrets fire from any angle
        const phase = Math.floor(this.t / 9) % 2;
        target = phase === 0 ? racetrack(2200, pc.y + 150) : player.pos.clone().addScaledVector(player.fwd, 300);
        if (dist < 1900 && dist > 150 && this.fireCd <= 0) { this.fireCd = 2.6; this.fireRequest = true; }
      }
    }
    // terrain avoidance
    const gy = terrainHeight(this.pos.x, this.pos.z);
    const ahead = this.pos.clone().addScaledVector(this.vel, 2.5);
    const gyA = terrainHeight(ahead.x, ahead.z);
    const minAgl = 120;
    if (this.pos.y - gy < minAgl || ahead.y - gyA < minAgl) { target = this.pos.clone().addScaledVector(this.vel.clone().setY(0).normalize(), 300).add(new THREE.Vector3(0, 250, 0)); turnScale = 2; }
    if (this.pos.y > 2600) target.y = Math.min(target.y, 1800);
    this.steerTo(target, dt, turnScale);
    this.pos.addScaledVector(this.vel, dt);
    this.group.position.copy(this.pos);
    // orientation: nose (+Z of the model) along the velocity, banking into turns
    const dir = this.vel.clone().normalize();
    const turn = this.lastDir.clone().cross(dir).y / Math.max(dt, 1e-3);
    this.lastDir.copy(dir);
    this.bank += (THREE.MathUtils.clamp(-turn * 1.6, -1.1, 1.1) - this.bank) * Math.min(1, dt * 4);
    this.group.lookAt(this.pos.clone().add(dir));
    this.body.rotation.set(0, 0, this.bank);
    // visuals
    for (const s of this.spinners) s.rotation.y += dt * 40;
    if (this.turrets.length) {
      this.group.updateMatrixWorld();
      const local = this.body.worldToLocal(player.pos.clone());
      const yaw = Math.atan2(local.x, local.z);
      for (const t of this.turrets) t.rotation.y += (yaw - t.rotation.y) * Math.min(1, dt * 3);
    }
    const pulse = 0.85 + 0.15 * Math.sin(this.t * 6);
    const flash = this.hitFlash > 0 ? 3 : 1;
    this.accentMat.color.set(this.hitFlash > 0 ? 0xffffff : this.info.color).multiplyScalar(4 * pulse * flash);
    this.haloMat.opacity = 0.12 + 0.06 * Math.sin(this.t * 4) + (this.hitFlash > 0 ? 0.3 : 0);
    this.flare.scale.setScalar(12 + 3 * Math.sin(this.t * 11));
  }
}
