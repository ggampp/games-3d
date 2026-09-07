// Estado global do jogo (valores de referência: 8 cartuchos, 64 reserva, cap 96)
export const GUN = { magazine: 8, reserve: 64, reserveCap: 96, reload: 2.43, cadence: 0.24, pellets: 8, pelletDamage: 14, spread: 0.035 };
export const MOVE = { walk: 3.8, run: 6.5, eyeHeight: 1.7, radius: 0.45 };
export const START = { x: 3, z: 92 };
export const PLAZA = { x: 0, z: -155, radius: 24 };
export const EVAC_TIME = 90; // segundos de cerco sobrevividos para evacuar

export const S = {
  mode: 'menu', muted: false, elapsed: 0,
  health: 100, stamina: 100, exhausted: false, running: false, moving: false,
  ammo: GUN.magazine, reserve: GUN.reserve, reloading: 0, cooldown: 0,
  fog: 0, exertion: 0, breath: 0, hurt: 0, flash: 0,
  kills: 0, enemies: 0, torch: true,
  hordePhase: 'quiet', hordeNumber: 0, siege: 0, siegeStart: -1,
  prompt: '', notice: '', noticeTime: 0,
};

const listeners = new Set();
export const on = (fn) => (listeners.add(fn), () => listeners.delete(fn));
export const emit = (ev) => listeners.forEach((fn) => fn(ev));

export function resetRun() {
  Object.assign(S, {
    elapsed: 0, health: 100, stamina: 100, exhausted: false, running: false, moving: false,
    ammo: GUN.magazine, reserve: GUN.reserve, reloading: 0, cooldown: 0,
    fog: 0, exertion: 0, breath: 0, hurt: 0, flash: 0, kills: 0, enemies: 0, torch: true,
    hordePhase: 'quiet', hordeNumber: 0, siege: 0, siegeStart: -1, prompt: '', notice: '', noticeTime: 0,
  });
}

export function notice(text) { S.notice = text; S.noticeTime = 4; }

export function tryShoot() {
  if (S.mode !== 'playing' || S.reloading > 0 || S.cooldown > 0) return false;
  S.cooldown = GUN.cadence;
  if (S.ammo > 0) { S.ammo--; S.flash = 1; emit({ type: 'shot' }); return true; }
  emit({ type: 'empty' }); return false;
}

export function tryReload() {
  if (S.mode !== 'playing' || S.reloading > 0 || S.ammo === GUN.magazine || !S.reserve) return false;
  S.reloading = GUN.reload; emit({ type: 'reload' }); return true;
}

export function damage(amount) {
  if (S.mode !== 'playing') return;
  S.health = Math.max(0, S.health - amount); S.hurt = 1;
  emit({ type: 'damage', amount });
  if (!S.health) { S.mode = 'dead'; emit({ type: 'eaten' }); document.exitPointerLock?.(); }
}

export function pickup(kind) {
  if (S.mode !== 'playing') return false;
  if (kind === 'health' && S.health === 100) return false;
  if (kind === 'ammo' && S.reserve >= GUN.reserveCap) return false;
  if (kind === 'health') S.health = Math.min(100, S.health + 35);
  else S.reserve = Math.min(GUN.reserveCap, S.reserve + 16);
  notice(kind === 'health' ? 'BOTIQUÍN · +35 SALUD' : 'MUNICIÓN · +16 CARTUCHOS');
  emit({ type: 'pickup' }); return true;
}

// Fisiologia: stamina, embaçamento do visor, respiração, timers
export function tickVitals(dt, wantRun, moving) {
  if (S.mode !== 'playing') return;
  dt = Math.min(dt, 0.1);
  S.elapsed += dt; S.moving = moving;
  if (S.stamina <= 0) S.exhausted = true;
  if (S.stamina >= 28) S.exhausted = false;
  S.running = wantRun && moving && !S.exhausted && S.reloading <= 0;
  S.stamina = Math.max(0, Math.min(100, S.stamina + dt * (S.running ? -16 : 12)));
  const target = S.running ? Math.min(0.85, (100 - S.stamina) / 90) : 0;
  S.fog += (target - S.fog) * Math.min(1, dt * (S.running ? 0.7 : 0.32));
  S.exertion = Math.max(0, Math.min(1, S.exertion + dt * (S.running ? 1 / 2.8 : -1 / 11)));
  if (S.exhausted) S.exertion = Math.max(S.exertion, 0.9);
  S.breath = 0.5 + 0.5 * Math.sin(S.elapsed * (1.35 + S.exertion * 1.9));
  S.cooldown = Math.max(0, S.cooldown - dt);
  S.flash = Math.max(0, S.flash - dt * 12);
  S.hurt = Math.max(0, S.hurt - dt * 1.4);
  S.noticeTime = Math.max(0, S.noticeTime - dt);
  if (S.reloading > 0) {
    S.reloading = Math.max(0, S.reloading - dt);
    if (!S.reloading) {
      const n = Math.min(GUN.magazine - S.ammo, S.reserve);
      S.ammo += n; S.reserve -= n; emit({ type: 'reloadEnd' });
    }
  }
}
