/// <reference types="vite/client" />

interface ThreeGameDiagnostics {
  frame: number;
  elapsed: number;
  score: number;
  targetScore: number;
  complete: boolean;
  player: {
    position: { x: number; y: number; z: number };
    speed: number;
  };
  renderer: {
    calls: number;
    triangles: number;
    geometries: number;
    textures: number;
  };
  canvas: {
    clientWidth: number;
    clientHeight: number;
    width: number;
    height: number;
    dpr: number;
  };
}

interface PequenoReinoDebug {
  validScreenPoints: () => Array<{ q: number; r: number; x: number; y: number }>;
  state: () => {
    phaseId: number;
    status: string;
    hand: string[];
    deck: number;
    mapSize: number;
    questsDone: boolean;
    score: number;
    coins: number;
  } | null;
  screen: () => string;
}

interface Window {
  __THREE_GAME_DIAGNOSTICS__?: ThreeGameDiagnostics;
  __PR_DEBUG__?: PequenoReinoDebug;
}
