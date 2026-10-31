// Máquina de estados da bola. Recebe dt e uma "vista" (ViewController ou equivalente);
// não lê relógio e não toca em Object3D.
import { add, scale, sub } from './math.js';
import { BALL_R, BEAM_W, gapPoint, isHidden } from './level.js';

export const SPEED = 1.9; // unidades por segundo
const GRAVITY = 14;
const FALL_TIME = 1.3;
const DROP_TIME = 0.35; // animação da bola saindo do lampião
const PIN_REACH = 0.42; // distância do centro da ponta final em que o pino é derrubado

export class Ball {
  constructor(level) {
    this.level = level;
    this.events = [];
    this.falls = 0;
    this.spin = 0; // ângulo acumulado de rolagem (render)
    this.reset();
  }

  reset() {
    const p = this.level.start;
    this.state = 'drop';
    this.timer = 0;
    this.track = p.track;
    this.dir = p.end === 0 ? 1 : -1;
    this.s = p.end === 0 ? 0 : this.level.tracks[p.track].length;
    this.gap = null;
    this.vel = [0, 0, 0];
    this.fwd = scale(p.out, -1);
    this.side = [0, 0, 1];
    this.pos = add(p.pos, [0, BALL_R, 0]);
  }

  release() {
    if (this.state === 'ready') {
      this.state = 'rolling';
      this.emit('release');
    }
  }

  emit(type, data) {
    this.events.push({ type, ...data });
  }

  update(dt, view) {
    const steps = Math.max(1, Math.ceil(dt / (1 / 120)));
    const h = dt / steps;
    for (let i = 0; i < steps; i++) this.step(h, view);
  }

  step(dt, view) {
    switch (this.state) {
      case 'drop':
        this.timer += dt;
        if (this.timer >= DROP_TIME) {
          this.state = 'ready';
          this.emit('ready');
        }
        this.placeOnTrack();
        break;
      case 'rolling':
        this.roll(dt, view);
        break;
      case 'gap':
        this.crossGap(dt, view);
        break;
      case 'ledge':
      case 'falling':
        this.fall(dt);
        break;
      default:
        break;
    }
  }

  placeOnTrack() {
    const t = this.level.tracks[this.track];
    const f = t.at(this.s);
    this.pos = add(f.pos, scale(f.up, BALL_R));
    this.fwd = scale(f.fwd, this.dir);
    this.side = f.side;
  }

  roll(dt, view) {
    const t = this.level.tracks[this.track];
    this.s += this.dir * SPEED * dt;
    this.spin += (SPEED * dt) / BALL_R;

    const goal = this.level.goal;
    if (goal.track === this.track) {
      const dEnd = goal.end === 0 ? this.s : t.length - this.s;
      if (dEnd <= PIN_REACH && this.dir === (goal.end === 0 ? -1 : 1)) {
        this.placeOnTrack();
        this.state = 'won';
        this.emit('win');
        return;
      }
    }

    if (this.s >= 0 && this.s <= t.length) {
      this.placeOnTrack();
      return;
    }
    // Chegou a uma ponta.
    const end = this.s > t.length ? 1 : 0;
    const over = end === 1 ? this.s - t.length : -this.s;
    this.s = end === 1 ? t.length : 0;
    this.placeOnTrack();
    this.arrive(this.level.ports[this.track * 2 + end], over, view);
  }

  arrive(port, over, view) {
    if (port.gap && view.gapPassable(port.gap)) {
      this.state = 'gap';
      this.gap = port.gap;
      this.gapFrom = port;
      this.gs = over;
      this.emit('gap');
      return;
    }
    const other = port.type === 'open' && !port.gap ? view.linkedPort(port) : null;
    if (other) {
      this.enterTrack(other, over);
      this.emit('link', { from: port, to: other });
      return;
    }
    if (port.type === 'open') {
      this.startFall(port.out);
      return;
    }
    // Ponta fechada (batente / lampião): volta.
    this.dir = -this.dir;
    this.s = port.end === 1 ? this.s - over : this.s + over;
    this.placeOnTrack();
    this.emit('bounce');
  }

  enterTrack(port, over) {
    const t = this.level.tracks[port.track];
    this.track = port.track;
    this.dir = port.end === 0 ? 1 : -1;
    this.s = port.end === 0 ? over : t.length - over;
    this.state = 'rolling';
    this.placeOnTrack();
  }

  crossGap(dt, view) {
    const gap = this.gap;
    this.gs += SPEED * dt;
    this.spin += (SPEED * dt) / BALL_R;
    const from = this.gapFrom;
    const to = from === gap.a ? gap.b : gap.a;
    const t = Math.min(this.gs / gap.length, 1);
    const u = from === gap.a ? t : 1 - t;
    this.pos = gapPoint(gap, u);
    this.fwd = from.out;
    // A ponte invisível só existe enquanto continua escondida.
    // As pontas do vão ficam sobre a viga (meia largura), então só checamos o miolo.
    const inner = this.gs > BEAM_W / 2 && this.gs < gap.length - BEAM_W / 2;
    if (inner && !isHidden(this.pos, view.basis, this.level.occluders)) {
      this.startFall(from.out, true);
      return;
    }
    if (this.gs >= gap.length) {
      this.enterTrack(to, this.gs - gap.length);
      this.emit('gapdone');
    }
  }

  startFall(dir, immediate = false) {
    this.state = immediate ? 'falling' : 'ledge';
    this.timer = 0;
    this.ledge = 0;
    this.vel = scale(dir, SPEED);
    this.emit('fall');
  }

  fall(dt) {
    this.timer += dt;
    if (this.state === 'ledge') {
      // Rola até a borda real da viga (a ponta lógica fica no centro do último ladrilho).
      this.ledge += SPEED * dt;
      this.pos = add(this.pos, scale(this.vel, dt));
      this.spin += (SPEED * dt) / BALL_R;
      if (this.ledge >= BEAM_W / 2 + BALL_R * 0.5) this.state = 'falling';
      return;
    }
    this.vel = sub(this.vel, [0, GRAVITY * dt, 0]);
    this.pos = add(this.pos, scale(this.vel, dt));
    if (this.timer > FALL_TIME) {
      this.falls++;
      this.reset();
      this.emit('respawn');
    }
  }
}
