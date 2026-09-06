/**
 * Construtor de modelos low-poly: acumula primitivas coloridas e funde tudo
 * numa única BufferGeometry com cor por vértice (1 draw call por modelo).
 * Flat shading vem do material; cada peça mantém sua cor.
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const SHARED_MAT = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });

export interface PartTransform {
  x?: number;
  y?: number;
  z?: number;
  rx?: number;
  ry?: number;
  rz?: number;
  sx?: number;
  sy?: number;
  sz?: number;
}

function applyTransform(geo: THREE.BufferGeometry, t: PartTransform): void {
  if (t.sx !== undefined || t.sy !== undefined || t.sz !== undefined) {
    geo.scale(t.sx ?? 1, t.sy ?? 1, t.sz ?? 1);
  }
  if (t.rx) geo.rotateX(t.rx);
  if (t.ry) geo.rotateY(t.ry);
  if (t.rz) geo.rotateZ(t.rz);
  if (t.x || t.y || t.z) geo.translate(t.x ?? 0, t.y ?? 0, t.z ?? 0);
}

function paint(geo: THREE.BufferGeometry, color: THREE.Color): void {
  const count = geo.attributes.position.count;
  const colors = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    colors[i * 3] = color.r;
    colors[i * 3 + 1] = color.g;
    colors[i * 3 + 2] = color.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
}

export class LowPolyBuilder {
  private parts: THREE.BufferGeometry[] = [];
  private tmp = new THREE.Color();

  /** Adiciona uma geometria já pronta (é consumida: não reutilize). */
  add(geo: THREE.BufferGeometry, color: string, t: PartTransform = {}): this {
    const g = geo.index ? geo.toNonIndexed() : geo;
    if (g !== geo) geo.dispose();
    g.deleteAttribute('uv');
    applyTransform(g, t);
    this.tmp.set(color);
    paint(g, this.tmp);
    this.parts.push(g);
    return this;
  }

  /** Caixa com a base em `y` (pivot no chão, como nas construções). */
  box(w: number, h: number, d: number, color: string, x = 0, y = 0, z = 0, t: PartTransform = {}): this {
    return this.add(new THREE.BoxGeometry(w, h, d), color, { ...t, x, y: y + h / 2, z });
  }

  /** Caixa centrada em (x, y, z) — útil para peças de veículos. */
  boxAt(w: number, h: number, d: number, color: string, x = 0, y = 0, z = 0, t: PartTransform = {}): this {
    return this.add(new THREE.BoxGeometry(w, h, d), color, { ...t, x, y, z });
  }

  /** Cilindro vertical com a base em `y`. */
  cyl(rTop: number, rBot: number, h: number, color: string, x = 0, y = 0, z = 0, seg = 12, t: PartTransform = {}): this {
    return this.add(new THREE.CylinderGeometry(rTop, rBot, h, seg), color, { ...t, x, y: y + h / 2, z });
  }

  /** Cilindro deitado ao longo de X, centrado em (x, y, z). */
  tube(r: number, length: number, color: string, x = 0, y = 0, z = 0, seg = 14, rEnd = r): this {
    return this.add(new THREE.CylinderGeometry(r, rEnd, length, seg), color, { rz: Math.PI / 2, x, y, z });
  }

  cone(r: number, h: number, color: string, x = 0, y = 0, z = 0, seg = 12): this {
    return this.add(new THREE.ConeGeometry(r, h, seg), color, { x, y: y + h / 2, z });
  }

  /** Telhado de quatro águas (pirâmide esticada) com a base em `y`. */
  roof(w: number, h: number, d: number, color: string, y: number, x = 0, z = 0): this {
    const geo = new THREE.CylinderGeometry(0, Math.SQRT1_2, h, 4, 1);
    geo.rotateY(Math.PI / 4);
    geo.scale(w, 1, d);
    return this.add(geo, color, { x, y: y + h / 2, z });
  }

  /** Telhado de duas águas: prisma triangular ao longo de X, base em `y`. */
  gable(w: number, h: number, d: number, color: string, y: number, x = 0, z = 0, overhang = 0.25): this {
    const shape = new THREE.Shape();
    shape.moveTo(-d / 2 - overhang, 0);
    shape.lineTo(d / 2 + overhang, 0);
    shape.lineTo(0, h);
    shape.closePath();
    const geo = new THREE.ExtrudeGeometry(shape, { depth: w + overhang * 2, bevelEnabled: false });
    // Extrude cresce em +Z: girar para o comprimento ficar ao longo de X.
    geo.rotateY(Math.PI / 2);
    geo.translate(-(w + overhang * 2) / 2 + 0, 0, 0);
    return this.add(geo, color, { x, y, z });
  }

  torus(r: number, tube: number, color: string, x = 0, y = 0, z = 0, t: PartTransform = {}, seg = 8, rad = 16): this {
    return this.add(new THREE.TorusGeometry(r, tube, seg, rad), color, { ...t, x, y, z });
  }

  get isEmpty(): boolean {
    return this.parts.length === 0;
  }

  /** Funde tudo num Mesh (materia compartilhado com cor por vértice). */
  build(name = ''): THREE.Mesh {
    const merged = this.parts.length > 0 ? mergeGeometries(this.parts, false) : null;
    for (const part of this.parts) part.dispose();
    this.parts = [];
    const mesh = new THREE.Mesh(merged ?? new THREE.BufferGeometry(), SHARED_MAT);
    mesh.name = name;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  }
}

/** Material emissivo para faróis, janelas acesas e lâmpadas. */
export function glowMaterial(color: string, emissive = color, intensity = 0.9): THREE.MeshLambertMaterial {
  return new THREE.MeshLambertMaterial({
    color,
    emissive: new THREE.Color(emissive),
    emissiveIntensity: intensity,
    flatShading: true,
  });
}
