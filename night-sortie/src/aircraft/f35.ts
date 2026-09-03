import * as THREE from 'three';
import type { FlightState } from './flightModel';

/** Loft a set of super-elliptical cross-sections along the fuselage (nose at -Z). */
function loft(sections: Array<{ z: number; w: number; h: number; y: number; n?: number }>, segs = 20): THREE.BufferGeometry {
  const pos: number[] = [], idx: number[] = [];
  for (let i = 0; i < sections.length; i++) {
    const s = sections[i]; const n = s.n ?? 2.6;
    for (let j = 0; j <= segs; j++) {
      const a = (j / segs) * Math.PI * 2;
      const c = Math.cos(a), sn = Math.sin(a);
      const x = Math.sign(c) * Math.pow(Math.abs(c), 2 / n) * s.w;
      const y = Math.sign(sn) * Math.pow(Math.abs(sn), 2 / n) * s.h * (sn > 0 ? 1 : 0.75) + s.y;
      pos.push(x, y, s.z);
    }
  }
  for (let i = 0; i < sections.length - 1; i++) for (let j = 0; j < segs; j++) {
    const a = i * (segs + 1) + j, b = a + 1, c = a + segs + 1, d = c + 1;
    idx.push(a, c, b, b, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  return g;
}
function plate(points: Array<[number, number]>, thickness: number, y = 0): THREE.Mesh['geometry'] {
  const shape = new THREE.Shape(); shape.moveTo(points[0][0], points[0][1]); for (let i = 1; i < points.length; i++) shape.lineTo(points[i][0], points[i][1]);
  shape.closePath();
  const g = new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: true, bevelThickness: thickness * 0.4, bevelSize: 0.08, bevelSegments: 1 });
  g.rotateX(Math.PI / 2); g.translate(0, y + thickness / 2, 0);
  return g;
}
function lamp(color: number, intensity: number, r = 0.09) {
  return new THREE.Mesh(new THREE.SphereGeometry(r, 6, 5), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(intensity), toneMapped: false }));
}

/** Procedural F-35A-inspired fifth-generation fighter. Original geometry. Length ≈ 15.7 m, span ≈ 10.7 m. */
export class F35 {
  group = new THREE.Group();
  private gearNose = new THREE.Group(); private gearL = new THREE.Group(); private gearR = new THREE.Group();
  private flapL!: THREE.Mesh; private flapR!: THREE.Mesh; private stabL!: THREE.Mesh; private stabR!: THREE.Mesh; private rudL!: THREE.Mesh; private rudR!: THREE.Mesh;
  private abDisc!: THREE.Mesh; private abMat!: THREE.MeshBasicMaterial; private abCone!: THREE.Mesh; private abConeMat!: THREE.ShaderMaterial;
  private strobe!: THREE.Mesh; private strobeT = 0;
  private landingLight!: THREE.SpotLight;
  private sparks!: THREE.Points; private sparkPos!: Float32Array; private sparkLife!: Float32Array; private sparkVel!: Float32Array;
  private time = 0;

  constructor() {
    const g = this.group;
    const skin = new THREE.MeshStandardMaterial({ color: 0x3b4046, roughness: 0.62, metalness: 0.35 });
    skin.onBeforeCompile = (sh) => {
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vObjPos;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvObjPos = position;');
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', `#include <common>\nvarying vec3 vObjPos;\nfloat hashf(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }`)
        .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
          vec2 pnl = vObjPos.xz * 1.6; vec2 cell = floor(pnl); vec2 f = fract(pnl);
          float line = smoothstep(0.0, 0.04, f.x) * smoothstep(0.0, 0.04, f.y) * smoothstep(1.0, 0.96, f.x) * smoothstep(1.0, 0.96, f.y);
          float var = hashf(cell) * 0.18;
          roughnessFactor = clamp(roughnessFactor + var - 0.09, 0.3, 0.95);
          diffuseColor.rgb *= 0.93 + 0.07 * line + var * 0.5;
          // RAM sawtooth edge hint on the panels
          diffuseColor.rgb *= 1.0 - 0.06 * step(0.5, fract((vObjPos.x + vObjPos.z) * 2.0));`);
    };
    const dark = new THREE.MeshStandardMaterial({ color: 0x1c1f23, roughness: 0.8, metalness: 0.4 });
    const canopyMat = new THREE.MeshPhysicalMaterial({ color: 0x2a2416, roughness: 0.1, metalness: 0.6, transparent: true, opacity: 0.85, clearcoat: 1 });

    // fuselage
    const fus = new THREE.Mesh(loft([
      { z: -7.9, w: 0.05, h: 0.05, y: 0.15, n: 2 }, { z: -7.2, w: 0.42, h: 0.42, y: 0.15, n: 2.2 }, { z: -6.0, w: 0.75, h: 0.72, y: 0.2, n: 2.5 },
      { z: -4.4, w: 1.05, h: 0.9, y: 0.3, n: 2.8 }, { z: -3.0, w: 1.45, h: 1.05, y: 0.35, n: 3.2 }, { z: -1.0, w: 1.9, h: 1.15, y: 0.35, n: 3.6 },
      { z: 1.5, w: 2.05, h: 1.1, y: 0.35, n: 3.6 }, { z: 4.0, w: 1.7, h: 0.95, y: 0.35, n: 3.2 }, { z: 6.2, w: 1.0, h: 0.75, y: 0.35, n: 2.6 }, { z: 7.2, w: 0.62, h: 0.62, y: 0.35, n: 2.2 },
    ]), skin);
    fus.castShadow = true; g.add(fus);
    // canopy
    const canopy = new THREE.Mesh(loft([{ z: -5.2, w: 0.05, h: 0.05, y: 0.95, n: 2 }, { z: -4.4, w: 0.55, h: 0.55, y: 1.0, n: 2 }, { z: -3.0, w: 0.72, h: 0.8, y: 1.05, n: 2.1 }, { z: -1.4, w: 0.7, h: 0.6, y: 1.05, n: 2.2 }, { z: -0.2, w: 0.3, h: 0.15, y: 1.1, n: 2 }], 16), canopyMat);
    g.add(canopy);
    // EOTS bump under the nose
    const eots = new THREE.Mesh(new THREE.SphereGeometry(0.28, 10, 8), canopyMat); eots.position.set(0, -0.35, -5.6); eots.scale.set(1, 0.7, 1.4); g.add(eots);
    // diverterless inlets (bumps + intake shapes)
    for (const sx of [-1, 1]) {
      const inlet = new THREE.Mesh(loft([{ z: -2.6, w: 0.05, h: 0.05, y: -0.1, n: 2 }, { z: -2.2, w: 0.55, h: 0.7, y: -0.05, n: 2.4 }, { z: 0.5, w: 0.7, h: 0.75, y: 0.0, n: 3 }, { z: 3.0, w: 0.5, h: 0.6, y: 0.1, n: 3 }], 12), skin);
      inlet.position.set(sx * 1.55, 0, 0); inlet.castShadow = true; g.add(inlet);
      const mouth = new THREE.Mesh(new THREE.CircleGeometry(0.42, 12), dark); mouth.position.set(sx * 1.55, -0.05, -2.3); mouth.rotation.y = Math.PI; g.add(mouth);
    }
    // wings (cropped diamond)
    const wingPts: Array<[number, number]> = [[1.4, -1.6], [5.35, 1.6], [5.35, 2.4], [4.0, 3.0], [1.6, 3.3]];
    for (const sx of [-1, 1]) {
      const pts = wingPts.map(([x, z]) => [x * sx, z] as [number, number]);
      const w = new THREE.Mesh(plate(pts, 0.14, 0.1), skin); w.castShadow = true; g.add(w);
      // flaperon (trailing edge)
      const fl = new THREE.Mesh(plate([[1.6 * sx, 0], [4.0 * sx, 0], [4.2 * sx, 0.7], [1.7 * sx, 0.7]], 0.08, 0), skin);
      fl.position.set(0, 0.1, 2.85); g.add(fl);
      if (sx < 0) this.flapL = fl; else this.flapR = fl;
      // wingtip formation light (cyan) + nav lights
      const tip = lamp(0x7ff3ff, 6, 0.08); tip.position.set(sx * 5.3, 0.2, 2.0); g.add(tip);
      const nav = lamp(sx < 0 ? 0xff2020 : 0x20ff40, 5, 0.07); nav.position.set(sx * 5.3, 0.2, 1.7); g.add(nav);
    }
    // horizontal stabilators
    for (const sx of [-1, 1]) {
      const st = new THREE.Mesh(plate([[0.9 * sx, -1.0], [3.4 * sx, 0.3], [3.4 * sx, 1.0], [2.2 * sx, 1.7], [0.9 * sx, 1.7]], 0.1, 0.25), skin);
      st.position.set(0, 0, 5.4); st.castShadow = true; g.add(st);
      if (sx < 0) this.stabL = st; else this.stabR = st;
    }
    // canted vertical tails
    for (const sx of [-1, 1]) {
      const vt = new THREE.Mesh(plate([[0, 0], [2.1, 0], [3.1, 1.8], [2.6, 2.6], [2.0, 2.6]], 0.1, 0), skin);
      vt.geometry.rotateX(-Math.PI / 2);
      const grp = new THREE.Group(); grp.add(vt); vt.position.set(0, 0, -1.0);
      grp.position.set(sx * 1.35, 0.9, 3.4); grp.rotation.z = sx * -0.35; g.add(grp);
      vt.castShadow = true;
      const rud = new THREE.Mesh(plate([[0, 0], [0.55, 0], [0.5, 2.2], [0, 2.4]], 0.08, 0), skin);
      rud.geometry.rotateX(-Math.PI / 2);
      rud.position.set(0, 0, 1.15); grp.add(rud);
      if (sx < 0) this.rudL = rud; else this.rudR = rud;
      const tl = lamp(0x7ff3ff, 5, 0.07); tl.position.set(0, 2.55, 1.6); grp.add(tl);
    }
    // spine formation light + strobe
    const sp = lamp(0x7ff3ff, 5, 0.09); sp.position.set(0, 1.4, 1.5); g.add(sp);
    this.strobe = lamp(0xffffff, 12, 0.1); this.strobe.position.set(0, -0.9, 0.5); g.add(this.strobe);
    // nozzle
    const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.62, 1.0, 16, 1, true), dark); nozzle.rotation.x = Math.PI / 2; nozzle.position.set(0, 0.35, 7.6); g.add(nozzle);
    const nozIn = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.5, 0.9, 16, 1, true), new THREE.MeshBasicMaterial({ color: 0x100804, side: THREE.BackSide })); nozIn.rotation.x = Math.PI / 2; nozIn.position.set(0, 0.35, 7.6); g.add(nozIn);
    // afterburner disc + plume cone
    this.abMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.0, 0.55, 0.2).multiplyScalar(6), toneMapped: false, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false });
    this.abDisc = new THREE.Mesh(new THREE.CircleGeometry(0.5, 20), this.abMat); this.abDisc.position.set(0, 0.35, 8.05); g.add(this.abDisc);
    this.abConeMat = new THREE.ShaderMaterial({
      transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
      uniforms: { uT: { value: 0 }, uLevel: { value: 0 } },
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: `varying vec2 vUv; uniform float uT; uniform float uLevel;
        void main(){ float l = vUv.y; float ring = sin(l*40.0 - uT*60.0)*0.5+0.5; // shock diamonds
          float core = smoothstep(1.0, 0.0, l);
          vec3 c = mix(vec3(1.0,0.35,0.1), vec3(0.6,0.75,1.0), l*0.9) * (0.7 + 0.6*ring*core);
          float a = core * uLevel * (0.55 + 0.25*ring);
          gl_FragColor = vec4(c * 3.0 * a, a); }`,
    });
    this.abCone = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.5, 6, 14, 1, true), this.abConeMat);
    this.abCone.geometry.rotateX(Math.PI / 2); this.abCone.geometry.translate(0, 0, 3); this.abCone.position.set(0, 0.35, 8.0); g.add(this.abCone);
    // sparklets
    const N = 120; this.sparkPos = new Float32Array(N * 3); this.sparkLife = new Float32Array(N); this.sparkVel = new Float32Array(N * 3);
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(this.sparkPos, 3));
    this.sparks = new THREE.Points(sg, new THREE.PointsMaterial({ color: new THREE.Color(1, 0.6, 0.25).multiplyScalar(4), size: 0.12, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
    g.add(this.sparks);

    // landing gear
    const strutMat = new THREE.MeshStandardMaterial({ color: 0x9aa0a6, roughness: 0.5, metalness: 0.7 });
    const tyreMat = new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.9 });
    const mkGear = (len: number, wheelR: number, twin: boolean) => {
      const grp = new THREE.Group();
      const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, len, 8), strutMat); strut.position.y = -len / 2; grp.add(strut);
      const wheelGeo = new THREE.CylinderGeometry(wheelR, wheelR, 0.2, 14); wheelGeo.rotateZ(Math.PI / 2);
      if (twin) { for (const sx of [-1, 1]) { const w = new THREE.Mesh(wheelGeo, tyreMat); w.position.set(sx * 0.14, -len, 0); grp.add(w); } }
      else { const w = new THREE.Mesh(wheelGeo, tyreMat); w.position.set(0, -len, 0); grp.add(w); }
      const door = new THREE.Mesh(new THREE.BoxGeometry(0.3, len * 0.8, 0.05), skin); door.position.set(0.2, -len * 0.4, 0); grp.add(door);
      return grp;
    };
    this.gearNose.add(mkGear(1.55, 0.22, true)); this.gearNose.position.set(0, -0.5, -4.0); g.add(this.gearNose);
    this.gearL.add(mkGear(1.7, 0.32, false)); this.gearL.position.set(-1.35, -0.6, 1.4); g.add(this.gearL);
    this.gearR.add(mkGear(1.7, 0.32, false)); this.gearR.position.set(1.35, -0.6, 1.4); g.add(this.gearR);
    const taxiLamp = lamp(0xfff2d0, 10, 0.08); taxiLamp.position.set(0, -1.6, -0.25); this.gearNose.add(taxiLamp);

    // landing light (spot) attached to nose gear
    this.landingLight = new THREE.SpotLight(0xfff4dc, 0, 260, 0.35, 0.5, 1.2);
    this.landingLight.position.set(0, -1.2, -4.2); this.landingLight.target.position.set(0, -6, -80);
    g.add(this.landingLight, this.landingLight.target);
    g.traverse((o) => { if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).castShadow = true; });
  }

  update(dt: number, s: FlightState) {
    this.time += dt;
    // gear: 0 up (folded into bays), 1 down
    const gp = s.gearPos;
    const ease = gp * gp * (3 - 2 * gp);
    this.gearNose.rotation.x = (1 - ease) * (Math.PI / 2 * 0.98) * -1;
    this.gearL.rotation.z = (1 - ease) * (Math.PI / 2 * 0.95);
    this.gearR.rotation.z = -(1 - ease) * (Math.PI / 2 * 0.95);
    this.gearNose.visible = this.gearL.visible = this.gearR.visible = gp > 0.02;
    this.landingLight.intensity = gp > 0.9 && s.radarAltFt < 800 ? 2500 : 0;
    // control surfaces
    const c = s.ctrl;
    const flap = s.flapPos * 0.55;
    this.flapL.rotation.x = flap + c.roll * 0.35 * -1; this.flapR.rotation.x = flap + c.roll * 0.35;
    this.stabL.rotation.x = c.pitch * 0.4 - c.roll * 0.15; this.stabR.rotation.x = c.pitch * 0.4 + c.roll * 0.15;
    this.rudL.rotation.y = this.rudR.rotation.y = -c.yaw * 0.45;
    // afterburner
    const ab = s.abLevel; const mil = (s.n2 - 0.62) / 0.38;
    this.abMat.opacity = 0.3 + mil * 0.4 + ab * 0.3;
    this.abMat.color.setRGB(1, 0.45 + ab * 0.3, 0.15 + ab * 0.5).multiplyScalar(2 + mil * 3 + ab * 6);
    this.abDisc.scale.setScalar(0.75 + mil * 0.2 + ab * 0.25 + (Math.random() - 0.5) * 0.05 * ab);
    this.abConeMat.uniforms.uT.value = this.time; this.abConeMat.uniforms.uLevel.value = ab;
    this.abCone.visible = ab > 0.02; this.abCone.scale.set(1 + ab * 0.2, 1 + ab * 0.2, 0.5 + ab * 0.9);
    // sparklets
    const N = this.sparkLife.length;
    for (let i = 0; i < N; i++) {
      if (this.sparkLife[i] <= 0) {
        if (ab > 0.6 && Math.random() < ab * 0.3) { this.sparkLife[i] = 0.25 + Math.random() * 0.3; this.sparkPos[i * 3] = (Math.random() - 0.5) * 0.4; this.sparkPos[i * 3 + 1] = 0.35 + (Math.random() - 0.5) * 0.4; this.sparkPos[i * 3 + 2] = 8.2; this.sparkVel[i * 3] = (Math.random() - 0.5) * 3; this.sparkVel[i * 3 + 1] = (Math.random() - 0.5) * 3; this.sparkVel[i * 3 + 2] = 30 + Math.random() * 30; }
        else { this.sparkPos[i * 3 + 1] = -1000; }
      } else {
        this.sparkLife[i] -= dt;
        this.sparkPos[i * 3] += this.sparkVel[i * 3] * dt; this.sparkPos[i * 3 + 1] += this.sparkVel[i * 3 + 1] * dt; this.sparkPos[i * 3 + 2] += this.sparkVel[i * 3 + 2] * dt;
      }
    }
    (this.sparks.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    // anti-collision strobe
    this.strobeT += dt; const ph = this.strobeT % 1.2;
    this.strobe.visible = ph < 0.05 || (ph > 0.12 && ph < 0.17);
  }
}
