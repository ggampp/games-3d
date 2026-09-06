import * as THREE from 'three';
import { headingToQuaternion, latLonAltToVector } from '../geo/ecef';
import type { MissionSpec, RingStatus, StormSpec } from '../missions/types';

const COLORS: Record<RingStatus, THREE.Color> = {
  upcoming: new THREE.Color('#5d7fb3'),
  next: new THREE.Color('#ffb547'),
  passed: new THREE.Color('#2fe37a'),
  missed: new THREE.Color('#ff4d4d'),
};

const RING_TUBE_RATIO = 0.075;

/** Anéis (tori) e nuvens de tempestade de uma missão, em coordenadas ECEF do globo. */
export class MissionRings {
  readonly group = new THREE.Group();
  private rings: THREE.Mesh[] = [];
  private markers: THREE.Mesh[] = [];
  private storms: THREE.Group[] = [];
  private readonly ringMaterials: THREE.MeshBasicMaterial[] = [];
  private readonly markerMaterials: THREE.MeshBasicMaterial[] = [];
  private readonly puffGeometry = new THREE.IcosahedronGeometry(1, 1);

  constructor() {
    this.group.name = 'mission-rings';
    this.group.visible = false;
  }

  set(spec: MissionSpec | null): void {
    this.clear();
    if (!spec) return;
    spec.rings.forEach((ring) => {
      const geometry = new THREE.TorusGeometry(ring.radiusM, ring.radiusM * RING_TUBE_RATIO, 12, 48);
      const material = new THREE.MeshBasicMaterial({
        color: COLORS.upcoming.clone(),
        transparent: true,
        opacity: 0.85,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      const mesh = new THREE.Mesh(geometry, material);
      latLonAltToVector(ring.lat, ring.lon, ring.altM, mesh.position);
      headingToQuaternion(ring.lat, ring.lon, ring.headingDeg, 0, 0, mesh.quaternion);
      mesh.frustumCulled = false;
      // Marcador central (disco fino) para leitura à distância.
      const markerMaterial = new THREE.MeshBasicMaterial({
        color: COLORS.upcoming.clone(),
        transparent: true,
        opacity: 0.18,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      const marker = new THREE.Mesh(new THREE.CircleGeometry(ring.radiusM * 0.92, 32), markerMaterial);
      marker.position.copy(mesh.position);
      marker.quaternion.copy(mesh.quaternion);
      marker.frustumCulled = false;
      // Haste vertical até a "sombra" do anel, dá noção de altitude.
      const pole = new THREE.Mesh(
        new THREE.CylinderGeometry(ring.radiusM * 0.04, ring.radiusM * 0.04, ring.radiusM * 2.6, 6),
        markerMaterial,
      );
      pole.position.y = -ring.radiusM * 2.3;
      mesh.add(pole);
      this.group.add(mesh, marker);
      this.rings.push(mesh);
      this.markers.push(marker);
      this.ringMaterials.push(material);
      this.markerMaterials.push(markerMaterial);
    });
    spec.storms.forEach((storm) => this.addStorm(storm));
    this.group.visible = true;
  }

  private addStorm(storm: StormSpec): void {
    const cluster = new THREE.Group();
    latLonAltToVector(storm.lat, storm.lon, storm.altM, cluster.position);
    headingToQuaternion(storm.lat, storm.lon, 0, 0, 0, cluster.quaternion);
    const material = new THREE.MeshLambertMaterial({
      color: '#4b5262',
      emissive: '#151a26',
      transparent: true,
      opacity: 0.82,
      flatShading: true,
    });
    const rng = mulberry32(Math.round(storm.lat * 1000 + storm.lon * 7));
    for (let i = 0; i < 26; i += 1) {
      const puff = new THREE.Mesh(this.puffGeometry, material);
      const angle = rng() * Math.PI * 2;
      const radial = rng() * storm.radiusM * 0.85;
      puff.position.set(Math.cos(angle) * radial, (rng() - 0.35) * storm.radiusM * 0.9, Math.sin(angle) * radial);
      puff.scale.setScalar(storm.radiusM * (0.28 + rng() * 0.34));
      puff.frustumCulled = false;
      cluster.add(puff);
    }
    // núcleo escuro
    const core = new THREE.Mesh(
      this.puffGeometry,
      new THREE.MeshLambertMaterial({ color: '#2a2f3b', transparent: true, opacity: 0.9, flatShading: true }),
    );
    core.scale.setScalar(storm.radiusM * 0.55);
    core.frustumCulled = false;
    cluster.add(core);
    this.group.add(cluster);
    this.storms.push(cluster);
  }

  update(status: readonly RingStatus[], elapsed: number): void {
    for (let i = 0; i < this.rings.length; i += 1) {
      const state = status[i] ?? 'upcoming';
      const material = this.ringMaterials[i];
      const marker = this.markerMaterials[i];
      material.color.copy(COLORS[state]);
      marker.color.copy(COLORS[state]);
      if (state === 'next') {
        const pulse = 0.5 + 0.5 * Math.sin(elapsed * 5);
        material.opacity = 0.75 + pulse * 0.25;
        marker.opacity = 0.14 + pulse * 0.16;
        this.rings[i].scale.setScalar(1 + pulse * 0.05);
      } else {
        material.opacity = state === 'upcoming' ? 0.55 : 0.75;
        marker.opacity = state === 'upcoming' ? 0.1 : 0.16;
        this.rings[i].scale.setScalar(1);
      }
      this.markers[i].visible = state !== 'passed';
    }
    for (const storm of this.storms) {
      storm.rotation.y += 0.0004;
    }
  }

  clear(): void {
    for (const child of [...this.group.children]) {
      this.group.remove(child);
      child.traverse((node) => {
        if (node instanceof THREE.Mesh) {
          if (node.geometry !== this.puffGeometry) node.geometry.dispose();
          const mat = node.material;
          if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
          else mat.dispose();
        }
      });
    }
    this.rings = [];
    this.markers = [];
    this.storms = [];
    this.ringMaterials.length = 0;
    this.markerMaterials.length = 0;
    this.group.visible = false;
  }
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
