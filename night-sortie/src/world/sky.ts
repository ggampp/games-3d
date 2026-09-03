import * as THREE from 'three';
import { rng } from '../util/noise';
import { terrainHeight } from './terrain';

export function buildSky(): THREE.Mesh {
  const geo = new THREE.SphereGeometry(48000, 48, 24);
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { uTime: { value: 0 } },
    vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `
      varying vec3 vDir; uniform float uTime;
      void main(){
        float y = vDir.y;
        vec3 zenith = vec3(0.012,0.02,0.07);
        vec3 mid = vec3(0.05,0.045,0.14);
        vec3 horizon = vec3(0.32,0.12,0.36);
        vec3 glow = vec3(0.95,0.55,0.35);
        vec3 c = mix(mid, zenith, smoothstep(0.05, 0.6, y));
        c = mix(horizon, c, smoothstep(0.0, 0.12, y));
        // city light bloom on the far hills (north-east + south-west)
        float az = atan(vDir.x, -vDir.z);
        float city1 = exp(-pow((az - 0.65)/0.55, 2.0)) ;
        float city2 = exp(-pow((az + 2.4)/0.7, 2.0)) * 0.7;
        float cg = (city1 + city2) * exp(-max(y,0.0)*14.0) * 0.55;
        c += glow * cg;
        // cheap god rays from the glow
        float ray = sin(az*38.0 + uTime*0.05) * 0.5 + 0.5;
        c += glow * cg * ray * 0.25;
        // below horizon: dark ground haze
        c = mix(c, vec3(0.02,0.015,0.04), smoothstep(0.0, -0.08, y));
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
  const m = new THREE.Mesh(geo, mat);
  m.name = 'sky';
  m.frustumCulled = false;
  return m;
}

export function buildStars(): THREE.Points {
  const n = 2200;
  const r = rng(42);
  const pos = new Float32Array(n * 3), col = new Float32Array(n * 3), size = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const az = r() * Math.PI * 2;
    const el = Math.asin(r() * 0.95 + 0.04);
    const R = 45000;
    pos[i * 3] = Math.cos(el) * Math.sin(az) * R; pos[i * 3 + 1] = Math.sin(el) * R; pos[i * 3 + 2] = Math.cos(el) * Math.cos(az) * R;
    const b = 0.35 + r() * r() * 0.9;
    const warm = r();
    col[i * 3] = b * (0.85 + warm * 0.15); col[i * 3 + 1] = b * 0.9; col[i * 3 + 2] = b * (1.0 - warm * 0.2);
    size[i] = 1 + r() * r() * 2.5;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
    uniforms: { uTime: { value: 0 } },
    vertexShader: `attribute float aSize; varying vec3 vC; uniform float uTime; void main(){ vC = color * (0.8 + 0.2*sin(uTime*2.0 + position.x)); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); gl_PointSize = aSize; }`,
    fragmentShader: `varying vec3 vC; void main(){ vec2 d = gl_PointCoord - 0.5; float a = smoothstep(0.5, 0.1, length(d)); gl_FragColor = vec4(vC * a, a); }`,
    vertexColors: true,
  });
  const p = new THREE.Points(g, mat);
  p.frustumCulled = false;
  return p;
}

export function buildMoon(): THREE.Mesh {
  const geo = new THREE.SphereGeometry(700, 24, 16);
  const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.32, 0.35, 0.42), fog: false });
  const m = new THREE.Mesh(geo, mat);
  m.position.set(-18000, 14000, -34000);
  return m;
}

/** Thousands of tiny warm point lights on the far hills: the city. */
export function buildCityLights(): THREE.Points {
  const clusters = [
    { x: 6500, z: -9000, r: 2800, n: 5200 },
    { x: 8500, z: -5000, r: 1600, n: 1800 },
    { x: -7500, z: 6500, r: 2400, n: 3200 },
    { x: -3000, z: 8800, r: 1100, n: 900 },
    { x: 2500, z: -8800, r: 900, n: 700 },
  ];
  const total = clusters.reduce((a, c) => a + c.n, 0);
  const pos = new Float32Array(total * 3), col = new Float32Array(total * 3), size = new Float32Array(total), ph = new Float32Array(total);
  const r = rng(7);
  let i = 0;
  for (const c of clusters) {
    for (let k = 0; k < c.n; k++) {
      // denser towards the centre, some street-like alignment
      const a = r() * Math.PI * 2, d = Math.sqrt(r()) * c.r;
      let x = c.x + Math.cos(a) * d, z = c.z + Math.sin(a) * d;
      if (r() < 0.35) { x = Math.round(x / 60) * 60; } else if (r() < 0.5) { z = Math.round(z / 60) * 60; }
      const y = terrainHeight(x, z) + 4 + r() * 12;
      pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z;
      const t = r();
      // sodium / LED white / a few reds
      if (t < 0.7) { col[i * 3] = 1.0; col[i * 3 + 1] = 0.62; col[i * 3 + 2] = 0.28; }
      else if (t < 0.95) { col[i * 3] = 0.85; col[i * 3 + 1] = 0.9; col[i * 3 + 2] = 1.0; }
      else { col[i * 3] = 1.0; col[i * 3 + 1] = 0.2; col[i * 3 + 2] = 0.15; }
      size[i] = 1.5 + r() * 2.5;
      ph[i] = r() * 6.28;
      i++;
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
  g.setAttribute('aPhase', new THREE.BufferAttribute(ph, 1));
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, vertexColors: true,
    uniforms: { uTime: { value: 0 } },
    vertexShader: `attribute float aSize; attribute float aPhase; varying vec3 vC; varying float vA; uniform float uTime;
      void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0); float dist = -mv.z;
        float tw = 0.75 + 0.25 * sin(uTime * 3.0 + aPhase);
        vC = color * tw * 2.2; vA = smoothstep(30000.0, 4000.0, dist);
        gl_Position = projectionMatrix * mv; gl_PointSize = aSize * (1.0 + 6000.0 / max(dist, 300.0)); }`,
    fragmentShader: `varying vec3 vC; varying float vA; void main(){ vec2 d = gl_PointCoord - 0.5; float a = smoothstep(0.5, 0.05, length(d)) * vA; gl_FragColor = vec4(vC * a, a); }`,
  });
  const p = new THREE.Points(g, mat);
  p.frustumCulled = false;
  return p;
}
