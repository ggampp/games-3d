import * as THREE from 'three';
import { hexToWorld, worldToHex, type Hex } from '../game/hex';
import { validPlacements } from '../game/placement';
import type { TileMap } from '../game/production';
import { stepVillagers, syncVillagers, villagerWorld, type Villager } from '../game/villagers';
import { createClouds, driftClouds } from './clouds';
import { BurstParticles } from './particles';
import {
  createGhostGroup,
  createTileGroup,
  createValidMarker,
  createVillagerMesh,
  tileAccent,
} from './tileFactory';

type Orbit = {
  theta: number;
  phi: number;
  radius: number;
  target: THREE.Vector3;
};

export class KingdomView {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(42, 1, 0.1, 80);
  readonly tiles = new Map<string, THREE.Group>();
  readonly pops: Array<{ mesh: THREE.Sprite; life: number }> = [];

  private readonly tileRoot = new THREE.Group();
  private readonly markerRoot = new THREE.Group();
  private readonly villagerRoot = new THREE.Group();
  private readonly ghost: THREE.Mesh;
  private readonly clouds: THREE.Group;
  private readonly sun: THREE.DirectionalLight;
  private readonly hemi: THREE.HemisphereLight;
  private readonly ground: THREE.Mesh;
  private villagers: Villager[] = [];
  private villagerMeshes: THREE.Group[] = [];
  private readonly particles: BurstParticles;
  private readonly orbit: Orbit = {
    theta: 0.55,
    phi: 0.92,
    radius: 14,
    target: new THREE.Vector3(0, 0.2, 0),
  };
  private autoRotate = true;
  private readonly popping = new Map<string, number>();

  constructor(reduceParticles: boolean) {
    this.scene.background = new THREE.Color('#e8d5b7');
    this.scene.fog = new THREE.Fog('#e8d5b7', 22, 42);

    this.hemi = new THREE.HemisphereLight('#fff6e8', '#7a8f6a', 1.15);
    this.scene.add(this.hemi);

    this.sun = new THREE.DirectionalLight('#fff3d6', 1.8);
    this.sun.position.set(-6, 12, 8);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(1024, 1024);
    this.sun.shadow.camera.near = 1;
    this.sun.shadow.camera.far = 36;
    this.sun.shadow.camera.left = -14;
    this.sun.shadow.camera.right = 14;
    this.sun.shadow.camera.top = 14;
    this.sun.shadow.camera.bottom = -14;
    this.scene.add(this.sun);

    this.ground = new THREE.Mesh(
      new THREE.CircleGeometry(18, 48),
      new THREE.MeshLambertMaterial({ color: '#c8b48a' }),
    );
    this.ground.rotation.x = -Math.PI / 2;
    this.ground.position.y = -0.02;
    this.ground.receiveShadow = true;
    this.scene.add(this.ground);

    this.scene.add(this.tileRoot);
    this.scene.add(this.markerRoot);
    this.scene.add(this.villagerRoot);

    this.ghost = createGhostGroup();
    this.ghost.visible = false;
    this.scene.add(this.ghost);

    this.clouds = createClouds();
    this.scene.add(this.clouds);

    this.particles = new BurstParticles(this.scene, reduceParticles);
    this.applyOrbit();
  }

  setReduceParticles(value: boolean): void {
    this.particles.setReduce(value);
  }

  setAutoRotate(value: boolean): void {
    this.autoRotate = value;
  }

  setSky(hex: string): void {
    this.scene.background = new THREE.Color(hex);
    this.scene.fog = new THREE.Fog(hex, 22, 42);
  }

  syncMap(map: TileMap, animateKey?: string): void {
    for (const [key, group] of this.tiles) {
      if (!map.has(key)) {
        this.tileRoot.remove(group);
        this.tiles.delete(key);
      }
    }
    for (const [key, tileId] of map) {
      const existing = this.tiles.get(key);
      if (existing && existing.userData.tileId === tileId) continue;
      if (existing) this.tileRoot.remove(existing);
      const group = createTileGroup(tileId);
      const hex = key.split(',').map(Number);
      const world = hexToWorld({ q: hex[0]!, r: hex[1]! });
      group.position.set(world.x, 0, world.z);
      this.tileRoot.add(group);
      this.tiles.set(key, group);
      if (animateKey === key) {
        group.scale.setScalar(0.2);
        this.popping.set(key, 0);
        const color = tileAccent(tileId);
        this.particles.spawn(new THREE.Vector3(world.x, 0.3, world.z), color);
      }
    }
    this.villagers = syncVillagers(map, this.villagers);
    this.syncVillagerMeshes();
    this.recentre();
  }

  showValid(map: TileMap, visible: boolean): void {
    this.markerRoot.clear();
    if (!visible) return;
    for (const hex of validPlacements(map)) {
      const marker = createValidMarker();
      const world = hexToWorld(hex);
      marker.position.set(world.x, 0.04, world.z);
      this.markerRoot.add(marker);
    }
  }

  setGhost(hex: Hex | null, valid: boolean): void {
    if (!hex) {
      this.ghost.visible = false;
      return;
    }
    const world = hexToWorld(hex);
    this.ghost.visible = true;
    this.ghost.position.set(world.x, 0.08, world.z);
    (this.ghost.material as THREE.MeshLambertMaterial).color.set(valid ? '#f4e8d0' : '#c45c3e');
  }

  pickHex(ndc: THREE.Vector2): Hex | null {
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(ndc, this.camera);
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const hit = new THREE.Vector3();
    if (!raycaster.ray.intersectPlane(plane, hit)) return null;
    return worldToHex(hit.x, hit.z);
  }

  orbitBy(dx: number, dy: number): void {
    this.autoRotate = false;
    this.orbit.theta -= dx * 0.007;
    this.orbit.phi = THREE.MathUtils.clamp(this.orbit.phi + dy * 0.005, 0.35, 1.25);
  }

  zoomBy(delta: number): void {
    this.orbit.radius = THREE.MathUtils.clamp(this.orbit.radius + delta * 0.01, 7, 24);
  }

  floatLabel(hex: Hex, text: string, color: string): void {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, 256, 64);
    ctx.font = '700 28px Nunito, sans-serif';
    ctx.fillStyle = color;
    ctx.textAlign = 'center';
    ctx.fillText(text, 128, 42);
    const texture = new THREE.CanvasTexture(canvas);
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true }));
    const world = hexToWorld(hex);
    sprite.position.set(world.x, 1.2, world.z);
    sprite.scale.set(2.2, 0.55, 1);
    this.scene.add(sprite);
    this.pops.push({ mesh: sprite, life: 0.9 });
  }

  loadShowcase(): void {
    const demo: TileMap = new Map([
      ['0,0', 'clareira'],
      ['1,0', 'casa'],
      ['0,1', 'roca'],
      ['-1,1', 'mata'],
      ['1,-1', 'engenho'],
      ['2,-1', 'padaria'],
      ['-1,0', 'rio'],
      ['-2,1', 'cais'],
      ['0,-1', 'pomar'],
      ['2,0', 'sobrado'],
      ['1,1', 'mercado'],
      ['2,1', 'moinho_vento'],
      ['3,-1', 'trigo'],
      ['-2,0', 'lago'],
      ['-1,-1', 'horta'],
      ['0,2', 'escola'],
      ['3,0', 'farol'],
    ]);
    this.syncMap(demo);
    this.showValid(demo, false);
    this.setAutoRotate(true);
  }

  update(dt: number, elapsed: number, playing: boolean): void {
    if (this.autoRotate) this.orbit.theta += dt * 0.12;
    this.applyOrbit();
    driftClouds(this.clouds, elapsed);

    for (const tile of this.tiles.values()) {
      const spinners = tile.userData.spinners as THREE.Object3D[] | undefined;
      if (spinners) {
        for (const spinner of spinners) {
          const axis = (spinner.userData.axis as 'x' | 'y' | 'z') ?? 'x';
          const speed = Number(spinner.userData.speed ?? 1.2);
          spinner.rotation[axis] += dt * speed;
        }
      }
      const lamps = tile.userData.lamps as THREE.Mesh[] | undefined;
      if (lamps) {
        const pulse = 0.55 + Math.sin(elapsed * 2.6) * 0.4;
        for (const lamp of lamps) {
          (lamp.material as THREE.MeshStandardMaterial).emissiveIntensity = pulse;
        }
      }
    }

    for (const [key, t] of [...this.popping.entries()]) {
      const next = t + dt * 3.2;
      const group = this.tiles.get(key);
      if (!group) {
        this.popping.delete(key);
        continue;
      }
      const squash = next >= 1 ? 1 : 1 - Math.pow(1 - Math.min(next, 1), 3);
      const bounce = next < 1 ? 1 + Math.sin(next * Math.PI) * 0.12 : 1;
      group.scale.set(squash, bounce, squash);
      if (next >= 1) this.popping.delete(key);
      else this.popping.set(key, next);
    }

    if (playing) {
      this.villagers = stepVillagers(this.villagers, this.mapFromTiles(), dt);
      this.villagerMeshes.forEach((mesh, index) => {
        const villager = this.villagers[index];
        if (!villager) return;
        const world = villagerWorld(villager);
        mesh.position.set(world.x, 0.12, world.z);
      });
    }

    for (let i = this.pops.length - 1; i >= 0; i -= 1) {
      const pop = this.pops[i]!;
      pop.life -= dt;
      pop.mesh.position.y += dt * 0.8;
      (pop.mesh.material as THREE.SpriteMaterial).opacity = Math.max(0, pop.life / 0.9);
      if (pop.life <= 0) {
        this.scene.remove(pop.mesh);
        (pop.mesh.material as THREE.SpriteMaterial).map?.dispose();
        (pop.mesh.material as THREE.Material).dispose();
        this.pops.splice(i, 1);
      }
    }

    this.particles.update(dt);
  }

  dispose(): void {
    this.particles.dispose();
  }

  private mapFromTiles(): TileMap {
    const map: TileMap = new Map();
    for (const [key, group] of this.tiles) {
      map.set(key, String(group.userData.tileId));
    }
    return map;
  }

  private syncVillagerMeshes(): void {
    while (this.villagerMeshes.length > this.villagers.length) {
      const mesh = this.villagerMeshes.pop()!;
      this.villagerRoot.remove(mesh);
    }
    while (this.villagerMeshes.length < this.villagers.length) {
      const mesh = createVillagerMesh();
      this.villagerRoot.add(mesh);
      this.villagerMeshes.push(mesh);
    }
  }

  private recentre(): void {
    if (this.tiles.size === 0) return;
    const acc = new THREE.Vector3();
    for (const group of this.tiles.values()) acc.add(group.position);
    acc.multiplyScalar(1 / this.tiles.size);
    this.orbit.target.lerp(new THREE.Vector3(acc.x, 0.2, acc.z), 0.35);
  }

  private applyOrbit(): void {
    const { theta, phi, radius, target } = this.orbit;
    this.camera.position.set(
      target.x + radius * Math.sin(phi) * Math.cos(theta),
      target.y + radius * Math.cos(phi),
      target.z + radius * Math.sin(phi) * Math.sin(theta),
    );
    this.camera.lookAt(target);
  }
}
