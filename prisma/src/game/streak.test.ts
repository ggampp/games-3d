import { describe, expect, it } from 'vitest';
import { EMPTY_STATS, currentStreak, daysBetween, registerDailySolve } from './streak.ts';

describe('sequência de dias', () => {
  it('conta dias seguidos e zera quando pula um dia', () => {
    let s = registerDailySolve(EMPTY_STATS, '2026-09-01');
    expect(s.streak).toBe(1);
    s = registerDailySolve(s, '2026-09-02');
    expect(s.streak).toBe(2);
    s = registerDailySolve(s, '2026-09-02'); // de novo no mesmo dia: nada muda
    expect(s.streak).toBe(2);
    expect(s.solvedDays).toBe(2);
    s = registerDailySolve(s, '2026-09-04');
    expect(s.streak).toBe(1);
    expect(s.best).toBe(2);
    expect(s.solvedDays).toBe(3);
  });

  it('atravessa a virada de mês e de ano', () => {
    expect(daysBetween('2026-08-31', '2026-09-01')).toBe(1);
    expect(daysBetween('2026-12-31', '2027-01-01')).toBe(1);
    expect(daysBetween('2026-09-01', '2026-08-31')).toBe(-1);
    expect(Number.isNaN(daysBetween('lixo', '2026-09-01'))).toBe(true);
  });

  it('a sequência vigente só vale se o último acerto foi hoje ou ontem', () => {
    const s = registerDailySolve(registerDailySolve(EMPTY_STATS, '2026-09-05'), '2026-09-06');
    expect(currentStreak(s, '2026-09-06')).toBe(2);
    expect(currentStreak(s, '2026-09-07')).toBe(2);
    expect(currentStreak(s, '2026-09-08')).toBe(0);
    expect(currentStreak(EMPTY_STATS, '2026-09-08')).toBe(0);
  });
});
