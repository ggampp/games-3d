/**
 * ChallengeProgress.js
 * Persistência do progresso dos desafios (estrelas, melhor tempo, menos movimentos)
 * com regras de desbloqueio. O storage é injetável para testes em Node.
 */

import { ALL_CHALLENGES, getPreviousChallenge } from './ChallengeDefs.js';

export const PROGRESS_KEY = 'rubik_challenges_v1';

export class ChallengeProgress {
  constructor(storage = null) {
    this.storage = storage || (typeof localStorage !== 'undefined' ? localStorage : null);
    this.data = this.load();
  }

  load() {
    if (!this.storage) return { version: 1, results: {} };
    try {
      const raw = this.storage.getItem(PROGRESS_KEY);
      if (!raw) return { version: 1, results: {} };
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object' || !parsed.results) return { version: 1, results: {} };
      return parsed;
    } catch {
      return { version: 1, results: {} };
    }
  }

  save() {
    if (!this.storage) return;
    try {
      this.storage.setItem(PROGRESS_KEY, JSON.stringify(this.data));
    } catch (e) {
      console.warn('Não foi possível salvar o progresso dos desafios:', e);
    }
  }

  get(id) {
    return this.data.results[id] || null;
  }

  getStars(id) {
    const r = this.get(id);
    return r ? r.stars : 0;
  }

  /**
   * Registra um resultado, mantendo sempre o melhor (mais estrelas, menos movimentos, menor tempo).
   * @returns {{ stars:number, bestMoves:number|null, bestTimeMs:number|null, plays:number, improved:boolean }}
   */
  record(id, { stars = 0, moves = null, timeMs = null } = {}) {
    const prev = this.get(id) || { stars: 0, bestMoves: null, bestTimeMs: null, plays: 0 };
    const next = {
      stars: Math.max(prev.stars, stars),
      bestMoves: moves === null ? prev.bestMoves : (prev.bestMoves === null ? moves : Math.min(prev.bestMoves, moves)),
      bestTimeMs: timeMs === null ? prev.bestTimeMs : (prev.bestTimeMs === null ? timeMs : Math.min(prev.bestTimeMs, timeMs)),
      plays: prev.plays + 1,
      completedAt: stars > 0 ? new Date().toISOString() : (prev.completedAt || null)
    };
    const improved = next.stars > prev.stars;
    this.data.results[id] = next;
    this.save();
    return { ...next, improved };
  }

  /** Primeiro de cada trilha é livre; os demais exigem >= 1 estrela no anterior. */
  isUnlocked(id) {
    const prev = getPreviousChallenge(id);
    if (!prev) return true;
    return this.getStars(prev.id) >= 1;
  }

  totalStars() {
    return ALL_CHALLENGES.reduce((acc, c) => acc + this.getStars(c.id), 0);
  }

  maxStars() {
    return ALL_CHALLENGES.length * 3;
  }

  reset() {
    this.data = { version: 1, results: {} };
    this.save();
  }
}
