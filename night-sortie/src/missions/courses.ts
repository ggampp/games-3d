import * as THREE from 'three';
import { Mission, type MissionCtx, type MissionDef, type HudExtras, grade, fmtPts, fmtTime } from './mission';
import { Gate, Pylon, Corridor, approachGate } from '../world/course';
import { terrainHeight, RUNWAY_Z0, CORRIDOR_X0, CORRIDOR_Z } from '../world/terrain';
import { KT, FT } from '../aircraft/flightModel';
import { F35 } from '../aircraft/f35';
import { settings } from '../settings';

const GOLD = '#ffd36a', CYAN = '#7ff3ff', GREEN = '#4dff7a';
const flat = (x: number, z: number, agl: number) => new THREE.Vector3(x, terrainHeight(x, z) + agl, z);

function spawnFor(ctx: MissionCtx, m: Mission, x: number, z: number, agl: number, hdg: number, kt: number) {
  if (ctx.composite) return;
  const airborne = m.airborneStart ?? settings.startAirborne;
  if (airborne) ctx.fm.spawnAirborne(x, z, terrainHeight(x, z) + agl, hdg, kt); else ctx.fm.spawnRunway();
}

/* ------------------------------------------------------------------ SLALOM */
export const SLALOM_DEF: MissionDef = {
  id: 'slalom', title: 'SLALOM', maxScore: 1800,
  blurb: 'Fly through the 10 gates in order, alternating left and right of the line.',
  scoring: '+100 per gate · +50 centred · speed bonus with 8+ gates · 1 800 max',
  create: () => new Slalom(),
};
export class Slalom extends Mission {
  readonly def = SLALOM_DEF;
  gates: Gate[] = []; idx = 0; hits = 0; centred = 0; private speedSum = 0; private speedN = 0; private startT = -1; private finishT = 0;
  start(ctx: MissionCtx) {
    for (let i = 0; i < 10; i++) {
      const z = -4200 - i * 560; const x = (i % 2 === 0 ? -1 : 1) * 170;
      const g = new Gate(flat(x, z, 130), 0, 90, 60); this.gates.push(g); ctx.scene.add(g.group);
    }
    this.gates[0].setState('next');
    spawnFor(ctx, this, 0, -2600, 160, 0, 300);
  }
  update(dt: number, ctx: MissionCtx) {
    this.elapsed += dt;
    if (this.done) return;
    if (this.finishT > 0) { this.finishT -= dt; if (this.finishT <= 0) this.end(ctx); return; }
    const g = this.gates[this.idx]; const p = ctx.fm.s.pos;
    if (this.startT >= 0) { this.speedSum += ctx.fm.s.speedKt * dt; this.speedN += dt; }
    const r = g.crossed(ctx.prevPos, p);
    if (r.hit) {
      if (this.startT < 0) this.startT = this.elapsed;
      this.hits++; this.score += 100; let msg = `GATE ${this.idx + 1}  ·  +100`;
      if (r.offset < 0.4) { this.centred++; this.score += 50; msg += '  ·  CENTRED +50'; }
      ctx.hud.post(msg, 'kill'); ctx.synth.gate(); ctx.haptics.tick(); g.setState('done'); this.advance();
    } else if (p.z < g.center.z - 250) { ctx.hud.post(`GATE ${this.idx + 1} MISSED`, 'warn'); ctx.synth.warn(); g.setState('missed'); this.advance(); }
  }
  private advance() { this.idx++; if (this.idx >= this.gates.length) { this.finishT = 1.2; } else this.gates[this.idx].setState('next'); }
  private end(ctx: MissionCtx) {
    const avg = this.speedN > 0 ? this.speedSum / this.speedN : 0;
    let bonus = 0; if (this.hits >= 8) bonus = Math.round(THREE.MathUtils.clamp((avg - 250) * 1.5, 0, 300));
    this.score += bonus;
    this.finish({ title: 'SLALOM COMPLETE', score: this.score, grade: grade(this.score, 1800), lines: [`${this.hits} / 10 GATES  ·  ${this.centred} CENTRED`, `AVG ${Math.round(avg)} KT  ·  SPEED BONUS +${bonus}`, `TIME ${fmtTime(this.elapsed - Math.max(0, this.startT))}`] }, ctx);
  }
  extras(): HudExtras {
    const g = this.gates[Math.min(this.idx, 9)];
    return { headerA: `SLALOM  ·  GATE ${Math.min(this.idx + 1, 10)} / 10`, headerB: `${this.hits} PASSED  ·  ${this.centred} CENTRED`, objective: [`*NEXT GATE ${Math.min(this.idx + 1, 10)}`, 'ALTERNATE LEFT / RIGHT OF THE LINE'], markers: this.idx < 10 ? [{ world: g.center, label: `G${this.idx + 1}`, color: CYAN }] : [], showWeapon: false, ticker: '' };
  }
  dispose(ctx: MissionCtx) { for (const g of this.gates) ctx.scene.remove(g.group); }
}

/* --------------------------------------------------------------- LOW LEVEL */
export const LOWLEVEL_DEF: MissionDef = {
  id: 'lowlevel', title: 'LOW-LEVEL COURSE', maxScore: 1500, sampleBest: 'BEST 850 · C',
  blurb: 'Enter the lit corridor and follow it to the exit frame staying below 300 ft above the ground.',
  scoring: 'time under 300 ft up to +500 · exit +700 · clean exit +100 · speed +200 · each climb above −50 · 1 500 max',
  create: () => new LowLevel(),
};
export class LowLevel extends Mission {
  readonly def = LOWLEVEL_DEF;
  private corr!: Corridor; private entered = false; private tLow = 0; private tTotal = 0; private climbs = 0; private above = false; private speedSum = 0;
  start(ctx: MissionCtx) {
    this.corr = new Corridor(); ctx.scene.add(this.corr.group); this.corr.entry.setState('next');
    spawnFor(ctx, this, CORRIDOR_X0 + 2600, CORRIDOR_Z, 90, 270, 320);
  }
  update(dt: number, ctx: MissionCtx) {
    this.elapsed += dt; if (this.done) return;
    const p = ctx.fm.s.pos;
    if (!this.entered) {
      if (this.corr.entry.crossed(ctx.prevPos, p).hit) { this.entered = true; ctx.hud.post('CORRIDOR ENTRY  ·  STAY BELOW 300 FT', 'kill'); ctx.synth.gate(); this.corr.entry.setState('done'); this.corr.exit.setState('next'); }
      return;
    }
    const agl = ctx.fm.s.radarAltFt;
    this.tTotal += dt; this.speedSum += ctx.fm.s.speedKt * dt;
    if (agl < 300) { this.tLow += dt; this.above = false; }
    else if (!this.above) { this.above = true; this.climbs++; this.score -= 50; ctx.hud.post('ABOVE 300 FT  ·  −50', 'warn'); ctx.synth.warn(); }
    if (this.corr.exit.crossed(ctx.prevPos, p).hit) {
      const low = Math.round(500 * this.tLow / Math.max(this.tTotal, 1)); const avg = this.speedSum / Math.max(this.tTotal, 1);
      const spd = Math.round(THREE.MathUtils.clamp((avg - 300) / 200, 0, 1) * 200);
      const clean = this.climbs === 0 ? 100 : 0;
      this.score += low + 700 + clean + spd; this.corr.exit.setState('done');
      this.finish({ title: 'CORRIDOR EXIT', score: this.score, grade: grade(this.score, 1500), lines: [`UNDER 300 FT ${Math.round(100 * this.tLow / this.tTotal)}%  ·  +${low}`, `EXIT +700  ·  CLEAN ${clean ? '+100' : '—'}  ·  SPEED +${spd}`, `${this.climbs} CLIMBS  ·  −${this.climbs * 50}`] }, ctx);
    }
    // wandered too far off the corridor
    if (Math.abs(p.z - CORRIDOR_Z) > 1500 || p.x < this.corr.exit.center.x - 1500) { this.finish({ title: 'LEFT THE CORRIDOR', score: this.score, grade: 'E', lines: ['COURSE ABANDONED'], failed: true }, ctx); }
  }
  extras(ctx: MissionCtx): HudExtras {
    const agl = ctx.fm.s.radarAltFt;
    return { headerA: 'LOW-LEVEL COURSE', headerB: this.entered ? `UNDER 300 FT ${Math.round(100 * this.tLow / Math.max(this.tTotal, 0.01))}%  ·  ${this.climbs} CLIMBS` : 'ENTER THE CORRIDOR', objective: [this.entered ? '*FOLLOW THE CHEVRONS TO THE EXIT FRAME' : '*ENTER THROUGH THE GREEN FRAME', `RADAR ALT ${Math.round(agl)} FT  ·  LIMIT 300`], markers: [{ world: this.entered ? this.corr.exit.center : this.corr.entry.center, label: this.entered ? 'EXIT' : 'ENTRY', color: GREEN }], showWeapon: false, ticker: '', warn: this.entered && agl >= 300 ? 'ABOVE 300 FT' : undefined };
  }
  dispose(ctx: MissionCtx) { ctx.scene.remove(this.corr.group); }
}

/* ------------------------------------------------------------------ PYLONS */
export const PYLON_DEF: MissionDef = {
  id: 'pylon', title: 'PYLON CHECK', maxScore: 1200,
  blurb: 'Hold each of the six lit pylons inside the sensor circle for 1.2 s from within 3 km. Tab / L1 R1 switch pylon.',
  scoring: '+150 per pylon · speed bonus for all six · 1 200 max',
  create: () => new PylonCheck(),
};
export class PylonCheck extends Mission {
  readonly def = PYLON_DEF;
  pylons: Pylon[] = []; sel = 0; hold = 0; doneN = 0; private startT = -1;
  start(ctx: MissionCtx) {
    const spots: Array<[number, number]> = [[1800, -3600], [3600, -5200], [5400, -3900], [6200, -6600], [3200, -7800], [1200, -6200]];
    for (const [x, z] of spots) { const p = new Pylon(x, z); this.pylons.push(p); ctx.scene.add(p.group); }
    this.pylons[0].setState('sel');
    spawnFor(ctx, this, 600, -1400, 400, 20, 300);
  }
  cycleTarget(dir: number, ctx: MissionCtx) {
    const open = this.pylons.map((_, i) => i).filter((i) => !this.pylons[i].done); if (!open.length) return;
    const k = open.indexOf(this.sel); this.pylons[this.sel].setState(this.pylons[this.sel].done ? 'done' : 'idle');
    this.sel = open[((k + dir) % open.length + open.length) % open.length]; this.pylons[this.sel].setState('sel'); this.hold = 0; ctx.synth.lock(); ctx.haptics.tick();
  }
  update(dt: number, ctx: MissionCtx) {
    this.elapsed += dt; if (this.done) return;
    for (const p of this.pylons) p.update(this.elapsed);
    const py = this.pylons[this.sel]; if (py.done) return;
    const rel = py.top.clone().sub(ctx.fm.s.pos); const dist = rel.length();
    const ang = rel.normalize().angleTo(ctx.playerFwd);
    if (dist < 3000 && ang < THREE.MathUtils.degToRad(5)) {
      if (this.startT < 0) this.startT = this.elapsed;
      this.hold += dt;
      if (this.hold >= 1.2) {
        py.done = true; py.setState('done'); this.doneN++; this.score += 150; this.hold = 0;
        ctx.hud.post(`PYLON ${this.sel + 1} CONFIRMED  ·  +150`, 'kill'); ctx.synth.gate(); ctx.haptics.tick();
        if (this.doneN === 6) {
          const t = this.elapsed - this.startT; const bonus = Math.round(300 * THREE.MathUtils.clamp(1 - (t - 75) / 120, 0, 1)); this.score += bonus;
          this.finish({ title: 'ALL PYLONS CONFIRMED', score: this.score, grade: grade(this.score, 1200), lines: [`6 / 6 PYLONS  ·  +900`, `TIME ${fmtTime(t)}  ·  SPEED BONUS +${bonus}`] }, ctx);
        } else this.cycleTarget(1, ctx);
      }
    } else this.hold = Math.max(0, this.hold - dt * 2);
  }
  frame(f: import('../hud/hud').HudFrame, ctx: MissionCtx) {
    this.pylons.forEach((p, i) => { if (p.done) return; const dist = p.top.distanceTo(ctx.fm.s.pos); f.targets.push({ world: p.top, label: `PYLON ${i + 1}${i === this.sel && this.hold > 0 ? `  ${(this.hold / 1.2 * 100).toFixed(0)}%` : ''}`, color: i === this.sel ? '#ffffff' : GOLD, rangeKm: dist / 1000, closureKt: -ctx.fm.s.vel.dot(p.top.clone().sub(ctx.fm.s.pos).normalize()) * KT * -1, locked: i === this.sel }); });
  }
  extras(): HudExtras {
    return { headerA: `PYLON CHECK  ·  ${this.doneN} / 6`, headerB: `PYLON ${this.sel + 1}  ·  HOLD ${(this.hold).toFixed(1)} / 1.2 S`, objective: ['*PUT THE SENSOR CIRCLE ON THE PYLON', 'WITHIN 3 KM · HOLD 1.2 S', 'TAB / L1 R1 SWITCH PYLON'], markers: [], showWeapon: false, ticker: '' };
  }
  dispose(ctx: MissionCtx) { for (const p of this.pylons) ctx.scene.remove(p.group); }
}

/* --------------------------------------------------------------- FORMATION */
export const FORMATION_DEF: MissionDef = {
  id: 'formation', title: 'FORMATION HOLD', maxScore: 1200,
  blurb: 'Join the pace aircraft and hold the formation box off its right wing, speed matched, for 6 s in total.',
  scoring: '+800 for the hold · speed bonus up to +400 · wake hits −50 · 1 200 max',
  create: () => new Formation(),
};
export class Formation extends Mission {
  readonly def = FORMATION_DEF;
  private pace!: F35; private pacePos = new THREE.Vector3(); private paceVel = new THREE.Vector3(); private paceQ = new THREE.Quaternion();
  private box = new THREE.Group(); private boxWorld = new THREE.Vector3(); private held = 0; private inBox = false; private wakeHits = 0; private wakeCd = 0; private joinedT = -1;
  private paceSpeed = 250 / KT; private wp = 0;
  start(ctx: MissionCtx) {
    this.pace = new F35(); ctx.scene.add(this.pace.group);
    this.pacePos.set(1500, 900, -2500); this.paceVel.set(0, 0, -this.paceSpeed);
    const m = new THREE.MeshBasicMaterial({ color: new THREE.Color(0x7ff3ff).multiplyScalar(2), toneMapped: false, transparent: true, opacity: 0.35, wireframe: true });
    this.box.add(new THREE.Mesh(new THREE.BoxGeometry(24, 14, 30), m)); ctx.scene.add(this.box);
    spawnFor(ctx, this, 1300, -1000, 850, 0, 280);
  }
  private updatePace(dt: number) {
    const corners = [new THREE.Vector3(2500, 900, -7000), new THREE.Vector3(-1500, 950, -8000), new THREE.Vector3(-2500, 900, -3000), new THREE.Vector3(1500, 950, -2000)];
    const c = corners[this.wp % 4]; if (c.clone().sub(this.pacePos).length() < 500) this.wp++;
    const desired = c.clone().sub(this.pacePos).normalize(); const cur = this.paceVel.clone().normalize();
    const ang = cur.angleTo(desired); if (ang > 1e-4) cur.applyAxisAngle(cur.clone().cross(desired).normalize(), Math.min(ang, 0.18 * dt));
    this.paceVel.copy(cur).multiplyScalar(this.paceSpeed); this.pacePos.addScaledVector(this.paceVel, dt);
    // attitude: yaw from velocity, bank into turns
    const yaw = Math.atan2(-cur.x, -cur.z); const bank = -ang * 8;
    this.paceQ.setFromEuler(new THREE.Euler(Math.asin(cur.y), yaw, THREE.MathUtils.clamp(bank, -0.6, 0.6), 'YXZ'));
    this.pace.group.position.copy(this.pacePos); this.pace.group.quaternion.copy(this.paceQ);
    this.pace.update(dt, { ...({} as import('../aircraft/flightModel').FlightState), gearPos: 0, flapPos: 0, ctrl: { pitch: 0, roll: bank, yaw: 0 }, n2: 0.85, abLevel: 0, radarAltFt: 3000 });
    const off = new THREE.Vector3(38, -3, 16).applyQuaternion(this.paceQ);
    this.boxWorld.copy(this.pacePos).add(off); this.box.position.copy(this.boxWorld); this.box.quaternion.copy(this.paceQ);
  }
  update(dt: number, ctx: MissionCtx) {
    this.elapsed += dt; if (this.done) return;
    this.updatePace(dt);
    const p = ctx.fm.s.pos; const dist = p.distanceTo(this.boxWorld);
    const spdDiff = Math.abs(ctx.fm.s.speedKt - 250);
    this.inBox = dist < 16 && spdDiff < 30;
    if (this.inBox) { if (this.joinedT < 0) this.joinedT = this.elapsed; this.held += dt; if (Math.floor(this.held) !== Math.floor(this.held - dt)) ctx.haptics.tick(); }
    // wake: close behind the pace aircraft
    const rel = p.clone().sub(this.pacePos); const behind = rel.dot(this.paceVel.clone().normalize());
    const lateral = rel.clone().sub(this.paceVel.clone().normalize().multiplyScalar(behind)).length();
    if (this.wakeCd > 0) this.wakeCd -= dt;
    if (behind > 5 && behind < 120 && lateral < 8 && this.wakeCd <= 0) { this.wakeCd = 2; this.wakeHits++; this.score -= 50; ctx.hud.post('WAKE TURBULENCE  ·  −50', 'warn'); ctx.haptics.kick(0.8, 0.3); ctx.synth.warn(); }
    if (this.held >= 6) {
      const t = this.elapsed; const bonus = Math.round(400 * THREE.MathUtils.clamp(1 - (t - 60) / 120, 0, 1));
      this.score += 800 + bonus;
      this.finish({ title: 'FORMATION HELD', score: this.score, grade: grade(this.score, 1200), lines: ['HOLD 6.0 S  ·  +800', `SPEED BONUS +${bonus}`, `${this.wakeHits} WAKE HITS  ·  −${this.wakeHits * 50}`] }, ctx);
    }
  }
  extras(ctx: MissionCtx): HudExtras {
    const dist = ctx.fm.s.pos.distanceTo(this.boxWorld);
    return { headerA: 'FORMATION HOLD', headerB: `HELD ${this.held.toFixed(1)} / 6.0 S${this.inBox ? '  ·  IN THE BOX' : ''}`, objective: ['*JOIN OFF THE RIGHT WING', `BOX ${dist < 1000 ? Math.round(dist) + ' M' : (dist / 1000).toFixed(1) + ' KM'}  ·  PACE 250 KT`, `${this.wakeHits} WAKE HITS`], markers: [{ world: this.boxWorld, label: 'BOX', color: this.inBox ? GREEN : CYAN }, { world: this.pacePos, label: 'PACE', color: GOLD }], showWeapon: false, ticker: '' };
  }
  dispose(ctx: MissionCtx) { ctx.scene.remove(this.pace.group, this.box); }
}

/* ------------------------------------------------------------------- SPEED */
export const SPEED_DEF: MissionDef = {
  id: 'speed', title: 'SPEED SECTION', maxScore: 1200,
  blurb: 'Through the entry gate, then full afterburner: pass the exit gate 4.5 km on at 600 kt or more.',
  scoring: '+800 at ≥ 600 kt · +4 per knot over · slower exits score a fraction · 1 200 max',
  create: () => new SpeedSection(),
};
export class SpeedSection extends Mission {
  readonly def = SPEED_DEF;
  private entry!: Gate; private exit!: Gate; private entered = false; private tEntry = 0;
  start(ctx: MissionCtx) {
    this.entry = new Gate(flat(3000, -2600, 300), 0, 120, 80); this.exit = new Gate(flat(3000, -7100, 300), 0, 120, 80);
    ctx.scene.add(this.entry.group, this.exit.group); this.entry.setState('next');
    spawnFor(ctx, this, 3000, -600, 320, 0, 330);
  }
  update(dt: number, ctx: MissionCtx) {
    this.elapsed += dt; if (this.done) return;
    const p = ctx.fm.s.pos;
    if (!this.entered) { if (this.entry.crossed(ctx.prevPos, p).hit) { this.entered = true; this.tEntry = this.elapsed; this.entry.setState('done'); this.exit.setState('next'); ctx.hud.post('ENTRY GATE  ·  FULL AFTERBURNER', 'kill'); ctx.synth.gate(); } return; }
    if (this.exit.crossed(ctx.prevPos, p).hit) {
      const kt = ctx.fm.s.speedKt; let pts: number;
      if (kt >= 600) pts = Math.min(1200, 800 + Math.round((kt - 600) * 4)); else pts = Math.round(800 * Math.pow(kt / 600, 3));
      this.score += pts; this.exit.setState('done');
      this.finish({ title: 'SPEED SECTION', score: this.score, grade: grade(this.score, 1200), lines: [`EXIT ${Math.round(kt)} KT  ·  +${pts}`, `SECTION TIME ${fmtTime(this.elapsed - this.tEntry)}`] }, ctx);
    }
    if (p.z < this.exit.center.z - 400) this.finish({ title: 'EXIT GATE MISSED', score: this.score, grade: 'E', lines: ['PASS THE EXIT FRAME'], failed: true }, ctx);
  }
  extras(ctx: MissionCtx): HudExtras {
    return { headerA: 'SPEED SECTION', headerB: this.entered ? `${Math.round(ctx.fm.s.speedKt)} KT  ·  TARGET 600` : 'ENTRY GATE', objective: [this.entered ? '*EXIT GATE 4.5 KM  ·  ≥ 600 KT' : '*THROUGH THE ENTRY GATE'], markers: [{ world: this.entered ? this.exit.center : this.entry.center, label: this.entered ? 'EXIT' : 'ENTRY', color: CYAN }], showWeapon: false, ticker: '' };
  }
  dispose(ctx: MissionCtx) { ctx.scene.remove(this.entry.group, this.exit.group); }
}

/* ----------------------------------------------------------------- LANDING */
export const LANDING_DEF: MissionDef = {
  id: 'landing', title: 'LANDING CHALLENGE', maxScore: 1000, sampleBest: 'BEST 40 · E',
  blurb: 'From 3 km out on final: through the approach gate, gear and flaps, land on runway 36 and stop.',
  scoring: 'graded on sink rate 50% · centreline 30% · speed 20% · 1 000 max',
  create: () => new Landing(),
};
export class Landing extends Mission {
  readonly def = LANDING_DEF;
  private gate!: Gate; gatePassed = false; private touched = false; private stopT = 0;
  airborneStart: boolean | null = true;
  start(ctx: MissionCtx) {
    this.gate = approachGate(); ctx.scene.add(this.gate.group); this.gate.setState('next');
    if (!ctx.composite) { const z = RUNWAY_Z0 + 3900; ctx.fm.spawnAirborne(0, z, Math.tan(THREE.MathUtils.degToRad(3)) * (z - RUNWAY_Z0) + 25, 0, 210); ctx.fm.s.throttle = 0.45; }
  }
  update(dt: number, ctx: MissionCtx) {
    this.elapsed += dt; if (this.done) return;
    const s = ctx.fm.s;
    if (!this.gatePassed && this.gate.crossed(ctx.prevPos, s.pos).hit) { this.gatePassed = true; this.gate.setState('done'); ctx.hud.post('APPROACH GATE  ·  GEAR DOWN · FLAPS', 'kill'); ctx.synth.gate(); }
    if (!this.touched && s.onGround && ctx.fm.everAirborne && s.landedStats) { this.touched = true; ctx.synth.touchdown(); ctx.haptics.kick(0.6, 0.2); ctx.hud.post(`TOUCHDOWN  ·  ${Math.round(s.landedStats.sinkFpm)} FPM  ·  ${Math.round(s.landedStats.speedKt)} KT`, 'kill', 4); }
    if (this.touched && s.speedKt < 3) { this.stopT += dt; if (this.stopT > 0.8) this.gradeIt(ctx); }
  }
  private gradeIt(ctx: MissionCtx) {
    const st = ctx.fm.s.landedStats!;
    const sink = THREE.MathUtils.clamp(1 - (st.sinkFpm - 150) / 750, 0, 1);
    const centre = THREE.MathUtils.clamp(1 - st.offCentre / 14, 0, 1);
    const spd = THREE.MathUtils.clamp(1 - Math.abs(st.speedKt - 145) / 45, 0, 1);
    let pts = Math.round(1000 * (sink * 0.5 + centre * 0.3 + spd * 0.2));
    if (!this.gatePassed) pts = Math.round(pts * 0.7);
    if (!ctx.fm.onRunway) pts = Math.round(pts * 0.3);
    this.score += pts;
    this.finish({ title: 'LANDED · RUNWAY 36', score: this.score, grade: grade(pts, 1000), lines: [`SINK ${Math.round(st.sinkFpm)} FPM  ·  ${Math.round(sink * 100)}%`, `CENTRELINE ${st.offCentre.toFixed(1)} M  ·  ${Math.round(centre * 100)}%`, `SPEED ${Math.round(st.speedKt)} KT  ·  ${Math.round(spd * 100)}%`, this.gatePassed ? 'APPROACH GATE ✓' : 'APPROACH GATE MISSED  ·  ×0.7'] }, ctx);
  }
  extras(ctx: MissionCtx): HudExtras {
    const s = ctx.fm.s; const distThr = s.pos.z - RUNWAY_Z0 > 0 ? (s.pos.z - RUNWAY_Z0) / 1000 : 0;
    const gs = distThr > 0 ? THREE.MathUtils.radToDeg(Math.atan2(s.pos.y - 2, (s.pos.z - RUNWAY_Z0))) : 0;
    return { headerA: 'LANDING CHALLENGE  ·  RWY 36', headerB: this.touched ? 'ROLL OUT  ·  BRAKES' : `${distThr.toFixed(1)} KM  ·  GS ${gs.toFixed(1)}°`, objective: [this.gatePassed ? '*GEAR DOWN  ·  FLAPS  ·  3° GLIDESLOPE' : '*THROUGH THE APPROACH GATE', 'TOUCH DOWN ~145 KT  ·  STOP ON THE RUNWAY', `${s.gearPos > 0.97 ? 'GEAR ✓' : 'GEAR UP'}  ·  ${s.flapsDown ? 'FLAPS ✓' : 'FLAPS UP'}`], markers: this.gatePassed ? [{ world: new THREE.Vector3(0, 3, RUNWAY_Z0 - 300), label: 'TDZ', color: GOLD }] : [{ world: this.gate.center, label: 'APP', color: GOLD }], showWeapon: false, ticker: '' };
  }
  dispose(ctx: MissionCtx) { ctx.scene.remove(this.gate.group); }
}

/* ------------------------------------------------------------- FREE FLIGHT */
export const FREE_DEF: MissionDef = {
  id: 'free', title: 'FREE FLIGHT', maxScore: 0,
  blurb: 'Runway start, no objectives, no clock. Explore the course lights and the hills.',
  scoring: 'no scoring · Esc / Options for the menu',
  create: () => new FreeFlight(),
};
export class FreeFlight extends Mission {
  readonly def = FREE_DEF;
  private objs: THREE.Object3D[] = [];
  start(ctx: MissionCtx) {
    const corr = new Corridor(); ctx.scene.add(corr.group); this.objs.push(corr.group);
    const ag = approachGate(); ctx.scene.add(ag.group); this.objs.push(ag.group);
    for (let i = 0; i < 10; i++) { const g = new Gate(flat((i % 2 === 0 ? -1 : 1) * 170, -4200 - i * 560, 130), 0); ctx.scene.add(g.group); this.objs.push(g.group); }
    for (const [x, z] of [[1800, -3600], [3600, -5200], [5400, -3900], [6200, -6600], [3200, -7800], [1200, -6200]]) { const p = new Pylon(x, z); ctx.scene.add(p.group); this.objs.push(p.group); }
    spawnFor(ctx, this, 0, -1000, 500, 0, 300);
  }
  update(dt: number) { this.elapsed += dt; }
  extras(ctx: MissionCtx): HudExtras { return { headerA: 'FREE FLIGHT', headerB: `${fmtTime(this.elapsed)}  ·  ${Math.round(ctx.fm.s.altFt * 0 + ctx.fm.s.radarAltFt * FT / FT)} FT AGL`, objective: [], markers: [], showWeapon: false, ticker: '' }; }
  dispose(ctx: MissionCtx) { for (const o of this.objs) ctx.scene.remove(o); }
  onCrash(ctx: MissionCtx) { this.finish({ title: 'CRASHED', score: 0, lines: ['TERRAIN IMPACT'], failed: true }, ctx); }
}

/* ------------------------------------------------------------- FULL SORTIE */
export const FULL_DEF: MissionDef = {
  id: 'full', title: 'FULL SORTIE', maxScore: 8000,
  blurb: 'Take off from runway 36, fly the 9-gate route through the hills, then all five challenges in sequence, return through the approach gate and land.',
  scoring: '+100 per gate · challenge points · landing grade up to 1 000 · crashes −500 · 8 000 max',
  create: () => new FullSortie(),
};
type Phase = 'takeoff' | 'route' | 'sub' | 'landing';
export class FullSortie extends Mission {
  readonly def = FULL_DEF;
  airborneStart: boolean | null = false;
  private phase: Phase = 'takeoff'; private route: Gate[] = []; private ri = 0; private routeHits = 0;
  private subs: Mission[] = []; private si = 0; private sub: Mission | null = null; private subScores: string[] = [];
  private transition = 0;
  start(ctx: MissionCtx) {
    ctx.fm.spawnRunway();
    // 9-gate route curving through the hills north of the field, ending near the slalom start
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i < 9; i++) { const t = i / 8; const x = Math.sin(t * Math.PI * 1.6) * 1400; const z = -3000 - i * 700 + Math.cos(t * 3) * 200; pts.push(flat(x, z, 180 + Math.sin(i * 1.3) * 60)); }
    for (let i = 0; i < 9; i++) {
      const nxt = pts[Math.min(i + 1, 8)], prv = pts[Math.max(i - 1, 0)];
      const dir = nxt.clone().sub(prv); const hdg = THREE.MathUtils.radToDeg(Math.atan2(dir.x, -dir.z));
      const g = new Gate(pts[i], hdg, 100, 70); this.route.push(g); ctx.scene.add(g.group);
    }
    this.route[0].setState('next');
    this.subs = [new Slalom(), new LowLevel(), new PylonCheck(), new Formation(), new SpeedSection()];
  }
  private startSub(ctx: MissionCtx) {
    this.sub = this.subs[this.si]; this.sub.start({ ...ctx, composite: true });
    ctx.hud.post(`CHALLENGE ${this.si + 1} / 5  ·  ${this.sub.def.title}`, 'kill', 4); ctx.synth.uiConfirm();
  }
  update(dt: number, ctx: MissionCtx) {
    this.elapsed += dt; if (this.done) return;
    const s = ctx.fm.s;
    if (this.transition > 0) { this.transition -= dt; if (this.transition > 0) return; if (this.phase === 'sub') { if (this.si < this.subs.length) this.startSub(ctx); else { this.phase = 'landing'; this.sub = new Landing(); this.sub.start({ ...ctx, composite: true }); ctx.hud.post('RETURN TO BASE  ·  APPROACH GATE  ·  RUNWAY 36', 'kill', 4); } } }
    switch (this.phase) {
      case 'takeoff': if (!s.onGround && s.radarAltFt > 100) { this.phase = 'route'; ctx.hud.post('AIRBORNE  ·  FLY THE ROUTE', 'kill'); } break;
      case 'route': {
        const g = this.route[this.ri];
        if (g.crossed(ctx.prevPos, s.pos).hit) { this.routeHits++; this.score += 100; ctx.hud.post(`ROUTE GATE ${this.ri + 1}  ·  +100`, 'kill'); ctx.synth.gate(); g.setState('done'); this.ri++; }
        else if (s.pos.clone().sub(g.center).dot(g.normal) > 350) { ctx.hud.post(`ROUTE GATE ${this.ri + 1} MISSED`, 'warn'); ctx.synth.warn(); g.setState('missed'); this.ri++; }
        if (this.ri >= 9) { this.phase = 'sub'; this.transition = 2; } else if (this.ri < 9) this.route[this.ri].setState('next');
        break;
      }
      case 'sub': case 'landing': {
        const sub = this.sub; if (!sub) break;
        sub.update(dt, { ...ctx, composite: true });
        if (sub.done && sub.result) {
          this.score += sub.score; this.subScores.push(`${sub.def.title}  ${fmtPts(sub.score)}${sub.result.grade ? ' · ' + sub.result.grade : ''}`);
          sub.dispose(ctx);
          if (this.phase === 'landing') { this.finish({ title: 'FULL SORTIE COMPLETE', score: this.score, grade: grade(this.score, 8000), lines: [`ROUTE ${this.routeHits} / 9 GATES  ·  +${this.routeHits * 100}`, ...this.subScores] }, ctx); }
          else { ctx.hud.post(`${sub.def.title}  ·  ${fmtPts(sub.score)} PTS`, 'kill', 3); this.sub = null; this.si++; this.transition = 3; }
        }
        break;
      }
    }
  }
  cycleTarget(d: number, ctx: MissionCtx) { this.sub?.cycleTarget(d, ctx); }
  frame(f: import('../hud/hud').HudFrame, ctx: MissionCtx) { this.sub?.frame(f, ctx); }
  extras(ctx: MissionCtx): HudExtras {
    if (this.sub) { const e = this.sub.extras(ctx); e.headerA = `FULL SORTIE  ·  ${e.headerA}`; return e; }
    if (this.phase === 'takeoff') return { headerA: 'FULL SORTIE  ·  TAKEOFF', headerB: 'RUNWAY 36  ·  BRAKES SET', objective: ['*RELEASE BRAKES (B)  ·  FULL THROTTLE', 'ROTATE AT 150 KT  ·  GEAR UP (G)'], markers: [], showWeapon: false, ticker: '' };
    if (this.phase === 'route') { const g = this.route[Math.min(this.ri, 8)]; return { headerA: `FULL SORTIE  ·  ROUTE ${Math.min(this.ri + 1, 9)} / 9`, headerB: `${this.routeHits} GATES`, objective: [`*ROUTE GATE ${Math.min(this.ri + 1, 9)}`], markers: [{ world: g.center, label: `R${this.ri + 1}`, color: CYAN }], showWeapon: false, ticker: '' }; }
    return { headerA: 'FULL SORTIE', headerB: 'STAND BY', objective: ['*NEXT CHALLENGE LOADING'], markers: [], showWeapon: false, ticker: '' };
  }
  dispose(ctx: MissionCtx) { for (const g of this.route) ctx.scene.remove(g.group); this.sub?.dispose(ctx); }
}
