// Camada de render: lê o estado lógico e escreve em Object3D. Nada de regra de jogo aqui.
import * as THREE from 'three';
import { BEAM_W, BEAM_T, BALL_R, levelBounds } from '../core/level.js';
import { add, sub, scale, norm, dot, cross } from '../core/math.js';

const COLORS = {
  beam: 0xf4e16c,
  block: 0xf2a866,
  bronze: 0x5f513a,
  ball: 0xc8341f,
  ballBand: 0x7a1a0e,
  pin: 0xfbfaf2,
  pinBand: 0xd23a2a,
};

const v3 = (a) => new THREE.Vector3(a[0], a[1], a[2]);

/** Extrusão retangular com juntas em meia-esquadria ao longo da polilinha da viga. */
function beamGeometry(track) {
  const hw = BEAM_W / 2;
  const segs = track.segs;
  const n = track.pts.length;
  const nodes = track.pts.map((p) => p.slice());
  // Pontas estendidas em meia largura: cada ponta lógica fica no centro de um ladrilho.
  nodes[0] = add(nodes[0], scale(segs[0].fwd, -hw));
  nodes[n - 1] = add(nodes[n - 1], scale(segs[segs.length - 1].fwd, hw));

  const frame = (j) => {
    if (j === 0) return { side: segs[0].side, up: segs[0].up };
    if (j === n - 1) return { side: segs[j - 1].side, up: segs[j - 1].up };
    const a = segs[j - 1];
    const b = segs[j];
    const miter = (u, v) => {
      const m = norm(add(u, v));
      const k = Math.min(1 / Math.max(dot(m, u), 1e-3), 3);
      return scale(m, k);
    };
    return { side: miter(a.side, b.side), up: miter(a.up, b.up) };
  };

  const rings = nodes.map((p, j) => {
    const { side, up } = frame(j);
    const tl = add(p, scale(side, hw));
    const tr = add(p, scale(side, -hw));
    return { tl, tr, bl: add(tl, scale(up, -BEAM_T)), br: add(tr, scale(up, -BEAM_T)) };
  });

  const pos = [];
  const nor = [];
  const quad = (a, b, c, d, nrm) => {
    // Garante winding anti-horário visto do lado da normal (face frontal correta).
    const ccw = dot(cross(sub(b, a), sub(c, a)), nrm) >= 0;
    for (const p of ccw ? [a, b, c, a, c, d] : [a, c, b, a, d, c]) {
      pos.push(p[0], p[1], p[2]);
      nor.push(nrm[0], nrm[1], nrm[2]);
    }
  };
  for (let i = 0; i < n - 1; i++) {
    const r0 = rings[i];
    const r1 = rings[i + 1];
    const g = segs[i];
    quad(r0.tl, r0.tr, r1.tr, r1.tl, g.up);
    quad(r0.bl, r1.bl, r1.br, r0.br, scale(g.up, -1));
    quad(r0.tl, r1.tl, r1.bl, r0.bl, g.side);
    quad(r0.tr, r0.br, r1.br, r1.tr, scale(g.side, -1));
  }
  const f = rings[0];
  const l = rings[n - 1];
  quad(f.tl, f.bl, f.br, f.tr, scale(segs[0].fwd, -1));
  quad(l.tl, l.tr, l.br, l.bl, segs[segs.length - 1].fwd);

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  return geo;
}

/** Pé curvo (filete côncavo) de seção quadrada: torno com 4 segmentos girado 45°. */
function footGeometry(flare = 0.55) {
  const R = (BEAM_W / 2) * Math.SQRT2;
  const steps = 8;
  // Ordem para o torno: do topo (eixo) descendo pelo filete até a base e voltando ao eixo.
  const ordered = [new THREE.Vector2(0, 0)];
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * (Math.PI / 2);
    ordered.push(new THREE.Vector2(R + flare - flare * Math.sin(a), flare - flare * Math.cos(a)));
  }
  ordered.push(new THREE.Vector2(0, flare));
  const geo = new THREE.LatheGeometry(ordered, 4, Math.PI / 4);
  return geo.toNonIndexed();
}

function pinGeometry() {
  const prof = [
    [0, 0], [0.11, 0], [0.145, 0.07], [0.165, 0.19], [0.15, 0.32], [0.1, 0.45],
    [0.072, 0.53], [0.08, 0.61], [0.095, 0.68], [0.085, 0.76], [0.05, 0.81], [0, 0.825],
  ].map(([r, y]) => new THREE.Vector2(r, y));
  return new THREE.LatheGeometry(prof, 20);
}

function ballGeometry() {
  const geo = new THREE.SphereGeometry(BALL_R, 24, 16);
  const n = geo.attributes.normal;
  const colors = [];
  const base = new THREE.Color(COLORS.ball);
  const band = new THREE.Color(COLORS.ballBand);
  for (let i = 0; i < n.count; i++) {
    const c = Math.abs(n.getY(i)) < 0.18 || Math.abs(n.getX(i)) < 0.12 ? band : base;
    colors.push(c.r, c.g, c.b);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  return geo;
}

export class GameScene {
  constructor(canvas) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setClearColor(0x000000, 0);
    this.scene = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 500);

    // Luz fixa no MUNDO e sem sombras: faces com a mesma orientação têm o mesmo tom,
    // e nada denuncia a profundidade — é isso que sustenta a ilusão.
    this.scene.add(new THREE.HemisphereLight(0xfffbea, 0x7d7348, 1.35));
    const sun = new THREE.DirectionalLight(0xffffff, 1.55);
    sun.position.set(-0.45, 1, 0.3);
    this.scene.add(sun);

    this.mats = {
      beam: new THREE.MeshLambertMaterial({ color: COLORS.beam }),
      foot: new THREE.MeshLambertMaterial({ color: COLORS.beam, flatShading: true, side: THREE.DoubleSide }),
      block: new THREE.MeshLambertMaterial({ color: COLORS.block, emissive: 0x000000 }),
      bronze: new THREE.MeshLambertMaterial({ color: COLORS.bronze }),
      ball: new THREE.MeshLambertMaterial({ vertexColors: true }),
      ghost: new THREE.MeshBasicMaterial({
        color: 0x6a1d10, transparent: true, opacity: 0.38,
        depthFunc: THREE.GreaterDepth, depthWrite: false,
      }),
      pin: new THREE.MeshLambertMaterial({ color: COLORS.pin }),
      pinBand: new THREE.MeshLambertMaterial({ color: COLORS.pinBand }),
      ring: new THREE.MeshBasicMaterial({
        color: 0xffffff, transparent: true, opacity: 0, depthTest: false, depthWrite: false,
      }),
      spark: new THREE.MeshBasicMaterial({ color: 0xffffff }),
    };
    this.geos = { foot: footGeometry(), pin: pinGeometry(), ball: ballGeometry() };
    this.world = null;
    this.particles = [];
    this.resize();
  }

  resize() {
    const w = this.renderer.domElement.clientWidth || window.innerWidth;
    const h = this.renderer.domElement.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.aspect = w / h;
    this.fitCamera();
  }

  fitCamera() {
    if (!this.bounds) return;
    const r = this.bounds.radius;
    const halfH = (this.aspect >= 1 ? r : r / this.aspect) * 1.08;
    const cam = this.camera;
    // Desloca o enquadramento para cima: o rodapé tem dica e botão.
    const lift = halfH * 0.16;
    cam.top = halfH - lift;
    cam.bottom = -halfH - lift;
    cam.left = -halfH * this.aspect;
    cam.right = halfH * this.aspect;
    cam.updateProjectionMatrix();
  }

  loadLevel(level) {
    if (this.world) {
      this.scene.remove(this.world);
      this.world.traverse((o) => {
        if (o.geometry && !Object.values(this.geos).includes(o.geometry)) o.geometry.dispose();
      });
    }
    for (const p of this.particles) this.scene.remove(p.mesh);
    this.particles = [];
    this.level = level;
    this.bounds = levelBounds(level);
    this.fitCamera();

    const world = new THREE.Group();
    this.world = world;
    this.scene.add(world);

    for (const t of level.tracks) world.add(new THREE.Mesh(beamGeometry(t), this.mats.beam));

    for (const p of level.data.pillars ?? []) {
      const flare = 0.55;
      const h = p.top - p.bottom - flare;
      const col = new THREE.Mesh(new THREE.BoxGeometry(BEAM_W, h, BEAM_W), this.mats.beam);
      col.position.set(p.x, p.bottom + flare + h / 2, p.z);
      world.add(col);
      const foot = new THREE.Mesh(this.geos.foot, this.mats.foot);
      foot.position.set(p.x, p.bottom, p.z);
      world.add(foot);
    }

    this.blockMeshes = (level.data.blocks ?? []).map((b, i) => {
      const box = level.occluders[i];
      const size = [0, 1, 2].map((k) => box.max[k] - box.min[k]);
      const m = new THREE.Mesh(new THREE.BoxGeometry(...size), this.mats.block.clone());
      m.position.set(...[0, 1, 2].map((k) => (box.max[k] + box.min[k]) / 2));
      world.add(m);
      return m;
    });

    // Batentes nas pontas fechadas.
    for (const port of level.ports) {
      if (port.type !== 'cap') continue;
      const stop = new THREE.Mesh(new THREE.BoxGeometry(BEAM_W, 0.22, 0.12), this.mats.beam);
      stop.position.copy(v3(add(port.pos, add(scale(port.out, BEAM_W / 2 - 0.06), [0, 0.11, 0]))));
      stop.rotation.y = Math.atan2(port.out[0], port.out[2]);
      world.add(stop);
    }

    this.buildLamp(level.start);
    this.buildPin(level.goal);

    this.ballMesh = new THREE.Mesh(this.geos.ball, this.mats.ball);
    this.ghostMesh = new THREE.Mesh(this.geos.ball, this.mats.ghost);
    this.ghostMesh.renderOrder = 10;
    world.add(this.ballMesh, this.ghostMesh);

    // Anel que pisca na junção quando duas pontas se alinham.
    this.rings = level.links.map(() => {
      const m = new THREE.Mesh(new THREE.RingGeometry(0.42, 0.5, 40), this.mats.ring.clone());
      m.renderOrder = 20;
      world.add(m);
      return m;
    });
  }

  buildLamp(port) {
    const g = new THREE.Group();
    const out = port.out;
    const base = port.pos;
    const poleH = 1.75;
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.05, poleH, 8), this.mats.bronze);
    const polePos = add(base, scale(out, 0.36));
    pole.position.copy(v3(add(polePos, [0, poleH / 2, 0])));
    g.add(pole);
    const arcR = 0.22;
    const arc = new THREE.Mesh(new THREE.TorusGeometry(arcR, 0.03, 8, 20, Math.PI), this.mats.bronze);
    arc.position.copy(v3(add(add(base, scale(out, 0.36 - arcR)), [0, poleH, 0])));
    arc.rotation.y = Math.atan2(-out[2], out[0]);
    g.add(arc);
    const tip = add(add(base, scale(out, 0.36 - 2 * arcR)), [0, poleH, 0]);
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.16, 6), this.mats.bronze);
    stem.position.copy(v3(add(tip, [0, -0.08, 0])));
    g.add(stem);
    const shade = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.2, 18, 1, true), this.mats.bronze);
    shade.material = this.mats.bronze.clone();
    shade.material.side = THREE.DoubleSide;
    shade.position.copy(v3(add(tip, [0, -0.24, 0])));
    g.add(shade);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), new THREE.MeshBasicMaterial({ color: 0xfff1b8 }));
    bulb.position.copy(v3(add(tip, [0, -0.33, 0])));
    g.add(bulb);
    this.lampMouth = add(tip, [0, -0.38, 0]);
    this.world.add(g);
  }

  buildPin(port) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(this.geos.pin, this.mats.pin);
    g.add(body);
    for (const y of [0.56, 0.62]) {
      const band = new THREE.Mesh(new THREE.CylinderGeometry(0.081, 0.084, 0.025, 20), this.mats.pinBand);
      band.position.y = y;
      g.add(band);
    }
    g.scale.setScalar(1.05);
    g.position.copy(v3(port.pos));
    this.pin = { group: g, home: v3(port.pos), vel: null, spin: null };
    this.world.add(g);
  }

  setView(basis) {
    const c = this.bounds.center;
    const d = basis.d;
    this.camera.position.set(c[0] + d[0] * 100, c[1] + d[1] * 100, c[2] + d[2] * 100);
    this.camera.up.set(0, 1, 0);
    this.camera.lookAt(c[0], c[1], c[2]);
  }

  knockPin(dir) {
    this.pin.vel = new THREE.Vector3(dir[0] * 3.2, 4.2, dir[2] * 3.2);
    const axis = cross([0, 1, 0], dir);
    this.pin.spin = { axis: v3(norm(axis)), w: 11 };
    const origin = this.pin.home.clone().add(new THREE.Vector3(0, 0.5, 0));
    const palette = [0xd23a2a, 0xfbfaf2, 0xc8341f, 0xf4e16c];
    for (let i = 0; i < 70; i++) {
      const mat = this.mats.spark.clone();
      mat.color.setHex(palette[i % palette.length]);
      const s = 0.05 + Math.random() * 0.07;
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(s, s, s), mat);
      mesh.position.copy(origin);
      const a = Math.random() * Math.PI * 2;
      const sp = 1.5 + Math.random() * 3.5;
      const vel = new THREE.Vector3(Math.cos(a) * sp, 2 + Math.random() * 5, Math.sin(a) * sp);
      this.scene.add(mesh);
      this.particles.push({ mesh, vel, life: 1.6 + Math.random() * 0.8, rot: Math.random() * 10 });
    }
  }

  /** Copia o estado lógico para a cena. */
  sync(dt, { ball, view, time, snappedGap }) {
    this.setView(view.basis);

    // Bola
    let p = ball.pos;
    let sc = 1;
    if (ball.state === 'drop') {
      const k = Math.min(ball.timer / 0.35, 1);
      const e = k * k;
      p = [
        this.lampMouth[0] + (ball.pos[0] - this.lampMouth[0]) * e,
        this.lampMouth[1] + (ball.pos[1] - this.lampMouth[1]) * e,
        this.lampMouth[2] + (ball.pos[2] - this.lampMouth[2]) * e,
      ];
      sc = 0.3 + 0.7 * k;
    } else if (ball.state === 'falling') {
      sc = Math.max(0, 1 - Math.max(0, ball.timer - 0.8) / 0.5);
    }
    this.ballMesh.position.set(p[0], p[1], p[2]);
    this.ballMesh.scale.setScalar(sc);
    const dSpin = ball.spin - (this.lastSpin ?? ball.spin);
    this.lastSpin = ball.spin;
    if (dSpin) {
      const axis = norm(cross([0, 1, 0], ball.fwd));
      if (axis[0] || axis[2]) {
        const q = new THREE.Quaternion().setFromAxisAngle(v3(axis), dSpin);
        this.ballMesh.quaternion.premultiply(q);
      }
    }
    this.ghostMesh.position.copy(this.ballMesh.position);
    this.ghostMesh.scale.copy(this.ballMesh.scale);

    // Anéis de junção
    const camQ = this.camera.quaternion;
    this.level.links.forEach((l, i) => {
      const ring = this.rings[i];
      const active = view.isLinkActive(l);
      const target = active ? 0.85 : 0;
      ring.material.opacity += (target - ring.material.opacity) * Math.min(1, dt * 10);
      ring.visible = ring.material.opacity > 0.01;
      const front = dot(l.a.pos, view.basis.d) > dot(l.b.pos, view.basis.d) ? l.a : l.b;
      ring.position.copy(v3(add(front.pos, [0, 0.01, 0])));
      ring.quaternion.copy(camQ);
      ring.scale.setScalar(1 + 0.08 * Math.sin(time * 6));
    });

    // Blocos brilham quando escondem um vão.
    this.blockMeshes.forEach((m) => {
      const glow = snappedGap ? 0.12 + 0.06 * Math.sin(time * 5) : 0;
      m.material.emissive.setRGB(glow, glow * 0.8, glow * 0.4);
    });

    // Pino
    const pin = this.pin;
    if (pin.vel) {
      pin.vel.y -= 14 * dt;
      pin.group.position.addScaledVector(pin.vel, dt);
      pin.group.rotateOnWorldAxis(pin.spin.axis, pin.spin.w * dt);
    }

    // Confete
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const q = this.particles[i];
      q.life -= dt;
      q.vel.y -= 9 * dt;
      q.mesh.position.addScaledVector(q.vel, dt);
      q.mesh.rotation.x += q.rot * dt;
      q.mesh.rotation.y += q.rot * 0.7 * dt;
      if (q.life < 0.4) q.mesh.scale.setScalar(Math.max(q.life / 0.4, 0.001));
      if (q.life <= 0) {
        this.scene.remove(q.mesh);
        q.mesh.geometry.dispose();
        this.particles.splice(i, 1);
      }
    }
  }

  resetPin() {
    if (!this.pin) return;
    this.pin.vel = null;
    this.pin.group.position.copy(this.pin.home);
    this.pin.group.rotation.set(0, 0, 0);
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }
}
