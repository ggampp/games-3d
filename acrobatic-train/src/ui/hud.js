/**
 * Decoupled HUD Manager for Acrobatic Train 3D
 * Throttles DOM updates to avoid layout thrashing during the 60fps render loop.
 * (Rule 3 compliant: No direct DOM mutation in physics loop)
 */

import { Dialogs } from './dialogs.js';

export class HudManager {
  constructor() {
    const getEl = (id) => (typeof document !== 'undefined' ? document.getElementById(id) : null);
    this.scoreEl = getEl('score-display');
    this.bestEl = getEl('best-display');
    this.speedEl = getEl('speed-display');
    this.frontTrackEl = getEl('front-track-label');
    this.rearTrackEl = getEl('rear-track-label');
    this.soundBtn = getEl('sound-btn');
    this.stuntBanner = getEl('stunt-banner');
    this.stuntText = getEl('stunt-text');
    this.aiJudgeLabel = getEl('ai-judge-label');

    this.driftComboHud = getEl('drift-combo-hud');
    this.comboBadge = getEl('combo-badge');
    this.comboBarFill = getEl('combo-bar-fill');

    this.skinSwatch = getEl('skin-swatch');
    this.skinNameDisplay = getEl('skin-name-display');

    this.signalLamp = getEl('signal-lamp');
    this.signalStatus = getEl('signal-status');

    this.tutorialModal = getEl('tutorial-modal');
    this.pauseModal = getEl('pause-modal');
    this.resumeBtn = getEl('resume-btn');
    this.gameoverModal = getEl('gameover-modal');
    this.finalScoreEl = getEl('final-score');
    this.finalBestEl = getEl('final-best');
    this.gameoverReason = getEl('gameover-reason');

    // Train Store Elements
    this.coinsDisplay = getEl('coins-val');
    this.storeBtn = getEl('store-btn');
    this.storeModal = getEl('store-modal');
    this.storeCloseBtn = getEl('store-close-btn');
    this.storeBackBtn = getEl('store-back-btn');
    this.storeBankPoints = getEl('store-bank-points');
    this.storeGrid = getEl('store-trains-grid');
    this.levelModal = getEl('level-result-modal');
    this.levelSummary = getEl('level-result-summary');
    this.runProgress = getEl('run-progress');
    this.runLabel = getEl('run-label');
    this.runProgressFill = getEl('run-progress-fill');
    this.runProgressText = getEl('run-progress-text');
    this.runObjective = getEl('run-objective');
    this.runWarning = getEl('run-warning');
    this.dialogs = typeof document !== 'undefined' ? new Dialogs(getEl('app')) : null;

    this.lastRenderTime = 0;
    this.throttleInterval = 80;

    this.cachedState = {
      score: 0,
      best: 0,
      speed: 0,
      coins: null,
      frontTrack: 'AMV: Via Central',
      rearTrack: 'AMV: Via Central',
      comboActive: false,
      signal: 'green',
    };
  }

  showPause(isPaused) {
    if (this.pauseModal) {
      this.pauseModal.hidden = !isPaused;
      this.dialogs?.sync();
    }
  }

  getTrackName(val) {
    if (val < -1) return 'AMV: Via 1 (Esq)';
    if (val > 1) return 'AMV: Via 3 (Dir)';
    return 'AMV: Via Central';
  }

  showStunt(message, aiTitle = null) {
    if (!this.stuntBanner || !this.stuntText) return;
    this.stuntText.textContent = message;
    if (this.aiJudgeLabel) {
      if (aiTitle) {
        this.aiJudgeLabel.textContent = `JEV AI: ${aiTitle}`;
        this.aiJudgeLabel.hidden = false;
      } else {
        this.aiJudgeLabel.hidden = true;
      }
    }
    this.stuntBanner.classList.add('show');
    clearTimeout(this.stuntTimer);
    this.stuntTimer = setTimeout(() => {
      this.stuntBanner.classList.remove('show');
    }, 1600);
  }

  updateDriftCombo(multiplier, fillPercent) {
    if (!this.driftComboHud) return;
    if (multiplier > 1.0) {
      if (!this.cachedState.comboActive) {
        this.cachedState.comboActive = true;
        this.driftComboHud.classList.add('active');
      }
      if (this.comboBadge) {
        this.comboBadge.textContent = `🔥 DRIFT x${multiplier.toFixed(1)}`;
      }
      if (this.comboBarFill) {
        this.comboBarFill.style.width = `${Math.min(100, Math.round(fillPercent))}%`;
      }
    } else {
      if (this.cachedState.comboActive) {
        this.cachedState.comboActive = false;
        this.driftComboHud.classList.remove('active');
      }
    }
  }

  updateSkinDisplay(skinKey, skinData) {
    if (this.skinSwatch) {
      this.skinSwatch.style.background = skinData.accentColor;
      this.skinSwatch.style.color = skinData.accentColor;
    }
    if (this.skinNameDisplay) {
      this.skinNameDisplay.textContent = skinData.name.toUpperCase();
    }
  }

  update(score, best, speedKmh, frontTrackVal, rearTrackVal, isDiagonal = false, force = false) {
    const now = performance.now();
    if (!force && now - this.lastRenderTime < this.throttleInterval) {
      return;
    }
    this.lastRenderTime = now;

    if (score !== this.cachedState.score) {
      this.cachedState.score = score;
      if (this.scoreEl) this.scoreEl.textContent = score;
    }

    if (best !== this.cachedState.best) {
      this.cachedState.best = best;
      if (this.bestEl) this.bestEl.textContent = `Recorde: ${best}`;
    }

    const roundedSpeed = Math.round(speedKmh);
    if (roundedSpeed !== this.cachedState.speed) {
      this.cachedState.speed = roundedSpeed;
      if (this.speedEl) {
        this.speedEl.innerHTML = `${roundedSpeed} <small style="font-size:11px;">km/h</small>`;
      }
    }

    const fName = this.getTrackName(frontTrackVal);
    if (fName !== this.cachedState.frontTrack) {
      this.cachedState.frontTrack = fName;
      if (this.frontTrackEl) this.frontTrackEl.textContent = fName;
    }

    const rName = this.getTrackName(rearTrackVal);
    if (rName !== this.cachedState.rearTrack) {
      this.cachedState.rearTrack = rName;
      if (this.rearTrackEl) this.rearTrackEl.textContent = rName;
    }

    if (this.signalLamp && this.signalStatus) {
      if (isDiagonal) {
        if (this.cachedState.signal !== 'amber') {
          this.cachedState.signal = 'amber';
          this.signalLamp.className = 'signal-lamp amber';
          this.signalStatus.textContent = 'MANOBRA';
        }
      } else {
        if (this.cachedState.signal !== 'green') {
          this.cachedState.signal = 'green';
          this.signalLamp.className = 'signal-lamp green';
          this.signalStatus.textContent = 'VIA LIVRE';
        }
      }
    }
  }

  setSoundActive(isActive) {
    if (this.soundBtn) {
      if (isActive) {
        this.soundBtn.classList.add('active');
        this.soundBtn.innerHTML = `
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
            <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path>
          </svg>
        `;
      } else {
        this.soundBtn.classList.remove('active');
        this.soundBtn.innerHTML = `
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
            <line x1="23" y1="9" x2="17" y2="15"></line>
            <line x1="17" y1="9" x2="23" y2="15"></line>
          </svg>
        `;
      }
    }
  }

  showGameOver(score, best, reason = 'Descarrilamento em alta velocidade!') {
    if (this.finalScoreEl) this.finalScoreEl.textContent = score;
    if (this.finalBestEl) this.finalBestEl.textContent = `Melhor: ${best} Pontos`;
    if (this.gameoverReason) this.gameoverReason.textContent = reason;
    if (this.gameoverModal) this.gameoverModal.hidden = false;
    this.dialogs?.sync();
  }

  hideGameOver() {
    if (this.gameoverModal) this.gameoverModal.hidden = true;
    this.dialogs?.sync();
  }

  hideTutorial() {
    if (this.tutorialModal) this.tutorialModal.hidden = true;
    this.dialogs?.sync();
  }

  showTutorial() {
    if (this.tutorialModal) this.tutorialModal.hidden = false;
    this.dialogs?.sync();
  }

  showLevelResult(show, snapshot = {}) {
    if (show) {
      document.getElementById('level-result-title').textContent = snapshot.campaignComplete ? 'CAMPANHA COMPLETA!' : `FASE ${snapshot.levelNumber} CONCLUÍDA!`;
      this.levelSummary.textContent = `${snapshot.lengthM} m em ${snapshot.timeS.toFixed(1)} s · ${snapshot.score} pontos. ${snapshot.metrics?.items ?? 0} itens, ${snapshot.metrics?.aerialItems ?? 0} anéis aéreos e ${snapshot.metrics?.stuntsLanded ?? 0} manobras pousadas.`;
    }
    if (this.levelModal) this.levelModal.hidden = !show;
    this.dialogs?.sync();
  }

  showRun(level) {
    if (this.runLabel) this.runLabel.textContent = level ? `FASE ${level.number} · ${level.name}` : 'MODO INFINITO';
    if (this.runObjective) this.runObjective.textContent = level ? `${level.objective} Chegar vivo basta.` : '';
    if (this.runWarning) this.runWarning.textContent = '';
    if (this.runProgress) this.runProgress.hidden = !level;
  }

  renderSnapshot(snapshot, now = performance.now()) {
    if (now - this.lastRenderTime < this.throttleInterval) return false;
    this.update(snapshot.score, snapshot.best, snapshot.speedKmh, snapshot.front, snapshot.rear, snapshot.diagonal, true);
    this.lastRenderTime = now;
    this.updateCoins(snapshot.bankPoints);
    this.updateDriftCombo(snapshot.driftCombo, snapshot.driftFill);
    if (this.runWarning && this.runWarning.textContent !== (snapshot.warning || '')) this.runWarning.textContent = snapshot.warning || '';
    if (snapshot.lengthM && this.runProgressFill) {
      const percentage = Math.max(0, Math.min(100, snapshot.dist / snapshot.lengthM * 100));
      this.runProgressFill.style.width = `${percentage}%`;
      if (this.runProgressText) this.runProgressText.textContent = `${Math.max(0, Math.ceil(snapshot.lengthM - snapshot.dist))} m restantes`;
    }
    return true;
  }

  dispose() { clearTimeout(this.stuntTimer); this.dialogs?.dispose(); }

  updateCoins(coins) {
    if (coins !== this.cachedState.coins) {
      this.cachedState.coins = coins;
      if (this.coinsDisplay) {
        this.coinsDisplay.textContent = `${coins} pts`;
      }
      if (this.storeBankPoints) {
        this.storeBankPoints.textContent = `🪙 ${coins} pts`;
      }
    }
  }

  showStore(isOpen) {
    if (this.storeModal) {
      this.storeModal.hidden = !isOpen;
      this.dialogs?.sync();
    }
  }

  renderStore(catalog, unlockedList, currentTrainId, bankPoints, onEquip, onBuy) {
    if (!this.storeGrid) return;
    this.updateCoins(bankPoints);
    this.storeGrid.innerHTML = '';

    const previewIcons = {
      cyber: '🚄',
      steam: '🚂',
      passenger: '🚆',
      highspeed: '⚡',
      class395: '🇬🇧'
    };

    Object.values(catalog).forEach((train) => {
      const isEquipped = train.id === currentTrainId;
      const isUnlocked = unlockedList.includes(train.id) || train.price === 0;
      const canAfford = bankPoints >= train.price;

      const card = document.createElement('div');
      card.className = `store-card ${isEquipped ? 'is-equipped' : ''}`;

      let btnHtml = '';
      if (isEquipped) {
        btnHtml = `<button class="store-action-btn equipped" disabled>✓ EQUIPADO</button>`;
      } else if (isUnlocked) {
        btnHtml = `<button class="store-action-btn equip" data-id="${train.id}">EQUIPAR</button>`;
      } else if (canAfford) {
        btnHtml = `<button class="store-action-btn buy" data-id="${train.id}">COMPRAR (${train.price} PTS)</button>`;
      } else {
        const diff = train.price - bankPoints;
        btnHtml = `<button class="store-action-btn locked" disabled>BLOQUEADO (Faltam ${diff} pts)</button>`;
      }

      card.innerHTML = `
        <span class="store-card-badge" style="background:${train.accentColor}25; color:${train.accentColor}; border:1px solid ${train.accentColor}50;">
          ${train.badge}
        </span>
        <div class="store-card-preview">${previewIcons[train.id] || '🚂'}</div>
        <div class="store-card-name">${train.name}</div>
        <div class="store-card-sub">${train.subtitle}</div>
        <div class="store-card-desc">${train.description}</div>
        <div class="store-card-specs">
          <div class="spec-row">
            <span class="spec-lbl">Velocidade</span>
            <span class="spec-val">${train.specs.speed}</span>
          </div>
          <div class="spec-row">
            <span class="spec-lbl">Composição</span>
            <span class="spec-val">${train.maxCars} ${train.maxCars === 1 ? 'Vagão' : 'Vagões'}</span>
          </div>
          <div class="spec-row">
            <span class="spec-lbl">Aceleração</span>
            <span class="spec-val">${train.specs.accel}</span>
          </div>
          <div class="spec-row">
            <span class="spec-lbl">Especial</span>
            <span class="spec-val" style="color:${train.accentColor}">${train.specs.special}</span>
          </div>
        </div>
        ${btnHtml}
      `;

      const actionBtn = card.querySelector('.store-action-btn:not([disabled])');
      if (actionBtn) {
        actionBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          if (actionBtn.classList.contains('equip')) {
            onEquip?.(train.id);
          } else if (actionBtn.classList.contains('buy')) {
            onBuy?.(train.id);
          }
        });
      }

      this.storeGrid.appendChild(card);
    });
  }
}
