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

const coreGeo = new THREE.OctahedronGeometry(1.6, 0);
const shellGeo = new THREE.IcosahedronGeometry(2.4, 1);
const haloGeo = new THREE.SphereGeometry(4.5, 12, 8);

export class Drone {
  group = new THREE.Group();
  pos = new THREE.Vector3(); vel = new THREE.Vector3();
  hp: number; alive = true; dying = 0;
  private coreMat: THREE.MeshBasicMaterial; private haloMat: THREE.MeshBasicMaterial; private shell: THREE.Mesh;
  private core: THREE.Mesh;
  private wp = 0; private jinkT = 0; private jink = new THREE.Vector3(); private t = Math.random() * 10;
  private flare: THREE.Sprite;
  hitFlash = 0; rammedCooldown = 0;
  readonly info; readonly speed;
  constructor(public readonly type: DroneType, pos: THREE.Vector3, heading: number, public readonly patrolCenter: THREE.Vector3) {
    this.info = DRONE_INFO[type]; this.hp = this.info.hp; this.speed = this.info.speedKt / KT;
    this.pos.copy(pos);
    this.vel.set(Math.sin(heading), 0, -Math.cos(heading)).multiplyScalar(this.speed);
    const c = new THREE.Color(this.info.color);
    this.coreMat = new THREE.MeshBasicMaterial({ color: c.clone().multiplyScalar(8), toneMapped: false });
    this.core = new THREE.Mesh(coreGeo, this.coreMat); this.group.add(this.core);
    this.shell = new THREE.Mesh(shellGeo, new THREE.MeshStandardMaterial({ color: 0x20262c, roughness: 0.5, metalness: 0.6, wireframe: true })); this.group.add(this.shell);
    this.haloMat = new THREE.MeshBasicMaterial({ color: c.clone().multiplyScalar(1.5), transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, side: THREE.BackSide });
    this.group.add(new THREE.Mesh(haloGeo, this.haloMat));
    // engine spark (sprite-like point, always visible against the hills)
    const spr = new THREE.SpriteMaterial({ color: c.clone().multiplyScalar(3), transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, sizeAttenuation: true });
    this.flare = new THREE.Sprite(spr); this.flare.scale.setScalar(14); this.group.add(this.flare);
    this.group.scale.setScalar(this.info.scale);
    this.group.position.copy(this.pos);
  }

  get radius() { return this.info.radius; }

  hit(): boolean {
    this.hp--; this.hitFlash = 0.15;
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

  update(dt: number, player: { pos: THREE.Vector3; vel: THREE.Vector3; fwd: THREE.Vector3 }) {
    this.t += dt;
    if (!this.alive) {
      this.dying -= dt; this.group.scale.setScalar(this.info.scale * Math.max(0.01, this.dying * 2 + 0.2)); this.pos.y -= 30 * dt; this.group.position.copy(this.pos); return;
    }
    if (this.hitFlash > 0) this.hitFlash -= dt;
    if (this.rammedCooldown > 0) this.rammedCooldown -= dt;
    const toPlayer = player.pos.clone().sub(this.pos); const dist = toPlayer.length();
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
        // cut across the player's nose: aim ~700 m ahead of the jet
        const lead = player.pos.clone().addScaledVector(player.fwd, 700).addScaledVector(player.vel, 1.2);
        target = dist > 500 ? lead : this.pos.clone().addScaledVector(this.vel, 1).add(new THREE.Vector3(0, 60, 0));
        if (dist < 900 && this.rammedCooldown <= 0) turnScale = 1.4;
        break;
      }
      default: { // BOSS: racetrack but periodically turns in on the player
        const phase = Math.floor(this.t / 9) % 2;
        target = phase === 0 ? racetrack(2200, pc.y + 150) : player.pos.clone().addScaledVector(player.fwd, 300);
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
    // visuals
    this.core.rotation.x += dt * 2.5; this.core.rotation.y += dt * 1.7; this.shell.rotation.y -= dt * 0.8;
    const pulse = 0.85 + 0.15 * Math.sin(this.t * 6);
    const flash = this.hitFlash > 0 ? 3 : 1;
    this.coreMat.color.set(this.hitFlash > 0 ? 0xffffff : this.info.color).multiplyScalar(8 * pulse * flash);
    this.haloMat.opacity = 0.12 + 0.06 * Math.sin(this.t * 4) + (this.hitFlash > 0 ? 0.3 : 0);
    this.flare.scale.setScalar(12 + 3 * Math.sin(this.t * 11));
  }
}
