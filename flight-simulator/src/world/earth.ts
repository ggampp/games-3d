import * as THREE from 'three';
import { EARTH_RADIUS_M } from '../geo/ecef';
import { createEarthTexture } from './earthTexture';

const vertex = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_vertex>
varying vec2 vUv;
varying vec3 vWorldNormal;
void main() {
  vUv = uv;
  vWorldNormal = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  #include <logdepthbuf_vertex>
}
`;

const fragment = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_fragment>
uniform sampler2D dayMap;
uniform sampler2D nightMap;
uniform vec3 sunDir;
varying vec2 vUv;
varying vec3 vWorldNormal;
void main() {
  #include <logdepthbuf_fragment>
  float light = dot(normalize(vWorldNormal), normalize(sunDir));
  float dayFactor = smoothstep(-0.04, 0.18, light);
  vec3 day = texture2D(dayMap, vUv).rgb;
  vec3 night = texture2D(nightMap, vUv).rgb;
  vec3 color = mix(night, day, dayFactor);
  float terminator = 1.0 - smoothstep(0.0, 0.22, abs(light));
  color += vec3(0.22, 0.12, 0.05) * terminator * 0.35;
  gl_FragColor = vec4(color, 1.0);
}
`;

function makeNightTexture(day: THREE.Texture): THREE.CanvasTexture {
  const image = day.image as HTMLCanvasElement | HTMLImageElement | ImageBitmap | undefined;
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Night canvas failed');
  ctx.fillStyle = '#03060d';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (image) {
    ctx.globalAlpha = 0.28;
    ctx.filter = 'brightness(0.35) saturate(0.4)';
    ctx.drawImage(image as CanvasImageSource, 0, 0, canvas.width, canvas.height);
  }
  ctx.globalAlpha = 1;
  ctx.filter = 'none';
  ctx.fillStyle = 'rgba(255, 214, 140, 0.18)';
  for (let i = 0; i < 120; i += 1) {
    ctx.beginPath();
    ctx.arc(Math.random() * canvas.width, Math.random() * canvas.height * 0.7 + 80, Math.random() * 2.2, 0, Math.PI * 2);
    ctx.fill();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function createEarth(): THREE.Mesh {
  const dayMap = createEarthTexture();
  const material = new THREE.ShaderMaterial({
    uniforms: {
      dayMap: { value: dayMap },
      nightMap: { value: makeNightTexture(dayMap) },
      sunDir: { value: new THREE.Vector3(1, 0.2, 0.3).normalize() },
    },
    vertexShader: vertex,
    fragmentShader: fragment,
  });
  const earth = new THREE.Mesh(new THREE.SphereGeometry(EARTH_RADIUS_M, 128, 96), material);
  earth.name = 'earth';
  return earth;
}

export function setEarthSun(earth: THREE.Mesh, direction: THREE.Vector3): void {
  const material = earth.material as THREE.ShaderMaterial;
  material.uniforms.sunDir.value.copy(direction).normalize();
}

export function tryLoadBlueMarble(earth: THREE.Mesh): void {
  const loader = new THREE.TextureLoader();
  loader.setCrossOrigin('anonymous');
  const material = earth.material as THREE.ShaderMaterial;
  loader.load(
    'https://cdn.jsdelivr.net/npm/three-globe/example/img/earth-blue-marble.jpg',
    (texture) => {
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = 8;
      material.uniforms.dayMap.value = texture;
    },
    undefined,
    () => undefined,
  );
  loader.load(
    'https://cdn.jsdelivr.net/npm/three-globe/example/img/earth-night.jpg',
    (texture) => {
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = 8;
      material.uniforms.nightMap.value = texture;
    },
    undefined,
    () => undefined,
  );
}
