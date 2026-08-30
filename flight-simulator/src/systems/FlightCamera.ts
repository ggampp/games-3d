import * as THREE from 'three';
import { EARTH_RADIUS_M, geodeticNorth, haversineM, latLonAltToVector } from '../geo/ecef';
import { interpolateGreatCircle } from '../geo/greatCircle';
import type { AirportFix } from '../flight/types';

export type CameraMode = 'chase' | 'orbit' | 'cockpit' | 'wing' | 'globe';

export type GlobeFrame = {
  lat: number;
  lon: number;
  origin: AirportFix | null;
  destination: AirportFix | null;
};

const look = new THREE.Vector3();
const desired = new THREE.Vector3();
const up = new THREE.Vector3();
const axisX = new THREE.Vector3();
const axisY = new THREE.Vector3();
const axisZ = new THREE.Vector3();
const aim = new THREE.Vector3();
const focusPos = new THREE.Vector3();
const north = new THREE.Vector3();

function worldAxes(object: THREE.Object3D): void {
  object.updateWorldMatrix(true, false);
  const e = object.matrixWorld.elements;
  axisX.set(e[0], e[1], e[2]).normalize();
  axisY.set(e[4], e[5], e[6]).normalize();
  axisZ.set(e[8], e[9], e[10]).normalize();
}

function offsetFrom(object: THREE.Object3D, x: number, y: number, z: number, target: THREE.Vector3): THREE.Vector3 {
  worldAxes(object);
  object.getWorldPosition(target);
  return target.addScaledVector(axisX, x).addScaledVector(axisY, y).addScaledVector(axisZ, z);
}

export class FlightCamera {
  mode: CameraMode = 'chase';
  orbitTheta = 0.55;
  orbitPhi = 0.42;
  orbitRadius = 160;
  globe: GlobeFrame | null = null;
  globeLift = 7_200_000;
  private dragging = false;
  private lastX = 0;
  private lastY = 0;

  constructor(
    private readonly camera: THREE.PerspectiveCamera,
    private readonly canvas: HTMLCanvasElement,
  ) {
    this.camera.near = 2;
    this.camera.far = 45_000_000;
    this.camera.fov = 52;
    this.camera.updateProjectionMatrix();
    canvas.addEventListener('pointerdown', this.onDown);
    window.addEventListener('pointermove', this.onMove);
    window.addEventListener('pointerup', this.onUp);
    canvas.addEventListener('wheel', this.onWheel, { passive: false });
  }

  setMode(mode: CameraMode): void {
    this.mode = mode;
    if (mode === 'chase') this.camera.fov = 50;
    if (mode === 'orbit') this.camera.fov = 48;
    if (mode === 'cockpit') this.camera.fov = 72;
    if (mode === 'wing') this.camera.fov = 55;
    if (mode === 'globe') this.camera.fov = 38;
    this.camera.updateProjectionMatrix();
    if (mode === 'globe') this.fitGlobeLift();
  }

  fitGlobeLift(): void {
    const frame = this.globe;
    if (!frame?.origin || !frame.destination) {
      this.globeLift = 6_500_000;
      return;
    }
    const span = haversineM(
      frame.origin.lat,
      frame.origin.lon,
      frame.destination.lat,
      frame.destination.lon,
    );
    this.globeLift = THREE.MathUtils.clamp(span * 0.62, 4_200_000, 11_000_000);
  }

  snap(aircraft: THREE.Object3D): void {
    this.update(aircraft, true);
  }

  update(aircraft: THREE.Object3D, _snap = false): void {
    aircraft.getWorldPosition(look);
    up.copy(look).normalize();

    if (this.mode === 'globe') {
      this.updateGlobe();
      return;
    }

    if (this.mode === 'orbit') {
      const sinPhi = Math.sin(this.orbitPhi);
      offsetFrom(
        aircraft,
        Math.cos(this.orbitTheta) * sinPhi * this.orbitRadius,
        Math.cos(this.orbitPhi) * this.orbitRadius * 0.55 + 12,
        Math.sin(this.orbitTheta) * sinPhi * this.orbitRadius,
        desired,
      );
      this.camera.position.copy(desired);
      this.camera.up.copy(up);
      this.camera.lookAt(look);
      return;
    }

    if (this.mode === 'cockpit') {
      offsetFrom(aircraft, 0, 2.6, 41, desired);
      this.camera.position.copy(desired);
      offsetFrom(aircraft, 0, 1.4, 90, aim);
      this.camera.up.copy(up);
      this.camera.lookAt(aim);
      return;
    }

    if (this.mode === 'wing') {
      offsetFrom(aircraft, 16, 4.2, 4, desired);
      this.camera.position.copy(desired);
      offsetFrom(aircraft, 2, 1, 18, aim);
      this.camera.up.copy(up);
      this.camera.lookAt(aim);
      return;
    }

    offsetFrom(aircraft, 20, 12, -68, desired);
    this.camera.position.copy(desired);
    offsetFrom(aircraft, 0, 2, 24, aim);
    this.camera.up.copy(up);
    this.camera.lookAt(aim);
  }

  dispose(): void {
    this.canvas.removeEventListener('pointerdown', this.onDown);
    window.removeEventListener('pointermove', this.onMove);
    window.removeEventListener('pointerup', this.onUp);
    this.canvas.removeEventListener('wheel', this.onWheel);
  }

  private updateGlobe(): void {
    const frame = this.globe;
    const aircraft = { lat: frame?.lat ?? 0, lon: frame?.lon ?? 0 };
    let focus = aircraft;
    if (frame?.origin && frame.destination) {
      const mid = interpolateGreatCircle(
        { lat: frame.origin.lat, lon: frame.origin.lon },
        { lat: frame.destination.lat, lon: frame.destination.lon },
        0.42,
      );
      focus = interpolateGreatCircle(mid, aircraft, 0.4);
    }
    latLonAltToVector(focus.lat, focus.lon, 0, focusPos);
    desired.copy(focusPos).normalize().multiplyScalar(EARTH_RADIUS_M + this.globeLift);
    this.camera.position.copy(desired);
    geodeticNorth(focus.lat, focus.lon, north);
    this.camera.up.copy(north);
    this.camera.lookAt(focusPos);
  }

  private readonly onDown = (event: PointerEvent) => {
    this.dragging = true;
    this.lastX = event.clientX;
    this.lastY = event.clientY;
    if (this.mode === 'chase') this.setMode('orbit');
  };

  private readonly onMove = (event: PointerEvent) => {
    if (!this.dragging || this.mode === 'globe') return;
    const dx = event.clientX - this.lastX;
    const dy = event.clientY - this.lastY;
    this.lastX = event.clientX;
    this.lastY = event.clientY;
    this.orbitTheta += dx * 0.005;
    this.orbitPhi = THREE.MathUtils.clamp(this.orbitPhi + dy * 0.004, 0.12, 1.35);
  };

  private readonly onUp = () => {
    this.dragging = false;
  };

  private readonly onWheel = (event: WheelEvent) => {
    event.preventDefault();
    if (this.mode === 'globe') {
      const factor = event.deltaY > 0 ? 1.08 : 0.92;
      this.globeLift = THREE.MathUtils.clamp(this.globeLift * factor, 2_400_000, 16_000_000);
      return;
    }
    this.orbitRadius = THREE.MathUtils.clamp(this.orbitRadius + event.deltaY * 0.08, 40, 900);
  };
}
