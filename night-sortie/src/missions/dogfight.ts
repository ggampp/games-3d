import * as THREE from 'three';
import { Mission, type MissionCtx, type MissionDef, type HudExtras, fmtPts } from './mission';
import { Drone, DRONE_INFO } from '../drones/drone';
import { spawnWave } from '../drones/waves';
import { terrainHeight } from '../world/terrain';
import { KT } from '../aircraft/flightModel';
import type { HudFrame } from '../hud/hud';
import { loadBests } from '../settings';

export const DOGFIGHT_DEF: MissionDef = {
  id: 'dogfight', title: 'DOGFIGHT', maxScore: 0, sampleBest: 'BEST 16 048 · WAVE 4',
  blurb: 'Waves of adversary drones. R2 / Space fires training rounds. Get on their tail and put the gun cross on the lead reticle. 3-hit shield.',
  scoring: 'patrol 250 · evader 350 · aggressor 400 · boss 1 500 · chains ×1.5–×3 · wave clear bonus · airborne start 2 000 ft · 350 kt',
  create: () => new Dogfight(),
};

export class Dogfight extends Mission {
  readonly def = DOGFIGHT_DEF;
  airborneStart: boolean | null = true;
  private list: Drone[] = [];
  private wave = 0; private waveTimer = 2; private waveDrones = 0;
  private locked: Drone | null = null;
  private chain = 0; private chainT = 0;
  private lead = new THREE.Vector3(); private hasLead = false; private shoot = false;
  private lastRam = 0;
  private bestScore = 0; private bestWave = 0;
  private banner = '';

  start(ctx: MissionCtx) {
    const b = loadBests()['dogfight']; this.bestScore = b?.score ?? 0; this.bestWave = b?.wave ?? 0;
    if (!ctx.composite) { const x = 0, z = -2500; ctx.fm.spawnAirborne(x, z, terrainHeight(x, z) + 610, 0, 350); }
    this.shield = 3; this.wave = 0; this.waveTimer = 1.5;
  }
  private nextWave(ctx: MissionCtx) {
    this.wave++;
    const fwd = ctx.fm.forward(new THREE.Vector3());
    const ds = spawnWave(this.wave, ctx.fm.s.pos, fwd);
    for (const d of ds) { ctx.scene.add(d.group); this.list.push(d); }
    this.waveDrones = ds.length;
    this.banner = `WAVE ${this.wave}  ·  ${ds.length} DRONES`;
    ctx.hud.showBanner(`WAVE ${this.wave}`, `${ds.length} DRONES`);
    ctx.synth.uiConfirm();
  }
  drones() { return this.list; }
  cycleTarget(dir: number, ctx: MissionCtx) {
    const alive = this.list.filter((d) => d.alive); if (!alive.length) return;
    // sort by range for a stable order
    alive.sort((a, b) => a.pos.distanceTo(ctx.fm.s.pos) - b.pos.distanceTo(ctx.fm.s.pos));
    const i = this.locked ? alive.indexOf(this.locked) : -1;
    this.locked = alive[((i + dir) % alive.length + alive.length) % alive.length];
    ctx.synth.lock(); ctx.haptics.tick();
  }
  clearTarget() { this.locked = null; }
  onDroneHit(d: Drone, killed: boolean, ctx: MissionCtx) {
    ctx.haptics.hit(); ctx.synth.hitSpark();
    if (!killed) return;
    // score: base + closure bonus + chain multiplier
    const base = DRONE_INFO[d.type].pts;
    const rel = d.vel.clone().sub(ctx.fm.s.vel);
    const dir = d.pos.clone().sub(ctx.fm.s.pos).normalize();
    const closureKt = -rel.dot(dir) * KT;
    this.chain = this.chainT > 0 ? Math.min(5, this.chain + 1) : 1; this.chainT = 6;
    const mult = this.chain <= 1 ? 1 : Math.min(3, 1 + this.chain * 0.5);
    let bonus = 0; let bonusText = '';
    if (closureKt > 450) { bonus = 50; bonusText = `HEAD-ON  ·  +${Math.round(closureKt)} KT  ·  +50`; }
    else if (closureKt < 60 && closureKt > -60) { bonus = 30; bonusText = `TRACKING SHOT  ·  +30`; }
    const pts = Math.round(base * mult) + bonus;
    this.score += pts;
    ctx.hud.post(`DRONE DISABLED  ·  +${fmtPts(Math.round(base * mult))}${mult > 1 ? `  ×${mult.toFixed(1)}` : ''}`, 'kill', 2.5);
    if (bonusText) ctx.hud.post(bonusText, 'bonus', 2.5);
    ctx.synth.kill(); ctx.haptics.kill();
    ctx.sparks.burst(d.pos, 60, 45, new THREE.Color(DRONE_INFO[d.type].color), 1.2);
    ctx.sparks.burst(d.pos, 30, 15, new THREE.Color(1, 0.8, 0.5), 0.8);
    if (this.locked === d) this.locked = null;
  }
  update(dt: number, ctx: MissionCtx) {
    this.elapsed += dt;
    if (this.chainT > 0) { this.chainT -= dt; if (this.chainT <= 0) this.chain = 0; }
    const fm = ctx.fm; const p = fm.s.pos;
    const player = { pos: p, vel: fm.s.vel, fwd: ctx.playerFwd };
    for (const d of this.list) d.update(dt, player);
    // remove finished
    for (let i = this.list.length - 1; i >= 0; i--) { const d = this.list[i]; if (!d.alive && d.dying <= 0) { ctx.scene.remove(d.group); this.list.splice(i, 1); } }
    // ramming / near miss
    for (const d of this.list) {
      if (!d.alive || d.rammedCooldown > 0) continue;
      const dist = d.pos.distanceTo(p);
      if (dist < 22 * d.info.scale + 8 && this.elapsed - this.lastRam > 1.5) {
        d.rammedCooldown = 3; this.lastRam = this.elapsed;
        this.shield--; ctx.hud.post(d.type === 'AGGRESSOR' ? 'AGGRESSOR PASS  ·  SHIELD −1' : 'NEAR MISS  ·  SHIELD −1', 'warn', 2.5);
        ctx.synth.shield(); ctx.haptics.kick(1, 0.3);
        // push the drone away
        d.pos.addScaledVector(d.pos.clone().sub(p).normalize(), 40);
        if (this.shield <= 0) { this.finish({ title: 'SHIELD DOWN', score: this.score, wave: this.wave, lines: [`REACHED WAVE ${this.wave}`, `${fmtPts(this.score)} PTS`], failed: true }, ctx); return; }
      }
    }
    const alive = this.list.filter((d) => d.alive);
    if (alive.length === 0 && this.waveTimer <= 0) {
      if (this.wave > 0) { const bonus = 500 * this.wave; this.score += bonus; ctx.hud.post(`WAVE ${this.wave} CLEAR  ·  +${fmtPts(bonus)}`, 'kill', 3); ctx.synth.gate(); }
      this.waveTimer = 3.5;
    }
    if (this.waveTimer > 0) { this.waveTimer -= dt; if (this.waveTimer <= 0 && alive.length === 0) this.nextWave(ctx); }
    // auto-lock nearest if none
    if ((!this.locked || !this.locked.alive) && alive.length) {
      let best: Drone | null = null, bd = Infinity;
      for (const d of alive) { const dd = d.pos.distanceTo(p); if (dd < bd) { bd = dd; best = d; } }
      if (best && best !== this.locked) { this.locked = best; ctx.synth.lock(); ctx.haptics.tick(); }
    }
    // lead computing
    this.hasLead = false; this.shoot = false;
    if (this.locked && this.locked.alive) {
      const d = this.locked; const rel = d.pos.clone().sub(p); const relV = d.vel.clone().sub(fm.s.vel);
      const bs = 1050; let t = rel.length() / bs;
      for (let i = 0; i < 3; i++) { const aim = rel.clone().addScaledVector(relV, t); t = aim.length() / bs; }
      this.lead.copy(p).add(rel).addScaledVector(relV, t); this.hasLead = true;
      const aimDir = this.lead.clone().sub(p).normalize();
      const ang = aimDir.angleTo(ctx.playerFwd);
      this.shoot = ang < THREE.MathUtils.degToRad(1.6) && rel.length() < 1700;
    }
    if (this.score > this.bestScore) this.bestScore = this.score;
    if (this.wave > this.bestWave) this.bestWave = this.wave;
  }
  frame(f: HudFrame, ctx: MissionCtx) {
    const p = ctx.fm.s.pos;
    f.targets = this.list.filter((d) => d.alive).map((d) => {
      const rel = d.pos.clone().sub(p); const dist = rel.length();
      const closure = -d.vel.clone().sub(ctx.fm.s.vel).dot(rel.normalize()) * KT;
      return { world: d.pos, label: d.type, color: '#' + new THREE.Color(DRONE_INFO[d.type].color).getHexString(), rangeKm: dist / 1000, closureKt: closure, locked: d === this.locked };
    });
    if (this.hasLead) { f.lead = this.lead; f.shoot = this.shoot; }
    f.shield = this.shield; f.best = this.bestScore; f.bestWave = this.bestWave || undefined;
  }
  extras(): HudExtras {
    const alive = this.list.filter((d) => d.alive).length;
    return {
      headerA: `WAVE ${this.wave}  ·  ${this.waveDrones} DRONES`, headerB: `${alive} LEFT  ·  ${alive} AIRBORNE${this.chain > 1 ? `  ·  CHAIN ×${Math.min(3, 1 + this.chain * 0.5).toFixed(1)}` : ''}`,
      objective: [], markers: [], showWeapon: true, ticker: this.banner,
    };
  }
  dispose(ctx: MissionCtx) { for (const d of this.list) ctx.scene.remove(d.group); this.list = []; }
  onCrash(ctx: MissionCtx) { this.score -= 500; this.finish({ title: 'CRASHED', score: this.score, wave: this.wave, lines: ['TERRAIN IMPACT  ·  −500', `REACHED WAVE ${this.wave}`], failed: true }, ctx); }
}
