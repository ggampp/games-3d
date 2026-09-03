/**
 * main.js
 * Ponto de entrada do simulador 3D de Rubik's Cube
 */

import { CubeState } from './cube/CubeState.js';
import { CubeView3D } from './cube/CubeView3D.js';
import { TimerManager } from './ui/TimerManager.js';
import { UIManager } from './ui/UIManager.js';
window.addEventListener('DOMContentLoaded', () => {
  const container = document.getElementById('canvas-container');

  const cubeState = new CubeState();

  // Visualização 3D Three.js
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

  console.log('Simulador 3D de Cubo Mágico inicializado.');
});
