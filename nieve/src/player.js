// Jogador: pointer lock, movimento com colisão, viewmodel da Saiga 12, linterna, tiro hitscan
import * as THREE from 'three';
import { S, GUN, MOVE, START, tryShoot, tryReload, tickVitals, on } from './state.js';
import { resolveCircle } from './world.js';
import { beetleMeshes, hitBeetle } from './enemies.js';
import * as audio from './audio.js';

export const keys = {};
export const input = { interact: false, fire: false };

export function createPlayer(camera, scene, canvas) {
  const P = { x: START.x, y: 0, z: START.z, yaw: 0, pitch: 0, vy: 0, grounded: true, bob: 0, stepT: 0, recoil: 0, kick: 0, reloadAnim: 0 };
  camera.rotation.order = 'YXZ';

  // ----- input -----
  window.addEventListener('keydown', (e) => {
    keys[e.code] = true;
    if (S.mode !== 'playing') return;
    if (e.code === 'KeyR') tryReload();
    if (e.code === 'KeyE') input.interact = true;
    if (e.code === 'KeyF') S.torch = !S.torch;
    if (e.code === 'Space') e.preventDefault();
  });
  window.addEventListener('keyup', (e) => { keys[e.code] = false; });
  window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; });
  document.addEventListener('mousemove', (e) => {
    if (document.pointerLockElement !== canvas || S.mode !== 'playing') return;
    P.yaw -= e.movementX * 0.0022; P.pitch = Math.max(-1.45, Math.min(1.45, P.pitch - e.movementY * 0.0022));
  });
  canvas.addEventListener('mousedown', (e) => {
    if (e.button !== 0 || document.pointerLockElement !== canvas || S.mode !== 'playing') return;
    if (tryShoot()) fire();
  });

  // ----- viewmodel: Saiga 12 -----
  const gun = new THREE.Group();
  const metal = new THREE.MeshStandardMaterial({ color: '#23272b', roughness: 0.55, metalness: 0.6 });
  const poly = new THREE.MeshStandardMaterial({ color: '#1a1c1e', roughness: 0.8, metalness: 0.1 });
  const add = (geo, mat, x, y, z, rx = 0, ry = 0, rz = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(rx, ry, rz); gun.add(m); return m; };
  add(new THREE.BoxGeometry(0.075, 0.11, 0.5), metal, 0, 0, -0.1);                 // receiver
  add(new THREE.CylinderGeometry(0.022, 0.022, 0.62, 12), metal, 0, 0.035, -0.62, Math.PI / 2); // cano
  add(new THREE.CylinderGeometry(0.014, 0.014, 0.5, 8), metal, 0, 0.075, -0.6, Math.PI / 2);   // tubo de gás
  add(new THREE.BoxGeometry(0.07, 0.07, 0.34), poly, 0, -0.01, -0.5);              // handguard
  add(new THREE.BoxGeometry(0.06, 0.2, 0.07), poly, 0, -0.14, -0.1, 0.35);        // carregador
  add(new THREE.BoxGeometry(0.05, 0.12, 0.06), poly, 0, -0.1, 0.1, 0.15);         // empunhadura
  add(new THREE.BoxGeometry(0.06, 0.09, 0.3), poly, 0, -0.02, 0.32);              // coronha
  add(new THREE.BoxGeometry(0.02, 0.05, 0.04), metal, 0, 0.09, -0.3);             // alça de mira
  const flashSprite = new THREE.Sprite(new THREE.SpriteMaterial({ color: '#ffd9a0', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthTest: false }));
  flashSprite.scale.set(0.35, 0.35, 1); flashSprite.position.set(0, 0.035, -0.95); gun.add(flashSprite);
  const flashLight = new THREE.PointLight('#ffb070', 0, 14, 2); flashLight.position.set(0.2, -0.2, -1); camera.add(flashLight);
  gun.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.frustumCulled = false; } });
  scene.add(camera);
  // a arma vive numa cena própria (passe de viewmodel) para não ser estourada pela linterna
  const gunScene = new THREE.Scene();
  const gunCam = new THREE.PerspectiveCamera(60, camera.aspect, 0.02, 5);
  gunCam.add(gun); gunScene.add(gunCam);
  gunScene.add(new THREE.HemisphereLight('#8fa9ba', '#1c2328', 2.0));
  const gunKey = new THREE.DirectionalLight('#ffe2c0', 0.8); gunKey.position.set(1, 1.5, 0.5); gunScene.add(gunKey);
  const gunFlash = new THREE.PointLight('#ffb070', 0, 3, 2); gunFlash.position.set(0, 0.1, -0.9); gunCam.add(gunFlash);

  // linterna (spot) presa à câmera
  const torch = new THREE.SpotLight('#e9f1ff', 40, 45, 0.42, 0.55, 1.6);
  torch.position.set(0.15, -0.1, 0); torch.target.position.set(0, -0.05, -10); torch.castShadow = true;
  torch.shadow.mapSize.set(1024, 1024); torch.shadow.bias = -0.002;
  camera.add(torch); camera.add(torch.target);

  const ray = new THREE.Raycaster(); ray.far = 60;
  const dir = new THREE.Vector3();
  function fire() {
    P.recoil = 1; P.kick = 1; flashSprite.material.opacity = 1; flashLight.intensity = 60; gunFlash.intensity = 6;
    camera.getWorldDirection(dir);
    const hits = new Map();
    for (let i = 0; i < GUN.pellets; i++) {
      const d = dir.clone();
      d.x += (Math.random() - 0.5) * GUN.spread * 2; d.y += (Math.random() - 0.5) * GUN.spread * 2; d.z += (Math.random() - 0.5) * GUN.spread * 2; d.normalize();
      ray.set(camera.position, d);
      const h = ray.intersectObjects(beetleMeshes, false)[0];
      if (h) { const idx = h.object.userData.beetle; hits.set(idx, (hits.get(idx) || 0) + GUN.pelletDamage * (h.distance < 6 ? 1 : Math.max(0.35, 1 - (h.distance - 6) / 40))); }
    }
    for (const [idx, dmg] of hits) hitBeetle(idx, dmg, P);
  }

  on((ev) => { if (ev.type === 'reload') P.reloadAnim = GUN.reload; });

  const vel = new THREE.Vector3();
  function update(dt) {
    const playing = S.mode === 'playing';
    // movimento
    let fx = 0, fz = 0;
    if (playing) { if (keys.KeyW) fz -= 1; if (keys.KeyS) fz += 1; if (keys.KeyA) fx -= 1; if (keys.KeyD) fx += 1; }
    const moving = !!(fx || fz);
    tickVitals(dt, !!(keys.ShiftLeft || keys.ShiftRight), moving);
    const speed = S.running ? MOVE.run : MOVE.walk;
    if (moving) { const l = Math.hypot(fx, fz); fx /= l; fz /= l; }
    const sin = Math.sin(P.yaw), cos = Math.cos(P.yaw);
    // frente = (-sin, -cos), direita = (cos, -sin); fz<0 = frente
    const mx = (fx * cos + fz * sin) * speed, mz = (-fx * sin + fz * cos) * speed;
    vel.x += (mx - vel.x) * Math.min(1, dt * 12); vel.z += (mz - vel.z) * Math.min(1, dt * 12);
    P.x += vel.x * dt; P.z += vel.z * dt;
    resolveCircle(P, MOVE.radius);
    if (playing && keys.Space && P.grounded) { P.vy = 4.2; P.grounded = false; }
    if (!P.grounded) { P.vy -= 12 * dt; P.y += P.vy * dt; if (P.y <= 0) { P.y = 0; P.vy = 0; P.grounded = true; audio.footstep(true); } }

    // headbob + passos
    const sp = Math.hypot(vel.x, vel.z);
    if (sp > 0.5 && P.grounded) {
      P.bob += dt * (S.running ? 11 : 7.5);
      P.stepT -= dt * sp; if (P.stepT <= 0) { P.stepT = S.running ? 2.9 : 2.2; audio.footstep(S.running); }
    } else P.bob += dt * 1.2;
    const bobY = Math.sin(P.bob * 2) * (sp > 0.5 ? 0.035 : 0.006) + S.breath * 0.012 * S.exertion;
    const bobX = Math.cos(P.bob) * (sp > 0.5 ? 0.02 : 0);
    camera.position.set(P.x + bobX * cos, MOVE.eyeHeight + P.y + bobY, P.z - bobX * sin);
    P.recoil = Math.max(0, P.recoil - dt * 7); P.kick = Math.max(0, P.kick - dt * 4);
    camera.rotation.set(P.pitch + P.kick * 0.05 + S.hurt * Math.sin(S.elapsed * 30) * 0.01, P.yaw, S.hurt * 0.02 * Math.sin(S.elapsed * 25));

    // viewmodel
    P.reloadAnim = Math.max(0, P.reloadAnim - dt);
    const rl = P.reloadAnim > 0 ? Math.sin((1 - P.reloadAnim / GUN.reload) * Math.PI) : 0;
    gun.position.set(0.3 - rl * 0.08, -0.26 + Math.sin(P.bob * 2) * 0.008 - rl * 0.16 + P.recoil * 0.03, -0.55 + P.recoil * 0.13);
    gun.rotation.set(-P.recoil * 0.35 - rl * 0.6 + Math.sin(P.bob) * 0.004, 0.05 + rl * 0.35 + P.recoil * 0.05, rl * 0.25 + Math.cos(P.bob) * 0.004);
    flashSprite.material.opacity = Math.max(0, flashSprite.material.opacity - dt * 14);
    flashLight.intensity = Math.max(0, flashLight.intensity - dt * 500); gunFlash.intensity = Math.max(0, gunFlash.intensity - dt * 60);
    gunCam.aspect = camera.aspect; gunCam.updateProjectionMatrix(); gunCam.position.copy(camera.position); gunCam.quaternion.copy(camera.quaternion);
    torch.visible = S.torch && S.mode !== 'menu';
    torch.intensity = 40 * (0.94 + 0.06 * Math.sin(S.elapsed * 40));
  }

  function reset() { Object.assign(P, { x: START.x, y: 0, z: START.z, yaw: 0, pitch: 0, vy: 0, grounded: true, recoil: 0, kick: 0, reloadAnim: 0 }); vel.set(0, 0, 0); }

  return { P, update, reset, gun, gunScene, gunCam, fire: () => { if (tryShoot()) fire(); } };
}
