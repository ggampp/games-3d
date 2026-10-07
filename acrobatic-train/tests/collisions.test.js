import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { hitsBarrier, hitsPole, gapUnder, canCollect } from '../src/physics/collisions.js';
import { TRAIN_GEOMETRY } from '../src/physics/acrobatics.js';
import { createWorkBarrier } from '../src/entities/obstacles.js';
const pose = { dist: 100, front: 0, rear: 0, slant: 0, bottom: 0 };
test('F01-T02/T03: barrier volume, side passage, diagonal SAT and disposal agree', () => {
  const block = { s: 100, lat: 0, length: 1.6, width: 2.2, height: 3.2 };
  assert.equal(hitsBarrier(block, pose, TRAIN_GEOMETRY), true);
  assert.equal(hitsBarrier(block, { ...pose, front: 3.4, rear: 3.4 }, TRAIN_GEOMETRY), false);
  assert.equal(hitsBarrier(block, { ...pose, front: 3.4, rear: 0, slant: Math.asin(3.4 / (TRAIN_GEOMETRY.bogie * 2)) }, TRAIN_GEOMETRY), true);
  assert.equal(hitsBarrier(block, { ...pose, bottom: 3.3 }, TRAIN_GEOMETRY), false);
  const asset = createWorkBarrier(THREE, block), bounds = new THREE.Box3().setFromObject(asset.group);
  assert.ok(Math.abs(bounds.min.y) < 1e-6); assert.ok(Math.abs(bounds.max.y - block.height) < 1e-6);
  assert.ok(Math.abs(bounds.max.z - bounds.min.z - block.width) < 1e-6);
  const geometryCalls = new Map(), materialCalls = new Map();
  asset.group.traverse(o => {
    if (o.geometry && !geometryCalls.has(o.geometry)) { geometryCalls.set(o.geometry, 0); o.geometry.addEventListener('dispose', () => geometryCalls.set(o.geometry, geometryCalls.get(o.geometry) + 1)); }
    if (o.material && !materialCalls.has(o.material)) { materialCalls.set(o.material, 0); o.material.addEventListener('dispose', () => materialCalls.set(o.material, materialCalls.get(o.material) + 1)); }
  });
  asset.dispose(); assert.ok([...geometryCalls.values(), ...materialCalls.values()].every(n => n === 1));
});
test('F02-T02/T05: both support positions and gaps crossing a segment edge are checked', () => {
  const gaps = [{ tz: 0, a: 99, b: 107 }];
  assert.equal(gapUnder(gaps, 0, 103.8), true); assert.equal(gapUnder(gaps, 3.4, 103.8), false);
  assert.equal(gapUnder(gaps, 0, 100), true); assert.equal(gapUnder(gaps, 0, 107), true);
  assert.equal(gapUnder(gaps, 0, 96.2), false);
});
test('F03-T03: poles depend on height, airborne rewards cannot be taken from the ground', () => {
  const pole = { s: 100, lat: 0, h: 3.2, r: 0.16 };
  assert.equal(hitsPole(pole, pose, TRAIN_GEOMETRY), true);
  assert.equal(hitsPole(pole, { ...pose, bottom: 3.2 }, TRAIN_GEOMETRY), false);
  const item = { s: 100, lat: 0, y: 5.6, level: 1, taken: false };
  assert.equal(canCollect(item, pose, TRAIN_GEOMETRY), false);
  assert.equal(canCollect(item, { ...pose, bottom: 3 }, TRAIN_GEOMETRY), true);
  item.taken = true; assert.equal(canCollect(item, { ...pose, bottom: 3 }, TRAIN_GEOMETRY), false);
});
