import { getTile, PHASES } from '../game/catalog';
import { tileArtUrl } from '../game/art';
import type { Session } from '../game/session';
import type { SaveData } from '../save';

function el<T extends HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (!node) throw new Error(`Missing #${id}`);
  return node as T;
}

export function showScreen(id: 'title' | 'map' | 'album' | 'play' | 'options'): void {
  for (const screen of document.querySelectorAll<HTMLElement>('.screen')) {
    screen.hidden = screen.id !== `screen-${id}`;
  }
}

export function bindUi(handlers: {
  onPlay: () => void;
  onContinue: () => void;
  onMap: () => void;
  onAlbum: () => void;
  onOptions: () => void;
  onBackTitle: () => void;
  onSelectPhase: (id: number) => void;
  onSelectCard: (index: number) => void;
  onPack: () => void;
  onPause: () => void;
  onResume: () => void;
  onQuit: () => void;
  onRetry: () => void;
  onNextPhase: () => void;
  onCloseModal: () => void;
  onToggleMusic: (on: boolean) => void;
  onToggleParticles: (on: boolean) => void;
  onEndDay: () => void;
}): void {
  el('btn-play').addEventListener('click', handlers.onPlay);
  el('btn-continue').addEventListener('click', handlers.onContinue);
  el('btn-map').addEventListener('click', handlers.onMap);
  el('btn-album').addEventListener('click', handlers.onAlbum);
  el('btn-options').addEventListener('click', handlers.onOptions);
  document.querySelectorAll('[data-back-title]').forEach((btn) => {
    btn.addEventListener('click', handlers.onBackTitle);
  });
  el('btn-pack').addEventListener('click', handlers.onPack);
  el('btn-pause').addEventListener('click', handlers.onPause);
  el('btn-resume').addEventListener('click', handlers.onResume);
  el('btn-quit').addEventListener('click', handlers.onQuit);
  el('btn-retry').addEventListener('click', handlers.onRetry);
  el('btn-next-phase').addEventListener('click', handlers.onNextPhase);
  el('btn-close-modal').addEventListener('click', handlers.onCloseModal);
  el('btn-end-day').addEventListener('click', handlers.onEndDay);
  el<HTMLInputElement>('opt-music').addEventListener('change', (event) => {
    handlers.onToggleMusic((event.target as HTMLInputElement).checked);
  });
  el<HTMLInputElement>('opt-particles').addEventListener('change', (event) => {
    handlers.onToggleParticles((event.target as HTMLInputElement).checked);
  });

  el('phase-nodes').addEventListener('click', (event) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-phase]');
    if (!button) return;
    handlers.onSelectPhase(Number(button.dataset.phase));
  });

  el('card-hand').addEventListener('click', (event) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-card]');
    if (!button) return;
    handlers.onSelectCard(Number(button.dataset.card));
  });
}

export function renderMap(save: SaveData): void {
  const root = el('phase-nodes');
  root.innerHTML = PHASES.map((phase) => {
    const unlocked = phase.id <= save.maxUnlockedPhase;
    const done = save.completedPhases.includes(phase.id);
    const state = done ? 'feita' : unlocked ? 'aberta' : 'fechada';
    return `<button type="button" class="phase-node ${state}" data-phase="${phase.id}" ${unlocked ? '' : 'disabled'}>
      <span class="phase-num">${phase.id}</span>
      <strong>${phase.nome}</strong>
      <em>${phase.subtitulo}</em>
      <span class="phase-state">${done ? 'Estrela' : unlocked ? 'Abrir' : 'Cadeado'}</span>
    </button>`;
  }).join('');
}

export function renderAlbum(save: SaveData): void {
  const root = el('album-grid');
  const ids = [...new Set(save.discoveredTiles)];
  root.innerHTML = ids
    .map((id) => {
      try {
        const tile = getTile(id);
        return `<article class="album-card"><img src="${tileArtUrl(id)}" alt="" /><h3>${tile.nome}</h3><p>${tile.descricao}</p><span>${tile.tipo}</span></article>`;
      } catch {
        return '';
      }
    })
    .join('');
}

export function renderHud(session: Session): void {
  const { harmony, resources } = session.evaluation;
  el('stat-natureza').textContent = String(harmony.natureza);
  el('stat-povo').textContent = String(harmony.povo);
  el('stat-agua').textContent = String(harmony.agua);
  el('stat-pao').textContent = String(session.spendablePao);
  el('stat-pop').textContent = String(resources.populacao);
  el('stat-deck').textContent = String(session.deck.length);

  const phase = session.phaseId;
  const def = PHASES.find((item) => item.id === phase);
  el('phase-title').textContent = def?.nome ?? '';
  el('phase-sub').textContent = def?.subtitulo ?? '';

  el('quest-list').innerHTML = session.quests
    .map(
      (quest) => `<li class="${quest.done ? 'done' : ''}">
        <strong>${quest.titulo}</strong>
        <span>${quest.descricao}</span>
        <em>${Math.min(quest.current, quest.amount)}/${quest.amount}${quest.optional ? ' · opcional' : ''}</em>
      </li>`,
    )
    .join('');

  el('card-hand').innerHTML = session.hand
    .map((id, index) => {
      const tile = getTile(id);
      const selected = index === session.selectedHandIndex ? 'selected' : '';
      return `<button type="button" class="card ${selected}" data-card="${index}">
        <span class="card-art" style="background-image:url('${tileArtUrl(id)}')"></span>
        <span class="card-tipo">${tile.tipo}</span>
        <strong>${tile.nome}</strong>
        <p>${tile.descricao}</p>
      </button>`;
    })
    .join('');

  const pack = el<HTMLButtonElement>('btn-pack');
  pack.disabled = session.spendablePao < 1 || session.status !== 'playing';
  const endDay = el<HTMLButtonElement>('btn-end-day');
  endDay.hidden = !def?.sandbox;
}

export function setContinueEnabled(enabled: boolean): void {
  el<HTMLButtonElement>('btn-continue').disabled = !enabled;
}

export function setOptions(save: SaveData): void {
  el<HTMLInputElement>('opt-music').checked = save.options.music;
  el<HTMLInputElement>('opt-particles').checked = save.options.reduceParticles;
}

export function showPause(open: boolean): void {
  el('pause-overlay').hidden = !open;
}

export function showModal(kind: 'complete' | 'asleep' | 'none', title: string, body: string, unlock?: string): void {
  const modal = el('modal');
  if (kind === 'none') {
    modal.hidden = true;
    return;
  }
  modal.hidden = false;
  el('modal-title').textContent = title;
  el('modal-body').textContent = body;
  el('modal-unlock').textContent = unlock ?? '';
  el('btn-retry').hidden = kind !== 'asleep';
  el('btn-next-phase').hidden = kind !== 'complete';
  el('btn-close-modal').hidden = kind === 'asleep';
}
