import * as THREE from 'three';

// Colisão simples do jogador (círculo no plano XZ) contra AABBs do cenário.
// Cada colisor é um THREE.Box3 em espaço de mundo. Só bloqueia no plano
// horizontal: o jogador não sobe em cima de nada, mas também não atravessa.

export class CollisionWorld {
  constructor() {
    this.boxes = [];
  }

  addBox(box3) {
    this.boxes.push(box3);
    return box3;
  }

  // Cria uma AABB a partir de centro + tamanho (útil para props posicionados à mão)
  addBoxAt(cx, cz, sx, sz, height = 3, y0 = 0) {
    const box = new THREE.Box3(
      new THREE.Vector3(cx - sx / 2, y0, cz - sz / 2),
      new THREE.Vector3(cx + sx / 2, y0 + height, cz + sz / 2)
    );
    return this.addBox(box);
  }

  // AABB de um objeto já posicionado na cena (usa a matriz de mundo atual)
  addFromObject(obj, padding = 0) {
    obj.updateWorldMatrix(true, true);
    const box = new THREE.Box3().setFromObject(obj);
    box.expandByScalar(padding);
    return this.addBox(box);
  }

  // Empurra a posição (Vector3) para fora de todas as caixas que o círculo penetra.
  // feetY = altura dos pés do jogador; caixas cujo topo está abaixo de feetY + 0.3 são ignoradas
  // (degraus baixos como o piso da varanda não travam o movimento).
  resolveCircle(position, radius, feetY) {
    for (let iter = 0; iter < 3; iter++) {
      let moved = false;
      for (const box of this.boxes) {
        if (box.max.y < feetY + 0.35) continue;
        if (box.min.y > feetY + 1.6) continue;

        // Ponto mais próximo da caixa em XZ
        const cx = Math.max(box.min.x, Math.min(position.x, box.max.x));
        const cz = Math.max(box.min.z, Math.min(position.z, box.max.z));
        const dx = position.x - cx;
        const dz = position.z - cz;
        const distSq = dx * dx + dz * dz;

        if (distSq >= radius * radius) continue;

        if (distSq > 1e-6) {
          // Fora da caixa mas dentro do raio: empurra ao longo da normal
          const dist = Math.sqrt(distSq);
          const push = radius - dist;
          position.x += (dx / dist) * push;
          position.z += (dz / dist) * push;
        } else {
          // Centro dentro da caixa: sai pelo eixo de menor penetração
          const left = position.x - box.min.x + radius;
          const right = box.max.x - position.x + radius;
          const back = position.z - box.min.z + radius;
          const front = box.max.z - position.z + radius;
          const min = Math.min(left, right, back, front);
          if (min === left) position.x = box.min.x - radius;
          else if (min === right) position.x = box.max.x + radius;
          else if (min === back) position.z = box.min.z - radius;
          else position.z = box.max.z + radius;
        }
        moved = true;
      }
      if (!moved) break;
    }
  }
}

// --- Testes de raio contra hitboxes locais (bandidos e alvos) ---

const _inv = new THREE.Matrix4();
const _ray = new THREE.Ray();
const _pt = new THREE.Vector3();

// Interseção de um raio de mundo com uma Box3 definida no espaço local do objeto.
// Retorna a distância no mundo ou null.
export function rayHitsLocalBox(rayWorld, object, localBox) {
  _inv.copy(object.matrixWorld).invert();
  _ray.copy(rayWorld).applyMatrix4(_inv);
  const hit = _ray.intersectBox(localBox, _pt);
  if (!hit) return null;
  _pt.applyMatrix4(object.matrixWorld);
  return _pt.distanceTo(rayWorld.origin);
}

// Interseção com esfera definida no espaço local (centro local, raio local)
const _sphere = new THREE.Sphere();
export function rayHitsLocalSphere(rayWorld, object, localCenter, radius) {
  _inv.copy(object.matrixWorld).invert();
  _ray.copy(rayWorld).applyMatrix4(_inv);
  _sphere.set(localCenter, radius);
  const hit = _ray.intersectSphere(_sphere, _pt);
  if (!hit) return null;
  _pt.applyMatrix4(object.matrixWorld);
  return _pt.distanceTo(rayWorld.origin);
}

export function rayHitsWorldSphere(rayWorld, center, radius) {
  _sphere.set(center, radius);
  const hit = rayWorld.intersectSphere(_sphere, _pt);
  if (!hit) return null;
  return _pt.distanceTo(rayWorld.origin);
}
