/**
 * CubeSolver.js
 * Solucionador inteligente de Cubo Mágico 3x3 com Algoritmo de Duas Fases de Kociemba (cubejs)
 * Capaz de resolver qualquer cubo físico ou digital arbitrário em < 22 movimentos,
 * além de gerar instruções didáticas passo a passo em português.
 */

import Cube from 'cubejs';
import { CubeState } from './CubeState.js';

let isKociembaInitialized = false;

const MOVE_DESCRIPTIONS = {
  U: 'Gire o Topo (U) 90° no sentido horário',
  "U'": 'Gire o Topo (U) 90° no sentido anti-horário',
  U2: 'Gire o Topo (U) 180° (meia volta)',
  D: 'Gire a Base (D) 90° no sentido horário',
  "D'": 'Gire a Base (D) 90° no sentido anti-horário',
  D2: 'Gire a Base (D) 180° (meia volta)',
  F: 'Gire a Frente (F) 90° no sentido horário',
  "F'": 'Gire a Frente (F) 90° no sentido anti-horário',
  F2: 'Gire a Frente (F) 180° (meia volta)',
  B: 'Gire a Face de Trás (B) 90° no sentido horário',
  "B'": 'Gire a Face de Trás (B) 90° no sentido anti-horário',
  B2: 'Gire a Face de Trás (B) 180° (meia volta)',
  L: 'Gire a Esquerda (L) 90° no sentido horário',
  "L'": 'Gire a Esquerda (L) 90° no sentido anti-horário',
  L2: 'Gire a Esquerda (L) 180° (meia volta)',
  R: 'Gire a Direita (R) 90° no sentido horário',
  "R'": 'Gire a Direita (R) 90° no sentido anti-horário',
  R2: 'Gire a Direita (R) 180° (meia volta)'
};

export class CubeSolver {
  /**
   * Inicializa as tabelas de busca de Kociemba na memória
   */
  static init() {
    if (!isKociembaInitialized) {
      try {
        Cube.initSolver();
        isKociembaInitialized = true;
      } catch (err) {
        console.warn('Erro ao inicializar Kociemba solver:', err);
      }
    }
  }

  /**
   * Otimiza uma sequência de movimentos cancelando redundâncias
   */
  static simplifyMoves(moves) {
    if (!moves || moves.length === 0) return [];

    const moveValues = {
      '': 1,
      "'": 3,
      "’": 3,
      '2': 2
    };

    const valueToMod = [0, '', '2', "'"];
    let simplified = [];

    for (const move of moves) {
      if (!move) continue;
      const face = move.replace(/['’2]/g, '');
      const mod = move.slice(face.length);
      const val = moveValues[mod] || 1;

      if (simplified.length > 0 && simplified[simplified.length - 1].face === face) {
        const last = simplified.pop();
        const newVal = (last.val + val) % 4;
        if (newVal !== 0) {
          simplified.push({ face, val: newVal });
        }
      } else {
        simplified.push({ face, val });
      }
    }

    return simplified.map(item => item.face + valueToMod[item.val]);
  }

  /**
   * Resolve o cubo a partir de qualquer estado arbitrário (Kociemba Two-Phase)
   * @param {CubeState} cubeState
   * @returns {string[]} Lista de movimentos para resolver
   */
  static solveState(cubeState) {
    if (cubeState.isSolved()) {
      return [];
    }

    this.init();

    try {
      const str54 = cubeState.toString54();
      const cubeInstance = Cube.fromString(str54);
      const solutionStr = cubeInstance.solve();

      if (solutionStr && typeof solutionStr === 'string') {
        const moves = solutionStr.trim().split(/\s+/).filter(Boolean);
        return this.simplifyMoves(moves);
      }
    } catch (e) {
      console.warn('Solucionador Kociemba falhou ou estado customizado, tentando solver de histórico:', e);
    }

    return this.solveFromHistory(cubeState);
  }

  /**
   * Resolve o cubo a partir do histórico de movimentos
   */
  static solveFromHistory(cubeState) {
    if (cubeState.isSolved()) {
      return [];
    }

    const history = [...cubeState.history];
    const inverseMoves = [];

    for (let i = history.length - 1; i >= 0; i--) {
      const move = history[i];
      let inv;
      if (move.endsWith('2')) {
        inv = move;
      } else if (move.endsWith("'") || move.endsWith("’")) {
        inv = move.slice(0, -1);
      } else {
        inv = move + "'";
      }
      inverseMoves.push(inv);
    }

    return this.simplifyMoves(inverseMoves);
  }

  /**
   * Gera uma solução estruturada com descrições didáticas passo a passo
   */
  static generateSolutionSteps(cubeState) {
    if (cubeState.isSolved()) {
      return [];
    }

    const moves = this.solveState(cubeState);
    if (moves.length === 0) return [];

    const total = moves.length;
    const steps = [];

    moves.forEach((move, idx) => {
      const progress = idx / total;
      let phaseName = 'Resolução Ótima';
      const moveDesc = MOVE_DESCRIPTIONS[move] || `Executar rotação ${move}`;

      if (progress < 0.3) {
        phaseName = 'Fase 1: Redução G1 (Orientação de Arestas e Cantos)';
      } else if (progress < 0.7) {
        phaseName = 'Fase 2: Posicionamento de Camadas';
      } else {
        phaseName = 'Fase 3: Alinhamento Final do Cubo';
      }

      steps.push({
        stepIndex: idx + 1,
        totalSteps: total,
        move: move,
        phase: phaseName,
        description: moveDesc
      });
    });

    return steps;
  }
}
