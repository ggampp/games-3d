import * as THREE from 'three';
import { GameLoop } from '../core/loop.ts';
import { Input } from '../core/input.ts';
import { PhysicsSim } from '../physics/sim.ts';
import { VoxelGrid } from '../voxels/grid.ts';
import { buildTown, TOWN } from '../voxels/town.ts';
import { damageAt, voxelRaycast, voxelRaycastWorld } from '../voxels/connectivity.ts';
import type { RayHit } from '../voxels/connectivity.ts';
import { MATERIALS, VOXEL_SIZE } from '../voxels/types.ts';
import type { Voxel } from '../voxels/types.ts';
import { WEAPONS, weaponById, weaponBySlot, spreadDirection, initialAmmo, spend, canReload, finishReload } from '../weapons/catalog.ts';
import type { AmmoState } from '../weapons/catalog.ts';
import { FireSystem } from './fire.ts';
import type { WeaponDef, WeaponId } from '../weapons/catalog.ts';
import { loadWorldTextures } from '../render/textures.ts';
import { createLighting, createRenderer, createWorldKit, followShadow } from '../render/scene.ts';
import { VoxelView } from '../render/voxels.ts';
import { Viewmodel } from '../render/viewmodel.ts';
import { Dust } from '../render/dust.ts';
import { Sky } from '../render/sky.ts';
import { Post } from '../render/post.ts';
import { Hud } from '../ui/hud.ts';
import type { HudState } from '../ui/hud.ts';
import { GameAudio } from '../audio/audio.ts';
import { Player } from '../player/player.ts';

const SENS = 0.0022;
const PICKUP_SPOTS: { x: number; z: number }[] = [
  { x: 2.6, z: -2.2 }, { x: -6.2, z: -1.2 }, { x: 9.4, z: 4.6 }, { x: -1.8, z: 6.6 }, { x: 6.6, z: -6.6 }, { x: -9.6, z: 8.2 },
];
const PICKUP_RESPAWN = 45;

interface Contract {
  text: string;
  check: (g: Game) => boolean;
}
const CONTRACTS: Contract[] = [
  { text: 'derrube 3 prédios', check: (g) => g.collapsedCountValue >= 3 },
  { text: "tombe a caixa d'água", check: (g) => g.integrityOf('water') < 0.5 },
  { text: 'solte o sino da capela', check: (g) => g.bellFallen() },
  { text: 'queime o estábulo', check: (g) => g.integrityOf('stable') < 0.55 },
  { text: 'derrube o moinho', check: (g) => g.integrityOf('windmill') < 0.5 },
];
const TOUCH_SENS = 0.006;
const SPAWN = { x: 0, z: 5.6 };
const COLLAPSE_AT = 0.4;
const lanternTarget = new THREE.Vector3();

interface StructureState {
  initial: number;
  /** Ainda na grade. */
  alive: number;
  /** Na grade e nao caido. */
  remaining: number;
  collapsed: boolean;
}

export class Game {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private input: Input;
  private hud: Hud;
  private audio = new GameAudio();
  private physics: PhysicsSim;
  private grid: VoxelGrid;
  private voxels: VoxelView;
  private viewmodel = new Viewmodel();
  private dust = new Dust();
  private player: Player;
  private sun: THREE.DirectionalLight;
  private sky: Sky;
  private post: Post;
  private sunDir = new THREE.Vector3();
  private shake = 0;
  private shakeVec = new THREE.Vector3();
  private recoilPitch = 0;
  private hitStop = 0;
  private scorches: THREE.Mesh[] = [];
  private scorchMat = new THREE.MeshBasicMaterial({ color: 0x1a120c, transparent: true, opacity: 0.55, depthWrite: false });
  private explosionLight: THREE.PointLight;
  private lanterns: THREE.PointLight[] = [];
  private lanternVoxels: Voxel[] = [];
  private lanternSmooth = new Map<number, THREE.Vector3>();
  private muzzle: THREE.PointLight;
  private bombTemplate: THREE.Object3D | null = null;
  private bombVisuals: THREE.Object3D[] = [];
  private laserBeam: THREE.Mesh;
  private yaw = 0;
  private pitch = 0;
  private weapon: WeaponDef = weaponById('shotgun');
  private cooldown = 0;
  private score = 0;
  private structures: StructureState[] = [];
  private windmillVoxel: Voxel | null = null;
  private wagonVoxel: Voxel | null = null;
  private wagonSoundAt = 0;
  private paused = false;
  private mode: HudState['mode'] = 'playground';
  private shots = 0;
  private collapsedCount = 0;
  private toast: string | null = null;
  private target: HudState['target'] = null;
  private frame = 0;
  private loop: GameLoop;
  private forward = new THREE.Vector3();
  private swayX = 0;
  private swayY = 0;
  private fire!: FireSystem;
  private ammo = new Map<WeaponId, AmmoState>();
  private fireLights: THREE.PointLight[] = [];
  private hook = { active: false, point: new THREE.Vector3(), voxel: null as Voxel | null, rope: null as THREE.Mesh | null };
  private prompt: string | null = null;
  private pickups: { mesh: THREE.Object3D; x: number; z: number; t: number }[] = [];
  private contractIdx = 0;
  private contractTime = 0;
  private contractDone = false;
  private bellVoxel: Voxel | null = null;
  private wellPos = { x: 0, z: 0 };
  private sprayOn = false;
  private targets = new Map<string, { spec: { ix: number; iy: number; iz: number; mat: Voxel['mat']; s: number }[]; phase: number; up: boolean; respawn: number; hits: number }>();
  private windT = 0;
  private tumbleVoxels: Voxel[] = [];
  lastHit: unknown = null;
  private hookMat = new THREE.MeshBasicMaterial({ color: 0x5a3a20 });
  /** ms por fase no último frame (diagnóstico). */
  timings = { physics: 0, sync: 0, render: 0, total: 0, shot: 0 };

  constructor(root: HTMLElement, physics: PhysicsSim) {
    this.physics = physics;
    this.grid = buildTown();

    this.hud = new Hud(root, {
      onSelect: (id) => this.setWeapon(id),
      onReset: () => this.reset(),
      onMute: () => {
        this.audio.setMuted(!this.audio.muted);
        this.syncHud();
      },
      onFire: (down) => this.input.setFiring(down),
      onMove: (x, z) => this.input.setStick(x, z),
      onJump: () => this.input.pressJump(),
      onMode: () => this.toggleMode(),
      onReload: () => this.input.pressReload(),
      onInteract: () => this.input.pressInteract(),
      onDetonate: () => this.input.pressAlt(),
    });

    this.renderer = createRenderer(this.hud.canvas);
    this.camera = new THREE.PerspectiveCamera(72, window.innerWidth / window.innerHeight, 0.05, 120);
    this.camera.add(this.viewmodel.group);
    this.scene.add(this.camera);

    const textures = loadWorldTextures();
    createWorldKit(this.scene, textures);
    const lights = createLighting(this.scene);
    this.sun = lights.sun;
    this.lanterns = lights.lanterns;
    this.muzzle = lights.muzzle;

    this.voxels = new VoxelView(textures);
    this.scene.add(this.voxels.group);
    this.scene.add(this.dust.points);
    this.sky = new Sky(this.scene, this.renderer, this.sun, lights.hemi);
    this.scene.add(this.sky.group);
    this.post = new Post(this.renderer, this.scene, this.camera);
    this.explosionLight = new THREE.PointLight(0xffb060, 0, 12, 1.6);
    this.scene.add(this.explosionLight);
    for (let i = 0; i < 3; i++) {
      const l = new THREE.PointLight(0xff7a20, 0, 6, 1.8);
      this.scene.add(l);
      this.fireLights.push(l);
    }
    this.fire = new FireSystem(this.grid, physics, {
      burnOut: (vs) => this.burnOut(vs),
      setBurning: (v, on) => this.voxels.setBurning(v, on),
      flame: (x, y, z, k) => {
        this.dust.burst(x, y, z, 1, k > 0.5 ? 0xff8a20 : 0xff5a10, 0.45, { life: 0.45, up: 1.8, bright: 2.4, gravity: -2.5 });
        if (Math.random() < 0.3) this.dust.burst(x, y + 0.1, z, 1, 0x333333, 0.4, { life: 1.6, up: 1.4, gravity: -0.5 });
      },
    });
    const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 1, 5), this.hookMat);
    rope.visible = false;
    this.scene.add(rope);
    this.hook.rope = rope;
    const wellDef = TOWN.find((t) => t.id === 'well');
    if (wellDef) this.wellPos = { x: wellDef.x, z: wellDef.z };

    this.laserBeam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.015, 0.015, 1, 6),
      new THREE.MeshBasicMaterial({ color: 0x4ec4ff }),
    );
    this.laserBeam.visible = false;
    this.scene.add(this.laserBeam);

    this.input = new Input(this.hud.canvas);
    this.hud.canvas.addEventListener('click', () => {
      this.audio.unlock();
      if (!this.hud.isTouch) this.input.requestLock();
      if (this.paused) { this.paused = false; this.syncHud(); }
    });
    this.hud.canvas.addEventListener('pointerdown', () => this.audio.unlock(), { once: true });
    window.addEventListener('keydown', (e) => this.onKey(e));
    window.addEventListener('resize', () => this.resize());

    this.player = new Player(physics, {
      step: (kind) => this.audio.play(kind === 'wood' ? 'step-wood' : kind === 'stone' ? 'step-stone' : 'step-sand', 0.35),
      jump: () => this.audio.play('jump', 0.4),
      land: (impact) => this.audio.play('land', Math.min(0.8, 0.25 + impact * 0.08)),
    });

    this.setupWorld();
    this.viewmodel.setWeapon(this.weapon.id);
    this.syncHud();

    this.loop = new GameLoop((dt) => this.update(dt));
    this.loop.start();

    const game = this;
    (window as unknown as { __THREE_GAME_DIAGNOSTICS__: unknown }).__THREE_GAME_DIAGNOSTICS__ = {
      renderer: this.renderer.info,
      debug: {
        look: (yaw: number, pitch: number) => { game.yaw = yaw; game.pitch = pitch; },
        teleport: (x: number, z: number, y = 0) => { game.physics.setPlayerPosition(x, y + 0.9, z); },
        weapon: (id: WeaponId) => game.setWeapon(id),
        ignite: (x: number, y: number, z: number, r: number) => game.fire.igniteAround(x, y, z, r, 1),
      },
      get state() {
        return {
          weapon: game.weapon.id,
          score: game.score,
          voxels: game.grid.size,
          instances: game.voxels.instanceCount,
          chunks: game.voxels.chunkCount,
          pendingChunks: game.voxels.pendingChunks,
          player: game.player.position(),
          timings: { ...game.timings },
          hook: game.hook.active,
          lastHit: game.lastHit,
          fire: game.fire.count,
          physics: game.physics.diagnostics(),
        };
      },
    };
  }

  static async boot(root: HTMLElement): Promise<Game> {
    const physics = await PhysicsSim.create();
    const game = new Game(root, physics);
    await game.viewmodel.loadGenerated();
    game.bombTemplate = game.viewmodel.cloneForWorld('bomb');
    return game;
  }

  // ------------------------------------------------------------ world

  private setupWorld(): void {
    this.physics.rebuild(this.grid);
    this.voxels.rebuild(this.grid, this.physics);
    this.structures = TOWN.map(() => ({ initial: 0, alive: 0, remaining: 0, collapsed: false }));
    this.lanternVoxels = [];
    this.lanternSmooth.clear();
    this.windmillVoxel = null;
    this.wagonVoxel = null;
    for (const v of this.grid.values()) {
      if (v.s >= 0) {
        this.structures[v.s].initial += 1;
        this.structures[v.s].alive += 1;
        this.structures[v.s].remaining += 1;
      }
      if (v.mat === 'lantern') this.lanternVoxels.push(v);
      if (!this.windmillVoxel && v.group === 'spin:windmill' && v.mat === 'steel') this.windmillVoxel = v;
      if (!this.wagonVoxel && v.group === 'loose:wagon') this.wagonVoxel = v;
    }
    this.player.spawn(SPAWN.x, SPAWN.z);
    this.yaw = 0;
    this.pitch = 0;
    this.collapsedCount = 0;
    this.shots = 0;
    this.fire.setGrid(this.grid);
    this.ammo.clear();
    for (const w of WEAPONS) this.ammo.set(w.id, initialAmmo(w));
    this.detachHook();
    this.bellVoxel = null;
    for (const v of this.grid.values()) if (v.group === 'hang:bell' && v.mat === 'bronze') { this.bellVoxel = v; break; }
    this.setupPickups();
    this.contractTime = 0;
    this.contractDone = false;
    this.targets.clear();
    this.tumbleVoxels = [];
    const seen = new Set<string>();
    for (const v of this.grid.values()) {
      if (v.group.startsWith('target:')) {
        let t = this.targets.get(v.group);
        if (!t) {
          t = { spec: [], phase: Math.random() * 6, up: true, respawn: 0, hits: 0 };
          this.targets.set(v.group, t);
        }
        t.spec.push({ ix: v.ix, iy: v.iy, iz: v.iz, mat: v.mat, s: v.s });
      }
      if (v.group.startsWith('loose:tumble-') && !seen.has(v.group)) { seen.add(v.group); this.tumbleVoxels.push(v); }
    }
  }

  /** Alvos sobem e descem; ao serem atingidos caem e voltam depois. */
  private updateTargets(dt: number): void {
    for (const [group, t] of this.targets) {
      if (t.respawn > 0) {
        t.respawn -= dt;
        if (t.respawn <= 0) {
          const voxels = this.physics.restoreGroup(this.grid, group, t.spec);
          this.voxels.changed(voxels);
          const v0 = voxels[0];
          if (v0) this.audio.play('target-up', 0.5, { x: v0.ix * VOXEL_SIZE, y: 1, z: v0.iz * VOXEL_SIZE });
          t.up = true;
          t.phase = 0;
        }
        continue;
      }
      t.phase += dt;
      const period = 5 + (t.hits % 3);
      const k = (t.phase % period) / period;
      // 70% do tempo de pé, desce e sobe rápido (0,25 s cada).
      let off = 0;
      if (k > 0.7 && k < 0.75) off = -((k - 0.7) / 0.05) * 1.75;
      else if (k >= 0.75 && k < 0.95) off = -1.75;
      else if (k >= 0.95) off = -(1 - (k - 0.95) / 0.05) * 1.75;
      this.physics.setTargetOffset(group, off);
    }
  }

  private onTargetHit(group: string, at: { x: number; y: number; z: number }): void {
    const t = this.targets.get(group);
    if (!t || t.respawn > 0) return;
    t.respawn = 6;
    t.hits += 1;
    this.score += 50;
    this.audio.play('target-hit', 0.8, at);
    this.showToast('Alvo! +50');
    this.dust.burst(at.x, at.y, at.z, 20, 0xffd24a, 2, { life: 0.7, bright: 2, gravity: 4 });
    // Derruba o alvo inteiro: remove os voxels que sobraram.
    const rest = new Map<number, Voxel>();
    for (const v of this.grid.values()) if (v.group === group) rest.set(v.id, v);
    this.commitDestroyed(rest, { x: 0, y: 0.5, z: 0 }, 2);
  }

  /** Vento: empurra os tumbleweeds de vez em quando. */
  private updateWind(dt: number): void {
    this.windT -= dt;
    if (this.windT > 0) return;
    this.windT = 1.5 + Math.random() * 2.5;
    for (const v of this.tumbleVoxels) {
      if (this.grid.get(v.ix, v.iy, v.iz) !== v) continue;
      const p = this.physics.poseOf(v);
      if (!p) continue;
      if (Math.hypot(p.x, p.z) > 22) continue;
      const a = 0.6 + Math.random() * 0.8;
      this.physics.applyImpulse(v, { x: Math.cos(a), y: 0.35, z: Math.sin(a) }, 0.9 + Math.random() * 0.8, p);
    }
  }

  private setupPickups(): void {
    for (const p of this.pickups) this.scene.remove(p.mesh);
    this.pickups = [];
    for (const spot of PICKUP_SPOTS) {
      const g = new THREE.Group();
      const box = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.26, 0.26), new THREE.MeshStandardMaterial({ color: 0x6b4a2a, roughness: 0.8 }));
      box.castShadow = true;
      box.position.y = 0.13;
      const band = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.06, 0.28), new THREE.MeshStandardMaterial({ color: 0xffd24a, emissive: 0xffa000, emissiveIntensity: 0.9 }));
      band.position.y = 0.13;
      g.add(box, band);
      g.position.set(spot.x, 0, spot.z);
      this.scene.add(g);
      this.pickups.push({ mesh: g, x: spot.x, z: spot.z, t: 0 });
    }
  }

  get collapsedCountValue(): number {
    return this.collapsedCount;
  }

  integrityOf(id: string): number {
    const i = TOWN.findIndex((t) => t.id === id);
    return i < 0 ? 1 : this.structureIntegrity(i);
  }

  bellFallen(): boolean {
    if (!this.bellVoxel) return true;
    if (this.grid.get(this.bellVoxel.ix, this.bellVoxel.iy, this.bellVoxel.iz) !== this.bellVoxel) return true;
    const p = this.physics.poseOf(this.bellVoxel);
    return !p || p.y < 2.6;
  }

  private reset(): void {
    for (const m of this.scorches) { this.scene.remove(m); m.geometry.dispose(); }
    this.scorches = [];
    this.grid = buildTown();
    this.score = 0;
    this.toast = null;
    this.setupWorld();
    this.syncHud();
  }

  private toggleMode(): void {
    if (this.mode === 'playground') {
      this.mode = 'contract';
      this.contractIdx = 0;
    } else if (this.contractIdx < CONTRACTS.length - 1) {
      this.contractIdx += 1;
    } else {
      this.mode = 'playground';
    }
    this.audio.play('click', 0.5);
    this.reset();
    this.showToast(this.mode === 'contract' ? `Contrato: ${CONTRACTS[this.contractIdx].text}` : 'Modo livre');
  }

  private bestKey(): string {
    return `splinter-best-${this.contractIdx}`;
  }

  private bestTime(): number | null {
    try {
      const v = localStorage.getItem(this.bestKey());
      return v ? Number(v) : null;
    } catch {
      return null;
    }
  }

  private updateContract(dt: number): void {
    if (this.mode !== 'contract' || this.contractDone) return;
    this.contractTime += dt;
    if (CONTRACTS[this.contractIdx].check(this)) {
      this.contractDone = true;
      this.score += 500;
      const best = this.bestTime();
      if (best === null || this.contractTime < best) {
        try { localStorage.setItem(this.bestKey(), String(this.contractTime)); } catch { /* sem storage */ }
        this.showToast(`Contrato cumprido! Novo recorde: ${this.contractTime.toFixed(1)} s`);
      } else {
        this.showToast(`Contrato cumprido em ${this.contractTime.toFixed(1)} s`);
      }
      this.audio.play('coin', 0.8);
    }
  }

  private showToast(text: string): void {
    this.toast = text;
  }

  /** Integridade de uma estrutura: voxels ainda de pé (não caídos). */
  private structureIntegrity(s: number): number {
    const st = this.structures[s];
    if (!st || st.initial === 0) return 0;
    return Math.max(0, st.remaining) / st.initial;
  }

  private villageIntegrity(): number {
    let a = 0;
    let b = 0;
    for (let i = 0; i < TOWN.length; i++) {
      if (!TOWN[i].scored) continue;
      a += Math.max(0, this.structures[i].remaining);
      b += this.structures[i].initial;
    }
    return b === 0 ? 0 : a / b;
  }

  // ------------------------------------------------------------ input

  private setWeapon(id: WeaponId): void {
    this.weapon = weaponById(id);
    this.viewmodel.setWeapon(id);
    this.audio.play('click', 0.5);
    this.syncHud();
  }

  private onKey(e: KeyboardEvent): void {
    if (e.code === 'Escape') {
      this.paused = !this.paused;
      this.syncHud();
      return;
    }
    if (e.code === 'Backspace') this.reset();
    if (e.code === 'KeyT') this.toggleMode();
    if (e.code === 'KeyL') {
      const t = this.sky.nextTime();
      this.showToast(t === 'noon' ? 'Meio-dia' : t === 'dusk' ? 'Entardecer' : 'Noite');
    }
    if (e.code === 'KeyP') this.post.enabled = !this.post.enabled;
    if (e.code === 'KeyM') {
      this.audio.setMuted(!this.audio.muted);
      this.syncHud();
    }
    const slot = Number(e.key);
    const w = weaponBySlot(slot);
    if (w) this.setWeapon(w.id);
  }

  private resize(): void {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.camera.aspect = w / Math.max(1, h);
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.post.setSize(w, h);
  }

  // ------------------------------------------------------------ loop

  private update(dtRaw: number): void {
    const t0 = performance.now();
    this.frame += 1;
    let dt = dtRaw;
    if (this.hitStop > 0) {
      this.hitStop -= dtRaw;
      dt = dtRaw * 0.12;
    }
    this.cooldown = Math.max(0, this.cooldown - dt);
    this.muzzle.intensity = Math.max(0, this.muzzle.intensity - dt * 28);

    this.input.pollGamepad(dtRaw);
    if (this.input.padSlotDelta !== 0) {
      const n = WEAPONS.length;
      const i = (WEAPONS.findIndex((w) => w.id === this.weapon.id) + this.input.padSlotDelta + n) % n;
      this.input.padSlotDelta = 0;
      this.setWeapon(WEAPONS[i].id);
    }
    const look = this.input.consumeLook();
    const sens = this.hud.isTouch && !this.input.locked ? TOUCH_SENS : SENS;
    if (!this.paused) {
      this.yaw -= look.dx * sens;
      this.pitch -= look.dy * sens;
      this.pitch = Math.max(-1.35, Math.min(1.35, this.pitch));
    }
    // sway da arma pelo giro
    this.swayX += (-look.dx * 0.0006 - this.swayX) * Math.min(1, dt * 10);
    this.swayY += (look.dy * 0.0005 - this.swayY) * Math.min(1, dt * 10);

    if (!this.paused) {
      const mv = this.input.move();
      this.player.update(dt, this.yaw, {
        x: mv.x, z: mv.z, run: this.input.run, crouch: this.input.crouch, jump: this.input.consumeJump(),
      }, () => this.physics.groundUnderPlayer());
      this.updateWeaponState(dt);
      if (this.input.consumeReload()) this.startReload();
      if (this.input.consumeInteract()) this.interact();
      if (this.input.consumeAlt()) this.detonate();
      this.updateHook(dt);
      this.updatePickups(dt);
      this.updateContract(dt);
      this.updateTargets(dt);
      this.updateWind(dt);
    } else {
      this.input.consumeJump();
      this.input.consumeReload();
      this.input.consumeInteract();
      this.input.consumeAlt();
    }

    const eye = this.player.eye();
    this.shake = Math.max(0, this.shake - dt * 2.2);
    const sh = this.shake * this.shake;
    this.shakeVec.set((Math.random() - 0.5) * sh * 0.12, (Math.random() - 0.5) * sh * 0.1, 0);
    this.recoilPitch += (0 - this.recoilPitch) * Math.min(1, dt * 9);
    this.camera.position.set(eye.x + this.shakeVec.x, eye.y + this.shakeVec.y, eye.z);
    this.camera.quaternion.setFromEuler(new THREE.Euler(this.pitch + this.recoilPitch, this.yaw + this.shakeVec.x * 0.5, eye.roll + this.shakeVec.y * 0.6, 'YXZ'));
    this.camera.getWorldDirection(this.forward);
    this.viewmodel.group.position.x = 0.28 + this.swayX;
    this.viewmodel.group.position.y = -0.26 + this.swayY - (this.player.isCrouched ? 0.02 : 0);
    this.viewmodel.update(dt);
    this.audio.setListener(eye.x, eye.y, eye.z);
    this.muzzle.position.copy(this.camera.position).addScaledVector(this.forward, 0.6);

    if (!this.paused && this.input.isHolding()) this.tryFire();
    else if (!this.weapon.beam || !this.input.firing) this.laserBeam.visible = false;

    const tA = performance.now();
    const { exploded } = this.physics.step(dt);
    const contacts = this.physics.detonateWhere((x, y, z) => this.bombHitsVoxel(x, y, z));
    for (const p of exploded) this.explode(p.x, p.y, p.z);
    for (const p of contacts) this.explode(p.x, p.y, p.z);
    const tB = performance.now();

    if (!this.paused) this.fire.update(dt);
    this.syncFire(dt);
    this.voxels.sync(this.grid, this.physics);
    this.dust.update(dt);
    this.syncLanterns(dt);
    this.syncBombs();
    this.syncAmbientSounds();
    if (this.frame % 3 === 0) this.updateTarget();
    if (this.frame % 5 === 0) this.updatePrompt();
    if (this.frame % 10 === 0) this.updateFallen();
    this.sky.update(dt, eye.x, eye.z);
    this.sky.sunDirection(this.sunDir);
    followShadow(this.sun, eye.x, eye.z, this.sunDir);
    this.explosionLight.intensity = Math.max(0, this.explosionLight.intensity - dt * 60);
    this.syncFuses();
    this.syncHud();
    const tC = performance.now();
    if (this.post.enabled) this.post.render(dt);
    else this.renderer.render(this.scene, this.camera);
    const tD = performance.now();
    this.timings.physics = tB - tA;
    this.timings.sync = tC - tB;
    this.timings.render = tD - tC;
    this.timings.total = tD - t0;
  }

  /** Voxels em pedaços caídos não contam como "de pé". */
  private updateFallen(): void {
    const fallen = new Array<number>(TOWN.length).fill(0);
    for (const v of this.physics.dynamicVoxels()) {
      const b = this.physics.bindingOf(v);
      if (b && b.kind === 'structure' && v.s >= 0) fallen[v.s] += 1;
    }
    for (let i = 0; i < TOWN.length; i++) {
      const st = this.structures[i];
      st.remaining = st.alive - fallen[i];
      if (!st.collapsed && TOWN[i].scored && st.initial > 0 && st.remaining / st.initial < COLLAPSE_AT) {
        st.collapsed = true;
        this.collapsedCount += 1;
        this.score += 250;
        this.audio.play('collapse', 0.9, { x: TOWN[i].x, y: 1, z: TOWN[i].z });
        this.shake = Math.max(this.shake, 0.6);
        this.showToast(`${TOWN[i].name} caiu! +250`);

      }
    }
  }

  private updateTarget(): void {
    const origin = this.camera.position;
    const hit = voxelRaycast(this.grid, origin, this.forward, 40, VOXEL_SIZE, (v) => !this.physics.isDynamic(v));
    if (hit && hit.voxel.s >= 0 && TOWN[hit.voxel.s].scored) {
      const s = hit.voxel.s;
      this.target = { name: TOWN[s].name, integrity: this.structureIntegrity(s) };
    } else {
      this.target = null;
    }
  }

  private syncAmbientSounds(): void {
    if (this.windmillVoxel) {
      const b = this.physics.bindingOf(this.windmillVoxel);
      const spinning = b && b.dynamic && Math.hypot(b.body.angvel().x, b.body.angvel().y, b.body.angvel().z) > 0.3;
      this.audio.setCreak(spinning ? this.physics.poseOf(this.windmillVoxel) : null);
    }
    if (this.wagonVoxel && this.frame % 20 === 0) {
      const b = this.physics.bindingOf(this.wagonVoxel);
      if (b && b.dynamic) {
        const v = b.body.linvel();
        const speed = Math.hypot(v.x, v.z);
        const now = performance.now();
        if (speed > 0.8 && now - this.wagonSoundAt > 1800) {
          this.wagonSoundAt = now;
          this.audio.play('wagon', Math.min(0.8, speed * 0.25), this.physics.poseOf(this.wagonVoxel) ?? undefined);
        }
      }
    }
  }

  // ------------------------------------------------------------ fire

  private raycast(origin: THREE.Vector3, dir: { x: number; y: number; z: number }, range: number): RayHit | null {
    const a = voxelRaycast(this.grid, origin, dir, range, VOXEL_SIZE, (v) => !this.physics.isDynamic(v));
    const reach = a ? a.dist : range;
    const b = voxelRaycastWorld(this.physics.dynamicVoxelsOnRay(origin, dir, reach), origin, dir, reach, VOXEL_SIZE, (v) => this.physics.poseOf(v));
    if (a && b) return b.dist < a.dist ? b : a;
    return a ?? b;
  }

  private tryFire(): void {
    if (this.cooldown > 0) return;
    if (!this.input.isHolding()) return;
    const w = this.weapon;
    const a = this.ammo.get(w.id)!;
    if (w.kind === 'hook') {
      if (this.hook.active) return; // segura o gancho enquanto o botão está preso
      this.input.consumeQueued();
      this.cooldown = w.cooldown;
      this.fireHook();
      return;
    }
    if (w.kind === 'water') {
      this.input.consumeQueued();
      if (a.gauge <= 0) { this.cooldown = 0.3; this.audio.play('empty', 0.4, undefined, 300); return; }
      this.cooldown = w.cooldown;
      a.gauge = Math.max(0, a.gauge - 0.0045);
      this.sprayWater();
      return;
    }
    if (w.kind === 'beam') {
      if (a.reloading > 0) { this.input.consumeQueued(); return; }
      a.gauge = Math.min(1, a.gauge + 0.022);
      if (a.gauge >= 1) { a.reloading = 2.2; this.showToast('Laser superaquecido'); this.input.consumeQueued(); return; }
    } else if (!spend(w, a)) {
      this.input.consumeQueued();
      this.cooldown = 0.25;
      this.audio.play('empty', 0.5, undefined, 200);
      if (canReload(w, a)) this.startReload();
      return;
    }
    this.input.consumeQueued();
    this.cooldown = w.cooldown;
    this.viewmodel.fireKick();
    if (!w.beam) {
      this.recoilPitch += w.id === 'shotgun' ? 0.05 : w.id === 'rifle' ? 0.035 : 0.018;
      this.shake = Math.max(this.shake, w.id === 'shotgun' ? 0.45 : 0.25);
    }
    this.muzzle.intensity = w.id === 'laser' ? 2.2 : 6;
    if (!w.beam || this.frame % 6 === 0) {
      this.audio.play(w.id === 'bullet' ? 'bullet' : w.id === 'rifle' ? 'rifle' : w.id === 'bomb' ? 'bomb' : w.id === 'laser' ? 'laser' : 'shotgun');
    }
    if (!w.beam) this.shots += 1;

    const origin = this.camera.position.clone().addScaledVector(this.forward, 0.55);
    if (w.kind === 'remote') {
      this.physics.spawnBomb(
        { x: origin.x, y: origin.y, z: origin.z },
        { x: this.forward.x * 6.5, y: this.forward.y * 6.5 + 2.4, z: this.forward.z * 6.5 },
        true,
      );
      if (a.mag === 0 && a.reserve === 0) this.showToast('Q ou botão direito: detonar');
      return;
    }
    if (w.throw) {
      this.physics.spawnBomb(
        { x: origin.x, y: origin.y, z: origin.z },
        { x: this.forward.x * 9.2, y: this.forward.y * 9.2 + 3.1, z: this.forward.z * 9.2 },
      );
      return;
    }

    this.laserBeam.visible = w.beam;
    const beamEnd = origin.clone().addScaledVector(this.forward, w.range);
    const tShot = performance.now();
    const destroyed = new Map<number, Voxel>();
    const poseOf = (v: Voxel) => this.physics.poseOf(v);
    let bellHit = false;
    for (let i = 0; i < w.pellets; i++) {
      const dir = spreadDirection({ x: this.forward.x, y: this.forward.y, z: this.forward.z }, w.spread * (this.player.isCrouched ? 0.55 : 1));
      const hit = this.raycast(origin, dir, w.range);
      if (!hit) continue;
      this.lastHit = { mat: hit.voxel.mat, group: hit.voxel.group, dist: hit.dist, dyn: this.physics.isDynamic(hit.voxel), burn: MATERIALS[hit.voxel.mat].burn };
      beamEnd.set(hit.point.x, hit.point.y, hit.point.z);
      this.physics.applyImpulse(hit.voxel, dir, w.impulse, hit.point);
      if (hit.voxel.group === 'hang:bell') bellHit = true;
      if (hit.voxel.group.startsWith('target:')) this.onTargetHit(hit.voxel.group, hit.point);
      let dmg = w.damage;
      if (w.ignites && w.kind === 'beam' && MATERIALS[hit.voxel.mat].burn > 0) {
        // Madeira e feno: o laser só acende; o fogo é que consome.
        this.fire.ignite(hit.voxel, 0.9);
        if (this.frame % 4 === 0) this.fire.igniteAround(hit.point.x, hit.point.y, hit.point.z, VOXEL_SIZE * 1.6, 0.5);
        dmg = 0;
      } else if (MATERIALS[hit.voxel.mat].sound === 'metal' && w.pellets === 1) this.audio.play('metal', 0.4, hit.point, 120);
      for (const v of damageAt(this.grid, hit.point.x, hit.point.y, hit.point.z, w.radius, dmg, VOXEL_SIZE, hit.voxel, this.physics.dynamicVoxelsNear(hit.point, w.radius), poseOf)) {
        destroyed.set(v.id, v);
      }
      this.impactFx(hit.voxel, hit.point, w.beam);
    }
    if (bellHit) this.audio.play('bell', 0.9, beamEnd, 400);
    this.commitDestroyed(destroyed, { x: this.forward.x, y: this.forward.y, z: this.forward.z }, w.impulse);
    if (!w.beam) this.timings.shot = performance.now() - tShot;
    if (w.beam) this.placeBeam(origin, beamEnd);
    else this.laserBeam.visible = false;
  }

  /** Faíscas no aço, cacos no vidro, palha no feno, poeira no resto. */
  private impactFx(v: Voxel, p: { x: number; y: number; z: number }, beam: boolean): void {
    const def = MATERIALS[v.mat];
    if (def.sound === 'metal' || def.sound === 'bell' || def.sound === 'coin') {
      this.dust.burst(p.x, p.y, p.z, beam ? 3 : 10, 0xffd080, 3.2, { life: 0.35, up: 0.6, bright: 2.2, gravity: 6 });
    } else if (def.sound === 'glass') {
      this.dust.burst(p.x, p.y, p.z, beam ? 2 : 14, 0xcfefff, 2.2, { life: 0.8, up: 0.8, bright: 1.6, gravity: 5 });
    } else if (def.sound === 'hay') {
      this.dust.burst(p.x, p.y, p.z, beam ? 2 : 12, 0xe0c060, 1.6, { life: 1.4, up: 1.2, gravity: 1.2 });
    } else {
      this.dust.burst(p.x, p.y, p.z, beam ? 2 : 5, def.color, 0.9);
    }
  }

  /** Pavio: fumaça e fagulhas nas bombas em voo. */
  private syncFuses(): void {
    if (this.frame % 2 !== 0) return;
    for (const b of this.physics.bombPoses()) {
      this.dust.burst(b.x, b.y + 0.12, b.z, 1, 0x555555, 0.3, { life: 0.9, up: 1.2, gravity: -0.6 });
      this.dust.burst(b.x, b.y + 0.12, b.z, 1, 0xffcc60, 0.9, { life: 0.25, up: 0.6, bright: 2.5, gravity: 4 });
    }
  }

  private addScorch(x: number, z: number, r: number): void {
    const m = new THREE.Mesh(new THREE.CircleGeometry(r, 20), this.scorchMat);
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, 0.012 + this.scorches.length * 0.0005, z);
    m.renderOrder = 1;
    this.scene.add(m);
    this.scorches.push(m);
    if (this.scorches.length > 24) {
      const old = this.scorches.shift()!;
      this.scene.remove(old);
      old.geometry.dispose();
    }
  }

  private placeBeam(from: THREE.Vector3, to: THREE.Vector3): void {
    const mid = from.clone().lerp(to, 0.5);
    const dist = from.distanceTo(to);
    this.laserBeam.position.copy(mid);
    this.laserBeam.scale.set(1, dist, 1);
    this.laserBeam.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), to.clone().sub(from).normalize());
    this.laserBeam.visible = true;
  }

  private explode(x: number, y: number, z: number): void {
    const w = weaponById('bomb');
    this.audio.play('bomb', 1, { x, y, z });
    const destroyed = new Map<number, Voxel>();
    for (const v of damageAt(this.grid, x, y, z, w.radius, w.damage, VOXEL_SIZE, undefined, this.physics.dynamicVoxelsNear({ x, y, z }, w.radius), (v) => this.physics.poseOf(v))) {
      destroyed.set(v.id, v);
    }
    // Empurra o que sobrou por perto.
    for (const v of this.physics.dynamicVoxelsNear({ x, y, z }, w.radius * 1.6)) {
      const p = this.physics.poseOf(v);
      if (!p) continue;
      const dx = p.x - x, dy = p.y - y, dz = p.z - z;
      const d = Math.hypot(dx, dy, dz);
      if (d > w.radius * 1.6 || d < 1e-3) continue;
      this.physics.applyImpulse(v, { x: dx / d, y: dy / d + 0.3, z: dz / d }, (w.impulse * 0.08) * (1 - d / (w.radius * 1.6)), p);
    }
    this.fire.igniteAround(x, y, z, w.radius * 0.95, 0.4);
    this.dust.burst(x, y, z, 120, 0xc9b28a, 4.5);
    this.dust.burst(x, y, z, 60, 0xff9a30, 6, { life: 0.4, up: 1.0, bright: 2.4, gravity: 2 });
    this.dust.burst(x, y + 0.3, z, 40, 0x3a3a3a, 1.2, { life: 2.2, up: 1.6, gravity: -0.8 });
    this.explosionLight.position.set(x, y + 0.3, z);
    this.explosionLight.intensity = 30;
    this.post.addFlash(0.5);
    const dPl = Math.hypot(x - this.camera.position.x, y - this.camera.position.y, z - this.camera.position.z);
    this.shake = Math.max(this.shake, Math.min(1, 1.4 / Math.max(1, dPl * 0.35)));
    this.hitStop = 0.07;
    if (y < 0.6) this.addScorch(x, z, 0.9 + Math.random() * 0.3);
    this.commitDestroyed(destroyed, { x: 0, y: 1, z: 0 }, w.impulse);
  }

  private commitDestroyed(
    destroyed: Map<number, Voxel>,
    dir: { x: number; y: number; z: number },
    impulse: number,
    quiet = false,
  ): void {
    if (destroyed.size === 0) return;
    const list = [...destroyed.values()];
    for (const v of list) this.fire.forget(v);
    const sounds = new Map<string, { n: number; at: Voxel }>();
    for (const v of list) {
      this.grid.remove(v);
      const def = MATERIALS[v.mat];
      this.score += def.points;
      if (v.s >= 0) {
        this.structures[v.s].alive -= 1;
        this.structures[v.s].remaining -= 1;
      }
      const s = sounds.get(def.sound);
      if (s) s.n += 1;
      else sounds.set(def.sound, { n: 1, at: v });
      if (v.mat === 'lantern') this.lanternVoxels = this.lanternVoxels.filter((l) => l !== v);
    }
    const { changed, newlyFallen } = this.physics.removeVoxels(list);
    this.voxels.remove(list);
    this.voxels.changed(changed);
    if (newlyFallen > 0) {
      // Reação em cadeia: o que caiu sem tiro direto vale o dobro.
      const bonus = newlyFallen * 2;
      this.score += bonus;
      if (newlyFallen >= 40) this.showToast(`Reação em cadeia! +${bonus}`);
    }
    const first = list[0];
    const p0 = this.physics.poseOf(first) ?? { x: first.ix * VOXEL_SIZE, y: first.iy * VOXEL_SIZE, z: first.iz * VOXEL_SIZE };
    if (quiet) {
      // Cinzas: sem entulho nem som de quebra.
      if (Math.random() < 0.5) this.dust.burst(p0.x, p0.y, p0.z, 3, 0x444444, 0.6, { life: 1.8, up: 1.6, gravity: -0.4 });
      return;
    }
    this.physics.spawnDebrisBatch(list, dir, impulse);
    this.dust.burst(p0.x, p0.y, p0.z, Math.min(60, 6 + list.length * 2), MATERIALS[first.mat].color, 1.6);
    let top: { n: number; at: Voxel; kind: string } | null = null;
    for (const [kind, s] of sounds) if (!top || s.n > top.n) top = { ...s, kind };
    if (top) {
      const at = { x: top.at.ix * VOXEL_SIZE, y: top.at.iy * VOXEL_SIZE, z: top.at.iz * VOXEL_SIZE };
      this.audio.playBreak(top.kind as 'wood', at);
    }
  }

  // ------------------------------------------------------------ armas v3

  private burnOut(voxels: Voxel[]): void {
    const m = new Map<number, Voxel>();
    for (const v of voxels) if (this.grid.get(v.ix, v.iy, v.iz) === v) m.set(v.id, v);
    this.commitDestroyed(m, { x: 0, y: 1, z: 0 }, 0.4, true);
  }

  private startReload(): void {
    const w = this.weapon;
    const a = this.ammo.get(w.id)!;
    if (w.kind === 'beam' || w.kind === 'water' || w.kind === 'hook') return;
    if (!canReload(w, a)) {
      if (a.reserve === 0 && a.mag === 0) this.showToast('Sem munição: procure as caixas douradas');
      return;
    }
    a.reloading = w.reloadTime;
    this.audio.play('reload', 0.6);
  }

  private updateWeaponState(dt: number): void {
    for (const w of WEAPONS) {
      const a = this.ammo.get(w.id)!;
      if (a.reloading > 0) {
        a.reloading -= dt;
        if (a.reloading <= 0) {
          if (w.kind === 'beam') { a.gauge = 0; a.reloading = 0; }
          else finishReload(w, a);
        }
      } else if (w.kind === 'beam' && !(this.weapon.id === w.id && this.input.isHolding())) {
        a.gauge = Math.max(0, a.gauge - dt * 0.4);
      }
    }
    const cur = this.ammo.get(this.weapon.id)!;
    this.viewmodel.reloadT = this.weapon.kind !== 'beam' && cur.reloading > 0 ? 1 - cur.reloading / this.weapon.reloadTime : 0;
    // Spray de água: som contínuo enquanto atira.
    const spraying = this.weapon.kind === 'water' && this.input.isHolding() && cur.gauge > 0 && !this.paused;
    if (spraying !== this.sprayOn) {
      this.sprayOn = spraying;
      this.audio.setLoop('spray', spraying ? 0.35 : 0);
    }
    // Solta o gancho ao largar o botão ou trocar de arma.
    if (this.hook.active && (!this.input.firing || this.weapon.kind !== 'hook')) this.detachHook();
  }

  private sprayWater(): void {
    const w = this.weapon;
    const origin = this.camera.position.clone().addScaledVector(this.forward, 0.5);
    origin.y -= 0.12;
    const dir = spreadDirection({ x: this.forward.x, y: this.forward.y, z: this.forward.z }, w.spread);
    const hit = this.raycast(origin, dir, w.range);
    const end = hit ? hit.point : { x: origin.x + dir.x * w.range, y: origin.y + dir.y * w.range, z: origin.z + dir.z * w.range };
    this.dust.stream(origin.x, origin.y, origin.z, dir.x, dir.y + 0.05, dir.z, 11, 6, 0x7fc8ff, 0.55, 7);
    let put = 0;
    for (let t = 0.25; t <= 1; t += 0.25) {
      put += this.fire.extinguishAround(origin.x + (end.x - origin.x) * t, origin.y + (end.y - origin.y) * t, origin.z + (end.z - origin.z) * t, w.radius);
    }
    if (put > 0) {
      this.audio.play('extinguish', 0.5, end, 250);
      this.dust.burst(end.x, end.y, end.z, put * 2, 0xdddddd, 0.8, { life: 1.2, up: 1.5, gravity: -0.6 });
      this.score += put;
    }
    if (hit) {
      this.physics.applyImpulse(hit.voxel, dir, w.impulse, hit.point);
      if (Math.random() < 0.5) this.dust.burst(hit.point.x, hit.point.y, hit.point.z, 3, 0x9fd8ff, 1.2, { life: 0.5, gravity: 6 });
    }
  }

  private fireHook(): void {
    const w = this.weapon;
    const origin = this.camera.position.clone().addScaledVector(this.forward, 0.4);
    this.audio.play('hook-fire', 0.6);
    this.viewmodel.fireKick();
    const hit = this.raycast(origin, { x: this.forward.x, y: this.forward.y, z: this.forward.z }, w.range);
    if (!hit) return;
    this.hook.active = true;
    this.hook.point.set(hit.point.x, hit.point.y, hit.point.z);
    this.hook.voxel = hit.voxel;
    this.audio.play('hook-hit', 0.7, hit.point);
    if (this.hook.rope) this.hook.rope.visible = true;
  }

  private detachHook(): void {
    this.hook.active = false;
    this.hook.voxel = null;
    if (this.hook.rope) this.hook.rope.visible = false;
  }

  private updateHook(dt: number): void {
    if (!this.hook.active || !this.hook.voxel) return;
    const v = this.hook.voxel;
    if (this.grid.get(v.ix, v.iy, v.iz) !== v) { this.detachHook(); return; }
    const dynamic = this.physics.isDynamic(v);
    if (dynamic) {
      const p = this.physics.poseOf(v);
      if (p) this.hook.point.set(p.x, p.y, p.z);
    }
    const pl = this.player.position();
    const dx = this.hook.point.x - pl.x;
    const dy = this.hook.point.y - (pl.y + 0.6);
    const dz = this.hook.point.z - pl.z;
    const d = Math.hypot(dx, dy, dz);
    if (d < 1.1) { this.detachHook(); return; }
    const nx = dx / d, ny = dy / d, nz = dz / d;
    if (dynamic) {
      // Puxa o objeto para o jogador.
      const b = this.physics.bindingOf(v);
      const mass = b ? Math.max(1, b.voxels.length * 0.02) : 1;
      this.physics.applyImpulse(v, { x: -nx, y: -ny + 0.15, z: -nz }, this.weapon.impulse * dt * 12 * mass, this.hook.point);
    } else {
      // Puxa o jogador para o ponto (com um pouco de elevação para subir).
      const vel = this.player.velocity();
      const along = vel.x * nx + vel.y * ny + vel.z * nz;
      const accel = along < 9 ? 26 * dt : 0;
      this.player.impulse(nx * accel, (ny + 0.25) * accel, nz * accel);
    }
    // Corda: do canto inferior direito da tela até o ponto.
    const rope = this.hook.rope!;
    const from = this.camera.position.clone().add(new THREE.Vector3(0.3, -0.2, 0).applyQuaternion(this.camera.quaternion)).addScaledVector(this.forward, 0.4);
    const mid = from.clone().lerp(this.hook.point, 0.5);
    const len = from.distanceTo(this.hook.point);
    rope.position.copy(mid);
    rope.scale.set(1, len, 1);
    rope.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), this.hook.point.clone().sub(from).normalize());
  }

  private detonate(): void {
    const pts = this.physics.detonateRemote();
    if (pts.length === 0) return;
    this.audio.play('detonator', 0.8);
    for (const p of pts) this.explode(p.x, p.y, p.z);
  }

  private interact(): void {
    const pl = this.player.position();
    if (this.bellVoxel) {
      const p = this.physics.poseOf(this.bellVoxel);
      if (p && Math.hypot(p.x - pl.x, p.y - (pl.y + 0.6), p.z - pl.z) < 2.8) {
        this.physics.applyImpulse(this.bellVoxel, { x: this.forward.x, y: 0.1, z: this.forward.z }, 2.5, p);
        this.audio.play('bell', 0.9, p);
        this.score += 5;
        return;
      }
    }
    if (Math.hypot(this.wellPos.x - pl.x, this.wellPos.z - pl.z) < 2.4) {
      const a = this.ammo.get('water')!;
      a.gauge = 1;
      this.audio.play('pickup', 0.6);
      this.showToast('Tanque de água cheio');
      return;
    }
    // Interagir sem alvo: empurra o que estiver na frente (portas, barris).
    const hit = this.raycast(this.camera.position, { x: this.forward.x, y: this.forward.y, z: this.forward.z }, 2.2);
    if (hit && this.physics.isDynamic(hit.voxel)) {
      this.physics.applyImpulse(hit.voxel, { x: this.forward.x, y: 0, z: this.forward.z }, 4, hit.point);
    }
  }

  private updatePrompt(): void {
    const pl = this.player.position();
    let prompt: string | null = null;
    if (this.bellVoxel) {
      const p = this.physics.poseOf(this.bellVoxel);
      if (p && Math.hypot(p.x - pl.x, p.y - (pl.y + 0.6), p.z - pl.z) < 2.8) prompt = 'E · tocar o sino';
    }
    if (!prompt && Math.hypot(this.wellPos.x - pl.x, this.wellPos.z - pl.z) < 2.4) prompt = 'E · encher o tanque de água';
    if (!prompt && this.weapon.kind === 'remote' && this.physics.remoteCount() > 0) prompt = 'Q · detonar';
    this.prompt = prompt;
  }

  private updatePickups(dt: number): void {
    const pl = this.player.position();
    for (const p of this.pickups) {
      if (p.t > 0) {
        p.t -= dt;
        if (p.t <= 0) p.mesh.visible = true;
        continue;
      }
      p.mesh.rotation.y += dt * 1.2;
      p.mesh.position.y = 0.04 + Math.sin(performance.now() * 0.003 + p.x) * 0.04;
      if (Math.hypot(p.x - pl.x, p.z - pl.z) < 1.1 && Math.abs(pl.y - 0.85) < 1.2) {
        p.t = PICKUP_RESPAWN;
        p.mesh.visible = false;
        for (const w of WEAPONS) {
          if (w.mag === 0) continue;
          const a = this.ammo.get(w.id)!;
          a.reserve = Math.min(w.reserve * 2, a.reserve + Math.ceil(w.reserve * 0.5));
        }
        this.audio.play('pickup', 0.7);
        this.showToast('Munição +50%');
        this.dust.burst(p.x, 0.3, p.z, 16, 0xffd24a, 1.4, { life: 0.8, bright: 2, gravity: 3 });
      }
    }
  }

  private syncFire(dt: number): void {
    const eye = this.camera.position;
    const near = this.fire.nearest(eye.x, eye.y, eye.z, this.fireLights.length);
    for (let i = 0; i < this.fireLights.length; i++) {
      const l = this.fireLights[i];
      const f = near[i];
      if (!f) { l.intensity = 0; continue; }
      l.position.set(f.x, f.y + 0.2, f.z);
      l.intensity = 1.6 + Math.sin(performance.now() * 0.02 + i * 2) * 0.5;
    }
    const n = this.fire.count;
    const d0 = near[0]?.d ?? 99;
    this.audio.setLoop('fire', Math.min(0.9, n * 0.03), n > 0 ? { x: near[0].x, y: near[0].y, z: near[0].z } : null);
    this.post.setHit(n > 0 ? Math.max(0, 0.5 - d0 * 0.16) : 0);
    void dt;
  }

  // ------------------------------------------------------------ visuals

  private syncLanterns(dt: number): void {
    const eye = this.camera.position;
    const pts: { x: number; y: number; z: number; id: number; d: number }[] = [];
    for (const v of this.lanternVoxels) {
      const p = this.physics.poseOf(v);
      if (!p) continue;
      const d = (p.x - eye.x) ** 2 + (p.y - eye.y) ** 2 + (p.z - eye.z) ** 2;
      pts.push({ x: p.x, y: p.y, z: p.z, id: v.id, d });
    }
    pts.sort((a, b) => a.d - b.d);
    const follow = 1 - Math.exp(-10 * dt);
    for (let i = 0; i < this.lanterns.length; i++) {
      const light = this.lanterns[i];
      if (i >= pts.length) {
        light.visible = false;
        continue;
      }
      light.visible = true;
      const t = pts[i];
      let smooth = this.lanternSmooth.get(t.id);
      if (!smooth) {
        smooth = new THREE.Vector3(t.x, t.y, t.z);
        this.lanternSmooth.set(t.id, smooth);
      }
      const jump = Math.hypot(t.x - smooth.x, t.y - smooth.y, t.z - smooth.z);
      if (jump > 1.4) smooth.set(t.x, t.y, t.z);
      else {
        lanternTarget.set(t.x, t.y, t.z);
        smooth.lerp(lanternTarget, follow);
      }
      light.position.copy(smooth);
      light.intensity = (1.15 + Math.sin(performance.now() * 0.012 + t.id) * 0.12) * this.sky.lanternBoost;
    }
  }

  private bombHitsVoxel(x: number, y: number, z: number): boolean {
    const ix = Math.round(x / VOXEL_SIZE);
    const iy = Math.floor(y / VOXEL_SIZE);
    const iz = Math.round(z / VOXEL_SIZE);
    for (let dy = -2; dy <= 2; dy++) {
      for (let dz = -2; dz <= 2; dz++) {
        for (let dx = -2; dx <= 2; dx++) {
          const v = this.grid.get(ix + dx, iy + dy, iz + dz);
          if (v && !this.physics.isDynamic(v)) return true;
        }
      }
    }
    return false;
  }

  private syncBombs(): void {
    const bombs = this.physics.bombPoses();
    while (this.bombVisuals.length < bombs.length) {
      const src = this.bombTemplate ?? this.viewmodel.cloneForWorld('bomb');
      if (!src) break;
      const clone = src.clone(true);
      clone.visible = true;
      this.scene.add(clone);
      this.bombVisuals.push(clone);
      if (!this.bombTemplate) this.bombTemplate = src;
    }
    for (let i = 0; i < this.bombVisuals.length; i++) {
      const mesh = this.bombVisuals[i];
      if (i >= bombs.length) {
        mesh.visible = false;
        continue;
      }
      const p = bombs[i];
      mesh.visible = true;
      mesh.position.set(p.x, p.y, p.z);
      mesh.quaternion.set(p.qx, p.qy, p.qz, p.qw);
    }
  }

  private syncHud(): void {
    const integrity = this.villageIntegrity();
    this.hud.render({
      weapon: this.weapon,
      integrity,
      score: this.score,
      paused: this.paused,
      locked: this.input.locked,
      collapsed: integrity < 0.2,
      muted: this.audio.muted,
      target: this.target,
      toast: this.toast,
      mode: this.mode,
      contract: this.mode === 'contract'
        ? { text: CONTRACTS[this.contractIdx].text, done: this.contractDone, time: this.contractTime, best: this.bestTime() }
        : null,
      ammo: (() => {
        const a = this.ammo.get(this.weapon.id)!;
        return { mag: a.mag, reserve: a.reserve, reloading: a.reloading > 0, gauge: a.gauge, kind: this.weapon.kind, infinite: this.weapon.mag === 0 };
      })(),
      prompt: this.prompt,
      remoteSticks: this.physics.remoteCount(),
      fireCount: this.fire.count,
    });
  }
}
