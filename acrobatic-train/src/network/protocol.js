import { createLevelContent, getLevel } from '../levels/level-config.js';

/** Versioned client/server contract for two-player online races (M5). */
export const PROTOCOL_VERSION = 1;
export const LIMITS = Object.freeze({
  maxMessageBytes: 4096, maxInputsPerSecond: 120, maxNameLength: 16,
  // Late inputs (stalled client main thread) are applied on the next tick instead of dropped, up to 1 s.
  inputAheadTicks: 30, inputLateTicks: 60, tickHz: 60, snapshotEveryTicks: 3,
  countdownMs: 3000, disconnectGraceMs: 5000, lobbyIdleMs: 5 * 60 * 1000, resultTtlMs: 2 * 60 * 1000,
  maxCatchUpTicks: 600,
});
export const ROOM_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const ERROR_CODES = Object.freeze(['bad-json', 'too-large', 'bad-message', 'version', 'room-not-found', 'room-full', 'room-started',
  'not-in-room', 'already-in-room', 'content-mismatch', 'bad-level', 'input-window', 'input-stale', 'input-run', 'input-terminal', 'rate-limited', 'room-expired']);
export const LANES = Object.freeze([-1, 0, 1]);

/** FNV-1a over the canonical level + content JSON: both peers must race the exact same layout. */
export function contentHash(levelId) {
  const level = getLevel(levelId);
  if (!level) return null;
  let h = 2166136261;
  for (const char of JSON.stringify({ level, content: createLevelContent(level) })) h = Math.imul(h ^ char.charCodeAt(0), 16777619);
  return `${level.version}:${(h >>> 0).toString(16).padStart(8, '0')}`;
}

const utf8 = new TextEncoder();
const isInt = (value, min = 0) => Number.isSafeInteger(value) && value >= min;
const fail = code => ({ ok: false, code });
/**
 * Parses one client frame. Only whitelisted fields survive: a client cannot smuggle a position,
 * score, result or participant ID because those keys are never read.
 */
export function parseClientMessage(raw) {
  const text = typeof raw === 'string' ? raw : String(raw ?? '');
  if (text.length > LIMITS.maxMessageBytes || utf8.encode(text).length > LIMITS.maxMessageBytes) return fail('too-large');
  let data;
  try { data = JSON.parse(text); } catch { return fail('bad-json'); }
  if (!data || typeof data !== 'object' || Array.isArray(data) || typeof data.type !== 'string') return fail('bad-message');
  if (data.v !== PROTOCOL_VERSION) return fail('version');
  switch (data.type) {
    case 'join': {
      const name = typeof data.name === 'string' ? data.name.replace(/[^\p{L}\p{N} _-]/gu, '').trim().slice(0, LIMITS.maxNameLength) : '';
      if (data.create !== undefined) {
        if (!data.create || typeof data.create.levelId !== 'string' || !getLevel(data.create.levelId)) return fail('bad-level');
        return { ok: true, msg: { type: 'join', name: name || 'Jogador', create: { levelId: data.create.levelId } } };
      }
      if (typeof data.room !== 'string' || !new RegExp(`^[${ROOM_CODE_ALPHABET}]{5}$`).test(data.room.toUpperCase())) return fail('bad-message');
      return { ok: true, msg: { type: 'join', name: name || 'Jogador', room: data.room.toUpperCase() } };
    }
    case 'ready':
      if (typeof data.ready !== 'boolean' || (data.ready && typeof data.contentHash !== 'string')) return fail('bad-message');
      return { ok: true, msg: { type: 'ready', ready: data.ready, contentHash: data.ready ? data.contentHash : null } };
    case 'input': {
      const lanes = data.lanes && typeof data.lanes === 'object' ? data.lanes : null;
      const picked = lanes ? Object.fromEntries(['front', 'rear'].filter(end => lanes[end] !== undefined).map(end => [end, lanes[end]])) : {};
      if (!isInt(data.runId, 1) || !isInt(data.seq, 1) || !isInt(data.tick) || !Object.keys(picked).length || !Object.values(picked).every(l => LANES.includes(l))) return fail('bad-message');
      return { ok: true, msg: { type: 'input', runId: data.runId, seq: data.seq, tick: data.tick, lanes: picked } };
    }
    case 'ping':
      if (!Number.isFinite(data.t)) return fail('bad-message');
      return { ok: true, msg: { type: 'ping', t: data.t } };
    case 'leave': return { ok: true, msg: { type: 'leave' } };
    default: return fail('bad-message');
  }
}
export const encode = message => JSON.stringify({ v: PROTOCOL_VERSION, ...message });
