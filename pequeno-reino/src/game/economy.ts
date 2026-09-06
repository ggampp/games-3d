import type { Evaluation, Harmony, Score } from './types';

/** Custo de um pacote novo, em moedas. */
export const PACK_COST = 2;
/** Descartes gratuitos por fase. */
export const DISCARDS_PER_PHASE = 3;
/** Tamanho da mão. */
export const HAND_SIZE = 3;
/** Pontos extras por cadeia fechada (combo). */
export const COMBO_BONUS = 3;

/**
 * Moedas do reino: pão vale 2, os demais recursos valem 1.
 * É o que se gasta em pacotes novos.
 */
export function coinsOf(evaluation: Evaluation): number {
  const r = evaluation.resources;
  return r.pao * 2 + r.farinha + r.madeira + r.peixe + r.pedra;
}

export function harmonyTotal(h: Harmony): number {
  return h.natureza + h.povo + h.agua;
}

/**
 * Pontuação: cada ponto de cor vale 1, o equilíbrio (menor das três cores) vale 2 por ponto,
 * cada habitante vale 1 e combos somam o bônus acumulado. Estrelas dependem do tamanho do baralho.
 */
export function scoreOf(evaluation: Evaluation, deckSize: number, questsDone: boolean, bonus = 0): Score {
  const harmonia = harmonyTotal(evaluation.harmony);
  const equilibrio = 2 * Math.min(evaluation.harmony.natureza, evaluation.harmony.povo, evaluation.harmony.agua);
  const povo = evaluation.resources.populacao;
  const total = harmonia + equilibrio + povo + bonus;
  const star2 = Math.round(deckSize * 1.6);
  const star3 = Math.round(deckSize * 2.4);
  let stars: Score['stars'] = 0;
  if (questsDone) stars = 1;
  if (questsDone && total >= star2) stars = 2;
  if (questsDone && total >= star3) stars = 3;
  const nextStarAt = stars === 0 ? null : stars === 1 ? star2 : stars === 2 ? star3 : null;
  return { total, harmonia, equilibrio, povo, bonus, stars, nextStarAt };
}
