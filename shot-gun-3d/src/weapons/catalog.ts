export type WeaponId = 'bullet' | 'shotgun' | 'rifle' | 'bomb' | 'laser' | 'water' | 'hook' | 'detonator';

export type WeaponKind = 'gun' | 'throw' | 'beam' | 'water' | 'hook' | 'remote';

export interface WeaponDef {
  id: WeaponId;
  slot: number;
  label: string;
  kind: WeaponKind;
  pellets: number;
  spread: number;
  damage: number;
  radius: number;
  impulse: number;
  range: number;
  cooldown: number;
  /** Compatibilidade: `throw` = arremesso, `beam` = contínuo. */
  throw: boolean;
  beam: boolean;
  /** Munição: tiros por pente e reserva inicial (0 = infinita). */
  mag: number;
  reserve: number;
  reloadTime: number;
  /** Acende fogo ao acertar madeira/feno? */
  ignites: boolean;
}

function w(p: Partial<WeaponDef> & Pick<WeaponDef, 'id' | 'slot' | 'label' | 'kind'>): WeaponDef {
  return {
    pellets: 1, spread: 0, damage: 0, radius: 0.1, impulse: 0, range: 20, cooldown: 0.3,
    throw: p.kind === 'throw' || p.kind === 'remote', beam: p.kind === 'beam' || p.kind === 'water',
    mag: 0, reserve: 0, reloadTime: 1.2, ignites: false,
    ...p,
  };
}

export const WEAPONS: readonly WeaponDef[] = [
  w({ id: 'bullet',    slot: 1, label: 'Bullet',      kind: 'gun',    spread: 0.012, damage: 12, radius: 0.14, impulse: 3.2, range: 42, cooldown: 0.28, mag: 6,  reserve: 36, reloadTime: 1.1 }),
  w({ id: 'shotgun',   slot: 2, label: 'Shotgun',     kind: 'gun',    pellets: 8, spread: 0.08, damage: 14, radius: 0.20, impulse: 6.2, range: 20, cooldown: 0.72, mag: 5, reserve: 25, reloadTime: 1.6 }),
  w({ id: 'rifle',     slot: 3, label: 'Lever Rifle', kind: 'gun',    spread: 0.008, damage: 22, radius: 0.24, impulse: 9.0, range: 56, cooldown: 0.55, mag: 8, reserve: 32, reloadTime: 1.4 }),
  w({ id: 'bomb',      slot: 4, label: 'Bomb',        kind: 'throw',  damage: 48, radius: 1.55, impulse: 16, range: 18, cooldown: 1.35, mag: 3, reserve: 6, reloadTime: 0.8, ignites: true }),
  w({ id: 'laser',     slot: 5, label: 'Laser',       kind: 'beam',   spread: 0.002, damage: 7, radius: 0.13, impulse: 0.8, range: 34, cooldown: 0.05, ignites: true }),
  w({ id: 'water',     slot: 6, label: 'Water Gun',   kind: 'water',  spread: 0.03, radius: 0.9, impulse: 0.5, range: 9, cooldown: 0.05 }),
  w({ id: 'hook',      slot: 7, label: 'Hook',        kind: 'hook',   impulse: 4, range: 26, cooldown: 0.5 }),
  w({ id: 'detonator', slot: 8, label: 'Detonator',   kind: 'remote', damage: 48, radius: 1.55, impulse: 16, range: 18, cooldown: 0.45, mag: 4, reserve: 4, reloadTime: 0.8, ignites: true }),
];

export function weaponBySlot(slot: number): WeaponDef | undefined {
  return WEAPONS.find((w) => w.slot === slot);
}

export function weaponById(id: WeaponId): WeaponDef {
  const w = WEAPONS.find((item) => item.id === id);
  if (!w) throw new Error(`arma desconhecida: ${id}`);
  return w;
}

export function spreadDirection(
  dir: { x: number; y: number; z: number },
  spread: number,
  rand: () => number = Math.random,
): { x: number; y: number; z: number } {
  if (spread <= 0) return { x: dir.x, y: dir.y, z: dir.z };
  const ox = (rand() * 2 - 1) * spread;
  const oy = (rand() * 2 - 1) * spread;
  const oz = (rand() * 2 - 1) * spread;
  const x = dir.x + ox;
  const y = dir.y + oy;
  const z = dir.z + oz;
  const len = Math.hypot(x, y, z) || 1;
  return { x: x / len, y: y / len, z: z / len };
}

/** Estado de munição de uma arma. */
export interface AmmoState {
  mag: number;
  reserve: number;
  reloading: number;
  /** Laser: calor 0..1 (superaquece em 1). Água: tanque 0..1. */
  gauge: number;
}

export function initialAmmo(def: WeaponDef): AmmoState {
  return { mag: def.mag, reserve: def.reserve, reloading: 0, gauge: def.kind === 'water' ? 1 : 0 };
}

/** Tenta gastar um tiro. Armas sem pente (mag = 0) sempre podem. */
export function spend(def: WeaponDef, a: AmmoState): boolean {
  if (def.mag === 0) return true;
  if (a.reloading > 0 || a.mag <= 0) return false;
  a.mag -= 1;
  return true;
}

export function canReload(def: WeaponDef, a: AmmoState): boolean {
  return def.mag > 0 && a.reloading <= 0 && a.mag < def.mag && a.reserve > 0;
}

export function finishReload(def: WeaponDef, a: AmmoState): void {
  const need = def.mag - a.mag;
  const take = Math.min(need, a.reserve);
  a.mag += take;
  a.reserve -= take;
  a.reloading = 0;
}
