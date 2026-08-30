/**
 * TimerManager.js
 * Gerenciador de cronômetro de competição de Speedcubing (padrão WCA)
 * Suporte a tempo de inspeção de 15 segundos, cálculo de PB, Ao5 e TPS.
 */

import { sounds } from '../audio/SoundEffects.js';

export const TIMER_STATE = {
  IDLE: 'IDLE',
  HOLDING: 'HOLDING',
  READY: 'READY',
  INSPECTION: 'INSPECTION',
  RUNNING: 'RUNNING',
  STOPPED: 'STOPPED'
};

export class TimerManager {
  constructor(options = {}) {
    this.state = TIMER_STATE.IDLE;
    this.startTime = 0;
    this.elapsedTime = 0;
    this.inspectionDuration = 15; // segundos
    this.inspectionTimeLeft = 15;
    this.useInspection = false;
    this.autoStartOnMove = true;
    this.moveCount = 0;

    this.timerInterval = null;
    this.inspectionInterval = null;
    this.holdTimeout = null;

    this.solves = this.loadSolves();

    this.onStateChange = options.onStateChange || (() => {});
    this.onTick = options.onTick || (() => {});
    this.onInspectionTick = options.onInspectionTick || (() => {});
    this.onSolveComplete = options.onSolveComplete || (() => {});
  }

  loadSolves() {
    try {
      const data = localStorage.getItem('rubik_solves_history_v1');
      return data ? JSON.parse(data) : [];
    } catch (e) {
      return [];
    }
  }

  saveSolves() {
    try {
      localStorage.setItem('rubik_solves_history_v1', JSON.stringify(this.solves));
    } catch (e) {
      console.error(e);
    }
  }

  getPB() {
    if (this.solves.length === 0) return null;
    return Math.min(...this.solves.map(s => s.time));
  }

  getAo5() {
    if (this.solves.length < 5) return null;
    const last5 = this.solves.slice(-5).map(s => s.time);
    // Remove o mais rápido e o mais lento e faz a média dos 3 restantes
    last5.sort((a, b) => a - b);
    const middle3 = last5.slice(1, 4);
    const sum = middle3.reduce((acc, val) => acc + val, 0);
    return sum / 3;
  }

  formatTime(ms) {
    if (ms === null || ms === undefined) return '--:--';
    const totalSeconds = ms / 1000;
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = Math.floor(totalSeconds % 60);
    const centis = Math.floor((ms % 1000) / 10);

    const centisStr = centis.toString().padStart(2, '0');
    if (minutes > 0) {
      const secondsStr = seconds.toString().padStart(2, '0');
      return `${minutes}:${secondsStr}.${centisStr}`;
    }
    return `${seconds}.${centisStr}`;
  }

  startHolding() {
    if (this.state === TIMER_STATE.RUNNING) {
      this.stop();
      return;
    }
    if (this.state === TIMER_STATE.HOLDING || this.state === TIMER_STATE.READY) return;

    this.state = TIMER_STATE.HOLDING;
    this.onStateChange(this.state);

    this.holdTimeout = setTimeout(() => {
      if (this.state === TIMER_STATE.HOLDING) {
        this.state = TIMER_STATE.READY;
        sounds.playBeep(1200, 0.05);
        this.onStateChange(this.state);
      }
    }, 350);
  }

  releaseHold() {
    if (this.state === TIMER_STATE.HOLDING) {
      clearTimeout(this.holdTimeout);
      this.state = TIMER_STATE.IDLE;
      this.onStateChange(this.state);
    } else if (this.state === TIMER_STATE.READY) {
      if (this.useInspection) {
        this.startInspection();
      } else {
        this.startTimer();
      }
    }
  }

  startInspection() {
    this.state = TIMER_STATE.INSPECTION;
    this.inspectionTimeLeft = this.inspectionDuration;
    this.onStateChange(this.state);
    this.onInspectionTick(this.inspectionTimeLeft);

    clearInterval(this.inspectionInterval);
    this.inspectionInterval = setInterval(() => {
      this.inspectionTimeLeft--;
      this.onInspectionTick(this.inspectionTimeLeft);

      if (this.inspectionTimeLeft === 7) {
        sounds.playBeep(660, 0.1); // Aviso WCA 8 segundos
      } else if (this.inspectionTimeLeft === 3) {
        sounds.playBeep(880, 0.1); // Aviso WCA 12 segundos
      } else if (this.inspectionTimeLeft <= 0) {
        clearInterval(this.inspectionInterval);
        this.startTimer();
      }
    }, 1000);
  }

  startTimer() {
    clearInterval(this.inspectionInterval);
    this.state = TIMER_STATE.RUNNING;
    this.startTime = performance.now();
    this.elapsedTime = 0;
    this.moveCount = 0;
    this.onStateChange(this.state);

    clearInterval(this.timerInterval);
    this.timerInterval = setInterval(() => {
      this.elapsedTime = performance.now() - this.startTime;
      this.onTick(this.elapsedTime);
    }, 20);
  }

  incrementMove() {
    this.moveCount++;
    if (this.state === TIMER_STATE.IDLE && this.autoStartOnMove) {
      this.startTimer();
    } else if (this.state === TIMER_STATE.INSPECTION) {
      this.startTimer();
    }
  }

  stop() {
    if (this.state !== TIMER_STATE.RUNNING) return null;

    clearInterval(this.timerInterval);
    this.elapsedTime = performance.now() - this.startTime;
    this.state = TIMER_STATE.STOPPED;
    this.onStateChange(this.state);
    this.onTick(this.elapsedTime);

    const timeInSeconds = this.elapsedTime / 1000;
    const tps = timeInSeconds > 0 ? (this.moveCount / timeInSeconds).toFixed(2) : '0.00';

    const record = {
      id: Date.now(),
      time: this.elapsedTime,
      moves: this.moveCount,
      tps: parseFloat(tps),
      date: new Date().toLocaleDateString('pt-BR') + ' ' + new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    };

    this.solves.unshift(record);
    this.saveSolves();
    this.onSolveComplete(record);

    return record;
  }

  reset() {
    clearInterval(this.timerInterval);
    clearInterval(this.inspectionInterval);
    clearTimeout(this.holdTimeout);
    this.state = TIMER_STATE.IDLE;
    this.elapsedTime = 0;
    this.moveCount = 0;
    this.onStateChange(this.state);
    this.onTick(0);
  }

  clearHistory() {
    this.solves = [];
    this.saveSolves();
  }
}
