export class CampaignUi {
  constructor(hud, progress, levels) {
    this.hud = hud; this.progress = progress; this.levels = levels;
    this.map = document.getElementById('campaign-map-modal');
    this.briefing = document.getElementById('level-briefing-modal');
    this.grid = document.getElementById('campaign-grid');
  }
  bind(actions) {
    this.actions = actions;
    document.getElementById('continue-campaign-btn').addEventListener('click', () => actions.chooseLevel(this.progress.continueLevelId()));
    document.getElementById('briefing-start-btn').addEventListener('click', actions.start);
    document.getElementById('briefing-map-btn').addEventListener('click', actions.openMap);
    document.getElementById('map-menu-btn').addEventListener('click', actions.menu);
    document.getElementById('level-next-btn').addEventListener('click', actions.next);
    document.getElementById('level-infinite-btn').addEventListener('click', actions.infinite);
    this.refreshMenu();
  }
  status() {
    for (const element of document.querySelectorAll('.campaign-save-status')) element.textContent = this.progress.warning;
  }
  refreshMenu() {
    document.getElementById('continue-campaign-btn').textContent = `CONTINUAR · FASE ${Number(this.progress.continueLevelId().slice(-2))}`;
    this.status();
  }
  hide() { this.map.hidden = true; this.briefing.hidden = true; this.hud.dialogs.sync(); }
  showMap() {
    this.hide(); this.hud.hideGameOver(); this.hud.showLevelResult(false);
    this.grid.replaceChildren();
    const saved = this.progress.snapshot();
    for (let number = 1; number <= 9; number++) {
      const id = `level-0${number}`, level = this.levels.find(l => l.id === id);
      const button = document.createElement('button'); button.type = 'button'; button.dataset.levelId = id;
      button.className = 'campaign-level'; button.disabled = !this.progress.canPlay(id);
      const state = !level ? 'EM BREVE' : saved.results[id] ? 'CONCLUÍDA' : button.disabled ? 'BLOQUEADA' : 'DISPONÍVEL';
      button.textContent = `FASE ${number} · ${level?.name ?? 'Novos desafios'} · ${state}`;
      button.addEventListener('click', () => this.actions.chooseLevel(id)); this.grid.append(button);
    }
    this.renderGallery(saved);
    this.map.hidden = false; this.status(); this.hud.dialogs.sync();
  }
  /** Simple gallery: official trophy plus best time/score of each completed phase. */
  renderGallery(saved = this.progress.snapshot()) {
    const done = Object.keys(saved.results).length;
    document.getElementById('campaign-gallery-trophy').textContent = this.progress.hasTrophy()
      ? '🏆 Troféu da campanha conquistado.' : `Troféu da campanha: ${done}/9 fases vencidas.`;
    const list = document.getElementById('campaign-gallery-list'); list.replaceChildren();
    for (const level of this.levels) {
      const result = saved.results[level.id]; if (!result) continue;
      const item = document.createElement('li');
      item.textContent = `Fase ${level.number} · ${level.name}: ${result.bestTimeS === null ? 'tempo não registrado' : `${result.bestTimeS.toFixed(1)} s`} · ${result.bestScore} pts · ${result.completions}×`;
      list.append(item);
    }
  }
  showBriefing(level) {
    this.hide(); this.hud.hideGameOver(); this.hud.showLevelResult(false);
    document.getElementById('briefing-title').textContent = `FASE ${level.number} · ${level.name}`;
    document.getElementById('briefing-description').textContent = level.briefing;
    document.getElementById('briefing-objective').textContent = `${level.lengthM} metros até a chegada. ${level.objective} Nenhuma pontuação mínima.`;
    this.briefing.hidden = false; this.status(); this.hud.dialogs.sync();
  }
  showResult(snapshot, { newTrophy = false } = {}) {
    this.hide();
    const next = `level-0${snapshot.levelNumber + 1}`, final = snapshot.levelNumber === 9 && this.progress.hasTrophy();
    document.getElementById('level-next-btn').hidden = !this.progress.canPlay(next);
    document.getElementById('level-infinite-btn').hidden = !final;
    const trophy = document.getElementById('campaign-trophy');
    trophy.hidden = !final; trophy.classList.toggle('is-new', newTrophy);
    document.getElementById('campaign-trophy-text').textContent = newTrophy
      ? 'Troféu da campanha conquistado: as nove fases foram vencidas.' : 'Troféu da campanha já conquistado. Repetir a final não gera outro.';
    this.hud.showLevelResult(true, { ...snapshot, campaignComplete: final }); this.status(); this.refreshMenu();
  }
}
