import * as THREE from 'three';

const MAX_POINTS = 240;

export class Contrail {
  readonly line: THREE.Line;
  private readonly positions: Float32Array;
  private readonly geometry: THREE.BufferGeometry;
  private count = 0;

  constructor() {
    this.positions = new Float32Array(MAX_POINTS * 3);
    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    this.geometry.setDrawRange(0, 0);
    const material = new THREE.LineBasicMaterial({
      color: '#e8f4ff',
      transparent: true,
      opacity: 0.42,
      depthWrite: false,
    });
    this.line = new THREE.Line(this.geometry, material);
    this.line.frustumCulled = false;
    this.line.name = 'contrail';
  }

  reset(): void {
    this.count = 0;
    this.geometry.setDrawRange(0, 0);
  }

  push(point: THREE.Vector3): void {
    if (this.count < MAX_POINTS) {
      const i = this.count * 3;
      this.positions[i] = point.x;
      this.positions[i + 1] = point.y;
      this.positions[i + 2] = point.z;
      this.count += 1;
    } else {
      this.positions.copyWithin(0, 3);
      const i = (MAX_POINTS - 1) * 3;
      this.positions[i] = point.x;
      this.positions[i + 1] = point.y;
      this.positions[i + 2] = point.z;
    }
    const attr = this.geometry.getAttribute('position') as THREE.BufferAttribute;
    attr.needsUpdate = true;
    this.geometry.setDrawRange(0, this.count);
    this.geometry.computeBoundingSphere();
  }
}
