import test from 'node:test';
import assert from 'node:assert/strict';
import { HudManager } from '../src/ui/hud.js';

test('M1-T06: score, drift and progress share the HUD throttle, physics need not access DOM', () => {
  const hud = new HudManager(); let driftWrites = 0;
  hud.updateDriftCombo = () => driftWrites++;
  const snapshot = { score: 10, best: 10, bankPoints: 60, speedKmh: 50, front: 0, rear: 0, diagonal: true, driftCombo: 2, driftFill: 20, dist: 20, lengthM: 600 };
  for (let frame = 0; frame <= 60; frame++) hud.renderSnapshot(snapshot, frame * 1000 / 60);
  assert.ok(driftWrites <= 13 && driftWrites >= 10);
  assert.equal(hud.cachedState.score, 10); assert.equal(hud.cachedState.coins, 60);
  hud.dispose();
});
