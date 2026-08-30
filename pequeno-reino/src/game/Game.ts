import * as THREE from 'three';
import { Sfx } from '../audio/sfx';
import { Loop } from '../core/Loop';
import { createRenderer, resizeRenderer } from '../core/Renderer';
import { getPhase } from './catalog';
import { hexKey } from './hex';
import { canPlace } from './placement';
import { KingdomView } from '../render/KingdomView';
import { hasContinue, loadSave, writeSave, type SaveData } from '../save';
import {
  bindUi,
  renderAlbum,
  renderHud,
  renderMap,
  setContinueEnabled,
  setOptions,
  showModal,
  showPause,
  showScreen,
} from '../ui/hud';
import { Session } from './session';

export class Game {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly view: KingdomView;
  private readonly loop: Loop;
  private readonly sfx = new Sfx();
  private save: SaveData;
  private session: Session | null = null;
  private screen: 'title' | 'map' | 'album' | 'play' | 'options' = 'title';
  private paused = false;
  private frame = 0;
  private elapsed = 0;
  private pointer = { x: 0, y: 0, down: false, dragged: false, id: -1 };

  constructor(private readonly canvas: HTMLCanvasElement) {
    this.save = loadSave();
    this.renderer = createRenderer(canvas);
    this.renderer.toneMappingExposure = 1.12;
    this.view = new KingdomView(this.save.options.reduceParticles);
    this.view.loadShowcase();
    this.sfx.music = this.save.options.music;

    this.loop = new Loop(
      (delta, elapsed) => this.update(delta, elapsed),
      () => this.render(),
    );

    this.bindPointer();
    bindUi({
      onPlay: () => this.startPhase(this.save.maxUnlockedPhase || 1, true),
      onContinue: () => this.continueGame(),
      onMap: () => this.openMap(),
      onAlbum: () => this.openAlbum(),
      onOptions: () => this.openOptions(),
      onBackTitle: () => this.goTitle(),
      onSelectPhase: (id) => this.startPhase(id, true),
      onSelectCard: (index) => this.selectCard(index),
      onPack: () => this.usePack(),
      onPause: () => this.setPaused(true),
      onResume: () => this.setPaused(false),
      onQuit: () => {
        this.setPaused(false);
        this.persistSession();
        this.goTitle();
      },
      onRetry: () => {
        if (this.session) this.startPhase(this.session.phaseId, true);
      },
      onNextPhase: () => this.advanceAfterComplete(),
      onCloseModal: () => {
        showModal('none', '', '');
        this.openMap();
      },
      onToggleMusic: (on) => {
        this.save.options.music = on;
        this.sfx.music = on;
        writeSave(this.save);
      },
      onToggleParticles: (on) => {
        this.save.options.reduceParticles = on;
        this.view.setReduceParticles(on);
        writeSave(this.save);
      },
      onEndDay: () => this.endSandboxDay(),
    });

    setContinueEnabled(hasContinue(this.save));
    setOptions(this.save);
    showScreen('title');
    resizeRenderer(this.renderer, this.view.camera, 2);
    this.publishDiagnostics();
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
  }

  private goTitle(): void {
    this.screen = 'title';
    this.session = null;
    this.view.loadShowcase();
    this.view.setSky('#e8d5b7');
    showPause(false);
    showModal('none', '', '');
    showScreen('title');
    setContinueEnabled(hasContinue(this.save));
  }

  private openMap(): void {
    this.screen = 'map';
    this.session = null;
    this.view.loadShowcase();
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

  private continueGame(): void {
    if (this.save.session) {
      this.session = new Session(this.save.session.phaseId, this.save.session.rngState, this.save.session);
      this.enterPlay();
      return;
    }
    this.openMap();
  }

  private startPhase(id: number, fresh: boolean): void {
    if (id > this.save.maxUnlockedPhase) return;
    this.session = fresh ? new Session(id) : new Session(id, Date.now(), this.save.session ?? undefined);
    this.enterPlay();
  }

  private enterPlay(): void {
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
  }

  private selectCard(index: number): void {
    if (!this.session || this.session.status !== 'playing') return;
    this.session.selectHand(index);
    renderHud(this.session);
    this.sfx.click();
  }

  private usePack(): void {
    if (!this.session) return;
    const result = this.session.newPack();
    if (!result.ok) return;
    this.sfx.pack();
    renderHud(this.session);
    this.persistSession();
  }

  private tryPlace(hex: { q: number; r: number }): void {
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
    renderHud(this.session);
    this.persistSession();
    this.handleStatus();
  }

  private handleStatus(): void {
    if (!this.session) return;
    if (this.session.status === 'phaseComplete') {
      this.completePhase();
    } else if (this.session.status === 'asleep') {
      this.sfx.asleep();
      this.save.session = null;
      writeSave(this.save);
      showModal(
        'asleep',
        'O reino adormeceu',
        'O baralho acabou antes das missões. Nada se perde: tente de novo com o que já desbloqueou.',
      );
    }
  }

  private endSandboxDay(): void {
    if (!this.session || this.session.status !== 'playing') return;
    this.session.status = 'phaseComplete';
    this.completePhase();
  }

  private completePhase(): void {
    if (!this.session) return;
    const phase = getPhase(this.session.phaseId);
    if (!this.save.completedPhases.includes(phase.id)) this.save.completedPhases.push(phase.id);
    if (phase.unlockTile && !this.save.unlockedTiles.includes(phase.unlockTile)) {
      this.save.unlockedTiles.push(phase.unlockTile);
    }
    this.save.maxUnlockedPhase = Math.max(this.save.maxUnlockedPhase, Math.min(5, phase.id + 1));
    this.save.session = null;
    writeSave(this.save);
    this.sfx.complete();
    const messy = this.session.evaluation.harmony.natureza > this.session.evaluation.harmony.povo;
    const title = messy ? 'Reino bagunçado e feliz' : 'Reino harmonioso';
    const unlock = phase.unlockNome ? `Novo tile: ${phase.unlockNome}` : 'O álbum ganhou mais páginas.';
    showModal('complete', title, `${phase.nome} descansou no mapa.`, unlock);
  }

  private advanceAfterComplete(): void {
    const next = Math.min(5, (this.session?.phaseId ?? 1) + 1);
    showModal('none', '', '');
    if (next !== this.session?.phaseId && next <= this.save.maxUnlockedPhase) {
      this.startPhase(next, true);
      return;
    }
    this.openMap();
  }

  private setPaused(value: boolean): void {
    this.paused = value;
    showPause(value);
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

  private bindPointer(): void {
    this.canvas.addEventListener('pointerdown', (event) => {
      this.pointer = { x: event.clientX, y: event.clientY, down: true, dragged: false, id: event.pointerId };
      try {
        this.canvas.setPointerCapture(event.pointerId);
      } catch {
        // ignore
      }
    });
    this.canvas.addEventListener('pointermove', (event) => {
      if (!this.pointer.down) {
        this.updateGhost(event);
        return;
      }
      const dx = event.clientX - this.pointer.x;
      const dy = event.clientY - this.pointer.y;
      if (Math.hypot(dx, dy) > 6) this.pointer.dragged = true;
      if (this.pointer.dragged) {
        this.view.orbitBy(dx, dy);
        this.pointer.x = event.clientX;
        this.pointer.y = event.clientY;
      }
    });
    const end = (event: PointerEvent) => {
      if (event.pointerId !== this.pointer.id && this.pointer.id !== -1) return;
      if (this.pointer.down && !this.pointer.dragged && this.screen === 'play') {
        const hex = this.pickFromEvent(event);
        if (hex) this.tryPlace(hex);
      }
      this.pointer.down = false;
      this.pointer.dragged = false;
    };
    this.canvas.addEventListener('pointerup', end);
    this.canvas.addEventListener('pointercancel', end);
    this.canvas.addEventListener(
      'wheel',
      (event) => {
        event.preventDefault();
        this.view.zoomBy(event.deltaY);
      },
      { passive: false },
    );
    window.addEventListener('keydown', (event) => {
      if (event.code === 'Digit1') this.selectCard(0);
      if (event.code === 'Digit2') this.selectCard(1);
      if (event.code === 'Digit3') this.selectCard(2);
      if (event.code === 'Escape' && this.screen === 'play') this.setPaused(!this.paused);
    });
  }

  private updateGhost(event: PointerEvent): void {
    if (this.screen !== 'play' || !this.session) {
      this.view.setGhost(null, false);
      return;
    }
    const hex = this.pickFromEvent(event);
    if (!hex) {
      this.view.setGhost(null, false);
      return;
    }
    this.view.setGhost(hex, canPlace(this.session.map, hex));
  }

  private pickFromEvent(event: PointerEvent) {
    const rect = this.canvas.getBoundingClientRect();
    const ndc = new THREE.Vector2(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1,
    );
    return this.view.pickHex(ndc);
  }

  private update(delta: number, elapsed: number): void {
    this.frame += 1;
    this.elapsed = elapsed;
    if (!this.paused) {
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
      score: this.session?.map.size ?? this.view.tiles.size,
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
}
