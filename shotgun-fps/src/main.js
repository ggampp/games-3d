import * as THREE from 'three';
import { createWesternWorld } from './world.js';
import { createShotgunViewmodel } from './shotgunModel.js';
import { PlayerController } from './playerController.js';

// Setup Three.js Core
const canvas = document.getElementById('webgl-canvas');
const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  powerPreference: 'high-performance',
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.05, 300);
scene.add(camera);

// Generate Western Town
const world = createWesternWorld(scene);

// Create Shotgun Viewmodel Rig
const viewmodel = createShotgunViewmodel();

// Initialize Player Controller
const player = new PlayerController(camera, canvas, viewmodel);

// Particle system for bullet impact dust and ejected shells
const impactParticles = [];
const ejectedShells = [];

// Shared shell geometry & material for ejection
const shellGeo = new THREE.CylinderGeometry(0.018, 0.018, 0.07, 6);
shellGeo.rotateZ(Math.PI / 2);
const shellMat = new THREE.MeshStandardMaterial({
  color: 0xc0392b, // Red shotgun shell body
  roughness: 0.4,
  metalness: 0.1,
  flatShading: true,
});

// Shotgun Pellets shooting logic
const raycaster = new THREE.Raycaster();
player.onShootCallback = () => {
  const pelletCount = 8;
  const spreadAngle = 0.035; // Shotgun spread cone

  for (let i = 0; i < pelletCount; i++) {
    // Generate spread offset
    const spreadX = (Math.random() - 0.5) * spreadAngle;
    const spreadY = (Math.random() - 0.5) * spreadAngle;

    const dir = new THREE.Vector3(spreadX, spreadY, -1).normalize();
    dir.applyQuaternion(camera.quaternion);

    raycaster.set(camera.position, dir);
    const intersects = raycaster.intersectObjects(scene.children, true);

    for (let hit of intersects) {
      // Don't hit the viewmodel itself
      if (hit.object.parent === viewmodel.root || hit.object.parent?.parent === viewmodel.root) {
        continue;
      }

      const normal = hit.face?.normal || new THREE.Vector3(0, 1, 0);
      spawnImpactDust(hit.point, normal);
      break;
    }
  }

  // Schedule shell ejection during the pump action rack
  setTimeout(() => {
    spawnEjectedShell();
  }, 220);
};

// Spawn puff of dust and sparks where pellet strikes wood or dirt
function spawnImpactDust(position, normal) {
  const count = 5;
  for (let i = 0; i < count; i++) {
    const pGeo = new THREE.DodecahedronGeometry(0.04 + Math.random() * 0.04, 0);
    const pMat = new THREE.MeshBasicMaterial({
      color: Math.random() > 0.3 ? 0xc8a168 : 0x4a3b2b,
      transparent: true,
      opacity: 0.9,
    });
    const p = new THREE.Mesh(pGeo, pMat);
    p.position.copy(position).addScaledVector(normal, 0.05);

    // Random trajectory
    const vel = normal.clone()
      .add(new THREE.Vector3((Math.random() - 0.5) * 1.5, Math.random() * 1.5, (Math.random() - 0.5) * 1.5))
      .normalize()
      .multiplyScalar(1.5 + Math.random() * 2.5);

    impactParticles.push({
      mesh: p,
      vel: vel,
      life: 0.45,
      maxLife: 0.45,
    });
    scene.add(p);
  }
}

// Spawn empty tumbling shell casing from shotgun ejection port
function spawnEjectedShell() {
  const shell = new THREE.Mesh(shellGeo, shellMat);
  // Position near right side of gun
  const worldPos = new THREE.Vector3(0.18, -0.15, -0.35);
  worldPos.applyEuler(camera.rotation);
  worldPos.add(camera.position);

  shell.position.copy(worldPos);

  // Ejection velocity: strongly to the right and slightly upwards/backwards
  const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
  const up = new THREE.Vector3(0, 1, 0);
  const back = new THREE.Vector3(0, 0, 1).applyQuaternion(camera.quaternion);

  const vel = right.clone().multiplyScalar(2.4)
    .addScaledVector(up, 1.6)
    .addScaledVector(back, 0.5)
    .add(new THREE.Vector3((Math.random() - 0.5) * 0.5, (Math.random() - 0.5) * 0.5, (Math.random() - 0.5) * 0.5));

  const rotVel = new THREE.Vector3(
    (Math.random() - 0.5) * 20,
    (Math.random() - 0.5) * 20,
    (Math.random() - 0.5) * 20
  );

  ejectedShells.push({
    mesh: shell,
    vel: vel,
    rotVel: rotVel,
    life: 3.0,
  });
  scene.add(shell);
}

// UI Ammo representation
const ammoCurrentEl = document.getElementById('ammo-current');
const shellsContainer = document.getElementById('shells-container');

function initAmmoUI() {
  shellsContainer.innerHTML = '';
  for (let i = 0; i < player.maxAmmo; i++) {
    const s = document.createElement('div');
    s.className = 'shell-icon';
    s.id = `shell-icon-${i}`;
    shellsContainer.appendChild(s);
  }
}
initAmmoUI();

player.onAmmoChange = (current, max) => {
  if (ammoCurrentEl) ammoCurrentEl.textContent = current;
  for (let i = 0; i < max; i++) {
    const s = document.getElementById(`shell-icon-${i}`);
    if (s) {
      if (i < current) {
        s.classList.remove('spent');
      } else {
        s.classList.add('spent');
      }
    }
  }
};

// Start button click listener
const playBtn = document.getElementById('play-btn');
playBtn.addEventListener('click', () => {
  player.requestLock();
});

// Resize listener
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
});

// Main Loop
const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);

  const delta = Math.min(clock.getDelta(), 0.1);

  // Update world dust animation
  world.update(delta);

  // Update Player Controller & Viewmodel
  player.update(delta);

  // Update impact particles
  for (let i = impactParticles.length - 1; i >= 0; i--) {
    const p = impactParticles[i];
    p.life -= delta;
    p.mesh.position.addScaledVector(p.vel, delta);
    p.vel.y -= 9.8 * delta; // Gravity on dust
    p.mesh.material.opacity = p.life / p.maxLife;

    if (p.life <= 0) {
      scene.remove(p.mesh);
      p.mesh.geometry.dispose();
      p.mesh.material.dispose();
      impactParticles.splice(i, 1);
    }
  }

  // Update ejected shells
  for (let i = ejectedShells.length - 1; i >= 0; i--) {
    const s = ejectedShells[i];
    s.life -= delta;
    s.vel.y -= 14.0 * delta; // Gravity
    s.mesh.position.addScaledVector(s.vel, delta);
    s.mesh.rotation.x += s.rotVel.x * delta;
    s.mesh.rotation.y += s.rotVel.y * delta;
    s.mesh.rotation.z += s.rotVel.z * delta;

    // Bounce on floor
    if (s.mesh.position.y <= 0.05) {
      s.mesh.position.y = 0.05;
      s.vel.y = -s.vel.y * 0.35;
      s.vel.x *= 0.6;
      s.vel.z *= 0.6;
      s.rotVel.multiplyScalar(0.5);
    }

    if (s.life <= 0) {
      scene.remove(s.mesh);
      s.mesh.geometry.dispose();
      ejectedShells.splice(i, 1);
    }
  }

  renderer.render(scene, camera);
}

animate();
