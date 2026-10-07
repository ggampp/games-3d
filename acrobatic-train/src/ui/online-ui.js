/** Lobby, result and in-race status for online races. Presentation only: no network or game state. */
export const ERROR_TEXT = Object.freeze({
  'room-not-found': 'Sala não encontrada. Confira o código.', 'room-full': 'A sala já tem dois jogadores.',
  'room-started': 'Essa corrida já começou.', 'room-expired': 'A sala expirou por inatividade.',
  'content-mismatch': 'Sua versão do jogo é diferente da sala. Atualize a página.', version: 'Versão do protocolo incompatível. Atualize a página.',
  'bad-level': 'Fase inválida.', 'rate-limited': 'Muitos comandos por segundo.', 'not-in-room': 'Você não está numa sala.',
  connection: 'Sem conexão com o servidor de salas.',
});
const REASON_TEXT = { finish: 'Chegada', 'finish-tie': 'Chegada no mesmo instante', crash: 'Os dois caíram: vale a distância', abandon: 'Abandono do adversário', 'abandon-both': 'Os dois saíram' };

export class OnlineUi {
  constructor(hud, levels) {
    this.hud = hud; this.levels = levels;
    const $ = id => document.getElementById(id);
    Object.assign(this, { modal: $('online-modal'), setup: $('online-setup'), lobby: $('online-lobby'), status: $('online-status'), name: $('online-name'),
      level: $('online-level'), code: $('online-code'), roomCode: $('online-room-code'), roomLevel: $('online-room-level'), players: $('online-players'),
      readyBtn: $('online-ready-btn'), result: $('online-result-modal'), raceLine: $('run-online') });
    this.level.replaceChildren(...levels.map(l => Object.assign(document.createElement('option'), { value: l.id, textContent: `Fase ${l.number} · ${l.name}` })));
  }
  bind(actions) {
    const $ = id => document.getElementById(id);
    $('online-create-btn').addEventListener('click', () => actions.create(this.level.value, this.name.value));
    $('online-join-btn').addEventListener('click', () => actions.join(this.code.value, this.name.value));
    this.code.addEventListener('keydown', event => { if (event.key === 'Enter') actions.join(this.code.value, this.name.value); });
    this.readyBtn.addEventListener('click', () => actions.ready());
    $('online-leave-btn').addEventListener('click', () => actions.leave());
    $('online-again-btn').addEventListener('click', () => actions.again());
    $('online-menu-btn').addEventListener('click', () => actions.menu());
  }
  showSetup(status = '') {
    this.result.hidden = true; this.modal.hidden = false; this.setup.hidden = false; this.lobby.hidden = true;
    this.setStatus(status); this.hud.dialogs.sync();
  }
  showLobby({ roomId, levelId, players, me, ready }) {
    this.modal.hidden = false; this.setup.hidden = true; this.lobby.hidden = false;
    this.roomCode.textContent = roomId;
    const level = this.levels.find(l => l.id === levelId); this.roomLevel.textContent = level ? `Fase ${level.number} · ${level.name}` : levelId;
    this.players.replaceChildren(...players.map(p => Object.assign(document.createElement('li'), { textContent: `${p.name}${p.id === me ? ' (você)' : ''} · ${p.ready ? 'PRONTO' : 'aguardando'}` })));
    this.readyBtn.textContent = ready ? 'CANCELAR PRONTO' : 'ESTOU PRONTO';
    this.setStatus(players.length < 2 ? `Passe o código ${roomId} para o outro jogador.` : players.every(p => p.ready) ? 'Largada em instantes…' : 'Os dois precisam marcar PRONTO.');
    this.hud.dialogs.sync();
  }
  setStatus(text) { this.status.textContent = text; }
  error(code) { this.setStatus(ERROR_TEXT[code] || `Erro do servidor: ${code}`); }
  hide() { this.modal.hidden = true; this.result.hidden = true; this.raceLine.hidden = true; this.hud.dialogs.sync(); }
  /** Race line in the phase panel: opponent gap and connection health. */
  setRace(text, unstable = false) { this.raceLine.hidden = !text; this.raceLine.textContent = text; this.raceLine.classList.toggle('unstable', unstable); }
  showResult(result, me) {
    this.modal.hidden = true; this.result.hidden = false;
    const won = result.winner === me, title = result.winner ? (won ? 'VITÓRIA!' : 'DERROTA') : result.draw ? 'EMPATE' : 'SEM VENCEDOR';
    document.getElementById('online-result-title').textContent = title;
    document.getElementById('online-result-summary').textContent = `${REASON_TEXT[result.reason] || result.reason}. Resultado oficial do servidor; não altera campanha, saldo nem troféu.`;
    document.getElementById('online-result-players').replaceChildren(...result.players.map(p => Object.assign(document.createElement('li'), {
      textContent: `${p.name}${p.id === me ? ' (você)' : ''}: ${p.state === 'finished' ? `chegou no tick ${p.endTick}` : p.state === 'crashed' ? `caiu a ${p.dist.toFixed(1)} m` : `${p.dist.toFixed(1)} m`} · ${p.score} pts` })));
    this.hud.dialogs.sync();
  }
}
