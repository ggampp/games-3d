import * as THREE from 'three';

type Particle = {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  life: number;
};

export class BurstParticles {
  private readonly items: Particle[] = [];
  private readonly geometry = new THREE.SphereGeometry(0.05, 6, 6);

  constructor(
    private readonly scene: THREE.Scene,
    private reduce: boolean,
  ) {}

  setReduce(value: boolean): void {
    this.reduce = value;
  }

  spawn(origin: THREE.Vector3, color: string): void {
    const count = this.reduce ? 4 : 10;
    const material = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 1 });
    for (let i = 0; i < count; i += 1) {
      const mesh = new THREE.Mesh(this.geometry, material);
      mesh.position.copy(origin);
      mesh.position.y += 0.4;
      const velocity = new THREE.Vector3((Math.random() - 0.5) * 1.4, 1.4 + Math.random(), (Math.random() - 0.5) * 1.4);
      this.scene.add(mesh);
      this.items.push({ mesh, velocity, life: 0.55 });
    }
  }

  update(dt: number): void {
    for (let i = this.items.length - 1; i >= 0; i -= 1) {
      const item = this.items[i]!;
      item.life -= dt;
      item.mesh.position.addScaledVector(item.velocity, dt);
      item.velocity.y -= 1.8 * dt;
      const material = item.mesh.material as THREE.MeshBasicMaterial;
      material.opacity = Math.max(0, item.life / 0.55);
      if (item.life <= 0) {
        this.scene.remove(item.mesh);
        material.dispose();
        this.items.splice(i, 1);
      }
    }
  }

  dispose(): void {
    for (const item of this.items) {
      this.scene.remove(item.mesh);
      (item.mesh.material as THREE.Material).dispose();
    }
    this.items.length = 0;
    this.geometry.dispose();
  }
}
