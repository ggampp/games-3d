import * as THREE from 'three';
import { sampleGreatCircle } from '../geo/greatCircle';
import { geodeticUp, latLonAltToVector } from '../geo/ecef';
import type { AirportFix } from '../flight/types';

const ROUTE_ALT_M = 18_000;
const HALF_WIDTH_M = 55_000;

function ribbonGeometry(points: THREE.Vector3[]): THREE.BufferGeometry {
  const positions: number[] = [];
  const up = new THREE.Vector3();
  const tangent = new THREE.Vector3();
  const side = new THREE.Vector3();
  for (let i = 0; i < points.length; i += 1) {
    const prev = points[Math.max(0, i - 1)];
    const next = points[Math.min(points.length - 1, i + 1)];
    tangent.copy(next).sub(prev).normalize();
    up.copy(points[i]).normalize();
    side.copy(tangent).cross(up).normalize().multiplyScalar(HALF_WIDTH_M);
    const a = points[i].clone().add(side);
    const b = points[i].clone().sub(side);
    positions.push(a.x, a.y, a.z, b.x, b.y, b.z);
  }
  const index: number[] = [];
  for (let i = 0; i < points.length - 1; i += 1) {
    const i0 = i * 2;
    index.push(i0, i0 + 1, i0 + 2, i0 + 1, i0 + 3, i0 + 2);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(index);
  geometry.computeVertexNormals();
  return geometry;
}

function toWorld(samples: { lat: number; lon: number }[]): THREE.Vector3[] {
  return samples.map((sample) => latLonAltToVector(sample.lat, sample.lon, ROUTE_ALT_M));
}

function pin(label: string, lat: number, lon: number): THREE.Group {
  const group = new THREE.Group();
  latLonAltToVector(lat, lon, 40_000, group.position);
  geodeticUp(lat, lon, group.up);
  group.lookAt(0, 0, 0);
  const disc = new THREE.Mesh(
    new THREE.CircleGeometry(90_000, 24),
    new THREE.MeshBasicMaterial({ color: '#d7dde8', side: THREE.DoubleSide, transparent: true, opacity: 0.9 }),
  );
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(90_000, 130_000, 24),
    new THREE.MeshBasicMaterial({ color: '#8aa0b8', side: THREE.DoubleSide }),
  );
  disc.rotation.x = Math.PI;
  ring.rotation.x = Math.PI;
  group.add(disc, ring);
  group.name = label;
  return group;
}

export class FlightRoute {
  readonly group = new THREE.Group();
  private planned: THREE.Mesh | null = null;
  private flown: THREE.Mesh | null = null;
  private worldPoints: THREE.Vector3[] = [];
  private flownCount = 0;

  set(origin: AirportFix, destination: AirportFix): void {
    this.clear();
    const samples = sampleGreatCircle(
      { lat: origin.lat, lon: origin.lon },
      { lat: destination.lat, lon: destination.lon },
      160,
    );
    this.worldPoints = toWorld(samples);
    this.planned = new THREE.Mesh(
      ribbonGeometry(this.worldPoints),
      new THREE.MeshBasicMaterial({
        color: '#3d6a52',
        transparent: true,
        opacity: 0.45,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    );
    this.flown = new THREE.Mesh(
      ribbonGeometry(this.worldPoints.slice(0, 2)),
      new THREE.MeshBasicMaterial({
        color: '#1ee67a',
        transparent: true,
        opacity: 0.95,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    );
    this.group.add(this.planned, this.flown, pin(origin.iata, origin.lat, origin.lon), pin(destination.iata, destination.lat, destination.lon));
  }

  setProgress(t01: number): void {
    if (!this.flown || this.worldPoints.length < 2) return;
    const count = Math.max(2, Math.floor(1 + t01 * (this.worldPoints.length - 1)));
    if (count === this.flownCount) return;
    this.flownCount = count;
    this.flown.geometry.dispose();
    this.flown.geometry = ribbonGeometry(this.worldPoints.slice(0, count));
  }

  private clear(): void {
    while (this.group.children.length > 0) {
      const child = this.group.children[0];
      this.group.remove(child);
      child.traverse((node) => {
        if (node instanceof THREE.Mesh) {
          node.geometry.dispose();
          const material = node.material;
          if (Array.isArray(material)) material.forEach((item) => item.dispose());
          else material.dispose();
        }
      });
    }
    this.planned = null;
    this.flown = null;
    this.worldPoints = [];
    this.flownCount = 0;
  }
}
