import { getPhase } from './catalog';
import { drawFrom, mulberry32, shuffleInPlace } from './deck';
import { hexKey, type Hex } from './hex';
import { canPlace } from './placement';
import { evaluateKingdom, placementFloats, type TileMap } from './production';
import { questProgress, requiredQuestsDone, type QuestProgress } from './quests';
import type {
  Evaluation,
  PlaceFloat,
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
};

const START_TILE = 'clareira';

export class Session {
  phaseId: number;
  map: TileMap = new Map();
  hand: string[] = [];
  deck: string[] = [];
  discard: string[] = [];
  selectedHandIndex: number | null = 0;
  turns = 0;
  status: SessionStatus = 'playing';
  rngState: number;
  spentPao = 0;
  private rng: () => number;

  constructor(phaseId: number, seed = Date.now(), restore?: SerializedSession) {
    this.phaseId = phaseId;
    this.rngState = restore?.rngState ?? seed;
    this.rng = mulberry32(this.rngState);

    if (restore) {
      this.map = new Map(restore.map);
      this.hand = [...restore.hand];
      this.deck = [...restore.deck];
      this.discard = [...restore.discard];
      this.selectedHandIndex = restore.selectedHandIndex;
      this.turns = restore.turns;
      this.status = restore.status;
      this.spentPao = restore.spentPao ?? 0;
      return;
    }

    this.map.set(hexKey({ q: 0, r: 0 }), START_TILE);
    this.deck = shuffleInPlace([...getPhase(phaseId).deck], this.rng);
    this.refillHand();
  }

  get evaluation(): Evaluation {
    return evaluateKingdom(this.map);
  }

  get quests(): QuestProgress[] {
    return questProgress(getPhase(this.phaseId).questIds, this.map, this.evaluation);
  }

  get selectedTileId(): string | null {
    if (this.selectedHandIndex === null) return null;
    return this.hand[this.selectedHandIndex] ?? null;
  }

  selectHand(index: number): void {
    if (index < 0 || index >= this.hand.length) return;
    this.selectedHandIndex = index;
  }

  place(hex: Hex): PlaceResult {
    const evaluation = this.evaluation;
    if (this.status !== 'playing') {
      return { ok: false, reason: 'fase-encerrada', floats: [], evaluation, quests: this.quests, status: this.status };
    }
    const tileId = this.selectedTileId;
    if (!tileId) {
      return { ok: false, reason: 'sem-carta', floats: [], evaluation, quests: this.quests, status: this.status };
    }
    if (!canPlace(this.map, hex)) {
      return { ok: false, reason: 'hex-invalido', floats: [], evaluation, quests: this.quests, status: this.status };
    }

    const floats = placementFloats(this.map, hex, tileId);
    this.map.set(hexKey(hex), tileId);
    this.hand.splice(this.selectedHandIndex ?? 0, 1);
    this.turns += 1;
    this.refillHand();
    if (this.hand.length === 0) this.selectedHandIndex = null;
    else this.selectedHandIndex = Math.min(this.selectedHandIndex ?? 0, this.hand.length - 1);

    this.updateStatus();
    return {
      ok: true,
      floats,
      evaluation: this.evaluation,
      quests: this.quests,
      status: this.status,
    };
  }

  get spendablePao(): number {
    return Math.max(0, this.evaluation.resources.pao - this.spentPao);
  }

  newPack(): { ok: boolean; reason?: string } {
    if (this.status !== 'playing') return { ok: false, reason: 'fase-encerrada' };
    if (this.spendablePao < 1) return { ok: false, reason: 'sem-pao' };
    this.spentPao += 1;
    this.discard.push(...this.hand);
    this.hand = [];
    this.refillHand();
    this.selectedHandIndex = this.hand.length > 0 ? 0 : null;
    this.updateStatus();
    return { ok: true };
  }

  serialize(): SerializedSession {
    return {
      phaseId: this.phaseId,
      map: [...this.map.entries()],
      hand: [...this.hand],
      deck: [...this.deck],
      discard: [...this.discard],
      selectedHandIndex: this.selectedHandIndex,
      turns: this.turns,
      status: this.status,
      rngState: this.rngState,
      spentPao: this.spentPao,
    };
  }

  private refillHand(): void {
    while (this.hand.length < 3) {
      if (this.deck.length === 0 && this.discard.length > 0 && getPhase(this.phaseId).sandbox) {
        this.deck = shuffleInPlace(this.discard, this.rng);
        this.discard = [];
      }
      const [card] = drawFrom(this.deck, 1);
      if (!card) break;
      this.hand.push(card);
    }
  }

  private updateStatus(): void {
    const phase = getPhase(this.phaseId);
    const quests = this.quests;
    if (!phase.sandbox && requiredQuestsDone(quests)) {
      this.status = 'phaseComplete';
      return;
    }
    if (!phase.sandbox && this.hand.length === 0 && this.deck.length === 0) {
      this.status = 'asleep';
    }
  }
}
