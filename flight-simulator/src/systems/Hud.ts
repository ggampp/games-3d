import type { CameraMode } from './FlightCamera';
import type { ActiveFlight, FlightSample } from '../flight/types';
import { CATALOG } from '../flight/catalog';

function fl(altM: number): string {
  return `FL${Math.round(altM / 0.3048 / 100)
    .toString()
    .padStart(3, '0')}`;
}

function knots(mps: number): string {
  return `${Math.round(mps * 1.94384)} kt`;
}

function feet(altM: number): string {
  return `${Math.round(altM / 0.3048).toLocaleString('pt-BR')} ft`;
}

export class Hud {
  private readonly form = this.el<HTMLFormElement>('#flight-search');
  private readonly input = this.el<HTMLInputElement>('#flight-query');
  private readonly status = this.el('#status-line');
  private readonly callsign = this.el('#strip-callsign');
  private readonly airline = this.el('#strip-airline');
  private readonly route = this.el('#strip-route');
  private readonly aircraft = this.el('#strip-aircraft');
  private readonly source = this.el('#strip-source');
  private readonly alt = this.el('#read-alt');
  private readonly spd = this.el('#read-spd');
  private readonly hdg = this.el('#read-hdg');
  private readonly vs = this.el('#read-vs');
  private readonly pos = this.el('#read-pos');
  private readonly progress = this.el<HTMLProgressElement>('#replay-progress');
  private readonly pauseBtn = this.el<HTMLButtonElement>('#pause-btn');

  constructor(
    private readonly onSearch: (query: string) => void,
    private readonly onCamera: (mode: CameraMode) => void,
    private readonly onSpeed: (multiplier: number) => void,
    private readonly onPause: () => void,
    private readonly onSelect: (id: string) => void,
  ) {
    this.form.addEventListener('submit', (event) => {
      event.preventDefault();
      this.onSearch(this.input.value);
    });
    this.pauseBtn.addEventListener('click', () => this.onPause());
    document.querySelectorAll<HTMLButtonElement>('[data-camera]').forEach((button) => {
      button.addEventListener('click', () => this.onCamera(button.dataset.camera as CameraMode));
    });
    document.querySelectorAll<HTMLButtonElement>('[data-speed]').forEach((button) => {
      button.addEventListener('click', () => this.onSpeed(Number(button.dataset.speed)));
    });
    const featured = this.el('#featured-flights');
    featured.innerHTML = CATALOG.map(
      (flight) =>
        `<button type="button" class="chip" data-flight="${flight.id}"><span>${flight.flightNumber}</span>${flight.origin.iata}→${flight.destination.iata}</button>`,
    ).join('');
    featured.querySelectorAll<HTMLButtonElement>('[data-flight]').forEach((button) => {
      button.addEventListener('click', () => {
        const id = button.dataset.flight;
        if (id) this.onSelect(id);
      });
    });
  }

  setQuery(value: string): void {
    this.input.value = value;
  }

  setStatus(text: string, kind: 'ok' | 'warn' | 'live' = 'ok'): void {
    this.status.textContent = text;
    this.status.dataset.kind = kind;
  }

  setPaused(paused: boolean): void {
    this.pauseBtn.textContent = paused ? 'Continuar' : 'Pausar';
  }

  setCamera(mode: CameraMode): void {
    document.querySelectorAll<HTMLButtonElement>('[data-camera]').forEach((button) => {
      button.classList.toggle('is-active', button.dataset.camera === mode);
    });
  }

  setSpeed(multiplier: number): void {
    document.querySelectorAll<HTMLButtonElement>('[data-speed]').forEach((button) => {
      button.classList.toggle('is-active', Number(button.dataset.speed) === multiplier);
    });
  }

  update(flight: ActiveFlight, sample: FlightSample, progress01: number): void {
    this.callsign.textContent = flight.callsign;
    this.airline.textContent = flight.airline;
    this.aircraft.textContent = flight.aircraft;
    this.source.textContent = flight.source === 'live' ? 'AO VIVO' : 'REPLAY';
    this.source.dataset.kind = flight.source === 'live' ? 'live' : 'ok';
    const origin = flight.origin?.iata ?? '—';
    const dest = flight.destination?.iata ?? '—';
    this.route.textContent = `${origin}  →  ${dest}`;
    this.alt.textContent = `${feet(sample.altM)}  ${fl(sample.altM)}`;
    this.spd.textContent = knots(sample.speedMps);
    this.hdg.textContent = `${Math.round(sample.heading).toString().padStart(3, '0')}°`;
    const vsFpm = Math.round(sample.verticalRateMps * 196.85);
    this.vs.textContent = `${vsFpm > 0 ? '+' : ''}${vsFpm} fpm`;
    this.pos.textContent = `${sample.lat.toFixed(3)}°  ${sample.lon.toFixed(3)}°`;
    this.progress.value = progress01;
  }

  private el<T extends HTMLElement = HTMLElement>(selector: string): T {
    const node = document.querySelector<T>(selector);
    if (!node) throw new Error(`Missing HUD node ${selector}`);
    return node;
  }
}
