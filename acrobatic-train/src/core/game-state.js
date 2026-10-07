/** One attempt identity, terminal transitions and independent pause owners. */
export class GameState {
  mode = 'ready';
  screen = 'menu';
  runId = 0;
  pauseReasons = new Set();
  start() {
    if (!['ready', 'over', 'levelComplete'].includes(this.mode)) return false;
    this.runId += 1;
    this.pauseReasons.clear();
    this.mode = 'playing';
    this.screen = 'game';
    return true;
  }
  pause(reason) {
    if (!['playing', 'paused'].includes(this.mode) || !reason) return false;
    this.pauseReasons.add(reason);
    this.mode = 'paused';
    return true;
  }
  resume(reason) {
    if (this.mode !== 'paused') return false;
    this.pauseReasons.delete(reason);
    if (!this.pauseReasons.size) this.mode = 'playing';
    return true;
  }
  crash() {
    if (this.mode !== 'playing') return false;
    this.mode = 'crash';
    this.pauseReasons.clear();
    return true;
  }
  gameOver() {
    if (this.mode !== 'crash') return false;
    this.mode = 'over'; this.screen = 'result';
    return true;
  }
  complete() {
    if (this.mode !== 'playing') return false;
    this.mode = 'levelComplete'; this.screen = 'result';
    return true;
  }
  stop() {
    this.runId += 1;
    this.pauseReasons.clear();
    this.mode = 'ready'; this.screen = 'menu';
  }
  acceptsInput() { return this.mode === 'playing' && this.screen === 'game'; }
  showScreen(screen) {
    if (!['ready', 'over', 'levelComplete'].includes(this.mode) || !['menu', 'map', 'briefing', 'result'].includes(screen)) return false;
    this.screen = screen; return true;
  }
  isCurrent(id) { return id === this.runId && ['playing', 'paused'].includes(this.mode); }
  snapshot() {
    return Object.freeze({ mode: this.mode, screen: this.screen, runId: this.runId, pauseReasons: [...this.pauseReasons] });
  }
}
