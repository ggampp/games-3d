import { buildDeck, getPhase } from './catalog';
import { drawFrom, Rng, shuffleInPlace } from './deck';
import { coinsOf, COMBO_BONUS, DISCARDS_PER_PHASE, HAND_SIZE, PACK_COST, scoreOf } from './economy';
import { eventDue, RAIN_TURNS, rollEvent } from './events';
import { hexKey, type Hex } from './hex';
import { canPlace } from './placement';
import {
  CHAINS,
  chainsClosed,
  emptyResources,
  evaluateKingdom,
  harmonyFloats,
  placementFloats,
  type TileMap,
} from './production';
import { questProgress, requiredQuestsDone, type QuestProgress } from './quests';
import type {
  Evaluation,
  KingdomEvent,
  KingdomModifiers,
  PlaceFloat,
  PlacePreview,
  Resources,
  Score,
  SerializedSession,
  SessionStatus,
} from './types';

export type PlaceResult = {
  ok: boolean;
  reason?: string;
  floats: PlaceFloat[];
  evaluation: Evaluation;
  quests: QuestProgress[];
  status: SessionStatus;
  /** Verdadeiro na jogada em que as missões obrigatórias ficaram completas. */
  questsJustDone: boolean;
  /** Nomes das cadeias que fecharam nesta jogada (combo). */
  combos: string[];
  /** Evento de estação disparado nesta jogada, se houver. */
  event: KingdomEvent | null;
};

const START_TILE = 'clareira';

/** Diferença de cadeias fechadas entre dois estados, por id. */
export function newChains(before: string[], after: string[]): string[] {
  const pool = [...before];
  const added: string[] = [];
  for (const id of after) {
    const index = pool.indexOf(id);
    if (index >= 0) pool.splice(index, 1);
    else added.push(id);
  }
  return added;
}

function chainName(id: string): string {
  return CHAINS.find((chain) => chain.id === id)?.nome ?? id;
}

export class Session {
  phaseId: number;
  seed: number;
  map: TileMap = new Map();
  hand: string[] = [];
  deck: string[] = [];
  discard: string[] = [];
  selectedHandIndex: number | null = 0;
  turns = 0;
  status: SessionStatus = 'playing';
  spentCoins = 0;
  discardsLeft = DISCARDS_PER_PHASE;
  questsCelebrated = false;
  /** Produção acumulada turno a turno (missões "produza X"). */
  produced: Resources = emptyResources();
  rainTurns = 0;
  blighted: string[] = [];
  bonusCoins = 0;
  comboBonus = 0;
  eventsFired = 0;
  /** Tamanho do baralho inicial: base das estrelas. */
  readonly deckSize: number;
  private undoState: SerializedSession | null = null;
  private readonly rng: Rng;

  constructor(phaseId: number, seed = Date.now(), unlockedTiles: Iterable<string> = [], restore?: SerializedSession) {
    this.phaseId = phaseId;
    this.seed = restore?.seed ?? seed;
    this.rng = new Rng(restore?.rngState ?? this.seed);

    if (restore) {
      this.applyState(restore);
      this.undoState = restore.undo ?? null;
      this.questsCelebrated = restore.questsCelebrated ?? false;
      this.deckSize = this.deck.length + this.hand.length + this.discard.length + Math.max(0, this.map.size - 1);
      return;
    }

    this.map.set(hexKey({ q: 0, r: 0 }), START_TILE);
    this.deck = shuffleInPlace(buildDeck(getPhase(phaseId), unlockedTiles), () => this.rng.next());
    this.deckSize = this.deck.length;
    this.refillHand();
  }

  get phase() {
    return getPhase(this.phaseId);
  }

  /** Efeitos de eventos em vigor. */
  get modifiers(): KingdomModifiers {
    return { rain: this.rainTurns > 0, blighted: [...this.blighted] };
  }

  get evaluation(): Evaluation {
    return evaluateKingdom(this.map, this.modifiers);
  }

  get quests(): QuestProgress[] {
    return questProgress(this.phase.questIds, this.map, this.evaluation, { produced: this.produced });
  }

  get questsDone(): boolean {
    return this.phase.sandbox || requiredQuestsDone(this.quests);
  }

  get score(): Score {
    return scoreOf(this.evaluation, this.deckSize, this.questsDone, this.comboBonus);
  }

  get selectedTileId(): string | null {
    if (this.selectedHandIndex === null) return null;
    return this.hand[this.selectedHandIndex] ?? null;
  }

  /** Moedas disponíveis para gastar (produção mais eventos, menos o já gasto). */
  get coins(): number {
    return Math.max(0, coinsOf(this.evaluation) + this.bonusCoins - this.spentCoins);
  }

  get canBuyPack(): boolean {
    return this.status === 'playing' && this.coins >= PACK_COST && this.deck.length + this.discard.length > 0;
  }

  get canDiscard(): boolean {
    return this.status === 'playing' && this.discardsLeft > 0 && this.selectedTileId !== null && this.deck.length > 0;
  }

  get canUndo(): boolean {
    return this.status === 'playing' && this.undoState !== null;
  }

  /** O jogador pode encerrar a fase por vontade própria quando as missões estão feitas. */
  get canFinish(): boolean {
    return this.status === 'playing' && this.questsDone && this.map.size > 1;
  }

  /** Cartas restantes (baralho + descarte reciclável no sandbox). */
  get cardsLeft(): number {
    return this.deck.length + (this.phase.sandbox ? this.discard.length : 0);
  }

  /** Cartas até o próximo evento de estação. */
  get turnsToEvent(): number {
    const every = 5;
    return every - (this.turns % every);
  }

  /** Roças que ainda estão murchas (praga sem horta vizinha). */
  get activeBlight(): string[] {
    return this.blighted.filter((key) => this.map.get(key) === 'roca' && !this.hasNeighbor(key, 'horta'));
  }

  selectHand(index: number): void {
    if (index < 0 || index >= this.hand.length) return;
    this.selectedHandIndex = index;
  }

  /** Prévia do que uma carta renderia num hex, sem alterar nada. */
  preview(hex: Hex, tileId = this.selectedTileId): PlaceFloat[] {
    if (!tileId || !canPlace(this.map, hex)) return [];
    return placementFloats(this.map, hex, tileId, this.modifiers);
  }

  /** Prévia completa: deltas por cor, pontos, combos e missões que avançariam. */
  previewDetail(hex: Hex, tileId = this.selectedTileId): PlacePreview | null {
    if (!tileId || !canPlace(this.map, hex)) return null;
    const modifiers = this.modifiers;
    const before = evaluateKingdom(this.map, modifiers);
    const next = new Map(this.map);
    next.set(hexKey(hex), tileId);
    const after = evaluateKingdom(next, modifiers);
    const questsBefore = this.quests;
    const questsAfter = questProgress(this.phase.questIds, next, after, { produced: this.produced });
    const combos = newChains(chainsClosed(this.map), chainsClosed(next)).map(chainName);
    const scoreBefore = this.score.total;
    const scoreAfter = scoreOf(after, this.deckSize, this.phase.sandbox || requiredQuestsDone(questsAfter), this.comboBonus + combos.length * COMBO_BONUS).total;
    return {
      floats: harmonyFloats(before, after),
      harmony: { before: before.harmony, after: after.harmony },
      scoreDelta: scoreAfter - scoreBefore,
      combos,
      quests: questsAfter
        .map((quest, index) => ({
          titulo: quest.titulo,
          from: Math.min(questsBefore[index]?.current ?? 0, quest.amount),
          to: Math.min(quest.current, quest.amount),
          amount: quest.amount,
        }))
        .filter((quest) => quest.to !== quest.from),
    };
  }

  place(hex: Hex): PlaceResult {
    const fail = (reason: string): PlaceResult => ({
      ok: false,
      reason,
      floats: [],
      evaluation: this.evaluation,
      quests: this.quests,
      status: this.status,
      questsJustDone: false,
      combos: [],
      event: null,
    });
    if (this.status !== 'playing') return fail('fase-encerrada');
    const tileId = this.selectedTileId;
    if (!tileId) return fail('sem-carta');
    if (!canPlace(this.map, hex)) return fail('hex-invalido');

    const wasDone = this.questsDone;
    this.undoState = this.serialize(false);

    if (this.rainTurns > 0) this.rainTurns -= 1;
    const chainsBefore = chainsClosed(this.map);
    const floats = placementFloats(this.map, hex, tileId, this.modifiers);
    this.map.set(hexKey(hex), tileId);
    this.hand.splice(this.selectedHandIndex ?? 0, 1);
    this.turns += 1;

    const combos = newChains(chainsBefore, chainsClosed(this.map)).map(chainName);
    this.comboBonus += combos.length * COMBO_BONUS;

    let event: KingdomEvent | null = null;
    if (eventDue(this.turns)) {
      event = rollEvent(this.map, this.blighted, () => this.rng.next());
      if (event) this.applyEvent(event);
    }

    const produced = this.evaluation.resources;
    for (const key of Object.keys(this.produced) as Array<keyof Resources>) this.produced[key] += produced[key];

    this.refillHand();
    this.fixSelection();
    this.updateStatus();

    const questsJustDone = !this.phase.sandbox && !wasDone && this.questsDone;
    return {
      ok: true,
      floats,
      evaluation: this.evaluation,
      quests: this.quests,
      status: this.status,
      questsJustDone,
      combos,
      event,
    };
  }

  undo(): boolean {
    if (!this.canUndo || !this.undoState) return false;
    const prev = this.undoState;
    this.applyState(prev);
    this.rng.state = prev.rngState;
    this.undoState = null;
    return true;
  }

  discardCard(): boolean {
    if (!this.canDiscard || this.selectedHandIndex === null) return false;
    this.undoState = null;
    const [card] = this.hand.splice(this.selectedHandIndex, 1);
    if (card) this.discard.push(card);
    this.discardsLeft -= 1;
    this.refillHand();
    this.fixSelection();
    this.updateStatus();
    return true;
  }

  newPack(): { ok: boolean; reason?: string } {
    if (this.status !== 'playing') return { ok: false, reason: 'fase-encerrada' };
    if (!this.canBuyPack) return { ok: false, reason: 'sem-moedas' };
    this.undoState = null;
    this.spentCoins += PACK_COST;
    this.discard.push(...this.hand);
    this.hand = [];
    this.refillHand();
    this.selectedHandIndex = this.hand.length > 0 ? 0 : null;
    this.updateStatus();
    return { ok: true };
  }

  finishPhase(): boolean {
    if (!this.canFinish) return false;
    this.status = 'phaseComplete';
    return true;
  }

  serialize(withUndo = true): SerializedSession {
    return {
      version: 3,
      phaseId: this.phaseId,
      seed: this.seed,
      map: [...this.map.entries()],
      hand: [...this.hand],
      deck: [...this.deck],
      discard: [...this.discard],
      selectedHandIndex: this.selectedHandIndex,
      turns: this.turns,
      status: this.status,
      rngState: this.rng.state,
      spentCoins: this.spentCoins,
      discardsLeft: this.discardsLeft,
      undo: withUndo ? this.undoState : null,
      questsCelebrated: this.questsCelebrated,
      produced: { ...this.produced },
      rainTurns: this.rainTurns,
      blighted: [...this.blighted],
      bonusCoins: this.bonusCoins,
      comboBonus: this.comboBonus,
      eventsFired: this.eventsFired,
    };
  }

  private applyEvent(event: KingdomEvent): void {
    this.eventsFired += 1;
    if (event.id === 'chuva') this.rainTurns = RAIN_TURNS;
    if (event.id === 'praga' && event.target) this.blighted.push(event.target);
    if (event.id === 'feira') this.bonusCoins += event.coins;
  }

  /** Restaura o estado jogável (sem undo nem rng) de um snapshot; campos novos têm padrão. */
  private applyState(state: SerializedSession): void {
    this.map = new Map(state.map);
    this.hand = [...state.hand];
    this.deck = [...state.deck];
    this.discard = [...state.discard];
    this.selectedHandIndex = state.selectedHandIndex;
    this.turns = state.turns;
    this.status = state.status;
    this.spentCoins = state.spentCoins ?? 0;
    this.discardsLeft = state.discardsLeft ?? DISCARDS_PER_PHASE;
    this.produced = { ...emptyResources(), ...(state.produced ?? {}) };
    this.rainTurns = state.rainTurns ?? 0;
    this.blighted = [...(state.blighted ?? [])];
    this.bonusCoins = state.bonusCoins ?? 0;
    this.comboBonus = state.comboBonus ?? 0;
    this.eventsFired = state.eventsFired ?? 0;
  }

  private hasNeighbor(key: string, tileId: string): boolean {
    const [q, r] = key.split(',').map(Number);
    const dirs = [
      [1, 0],
      [1, -1],
      [0, -1],
      [-1, 0],
      [-1, 1],
      [0, 1],
    ];
    return dirs.some(([dq, dr]) => this.map.get(`${q! + dq!},${r! + dr!}`) === tileId);
  }

  private fixSelection(): void {
    if (this.hand.length === 0) this.selectedHandIndex = null;
    else this.selectedHandIndex = Math.min(this.selectedHandIndex ?? 0, this.hand.length - 1);
  }

  private refillHand(): void {
    while (this.hand.length < HAND_SIZE) {
      if (this.deck.length === 0 && this.discard.length > 0 && this.phase.sandbox) {
        this.deck = shuffleInPlace(this.discard, () => this.rng.next());
        this.discard = [];
      }
      const [card] = drawFrom(this.deck, 1);
      if (!card) break;
      this.hand.push(card);
    }
  }

  private updateStatus(): void {
    if (this.status !== 'playing') return;
    const outOfCards = this.hand.length === 0 && this.deck.length === 0;
    if (!outOfCards) return;
    // Sem cartas: se as missões estão feitas a fase termina bem; senão o reino adormece.
    this.status = this.questsDone ? 'phaseComplete' : 'asleep';
  }
}
