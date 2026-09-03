export type HudColor = 'cyan' | 'green' | 'amber';
export interface Settings {
  invertPitch: boolean;
  mouseSens: number;      // 0.2..2
  deadzone: number;       // 0..0.3
  haptics: number;        // 0..1
  startAirborne: boolean; // start-on-runway vs airborne (for non-dogfight modes)
  volume: number;         // 0..1
  hudColor: HudColor;
  showTapes: boolean;
  sound: boolean;
}
const KEY = 'night-sortie.settings';
export const settings: Settings = {
  invertPitch: false, mouseSens: 1, deadzone: 0.1, haptics: 1, startAirborne: false, volume: 0.8, hudColor: 'cyan', showTapes: true, sound: true,
};
export function loadSettings() {
  try { const raw = localStorage.getItem(KEY); if (raw) Object.assign(settings, JSON.parse(raw)); } catch { /* ignore */ }
  applyHudColor();
}
export function saveSettings() { try { localStorage.setItem(KEY, JSON.stringify(settings)); } catch { /* ignore */ } applyHudColor(); }
export function applyHudColor() { document.documentElement.dataset.hud = settings.hudColor; }

export interface Bests { [missionId: string]: { score: number; grade?: string; wave?: number } }
const BKEY = 'night-sortie.bests';
export function loadBests(): Bests { try { return JSON.parse(localStorage.getItem(BKEY) || '{}'); } catch { return {}; } }
export function saveBest(id: string, score: number, extra: { grade?: string; wave?: number } = {}): boolean {
  const b = loadBests();
  const cur = b[id];
  if (!cur || score > cur.score) { b[id] = { score, ...extra }; try { localStorage.setItem(BKEY, JSON.stringify(b)); } catch { /* ignore */ } return true; }
  if (extra.wave && (!cur.wave || extra.wave > cur.wave)) { cur.wave = extra.wave; try { localStorage.setItem(BKEY, JSON.stringify(b)); } catch { /* ignore */ } }
  return false;
}
