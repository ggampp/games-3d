import * as THREE from 'three';

export function createClouds(): THREE.Group {
  const group = new THREE.Group();
  const material = new THREE.MeshLambertMaterial({ color: '#fff8ee', transparent: true, opacity: 0.82 });
  const spots = [
    [-6, 4.2, -3],
    [5.5, 3.8, 2],
    [-1.5, 4.6, 5],
    [7, 4.0, -6],
  ];
  for (const [x, y, z] of spots) {
    const puff = new THREE.Group();
    puff.position.set(x, y, z);
    for (const offset of [
      [0, 0, 0],
      [0.7, 0.1, 0.2],
      [-0.55, 0.05, 0.3],
    ]) {
      const ball = new THREE.Mesh(new THREE.SphereGeometry(0.55, 10, 8), material);
      ball.position.set(offset[0], offset[1], offset[2]);
      puff.add(ball);
    }
    group.add(puff);
  }
  return group;
}

export function driftClouds(group: THREE.Group, elapsed: number): void {
  group.children.forEach((child, index) => {
    child.position.x += Math.sin(elapsed * 0.12 + index) * 0.002;
    child.position.z += Math.cos(elapsed * 0.09 + index) * 0.0015;
  });
}
