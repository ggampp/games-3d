import * as THREE from 'three';
import { MAT } from './materials.js';
import { rayHitsLocalBox, rayHitsWorldSphere } from './collision.js';
import { audio } from './audioEngine.js';

// Alvos de galeria: latas (voam ao serem atingidas), garrafas (estilhaçam)
// e placas de bandido de madeira que sobem, giram e caem quando acertadas.

const canGeo = new THREE.CylinderGeometry(0.09, 0.09, 0.2, 8);
const canBandGeo = new THREE.CylinderGeometry(0.093, 0.093, 0.09, 8);
const bottleGeo = new THREE.CylinderGeometry(0.075, 0.08, 0.24, 8);
const neckGeo = new THREE.CylinderGeometry(0.028, 0.05, 0.14, 8);
const shardGeo = new THREE.TetrahedronGeometry(0.035, 0);
const postGeo = new THREE.BoxGeometry(0.1, 1.0, 0.1);

const CUTOUT_BOX = new THREE.Box3(new THREE.Vector3(-0.45, 0.0, -0.06), new THREE.Vector3(0.45, 1.75, 0.06));

let cutoutTexture = null;
function getCutoutTexture() {
  if (cutoutTexture) return cutoutTexture;
  const c = document.createElement('canvas');
  c.width = 256; c.height = 512;
  const ctx = c.getContext('2d');
  // tábua
  ctx.fillStyle = '#b08a5a';
  ctx.fillRect(0, 0, 256, 512);
  ctx.strokeStyle = 'rgba(80,50,20,0.35)';
  ctx.lineWidth = 3;
  for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.moveTo(40 * i + 10, 0); ctx.lineTo(40 * i + 25, 512); ctx.stroke(); }
  // silhueta do bandido pintada
  ctx.fillStyle = '#2b1d14';
  ctx.beginPath(); ctx.ellipse(128, 120, 44, 48, 0, 0, Math.PI * 2); ctx.fill();      // cabeça
  ctx.fillRect(48, 72, 160, 14);                                                    // aba do chapéu
  ctx.fillRect(88, 30, 80, 48);                                                     // copa
  ctx.fillRect(70, 165, 116, 190);                                                  // torso
  ctx.fillRect(40, 175, 34, 130); ctx.fillRect(182, 175, 34, 130);                  // braços
  ctx.fillRect(78, 355, 42, 140); ctx.fillRect(136, 355, 42, 140);                  // pernas
  ctx.fillStyle = '#c0392b';
  ctx.fillRect(96, 150, 64, 22);                                                    // lenço
  // alvo no peito
  ctx.strokeStyle = '#f2e6c8'; ctx.lineWidth = 6;
  ctx.beginPath(); ctx.arc(128, 250, 40, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.arc(128, 250, 18, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = '#f2e6c8';
  ctx.font = 'bold 40px serif'; ctx.textAlign = 'center';
  ctx.fillText('WANTED', 128, 470);
  cutoutTexture = new THREE.CanvasTexture(c);
  cutoutTexture.colorSpace = THREE.SRGBColorSpace;
  return cutoutTexture;
}

export class TargetGallery {
  constructor(scene, anchors, opts = {}) {
    this.scene = scene;
    this.targets = [];
    this.debris = [];
    this.onScore = opts.onScore || (() => {});
    for (const a of anchors) {
      if (a.kind === 'can') this.targets.push(this.makeCan(a.pos));
      else if (a.kind === 'bottle') this.targets.push(this.makeBottle(a.pos));
      else if (a.kind === 'cutout') this.targets.push(this.makeCutout(a.pos));
    }
  }

  makeCan(pos) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(canGeo, MAT.can);
    body.position.y = 0.1;
    body.castShadow = true;
    g.add(body);
    const band = new THREE.Mesh(canBandGeo, MAT.canLabel);
    band.position.y = 0.1;
    g.add(band);
    g.position.copy(pos);
    this.scene.add(g);
    return { kind: 'can', obj: g, home: pos.clone(), radius: 0.16, center: new THREE.Vector3(0, 0.1, 0), state: 'up', vel: null, rotVel: null, t: 0, score: 10 };
  }

  makeBottle(pos) {
    const g = new THREE.Group();
    const mat = Math.random() > 0.5 ? MAT.bottleGreen : MAT.bottleBrown;
    const body = new THREE.Mesh(bottleGeo, mat);
    body.position.y = 0.12;
    body.castShadow = true;
    g.add(body);
    const neck = new THREE.Mesh(neckGeo, mat);
    neck.position.y = 0.3;
    g.add(neck);
    g.position.copy(pos);
    this.scene.add(g);
    return { kind: 'bottle', obj: g, home: pos.clone(), radius: 0.2, center: new THREE.Vector3(0, 0.17, 0), state: 'up', t: 0, score: 15, mat };
  }

  makeCutout(pos) {
    const root = new THREE.Group();
    root.position.copy(pos);
    const post = new THREE.Mesh(postGeo, MAT.woodDark);
    post.position.y = 0.5;
    post.castShadow = true;
    root.add(post);
    const board = new THREE.Group();
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 1.75), new THREE.MeshStandardMaterial({ map: getCutoutTexture(), roughness: 0.9, side: THREE.DoubleSide }));
    plane.position.y = 0.875;
    plane.castShadow = true;
    board.add(plane);
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.75, 0.04), MAT.woodLight);
    back.position.set(0, 0.875, -0.03);
    board.add(back);
    board.position.y = 1.0;
    board.rotation.x = -Math.PI / 2; // deitada
    root.add(board);
    this.scene.add(root);
    return {
      kind: 'cutout', obj: root, board, state: 'down', t: 0, score: 25,
      upTime: 4 + Math.random() * 3, downTime: 2 + Math.random() * 4, angle: -Math.PI / 2, spinPhase: Math.random() * 6,
    };
  }

  // Testa um raio contra todos os alvos ativos. Retorna { target, dist } mais próximo ou null.
  hitTest(ray) {
    let best = null;
    const c = new THREE.Vector3();
    for (const t of this.targets) {
      let d = null;
      if (t.kind === 'cutout') {
        if (t.state !== 'up' && t.state !== 'rising') continue;
        if (t.angle < -0.6) continue;
        t.board.updateWorldMatrix(true, false);
        d = rayHitsLocalBox(ray, t.board, CUTOUT_BOX);
      } else {
        if (t.state !== 'up') continue;
        c.copy(t.center).add(t.obj.position);
        d = rayHitsWorldSphere(ray, c, t.radius);
      }
      if (d !== null && (best === null || d < best.dist)) best = { target: t, dist: d };
    }
    return best;
  }

  // Aplica o acerto de um pellet vindo da direção dir
  hit(t, dir) {
    if (t.kind === 'can') {
      t.state = 'flying';
      t.t = 0;
      t.vel = dir.clone().multiplyScalar(4 + Math.random() * 3);
      t.vel.y += 3.5 + Math.random() * 2;
      t.rotVel = new THREE.Vector3((Math.random() - 0.5) * 20, (Math.random() - 0.5) * 20, (Math.random() - 0.5) * 20);
      audio.playCanHit();
    } else if (t.kind === 'bottle') {
      t.state = 'broken';
      t.t = 0;
      t.obj.visible = false;
      this.spawnShards(t.obj.position.clone().add(t.center), dir, t.mat);
      audio.playGlassBreak();
    } else if (t.kind === 'cutout') {
      t.state = 'falling';
      t.t = 0;
      audio.playWoodHit();
    }
    this.onScore(t.score, t.kind);
  }

  spawnShards(pos, dir, mat) {
    for (let i = 0; i < 10; i++) {
      const m = new THREE.Mesh(shardGeo, mat);
      m.position.copy(pos);
      const vel = dir.clone().multiplyScalar(1.5 + Math.random() * 2)
        .add(new THREE.Vector3((Math.random() - 0.5) * 3, 1 + Math.random() * 3, (Math.random() - 0.5) * 3));
      this.debris.push({ mesh: m, vel, life: 1.2, rot: new THREE.Vector3(Math.random() * 10, Math.random() * 10, Math.random() * 10) });
      this.scene.add(m);
    }
  }

  update(dt) {
    for (const t of this.targets) {
      t.t += dt;
      if (t.kind === 'can') {
        if (t.state === 'flying') {
          t.vel.y -= 12 * dt;
          t.obj.position.addScaledVector(t.vel, dt);
          t.obj.rotation.x += t.rotVel.x * dt;
          t.obj.rotation.z += t.rotVel.z * dt;
          if (t.obj.position.y < 0.05) {
            t.obj.position.y = 0.05;
            t.vel.y = -t.vel.y * 0.3;
            t.vel.x *= 0.6; t.vel.z *= 0.6;
            t.rotVel.multiplyScalar(0.5);
          }
          if (t.t > 3) { t.state = 'gone'; t.t = 0; t.obj.visible = false; }
        } else if (t.state === 'gone' && t.t > 4) {
          t.state = 'up'; t.obj.visible = true;
          t.obj.position.copy(t.home); t.obj.rotation.set(0, 0, 0);
        }
      } else if (t.kind === 'bottle') {
        if (t.state === 'broken' && t.t > 6) { t.state = 'up'; t.obj.visible = true; }
      } else if (t.kind === 'cutout') {
        if (t.state === 'down' && t.t > t.downTime) { t.state = 'rising'; t.t = 0; }
        if (t.state === 'rising') {
          const k = Math.min(1, t.t / 0.5);
          const e = 1 - Math.pow(1 - k, 3);
          t.angle = -Math.PI / 2 * (1 - e) + (k < 1 ? Math.sin(k * Math.PI) * 0.12 : 0);
          if (k >= 1) { t.state = 'up'; t.t = 0; t.angle = 0; }
        } else if (t.state === 'up') {
          t.angle = 0;
          // gira devagar para dificultar
          t.spinPhase += dt;
          t.obj.rotation.y = Math.sin(t.spinPhase * 0.8) * 0.6;
          if (t.t > t.upTime) { t.state = 'falling'; t.t = 0; }
        } else if (t.state === 'falling') {
          const k = Math.min(1, t.t / 0.35);
          const bounce = t.t > 0.35 && t.t < 0.6 ? Math.sin((t.t - 0.35) / 0.25 * Math.PI) * 0.15 : 0;
          t.angle = -Math.PI / 2 * (k * k) + bounce;
          if (t.t > 0.7) { t.state = 'down'; t.t = 0; t.angle = -Math.PI / 2; }
        }
        t.board.rotation.x = t.angle;
      }
    }
    for (let i = this.debris.length - 1; i >= 0; i--) {
      const d = this.debris[i];
      d.life -= dt;
      d.vel.y -= 9.8 * dt;
      d.mesh.position.addScaledVector(d.vel, dt);
      d.mesh.rotation.x += d.rot.x * dt;
      d.mesh.rotation.y += d.rot.y * dt;
      if (d.mesh.position.y < 0.02) { d.mesh.position.y = 0.02; d.vel.set(0, 0, 0); }
      if (d.life <= 0) { this.scene.remove(d.mesh); this.debris.splice(i, 1); }
    }
  }
}
