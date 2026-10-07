import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { disposeObject } from '../src/scene/resources.js';
import { SteamSmokeEmitter } from '../src/entities/train-factory.js';
import { TransformInterpolation } from '../src/scene/interpolation.js';
globalThis.THREE = THREE;

test('render interpolation does not change authoritative motion, even if render throws', () => {
  const object = new THREE.Object3D(), interpolation = new TransformInterpolation();
  interpolation.capture([object]); object.position.x = 10; object.rotation.y = Math.PI / 2;
  const authoritative = object.quaternion.clone();
  interpolation.render([object], 0.5, () => { assert.equal(object.position.x, 5); assert.ok(Math.abs(object.rotation.y - Math.PI / 4) < 1e-6); });
  assert.equal(object.position.x, 10);
  assert.ok(object.quaternion.equals(authoritative));
  assert.throws(() => interpolation.render([object], 0.2, () => { throw Error('render'); }));
  assert.equal(object.position.x, 10);
  interpolation.clear(); assert.equal(interpolation.previous.size, 0);
});

test('shared resources in a carriage are disposed exactly once', () => {
  let geometryCalls = 0, materialCalls = 0, textureCalls = 0;
  const texture = { isTexture: true, dispose: () => textureCalls++ };
  const geometry = { dispose: () => geometryCalls++ }, material = { map: texture, dispose: () => materialCalls++ };
  disposeObject({ traverse: callback => { callback({ geometry, material }); callback({ geometry, material: [material] }); } });
  assert.equal(geometryCalls, 1); assert.equal(materialCalls, 1);
  assert.equal(textureCalls, 1);
});

test('expired smoke frees cloned geometry AND material; emitter releases its owners', () => {
  const scene = new THREE.Scene(), emitter = new SteamSmokeEmitter(scene);
  emitter.spawnParticle(new THREE.Vector3(), new THREE.Quaternion(), 0);
  const particle = emitter.particles[0]; let geometryCalls = 0, materialCalls = 0;
  particle.mesh.geometry.addEventListener('dispose', () => geometryCalls++);
  particle.mesh.material.addEventListener('dispose', () => materialCalls++);
  emitter.update(3, new THREE.Vector3(), new THREE.Quaternion(), 0);
  assert.equal(geometryCalls, 1); assert.equal(materialCalls, 1);
  emitter.dispose(); assert.equal(scene.children.length, 0);
});
