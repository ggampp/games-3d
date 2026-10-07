export const PROGRESS_KEY = 'acrobatic_train_campaign_v1';
export const CONTENT_VERSION = 'm4-v1';
export const TROPHY_ID = 'campaign-9-complete';
const ids = Array.from({ length: 9 }, (_, i) => `level-0${i + 1}`);
/** Levels with shipped content. */
export const PLAYABLE_LEVELS = Object.freeze(ids.slice());
const empty = () => ({ schemaVersion: 1, contentVersion: CONTENT_VERSION, highestUnlockedLevel: 1, results: {}, achievements: [] });
const validScore = value => Number.isSafeInteger(value) && value >= 0;
const validTime = value => Number.isFinite(value) && value > 0 && value <= 3600;

/** Campaign-only writer: never reads or writes shop keys. */
export class ProgressStore {
  #seen = new Set();
  constructor(storage = null) {
    this.storage = storage; this.data = empty(); this.storageError = !storage; this.warning = ''; this.readOnly = false;
    try { const raw = storage?.getItem(PROGRESS_KEY); if (raw) this.load(JSON.parse(raw)); }
    catch (error) {
      this.storageError = !(error instanceof SyntaxError);
      this.warning = error instanceof SyntaxError ? 'Progresso corrompido recuperado. Compras preservadas.' : 'Não foi possível ler o progresso. A campanha continua nesta sessão.';
    }
    if (this.storageError) this.warning = 'Progresso nesta sessão apenas: armazenamento indisponível.';
  }
  load(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) { this.warning = 'Progresso inválido recuperado. Compras preservadas.'; return; }
    const version = value.schemaVersion ?? value.version;
    if (version !== 0 && version !== 1) { this.readOnly = true; this.warning = 'Versão do progresso não suportada. O arquivo foi preservado; esta sessão usa memória.'; return; }
    const results = version === 0 ? Object.fromEntries((Array.isArray(value.completedLevels) ? value.completedLevels : []).filter(id => ids.includes(id)).map(id => [id, { completed: true, bestScore: validScore(value.bestScores?.[id]) ? value.bestScores[id] : 0, bestTimeS: validTime(value.bestTimes?.[id]) ? value.bestTimes[id] : null, completions: 1 }])) : value.results;
    if (!results || typeof results !== 'object' || Array.isArray(results)) { this.warning = 'Progresso inválido recuperado. Compras preservadas.'; return; }
    for (const id of ids) {
      const result = Object.hasOwn(results, id) ? results[id] : null;
      if (!result || result.completed !== true || !validScore(result.bestScore) || (result.bestTimeS !== null && !validTime(result.bestTimeS))) break;
      this.data.results[id] = { completed: true, bestScore: result.bestScore, bestTimeS: result.bestTimeS, completions: validScore(result.completions) && result.completions > 0 ? result.completions : 1 };
    }
    this.data.highestUnlockedLevel = Math.min(9, Object.keys(this.data.results).length + 1);
    if (version === 1 && ((value.highestUnlockedLevel !== undefined && value.highestUnlockedLevel !== this.data.highestUnlockedLevel) || Object.keys(results).some(id => !ids.includes(id) || !this.data.results[id]))) this.warning = 'Progresso inválido parcialmente recuperado. Compras preservadas.';
    // The trophy is derived from nine valid official results; a stored flag alone never grants it.
    this.data.achievements = Object.keys(this.data.results).length === 9 ? [TROPHY_ID] : [];
  }
  canPlay(id) { return PLAYABLE_LEVELS.includes(id) && Number(id.slice(-2)) <= this.data.highestUnlockedLevel; }
  continueLevelId() {
    for (const id of PLAYABLE_LEVELS) if (this.canPlay(id) && !this.data.results[id]) return id;
    return `level-0${Math.min(PLAYABLE_LEVELS.length, this.data.highestUnlockedLevel)}`;
  }
  complete({ levelId, score, timeS, eventId, source = 'campaign' }) {
    if (source !== 'campaign' || !this.canPlay(levelId) || !validScore(score) || !validTime(timeS) || typeof eventId !== 'string' || !eventId || this.#seen.has(eventId)) return false;
    this.#seen.add(eventId);
    const previous = this.data.results[levelId];
    this.data.results[levelId] = { completed: true, bestScore: Math.max(previous?.bestScore ?? 0, score), bestTimeS: Math.min(previous?.bestTimeS ?? Infinity, timeS), completions: Math.min(Number.MAX_SAFE_INTEGER, (previous?.completions ?? 0) + 1) };
    this.data.highestUnlockedLevel = Math.max(this.data.highestUnlockedLevel, Math.min(9, Number(levelId.slice(-2)) + 1));
    if (Object.keys(this.data.results).length === 9 && !this.data.achievements.includes(TROPHY_ID)) this.data.achievements = [TROPHY_ID];
    if (!this.readOnly) {
      try { if (!this.storage) throw Error('unavailable'); this.storage.setItem(PROGRESS_KEY, JSON.stringify(this.data)); }
      catch { this.storageError = true; this.warning = 'Não foi possível salvar. O progresso foi mantido nesta sessão.'; }
    }
    return true;
  }
  hasTrophy() { return this.data.achievements.includes(TROPHY_ID); }
  snapshot() { return { ...JSON.parse(JSON.stringify(this.data)), warning: this.warning, storageError: this.storageError }; }
}
