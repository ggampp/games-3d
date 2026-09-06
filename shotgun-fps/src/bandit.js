import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { rayHitsLocalBox, rayHitsLocalSphere } from './collision.js';
import { audio } from './audioEngine.js';

// Bandido low-poly procedural: corpo em caixas com cores por vértice (1 mesh),
// braço direito articulado com revólver (1 mesh) e chapéu solto (1 mesh).
// Máquina de estados: rising -> (walking) -> aiming -> shooting -> cooldown -> aiming...
// Ao morrer: tomba (ragdoll simplificado), o chapéu voa, afunda e é removido.

const PALETTES = [
  { shirt: 0xa63a2e, pants: 0x3b4a6b, vest: 0x2b1d14, bandana: 0xd9c25a, hat: 0x2a1e16 },
  { shirt: 0x5b7a9e, pants: 0x4a3626, vest: 0x1f1a17, bandana: 0xb03030, hat: 0x3d2a1c },
  { shirt: 0xc7a35a, pants: 0x2e2e38, vest: 0x4a2a1a, bandana: 0x2d6b4a, hat: 0x171311 },
  { shirt: 0x7a8a5a, pants: 0x5a3a2a, vest: 0x2a2020, bandana: 0xe0e0e0, hat: 0x4b3a2a },
];
const SKIN = 0xd29d77;
const BOOT = 0x2a1a10;
const GUN = 0x3a3a40;
const WOODGRIP = 0x6b3e22;
const BOSS = { shirt: 0x1b1b1f, pants: 0x25252b, vest: 0x0f0f12, bandana: 0x8a0f0f, hat: 0x0a0a0a };

const _col = new THREE.Color();
function colored(geo, hex) {
  const n = geo.attributes.position.count;
  const arr = new Float32Array(n * 3);
  _col.setHex(hex);
  for (let i = 0; i < n; i++) {
    arr[i * 3] = _col.r; arr[i * 3 + 1] = _col.g; arr[i * 3 + 2] = _col.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return geo;
}
function part(geo, hex, x, y, z, rx = 0, ry = 0, rz = 0) {
  if (rx || ry || rz) geo.rotateX(rx), geo.rotateY(ry), geo.rotateZ(rz);
  geo.translate(x, y, z);
  return colored(geo, hex);
}

const bodyMat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.85, metalness: 0.05 });

// Hitboxes locais (bandido de escala 1)
const BODY_BOX = new THREE.Box3(new THREE.Vector3(-0.32, 0.0, -0.22), new THREE.Vector3(0.32, 1.52, 0.22));
const HEAD_CENTER = new THREE.Vector3(0, 1.66, 0);
const HEAD_RADIUS = 0.2;

export function createBanditModel(boss = false) {
  const pal = boss ? BOSS : PALETTES[Math.floor(Math.random() * PALETTES.length)];
  const parts = [];
  // botas e pernas
  for (const sx of [-1, 1]) {
    parts.push(part(new THREE.BoxGeometry(0.22, 0.16, 0.32), BOOT, sx * 0.14, 0.08, 0.03));
    parts.push(part(new THREE.BoxGeometry(0.2, 0.72, 0.22), pal.pants, sx * 0.14, 0.52, 0));
  }
  // cinto e fivela
  parts.push(part(new THREE.BoxGeometry(0.54, 0.1, 0.34), 0x3a2416, 0, 0.9, 0));
  parts.push(part(new THREE.BoxGeometry(0.1, 0.08, 0.04), 0xd9a441, 0, 0.9, 0.18));
  // torso e colete
  parts.push(part(new THREE.BoxGeometry(0.52, 0.62, 0.3), pal.shirt, 0, 1.24, 0));
  parts.push(part(new THREE.BoxGeometry(0.18, 0.55, 0.05), pal.vest, -0.15, 1.24, 0.17));
  parts.push(part(new THREE.BoxGeometry(0.18, 0.55, 0.05), pal.vest, 0.15, 1.24, 0.17));
  parts.push(part(new THREE.BoxGeometry(0.52, 0.55, 0.05), pal.vest, 0, 1.24, -0.17));
  // braço esquerdo (parado)
  parts.push(part(new THREE.BoxGeometry(0.14, 0.52, 0.14), pal.shirt, -0.34, 1.22, 0));
  parts.push(part(new THREE.BoxGeometry(0.12, 0.12, 0.12), SKIN, -0.34, 0.9, 0));
  // pescoço, cabeça, lenço
  parts.push(part(new THREE.BoxGeometry(0.12, 0.1, 0.12), SKIN, 0, 1.57, 0));
  parts.push(part(new THREE.BoxGeometry(0.26, 0.28, 0.26), SKIN, 0, 1.7, 0));
  parts.push(part(new THREE.BoxGeometry(0.3, 0.14, 0.3), pal.bandana, 0, 1.62, 0.02));
  parts.push(part(new THREE.BoxGeometry(0.16, 0.22, 0.06), pal.bandana, 0.1, 1.5, -0.14));
  // olhos (faixa escura)
  parts.push(part(new THREE.BoxGeometry(0.2, 0.05, 0.02), 0x2a1a10, 0, 1.74, 0.135));
  if (boss) {
    // casaco longo
    parts.push(part(new THREE.BoxGeometry(0.6, 0.5, 0.36), 0x1b1b1f, 0, 0.7, -0.02));
  }
  const bodyGeo = mergeGeometries(parts, false);
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.castShadow = true;

  // chapéu (aba + copa)
  const hatGeo = mergeGeometries([
    part(new THREE.CylinderGeometry(0.38, 0.4, 0.05, 9), pal.hat, 0, 1.86, 0),
    part(new THREE.CylinderGeometry(0.19, 0.22, 0.22, 8), pal.hat, 0, 1.98, 0),
    part(new THREE.BoxGeometry(0.46, 0.05, 0.46), 0x8a6a3a, 0, 1.9, 0),
  ], false);
  const hat = new THREE.Mesh(hatGeo, bodyMat);
  hat.castShadow = true;

  // braço direito articulado: pivô no ombro, aponta para -Y em repouso
  const arm = new THREE.Group();
  arm.position.set(0.34, 1.48, 0);
  const armParts = [
    part(new THREE.BoxGeometry(0.14, 0.52, 0.14), pal.shirt, 0, -0.26, 0),
    part(new THREE.BoxGeometry(0.12, 0.14, 0.12), SKIN, 0, -0.58, 0),
  ];
  if (boss) {
    // escopeta serrada
    armParts.push(part(new THREE.BoxGeometry(0.07, 0.2, 0.09), WOODGRIP, 0, -0.68, 0.02));
    armParts.push(part(new THREE.CylinderGeometry(0.03, 0.03, 0.5, 6), GUN, -0.02, -0.98, 0.02));
    armParts.push(part(new THREE.CylinderGeometry(0.03, 0.03, 0.5, 6), GUN, 0.04, -0.98, 0.02));
  } else {
    // revólver: cabo, tambor, cano
    armParts.push(part(new THREE.BoxGeometry(0.05, 0.12, 0.08), WOODGRIP, 0, -0.64, 0.03));
    armParts.push(part(new THREE.CylinderGeometry(0.035, 0.035, 0.08, 6), GUN, 0, -0.7, 0.03, Math.PI / 2));
    armParts.push(part(new THREE.CylinderGeometry(0.018, 0.018, 0.26, 6), GUN, 0, -0.85, 0.03));
  }
  const armMesh = new THREE.Mesh(mergeGeometries(armParts, false), bodyMat);
  armMesh.castShadow = true;
  arm.add(armMesh);

  // flash do cano
  const flash = new THREE.Mesh(
    new THREE.ConeGeometry(0.09, 0.3, 5),
    new THREE.MeshBasicMaterial({ color: 0xffd36b, transparent: true, opacity: 0.95 })
  );
  flash.position.set(0, -1.1, 0.03);
  flash.rotation.x = Math.PI;
  flash.visible = false;
  arm.add(flash);
  const muzzle = new THREE.Object3D();
  muzzle.position.set(0, -1.0, 0.03);
  arm.add(muzzle);

  const root = new THREE.Group();
  const pivot = new THREE.Group(); // tomba a partir dos pés
  pivot.add(body, hat, arm);
  root.add(pivot);
  if (boss) root.scale.setScalar(1.3);
  return { root, pivot, body, hat, arm, flash, muzzle };
}

let banditIdCounter = 0;

export class Bandit {
  constructor({ spawn, config, scene, boss = false }) {
    this.id = ++banditIdCounter;
    this.boss = boss;
    this.config = config;
    this.scene = scene;
    this.spawn = spawn;
    this.type = spawn.type;
    const model = createBanditModel(boss);
    Object.assign(this, model);
    this.scale = boss ? 1.3 : 1;

    this.hp = boss ? config.bossHp : config.hp;
    this.maxHp = this.hp;
    this.state = 'rising';
    this.t = 0;
    this.baseY = spawn.pos.y;
    this.root.position.copy(spawn.pos);
    this.root.position.y = this.baseY - 2.0 * this.scale;
    this.armTarget = 0;
    this.armAngle = 0;
    this.fallDir = 1;
    this.fallAngle = 0;
    this.hatVel = null;
    this.dead = false;
    this.removed = false;
    this.walkPhase = Math.random() * 10;
    this.flinchT = 0;
    this.idleDelay = 0.25 + Math.random() * 0.5;
    scene.add(this.root);
  }

  get alive() { return !this.dead; }
  get position() { return this.root.position; }

  // Testa um raio de mundo contra as hitboxes. Retorna { part, dist } ou null.
  hitTest(ray) {
    if (this.dead) return null;
    this.pivot.updateWorldMatrix(true, false);
    const head = rayHitsLocalSphere(ray, this.pivot, HEAD_CENTER, HEAD_RADIUS);
    const body = rayHitsLocalBox(ray, this.pivot, BODY_BOX);
    if (head !== null && (body === null || head <= body + 0.05)) return { part: 'head', dist: head };
    if (body !== null) return { part: 'body', dist: body };
    return null;
  }

  // Retorna true se matou
  takeDamage(amount, isHead) {
    if (this.dead) return false;
    this.hp -= amount;
    if (this.hp <= 0) {
      this.die(isHead);
      return true;
    }
    // Flinch: interrompe a mira
    this.flinchT = 0.35;
    if (this.state === 'aiming') {
      this.state = 'cooldown';
      this.t = 0;
      this.cooldownTime = 0.5;
    }
    return false;
  }

  die(isHead) {
    this.dead = true;
    this.state = 'dying';
    this.t = 0;
    this.fallDir = Math.random() > 0.5 ? 1 : -1;
    this.flash.visible = false;
    if (isHead || Math.random() > 0.5) {
      // chapéu voa
      this.hatVel = new THREE.Vector3((Math.random() - 0.5) * 2, 3.5 + Math.random() * 2, (Math.random() - 0.5) * 2);
      this.hatSpin = (Math.random() - 0.5) * 12;
    }
  }

  // ctx: { playerPos, playerMoving, damagePlayer(dmg), tracer(from, to, hit), collision }
  update(dt, ctx) {
    const cfg = this.config;
    this.t += dt;
    const p = this.root.position;

    // Orientação: sempre encara o jogador (só em Y) enquanto vivo
    if (!this.dead) {
      const dx = ctx.playerPos.x - p.x;
      const dz = ctx.playerPos.z - p.z;
      const targetYaw = Math.atan2(dx, dz);
      let diff = targetYaw - this.root.rotation.y;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      this.root.rotation.y += diff * Math.min(1, dt * 8);
    }

    // Animação do braço (0 = abaixado, 1 = apontando)
    this.armAngle += (this.armTarget - this.armAngle) * Math.min(1, dt * 9);
    // inclinação vertical para mirar a altura do jogador
    let pitch = 0;
    if (!this.dead) {
      const dy = ctx.playerPos.y - 0.2 - (p.y + 1.45 * this.scale);
      const dh = Math.hypot(ctx.playerPos.x - p.x, ctx.playerPos.z - p.z);
      pitch = Math.atan2(dy, dh);
    }
    this.arm.rotation.x = -Math.PI / 2 * this.armAngle - pitch * this.armAngle;

    // Flinch (leve recuo do corpo)
    if (this.flinchT > 0) {
      this.flinchT -= dt;
      this.pivot.rotation.x = -0.25 * (this.flinchT / 0.35);
      this.pivot.position.z = -0.1 * (this.flinchT / 0.35);
    } else if (!this.dead) {
      this.pivot.rotation.x = 0;
      this.pivot.position.z = 0;
    }

    switch (this.state) {
      case 'rising': {
        const k = Math.min(1, this.t / 0.5);
        const e = 1 - Math.pow(1 - k, 3);
        p.y = this.baseY - 2.0 * this.scale * (1 - e);
        if (k >= 1) {
          this.state = this.type === 'street' ? 'walking' : 'idle';
          this.t = 0;
        }
        break;
      }
      case 'idle': {
        if (this.t >= this.idleDelay) this.startAim();
        break;
      }
      case 'walking': {
        const dx = ctx.playerPos.x - p.x;
        const dz = ctx.playerPos.z - p.z;
        const dist = Math.hypot(dx, dz);
        const stopDist = this.boss ? 7 : 10;
        if (dist > stopDist) {
          const speed = cfg.walkSpeed * (this.boss ? 0.75 : 1);
          p.x += (dx / dist) * speed * dt;
          p.z += (dz / dist) * speed * dt;
          if (ctx.collision) ctx.collision.resolveCircle(p, 0.4, p.y);
          this.walkPhase += dt * 9;
          // balanço de caminhada
          this.pivot.position.y = Math.abs(Math.sin(this.walkPhase)) * 0.06;
          this.pivot.rotation.z = Math.sin(this.walkPhase) * 0.05;
          if (this.t > 2.2 + Math.random()) this.startAim();
        } else {
          this.pivot.position.y = 0;
          this.pivot.rotation.z = 0;
          this.startAim();
        }
        break;
      }
      case 'aiming': {
        if (this.t >= cfg.aimTime) this.fire(ctx);
        break;
      }
      case 'cooldown': {
        this.armTarget = 0.35;
        if (this.t >= this.cooldownTime) {
          const dist = Math.hypot(ctx.playerPos.x - p.x, ctx.playerPos.z - p.z);
          if (this.type === 'street' && dist > (this.boss ? 7 : 10)) {
            this.state = 'walking';
            this.t = 0;
            this.armTarget = 0;
          } else {
            this.startAim();
          }
        }
        break;
      }
      case 'dying': {
        // tomba a partir dos pés em ~0,45 s com leve quique
        const k = Math.min(1, this.t / 0.45);
        const e = k < 1 ? 1 - Math.pow(1 - k, 2) : 1;
        const bounce = this.t > 0.45 && this.t < 0.7 ? Math.sin((this.t - 0.45) / 0.25 * Math.PI) * 0.08 : 0;
        this.pivot.rotation.x = this.fallDir * (Math.PI / 2 * e - bounce);
        this.pivot.rotation.z = 0;
        this.pivot.position.y = 0;
        this.arm.rotation.x = -0.4 * e;
        // chapéu voando
        if (this.hatVel) {
          this.hatVel.y -= 9.8 * dt;
          this.hat.position.addScaledVector(this.hatVel, dt);
          this.hat.rotation.z += this.hatSpin * dt;
        }
        // afunda e some
        if (this.t > 1.6) {
          p.y -= dt * 1.2;
        }
        if (this.t > 3.2) this.remove();
        break;
      }
    }
  }

  startAim() {
    this.state = 'aiming';
    this.t = 0;
    this.armTarget = 1;
    audio.playHammerCock(this.distanceVolume());
  }

  distanceVolume() {
    return 1;
  }

  fire(ctx) {
    const cfg = this.config;
    this.state = 'cooldown';
    this.t = 0;
    this.cooldownTime = cfg.cooldown * (0.8 + Math.random() * 0.4);

    // Flash e som
    this.flash.visible = true;
    this.flash.scale.setScalar(this.boss ? 1.8 : 1);
    setTimeout(() => { this.flash.visible = false; }, 60);

    const from = new THREE.Vector3();
    this.muzzle.getWorldPosition(from);
    const dist = from.distanceTo(ctx.playerPos);
    const distFactor = Math.max(0.35, 1 - dist / 70);
    const moveFactor = ctx.playerMoving ? 0.7 : 1;
    const hitChance = cfg.accuracy * distFactor * moveFactor;
    const hit = Math.random() < hitChance;

    const to = ctx.playerPos.clone();
    if (!hit) {
      to.x += (Math.random() - 0.5) * 2.5;
      to.y += (Math.random() - 0.2) * 1.5;
      to.z += (Math.random() - 0.5) * 2.5;
    }
    if (ctx.tracer) ctx.tracer(from, to, hit);
    if (this.boss) audio.playEnemyShotgun(dist);
    else audio.playRevolver(dist);
    if (hit) {
      const dmg = this.boss ? cfg.bossDamage : cfg.damage;
      ctx.damagePlayer(dmg, from);
    } else {
      audio.playWhizz(dist);
    }
  }

  remove() {
    if (this.removed) return;
    this.removed = true;
    this.scene.remove(this.root);
    this.body.geometry.dispose();
    this.hat.geometry.dispose();
    this.arm.children[0].geometry.dispose();
    this.flash.geometry.dispose();
    this.flash.material.dispose();
  }
}
