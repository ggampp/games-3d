/**
 * Decoupled HUD Manager for Acrobatic Train 3D
 * Throttles DOM updates to avoid layout thrashing during the 60fps render loop.
 * (Rule 3 compliant: No direct DOM mutation in physics loop)
 */

export class HudManager {
  constructor() {
    this.scoreEl = document.getElementById('score-display');
    this.bestEl = document.getElementById('best-display');
    this.speedEl = document.getElementById('speed-display');
    this.frontTrackEl = document.getElementById('front-track-label');
    this.rearTrackEl = document.getElementById('rear-track-label');
    this.soundBtn = document.getElementById('sound-btn');
    this.stuntBanner = document.getElementById('stunt-banner');
    this.stuntText = document.getElementById('stunt-text');
    this.aiJudgeLabel = document.getElementById('ai-judge-label');

    this.driftComboHud = document.getElementById('drift-combo-hud');
    this.comboBadge = document.getElementById('combo-badge');
    this.comboBarFill = document.getElementById('combo-bar-fill');

    this.skinSwatch = document.getElementById('skin-swatch');
    this.skinNameDisplay = document.getElementById('skin-name-display');

    this.signalLamp = document.getElementById('signal-lamp');
    this.signalStatus = document.getElementById('signal-status');

    this.tutorialModal = document.getElementById('tutorial-modal');
    this.pauseModal = document.getElementById('pause-modal');
    this.resumeBtn = document.getElementById('resume-btn');
    this.gameoverModal = document.getElementById('gameover-modal');
    this.finalScoreEl = document.getElementById('final-score');
    this.finalBestEl = document.getElementById('final-best');
    this.gameoverReason = document.getElementById('gameover-reason');

    this.lastRenderTime = 0;
    this.throttleInterval = 80;

    this.cachedState = {
      score: 0,
      best: 0,
      speed: 0,
      frontTrack: 'AMV: Via Central',
      rearTrack: 'AMV: Via Central',
      comboActive: false,
      signal: 'green',
    };
  }

  showPause(isPaused) {
    if (this.pauseModal) {
      this.pauseModal.hidden = !isPaused;
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
  }

  hideGameOver() {
    if (this.gameoverModal) this.gameoverModal.hidden = true;
  }

  hideTutorial() {
    if (this.tutorialModal) this.tutorialModal.hidden = true;
  }
}
