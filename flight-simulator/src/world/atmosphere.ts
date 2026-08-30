import * as THREE from 'three';
import { EARTH_RADIUS_M } from '../geo/ecef';

const vertex = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_vertex>
varying vec3 vWorldPosition;
varying vec3 vNormal;
void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  vWorldPosition = world.xyz;
  vNormal = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * world;
  #include <logdepthbuf_vertex>
}
`;

const fragment = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_fragment>
uniform vec3 uGlow;
uniform float uPower;
varying vec3 vWorldPosition;
varying vec3 vNormal;
void main() {
  #include <logdepthbuf_fragment>
  vec3 viewDir = normalize(cameraPosition - vWorldPosition);
  float fresnel = pow(1.0 - abs(dot(viewDir, normalize(vNormal))), uPower);
  gl_FragColor = vec4(uGlow, fresnel * 0.92);
}
`;

export function createAtmosphere(): THREE.Mesh {
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uGlow: { value: new THREE.Color('#79b7ff') },
      uPower: { value: 3.4 },
    },
    vertexShader: vertex,
    fragmentShader: fragment,
    blending: THREE.AdditiveBlending,
    side: THREE.BackSide,
    transparent: true,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(EARTH_RADIUS_M * 1.025, 64, 48), material);
  mesh.name = 'atmosphere';
  return mesh;
}
