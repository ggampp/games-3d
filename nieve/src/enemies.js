// Cascarudos (besouros) + diretor de hordas
import * as THREE from 'three';
import { S, PLAZA, damage, emit } from './state.js';
import { blocked, lineOfSight, entrances, plazaEntrances, rng } from './world.js';
import * as audio from './audio.js';

const POOL = 24;
export const beetles = [];
export const beetleMeshes = []; // corpos para raycast (userData.beetle = índice)

const chitin = new THREE.MeshStandardMaterial({ color: '#1b1f22', roughness: 0.35, metalness: 0.45 });
const chitinDark = new THREE.MeshStandardMaterial({ color: '#0f1214', roughness: 0.5, metalness: 0.3 });
const eyeMat = new THREE.MeshBasicMaterial({ color: '#ff3b2a' });

function makeBeetle(i) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.55, 16, 12), chitin);
  body.scale.set(1, 0.62, 1.55); body.position.y = 0.42; body.castShadow = true; body.userData.beetle = i; g.add(body);
  const shellLine = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.36, 1.5), chitinDark); shellLine.position.set(0, 0.5, -0.05); g.add(shellLine);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 10), chitinDark);
  head.scale.set(1, 0.7, 0.9); head.position.set(0, 0.36, 0.85); head.userData.beetle = i; g.add(head);
  for (const s of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 8), eyeMat); eye.position.set(s * 0.17, 0.42, 1.08); g.add(eye);
    const mand = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.45, 6), chitinDark);
    mand.position.set(s * 0.16, 0.3, 1.2); mand.rotation.x = Math.PI / 2; mand.rotation.z = s * 0.35; g.add(mand);
    const horn = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.4, 6), chitin); horn.position.set(s * 0.12, 0.6, 0.95); horn.rotation.x = -0.5; g.add(horn);
  }
  const legs = [];
  const legGeo = new THREE.CylinderGeometry(0.035, 0.02, 0.75, 6);
  for (let k = 0; k < 3; k++) for (const s of [-1, 1]) {
    const pivot = new THREE.Group(); pivot.position.set(s * 0.42, 0.35, 0.45 - k * 0.45);
    const leg = new THREE.Mesh(legGeo, chitinDark); leg.position.set(s * 0.3, -0.15, 0); leg.rotation.z = s * 1.1; pivot.add(leg);
    const shin = new THREE.Mesh(legGeo, chitinDark); shin.scale.set(0.8, 0.8, 0.8); shin.position.set(s * 0.6, -0.42, 0); shin.rotation.z = s * -0.4; pivot.add(shin);
    g.add(pivot); legs.push({ pivot, side: s, k });
  }
  g.userData.legs = legs;
  g.visible = false;
  return g;
}

export function initEnemies(scene) {
  for (let i = 0; i < POOL; i++) {
    const mesh = makeBeetle(i); scene.add(mesh);
    mesh.traverse((o) => { if (o.userData.beetle !== undefined) beetleMeshes.push(o); });
    beetles.push({ id: i, x: 0, z: 0, yaw: 0, health: 0, state: 'inactive', active: false, alert: 0, attack: 0, hit: 0, deadTime: 0, footPhase: 0, stepT: 0, lastSeen: { x: 0, z: 0 }, moveDir: 0, mesh, wobble: 0 });
  }
}

export function resetEnemies() {
  for (const b of beetles) Object.assign(b, { health: 0, state: 'inactive', active: false, alert: 0, attack: 0, hit: 0, deadTime: 0, footPhase: 0 });
  director.reset();
}

function spawn(b, x, z, t, player) {
  Object.assign(b, {
    x, z, health: 96, state: 'chase', active: true, hit: 0, attack: 0, deadTime: 0, footPhase: 0, spawnAt: t,
    alert: Math.max(22, Math.hypot(x - player.x, z - player.z) / 2.6 + 18), lastSeen: { x: player.x, z: player.z }, yaw: Math.atan2(player.x - x, player.z - z),
  });
}

export function hitBeetle(i, amount, player) {
  const b = beetles[i];
  if (!b || !b.active || b.health <= 0) return false;
  b.health = Math.max(0, b.health - amount); b.alert = 20; b.hit = 1; b.lastSeen = { x: player.x, z: player.z };
  if (!b.health) { b.state = 'dead'; b.deadTime = 0; S.kills++; emit({ type: 'kill' }); }
  return true;
}

// ---------- Diretor de hordas ----------
class Director {
  constructor() { this.random = rng(41); this.reset(); }
  reset() { this.phase = 'quiet'; this.nextAt = 14; this.warned = -1; this.number = 0; this.remaining = 0; this.nextSpawn = 0; this.entrances = []; this.siegeAt = 0; this.nextCall = 0; }
  chooseEntrances(player) {
    const list = entrances.filter((e) => {
      const dx = e.x - player.x, dz = e.z - player.z, d = Math.hypot(dx, dz);
      return d > 23 && d < 115 && !blocked(e.x, e.z, 1.4);
    }).sort((a, b) => Math.hypot(a.x - player.x, a.z - player.z) - Math.hypot(b.x - player.x, b.z - player.z));
    const near = list[0]; if (!near) return [];
    const lim = Math.hypot(near.x - player.x, near.z - player.z) + 25;
    return list.filter((e) => Math.hypot(e.x - player.x, e.z - player.z) <= lim).slice(0, 3);
  }
  trySpawn(player, t, list, minDist, allowFront) {
    for (let k = 0; k < 12; k++) {
      const e = list[Math.floor(this.random() * list.length)];
      const x = e.x + (this.random() - 0.5) * 8, z = e.z + (this.random() - 0.5) * 8;
      const dx = x - player.x, dz = z - player.z, d = Math.hypot(dx, dz);
      const inFront = (-Math.sin(player.yaw) * dx - Math.cos(player.yaw) * dz) / d > 0.15;
      const crowded = beetles.some((o) => o.active && o.health > 0 && Math.hypot(o.x - x, o.z - z) < 2.4);
      if (d > minDist && !crowded && !blocked(x, z, 1.4) && (allowFront || !inFront || !lineOfSight(x, z, player.x, player.z))) {
        const b = beetles.find((o) => !o.active); if (!b) return false;
        spawn(b, x, z, t, player); return true;
      }
    }
    return false;
  }
  update(player) {
    const t = S.elapsed;
    // cerco na Plaza de la República
    if (this.phase !== 'siege' && Math.hypot(player.x - PLAZA.x, player.z - PLAZA.z) < PLAZA.radius) {
      this.phase = 'siege'; this.number++; this.siegeAt = t + 7; this.nextSpawn = this.siegeAt; this.nextCall = t + 0.4; S.siegeStart = t;
      beetles.forEach((b) => { if (b.active) b.active = false; });
    }
    if (this.phase === 'siege') {
      S.siege = Math.min(1, Math.max(0, 1 - (this.siegeAt - t) / 7));
      if (t < this.siegeAt) {
        if (t >= this.nextCall) { const e = plazaEntrances[Math.floor(this.random() * plazaEntrances.length)]; emit({ type: 'horde', x: e.x, z: e.z }); this.nextCall = t + 0.9 - S.siege * 0.78 + this.random() * 0.1; }
      } else if (t >= this.nextSpawn) {
        const early = t < this.siegeAt + 2; const n = early ? 6 : 3; let c = 0;
        for (let i = 0; i < n; i++) if (this.trySpawn(player, t, plazaEntrances, 14, true)) c++;
        this.nextSpawn = t + (early ? 0.25 : c ? 0.5 + this.random() * 0.3 : 0.3);
      }
      S.hordePhase = 'siege'; S.hordeNumber = this.number; return;
    }
    if ((this.phase === 'quiet' || this.phase === 'recovery') && t >= this.nextAt) {
      this.entrances = this.chooseEntrances(player);
      if (this.entrances.length >= 2) {
        this.phase = 'warning'; this.nextAt = t + 6; this.warned = t; emit({ type: 'flee' });
        emit({ type: 'horde', x: this.entrances[0].x, z: this.entrances[0].z });
      } else this.nextAt = t + 3;
    } else if (this.phase === 'warning') {
      if (this.warned >= 0 && t >= this.warned + 3) { this.warned = -1; const e = this.entrances[1] ?? this.entrances[0]; emit({ type: 'horde', x: e.x, z: e.z }); }
      if (t >= this.nextAt) { this.phase = 'assault'; this.number++; this.remaining = 8 + Math.floor(this.random() * 5); this.nextSpawn = t; }
    }
    if (this.phase === 'assault') {
      if (this.remaining > 0 && t >= this.nextSpawn) {
        let c = 0; const n = Math.min(this.remaining, 3 + Math.floor(this.random() * 2));
        for (let i = 0; i < n; i++) if (this.trySpawn(player, t, this.entrances, 20, false)) { c++; this.remaining--; }
        this.nextSpawn = t + (c ? 0.25 + this.random() * 0.2 : 0.35);
        if (!c) { const e = this.chooseEntrances(player); if (e.length >= 2) this.entrances = e; }
      }
      if (!this.remaining && !beetles.some((b) => b.active && b.health > 0)) { this.phase = 'recovery'; this.nextAt = t + 16 + this.random() * 12; }
    }
    S.hordePhase = this.phase; S.hordeNumber = this.number;
  }
}
export const director = new Director();

// ---------- Atualização por frame ----------
const tmp = { x: 0, z: 0 };
export function updateEnemies(dt, player) {
  if (S.mode !== 'playing') { for (const b of beetles) b.mesh.visible = b.active; return; }
  director.update(player);
  let alive = 0;
  for (const b of beetles) {
    b.mesh.visible = b.active;
    if (!b.active) continue;
    b.hit = Math.max(0, b.hit - dt * 3);
    if (b.health <= 0) {
      // morte: vira e afunda na neve
      b.deadTime += dt;
      b.mesh.position.set(b.x, -Math.min(1.2, Math.max(0, b.deadTime - 2.5) * 0.6), b.z);
      b.mesh.rotation.set(Math.min(Math.PI, b.deadTime * 6), b.yaw, 0);
      if (b.deadTime > 5) b.active = false;
      continue;
    }
    alive++;
    const dx = player.x - b.x, dz = player.z - b.z, dist = Math.hypot(dx, dz);
    const sees = dist < 42 && lineOfSight(b.x, b.z, player.x, player.z);
    if (sees || S.hordePhase === 'siege') { b.alert = 18; b.lastSeen = { x: player.x, z: player.z }; }
    b.alert = Math.max(0, b.alert - dt);
    b.attack = Math.max(0, b.attack - dt);

    if (dist < 2.4 || (b.state === 'attack' && dist < 3.2 && b.attack > 0)) b.state = 'attack';
    else b.state = 'chase';

    let speed = 0, moved = false;
    if (b.state === 'attack') {
      const want = Math.atan2(dx, dz);
      b.yaw += Math.atan2(Math.sin(want - b.yaw), Math.cos(want - b.yaw)) * Math.min(1, dt * 6);
      if (b.attack === 0) { b.attack = 1.65 + (b.id % 3) * 0.1; b.swing = true; audio.creature(b.x, b.z, true); }
      if (b.swing && b.attack <= 1.1) { b.swing = false; if (dist < 2.85 && sees) damage(10); }
    } else {
      // alvo: última posição vista; se perdeu o rastro, vai lentamente em direção ao jogador
      const target = b.alert > 0 ? b.lastSeen : { x: player.x, z: player.z };
      let tx = target.x - b.x, tz = target.z - b.z; const td = Math.hypot(tx, tz);
      if (td > 0.4) {
        speed = (b.alert > 0 ? 3.4 + (b.id % 4) * 0.18 : 1.2) * (b.hit > 0.3 ? 0.25 : 1) * (S.hordePhase === 'siege' ? 1.15 : 1);
        const base = Math.atan2(tx, tz);
        // separação entre besouros
        let sx = 0, sz = 0;
        for (const o of beetles) { if (o === b || !o.active || o.health <= 0) continue; const ox = b.x - o.x, oz = b.z - o.z, od = Math.hypot(ox, oz); if (od < 2.7 && od > 0.01) { sx += ox / od * 2.2; sz += oz / od * 2.2; } }
        // desvio de obstáculos: testa direções alternadas
        const tries = [0, 0.6, -0.6, 1.2, -1.2, 1.9, -1.9, 2.6, -2.6];
        for (const off of tries) {
          const a = base + off;
          const nx = b.x + (Math.sin(a) * speed + sx) * dt, nz = b.z + (Math.cos(a) * speed + sz) * dt;
          if (!blocked(nx, nz, 1.0) && !blocked(b.x + Math.sin(a) * 1.4, b.z + Math.cos(a) * 1.4, 0.9)) {
            b.x = nx; b.z = nz; moved = true; b.moveDir = a; break;
          }
        }
        if (moved) b.yaw += Math.atan2(Math.sin(b.moveDir - b.yaw), Math.cos(b.moveDir - b.yaw)) * Math.min(1, dt * 5);
      }
    }
    // patas / passos
    if (moved) {
      b.footPhase += dt * speed * 4.5;
      b.stepT -= dt;
      if (b.stepT <= 0 && dist < 34) { b.stepT = 0.28 + Math.random() * 0.08; audio.beastStep(b.x, b.z); }
    }
    b.wobble += dt * (moved ? 12 : 2);
    const legs = b.mesh.userData.legs;
    for (const L of legs) {
      const ph = b.footPhase + L.k * 2.1 + (L.side > 0 ? Math.PI : 0);
      L.pivot.rotation.x = moved ? Math.sin(ph) * 0.55 : Math.sin(b.wobble + L.k) * 0.06;
      L.pivot.rotation.z = moved ? Math.max(0, Math.cos(ph)) * 0.35 * L.side : 0;
    }
    const lunge = b.state === 'attack' && b.attack > 1.1 ? (b.attack - 1.1) / 0.55 : 0;
    b.mesh.position.set(b.x, Math.abs(Math.sin(b.wobble)) * 0.03 + lunge * 0.35, b.z);
    b.mesh.rotation.set(-lunge * 0.5 + (b.hit > 0 ? -b.hit * 0.3 : 0), b.yaw, 0);
    // flash ao ser atingido
    b.mesh.children[0].material = b.hit > 0.6 ? chitinHit : chitin;
  }
  S.enemies = alive;
}
const chitinHit = new THREE.MeshStandardMaterial({ color: '#7a3a2e', roughness: 0.4, metalness: 0.3, emissive: '#5a1a10', emissiveIntensity: 0.6 });
