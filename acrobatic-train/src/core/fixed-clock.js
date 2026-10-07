/** Wall time is accumulated independently of the renderer and visual effects. */
export class FixedClock {
  constructor({ stepS = 1 / 60, maxSteps = 8, suspensionS = 0.25 } = {}) {
    this.stepS = stepS; this.maxSteps = maxSteps; this.suspensionS = suspensionS;
    this.reset();
  }
  reset() { this.lastMs = null; this.accumulator = 0; }
  frame(nowMs, step, onSuspension = () => {}) {
    if (this.lastMs === null) { this.lastMs = nowMs; return 0; }
    const elapsed = Math.max(0, (nowMs - this.lastMs) / 1000);
    this.lastMs = nowMs;
    if (elapsed > this.suspensionS) { this.accumulator = 0; onSuspension(); return 0; }
    this.accumulator += elapsed;
    let count = 0;
    while (this.accumulator + 1e-10 >= this.stepS && count < this.maxSteps) {
      this.accumulator = Math.max(0, this.accumulator - this.stepS);
      step(this.stepS); count += 1;
    }
    if (count === this.maxSteps && this.accumulator >= this.stepS) this.accumulator %= this.stepS;
    return count;
  }
}
