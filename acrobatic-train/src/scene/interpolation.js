/** Render interpolation temporarily changes transforms, never simulation state. */
export class TransformInterpolation {
  previous = new Map();
  capture(objects) {
    const active = new Set(objects);
    for (const object of this.previous.keys()) if (!active.has(object)) this.previous.delete(object);
    for (const object of objects) {
      let record = this.previous.get(object);
      if (!record) { record = { position: object.position.clone(), quaternion: object.quaternion.clone() }; this.previous.set(object, record); }
      record.position.copy(object.position); record.quaternion.copy(object.quaternion);
    }
  }
  render(objects, alpha, callback) {
    const saved = [];
    for (const object of objects) {
      const previous = this.previous.get(object);
      if (!previous) continue;
      const current = { object, position: object.position.clone(), quaternion: object.quaternion.clone() };
      saved.push(current);
      object.position.lerpVectors(previous.position, current.position, alpha);
      object.quaternion.slerpQuaternions(previous.quaternion, current.quaternion, alpha);
    }
    try { callback(); }
    finally { for (const record of saved) { record.object.position.copy(record.position); record.object.quaternion.copy(record.quaternion); } }
  }
  clear() { this.previous.clear(); }
}
