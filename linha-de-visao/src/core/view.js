// Controle de vista: ângulo "cru" vindo do input + encaixe magnético nas vistas de ilusão.
import { DEG, clamp, wrapAngle, angDist, viewBasis, screenDist } from './math.js';
import { PITCH_MIN, PITCH_MAX, gapHidden } from './level.js';

const STICKY = 3.2 * DEG; // enquanto arrasta, "gruda" dentro deste raio
const RELEASE_SNAP = 8 * DEG; // ao soltar, puxa para o encaixe dentro deste raio
const FOLLOW = 18; // velocidade com que a vista exibida segue o alvo (1/s)
const LINK_EPS = 0.035; // distância na tela (unid. de mundo) para considerar conectado

export class ViewController {
  constructor(level) {
    this.level = level;
    this.targets = [
      ...level.links.map((l) => ({ kind: 'link', ref: l, yaw: l.yaw, pitch: l.pitch })),
      ...level.gaps.filter((g) => g.view).map((g) => ({ kind: 'gap', ref: g, ...g.view })),
    ];
    this.rawYaw = level.camera.yaw;
    this.rawPitch = level.camera.pitch;
    this.yaw = this.rawYaw;
    this.pitch = this.rawPitch;
    this.snapped = null;
    this.basis = viewBasis(this.yaw, this.pitch);
  }

  rotate(dYaw, dPitch) {
    this.rawYaw = wrapAngle(this.rawYaw + dYaw);
    this.rawPitch = clamp(this.rawPitch + dPitch, PITCH_MIN, PITCH_MAX);
  }

  nearest(maxDist) {
    let best = null;
    let bestD = maxDist;
    for (const t of this.targets) {
      const d = angDist(this.rawYaw, this.rawPitch, t.yaw, t.pitch);
      if (d < bestD) {
        bestD = d;
        best = t;
      }
    }
    return best;
  }

  /** Chamado ao soltar o arraste/tecla: encaixa se estiver perto de uma vista especial. */
  release() {
    const t = this.nearest(RELEASE_SNAP);
    if (t) {
      this.rawYaw = t.yaw;
      this.rawPitch = t.pitch;
    }
  }

  update(dt) {
    const t = this.nearest(STICKY);
    this.snapped = t;
    const ty = t ? t.yaw : this.rawYaw;
    const tp = t ? t.pitch : this.rawPitch;
    const k = 1 - Math.exp(-FOLLOW * dt);
    this.yaw = wrapAngle(this.yaw + wrapAngle(ty - this.yaw) * k);
    this.pitch += (tp - this.pitch) * k;
    if (angDist(this.yaw, this.pitch, ty, tp) < 0.02 * DEG) {
      this.yaw = ty;
      this.pitch = tp;
    }
    this.basis = viewBasis(this.yaw, this.pitch);
  }

  /** Força a vista (sem suavização) — usado em testes e ao trocar de fase. */
  set(yaw, pitch) {
    this.rawYaw = this.yaw = yaw;
    this.rawPitch = this.pitch = pitch;
    this.basis = viewBasis(yaw, pitch);
  }

  isLinkActive(link) {
    return screenDist(link.a.pos, link.b.pos, this.basis) < LINK_EPS;
  }

  /** Ponta do outro lado de uma ligação ativa, ou null. */
  linkedPort(port) {
    for (const l of this.level.links) {
      if (l.a !== port && l.b !== port) continue;
      if (this.isLinkActive(l)) return l.a === port ? l.b : l.a;
    }
    return null;
  }

  gapPassable(gap) {
    return gapHidden(this.level, gap, this.basis);
  }
}
