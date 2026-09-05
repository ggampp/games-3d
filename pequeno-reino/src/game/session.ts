import { buildDeck, getPhase } from './catalog';
import { drawFrom, Rng, shuffleInPlace } from './deck';
import { coinsOf, DISCARDS_PER_PHASE, HAND_SIZE, PACK_COST, scoreOf } from './economy';
import { hexKey, type Hex } from './hex';
import { canPlace } from './placement';
import { evaluateKingdom, placementFloats, type TileMap } from './production';
import { questProgress, requiredQuestsDone, type QuestProgress } from './quests';
import type { Evaluation, PlaceFloat, Score, SerializedSession, SessionStatus } from './types';

export type PlaceResult = {
  ok: boolean;
  reason?: string;
  floats: PlaceFloat[];
  evaluation: Evaluation;
  quests: QuestProgress[];
  status: SessionStatus;
  /** Verdadeiro na jogada em que as missões obrigatórias ficaram completas. */
  questsJustDone: boolean;
};

const START_TILE = 'clareira';

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
  /** Tamanho do baralho inicial: base das estrelas. */
  readonly deckSize: number;
  private undoState: SerializedSession | null = null;
  private readonly rng: Rng;

  constructor(phaseId: number, seed = Date.now(), unlockedTiles: Iterable<string> = [], restore?: SerializedSession) {
    this.phaseId = phaseId;
    this.seed = restore?.seed ?? seed;
    this.rng = new Rng(restore?.rngState ?? this.seed);

    if (restore) {
      this.map = new Map(restore.map);
      this.hand = [...restore.hand];
      this.deck = [...restore.deck];
      this.discard = [...restore.discard];
      this.selectedHandIndex = restore.selectedHandIndex;
      this.turns = restore.turns;
      this.status = restore.status;
      this.spentCoins = restore.spentCoins ?? 0;
      this.discardsLeft = restore.discardsLeft ?? DISCARDS_PER_PHASE;
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

  get evaluation(): Evaluation {
    return evaluateKingdom(this.map);
  }

  get quests(): QuestProgress[] {
    return questProgress(this.phase.questIds, this.map, this.evaluation);
  }

  get questsDone(): boolean {
    return this.phase.sandbox || requiredQuestsDone(this.quests);
  }

  get score(): Score {
    return scoreOf(this.evaluation, this.deckSize, this.questsDone);
  }

  get selectedTileId(): string | null {
    if (this.selectedHandIndex === null) return null;
    return this.hand[this.selectedHandIndex] ?? null;
  }

  /** Moedas disponíveis para gastar (produção menos o já gasto). */
  get coins(): number {
    return Math.max(0, coinsOf(this.evaluation) - this.spentCoins);
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

  selectHand(index: number): void {
    if (index < 0 || index >= this.hand.length) return;
    this.selectedHandIndex = index;
  }

  /** Prévia do que uma carta renderia num hex, sem alterar nada. */
  preview(hex: Hex, tileId = this.selectedTileId): PlaceFloat[] {
    if (!tileId || !canPlace(this.map, hex)) return [];
    return placementFloats(this.map, hex, tileId);
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
    });
    if (this.status !== 'playing') return fail('fase-encerrada');
    const tileId = this.selectedTileId;
    if (!tileId) return fail('sem-carta');
    if (!canPlace(this.map, hex)) return fail('hex-invalido');

    const wasDone = this.questsDone;
    this.undoState = this.serialize(false);

    const floats = placementFloats(this.map, hex, tileId);
    this.map.set(hexKey(hex), tileId);
    this.hand.splice(this.selectedHandIndex ?? 0, 1);
    this.turns += 1;
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
    };
  }

  undo(): boolean {
    if (!this.canUndo || !this.undoState) return false;
    const prev = this.undoState;
    this.map = new Map(prev.map);
    this.hand = [...prev.hand];
    this.deck = [...prev.deck];
    this.discard = [...prev.discard];
    this.selectedHandIndex = prev.selectedHandIndex;
    this.turns = prev.turns;
    this.status = prev.status;
    this.spentCoins = prev.spentCoins;
    this.discardsLeft = prev.discardsLeft;
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
      version: 2,
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
    };
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
