import type { AircraftKind } from '../flight/FlightModel';
import { AIRCRAFT_SPECS } from '../flight/FlightModel';
import type { CampaignProgress } from '../missions/progress';
import { isUnlocked, totalStars } from '../missions/progress';
import type { MissionResult, MissionSpec } from '../missions/types';

export type GameMode = 'watch' | 'pilot';

export type PilotHudCallbacks = {
  onMode: (mode: GameMode) => void;
  onAircraft: (kind: AircraftKind) => void;
  onMission: (index: number) => void;
  onFreeFlight: () => void;
  onRetry: () => void;
  onNext: () => void;
  onMenu: () => void;
};

export type PilotHudFrame = {
  missionTitle: string;
  objective: string;
  ringsPassed: number;
  ringsTotal: number;
  timeSec: number;
  score: number;
  /** distância ao próximo anel (m); null sem anel */
  nextDistM: number | null;
  /** proa relativa ao próximo anel (−180…180) */
  nextRelBearingDeg: number;
  nextAltDeltaM: number;
  throttle01: number;
  pitchDeg: number;
  rollDeg: number;
  gearDown: boolean;
  inStorm: boolean;
};

function stars(count: number): string {
  let out = '';
  for (let i = 0; i < 3; i += 1) out += i < count ? '★' : '<span class="off">★</span>';
  return out;
}

export function formatClock(sec: number): string {
  const whole = Math.max(0, Math.floor(sec));
  const m = Math.floor(whole / 60);
  const s = whole % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function formatDistance(m: number): string {
  if (m >= 10_000) return `${(m / 1000).toFixed(0)} km`;
  if (m >= 1000) return `${(m / 1000).toFixed(1)} km`;
  return `${Math.round(m)} m`;
}

/** Painéis do modo piloto: campanha, HUD de voo, marcador do anel e debrief. */
export class PilotHud {
  private readonly app = this.el('#app');
  private readonly panel = this.el('#mission-panel');
  private readonly summary = this.el('#campaign-summary');
  private readonly list = this.el('#mission-list');
  private readonly hud = this.el('#pilot-hud');
  private readonly mission = this.el('#hud-mission');
  private readonly objective = this.el('#hud-objective');
  private readonly rings = this.el('#hud-rings');
  private readonly time = this.el('#hud-time');
  private readonly score = this.el('#hud-score');
  private readonly next = this.el('#hud-next');
  private readonly nextArrow = this.el('#hud-next-arrow');
  private readonly nextDist = this.el('#hud-next-dist');
  private readonly nextAlt = this.el('#hud-next-alt');
  private readonly throttleFill = this.el('#hud-throttle-fill');
  private readonly throttleText = this.el('#hud-throttle');
  private readonly pitch = this.el('#hud-pitch');
  private readonly bank = this.el('#hud-bank');
  private readonly gear = this.el('#hud-gear');
  private readonly toast = this.el('#hud-toast');
  private readonly marker = this.el('#ring-marker');
  private readonly markerLabel = this.el('#ring-marker span');
  private readonly debrief = this.el('#debrief');
  private readonly debriefTitle = this.el('#debrief-title');
  private readonly debriefStars = this.el('#debrief-stars');
  private readonly debriefRings = this.el('#debrief-rings');
  private readonly debriefTime = this.el('#debrief-time');
  private readonly debriefScore = this.el('#debrief-score');
  private readonly debriefNote = this.el('#debrief-note');
  private readonly debriefNext = this.el<HTMLButtonElement>('#debrief-next');
  private toastTimer = 0;

  constructor(
    private readonly missions: readonly MissionSpec[],
    private readonly callbacks: PilotHudCallbacks,
  ) {
    document.querySelectorAll<HTMLButtonElement>('[data-mode]').forEach((button) => {
      button.addEventListener('click', () => this.callbacks.onMode(button.dataset.mode as GameMode));
    });
    document.querySelectorAll<HTMLButtonElement>('[data-aircraft]').forEach((button) => {
      button.addEventListener('click', () => this.callbacks.onAircraft(button.dataset.aircraft as AircraftKind));
    });
    this.el('#free-flight-btn').addEventListener('click', () => this.callbacks.onFreeFlight());
    this.el('#debrief-retry').addEventListener('click', () => this.callbacks.onRetry());
    this.debriefNext.addEventListener('click', () => this.callbacks.onNext());
    this.el('#debrief-menu').addEventListener('click', () => this.callbacks.onMenu());
  }

  setMode(mode: GameMode): void {
    document.querySelectorAll<HTMLButtonElement>('[data-mode]').forEach((button) => {
      button.classList.toggle('is-active', button.dataset.mode === mode);
    });
    this.app.classList.toggle('is-pilot', mode === 'pilot');
    if (mode === 'watch') {
      this.panel.hidden = true;
      this.hud.hidden = true;
      this.debrief.hidden = true;
      this.marker.hidden = true;
    }
  }

  setAircraft(kind: AircraftKind): void {
    document.querySelectorAll<HTMLButtonElement>('[data-aircraft]').forEach((button) => {
      button.classList.toggle('is-active', button.dataset.aircraft === kind);
    });
  }

  showCampaign(progress: CampaignProgress): void {
    this.debrief.hidden = true;
    this.marker.hidden = true;
    this.summary.textContent = `${totalStars(progress)} de ${this.missions.length * 3} estrelas · ${AIRCRAFT_SPECS[progress.aircraft].short}`;
    this.list.innerHTML = this.missions
      .map((mission, index) => {
        const best = progress.best[mission.id];
        const unlocked = isUnlocked(progress, index);
        return (
          `<li><button type="button" data-mission="${index}" ${unlocked ? '' : 'disabled'}>` +
          `<span class="num">${index + 1}</span>` +
          `<span class="title">${mission.title}<small>${mission.subtitle}</small></span>` +
          `<span class="sub">${unlocked ? mission.novelty : 'Conclua a fase anterior'}</span>` +
          `<span class="stars">${stars(best?.stars ?? 0)}</span>` +
          `</button></li>`
        );
      })
      .join('');
    this.list.querySelectorAll<HTMLButtonElement>('[data-mission]').forEach((button) => {
      button.addEventListener('click', () => this.callbacks.onMission(Number(button.dataset.mission)));
    });
    this.panel.hidden = false;
  }

  hideCampaign(): void {
    this.panel.hidden = true;
  }

  get campaignOpen(): boolean {
    return !this.panel.hidden;
  }

  showFlightHud(): void {
    this.hud.hidden = false;
  }

  hideFlightHud(): void {
    this.hud.hidden = true;
    this.marker.hidden = true;
  }

  update(frame: PilotHudFrame): void {
    this.mission.textContent = frame.missionTitle;
    this.objective.textContent = frame.objective;
    this.rings.textContent = frame.ringsTotal > 0 ? `${frame.ringsPassed}/${frame.ringsTotal}` : '—';
    this.time.textContent = formatClock(frame.timeSec);
    this.score.textContent = String(frame.score);
    this.next.hidden = frame.nextDistM === null;
    if (frame.nextDistM !== null) {
      this.nextArrow.style.transform = `rotate(${frame.nextRelBearingDeg}deg)`;
      this.nextDist.textContent = formatDistance(frame.nextDistM);
      const alt = Math.round(frame.nextAltDeltaM / 0.3048 / 100) * 100;
      this.nextAlt.textContent = Math.abs(alt) < 100 ? 'na altitude' : `${alt > 0 ? '▲' : '▼'} ${Math.abs(alt).toLocaleString('pt-BR')} ft`;
    }
    const pct = Math.round(frame.throttle01 * 100);
    this.throttleFill.style.width = `${pct}%`;
    this.throttleText.textContent = `${pct}%`;
    this.pitch.textContent = `${frame.pitchDeg >= 0 ? '+' : ''}${frame.pitchDeg.toFixed(0)}°`;
    this.bank.textContent = `${frame.rollDeg >= 0 ? 'D ' : 'E '}${Math.abs(frame.rollDeg).toFixed(0)}°`;
    this.gear.textContent = frame.gearDown ? 'Baixado' : 'Recolhido';
    this.hud.classList.toggle('in-storm', frame.inStorm);
  }

  /** Posiciona o marcador do próximo anel (coordenadas normalizadas −1…1; `behind` esconde). */
  placeMarker(ndcX: number, ndcY: number, behind: boolean, label: string, width: number, height: number): void {
    if (behind) {
      this.marker.hidden = true;
      return;
    }
    const x = Math.max(24, Math.min(width - 24, (ndcX * 0.5 + 0.5) * width));
    const y = Math.max(24, Math.min(height - 24, (-ndcY * 0.5 + 0.5) * height));
    this.marker.hidden = false;
    this.marker.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%)`;
    this.markerLabel.textContent = label;
  }

  flash(text: string, kind: 'good' | 'bad' | 'info' = 'info'): void {
    this.toast.textContent = text;
    this.toast.dataset.kind = kind;
    this.toast.hidden = false;
    this.toast.style.animation = 'none';
    void this.toast.offsetWidth;
    this.toast.style.animation = '';
    window.clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => {
      this.toast.hidden = true;
    }, 1100);
  }

  showDebrief(mission: MissionSpec, result: MissionResult, hasNext: boolean): void {
    this.marker.hidden = true;
    this.debriefTitle.textContent = result.success ? `${mission.title}: concluída` : `${mission.title}: falhou`;
    this.debriefStars.innerHTML = stars(result.stars);
    this.debriefRings.textContent = `${result.passed}/${result.total}`;
    this.debriefTime.textContent = formatClock(result.timeSec);
    this.debriefScore.textContent = String(result.score);
    if (!result.success) {
      const need = Math.ceil(mission.minRingFraction * result.total);
      this.debriefNote.textContent = `Precisa de pelo menos ${need} anéis. Alinhe a proa com o anel antes de chegar nele.`;
    } else if (result.stars < 3) {
      this.debriefNote.textContent = result.passed < result.total
        ? 'Todos os anéis dentro do tempo-alvo valem três estrelas.'
        : `Tempo-alvo: ${formatClock(mission.parTimeSec)}. Manete cheia entre os anéis.`;
    } else {
      this.debriefNote.textContent = 'Voo perfeito.';
    }
    this.debriefNext.hidden = !(result.success && hasNext);
    this.debrief.hidden = false;
  }

  hideDebrief(): void {
    this.debrief.hidden = true;
  }

  private el<T extends HTMLElement = HTMLElement>(selector: string): T {
    const node = document.querySelector<T>(selector);
    if (!node) throw new Error(`Missing pilot HUD node ${selector}`);
    return node;
  }
}
