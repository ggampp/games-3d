/**
 * UIManager.js
 * Gerenciador de interface de usuário, atalhos de teclado, diálogos modais e integração com solver/timer.
 */

import { createIcons, icons } from 'lucide';
import confetti from 'canvas-confetti';
import { sounds } from '../audio/SoundEffects.js';
import { CubeScrambler } from '../cube/CubeScrambler.js';
import { CubeSolver } from '../cube/CubeSolver.js';
import { CubeScanModal } from '../scanner/CubeScanModal.js';
import { TIMER_STATE } from './TimerManager.js';

export class UIManager {
  constructor({ cubeState, cubeView, timerManager }) {
    this.cubeState = cubeState;
    this.cubeView = cubeView;
    this.timer = timerManager;

    this.solverSteps = [];
    this.currentStepIdx = 0;
    this.isAutoSolving = false;
    this.autoSolveInterval = null;

    this.scanModal = new CubeScanModal({
      cubeState: this.cubeState,
      cubeView: this.cubeView,
      onApplyState: () => {
        if (this.scrambleText) {
          this.scrambleText.innerText = 'Cubo Físico Configurado (Pronto para Resolver)';
        }
        this.startSolver();
      }
    });

    this.initElements();
    this.initLucide();
    this.bindEvents();
    this.bindKeyboardShortcuts();
    this.updateStatsDisplay();
  }

  initLucide() {
    createIcons({ icons });
  }

  initElements() {
    // Header & Actions
    this.scrambleText = document.getElementById('scramble-text');
    this.btnCopyScramble = document.getElementById('btn-copy-scramble');
    this.btnSound = document.getElementById('btn-sound');
    this.btnCameraReset = document.getElementById('btn-camera-reset');
    this.btnShortcuts = document.getElementById('btn-shortcuts');
    this.btnSettings = document.getElementById('btn-settings');
    this.btnFullscreen = document.getElementById('btn-fullscreen');

    // Timer
    this.timerWidget = document.getElementById('timer-widget');
    this.timerTrigger = document.getElementById('timer-trigger');
    this.timerTime = document.getElementById('timer-time');
    this.timerHint = document.getElementById('timer-hint');
    this.timerStatus = document.getElementById('timer-status');
    this.statPB = document.getElementById('stat-pb');
    this.statAo5 = document.getElementById('stat-ao5');
    this.statMoves = document.getElementById('stat-moves');
    this.btnInspection = document.getElementById('btn-inspection-toggle');
    this.inspectionState = document.getElementById('inspection-state');
    this.btnHistory = document.getElementById('btn-history');
    this.solveCount = document.getElementById('solve-count');

    // Bottom Dock Actions
    this.btnScramble = document.getElementById('btn-scramble');
    this.btnSolve = document.getElementById('btn-solve');
    this.btnReset = document.getElementById('btn-reset');
    this.btnUndo = document.getElementById('btn-undo');
    this.btnRedo = document.getElementById('btn-redo');

    // Solver Bar
    this.solverBar = document.getElementById('solver-bar');
    this.solverStepText = document.getElementById('solver-step-text');
    this.solverCurrentMove = document.getElementById('solver-current-move');
    this.btnSolverPrev = document.getElementById('btn-solver-prev');
    this.btnSolverPlay = document.getElementById('btn-solver-play');
    this.btnSolverPlayIcon = document.getElementById('solver-play-icon');
    this.btnSolverPlayText = document.getElementById('solver-play-text');
    this.btnSolverNext = document.getElementById('btn-solver-next');
    this.btnSolverClose = document.getElementById('btn-solver-close');

    // Victory Banner
    this.victoryBanner = document.getElementById('victory-banner');
    this.victoryStats = document.getElementById('victory-stats');
    this.btnVictoryClose = document.getElementById('btn-victory-close');

    // Modals
    this.settingsModal = document.getElementById('settings-modal');
    this.shortcutsModal = document.getElementById('shortcuts-modal');
    this.historyModal = document.getElementById('history-modal');
    this.modalCloseBtns = document.querySelectorAll('.modal-close');

    // Settings Controls
    this.selectTheme = document.getElementById('select-theme');
    this.selectStyle = document.getElementById('select-cube-style');
    this.rangeSpeed = document.getElementById('range-anim-speed');
    this.labelSpeed = document.getElementById('label-anim-speed');
    this.checkSound = document.getElementById('check-sound-fx');
    this.checkAutoTimer = document.getElementById('check-auto-timer');

    // History Table
    this.historyTbody = document.getElementById('history-tbody');
    this.modalStatPB = document.getElementById('modal-stat-pb');
    this.modalStatAo5 = document.getElementById('modal-stat-ao5');
    this.modalStatTotal = document.getElementById('modal-stat-total');
    this.btnClearHistory = document.getElementById('btn-clear-history');
  }

  bindEvents() {
    // 1. Scramble
    this.btnScramble.addEventListener('click', () => this.triggerScramble());

    // 2. Copiar Scramble
    this.btnCopyScramble.addEventListener('click', () => {
      navigator.clipboard.writeText(this.scrambleText.innerText);
      this.btnCopyScramble.style.color = '#34d399';
      setTimeout(() => { this.btnCopyScramble.style.color = ''; }, 1000);
    });

    // 3. Reset Cubo
    this.btnReset.addEventListener('click', () => this.resetCube());

    // 4. Undo / Redo
    this.btnUndo.addEventListener('click', () => this.undoMove());
    this.btnRedo.addEventListener('click', () => this.redoMove());

    // 5. Botões de notação do Dock
    document.querySelectorAll('.turn-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const move = e.currentTarget.getAttribute('data-move');
        if (move) this.executeUserMove(move);
      });
    });

    // 6. Solucionador
    this.btnSolve.addEventListener('click', () => this.startSolver());
    this.btnSolverClose.addEventListener('click', () => this.closeSolver());
    this.btnSolverNext.addEventListener('click', () => this.solverNextStep());
    this.btnSolverPrev.addEventListener('click', () => this.solverPrevStep());
    this.btnSolverPlay.addEventListener('click', () => this.toggleAutoSolve());

    // 7. Modals
    this.btnSettings.addEventListener('click', () => this.openModal('settings-modal'));
    this.btnShortcuts.addEventListener('click', () => this.openModal('shortcuts-modal'));
    this.btnHistory.addEventListener('click', () => {
      this.updateHistoryModal();
      this.openModal('history-modal');
    });

    this.modalCloseBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const target = e.currentTarget.getAttribute('data-target');
        if (target) this.closeModal(target);
      });
    });

    // Fechar modal ao clicar fora
    document.querySelectorAll('.modal-backdrop').forEach(modal => {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.classList.add('hidden');
      });
    });

    // 8. Configurações
    this.selectTheme.addEventListener('change', (e) => {
      this.cubeView.setTheme(e.target.value, this.selectStyle.value);
    });

    this.selectStyle.addEventListener('change', (e) => {
      this.cubeView.setTheme(this.selectTheme.value, e.target.value);
    });

    this.rangeSpeed.addEventListener('input', (e) => {
      const val = parseInt(e.target.value, 10);
      this.labelSpeed.innerText = `${val} ms`;
      this.cubeView.setAnimationSpeed(val);
    });

    this.checkSound.addEventListener('change', (e) => {
      sounds.enabled = e.target.checked;
      this.updateSoundButtonState();
    });

    this.btnSound.addEventListener('click', () => {
      sounds.enabled = !sounds.enabled;
      this.checkSound.checked = sounds.enabled;
      this.updateSoundButtonState();
    });

    this.checkAutoTimer.addEventListener('change', (e) => {
      this.timer.autoStartOnMove = e.target.checked;
    });

    // 9. Câmera e Fullscreen
    this.btnCameraReset.addEventListener('click', () => this.cubeView.resetView());
    this.btnFullscreen.addEventListener('click', () => this.toggleFullscreen());

    // 10. Inspeção do Timer
    this.btnInspection.addEventListener('click', () => {
      this.timer.useInspection = !this.timer.useInspection;
      this.inspectionState.innerText = this.timer.useInspection ? '15s ON' : 'OFF';
      this.inspectionState.style.color = this.timer.useInspection ? '#f59e0b' : '';
    });

    // 11. Limpar Histórico
    this.btnClearHistory.addEventListener('click', () => {
      if (confirm('Deseja realmente limpar todo o histórico de resoluções?')) {
        this.timer.clearHistory();
        this.updateStatsDisplay();
        this.updateHistoryModal();
      }
    });

    // 12. Fechar Banner de Vitória
    this.btnVictoryClose.addEventListener('click', () => {
      this.victoryBanner.classList.add('hidden');
    });

    // 13. Interação do Timer com Clique no Display
    this.timerTrigger.addEventListener('mousedown', () => this.timer.startHolding());
    this.timerTrigger.addEventListener('mouseup', () => this.timer.releaseHold());
    this.timerTrigger.addEventListener('touchstart', (e) => {
      e.preventDefault();
      this.timer.startHolding();
    });
    this.timerTrigger.addEventListener('touchend', (e) => {
      e.preventDefault();
      this.timer.releaseHold();
    });

    // Callbacks do Timer
    this.timer.onStateChange = (state) => this.handleTimerStateChange(state);
    this.timer.onTick = (elapsed) => {
      this.timerTime.innerText = this.timer.formatTime(elapsed);
    };
    this.timer.onInspectionTick = (sec) => {
      this.timerTime.innerText = `${sec}s`;
    };
    this.timer.onSolveComplete = (record) => this.handleSolveComplete(record);
  }

  updateSoundButtonState() {
    this.btnSound.innerHTML = sounds.enabled 
      ? '<i data-lucide="volume-2"></i>' 
      : '<i data-lucide="volume-x"></i>';
    this.btnSound.style.color = sounds.enabled ? '' : '#ef4444';
    this.initLucide();
  }

  toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(err => console.log(err));
    } else {
      document.exitFullscreen();
    }
  }

  openModal(id) {
    const modal = document.getElementById(id);
    if (modal) modal.classList.remove('hidden');
  }

  closeModal(id) {
    const modal = document.getElementById(id);
    if (modal) modal.classList.add('hidden');
  }

  triggerScramble() {
    this.closeSolver();
    this.victoryBanner.classList.add('hidden');

    const scramble = CubeScrambler.generateScramble(22);
    const scrambleStr = scramble.join(' ');
    this.scrambleText.innerText = scrambleStr;

    // Reseta cubo para estado limpo antes do scramble
    this.cubeState.reset();
    this.cubeView.buildCube();
    this.timer.reset();

    // Aplica scramble na lógica
    scramble.forEach(move => this.cubeState.applyMove(move, true));

    // Executa rotações animadas rápidas
    const prevSpeed = this.cubeView.animDuration;
    this.cubeView.setAnimationSpeed(90);

    scramble.forEach((move, i) => {
      const isLast = i === scramble.length - 1;
      this.cubeView.rotate(move, false, () => {
        if (isLast) {
          this.cubeView.setAnimationSpeed(prevSpeed);
          this.statMoves.innerText = '0';
        }
      });
    });
  }

  resetCube() {
    this.closeSolver();
    this.cubeState.reset();
    this.cubeView.buildCube();
    this.timer.reset();
    this.scrambleText.innerText = 'Cubo pronto para novo embaralhamento';
    this.victoryBanner.classList.add('hidden');
    this.statMoves.innerText = '0';
  }

  executeUserMove(move) {
    if (this.cubeView.isAnimating) return;

    this.cubeState.applyMove(move, true);
    this.cubeView.rotate(move);
    this.timer.incrementMove();
    this.statMoves.innerText = this.cubeState.history.length;

    this.checkIfSolved();
  }

  handleDragMove(move) {
    this.cubeState.applyMove(move, true);
    this.timer.incrementMove();
    this.statMoves.innerText = this.cubeState.history.length;
    this.checkIfSolved();
  }

  undoMove() {
    const move = this.cubeState.undo();
    if (move) {
      this.cubeView.rotate(move);
      this.statMoves.innerText = this.cubeState.history.length;
    }
  }

  redoMove() {
    const move = this.cubeState.redo();
    if (move) {
      this.cubeView.rotate(move);
      this.statMoves.innerText = this.cubeState.history.length;
    }
  }

  checkIfSolved() {
    if (this.cubeState.isSolved()) {
      if (this.timer.state === TIMER_STATE.RUNNING) {
        this.timer.stop();
      }
    }
  }

  handleTimerStateChange(state) {
    this.timerTime.classList.remove('inspecting', 'ready', 'running');

    switch (state) {
      case TIMER_STATE.HOLDING:
        this.timerStatus.innerText = 'Segure...';
        this.timerStatus.style.color = '#f59e0b';
        this.timerHint.innerText = 'Aguarde ficar verde para soltar';
        break;
      case TIMER_STATE.READY:
        this.timerStatus.innerText = 'Pronto!';
        this.timerStatus.style.color = '#10b981';
        this.timerTime.classList.add('ready');
        this.timerHint.innerText = 'Solte para começar a contagem';
        break;
      case TIMER_STATE.INSPECTION:
        this.timerStatus.innerText = 'Inspeção';
        this.timerStatus.style.color = '#f59e0b';
        this.timerTime.classList.add('inspecting');
        this.timerHint.innerText = 'Tempo de análise de 15s WCA';
        break;
      case TIMER_STATE.RUNNING:
        this.timerStatus.innerText = 'Resolvendo';
        this.timerStatus.style.color = '#38bdf8';
        this.timerTime.classList.add('running');
        this.timerHint.innerText = 'Resolva o cubo ou pressione espaço para parar';
        break;
      case TIMER_STATE.STOPPED:
        this.timerStatus.innerText = 'Parado';
        this.timerStatus.style.color = '#94a3b8';
        this.timerHint.innerText = 'Solve finalizado!';
        break;
      case TIMER_STATE.IDLE:
      default:
        this.timerStatus.innerText = 'Pronto';
        this.timerStatus.style.color = '#38bdf8';
        this.timerHint.innerText = 'Segure [Espaço] ou clique para cronometrar';
        break;
    }
  }

  handleSolveComplete(record) {
    sounds.playVictory();
    this.updateStatsDisplay();

    // Dispara celebração de confetes
    confetti({
      particleCount: 80,
      spread: 70,
      origin: { y: 0.6 }
    });

    // Exibe banner de vitória
    this.victoryStats.innerText = `Tempo: ${this.timer.formatTime(record.time)} • ${record.moves} Movimentos • ${record.tps} TPS`;
    this.victoryBanner.classList.remove('hidden');
  }

  updateStatsDisplay() {
    const pb = this.timer.getPB();
    const ao5 = this.timer.getAo5();
    this.statPB.innerText = this.timer.formatTime(pb);
    this.statAo5.innerText = this.timer.formatTime(ao5);
    this.solveCount.innerText = this.timer.solves.length;
  }

  updateHistoryModal() {
    const pb = this.timer.getPB();
    const ao5 = this.timer.getAo5();
    this.modalStatPB.innerText = this.timer.formatTime(pb);
    this.modalStatAo5.innerText = this.timer.formatTime(ao5);
    this.modalStatTotal.innerText = this.timer.solves.length;

    if (this.timer.solves.length === 0) {
      this.historyTbody.innerHTML = '<tr><td colspan="5" style="text-align:center; opacity:0.6;">Nenhum solve registrado ainda. Complete uma resolução para salvar!</td></tr>';
      return;
    }

    this.historyTbody.innerHTML = this.timer.solves.map((s, idx) => `
      <tr>
        <td>#${this.timer.solves.length - idx}</td>
        <td style="color:#38bdf8; font-weight:700;">${this.timer.formatTime(s.time)}</td>
        <td>${s.moves}</td>
        <td>${s.tps}</td>
        <td style="color:#94a3b8; font-size:0.75rem;">${s.date}</td>
      </tr>
    `).join('');
  }

  /**
   * Solucionador Passo a Passo
   */
  startSolver() {
    if (this.cubeView.isAnimating) return;

    if (this.cubeState.isSolved()) {
      alert('O cubo já se encontra 100% resolvido!');
      return;
    }

    this.solverSteps = CubeSolver.generateSolutionSteps(this.cubeState);
    if (this.solverSteps.length === 0) {
      alert('Não foi possível gerar a solução para o estado atual.');
      return;
    }

    this.currentStepIdx = 0;
    this.solverBar.classList.remove('hidden');
    this.updateSolverDisplay();
  }

  closeSolver() {
    this.stopAutoSolve();
    this.solverBar.classList.add('hidden');
    this.solverSteps = [];
  }

  updateSolverDisplay() {
    if (this.currentStepIdx >= this.solverSteps.length) {
      this.solverStepText.innerText = 'Parabéns! Cubo 100% resolvido!';
      this.solverCurrentMove.innerText = '✔';
      this.stopAutoSolve();
      this.checkIfSolved();
      return;
    }

    const step = this.solverSteps[this.currentStepIdx];
    this.solverStepText.innerText = `[${step.stepIndex}/${step.totalSteps}] ${step.phase}: ${step.description}`;
    this.solverCurrentMove.innerText = step.move;
  }

  solverNextStep(onComplete = null) {
    if (this.cubeView.isAnimating || this.currentStepIdx >= this.solverSteps.length) return;
    const step = this.solverSteps[this.currentStepIdx];

    this.cubeState.applyMove(step.move, true);
    this.cubeView.rotate(step.move, false, () => {
      this.currentStepIdx++;
      this.updateSolverDisplay();
      if (onComplete) onComplete();
    });
  }

  solverPrevStep() {
    if (this.cubeView.isAnimating || this.currentStepIdx <= 0) return;
    this.currentStepIdx--;
    const step = this.solverSteps[this.currentStepIdx];
    const inv = this.cubeState.getInverseMove(step.move);

    this.cubeState.applyMove(inv, false);
    this.cubeView.rotate(inv, false, () => {
      this.updateSolverDisplay();
    });
  }

  toggleAutoSolve() {
    if (this.isAutoSolving) {
      this.stopAutoSolve();
    } else {
      this.startAutoSolve();
    }
  }

  startAutoSolve() {
    this.isAutoSolving = true;
    this.btnSolverPlayText.innerText = 'Pausar';
    this.btnSolverPlayIcon.setAttribute('data-lucide', 'pause');
    this.initLucide();

    const playNext = () => {
      if (!this.isAutoSolving || this.currentStepIdx >= this.solverSteps.length) {
        this.stopAutoSolve();
        return;
      }
      this.solverNextStep(() => {
        if (this.isAutoSolving) {
          setTimeout(playNext, 80);
        }
      });
    };
    playNext();
  }

  stopAutoSolve() {
    this.isAutoSolving = false;
    this.btnSolverPlayText.innerText = 'Auto';
    this.btnSolverPlayIcon.setAttribute('data-lucide', 'play');
    this.initLucide();
  }

  /**
   * Atalhos de Teclado
   */
  bindKeyboardShortcuts() {
    let spacePressed = false;

    window.addEventListener('keydown', (e) => {
      // Ignora atalhos se o foco estiver em campos de texto/select
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;

      // Barra de espaço para Timer
      if (e.code === 'Space' && !e.repeat) {
        e.preventDefault();
        if (!spacePressed) {
          spacePressed = true;
          this.timer.startHolding();
        }
        return;
      }

      // Atalhos de rotação
      const isShift = e.shiftKey;
      const key = e.key.toUpperCase();

      // Letras de faces: U, D, L, R, F, B
      if (['U', 'D', 'L', 'R', 'F', 'B'].includes(key)) {
        const move = isShift ? `${key}'` : key;
        this.executeUserMove(move);
        return;
      }

      // Fatias e Eixos: M, E, S, X, Y, Z
      if (['M', 'E', 'S', 'X', 'Y', 'Z'].includes(key)) {
        const char = key === 'M' || key === 'E' || key === 'S' ? key : key.toLowerCase();
        const move = isShift ? `${char}'` : char;
        this.executeUserMove(move);
        return;
      }

      // Scramble: Tecla N
      if (key === 'N') {
        this.triggerScramble();
        return;
      }

      // Reset Câmera: Tecla C
      if (key === 'C') {
        this.cubeView.resetView();
        return;
      }

      // Mudo / Som: Tecla O
      if (key === 'O') {
        sounds.enabled = !sounds.enabled;
        this.checkSound.checked = sounds.enabled;
        this.updateSoundButtonState();
        return;
      }

      // Desfazer / Refazer (Ctrl+Z / Ctrl+Y)
      if (e.ctrlKey && key === 'Z') {
        e.preventDefault();
        this.undoMove();
        return;
      }
      if (e.ctrlKey && key === 'Y') {
        e.preventDefault();
        this.redoMove();
        return;
      }
    });

    window.addEventListener('keyup', (e) => {
      if (e.code === 'Space') {
        e.preventDefault();
        spacePressed = false;
        this.timer.releaseHold();
      }
    });
  }
}
