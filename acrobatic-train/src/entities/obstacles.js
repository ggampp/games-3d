import { disposeObject } from '../scene/resources.js';
export function createWorkBarrier(Three, { length = 1.6, width = 2.2, height = 3.2 } = {}) {
  const group = new Three.Group();
  const yellow = new Three.MeshStandardMaterial({ color: 0xffc857, roughness: 0.65 });
  const black = new Three.MeshStandardMaterial({ color: 0x121820, roughness: 0.8 });
  const body = new Three.Mesh(new Three.BoxGeometry(length, height, width), yellow);
  body.position.y = height / 2; group.add(body);
  for (const z of [-0.7, 0, 0.7]) {
    const stripe = new Three.Mesh(new Three.BoxGeometry(0.02, height, 0.23), black);
    stripe.position.set(length / 2 + 0.01, height / 2, z); group.add(stripe);
    const back = stripe.clone(); back.position.x = -length / 2 - 0.01; group.add(back);
  }
  group.traverse(o => { if (o.isMesh) o.castShadow = o.receiveShadow = true; });
  return { group, dispose: () => disposeObject(group) };
}
