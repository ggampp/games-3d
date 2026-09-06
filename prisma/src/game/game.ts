import { recipeOf } from '../puzzle/colors.ts';
import { dailyPuzzle, randomPuzzle, todayKey } from '../puzzle/daily.ts';
import type { DailyPuzzle } from '../puzzle/daily.ts';
import { countKind, isPlaceable } from '../puzzle/grid.ts';
import type { Mirror, Placements, Puzzle } from '../puzzle/grid.ts';
import {
  CHAPTERS, isUnlocked, journeyPuzzle, levelId, levelSpec, nextLevel, starsFor,
} from '../puzzle/journey.ts';
import type { LevelRef } from '../puzzle/journey.ts';
import { isSolved, simulate } from '../puzzle/simulate.ts';
import type { Simulation } from '../puzzle/simulate.ts';
import { GameAudio } from '../audio/audio.ts';
import { GameLoop } from '../core/loop.ts';
import { Board3D } from '../render/board3d.ts';
import { Hud } from '../ui/hud.ts';
import {
  loadDailyStats, loadJourney, loadProgress, saveDailyStats, saveJourney, saveProgress,
} from './progress.ts';
import type { JourneyProgress } from './progress.ts';
import { shareText } from './share.ts';
import { currentStreak, registerDailySolve } from './streak.ts';
import type { DailyStats } from './streak.ts';

const CYCLE: (Mirror | null)[] = ['slash', 'backslash', null];

type Mode = 'daily' | 'random' | 'journey';

export class Game {
  private hud: Hud;
  private board: Board3D;
  private audio = new GameAudio();
  private mode: Mode = 'daily';
  private current: DailyPuzzle;
  private level: LevelRef = { chapter: 1, level: 1 };
  private placements: Placements = new Map();
  private sim: Simulation;
  private hover: number | null = null;
  private helpOpen = false;
  private journeyOpen = false;
  private difficultyId: string;
  private message = '';
  private startedAt = performance.now();
  private solvedSeconds = 0;
  private loop: GameLoop;
  private lastLit = 0;
  private lastMixCells = 0;
  private lastPick: number | null = null;
  private journey: JourneyProgress;
  private stats: DailyStats;
  private earnedStars = 0;

  constructor(mount: HTMLElement) {
    const progress = loadProgress();
    this.difficultyId = progress.difficultyId;
    this.journey = loadJourney();
    this.stats = loadDailyStats();

    this.hud = new Hud(mount, {
      onClear: () => this.clearBoard(),
      onNewPuzzle: () => this.loadPuzzle(randomPuzzle(this.difficultyId), 'random'),
      onDaily: () => this.loadPuzzle(dailyPuzzle(todayKey(), this.difficultyId), 'daily'),
      onDifficulty: (id) => this.selectDifficulty(id),
      onHelp: (open) => {
        this.helpOpen = open;
        this.hud.setHelpOpen(open);
      },
      onJourneyOpen: (open) => this.openJourney(open),
      onJourneyLevel: (ref) => this.startLevel(ref),
      onNextLevel: () => this.goNextLevel(),
      onShare: () => this.share(),
      onMute: (muted) => this.audio.setMuted(muted),
    });
    this.board = new Board3D(this.hud.canvas);

    this.current = dailyPuzzle(todayKey(), this.difficultyId);
    this.sim = simulate(this.current.puzzle, this.placements);
    if (progress.dateKey === this.current.dateKey && progress.difficultyId === this.difficultyId) {
      for (const [index, mirror] of progress.placements) {
        if (isPlaceable(this.current.puzzle, index)) this.placements.set(index, mirror);
      }
    }

    this.loop = new GameLoop((dt, time) => {
      this.hover = this.board.hoverCell();
      this.board.sync(this.current.puzzle, this.placements, this.sim, this.hover);
      this.board.update(dt, time, isSolved(this.current.puzzle, this.sim));
      this.publishDiagnostics();
    });

    this.hud.canvas.addEventListener('pointerdown', () => this.audio.unlock());
    this.hud.canvas.addEventListener('pointerup', (e) => this.onPointerUp(e));
    window.addEventListener('keydown', (e) => this.onKey(e));

    void this.board.ready.then(() => {
      this.hud.setLoading(false);
      this.refresh();
      this.loop.start();
    });
  }

  private get puzzle(): Puzzle {
    return this.current.puzzle;
  }

  private loadPuzzle(next: DailyPuzzle, mode: Mode): void {
    this.current = next;
    this.mode = mode;
    this.placements = new Map();
    this.message = '';
    this.startedAt = performance.now();
    this.solvedSeconds = 0;
    this.lastLit = 0;
    this.lastMixCells = 0;
    this.earnedStars = 0;
    this.refresh();
  }

  private selectDifficulty(id: string): void {
    if (id === this.difficultyId && this.mode === 'daily') return;
    this.difficultyId = id;
    this.loadPuzzle(dailyPuzzle(todayKey(), id), 'daily');
  }

  private openJourney(open: boolean): void {
    this.journeyOpen = open;
    this.hud.setJourneyOpen(open, this.journey, this.mode === 'journey' ? this.level : null);
  }

  private startLevel(ref: LevelRef): void {
    if (!isUnlocked(ref, this.journey.stars)) {
      this.audio.play('error', 0.7);
      return;
    }
    this.level = ref;
    this.journey.lastChapter = ref.chapter;
    this.journey.lastLevel = ref.level;
    saveJourney(this.journey);
    const spec = levelSpec(ref);
    this.openJourney(false);
    this.loadPuzzle({
      puzzle: journeyPuzzle(ref),
      dateKey: todayKey(),
      difficulty: spec,
      isDaily: false,
    }, 'journey');
    this.audio.play('click', 0.6);
  }

  private goNextLevel(): void {
    const next = nextLevel(this.level);
    if (!next) {
      this.openJourney(true);
      return;
    }
    this.startLevel(next);
  }

  private clearBoard(): void {
    this.placements.clear();
    this.message = 'Tabuleiro limpo.';
    this.audio.play('click', 0.7);
    this.refresh();
  }

  private refresh(): void {
    this.board.rebuild(this.puzzle);
    this.recompute();
  }

  private mixCellCount(sim: Simulation): number {
    let n = 0;
    const { puzzle } = this;
    for (let i = 0; i < puzzle.cells.length; i++) {
      let dirs = 0;
      for (let d = 0; d < 4; d++) if (sim.incoming[i * 4 + d]) dirs += 1;
      if (dirs >= 2) n += 1;
    }
    return n;
  }

  private recompute(): void {
    const { puzzle } = this;
    this.sim = simulate(puzzle, this.placements);

    const solved = isSolved(puzzle, this.sim);
    const wasSolved = this.message.startsWith('Resolvido');
    if (solved && !wasSolved) {
      this.solvedSeconds = Math.max(1, Math.round((performance.now() - this.startedAt) / 1000));
      this.onSolved();
    } else if (!solved && wasSolved) {
      this.message = '';
    }

    if (this.sim.lit.size > this.lastLit) this.audio.play('target', 0.8);
    this.lastLit = this.sim.lit.size;
    const mixes = this.mixCellCount(this.sim);
    if (mixes > this.lastMixCells) this.audio.playMix();
    this.lastMixCells = mixes;

    if (this.mode === 'daily' && this.current.dateKey === todayKey()) {
      saveProgress({
        dateKey: this.current.dateKey,
        difficultyId: this.difficultyId,
        placements: [...this.placements],
        solved,
      });
    }

    const today = todayKey();
    const chapter = CHAPTERS.find((c) => c.id === this.level.chapter) ?? CHAPTERS[0];
    this.hud.update({
      mode: this.mode,
      dateKey: this.current.dateKey,
      difficultyId: this.difficultyId,
      difficultyLabel: this.current.difficulty.label,
      levelTitle: this.mode === 'journey' ? `${chapter.title} · ${this.level.level}/6` : '',
      levelIntro: this.mode === 'journey' ? chapter.intro : '',
      mirrorsUsed: this.placements.size,
      mirrorBudget: puzzle.mirrorBudget,
      par: puzzle.par,
      targetsLit: this.sim.lit.size,
      targetsTotal: countKind(puzzle, 'target'),
      hasPrism: countKind(puzzle, 'prism') > 0,
      hasFilter: countKind(puzzle, 'filter') > 0,
      streak: currentStreak(this.stats, today),
      bestStreak: this.stats.best,
      message: this.message || this.hint(),
      solved,
      stars: this.earnedStars,
      hasNext: this.mode === 'journey' && nextLevel(this.level) !== null,
    }, puzzle, this.sim);
  }

  private onSolved(): void {
    const used = this.placements.size;
    const seconds = this.solvedSeconds;
    this.audio.play('win', 0.85);

    if (this.mode === 'journey') {
      const stars = starsFor(this.puzzle.par, used);
      this.earnedStars = stars;
      const id = levelId(this.level);
      const previous = this.journey.stars[id] ?? 0;
      if (stars > previous) this.journey.stars[id] = stars;
      saveJourney(this.journey);
      const starText = '★'.repeat(stars) + '☆'.repeat(3 - stars);
      const parNote = used <= this.puzzle.par
        ? 'no par.'
        : `com ${used - this.puzzle.par} espelho(s) acima do par ${this.puzzle.par}.`;
      this.message = `Resolvido em ${seconds}s ${parNote} ${starText}`;
      return;
    }

    if (this.mode === 'daily' && this.current.dateKey === todayKey()) {
      this.stats = registerDailySolve(this.stats, this.current.dateKey);
      saveDailyStats(this.stats);
      const streak = this.stats.streak;
      this.message = `Resolvido em ${seconds}s com ${used} espelho(s)! `
        + (streak > 1 ? `🔥 ${streak} dias seguidos.` : 'Toda a luz chegou onde devia.');
      return;
    }

    this.message = `Resolvido em ${seconds}s com ${used} espelho(s)! Toda a luz chegou onde devia.`;
  }

  private share(): void {
    const title = this.mode === 'journey'
      ? `Jornada ${levelId(this.level)}`
      : `${this.current.dateKey} · ${this.current.difficulty.label}${this.mode === 'random' ? ' (extra)' : ''}`;
    const text = shareText(this.puzzle, this.sim, this.placements, {
      title,
      seconds: this.solvedSeconds || Math.round((performance.now() - this.startedAt) / 1000),
      streak: this.mode === 'daily' ? currentStreak(this.stats, todayKey()) : undefined,
      stars: this.mode === 'journey' ? this.earnedStars : undefined,
    });
    void this.copy(text).then((ok) => {
      this.hud.flashShare(ok ? 'Resumo copiado!' : 'Não deu para copiar — veja o console.');
      if (!ok) console.info(text);
      this.audio.play('click', 0.6);
    });
  }

  private async copy(text: string): Promise<boolean> {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch {
      // cai no textarea abaixo
    }
    try {
      const area = document.createElement('textarea');
      area.value = text;
      area.setAttribute('readonly', '');
      area.style.position = 'fixed';
      area.style.opacity = '0';
      document.body.appendChild(area);
      area.select();
      const ok = document.execCommand('copy');
      area.remove();
      return ok;
    } catch {
      return false;
    }
  }

  private hint(): string {
    const { puzzle } = this;
    if (this.placements.size === 0) {
      if (this.mode === 'journey' && countKind(puzzle, 'prism') > 0 && this.level.chapter === 2) {
        return 'O <b>prisma</b> é fixo: leve um feixe até ele e a luz sai pelos dois lados.';
      }
      if (this.mode === 'journey' && countKind(puzzle, 'filter') > 0 && this.level.chapter === 3) {
        return 'O <b>filtro</b> só deixa passar a cor dele — use-o para separar uma mistura.';
      }
      return 'Clique numa célula vazia para pôr um espelho. Clique de novo para virá-lo.';
    }
    if (this.sim.wrong.size > 0) {
      const index = [...this.sim.wrong][0];
      const cell = puzzle.cells[index];
      if (cell.kind === 'target') {
        return `Um alvo pede <b>${recipeOf(cell.want)}</b>, mas está recebendo `
          + `<b>${recipeOf(this.sim.atCell[index])}</b>.`;
      }
    }
    const missing = puzzle.mirrorBudget - this.placements.size;
    if (missing <= 0) return 'Acabaram os espelhos — reposicione algum para abrir espaço.';
    if (this.mode === 'journey' && this.placements.size > puzzle.par) {
      return `Acima do par (${puzzle.par}): ainda resolve, mas vale menos estrelas.`;
    }
    return `Faltam ${this.sim.lit.size === 0 ? '' : 'ainda '}`
      + `${missing} espelho(s) no seu estoque.`;
  }

  private onPointerUp(e: PointerEvent): void {
    if (this.helpOpen || this.journeyOpen || this.board.didDrag()) return;
    const index = this.board.pickCell();
    this.lastPick = index;
    if (index === null || !isPlaceable(this.puzzle, index)) return;

    const current = this.placements.get(index) ?? null;
    const next = e.button === 2 ? null : CYCLE[(CYCLE.indexOf(current) + 1) % CYCLE.length];

    if (next === null) {
      this.placements.delete(index);
      this.audio.play('remove', 0.7);
    } else {
      if (current === null && this.placements.size >= this.puzzle.mirrorBudget) {
        this.message = `Você só tem ${this.puzzle.mirrorBudget} espelhos — `
          + 'tire um do tabuleiro antes de pôr outro.';
        this.audio.play('error', 0.8);
        this.recompute();
        return;
      }
      this.placements.set(index, next);
      this.audio.play(current === null ? 'place' : 'flip', 0.75);
    }
    if (this.message && !this.message.startsWith('Resolvido')) this.message = '';
    this.recompute();
  }

  private onKey(e: KeyboardEvent): void {
    if (e.code === 'Escape') {
      this.helpOpen = false;
      this.hud.setHelpOpen(false);
      if (this.journeyOpen) this.openJourney(false);
    }
    if (e.code === 'KeyC') this.clearBoard();
    if (e.code === 'KeyN') this.loadPuzzle(randomPuzzle(this.difficultyId), 'random');
    if (e.code === 'KeyJ') this.openJourney(!this.journeyOpen);
    if (e.code === 'KeyM') {
      this.audio.setMuted(!this.audio.muted);
    }
  }

  private publishDiagnostics(): void {
    const diag = this.board.scene.diagnostics();
    (window as unknown as { __THREE_GAME_DIAGNOSTICS__: unknown }).__THREE_GAME_DIAGNOSTICS__ = {
      ...diag,
      imported: this.board.models.stats,
      puzzle: this.puzzle.difficulty,
      mode: this.mode,
      level: levelId(this.level),
      mirrors: this.placements.size,
      lit: this.sim.lit.size,
      solved: isSolved(this.puzzle, this.sim),
      hover: this.hover,
      lastPick: this.lastPick,
    };
  }
}
