export type TileTipo = 'terreno' | 'predio' | 'gente';
export type Bioma = 'clareira' | 'mata' | 'rio' | 'serra' | 'povo' | 'pantano';
export type HarmonyAxis = 'natureza' | 'povo' | 'agua';

export type TileDef = {
  id: string;
  nome: string;
  tipo: TileTipo;
  bioma: Bioma;
  descricao: string;
  unlockPhase: number;
};

export type PhaseDef = {
  id: number;
  nome: string;
  estacao: string;
  subtitulo: string;
  unlockTile: string | null;
  unlockNome: string | null;
  deck: string[];
  questIds: string[];
  sky: string;
  sandbox: boolean;
  /** Narração ao abrir a fase (public/audio/voice/<voice>.mp3); null = sem narração. */
  voice?: string | null;
};

export type QuestType =
  | 'count'
  | 'adjacentCount'
  | 'adjacentAny'
  | 'connected'
  | 'populacao'
  | 'harmonyAll'
  | 'mapSize'
  /** Total de um recurso produzido ao longo da fase (soma turno a turno). */
  | 'produce'
  /** Cadeia de vizinhança em ordem (ex.: roça → engenho → padaria). */
  | 'chain'
  /** Casas ligadas a um mercado por uma rede de estradas. */
  | 'roadHomes';

export type QuestDef = {
  id: string;
  titulo: string;
  descricao: string;
  type: QuestType;
  tileId?: string;
  neighborId?: string;
  neighborIds?: string[];
  /** Para 'produce': qual recurso somar. */
  resource?: ResourceKey;
  /** Para 'chain': grupos de tiles aceitos em cada elo, do início ao fim. */
  chain?: string[][];
  amount: number;
  optional?: boolean;
};

export type Harmony = {
  natureza: number;
  povo: number;
  agua: number;
};

export type Resources = {
  farinha: number;
  pao: number;
  madeira: number;
  pedra: number;
  peixe: number;
  populacao: number;
};

export type ResourceKey = keyof Resources;

/** Efeitos temporários de eventos de estação sobre a produção. */
export type KingdomModifiers = {
  /** Chuva: cada rio rende +1 Água. */
  rain: boolean;
  /** Roças com praga (chaves de hex): não produzem até ter horta vizinha. */
  blighted: string[];
};

export type EventId = 'chuva' | 'praga' | 'feira';

export type KingdomEvent = {
  id: EventId;
  titulo: string;
  texto: string;
  /** Moedas ganhas na hora (feira). */
  coins: number;
  /** Hex atingido (praga: a roça). */
  target: string | null;
};

/** Cadeias de produção reconhecidas: cada uma completa conta um combo. */
export type ChainDef = {
  id: string;
  nome: string;
  links: string[][];
};

export type Evaluation = {
  harmony: Harmony;
  resources: Resources;
};

export type PlaceFloat = {
  axis: HarmonyAxis | 'recurso';
  label: string;
  amount: number;
};

export type SessionStatus = 'playing' | 'phaseComplete' | 'asleep';

/** Pontuação de uma fase: soma das cores + bônus de equilíbrio + povo. */
export type Score = {
  total: number;
  harmonia: number;
  equilibrio: number;
  povo: number;
  /** Pontos extras de combos (cadeias fechadas). */
  bonus: number;
  stars: 0 | 1 | 2 | 3;
  nextStarAt: number | null;
};

export type SerializedSession = {
  version: 3;
  phaseId: number;
  seed: number;
  map: Array<[string, string]>;
  hand: string[];
  deck: string[];
  discard: string[];
  selectedHandIndex: number | null;
  turns: number;
  status: SessionStatus;
  rngState: number;
  spentCoins: number;
  discardsLeft: number;
  undo: SerializedSession | null;
  questsCelebrated: boolean;
  /** Produção acumulada na fase (missões 'produce'). */
  produced: Resources;
  /** Turnos restantes de chuva. */
  rainTurns: number;
  /** Roças com praga. */
  blighted: string[];
  /** Moedas extras de eventos (feira). */
  bonusCoins: number;
  /** Pontos extras de combos. */
  comboBonus: number;
  /** Quantos eventos já dispararam na fase. */
  eventsFired: number;
};

/** Prévia detalhada de uma jogada: deltas por cor, pontos e missões. */
export type PlacePreview = {
  floats: PlaceFloat[];
  harmony: { before: Harmony; after: Harmony };
  scoreDelta: number;
  /** Cadeias que fechariam com a jogada. */
  combos: string[];
  quests: Array<{ titulo: string; from: number; to: number; amount: number }>;
};
