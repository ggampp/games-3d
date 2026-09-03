import * as THREE from 'three';
import { RUNWAY_LENGTH, RUNWAY_WIDTH, RUNWAY_Z0, RUNWAY_Z1 } from './terrain';

const lampGeo = new THREE.SphereGeometry(0.55, 6, 5);

function instanced(color: THREE.ColorRepresentation, intensity: number, positions: THREE.Vector3[], scale = 1): THREE.InstancedMesh {
  const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(intensity), toneMapped: false });
  const im = new THREE.InstancedMesh(lampGeo, mat, positions.length);
  const m = new THREE.Matrix4();
  positions.forEach((p, i) => { m.makeScale(scale, scale, scale); m.setPosition(p); im.setMatrixAt(i, m); });
  im.instanceMatrix.needsUpdate = true;
  return im;
}

/** Runway 36: concrete strip, markings, edge / centreline / threshold lights, taxiway, approach rabbit. */
export class Runway {
  group = new THREE.Group();
  private strobes: THREE.Mesh[] = [];
  private strobeMat: THREE.MeshBasicMaterial[] = [];
  private t = 0;

  constructor() {
    const g = this.group;
    // pavement
    const pave = new THREE.Mesh(new THREE.PlaneGeometry(RUNWAY_WIDTH, RUNWAY_LENGTH), new THREE.MeshStandardMaterial({ color: 0x2a2c2e, roughness: 0.9 }));
    pave.rotation.x = -Math.PI / 2; pave.position.set(0, 0.05, (RUNWAY_Z0 + RUNWAY_Z1) / 2); pave.receiveShadow = true;
    g.add(pave);
    // shoulders / apron
    const apron = new THREE.Mesh(new THREE.PlaneGeometry(RUNWAY_WIDTH * 4, RUNWAY_LENGTH + 500), new THREE.MeshStandardMaterial({ color: 0x1b1e21, roughness: 1 }));
    apron.rotation.x = -Math.PI / 2; apron.position.set(0, 0.02, (RUNWAY_Z0 + RUNWAY_Z1) / 2); apron.receiveShadow = true;
    g.add(apron);
    // taxiway parallel (east)
    const taxi = new THREE.Mesh(new THREE.PlaneGeometry(18, RUNWAY_LENGTH - 400), new THREE.MeshStandardMaterial({ color: 0x25272a, roughness: 0.95 }));
    taxi.rotation.x = -Math.PI / 2; taxi.position.set(110, 0.04, 0); g.add(taxi);

    const markMat = new THREE.MeshBasicMaterial({ color: 0xd8d8d0, toneMapped: false });
    // centreline stripes (painted)
    const stripeGeo = new THREE.PlaneGeometry(0.9, 30);
    for (let z = RUNWAY_Z0 - 120; z > RUNWAY_Z1 + 100; z -= 60) {
      const s = new THREE.Mesh(stripeGeo, markMat); s.rotation.x = -Math.PI / 2; s.position.set(0, 0.08, z); g.add(s);
    }
    // threshold bars both ends
    for (const [zc, dir] of [[RUNWAY_Z0 - 20, 1], [RUNWAY_Z1 + 20, -1]] as const) {
      for (let i = 0; i < 8; i++) {
        const x = (i - 3.5) * 4.6 + (i >= 4 ? 2 : -2);
        const b = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 30), markMat); b.rotation.x = -Math.PI / 2; b.position.set(x, 0.08, zc - dir * 0); g.add(b);
      }
    }
    // numerals "36" at south threshold (facing a pilot on approach from the south)
    this.numeral(g, '3', -7, RUNWAY_Z0 - 70, markMat);
    this.numeral(g, '6', 4, RUNWAY_Z0 - 70, markMat);
    // touchdown zone bars
    for (const zz of [RUNWAY_Z0 - 300, RUNWAY_Z0 - 450, RUNWAY_Z0 - 600]) {
      for (const sx of [-1, 1]) {
        for (let k = 0; k < 3; k++) {
          const b = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 22), markMat); b.rotation.x = -Math.PI / 2; b.position.set(sx * (12 + k * 2.6), 0.08, zz); g.add(b);
        }
      }
    }

    // lights
    const edge: THREE.Vector3[] = [], center: THREE.Vector3[] = [], thr: THREE.Vector3[] = [], endL: THREE.Vector3[] = [], taxiL: THREE.Vector3[] = [];
    for (let z = RUNWAY_Z0; z >= RUNWAY_Z1; z -= 60) { edge.push(new THREE.Vector3(-RUNWAY_WIDTH / 2 - 1.5, 0.5, z), new THREE.Vector3(RUNWAY_WIDTH / 2 + 1.5, 0.5, z)); }
    for (let z = RUNWAY_Z0 - 15; z >= RUNWAY_Z1 + 15; z -= 30) center.push(new THREE.Vector3(0, 0.3, z));
    for (let i = 0; i < 16; i++) { const x = (i - 7.5) * 3; thr.push(new THREE.Vector3(x, 0.4, RUNWAY_Z0 + 1)); endL.push(new THREE.Vector3(x, 0.4, RUNWAY_Z1 - 1)); }
    for (let z = RUNWAY_Z0 - 200; z >= RUNWAY_Z1 + 200; z -= 60) { taxiL.push(new THREE.Vector3(101, 0.5, z), new THREE.Vector3(119, 0.5, z)); }
    g.add(instanced(0xffffff, 3.5, edge));
    g.add(instanced(0xffe27a, 3.0, center, 0.8));
    g.add(instanced(0x4dff7a, 3.0, thr));
    g.add(instanced(0xff4040, 3.0, endL));
    g.add(instanced(0x3d6bff, 1.8, taxiL, 0.7));
    // PAPI (left of threshold): 2 white 2 red
    const papi: THREE.Vector3[] = []; for (let i = 0; i < 4; i++) papi.push(new THREE.Vector3(-40 - i * 4, 0.6, RUNWAY_Z0 - 320));
    g.add(instanced(0xffffff, 2.5, papi.slice(0, 2), 1.3)); g.add(instanced(0xff3030, 2.5, papi.slice(2), 1.3));

    // approach light system with sequenced strobes (the rabbit) south of the threshold
    const barPos: THREE.Vector3[] = [];
    for (let i = 1; i <= 30; i++) {
      const z = RUNWAY_Z0 + i * 30;
      for (let k = -2; k <= 2; k++) barPos.push(new THREE.Vector3(k * 1.8, 1.5, z));
      if (i % 5 === 0) for (let k = -6; k <= 6; k++) barPos.push(new THREE.Vector3(k * 2.2, 1.5, z));
    }
    g.add(instanced(0xffffff, 2.2, barPos, 0.8));
    for (let i = 0; i < 21; i++) {
      const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false });
      const m = new THREE.Mesh(new THREE.SphereGeometry(1.2, 6, 5), mat);
      m.position.set(0, 2.0, RUNWAY_Z0 + 900 - i * 30);
      g.add(m); this.strobes.push(m); this.strobeMat.push(mat);
    }
    // a few apron floodlights + hangar silhouettes
    const hangarMat = new THREE.MeshStandardMaterial({ color: 0x1e2226, roughness: 0.9 });
    for (let i = 0; i < 4; i++) {
      const h = new THREE.Mesh(new THREE.BoxGeometry(70, 16, 45), hangarMat); h.position.set(260, 8, -200 + i * 120); h.castShadow = true; g.add(h);
      const l = new THREE.Mesh(new THREE.SphereGeometry(1.5, 6, 5), new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 0.8, 0.55).multiplyScalar(4), toneMapped: false }));
      l.position.set(215, 14, -200 + i * 120); g.add(l);
    }
    // tower
    const tower = new THREE.Mesh(new THREE.CylinderGeometry(5, 6, 40, 8), hangarMat); tower.position.set(-220, 20, 300); g.add(tower);
    const tl = new THREE.Mesh(new THREE.SphereGeometry(1.2, 6, 5), new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 0.15, 0.1).multiplyScalar(5), toneMapped: false })); tl.position.set(-220, 42, 300); g.add(tl);
  }

  private numeral(g: THREE.Group, ch: string, x: number, z: number, mat: THREE.Material) {
    // 7-segment style numerals painted on the pavement (length along runway ~ 18 m)
    const seg = (cx: number, cz: number, w: number, l: number) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, l), mat); m.rotation.x = -Math.PI / 2; m.position.set(x + cx, 0.09, z + cz); g.add(m); };
    const W = 5, L = 18, t = 1.3;
    const on: Record<string, string> = { '3': 'abcdg', '6': 'acdefg' };
    const s = on[ch];
    if (s.includes('a')) seg(0, -L / 2, W, t);
    if (s.includes('g')) seg(0, 0, W, t);
    if (s.includes('d')) seg(0, L / 2, W, t);
    if (s.includes('b')) seg(W / 2, -L / 4, t, L / 2);
    if (s.includes('c')) seg(W / 2, L / 4, t, L / 2);
    if (s.includes('e')) seg(-W / 2, L / 4, t, L / 2);
    if (s.includes('f')) seg(-W / 2, -L / 4, t, L / 2);
  }

  update(dt: number) {
    this.t += dt;
    const period = 1.0;
    const phase = (this.t % period) / period;
    const n = this.strobes.length;
    for (let i = 0; i < n; i++) {
      const p = i / n;
      const d = ((phase - p) % 1 + 1) % 1;
      const on = d < 0.06;
      const s = on ? 2.4 : 0.35;
      this.strobes[i].scale.setScalar(s);
      this.strobeMat[i].color.setScalar(on ? 9 : 0.6);
    }
  }
}
