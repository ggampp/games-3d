import { ALL_COLORS, colorHex, colorName, recipeOf } from '../puzzle/colors.ts';
import { DIFFICULTIES } from '../puzzle/generate.ts';
import type { Puzzle } from '../puzzle/grid.ts';
import { CHAPTERS, LEVELS_PER_CHAPTER, isUnlocked, levelId, totalStars } from '../puzzle/journey.ts';
import type { LevelRef } from '../puzzle/journey.ts';
import type { Simulation } from '../puzzle/simulate.ts';
import { assetUrl } from '../render/materials.ts';
import type { JourneyProgress } from '../game/progress.ts';
import './styles.css';

export type HudMode = 'daily' | 'random' | 'journey';

export interface HudCallbacks {
  onClear: () => void;
  onNewPuzzle: () => void;
  onDaily: () => void;
  onDifficulty: (id: string) => void;
  onHelp: (open: boolean) => void;
  onJourneyOpen: (open: boolean) => void;
  onJourneyLevel: (ref: LevelRef) => void;
  onNextLevel: () => void;
  onShare: () => void;
  onMute: (muted: boolean) => void;
}

export interface HudState {
  mode: HudMode;
  dateKey: string;
  difficultyId: string;
  difficultyLabel: string;
  /** Título do nível da jornada (vazio fora dela). */
  levelTitle: string;
  levelIntro: string;
  mirrorsUsed: number;
  mirrorBudget: number;
  par: number;
  targetsLit: number;
  targetsTotal: number;
  hasPrism: boolean;
  hasFilter: boolean;
  streak: number;
  bestStreak: number;
  message: string;
  solved: boolean;
  /** Estrelas ganhas no nível atual (0 fora da jornada ou antes de resolver). */
  stars: number;
  hasNext: boolean;
}

const MODE_BADGE: Record<HudMode, string> = {
  daily: 'DESAFIO DO DIA',
  random: 'TABULEIRO EXTRA',
  journey: 'JORNADA',
};

export class Hud {
  readonly canvas: HTMLCanvasElement;
  private root: HTMLElement;
  private callbacks: HudCallbacks;
  private muted = false;
  private flashTimer = 0;

  constructor(mount: HTMLElement, callbacks: HudCallbacks) {
    this.callbacks = callbacks;
    mount.innerHTML = TEMPLATE;
    this.root = mount;
    this.canvas = this.query('#board') as HTMLCanvasElement;

    const logo = this.query('#logo') as HTMLImageElement;
    logo.src = assetUrl('assets/ui/logo.png');
    logo.addEventListener('error', () => { logo.hidden = true; });

    this.query('#btn-clear').addEventListener('click', () => this.callbacks.onClear());
    this.query('#btn-new').addEventListener('click', () => this.callbacks.onNewPuzzle());
    this.query('#btn-daily').addEventListener('click', () => this.callbacks.onDaily());
    this.query('#btn-journey').addEventListener('click', () => this.callbacks.onJourneyOpen(true));
    this.query('#btn-journey-close').addEventListener('click', () => this.callbacks.onJourneyOpen(false));
    this.query('#btn-next').addEventListener('click', () => this.callbacks.onNextLevel());
    this.query('#btn-share').addEventListener('click', () => this.callbacks.onShare());
    this.query('#btn-help').addEventListener('click', () => this.callbacks.onHelp(true));
    this.query('#btn-help-close').addEventListener('click', () => this.callbacks.onHelp(false));
    this.query('#help').addEventListener('click', (e) => {
      if (e.target === this.query('#help')) this.callbacks.onHelp(false);
    });
    this.query('#journey').addEventListener('click', (e) => {
      if (e.target === this.query('#journey')) this.callbacks.onJourneyOpen(false);
    });
    this.query('#btn-mute').addEventListener('click', () => {
      this.muted = !this.muted;
      this.query('#btn-mute').textContent = this.muted ? 'Som off' : 'Som';
      this.callbacks.onMute(this.muted);
    });

    const picker = this.query('#difficulties');
    for (const spec of DIFFICULTIES) {
      const button = document.createElement('button');
      button.textContent = spec.label;
      button.dataset.id = spec.id;
      button.addEventListener('click', () => this.callbacks.onDifficulty(spec.id));
      picker.appendChild(button);
    }

    this.renderMixes();
  }

  private query(selector: string): HTMLElement {
    const el = this.root.querySelector(selector);
    if (!el) throw new Error(`elemento ausente na HUD: ${selector}`);
    return el as HTMLElement;
  }

  private renderMixes(): void {
    const list = this.query('#mixes');
    for (const mask of ALL_COLORS) {
      if (mask === 1 || mask === 2 || mask === 4) continue;
      const li = document.createElement('li');
      li.innerHTML =
        `<span class="swatch" style="background:${colorHex(mask)}"></span>` +
        `<span>${recipeOf(mask)} = <b>${colorName(mask)}</b></span>`;
      list.appendChild(li);
    }
  }

  setHelpOpen(open: boolean): void {
    this.query('#help').hidden = !open;
  }

  setLoading(open: boolean, label = 'Montando o ateliê óptico…'): void {
    const el = this.query('#loading');
    el.hidden = !open;
    this.query('#loading-label').textContent = label;
  }

  /** Abre/fecha o mapa da jornada e redesenha capítulos e níveis. */
  setJourneyOpen(open: boolean, journey: JourneyProgress, current: LevelRef | null): void {
    const overlay = this.query('#journey');
    overlay.hidden = !open;
    if (!open) return;

    const total = totalStars(journey.stars);
    const max = CHAPTERS.length * LEVELS_PER_CHAPTER * 3;
    this.query('#journey-total').textContent = `${total} / ${max} ★`;

    const list = this.query('#chapters');
    list.innerHTML = '';
    for (const chapter of CHAPTERS) {
      const section = document.createElement('section');
      section.className = 'chapter';
      const head = document.createElement('header');
      head.innerHTML = `<h3>${chapter.id}. ${chapter.title}</h3><p>${chapter.intro}</p>`;
      section.appendChild(head);

      const grid = document.createElement('div');
      grid.className = 'levels';
      for (let n = 1; n <= LEVELS_PER_CHAPTER; n++) {
        const ref: LevelRef = { chapter: chapter.id, level: n };
        const id = levelId(ref);
        const stars = journey.stars[id] ?? 0;
        const unlocked = isUnlocked(ref, journey.stars);
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'level';
        button.disabled = !unlocked;
        if (current && current.chapter === ref.chapter && current.level === ref.level) {
          button.classList.add('current');
        }
        if (stars > 0) button.classList.add('done');
        button.innerHTML =
          `<b>${n}</b>` +
          `<span class="stars">${unlocked ? '★'.repeat(stars) + '☆'.repeat(3 - stars) : '🔒'}</span>`;
        button.title = unlocked ? `Nível ${id}` : 'Resolva o nível anterior para liberar';
        button.addEventListener('click', () => this.callbacks.onJourneyLevel(ref));
        grid.appendChild(button);
      }
      section.appendChild(grid);
      list.appendChild(section);
    }
  }

  /** Aviso curto após copiar o resumo (ou falhar). */
  flashShare(text: string): void {
    const toast = this.query('#toast');
    toast.textContent = text;
    toast.hidden = false;
    toast.classList.remove('show');
    void toast.offsetWidth;
    toast.classList.add('show');
    window.clearTimeout(this.flashTimer);
    this.flashTimer = window.setTimeout(() => { toast.hidden = true; }, 2200);
  }

  update(state: HudState, puzzle: Puzzle, sim: Simulation): void {
    const journey = state.mode === 'journey';
    this.query('#date').textContent = journey ? state.levelTitle : state.dateKey;
    this.query('#difficulty').textContent = journey
      ? `PAR ${state.par}`
      : state.difficultyLabel.toUpperCase();
    this.query('#mirrors').textContent = `${state.mirrorsUsed}/${state.mirrorBudget}`;
    this.query('#targets').textContent = `${state.targetsLit}/${state.targetsTotal}`;
    this.query('#badge-daily').textContent = MODE_BADGE[state.mode];

    const intro = this.query('#level-intro');
    intro.textContent = journey ? state.levelIntro : '';
    intro.hidden = !journey || !state.levelIntro;

    const streak = this.query('#streak');
    streak.hidden = state.mode !== 'daily' || state.streak === 0;
    streak.textContent = `🔥 ${state.streak} dia${state.streak === 1 ? '' : 's'}`
      + (state.bestStreak > state.streak ? ` · recorde ${state.bestStreak}` : '');

    const mirrorFill = this.query('#meter-mirrors');
    const targetFill = this.query('#meter-targets');
    const mPct = state.mirrorBudget === 0 ? 0 : state.mirrorsUsed / state.mirrorBudget;
    const tPct = state.targetsTotal === 0 ? 0 : state.targetsLit / state.targetsTotal;
    mirrorFill.style.width = `${Math.min(1, mPct) * 100}%`;
    targetFill.style.width = `${Math.min(1, tPct) * 100}%`;
    mirrorFill.classList.toggle('over-par', journey && state.mirrorsUsed > state.par);

    const message = this.query('#message');
    message.innerHTML = state.message;
    message.classList.toggle('win', state.solved);
    this.root.classList.toggle('solved', state.solved);

    const starsEl = this.query('#stars');
    starsEl.hidden = !(journey && state.solved && state.stars > 0);
    starsEl.textContent = '★'.repeat(state.stars) + '☆'.repeat(Math.max(0, 3 - state.stars));

    this.query('#btn-daily').hidden = state.mode === 'daily';
    this.query('#btn-new').hidden = journey;
    this.query('#btn-next').hidden = !(journey && state.solved && state.hasNext);
    this.query('#btn-share').hidden = !state.solved;
    this.query('#difficulties').hidden = journey;

    this.root.querySelectorAll<HTMLElement>('#difficulties button').forEach((el) => {
      el.classList.toggle('active', el.dataset.id === state.difficultyId);
    });

    this.query('#help-prism').hidden = !state.hasPrism;
    this.query('#help-filter').hidden = !state.hasFilter;

    const legend = this.query('#legend');
    legend.innerHTML = '';
    puzzle.cells.forEach((cell, index) => {
      if (cell.kind !== 'target') return;
      const done = sim.lit.has(index);
      const li = document.createElement('li');
      if (done) li.classList.add('done');
      li.innerHTML =
        `<span class="dot" style="background:${colorHex(cell.want)};color:${colorHex(cell.want)}"></span>` +
        `<span>${recipeOf(cell.want)}${done ? ' ✓' : ''}</span>`;
      legend.appendChild(li);
    });
    if (state.hasPrism || state.hasFilter) {
      const li = document.createElement('li');
      li.className = 'fixed';
      const parts: string[] = [];
      if (state.hasPrism) parts.push('◆ prisma divide');
      if (state.hasFilter) parts.push('▮ filtro peneira');
      li.textContent = parts.join(' · ');
      legend.appendChild(li);
    }
  }
}

const TEMPLATE = `
  <div class="stage">
    <canvas id="board"></canvas>
    <div class="vignette" aria-hidden="true"></div>
  </div>

  <header class="hud-top">
    <div class="brand">
      <img id="logo" alt="" width="52" height="52" />
      <div>
        <h1>Prisma</h1>
        <p class="subtitle">
          <span id="date">—</span> · <span id="difficulty">—</span>
          <button type="button" id="btn-help">como jogar</button>
        </p>
        <p class="badges">
          <span class="badge" id="badge-daily">DESAFIO DO DIA</span>
          <span class="badge streak" id="streak" hidden></span>
        </p>
        <p class="level-intro" id="level-intro" hidden></p>
      </div>
    </div>
    <div class="meters">
      <div class="meter">
        <div class="meter-head"><span>Espelhos</span><b id="mirrors">0/0</b></div>
        <div class="meter-track"><i id="meter-mirrors"></i></div>
      </div>
      <div class="meter">
        <div class="meter-head"><span>Alvos</span><b id="targets">0/0</b></div>
        <div class="meter-track"><i id="meter-targets"></i></div>
      </div>
      <button type="button" class="icon-btn" id="btn-journey" title="Jornada (J)">Jornada</button>
      <button type="button" class="icon-btn" id="btn-mute" title="Som (M)">Som</button>
    </div>
  </header>

  <ul class="legend" id="legend"></ul>

  <div class="hud-bottom">
    <p class="stars-earned" id="stars" hidden></p>
    <p class="message" id="message"></p>
    <div class="actions">
      <button class="action" id="btn-clear">Limpar</button>
      <button class="action" id="btn-daily" hidden>Desafio do dia</button>
      <button class="action primary" id="btn-new">Outro tabuleiro</button>
      <button class="action primary" id="btn-next" hidden>Próximo nível →</button>
      <button class="action share" id="btn-share" hidden>Compartilhar</button>
    </div>
    <div class="difficulties" id="difficulties"></div>
    <p class="hint-orbit">Arraste para orbitar · clique para pôr um espelho · scroll para zoom · J abre a jornada</p>
  </div>

  <p class="toast" id="toast" hidden></p>

  <div class="overlay" id="journey" hidden>
    <div class="sheet journey-sheet">
      <header class="journey-head">
        <div>
          <h2>Jornada</h2>
          <p>${CHAPTERS.length} capítulos, seis níveis cada. Resolva no par para ganhar três estrelas.</p>
        </div>
        <b id="journey-total">0 ★</b>
      </header>
      <div id="chapters" class="chapters"></div>
      <button class="action close" id="btn-journey-close">Fechar</button>
    </div>
  </div>

  <div class="overlay" id="help" hidden>
    <div class="sheet">
      <h2>Como jogar</h2>
      <p>
        Cada emissor lança um feixe na direção da lente. Leve a luz até todos os
        alvos — na cor exata que cada um pede.
      </p>
      <h3>Espelhos</h3>
      <ul>
        <li>Clique numa célula vazia para colocar um espelho <b>/</b>.</li>
        <li>Clique de novo para virá-lo em <b>\\</b>, e mais uma vez para tirá-lo.</li>
        <li>O espelho desvia o feixe em 90°.</li>
      </ul>
      <h3>Misturar cores</h3>
      <p>
        Quando dois feixes se cruzam, eles <b>seguem misturados</b> a partir dali.
        É assim que se acende um alvo de cor secundária:
      </p>
      <ul class="mixes" id="mixes"></ul>
      <div id="help-prism" hidden>
        <h3>Prisma</h3>
        <p>
          Peça fixa: o feixe que chega <b>não atravessa</b> — sai dividido pelas duas
          direções perpendiculares, com a mesma cor.
        </p>
      </div>
      <div id="help-filter" hidden>
        <h3>Filtro</h3>
        <p>
          Peça fixa que só deixa passar <b>uma cor primária</b>. O feixe segue reto e
          perde as outras componentes; se não sobrar nada, é absorvido.
        </p>
      </div>
      <h3>Modos</h3>
      <ul>
        <li><b>Desafio do dia</b>: o mesmo tabuleiro para todo mundo. Resolver todo dia mantém a sequência 🔥.</li>
        <li><b>Jornada</b>: ${CHAPTERS.length * LEVELS_PER_CHAPTER} níveis em ${CHAPTERS.length} capítulos. Menos espelhos que o par vale mais estrelas.</li>
        <li><b>Compartilhar</b> copia um resumo em emojis, sem revelar a solução.</li>
      </ul>
      <h3>Regras da casa</h3>
      <ul>
        <li>Paredes bloqueiam a luz; emissores e alvos a absorvem.</li>
        <li>Você tem um número limitado de espelhos — na jornada, alguns a mais que o par.</li>
        <li>Teclas: <b>C</b> limpa, <b>N</b> novo tabuleiro, <b>J</b> jornada, <b>M</b> som, <b>Esc</b> fecha.</li>
      </ul>
      <button class="action close" id="btn-help-close">Entendi</button>
    </div>
  </div>

  <div class="overlay loading" id="loading">
    <div class="sheet loading-sheet">
      <div class="prism-spin" aria-hidden="true"></div>
      <p id="loading-label">Montando o ateliê óptico…</p>
    </div>
  </div>
`;
