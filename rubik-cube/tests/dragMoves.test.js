import test from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveDragLayer,
  notationFromAngle,
  shortestSnapAngle,
  snapToCubeAxis
} from '../src/cube/dragMoves.js';

test('snapToCubeAxis escolhe o eixo dominante', () => {
  assert.deepEqual(snapToCubeAxis(0.9, 0.1, 0.05), { axis: 'x', sign: 1 });
  assert.deepEqual(snapToCubeAxis(-0.2, 0.8, 0.1), { axis: 'y', sign: 1 });
  assert.deepEqual(snapToCubeAxis(0.1, -0.1, -0.7), { axis: 'z', sign: -1 });
});

test('arraste horizontal na face F (topo) gira U', () => {
  // Normal +Z, cubie no topo (y=1), arraste para +X
  const layer = resolveDragLayer(0, 0, 1, 0, 1, 1, 1, 0, 0);
  assert.equal(layer.axis, 'y');
  assert.equal(layer.layer, 1);

  // Giro RH negativo em Y é U horário
  assert.equal(notationFromAngle('y', 1, -Math.PI / 2), 'U');
  assert.equal(notationFromAngle('y', 1, Math.PI / 2), "U'");
  assert.equal(notationFromAngle('y', 1, Math.PI), 'U2');
});

test('arraste vertical na face F (direita) gira R', () => {
  // Normal +Z, cubie x=1, arraste para -Y (para baixo na tela com câmera padrão)
  const layer = resolveDragLayer(0, 0, 1, 1, 0, 1, 0, -1, 0);
  assert.equal(layer.axis, 'x');
  assert.equal(layer.layer, 1);
  assert.equal(notationFromAngle('x', 1, -Math.PI / 2), 'R');
  assert.equal(notationFromAngle('x', 1, Math.PI / 2), "R'");
});

test('arraste na face U (frente) gira F', () => {
  const layer = resolveDragLayer(0, 1, 0, 0, 1, 1, 1, 0, 0);
  assert.equal(layer.axis, 'z');
  assert.equal(layer.layer, 1);
  assert.equal(notationFromAngle('z', 1, -Math.PI / 2), 'F');
});

test('D, L, M, E, S batem com o sentido do parseMove 3D', () => {
  assert.equal(notationFromAngle('y', -1, Math.PI / 2), 'D');
  assert.equal(notationFromAngle('x', -1, Math.PI / 2), 'L');
  assert.equal(notationFromAngle('x', 0, Math.PI / 2), 'M');
  assert.equal(notationFromAngle('y', 0, Math.PI / 2), 'E');
  assert.equal(notationFromAngle('z', 0, -Math.PI / 2), 'S');
});

test('ângulo pequeno não vira movimento', () => {
  assert.equal(notationFromAngle('y', 1, 0.2), null);
  assert.equal(shortestSnapAngle(0.3), 0);
  assert.ok(Math.abs(shortestSnapAngle(-1.4) + Math.PI / 2) < 1e-9);
});
