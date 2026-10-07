/** Domain events contain data only; subscribers own presentation and cleanup. */
export class EventBus {
  #listeners = new Map();
  on(type, listener) {
    if (!this.#listeners.has(type)) this.#listeners.set(type, new Set());
    this.#listeners.get(type).add(listener);
    return () => this.#listeners.get(type)?.delete(listener);
  }
  emit(type, data) {
    for (const listener of [...(this.#listeners.get(type) || [])]) listener(Object.freeze({ ...data }));
  }
  clear() { this.#listeners.clear(); }
}
