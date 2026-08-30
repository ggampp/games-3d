import { haversineM, headingToQuaternion, initialBearingDeg, latLonAltToVector } from '../geo/ecef';
import { interpolateGreatCircle } from '../geo/greatCircle';
import type { ActiveFlight, CatalogFlight, FlightSample } from './types';
import * as THREE from 'three';

function altitudeProfile(t: number, originAlt: number, destAlt: number, cruiseAlt: number): number {
  const climbEnd = 0.045;
  const descentStart = 0.91;
  if (t <= climbEnd) {
    const u = t / climbEnd;
    const eased = 1 - (1 - u) ** 2;
    return originAlt + (cruiseAlt - originAlt) * eased;
  }
  if (t >= descentStart) {
    const u = (t - descentStart) / (1 - descentStart);
    const eased = u * u;
    return cruiseAlt + (destAlt - cruiseAlt) * eased;
  }
  const cruiseT = (t - climbEnd) / (descentStart - climbEnd);
  return cruiseAlt + Math.sin(cruiseT * Math.PI) * 180;
}

function pitchProfile(t: number): number {
  if (t < 0.04) return 12 * (1 - t / 0.04) + 2;
  if (t > 0.93) return -2.5;
  return 2.2;
}

export function catalogToActive(flight: CatalogFlight): ActiveFlight {
  return {
    callsign: flight.callsign,
    flightNumber: flight.flightNumber,
    airline: flight.airline,
    aircraft: flight.aircraft,
    origin: flight.origin,
    destination: flight.destination,
    source: 'replay',
    icao24: flight.icao24,
    durationSec: flight.durationSec,
    cruiseAltM: flight.cruiseAltM,
  };
}

export function sampleReplay(flight: CatalogFlight, t01: number): FlightSample {
  const t = THREE.MathUtils.clamp(t01, 0, 1);
  const origin = { lat: flight.origin.lat, lon: flight.origin.lon };
  const dest = { lat: flight.destination.lat, lon: flight.destination.lon };
  const here = interpolateGreatCircle(origin, dest, t);
  const ahead = interpolateGreatCircle(origin, dest, Math.min(1, t + 0.002));
  const altM = altitudeProfile(t, flight.origin.altM, flight.destination.altM, flight.cruiseAltM);
  const heading = initialBearingDeg(here.lat, here.lon, ahead.lat, ahead.lon);
  const distance = haversineM(origin.lat, origin.lon, dest.lat, dest.lon);
  const speedMps = distance / Math.max(1, flight.durationSec);
  let verticalRateMps = 0;
  if (t < 0.045) verticalRateMps = 12;
  if (t > 0.91) verticalRateMps = -10;
  return {
    lat: here.lat,
    lon: here.lon,
    altM,
    heading,
    speedMps,
    verticalRateMps,
    onGround: t <= 0.002 || t >= 0.998,
    timestamp: Date.now(),
  };
}

export function poseFromSample(
  sample: FlightSample,
  pitchDeg?: number,
  targetPos = new THREE.Vector3(),
  targetQuat = new THREE.Quaternion(),
): { position: THREE.Vector3; quaternion: THREE.Quaternion } {
  latLonAltToVector(sample.lat, sample.lon, sample.altM, targetPos);
  const pitch = pitchDeg ?? (sample.verticalRateMps > 4 ? 8 : sample.verticalRateMps < -4 ? -3 : 2.2);
  headingToQuaternion(sample.lat, sample.lon, sample.heading, pitch, 0, targetQuat);
  return { position: targetPos, quaternion: targetQuat };
}

export { pitchProfile };
