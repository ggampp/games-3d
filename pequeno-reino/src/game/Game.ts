import * as THREE from 'three';
import { Sfx } from '../audio/sfx';
import { Loop } from '../core/Loop';
import { createRenderer, resizeRenderer } from '../core/Renderer';
import { getPhase, getTile, PHASES } from './catalog';
import { hexKey, type Hex } from './hex';
import { canPlace, validPlacements } from './placement';
import { KingdomView } from '../render/KingdomView';
import { loadSave, resetSave, writeSave, type SaveData } from '../save';
import {
  bindUi,
  isModalOpen,
  renderAlbum,
  renderHud,
  renderMap,
  renderTitle,
  setOptions,
  showHint,
  showHoverTip,
  showModal,
  showPause,
  showScreen,
  showToast,
  type Screen,
} from '../ui/hud';
import { Session } from './session';
import { tutorialStep } from './tutorial';

type PointerState = {
  x: number;
  y: number;
  down: boolean;
  dragged: boolean;
  id: number;
  /** Botão direito ou do meio arrasta o mapa em vez de girar. */
  pan: boolean;
};

const PAN_KEYS: Record<string, [number, number]> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, 1],
  ArrowDown: [0, -1],
  KeyA: [-1, 0],
  KeyD: [1, 0],
  KeyW: [0, 1],
  KeyS: [0, -1],
};

export class Game {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly view: KingdomView;
  private readonly loop: Loop;
  private readonly sfx = new Sfx();
  private save: SaveData;
  private session: Session | null = null;
  private screen: Screen = 'title';
  private paused = false;
  private frame = 0;
  private elapsed = 0;
  private pointer: PointerState = { x: 0, y: 0, down: false, dragged: false, id: -1, pan: false };
  /** Ponteiros ativos (toque): dois dedos viram pinça de zoom + arrasto do mapa. */
  private readonly touches = new Map<number, { x: number; y: number }>();
  private pinchDistance = 0;
  private pinchCenter = { x: 0, y: 0 };
  private readonly keysDown = new Set<string>();
  private lastHintId: string | null = null;
  private hintDismissed = new Set<string>();

  constructor(private readonly canvas: HTMLCanvasElement) {
    this.save = loadSave();
    this.renderer = createRenderer(canvas);
    this.renderer.toneMappingExposure = 1.12;
    this.view = new KingdomView(this.save.options.reduceParticles, this.save.options.models3d);
    this.view.loadShowcase();
    this.sfx.apply(this.save.options);

    this.loop = new Loop(
      (delta, elapsed) => this.update(delta, elapsed),
      () => this.render(),
    );

    this.bindPointer();
    bindUi({
      onPlay: () => this.startPhase(this.save.maxUnlockedPhase || 1),
      onContinue: () => this.continueGame(),
      onMap: () => this.openMap(),
      onAlbum: () => this.openAlbum(),
      onOptions: () => this.openOptions(),
      onBackTitle: () => this.goTitle(),
      onSelectPhase: (id) => this.startPhase(id),
      onSelectCard: (index) => this.selectCard(index),
      onHoverCard: () => this.sfx.play('hover'),
      onPack: () => this.usePack(),
      onDiscard: () => this.discardCard(),
      onUndo: () => this.undo(),
      onFinish: () => this.finishPhase(),
      onPause: () => this.setPaused(true),
      onResume: () => this.setPaused(false),
      onQuit: () => {
        this.setPaused(false);
        this.persistSession();
        this.goTitle();
      },
      onRetry: () => {
        if (this.session) this.startPhase(this.session.phaseId);
      },
      onNextPhase: () => this.advanceAfterComplete(),
      onCloseModal: () => {
        showModal('none', '', '');
        this.openMap();
      },
      onHintClose: () => {
        if (this.lastHintId) this.hintDismissed.add(this.lastHintId);
        showHint(null);
        this.sfx.stopVoice();
      },
      onOptionsChange: (options) => this.applyOptions(options),
      onTutorialReset: () => {
        this.save.options.tutorialDone = false;
        this.hintDismissed.clear();
        writeSave(this.save);
        showToast('O tutorial volta na Primavera.', 'info');
      },
      onResetSave: () => {
        if (!window.confirm('Apagar todo o progresso, estrelas e álbum?')) return;
        this.save = resetSave();
        this.hintDismissed.clear();
        setOptions(this.save);
        this.applyOptions(this.save.options);
        showToast('Progresso apagado.', 'info');
      },
    });

    setOptions(this.save);
    renderTitle(this.save);
    showScreen('title');
    resizeRenderer(this.renderer, this.view.camera, 2);
    this.publishDiagnostics();
    this.exposeDebug();
  }

  start(): void {
    this.loop.start();
  }

  dispose(): void {
    this.loop.stop();
    this.sfx.dispose();
    this.view.dispose();
    this.renderer.dispose();
    window.__THREE_GAME_DIAGNOSTICS__ = undefined;
    window.__PR_DEBUG__ = undefined;
  }

  /* ---------------------------------------------------------------- */
  /* Telas                                                            */
  /* ---------------------------------------------------------------- */

  private goTitle(): void {
    this.persistSession();
    this.screen = 'title';
    this.session = null;
    this.view.loadShowcase();
    this.view.setSky('#e8d5b7');
    this.sfx.playMusic(null);
    this.sfx.stopVoice();
    showPause(false);
    showModal('none', '', '');
    showHint(null);
    showHoverTip(null, 0, 0);
    renderTitle(this.save);
    showScreen('title');
  }

  private openMap(): void {
    this.persistSession();
    this.screen = 'map';
    this.session = null;
    this.view.loadShowcase();
    this.sfx.playMusic(null);
    showHint(null);
    showHoverTip(null, 0, 0);
    renderMap(this.save);
    showScreen('map');
  }

  private openAlbum(): void {
    this.screen = 'album';
    renderAlbum(this.save);
    showScreen('album');
  }

  private openOptions(): void {
    this.screen = 'options';
    setOptions(this.save);
    showScreen('options');
  }

  private applyOptions(options: SaveData['options']): void {
    this.save.options = { ...this.save.options, ...options, tutorialDone: this.save.options.tutorialDone };
    this.sfx.apply(this.save.options);
    this.view.setReduceParticles(this.save.options.reduceParticles);
    this.view.setUseModels(this.save.options.models3d);
    writeSave(this.save);
  }

  private continueGame(): void {
    if (this.save.session) {
      const restore = this.save.session;
      this.session = new Session(restore.phaseId, restore.seed, this.save.unlockedTiles, restore);
      this.enterPlay(false);
      return;
    }
    this.openMap();
  }

  private startPhase(id: number, seed = Date.now()): void {
    if (id > this.save.maxUnlockedPhase) return;
    this.session = new Session(id, seed, this.save.unlockedTiles);
    this.enterPlay(true);
  }

  private enterPlay(fresh: boolean): void {
    if (!this.session) return;
    this.screen = 'play';
    this.paused = false;
    showPause(false);
    showModal('none', '', '');
    const phase = getPhase(this.session.phaseId);
    this.view.setSky(phase.sky);
    this.view.setAutoRotate(false);
    this.view.syncMap(this.session.map);
    this.view.showValid(this.session.map, true);
    this.discover(this.session.map.values());
    renderHud(this.session);
    showScreen('play');
    this.persistSession();
    this.sfx.click();
    this.sfx.playMusic(phase.estacao);
    if (fresh) {
      showToast(`${phase.nome}: ${phase.subtitulo}`, 'info');
      this.sfx.speak(`phase-${phase.id}`);
      window.setTimeout(() => this.refreshHint(true), 3200);
    } else {
      this.refreshHint(true);
    }
  }

  /* ---------------------------------------------------------------- */
  /* Ações do jogador                                                 */
  /* ---------------------------------------------------------------- */

  private selectCard(index: number): void {
    if (!this.session || this.session.status !== 'playing' || this.screen !== 'play') return;
    this.session.selectHand(index);
    renderHud(this.session);
    this.sfx.click();
  }

  private usePack(): void {
    if (!this.session) return;
    const result = this.session.newPack();
    if (!result.ok) return;
    this.sfx.pack();
    this.afterAction();
  }

  private discardCard(): void {
    if (!this.session || !this.session.discardCard()) return;
    this.sfx.play('discard');
    this.afterAction();
  }

  private undo(): void {
    if (!this.session || !this.session.undo()) return;
    this.sfx.play('undo');
    this.view.syncMap(this.session.map);
    this.afterAction();
  }

  private finishPhase(): void {
    if (!this.session || !this.session.finishPhase()) return;
    renderHud(this.session);
    this.completePhase();
  }

  private afterAction(): void {
    if (!this.session) return;
    this.view.showValid(this.session.map, true);
    renderHud(this.session);
    this.persistSession();
    this.refreshHint(true);
    this.handleStatus();
  }

  private tryPlace(hex: Hex): void {
    if (!this.session || this.paused || this.session.status !== 'playing') return;
    const result = this.session.place(hex);
    if (!result.ok) return;
    const key = hexKey(hex);
    this.view.syncMap(this.session.map, key);
    this.view.showValid(this.session.map, true);
    this.sfx.place();
    this.discover(this.session.map.values());
    for (const float of result.floats) {
      const sign = float.amount > 0 ? '+' : '';
      const color =
        float.axis === 'natureza' ? '#2f6b3a' : float.axis === 'povo' ? '#c45c3e' : float.axis === 'agua' ? '#2f6f96' : '#6b4a28';
      this.view.floatLabel(hex, `${sign}${float.amount} ${float.label}`, color);
    }
    showHoverTip(null, 0, 0);
    renderHud(this.session);
    this.persistSession();
    if (result.questsJustDone && !this.session.questsCelebrated) {
      this.session.questsCelebrated = true;
      this.sfx.play('quest');
      showToast('Missões cumpridas! Continue somando pontos ou encerre a fase.', 'quest');
    }
    this.refreshHint(true);
    this.handleStatus();
  }

  private handleStatus(): void {
    if (!this.session) return;
    if (this.session.status === 'phaseComplete') {
      this.completePhase();
    } else if (this.session.status === 'asleep') {
      this.sfx.asleep();
      this.sfx.speak('asleep');
      this.save.session = null;
      writeSave(this.save);
      showHint(null);
      showModal(
        'asleep',
        'O reino adormeceu',
        'O baralho acabou antes das missões. Nada se perde: tente de novo com o que já desbloqueou.',
      );
    }
  }

  private completePhase(): void {
    if (!this.session) return;
    const phase = getPhase(this.session.phaseId);
    const score = this.session.score;
    const key = String(phase.id);
    const previousStars = this.save.stars[key] ?? 0;
    const unlockedNow = Boolean(phase.unlockTile && !this.save.unlockedTiles.includes(phase.unlockTile));

    if (!this.save.completedPhases.includes(phase.id)) this.save.completedPhases.push(phase.id);
    if (phase.unlockTile && unlockedNow) this.save.unlockedTiles.push(phase.unlockTile!);
    if (!phase.sandbox) {
      this.save.stars[key] = Math.max(previousStars, score.stars);
    }
    this.save.bestScores[key] = Math.max(this.save.bestScores[key] ?? 0, score.total);
    this.save.maxUnlockedPhase = Math.max(this.save.maxUnlockedPhase, Math.min(PHASES.length, phase.id + 1));
    if (phase.id === 1) this.save.options.tutorialDone = true;
    this.save.session = null;
    writeSave(this.save);

    this.sfx.complete();
    if (unlockedNow) window.setTimeout(() => this.sfx.play('unlock'), 500);
    if (score.stars > previousStars) window.setTimeout(() => this.sfx.play('star'), 900);
    this.sfx.speak('complete');
    showHint(null);
    showHoverTip(null, 0, 0);

    const h = this.session.evaluation.harmony;
    const title = phase.sandbox
      ? 'O reino descansou'
      : h.natureza > h.povo
        ? 'Reino bagunçado e feliz'
        : 'Reino harmonioso';
    const unlock = unlockedNow
      ? `Novo tile no baralho: ${phase.unlockNome}`
      : phase.unlockNome
        ? `${phase.unlockNome} já estava no baralho.`
        : 'O álbum ganhou mais páginas.';
    const body = phase.sandbox
      ? `${score.total} pontos com ${this.session.map.size} tiles. Semente ${this.session.seed.toString(36)}.`
      : `${phase.nome} descansou no mapa com ${this.session.map.size} tiles.`;
    showModal('complete', title, body, {
      unlock,
      stars: score.stars,
      score: score.total,
      hasNext: phase.id < PHASES.length,
    });
  }

  private advanceAfterComplete(): void {
    const next = Math.min(PHASES.length, (this.session?.phaseId ?? 1) + 1);
    showModal('none', '', '');
    if (next !== this.session?.phaseId && next <= this.save.maxUnlockedPhase) {
      this.startPhase(next);
      return;
    }
    this.openMap();
  }

  private setPaused(value: boolean): void {
    this.paused = value;
    showPause(value);
    if (value) showHoverTip(null, 0, 0);
  }

  private persistSession(): void {
    if (this.session && this.session.status === 'playing') {
      this.save.session = this.session.serialize();
    }
    writeSave(this.save);
  }

  private discover(ids: Iterable<string>): void {
    for (const id of ids) {
      if (!this.save.discoveredTiles.includes(id)) this.save.discoveredTiles.push(id);
    }
  }

  private refreshHint(withVoice: boolean): void {
    if (!this.session || this.screen !== 'play') {
      showHint(null);
      return;
    }
    const step = tutorialStep(this.session, this.save.options.tutorialDone);
    if (!step || this.hintDismissed.has(step.id)) {
      showHint(null);
      this.lastHintId = null;
      return;
    }
    const changed = step.id !== this.lastHintId;
    this.lastHintId = step.id;
    showHint(step.text);
    if (changed && step.voice && withVoice) this.sfx.speak(step.voice);
  }

  /* ---------------------------------------------------------------- */
  /* Entrada                                                          */
  /* ---------------------------------------------------------------- */

  private bindPointer(): void {
    this.canvas.addEventListener('pointerdown', (event) => {
      if (event.pointerType === 'touch') {
        this.touches.set(event.pointerId, { x: event.clientX, y: event.clientY });
        if (this.touches.size === 2) {
          this.pinchDistance = this.touchDistance();
          this.pinchCenter = this.touchCenter();
          this.pointer.dragged = true;
          showHoverTip(null, 0, 0);
          return;
        }
      }
      if (event.button === 1) event.preventDefault();
      this.pointer = {
        x: event.clientX,
        y: event.clientY,
        down: true,
        dragged: false,
        id: event.pointerId,
        pan: event.button === 1 || event.button === 2,
      };
      try {
        this.canvas.setPointerCapture(event.pointerId);
      } catch {
        // ignore
      }
    });

    this.canvas.addEventListener('pointermove', (event) => {
      if (event.pointerType === 'touch' && this.touches.has(event.pointerId)) {
        this.touches.set(event.pointerId, { x: event.clientX, y: event.clientY });
        if (this.touches.size >= 2) {
          const distance = this.touchDistance();
          const center = this.touchCenter();
          if (this.pinchDistance > 0 && distance > 0) this.view.zoomScale(this.pinchDistance / distance);
          this.view.panBy(center.x - this.pinchCenter.x, center.y - this.pinchCenter.y);
          this.pinchDistance = distance;
          this.pinchCenter = center;
          return;
        }
      }
      if (!this.pointer.down) {
        this.updateGhost(event);
        return;
      }
      const dx = event.clientX - this.pointer.x;
      const dy = event.clientY - this.pointer.y;
      if (Math.hypot(dx, dy) > 6) this.pointer.dragged = true;
      if (this.pointer.dragged) {
        showHoverTip(null, 0, 0);
        if (this.pointer.pan) this.view.panBy(dx, dy);
        else this.view.orbitBy(dx, dy);
        this.pointer.x = event.clientX;
        this.pointer.y = event.clientY;
      }
    });

    const end = (event: PointerEvent) => {
      if (event.pointerType === 'touch') {
        this.touches.delete(event.pointerId);
        if (this.touches.size > 0) {
          this.pointer.down = false;
          this.pointer.dragged = false;
          return;
        }
      }
      if (event.pointerId !== this.pointer.id && this.pointer.id !== -1) return;
      if (this.pointer.down && !this.pointer.dragged && !this.pointer.pan && this.screen === 'play' && !isModalOpen()) {
        const hex = this.pickFromEvent(event);
        if (hex) this.tryPlace(hex);
      }
      this.pointer.down = false;
      this.pointer.dragged = false;
      if (event.pointerType === 'touch') this.view.setGhost(null, false);
    };
    this.canvas.addEventListener('pointerup', end);
    this.canvas.addEventListener('pointercancel', end);
    this.canvas.addEventListener('contextmenu', (event) => event.preventDefault());
    this.canvas.addEventListener('dblclick', (event) => {
      event.preventDefault();
      this.view.resetView();
    });
    this.canvas.addEventListener('pointerleave', () => {
      this.view.setGhost(null, false);
      showHoverTip(null, 0, 0);
    });

    this.canvas.addEventListener(
      'wheel',
      (event) => {
        event.preventDefault();
        this.view.zoomBy(event.deltaY);
      },
      { passive: false },
    );

    window.addEventListener('keyup', (event) => this.keysDown.delete(event.code));
    window.addEventListener('blur', () => this.keysDown.clear());
    window.addEventListener('keydown', (event) => {
      if (this.screen !== 'play') return;
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;
      if (event.code === 'Escape') {
        if (!el('modal').hidden) return;
        this.setPaused(!this.paused);
        return;
      }
      if (this.paused || isModalOpen()) return;
      if (PAN_KEYS[event.code] || event.code === 'KeyQ' || event.code === 'KeyE') {
        this.keysDown.add(event.code);
        event.preventDefault();
        return;
      }
      if (event.repeat) return;
      switch (event.code) {
        case 'Digit1':
          this.selectCard(0);
          break;
        case 'Digit2':
          this.selectCard(1);
          break;
        case 'Digit3':
          this.selectCard(2);
          break;
        case 'Tab':
          event.preventDefault();
          this.cycleCard(event.shiftKey ? -1 : 1);
          break;
        case 'KeyX':
          this.discardCard();
          break;
        case 'KeyZ':
          this.undo();
          break;
        case 'KeyP':
          this.usePack();
          break;
        case 'KeyR':
          this.view.resetView();
          break;
        case 'Equal':
        case 'NumpadAdd':
          this.view.zoomBy(-300);
          break;
        case 'Minus':
        case 'NumpadSubtract':
          this.view.zoomBy(300);
          break;
        default:
          break;
      }
    });
  }

  private touchDistance(): number {
    const [a, b] = [...this.touches.values()];
    if (!a || !b) return 0;
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  private touchCenter(): { x: number; y: number } {
    const [a, b] = [...this.touches.values()];
    if (!a || !b) return { x: 0, y: 0 };
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  }

  private cycleCard(step: number): void {
    if (!this.session || this.session.hand.length === 0) return;
    const current = this.session.selectedHandIndex ?? 0;
    const n = this.session.hand.length;
    this.selectCard((current + step + n) % n);
  }

  /** Teclas seguradas: pan (WASD/setas) e rotação (Q/E), aplicadas por frame. */
  private applyHeldKeys(dt: number): void {
    if (this.keysDown.size === 0 || this.screen !== 'play' || this.paused) return;
    let x = 0;
    let y = 0;
    for (const code of this.keysDown) {
      const axis = PAN_KEYS[code];
      if (axis) {
        x += axis[0];
        y += axis[1];
      }
    }
    this.view.panAxis(Math.sign(x), Math.sign(y), dt);
    if (this.keysDown.has('KeyQ')) this.view.rotateBy(1.6, dt);
    if (this.keysDown.has('KeyE')) this.view.rotateBy(-1.6, dt);
  }

  private updateGhost(event: PointerEvent): void {
    if (this.screen !== 'play' || !this.session || this.paused || isModalOpen()) {
      this.view.setGhost(null, false);
      showHoverTip(null, 0, 0);
      return;
    }
    const hex = this.pickFromEvent(event);
    if (!hex) {
      this.view.setGhost(null, false);
      showHoverTip(null, 0, 0);
      return;
    }
    const valid = canPlace(this.session.map, hex);
    this.view.setGhost(hex, valid);
    const tileId = this.session.selectedTileId;
    if (valid && tileId && event.pointerType !== 'touch') {
      showHoverTip(this.session.preview(hex, tileId), event.clientX, event.clientY, getTile(tileId).nome);
    } else {
      showHoverTip(null, 0, 0);
    }
  }

  private pickFromEvent(event: PointerEvent) {
    const rect = this.canvas.getBoundingClientRect();
    const ndc = new THREE.Vector2(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1,
    );
    return this.view.pickHex(ndc);
  }

  /* ---------------------------------------------------------------- */
  /* Loop                                                             */
  /* ---------------------------------------------------------------- */

  private update(delta: number, elapsed: number): void {
    this.frame += 1;
    this.elapsed = elapsed;
    if (!this.paused) {
      this.applyHeldKeys(delta);
      this.view.update(delta, elapsed, this.screen === 'play');
    }
    resizeRenderer(this.renderer, this.view.camera, 2);
    this.publishDiagnostics();
  }

  private render(): void {
    this.renderer.render(this.view.scene, this.view.camera);
  }

  private publishDiagnostics(): void {
    const info = this.renderer.info;
    const cam = this.view.camera.position;
    window.__THREE_GAME_DIAGNOSTICS__ = {
      frame: this.frame,
      elapsed: this.elapsed,
      score: this.session?.score.total ?? this.view.tiles.size,
      targetScore: this.session?.quests.length ?? 0,
      complete: this.session?.status === 'phaseComplete',
      player: {
        position: { x: cam.x, y: cam.y, z: cam.z },
        speed: 0,
      },
      renderer: {
        calls: info.render.calls,
        triangles: info.render.triangles,
        geometries: info.memory.geometries,
        textures: info.memory.textures,
      },
      canvas: {
        clientWidth: this.canvas.clientWidth,
        clientHeight: this.canvas.clientHeight,
        width: this.canvas.width,
        height: this.canvas.height,
        dpr: Math.min(window.devicePixelRatio || 1, 2),
      },
    };
  }

  /** Gancho para testes e2e: posições de tela dos hexes válidos e estado resumido. */
  private exposeDebug(): void {
    window.__PR_DEBUG__ = {
      validScreenPoints: () => {
        if (!this.session) return [];
        const rect = this.canvas.getBoundingClientRect();
        return validPlacements(this.session.map).map((hex) => {
          const ndc = this.view.projectHex(hex);
          return {
            q: hex.q,
            r: hex.r,
            x: rect.left + ((ndc.x + 1) / 2) * rect.width,
            y: rect.top + ((1 - ndc.y) / 2) * rect.height,
          };
        });
      },
      state: () =>
        this.session
          ? {
              phaseId: this.session.phaseId,
              status: this.session.status,
              hand: [...this.session.hand],
              deck: this.session.deck.length,
              mapSize: this.session.map.size,
              questsDone: this.session.questsDone,
              score: this.session.score.total,
              coins: this.session.coins,
            }
          : null,
      screen: () => this.screen,
    };
  }
}

function el(id: string): HTMLElement {
  const node = document.getElementById(id);
  if (!node) throw new Error(`Missing #${id}`);
  return node;
}
