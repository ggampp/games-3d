/**
 * main.js
 * Ponto de entrada do simulador 3D de Rubik's Cube
 */

import { CubeState } from './cube/CubeState.js';
import { CubeView3D } from './cube/CubeView3D.js';
import { TimerManager } from './ui/TimerManager.js';
import { UIManager } from './ui/UIManager.js';
import { EXAMPLE_SIX_FACES_GRIDS } from './scanner/exampleSixFaceData.js';

window.addEventListener('DOMContentLoaded', () => {
  const container = document.getElementById('canvas-container');

  // Inicializa o estado lógico do cubo com o estado das 6 faces reais de exemplo
  const cubeState = new CubeState();
  try {
    if (EXAMPLE_SIX_FACES_GRIDS) {
      cubeState.setFaces(EXAMPLE_SIX_FACES_GRIDS);
    }
  } catch (err) {
    console.warn('Iniciando com cubo padrão resolvido:', err);
  }

  // Inicializa a visualização 3D Three.js
  let uiManager = null;
  const cubeView = new CubeView3D(container, (move) => {
    // Callback disparado quando um movimento interativo por drag for executado na cena 3D
    if (uiManager) {
      uiManager.handleDragMove(move);
    }
  });

  // Aplica o estado inicial das fotos à visão 3D
  cubeView.applyState(cubeState);

  // Inicializa o cronômetro de speedcubing
  const timerManager = new TimerManager();

  // Inicializa a interface de usuário e controles
  uiManager = new UIManager({
    cubeState,
    cubeView,
    timerManager
  });

  console.log('🚀 Simulador 3D de Cubo Mágico inicializado com o cubo real das fotos!');
});
