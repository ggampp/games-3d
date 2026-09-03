import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const GRADE = {
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    uVignette: { value: 0.35 },
    uWarm: { value: 0.06 },
    uFlash: { value: 0 },
    uHit: { value: 0 },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float uVignette;
    uniform float uWarm;
    uniform float uFlash;
    uniform float uHit;
    varying vec2 vUv;
    void main() {
      vec4 c = texture2D(tDiffuse, vUv);
      // leve aquecimento e contraste
      c.rgb = mix(c.rgb, c.rgb * vec3(1.05, 1.0, 0.92), uWarm);
      c.rgb = (c.rgb - 0.5) * 1.06 + 0.5;
      // vinheta
      vec2 d = vUv - 0.5;
      float v = smoothstep(0.85, 0.25, dot(d, d) * 2.2);
      c.rgb *= mix(1.0 - uVignette, 1.0, v);
      // flash de explosão e "hit" (aviso de dano/fogo perto)
      c.rgb += vec3(1.0, 0.9, 0.7) * uFlash;
      c.rgb = mix(c.rgb, c.rgb * vec3(1.2, 0.6, 0.4), uHit * (1.0 - v));
      gl_FragColor = c;
    }`,
};

/** Bloom só no que é bem claro (lanternas, laser, sol) + vinheta e cor. */
export class Post {
  private composer: EffectComposer;
  private bloom: UnrealBloomPass;
  private grade: ShaderPass;
  private flash = 0;
  private hit = 0;
  enabled = true;

  constructor(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera) {
    this.composer = new EffectComposer(renderer);
    this.composer.addPass(new RenderPass(scene, camera));
    const size = renderer.getSize(new THREE.Vector2());
    this.bloom = new UnrealBloomPass(new THREE.Vector2(size.x / 2, size.y / 2), 0.55, 0.6, 0.92);
    this.composer.addPass(this.bloom);
    this.grade = new ShaderPass(GRADE);
    this.composer.addPass(this.grade);
    this.composer.addPass(new OutputPass());
  }

  setSize(w: number, h: number): void {
    this.composer.setSize(w, h);
    this.bloom.resolution.set(w / 2, h / 2);
  }

  /** Clarão (0..1) que decai sozinho. */
  addFlash(v: number): void {
    this.flash = Math.min(1, this.flash + v);
  }

  setHit(v: number): void {
    this.hit = v;
  }

  render(dt: number): void {
    this.flash = Math.max(0, this.flash - dt * 3.2);
    this.grade.uniforms.uFlash.value = this.flash * 0.6;
    this.grade.uniforms.uHit.value = this.hit;
    this.composer.render(dt);
  }
}
