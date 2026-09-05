import { getTile, PHASES, TILES } from '../game/catalog';
import { tileArtUrl } from '../game/art';
import { DISCARDS_PER_PHASE, PACK_COST } from '../game/economy';
import type { Session } from '../game/session';
import type { PlaceFloat, Score } from '../game/types';
import { totalStars, type SaveData } from '../save';

function el<T extends HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (!node) throw new Error(`Missing #${id}`);
  return node as T;
}

export type Screen = 'title' | 'map' | 'album' | 'play' | 'options';

export function showScreen(id: Screen): void {
  for (const screen of document.querySelectorAll<HTMLElement>('.screen')) {
    screen.hidden = screen.id !== `screen-${id}`;
  }
}

export function starsText(stars: number, max = 3): string {
  return '★'.repeat(stars) + '☆'.repeat(Math.max(0, max - stars));
}

export type UiHandlers = {
  onPlay: () => void;
  onContinue: () => void;
  onMap: () => void;
  onAlbum: () => void;
  onOptions: () => void;
  onBackTitle: () => void;
  onSelectPhase: (id: number) => void;
  onSelectCard: (index: number) => void;
  onHoverCard: () => void;
  onPack: () => void;
  onDiscard: () => void;
  onUndo: () => void;
  onFinish: () => void;
  onPause: () => void;
  onResume: () => void;
  onQuit: () => void;
  onRetry: () => void;
  onNextPhase: () => void;
  onCloseModal: () => void;
  onHintClose: () => void;
  onOptionsChange: (options: SaveData['options']) => void;
  onTutorialReset: () => void;
  onResetSave: () => void;
};

export function bindUi(handlers: UiHandlers): void {
  el('btn-play').addEventListener('click', handlers.onPlay);
  el('btn-continue').addEventListener('click', handlers.onContinue);
  el('btn-map').addEventListener('click', handlers.onMap);
  el('btn-album').addEventListener('click', handlers.onAlbum);
  el('btn-options').addEventListener('click', handlers.onOptions);
  document.querySelectorAll('[data-back-title]').forEach((btn) => {
    btn.addEventListener('click', handlers.onBackTitle);
  });
  el('btn-pack').addEventListener('click', handlers.onPack);
  el('btn-discard').addEventListener('click', handlers.onDiscard);
  el('btn-undo').addEventListener('click', handlers.onUndo);
  el('btn-finish').addEventListener('click', handlers.onFinish);
  el('btn-pause').addEventListener('click', handlers.onPause);
  el('btn-resume').addEventListener('click', handlers.onResume);
  el('btn-quit').addEventListener('click', handlers.onQuit);
  el('btn-retry').addEventListener('click', handlers.onRetry);
  el('btn-next-phase').addEventListener('click', handlers.onNextPhase);
  el('btn-close-modal').addEventListener('click', handlers.onCloseModal);
  el('btn-hint-close').addEventListener('click', handlers.onHintClose);
  el('btn-tutorial-reset').addEventListener('click', handlers.onTutorialReset);
  el('btn-reset-save').addEventListener('click', handlers.onResetSave);

  const readOptions = (): SaveData['options'] => ({
    music: el<HTMLInputElement>('opt-music').checked,
    musicVolume: Number(el<HTMLInputElement>('opt-music-volume').value),
    sfxVolume: Number(el<HTMLInputElement>('opt-sfx-volume').value),
    voice: el<HTMLInputElement>('opt-voice').checked,
    models3d: el<HTMLInputElement>('opt-models').checked,
    reduceParticles: el<HTMLInputElement>('opt-particles').checked,
    tutorialDone: currentTutorialDone,
  });
  for (const id of ['opt-music', 'opt-music-volume', 'opt-sfx-volume', 'opt-voice', 'opt-models', 'opt-particles']) {
    el<HTMLInputElement>(id).addEventListener('input', () => handlers.onOptionsChange(readOptions()));
  }

  el('phase-nodes').addEventListener('click', (event) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-phase]');
    if (!button) return;
    handlers.onSelectPhase(Number(button.dataset.phase));
  });

  // Em telas pequenas a caixa de missões começa recolhida e o título alterna.
  const questBox = el('quest-box');
  if (window.matchMedia('(max-width: 760px)').matches) questBox.classList.add('collapsed');
  questBox.querySelector('h3')?.addEventListener('click', () => questBox.classList.toggle('collapsed'));

  const hand = el('card-hand');
  hand.addEventListener('click', (event) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-card]');
    if (!button) return;
    handlers.onSelectCard(Number(button.dataset.card));
  });
  hand.addEventListener('pointerover', (event) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-card]');
    if (button) handlers.onHoverCard();
  });
}

let currentTutorialDone = false;

export function renderTitle(save: SaveData): void {
  const total = totalStars(save);
  const max = PHASES.filter((phase) => !phase.sandbox).length * 3;
  el('title-stars').textContent = total > 0 ? `${starsText(Math.min(3, total), 3)} ${total} de ${max} estrelas na campanha` : '';
  el<HTMLButtonElement>('btn-continue').hidden = !save.session;
  el<HTMLButtonElement>('btn-play').textContent = save.session ? 'Nova fase' : 'Jogar';
}

export function renderMap(save: SaveData): void {
  const root = el('phase-nodes');
  root.innerHTML = PHASES.map((phase) => {
    const unlocked = phase.id <= save.maxUnlockedPhase;
    const done = save.completedPhases.includes(phase.id);
    const stars = save.stars[String(phase.id)] ?? 0;
    const best = save.bestScores[String(phase.id)];
    const state = done ? 'feita' : unlocked ? 'aberta' : 'fechada';
    const status = phase.sandbox
      ? done
        ? 'Reino visitado'
        : unlocked
          ? 'Sem missões obrigatórias'
          : 'Complete o Inverno'
      : done
        ? `Melhor: ${best ?? 0} pontos`
        : unlocked
          ? 'Abrir'
          : 'Trancada';
    return `<button type="button" class="phase-node ${state}" data-phase="${phase.id}" ${unlocked ? '' : 'disabled'}>
      <img class="phase-node-badge" src="/images/seasons/${phase.estacao}.png" alt="" width="64" height="64" loading="lazy" />
      <span class="phase-num">${phase.id}</span>
      <strong>${phase.nome}</strong>
      <em>${phase.subtitulo}</em>
      <span class="phase-stars">${phase.sandbox ? '' : starsText(stars)}</span>
      <span class="phase-state">${status}</span>
    </button>`;
  }).join('');
}

export function renderAlbum(save: SaveData): void {
  const root = el('album-grid');
  const discovered = new Set(save.discoveredTiles);
  const unlocked = new Set(save.unlockedTiles);
  el('album-count').textContent = `${discovered.size} de ${TILES.length} tiles descobertos`;
  root.innerHTML = TILES.map((tile) => {
    if (discovered.has(tile.id)) {
      return `<article class="album-card"><img src="${tileArtUrl(tile.id)}" alt="" loading="lazy" /><h3>${tile.nome}</h3><p>${tile.descricao}</p><span>${tile.tipo} · ${tile.bioma}</span></article>`;
    }
    const hint = unlocked.has(tile.id) ? 'Já no baralho: pose para descobrir.' : `Aparece na fase ${tile.unlockPhase}.`;
    return `<article class="album-card locked"><div class="album-locked-art">?</div><h3>???</h3><p>${hint}</p><span>${tile.tipo}</span></article>`;
  }).join('');
}

function scoreLine(score: Score, questsDone: boolean, sandbox: boolean): string {
  const stars = sandbox ? '' : `<b class="stars">${starsText(score.stars)}</b>`;
  const next =
    !sandbox && score.nextStarAt !== null
      ? `<small>próxima estrela: ${score.nextStarAt} pontos</small>`
      : !sandbox && !questsDone
        ? '<small>cumpra as missões para a primeira estrela</small>'
        : '';
  return `<span><b>${score.total}</b> pontos ${stars}</span>${next}`;
}

export function renderHud(session: Session): void {
  const { harmony, resources } = session.evaluation;
  el('stat-natureza').textContent = String(harmony.natureza);
  el('stat-povo').textContent = String(harmony.povo);
  el('stat-agua').textContent = String(harmony.agua);
  el('stat-moedas').textContent = String(session.coins);
  el('stat-pop').textContent = String(resources.populacao);
  el('stat-deck').textContent = String(session.cardsLeft);
  el('res-pao').textContent = String(resources.pao);
  el('res-farinha').textContent = String(resources.farinha);
  el('res-madeira').textContent = String(resources.madeira);
  el('res-peixe').textContent = String(resources.peixe);
  el('res-pedra').textContent = String(resources.pedra);

  const def = session.phase;
  el('phase-title').textContent = def.nome;
  el('phase-sub').textContent = def.sandbox ? `Semente ${session.seed.toString(36)}` : def.subtitulo;
  el<HTMLImageElement>('phase-badge').src = `/images/seasons/${def.estacao}.png`;

  el('quest-list').innerHTML = session.quests
    .map(
      (quest) => `<li class="${quest.done ? 'done' : ''}">
        <strong>${quest.titulo}</strong>
        <span>${quest.descricao}</span>
        <em>${Math.min(quest.current, quest.amount)}/${quest.amount}${quest.optional ? ' · opcional' : ''}</em>
      </li>`,
    )
    .join('');
  el('score-line').innerHTML = scoreLine(session.score, session.questsDone, def.sandbox);

  const handEl = el('card-hand');
  handEl.style.setProperty('--n', String(session.hand.length));
  handEl.innerHTML = session.hand
    .map((id, index) => {
      const tile = getTile(id);
      const selected = index === session.selectedHandIndex ? 'selected' : '';
      const offset = index - (session.hand.length - 1) / 2;
      return `<button type="button" class="card ${selected}" data-card="${index}" style="--i:${offset}" aria-pressed="${selected ? 'true' : 'false'}">
        <span class="card-key">${index + 1}</span>
        <span class="card-art" style="background-image:url('${tileArtUrl(id)}')"></span>
        <span class="card-tipo">${tile.tipo}</span>
        <strong>${tile.nome}</strong>
        <p>${tile.descricao}</p>
      </button>`;
    })
    .join('');

  const pack = el<HTMLButtonElement>('btn-pack');
  pack.disabled = !session.canBuyPack;
  pack.textContent = `Novo pacote · ${PACK_COST} moedas`;
  const discard = el<HTMLButtonElement>('btn-discard');
  discard.disabled = !session.canDiscard;
  discard.textContent = `Descartar (${session.discardsLeft}/${DISCARDS_PER_PHASE})`;
  el<HTMLButtonElement>('btn-undo').disabled = !session.canUndo;
  const finish = el<HTMLButtonElement>('btn-finish');
  finish.hidden = !session.canFinish;
  finish.textContent = def.sandbox ? 'Encerrar o dia' : 'Encerrar a fase';
}

export function setOptions(save: SaveData): void {
  currentTutorialDone = save.options.tutorialDone;
  el<HTMLInputElement>('opt-music').checked = save.options.music;
  el<HTMLInputElement>('opt-music-volume').value = String(save.options.musicVolume);
  el<HTMLInputElement>('opt-sfx-volume').value = String(save.options.sfxVolume);
  el<HTMLInputElement>('opt-voice').checked = save.options.voice;
  el<HTMLInputElement>('opt-models').checked = save.options.models3d;
  el<HTMLInputElement>('opt-particles').checked = save.options.reduceParticles;
}

export function showPause(open: boolean): void {
  el('pause-overlay').hidden = !open;
}

export function isModalOpen(): boolean {
  return !el('modal').hidden || !el('pause-overlay').hidden;
}

export function showModal(
  kind: 'complete' | 'asleep' | 'none',
  title: string,
  body: string,
  extra?: { unlock?: string; stars?: number; score?: number; hasNext?: boolean },
): void {
  const modal = el('modal');
  if (kind === 'none') {
    modal.hidden = true;
    return;
  }
  modal.hidden = false;
  el('modal-title').textContent = title;
  el('modal-body').textContent = body;
  el('modal-unlock').textContent = extra?.unlock ?? '';
  const starsEl = el('modal-stars');
  starsEl.textContent =
    kind === 'complete' && extra?.stars !== undefined ? `${starsText(extra.stars)} · ${extra.score ?? 0} pontos` : '';
  el('btn-retry').hidden = kind !== 'asleep';
  el('btn-next-phase').hidden = kind !== 'complete' || extra?.hasNext === false;
  el('btn-close-modal').hidden = false;
}

export function showHint(text: string | null): void {
  const box = el('hint');
  box.hidden = !text;
  if (text) el('hint-text').textContent = text;
}

let toastTimer = 0;
export function showToast(text: string, kind: 'quest' | 'unlock' | 'info' = 'info'): void {
  const toast = el('toast');
  toast.textContent = text;
  toast.className = `toast ${kind}`;
  toast.hidden = false;
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    toast.hidden = true;
  }, 2600);
}

const AXIS_COLOR: Record<string, string> = {
  natureza: 'natureza',
  povo: 'povo',
  agua: 'agua',
  recurso: 'recurso',
};

/** Tooltip de prévia: o que a carta selecionada rende no hex sob o ponteiro. */
export function showHoverTip(floats: PlaceFloat[] | null, clientX: number, clientY: number, tileName?: string): void {
  const tip = el('hover-tip');
  if (!floats) {
    tip.hidden = true;
    return;
  }
  const rows =
    floats.length === 0
      ? '<span class="tip-row muted">Sem bônus aqui</span>'
      : floats
          .map((f) => `<span class="tip-row ${AXIS_COLOR[f.axis] ?? ''}">${f.amount > 0 ? '+' : ''}${f.amount} ${f.label}</span>`)
          .join('');
  tip.innerHTML = `${tileName ? `<b>${tileName}</b>` : ''}${rows}`;
  tip.hidden = false;
  const pad = 14;
  const w = tip.offsetWidth;
  const h = tip.offsetHeight;
  const x = Math.min(clientX + pad, window.innerWidth - w - 8);
  const y = Math.max(8, clientY - h - pad);
  tip.style.transform = `translate(${x}px, ${y}px)`;
}
