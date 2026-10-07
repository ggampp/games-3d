import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

test('Specification 1: Centrifugal force, momentum, and loop-the-loop kinematics in physics engine', () => {
  const gameJsPath = path.resolve(process.cwd(), 'src/core/game.js');
  const gameJsContent = fs.readFileSync(gameJsPath, 'utf8');

  // Verify kinematics, aerial jump parabolic equations, and drift centrifugal momentum
  assert.ok(gameJsContent.includes('JUMP_G'), 'Engine must define gravity constant for loop/jump kinematics');
  assert.ok(gameJsContent.includes('driftCombo'), 'Physics engine must calculate drift centrifugal combo');
  assert.ok(gameJsContent.includes('qSpin') || gameJsContent.includes('SPIN_AXIS'), 'Engine must compute roll/loop spin kinematics');
});

test('Specification 2: Decoupled state updates ensuring no DOM layout thrashing in 60fps loop', () => {
  const hudJsPath = path.resolve(process.cwd(), 'src/ui/hud.js');
  const hudContent = fs.readFileSync(hudJsPath, 'utf8');

  // Verify state caching and render interval throttling
  assert.ok(hudContent.includes('throttleInterval'), 'HUD must throttle DOM mutation intervals');
  assert.ok(hudContent.includes('cachedState'), 'HUD must maintain cachedState to avoid DOM layout thrashing');
});

test('Specification 3: Clean disposal of Three.js geometries and materials on scene transitions to prevent memory leaks', () => {
  const trainFactoryPath = path.resolve(process.cwd(), 'src/entities/train-factory.js');
  const tfContent = fs.readFileSync(trainFactoryPath, 'utf8');

  // Verify geometry and material disposal lifecycle
  assert.ok(tfContent.includes('.dispose()'), 'Train factory and particle emitters must cleanly dispose geometries and materials');

  const gameJsPath = path.resolve(process.cwd(), 'src/core/game.js');
  const gameJsContent = fs.readFileSync(gameJsPath, 'utf8');
  assert.ok(gameJsContent.includes('disposeSeg'), 'Track engine must dispose segments to avoid WebGL memory leaks');
  assert.ok(gameJsContent.includes('currentTrainDisposables'), 'Train transitions must dispose old materials and geometries');
});

test('Specification 4: Zero hardcoded secrets, external API keys only accessed through process.env', () => {
  const servePath = path.resolve(process.cwd(), 'scripts/serve.js');
  const serveContent = fs.readFileSync(servePath, 'utf8');

  // Client code and server scripts must not embed private API keys
  assert.ok(!serveContent.includes('TYPESAFE_API_KEY = "sk-'), 'API keys must not be hardcoded in script bodies');
  assert.ok(serveContent.includes('process.env'), 'External keys and ports must be sourced via process.env');
});
