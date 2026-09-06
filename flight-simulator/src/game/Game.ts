import * as THREE from 'three';
import { Loop } from '../core/Loop';
import { createRenderer, resizeRenderer } from '../core/Renderer';
import { CATALOG, findCatalogFlight } from '../flight/catalog';
import { pollIcao24, searchLiveCallsign, type OpenSkyState } from '../flight/opensky';
import { catalogToActive, poseFromSample, sampleReplay } from '../flight/replay';
import type { ActiveFlight, CatalogFlight, FlightSample } from '../flight/types';
import { latLonAltToVector } from '../geo/ecef';
import { sunDirection, sunPosition } from '../geo/sun';
import type { AircraftKind } from '../flight/FlightModel';
import { AIRCRAFT_SPECS } from '../flight/FlightModel';
import { MISSIONS } from '../missions/missions';
import type { MissionEvent } from '../missions/types';
import { createA320Model } from '../models/createA320Model';
import { createA350Model, setGear, updateAircraftEffects, type AircraftRuntime } from '../models/createA350Model';
import { FlightCamera, type CameraMode } from '../systems/FlightCamera';
import { Hud } from '../systems/Hud';
import { PilotHud, type GameMode } from '../systems/PilotHud';
import { PilotMode } from './PilotMode';
import { createAtmosphere } from '../world/atmosphere';
import { createCloudLayer } from '../world/clouds';
import { Contrail } from '../world/contrail';
import { createEarth, setEarthSun, tryLoadBlueMarble } from '../world/earth';
import { createGlobeAircraftIcon, placeGlobeAircraftIcon } from '../world/globeIcon';
import { FlightRoute } from '../world/route';
import { createStarfield } from '../world/stars';

function makeGlobeTag(className: string): HTMLDivElement {
  const tag = document.createElement('div');
  tag.className = className;
  tag.hidden = true;
  document.querySelector('#app')?.append(tag);
  return tag;
}

function stateToSample(state: OpenSkyState): FlightSample {
  return {
    lat: state.lat,
    lon: state.lon,
    altM: state.geoAltM ?? state.baroAltM ?? 10_000,
    heading: state.heading ?? 0,
    speedMps: state.velocityMps ?? 230,
    verticalRateMps: state.verticalRateMps ?? 0,
    onGround: state.onGround,
    timestamp: state.timestamp,
  };
}

export class Game {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(52, 1, 2, 45_000_000);
  private readonly loop: Loop;
  private readonly hud: Hud;
  private readonly flightCamera: FlightCamera;
  private readonly models: Record<AircraftKind, AircraftRuntime>;
  private aircraft: AircraftRuntime;
  private readonly pilot: PilotMode;
  private readonly pilotHud: PilotHud;
  private mode: GameMode = 'watch';
  private readonly earth: THREE.Mesh;
  private readonly clouds: THREE.Mesh;
  private readonly sun: THREE.DirectionalLight;
  private readonly sunTarget = new THREE.Object3D();
  private readonly ambient: THREE.AmbientLight;
  private readonly hemi: THREE.HemisphereLight;
  private readonly contrail = new Contrail();
  private readonly route = new FlightRoute();
  private readonly globeIcon = createGlobeAircraftIcon();
  private readonly globeTag: HTMLDivElement;
  private readonly originTag: HTMLDivElement;
  private readonly destTag: HTMLDivElement;
  private readonly sunDir = new THREE.Vector3();
  private readonly tagPos = new THREE.Vector3();
  private readonly posePos = new THREE.Vector3();
  private readonly poseQuat = new THREE.Quaternion();
  private readonly sunPos = new THREE.Vector3();

  private flight: ActiveFlight;
  private catalog: CatalogFlight | null;
  private sample: FlightSample;
  private replayT = 0.38;
  private replaySpeed = 32;
  private paused = false;
  private liveIcao: string | null = null;
  private liveTimer = 0;
  private frame = 0;
  private elapsed = 0;
  private trailAcc = 0;

  constructor(private readonly canvas: HTMLCanvasElement) {
    this.renderer = createRenderer(canvas);
    this.flightCamera = new FlightCamera(this.camera, canvas);
    this.models = { a350: createA350Model(), a320: createA320Model() };
    this.aircraft = this.models.a350;
    this.pilot = new PilotMode(canvas, MISSIONS);
    this.earth = createEarth();
    this.clouds = createCloudLayer();
    this.sun = new THREE.DirectionalLight('#fff6d6', 3.1);
    this.ambient = new THREE.AmbientLight('#243044', 0.55);
    this.hemi = new THREE.HemisphereLight('#9ecbff', '#1a140c', 0.7);

    this.globeTag = makeGlobeTag('globe-tag');
    this.originTag = makeGlobeTag('globe-airport');
    this.destTag = makeGlobeTag('globe-airport');
    this.catalog = CATALOG[0];
    this.flight = catalogToActive(CATALOG[0]);
    this.sample = sampleReplay(CATALOG[0], this.replayT);

    this.hud = new Hud(
      (query) => void this.search(query),
      (mode) => this.setCamera(mode),
      (speed) => this.setSpeed(speed),
      () => this.togglePause(),
      (id) => this.loadCatalogId(id),
    );

    this.pilotHud = new PilotHud(MISSIONS, {
      onMode: (mode) => this.setMode(mode),
      onAircraft: (kind) => this.setAircraft(kind),
      onMission: (index) => this.startMission(index),
      onFreeFlight: () => this.startFreeFlight(),
      onRetry: () => this.startMission(this.pilot.missionIndex),
      onNext: () => this.startMission(this.pilot.missionIndex + 1),
      onMenu: () => this.openCampaign(),
    });
    this.setAircraft(this.pilot.aircraft, false);

    this.loop = new Loop(
      (delta, elapsed) => this.update(delta, elapsed),
      () => this.render(),
    );

    this.createScene();
    this.applySample(this.sample, true);
    this.hud.setQuery('BAW246');
    this.hud.setCamera('chase');
    this.hud.setSpeed(this.replaySpeed);
    this.hud.setStatus('Replay BA246 GRU → LHR · A350-1000');
    this.hud.update(this.flight, this.sample, this.replayT);
    this.bindKeys();
    resizeRenderer(this.renderer, this.camera, 2);
    this.flightCamera.snap(this.aircraft.root);
    tryLoadBlueMarble(this.earth);
  }

  start(): void {
    this.loop.start();
  }

  dispose(): void {
    this.loop.stop();
    this.flightCamera.dispose();
    this.pilot.dispose();
    window.removeEventListener('keydown', this.onKey);
    this.renderer.dispose();
    window.__THREE_GAME_DIAGNOSTICS__ = undefined;
  }

  private createScene(): void {
    this.scene.background = new THREE.Color('#02040a');
    this.scene.add(this.earth, this.clouds, createAtmosphere(), createStarfield());
    this.scene.add(this.models.a350.root, this.models.a320.root, this.contrail.line, this.pilot.rings.group);
    this.sunTarget.position.set(0, 0, 0);
    this.scene.add(this.sunTarget);
    this.sun.target = this.sunTarget;
    this.scene.add(this.sun, this.ambient, this.hemi);
    for (const model of Object.values(this.models)) {
      const key = new THREE.DirectionalLight('#fff7ea', 2.6);
      key.position.set(-35, 55, 40);
      key.target.position.set(0, 0, 0);
      model.root.add(key, key.target);
      const rim = new THREE.DirectionalLight('#8cb7ff', 1.1);
      rim.position.set(40, 12, -50);
      rim.target.position.set(0, 0, 0);
      model.root.add(rim, rim.target);
    }
    this.globeIcon.visible = false;
    this.route.group.visible = false;
    this.scene.add(this.globeIcon, this.route.group);
    this.replaceRoute(CATALOG[0]);
  }

  private replaceRoute(flight: CatalogFlight | ActiveFlight | null): void {
    if (flight?.origin && flight.destination) {
      this.route.set(flight.origin, flight.destination);
      this.originTag.textContent = flight.origin.iata;
      this.destTag.textContent = flight.destination.iata;
    }
  }

  private async search(query: string): Promise<void> {
    const catalog = findCatalogFlight(query);
    this.hud.setStatus(`Procurando ${query.toUpperCase()}…`);
    try {
      const live = await searchLiveCallsign(query);
      if (live) {
        this.liveIcao = live.icao24;
        this.catalog = catalog ?? null;
        this.flight = {
          callsign: live.callsign || query.toUpperCase(),
          flightNumber: catalog?.flightNumber ?? live.callsign,
          airline: catalog?.airline ?? live.originCountry,
          aircraft: catalog?.aircraft ?? 'Aeronave em voo',
          origin: catalog?.origin ?? null,
          destination: catalog?.destination ?? null,
          source: 'live',
          icao24: live.icao24,
          durationSec: catalog?.durationSec ?? 0,
          cruiseAltM: live.geoAltM ?? live.baroAltM ?? 10_000,
        };
        this.sample = stateToSample(live);
        this.replaceRoute(this.flight);
        this.contrail.reset();
        this.applySample(this.sample, true);
        this.hud.setStatus(`${this.flight.callsign} ao vivo via OpenSky`, 'live');
        this.hud.update(this.flight, this.sample, 0);
        return;
      }
    } catch {
      this.hud.setStatus('OpenSky indisponível — usando replay local', 'warn');
    }

    if (catalog) {
      this.loadCatalog(catalog);
      return;
    }
    this.hud.setStatus(`Voo ${query.toUpperCase()} não encontrado. Tente BAW246.`, 'warn');
  }

  private loadCatalogId(id: string): void {
    const flight = CATALOG.find((item) => item.id === id);
    if (flight) this.loadCatalog(flight);
  }

  private loadCatalog(flight: CatalogFlight, t = 0.38): void {
    this.liveIcao = null;
    this.catalog = flight;
    this.flight = catalogToActive(flight);
    this.replayT = t;
    this.sample = sampleReplay(flight, t);
    this.replaceRoute(flight);
    this.contrail.reset();
    this.applySample(this.sample, true);
    this.hud.setQuery(flight.callsign);
    this.hud.setStatus(`Replay ${flight.flightNumber} ${flight.origin.iata} → ${flight.destination.iata}`);
    this.hud.update(this.flight, this.sample, this.replayT);
  }

  // ── Modo piloto ────────────────────────────────────────────────────

  private setMode(mode: GameMode): void {
    if (mode === this.mode) {
      if (mode === 'pilot' && !this.pilotHud.campaignOpen) this.openCampaign();
      return;
    }
    this.mode = mode;
    this.pilotHud.setMode(mode);
    if (mode === 'pilot') {
      this.pilot.enter();
      this.paused = false;
      this.hud.setPaused(false);
      this.openCampaign();
      return;
    }
    this.pilot.exit();
    this.setAircraft('a350', false);
    this.contrail.reset();
    if (this.catalog) this.loadCatalog(this.catalog, this.replayT);
    else this.applySample(this.sample, true);
  }

  private setAircraft(kind: AircraftKind, persist = true): void {
    const next = this.models[kind];
    if (persist) this.pilot.setAircraft(kind);
    this.pilotHud.setAircraft(kind);
    if (next === this.aircraft) return;
    next.root.position.copy(this.aircraft.root.position);
    next.root.quaternion.copy(this.aircraft.root.quaternion);
    this.aircraft.root.visible = false;
    this.aircraft = next;
    this.aircraft.root.visible = this.flightCamera.mode !== 'globe';
    this.flightCamera.snap(this.aircraft.root);
  }

  private openCampaign(): void {
    this.pilotHud.hideFlightHud();
    this.pilotHud.showCampaign(this.pilot.progress);
  }

  private startMission(index: number): void {
    if (index < 0 || index >= MISSIONS.length) {
      this.openCampaign();
      return;
    }
    this.setAircraft(this.pilot.aircraft, false);
    this.pilot.startMission(index);
    this.beginPilotFlight();
    const mission = MISSIONS[index];
    this.flight = {
      callsign: `SKY${index + 1}`,
      flightNumber: mission.title,
      airline: 'Skywatch',
      aircraft: AIRCRAFT_SPECS[this.pilot.aircraft].name,
      origin: mission.legs[0]?.origin ?? null,
      destination: mission.legs[0]?.destination ?? null,
      source: 'replay',
      durationSec: 0,
      cruiseAltM: this.pilot.state.altM,
    };
    this.replaceRoute(this.flight);
    this.hud.setStatus(`Fase ${index + 1}: ${mission.title} — ${mission.objective}`);
  }

  private startFreeFlight(): void {
    this.setAircraft(this.pilot.aircraft, false);
    const start = sampleReplay(CATALOG[0], 0.3);
    this.pilot.startFreeFlight({ lat: start.lat, lon: start.lon, altM: start.altM, headingDeg: start.heading });
    this.beginPilotFlight();
    this.flight = { ...catalogToActive(CATALOG[0]), callsign: 'SKYFREE', airline: 'Skywatch', aircraft: AIRCRAFT_SPECS[this.pilot.aircraft].name };
    this.hud.setStatus('Voo livre sobre o Atlântico Sul.');
  }

  private beginPilotFlight(): void {
    this.pilotHud.hideCampaign();
    this.pilotHud.hideDebrief();
    this.pilotHud.showFlightHud();
    this.paused = false;
    this.hud.setPaused(false);
    this.contrail.reset();
    this.pilot.pose(this.aircraft.root.position, this.aircraft.root.quaternion);
    this.pilot.sample(this.sample);
    this.syncGlobeFrame();
    if (this.flightCamera.mode === 'globe') this.setCamera('chase');
    this.flightCamera.snap(this.aircraft.root);
  }

  private handleMissionEvents(events: MissionEvent[]): void {
    for (const event of events) {
      switch (event.type) {
        case 'ring-pass':
          this.pilot.audio.ringPass(event.index, event.precision01);
          this.pilotHud.flash(`Anel ${event.index + 1} · +${event.points}`, 'good');
          break;
        case 'ring-miss': {
          this.pilot.audio.ringMiss();
          const why = event.reason === 'heading' ? 'proa errada' : event.reason === 'speed' ? 'rápido demais' : 'fora do anel';
          this.pilotHud.flash(`Anel ${event.index + 1} perdido · ${why}`, 'bad');
          break;
        }
        case 'storm-enter':
          this.pilot.audio.turbulenceHit();
          this.pilotHud.flash('Turbulência!', 'bad');
          break;
        case 'leg-change': {
          const leg = this.pilot.mission?.legs[event.leg];
          if (leg) {
            this.pilotHud.flash(leg.label, 'info');
            this.flight = { ...this.flight, origin: leg.origin, destination: leg.destination };
            this.replaceRoute(this.flight);
            this.contrail.reset();
            this.pilot.pose(this.aircraft.root.position, this.aircraft.root.quaternion);
            this.flightCamera.snap(this.aircraft.root);
          }
          break;
        }
        case 'complete': {
          this.pilot.audio.missionEnd(event.result.success);
          const mission = this.pilot.mission;
          if (mission) this.pilotHud.showDebrief(mission, event.result, this.pilot.hasNextMission);
          break;
        }
      }
    }
  }

  private updatePilot(delta: number): void {
    const { events, gust } = this.pilot.update(delta, this.paused || this.pilotHud.campaignOpen);
    if (events.length) this.handleMissionEvents(events);
    this.pilot.pose(this.aircraft.root.position, this.aircraft.root.quaternion);
    this.aircraft.root.scale.setScalar(1);
    this.pilot.sample(this.sample);
    setGear(this.aircraft, this.pilot.gearDown ? 1 : 0, delta);
    this.pilot.rings.update(this.pilot.runner?.status ?? [], this.elapsed);
    this.pilotHud.update(this.pilot.hudFrame());
    if (gust > 0.05) {
      this.camera.position.x += (Math.random() - 0.5) * gust * 1.6;
      this.camera.position.y += (Math.random() - 0.5) * gust * 1.6;
    }
  }

  private setCamera(mode: CameraMode): void {
    this.syncGlobeFrame();
    this.flightCamera.setMode(mode);
    this.hud.setCamera(mode);
    const globe = mode === 'globe';
    this.aircraft.root.visible = !globe;
    this.globeIcon.visible = globe;
    this.route.group.visible = globe;
    this.contrail.line.visible = !globe;
    this.clouds.visible = !globe;
    this.globeTag.hidden = !globe;
    this.originTag.hidden = !globe;
    this.destTag.hidden = !globe;
    this.flightCamera.snap(this.aircraft.root);
  }

  private setSpeed(multiplier: number): void {
    this.replaySpeed = multiplier;
    this.hud.setSpeed(multiplier);
  }

  private togglePause(): void {
    this.paused = !this.paused;
    this.hud.setPaused(this.paused);
  }

  private bindKeys(): void {
    window.addEventListener('keydown', this.onKey);
  }

  private readonly onKey = (event: KeyboardEvent) => {
    if (event.target instanceof HTMLInputElement) return;
    const cameras: CameraMode[] = ['chase', 'orbit', 'cockpit', 'wing', 'globe'];
    if (event.code.startsWith('Digit')) {
      const index = Number(event.key) - 1;
      if (cameras[index]) this.setCamera(cameras[index]);
    }
    if (event.code === 'Space') {
      event.preventDefault();
      this.togglePause();
    }
    if (this.mode === 'pilot') {
      if (event.code === 'Escape') {
        if (this.pilotHud.campaignOpen && this.pilot.runner) this.pilotHud.hideCampaign();
        else this.openCampaign();
      }
      if (event.code === 'KeyR' && this.pilot.missionIndex >= 0) this.startMission(this.pilot.missionIndex);
      return;
    }
    if (event.code === 'KeyR') this.loadCatalog(this.catalog ?? CATALOG[0], 0);
  };

  private applySample(sample: FlightSample, snap: boolean): void {
    poseFromSample(sample, undefined, this.posePos, this.poseQuat);
    this.aircraft.root.position.copy(this.posePos);
    this.aircraft.root.quaternion.copy(this.poseQuat).normalize();
    this.aircraft.root.scale.setScalar(1);
    if (snap) this.flightCamera.snap(this.aircraft.root);
  }

  private update(delta: number, elapsed: number): void {
    this.frame += 1;
    this.elapsed = elapsed;
    resizeRenderer(this.renderer, this.camera, 2);

    const piloting = this.mode === 'pilot';
    if (!piloting && !this.paused && this.flight.source === 'replay' && this.catalog) {
      this.replayT += (delta * this.replaySpeed) / this.catalog.durationSec;
      if (this.replayT > 1) this.replayT = 0;
      this.sample = sampleReplay(this.catalog, this.replayT);
    }

    if (!piloting && this.flight.source === 'live' && this.liveIcao) {
      this.liveTimer += delta;
      if (this.liveTimer > 10) {
        this.liveTimer = 0;
        void this.refreshLive();
      }
    }

    if (piloting) this.updatePilot(delta);
    else this.applySample(this.sample, false);
    sunDirection(new Date(), this.sunDir);
    sunPosition(new Date(), this.sunPos);
    this.sun.position.copy(this.sunPos);
    setEarthSun(this.earth, this.sunDir);
    updateAircraftEffects(this.aircraft, elapsed, this.sample.speedMps);
    this.syncGlobeFrame();
    placeGlobeAircraftIcon(this.globeIcon, this.sample.lat, this.sample.lon, this.sample.heading);
    this.route.setProgress(piloting ? 0.5 : this.flight.source === 'replay' ? this.replayT : 0.5);

    this.trailAcc += delta;
    if (this.trailAcc > 0.08) {
      this.trailAcc = 0;
      this.contrail.push(this.aircraft.root.position);
    }

    this.flightCamera.update(this.aircraft.root);
    this.projectGlobeTags();
    if (piloting) this.projectRingMarker();
    this.hud.update(this.flight, this.sample, this.flight.source === 'replay' ? this.replayT : 0.5);
    this.publishDiagnostics();
  }

  private syncGlobeFrame(): void {
    this.flightCamera.globe = {
      lat: this.sample.lat,
      lon: this.sample.lon,
      origin: this.flight.origin,
      destination: this.flight.destination,
    };
  }

  private projectGlobeTags(): void {
    const globe = this.flightCamera.mode === 'globe';
    this.globeTag.hidden = !globe;
    this.originTag.hidden = !globe || !this.flight.origin;
    this.destTag.hidden = !globe || !this.flight.destination;
    if (!globe) return;

    const feet = Math.round(this.sample.altM / 0.3048);
    const knots = Math.round(this.sample.speedMps * 1.94384);
    this.globeTag.innerHTML = `<strong>${this.flight.callsign}</strong><span>${feet.toLocaleString('pt-BR')} ft · ${knots} kt</span>`;
    this.placeTag(this.globeTag, this.sample.lat, this.sample.lon, 180_000);
    if (this.flight.origin) this.placeTag(this.originTag, this.flight.origin.lat, this.flight.origin.lon, 80_000);
    if (this.flight.destination) this.placeTag(this.destTag, this.flight.destination.lat, this.flight.destination.lon, 80_000);
  }

  private projectRingMarker(): void {
    const screen = this.pilotHud.campaignOpen || this.flightCamera.mode === 'globe' ? null : this.pilot.nextRingScreen(this.camera);
    if (!screen) {
      this.pilotHud.placeMarker(0, 0, true, '', 0, 0);
      return;
    }
    const runner = this.pilot.runner;
    const label = runner ? `${runner.nextIndex + 1}/${runner.total}` : '';
    this.pilotHud.placeMarker(screen.x, screen.y, screen.behind, label, this.canvas.clientWidth, this.canvas.clientHeight);
  }

  private placeTag(tag: HTMLDivElement, lat: number, lon: number, altM: number): void {
    latLonAltToVector(lat, lon, altM, this.tagPos);
    this.tagPos.project(this.camera);
    const visible = this.tagPos.z < 1;
    tag.style.opacity = visible ? '1' : '0';
    const x = (this.tagPos.x * 0.5 + 0.5) * this.canvas.clientWidth;
    const y = (-this.tagPos.y * 0.5 + 0.5) * this.canvas.clientHeight;
    tag.style.transform = `translate(${x}px, ${y}px) translate(-10px, -118%)`;
  }

  private async refreshLive(): Promise<void> {
    if (!this.liveIcao) return;
    try {
      const state = await pollIcao24(this.liveIcao);
      if (state) this.sample = stateToSample(state);
    } catch {
      this.hud.setStatus('Falha ao atualizar ADS-B', 'warn');
    }
  }

  private render(): void {
    this.renderer.render(this.scene, this.camera);
  }

  private publishDiagnostics(): void {
    const info = this.renderer.info;
    this.aircraft.root.updateWorldMatrix(true, false);
    const e = this.aircraft.root.matrixWorld.elements;
    window.__THREE_GAME_DIAGNOSTICS__ = {
      frame: this.frame,
      elapsed: this.elapsed,
      score: this.mode === 'pilot' ? (this.pilot.runner?.score ?? 0) : Math.round(this.replayT * 1000),
      targetScore: 1000,
      complete: this.pilot.runner?.done ?? false,
      mode: this.mode,
      mission: this.pilot.mission?.id ?? null,
      rings: this.pilot.runner ? { passed: this.pilot.runner.passed, next: this.pilot.runner.nextIndex, total: this.pilot.runner.total } : null,
      flightState: this.mode === 'pilot' ? { ...this.pilot.state } : null,
      player: {
        position: {
          x: this.aircraft.root.position.x,
          y: this.aircraft.root.position.y,
          z: this.aircraft.root.position.z,
        },
        speed: this.sample.speedMps,
        camDist: this.camera.position.distanceTo(this.aircraft.root.position),
        quatLen: this.aircraft.root.quaternion.length(),
        scale: this.aircraft.root.scale.x,
        axisX: Math.hypot(e[0], e[1], e[2]),
        axisY: Math.hypot(e[4], e[5], e[6]),
        axisZ: Math.hypot(e[8], e[9], e[10]),
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
