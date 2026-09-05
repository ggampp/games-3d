export type TileTipo = 'terreno' | 'predio' | 'gente';
export type Bioma = 'clareira' | 'mata' | 'rio' | 'serra' | 'povo';
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
};

export type QuestType =
  | 'count'
  | 'adjacentCount'
  | 'adjacentAny'
  | 'connected'
  | 'populacao'
  | 'harmonyAll'
  | 'mapSize';

export type QuestDef = {
  id: string;
  titulo: string;
  descricao: string;
  type: QuestType;
  tileId?: string;
  neighborId?: string;
  neighborIds?: string[];
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
  stars: 0 | 1 | 2 | 3;
  nextStarAt: number | null;
};

export type SerializedSession = {
  version: 2;
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
};
