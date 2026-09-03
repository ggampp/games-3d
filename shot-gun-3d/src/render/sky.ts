import * as THREE from 'three';

export type TimeOfDay = 'noon' | 'dusk' | 'night';
export const TIMES: TimeOfDay[] = ['noon', 'dusk', 'night'];

interface Preset {
  sunDir: THREE.Vector3;
  sunColor: number;
  sunIntensity: number;
  hemiSky: number;
  hemiGround: number;
  hemiIntensity: number;
  top: number;
  horizon: number;
  ground: number;
  fog: number;
  fogNear: number;
  fogFar: number;
  lantern: number;
  exposure: number;
  sunDisc: number;
}

const PRESETS: Record<TimeOfDay, Preset> = {
  noon: {
    sunDir: new THREE.Vector3(0.45, 0.8, 0.35), sunColor: 0xfff1d0, sunIntensity: 1.6,
    hemiSky: 0xdbeaff, hemiGround: 0xc4a574, hemiIntensity: 0.7,
    top: 0x4f8fd6, horizon: 0xd6e4f0, ground: 0xe6d6b8, fog: 0xd3dfea, fogNear: 24, fogFar: 75,
    lantern: 0.6, exposure: 1.05, sunDisc: 1,
  },
  dusk: {
    sunDir: new THREE.Vector3(0.9, 0.16, -0.2), sunColor: 0xffb070, sunIntensity: 1.1,
    hemiSky: 0xffa870, hemiGround: 0x5a4a60, hemiIntensity: 0.55,
    top: 0x3a3f7a, horizon: 0xff9a5a, ground: 0xc98a6a, fog: 0xe0a080, fogNear: 18, fogFar: 60,
    lantern: 1.4, exposure: 1.0, sunDisc: 1.6,
  },
  night: {
    sunDir: new THREE.Vector3(-0.3, 0.7, 0.5), sunColor: 0x9fb4ff, sunIntensity: 0.55,
    hemiSky: 0x4a5a90, hemiGround: 0x2a2630, hemiIntensity: 0.7,
    top: 0x0a1030, horizon: 0x2a3a66, ground: 0x181a2c, fog: 0x1c2440, fogNear: 14, fogFar: 52,
    lantern: 2.6, exposure: 1.0, sunDisc: 0,
  },
};

const VERT = `
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  vec4 p = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * p;
  gl_Position.z = gl_Position.w; // sempre no fundo
}`;

const FRAG = `
precision highp float;
varying vec3 vDir;
uniform vec3 uTop;
uniform vec3 uHorizon;
uniform vec3 uGround;
uniform vec3 uSun;
uniform vec3 uSunColor;
uniform float uSunDisc;
uniform float uStars;
uniform float uTime;
float hash(vec3 p) { return fract(sin(dot(p, vec3(12.9898, 78.233, 45.164))) * 43758.5453); }
void main() {
  float h = vDir.y;
  vec3 col;
  if (h >= 0.0) {
    float t = pow(clamp(h, 0.0, 1.0), 0.55);
    col = mix(uHorizon, uTop, t);
  } else {
    col = mix(uHorizon, uGround, clamp(-h * 6.0, 0.0, 1.0));
  }
  float s = max(dot(vDir, uSun), 0.0);
  col += uSunColor * (pow(s, 256.0) * 2.4 + pow(s, 12.0) * 0.28) * uSunDisc;
  if (uStars > 0.0 && h > 0.02) {
    vec3 g = floor(vDir * 140.0);
    float r = hash(g);
    float star = step(0.992, r) * (0.6 + 0.4 * sin(uTime * 2.0 + r * 60.0));
    col += vec3(star) * uStars * smoothstep(0.02, 0.2, h);
  }
  gl_FragColor = vec4(col, 1.0);
}`;

/** Céu procedural com sol, estrelas, nuvens planas e ciclo de dia por presets. */
export class Sky {
  readonly group = new THREE.Group();
  private mat: THREE.ShaderMaterial;
  private clouds: THREE.Mesh[] = [];
  private cloudMat: THREE.MeshBasicMaterial;
  private sun: THREE.DirectionalLight;
  private hemi: THREE.HemisphereLight;
  private scene: THREE.Scene;
  private renderer: THREE.WebGLRenderer;
  private current: Preset = PRESETS.noon;
  private target: Preset = PRESETS.noon;
  private blend = 1;
  private time: TimeOfDay = 'noon';
  private t = 0;

  constructor(scene: THREE.Scene, renderer: THREE.WebGLRenderer, sun: THREE.DirectionalLight, hemi: THREE.HemisphereLight) {
    this.scene = scene;
    this.renderer = renderer;
    this.sun = sun;
    this.hemi = hemi;
    this.mat = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: {
        uTop: { value: new THREE.Color() },
        uHorizon: { value: new THREE.Color() },
        uGround: { value: new THREE.Color() },
        uSun: { value: new THREE.Vector3(0, 1, 0) },
        uSunColor: { value: new THREE.Color() },
        uSunDisc: { value: 1 },
        uStars: { value: 0 },
        uTime: { value: 0 },
      },
      side: THREE.BackSide,
      depthWrite: false,
      depthTest: false,
      fog: false,
    });
    const dome = new THREE.Mesh(new THREE.SphereGeometry(100, 32, 16), this.mat);
    dome.name = 'sky';
    dome.renderOrder = -10;
    dome.frustumCulled = false;
    this.group.add(dome);

    // Nuvens: planos com textura procedural macia.
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 128;
    const ctx = c.getContext('2d')!;
    ctx.clearRect(0, 0, 256, 128);
    for (let i = 0; i < 26; i++) {
      const x = 40 + Math.random() * 176;
      const y = 40 + Math.random() * 48;
      const r = 18 + Math.random() * 30;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, 'rgba(255,255,255,0.55)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    this.cloudMat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, fog: false, opacity: 0.9 });
    for (let i = 0; i < 10; i++) {
      const w = 26 + Math.random() * 30;
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, w * 0.5), this.cloudMat);
      const a = Math.random() * Math.PI * 2;
      const d = 30 + Math.random() * 45;
      m.position.set(Math.cos(a) * d, 26 + Math.random() * 14, Math.sin(a) * d);
      m.rotation.x = -Math.PI / 2;
      m.rotation.z = Math.random() * Math.PI;
      m.renderOrder = -5;
      this.clouds.push(m);
      this.group.add(m);
    }

    // Montanhas distantes: pirâmides baixas em degraus, cor de terra, quase na névoa.
    const hillMat = new THREE.MeshStandardMaterial({ color: 0xb59c78, roughness: 1, flatShading: true });
    for (let i = 0; i < 20; i++) {
      const a = (i / 20) * Math.PI * 2 + 0.2;
      const d = 68 + (i % 3) * 6;
      const h = 3.5 + ((i * 7) % 5) * 1.4;
      const steps = 6;
      const g = new THREE.Group();
      const base = 12 + (i % 4) * 4;
      for (let s = 0; s < steps; s++) {
        const r = base * (1 - s / steps);
        const box = new THREE.Mesh(new THREE.BoxGeometry(r * 2, h / steps + 0.02, r * 1.3), hillMat);
        box.position.y = (s + 0.5) * (h / steps) - 0.6;
        g.add(box);
      }
      g.position.set(Math.cos(a) * d, 0, Math.sin(a) * d);
      g.rotation.y = i * 0.9;
      this.group.add(g);
    }

    this.apply(PRESETS.noon, 0);
  }

  get timeOfDay(): TimeOfDay {
    return this.time;
  }

  setTime(t: TimeOfDay): void {
    this.time = t;
    this.current = this.snapshot();
    this.target = PRESETS[t];
    this.blend = 0;
  }

  nextTime(): TimeOfDay {
    const i = (TIMES.indexOf(this.time) + 1) % TIMES.length;
    this.setTime(TIMES[i]);
    return this.time;
  }

  /** Multiplicador de intensidade das lanternas para o horário atual. */
  get lanternBoost(): number {
    return this.lerpNum(this.current.lantern, this.target.lantern);
  }

  private lerpNum(a: number, b: number): number {
    return a + (b - a) * this.blend;
  }

  private snapshot(): Preset {
    const b = this.blend;
    const c = this.current;
    const t = this.target;
    const lc = (x: number, y: number) => new THREE.Color(x).lerp(new THREE.Color(y), b).getHex();
    return {
      sunDir: c.sunDir.clone().lerp(t.sunDir, b).normalize(),
      sunColor: lc(c.sunColor, t.sunColor),
      sunIntensity: c.sunIntensity + (t.sunIntensity - c.sunIntensity) * b,
      hemiSky: lc(c.hemiSky, t.hemiSky),
      hemiGround: lc(c.hemiGround, t.hemiGround),
      hemiIntensity: c.hemiIntensity + (t.hemiIntensity - c.hemiIntensity) * b,
      top: lc(c.top, t.top), horizon: lc(c.horizon, t.horizon), ground: lc(c.ground, t.ground), fog: lc(c.fog, t.fog),
      fogNear: c.fogNear + (t.fogNear - c.fogNear) * b,
      fogFar: c.fogFar + (t.fogFar - c.fogFar) * b,
      lantern: c.lantern + (t.lantern - c.lantern) * b,
      exposure: c.exposure + (t.exposure - c.exposure) * b,
      sunDisc: c.sunDisc + (t.sunDisc - c.sunDisc) * b,
    };
  }

  private apply(p: Preset, stars: number): void {
    const u = this.mat.uniforms;
    (u.uTop.value as THREE.Color).set(p.top);
    (u.uHorizon.value as THREE.Color).set(p.horizon);
    (u.uGround.value as THREE.Color).set(p.ground);
    (u.uSun.value as THREE.Vector3).copy(p.sunDir).normalize();
    (u.uSunColor.value as THREE.Color).set(p.sunColor);
    u.uSunDisc.value = p.sunDisc;
    u.uStars.value = stars;
    this.sun.color.set(p.sunColor);
    this.sun.intensity = p.sunIntensity;
    this.hemi.color.set(p.hemiSky);
    this.hemi.groundColor.set(p.hemiGround);
    this.hemi.intensity = p.hemiIntensity;
    if (this.scene.fog instanceof THREE.Fog) {
      this.scene.fog.color.set(p.fog);
      this.scene.fog.near = p.fogNear;
      this.scene.fog.far = p.fogFar;
    }
    this.renderer.toneMappingExposure = p.exposure;
    this.cloudMat.color.set(p.horizon).lerp(new THREE.Color(0xffffff), 0.5);
  }

  /** Direção do sol atual (para posicionar a luz que segue o jogador). */
  sunDirection(out: THREE.Vector3): THREE.Vector3 {
    return out.copy(this.mat.uniforms.uSun.value as THREE.Vector3);
  }

  update(dt: number, playerX: number, playerZ: number): void {
    this.t += dt;
    this.mat.uniforms.uTime.value = this.t;
    if (this.blend < 1) {
      this.blend = Math.min(1, this.blend + dt * 0.5);
      const p = this.snapshot();
      const stars = this.time === 'night' ? this.blend : 0;
      this.apply(p, stars);
      if (this.blend >= 1) this.current = this.target;
    }
    for (const c of this.clouds) {
      c.position.x += dt * 0.35;
      if (c.position.x > 80) c.position.x = -80;
    }
    this.group.position.set(playerX, 0, playerZ);
    for (const c of this.clouds) c.position.y = 26 + Math.sin(this.t * 0.05 + c.id) * 1.5;
  }
}
