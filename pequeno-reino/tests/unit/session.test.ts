import { describe, expect, it } from 'vitest';
import { buildDeck, getPhase } from '../../src/game/catalog';
import { Rng, seedFromString } from '../../src/game/deck';
import { coinsOf, PACK_COST, scoreOf } from '../../src/game/economy';
import { validPlacements } from '../../src/game/placement';
import { evaluateKingdom } from '../../src/game/production';
import { Session } from '../../src/game/session';
import { tutorialStep } from '../../src/game/tutorial';
import { nextStepOnMap, stepVillagers, syncVillagers } from '../../src/game/villagers';

function playUntil(session: Session, predicate: (s: Session) => boolean, max = 200): void {
  let guard = 0;
  while (!predicate(session) && session.status === 'playing' && guard < max) {
    session.selectHand(0);
    const spot = validPlacements(session.map)[guard % validPlacements(session.map).length]!;
    session.place(spot);
    guard += 1;
  }
}

describe('rng', () => {
  it('é determinístico e restaurável pelo estado', () => {
    const a = new Rng(123);
    const first = [a.next(), a.next(), a.next()];
    const b = new Rng(123);
    expect([b.next(), b.next(), b.next()]).toEqual(first);
    const snapshot = a.state;
    const nextA = a.next();
    const c = new Rng(0);
    c.state = snapshot;
    expect(c.next()).toBe(nextA);
  });

  it('seed de texto é estável', () => {
    expect(seedFromString('reino')).toBe(seedFromString('reino'));
    expect(seedFromString('reino')).not.toBe(seedFromString('reino2'));
  });
});

describe('baralho com desbloqueios', () => {
  it('fase 2 recebe o engenho desbloqueado só uma vez (já está no baralho base)', () => {
    const base = getPhase(2).deck;
    const deck = buildDeck(getPhase(2), ['engenho', 'clareira']);
    expect(deck.length).toBe(base.length);
  });

  it('tile desbloqueado que não está no baralho entra em cópia simples', () => {
    const p3 = getPhase(3);
    const withCabana = buildDeck(p3, ['cabana_mateiro']);
    expect(withCabana.filter((id) => id === 'cabana_mateiro')).toHaveLength(1);
    expect(withCabana.length).toBe(p3.deck.length + 1);

    const p4 = getPhase(4);
    const withMill = buildDeck(p4, ['moinho_vento', 'moinho_vento']);
    expect(withMill.filter((id) => id === 'moinho_vento')).toHaveLength(1);
  });

  it('o sandbox já contém todos os tiles: desbloqueios não duplicam', () => {
    const p5 = getPhase(5);
    expect(buildDeck(p5, ['casa_pedra', 'pedreira']).length).toBe(p5.deck.length);
  });

  it('tile de fase futura não entra', () => {
    const deck = buildDeck(getPhase(1), ['pedreira']);
    expect(deck).not.toContain('pedreira');
  });
});

describe('sessão v2', () => {
  it('cartas posadas vão para o descarte e o sandbox recicla', () => {
    const session = new Session(5, 7);
    const total = session.deckSize;
    playUntil(session, (s) => s.deck.length === 0);
    expect(session.status).toBe('playing');
    expect(session.discard.length + session.hand.length + session.map.size - 1).toBe(total);
    // mais uma jogada força o reembaralho do descarte
    session.selectHand(0);
    session.place(validPlacements(session.map)[0]!);
    expect(session.hand.length).toBeGreaterThan(0);
    expect(session.status).toBe('playing');
  });

  it('fase normal só termina quando as cartas acabam ou o jogador encerra', () => {
    const session = new Session(1, 3);
    playUntil(session, (s) => s.questsDone);
    expect(session.questsDone).toBe(true);
    expect(session.status).toBe('playing');
    expect(session.canFinish).toBe(true);
    expect(session.finishPhase()).toBe(true);
    expect(session.status).toBe('phaseComplete');
  });

  it('acabar as cartas com missões feitas completa; sem missões adormece', () => {
    const done = new Session(1, 3);
    playUntil(done, () => false);
    expect(done.deck.length + done.hand.length).toBe(0);
    expect(done.status).toBe('phaseComplete');

    const asleep = new Session(3, 11);
    // descarta tudo que não é rio para nunca cumprir "rio contínuo de 4"
    let guard = 0;
    while (asleep.status === 'playing' && guard < 300) {
      asleep.selectHand(0);
      if (asleep.hand[0] === 'rio' && asleep.canDiscard) asleep.discardCard();
      else asleep.place(validPlacements(asleep.map)[guard % 3]!);
      guard += 1;
    }
    expect(['asleep', 'phaseComplete']).toContain(asleep.status);
  });

  it('desfazer restaura mapa, mão, baralho e rng', () => {
    const session = new Session(1, 99);
    const before = session.serialize(false);
    session.selectHand(1);
    session.place(validPlacements(session.map)[2]!);
    expect(session.map.size).toBe(2);
    expect(session.canUndo).toBe(true);
    expect(session.undo()).toBe(true);
    const after = session.serialize(false);
    expect(after.map).toEqual(before.map);
    expect(after.hand).toEqual(before.hand);
    expect(after.deck).toEqual(before.deck);
    expect(after.rngState).toBe(before.rngState);
    expect(session.canUndo).toBe(false);
  });

  it('descartar gasta um dos três descartes e compra outra carta', () => {
    const session = new Session(2, 5);
    const deckBefore = session.deck.length;
    session.selectHand(0);
    expect(session.discardCard()).toBe(true);
    expect(session.discardsLeft).toBe(2);
    expect(session.hand.length).toBe(3);
    expect(session.deck.length).toBe(deckBefore - 1);
    expect(session.discard.length).toBe(1);
  });

  it('pacote custa moedas de qualquer recurso', () => {
    const session = new Session(2, 5);
    expect(session.canBuyPack).toBe(false);
    session.map.set('1,0', 'mata');
    session.map.set('0,-1', 'mata');
    session.map.set('1,-1', 'serraria');
    expect(coinsOf(session.evaluation)).toBeGreaterThanOrEqual(PACK_COST);
    expect(session.canBuyPack).toBe(true);
    const coins = session.coins;
    expect(session.newPack().ok).toBe(true);
    expect(session.coins).toBe(coins - PACK_COST);
  });

  it('serializa e restaura a sessão completa', () => {
    const session = new Session(2, 77, ['engenho']);
    session.selectHand(0);
    session.place(validPlacements(session.map)[0]!);
    const restored = new Session(2, 0, [], session.serialize());
    expect(restored.serialize()).toEqual(session.serialize());
    expect(restored.seed).toBe(77);
    expect(restored.deckSize).toBe(session.deckSize);
  });

  it('prévia não altera o estado', () => {
    const session = new Session(1, 4);
    const snapshot = session.serialize();
    const floats = session.preview(validPlacements(session.map)[0]!);
    expect(Array.isArray(floats)).toBe(true);
    expect(session.serialize()).toEqual(snapshot);
  });
});

describe('pontuação e estrelas', () => {
  it('sem missões não há estrela; equilíbrio vale dobrado', () => {
    const map = new Map([
      ['0,0', 'clareira'],
      ['1,0', 'casa'],
      ['0,1', 'rio'],
    ]);
    const evaluation = evaluateKingdom(map);
    const noQuest = scoreOf(evaluation, 18, false);
    expect(noQuest.stars).toBe(0);
    expect(noQuest.equilibrio).toBe(2 * Math.min(evaluation.harmony.natureza, evaluation.harmony.povo, evaluation.harmony.agua));
    const withQuest = scoreOf(evaluation, 18, true);
    expect(withQuest.stars).toBe(1);
    expect(withQuest.nextStarAt).toBe(Math.round(18 * 1.6));
  });

  it('três estrelas acima do limiar alto', () => {
    const evaluation = { harmony: { natureza: 20, povo: 20, agua: 20 }, resources: { farinha: 0, pao: 0, madeira: 0, pedra: 0, peixe: 0, populacao: 5 } };
    expect(scoreOf(evaluation, 18, true).stars).toBe(3);
  });
});

describe('aldeões', () => {
  it('só andam por hexes do mapa', () => {
    const map = new Map([
      ['0,0', 'casa'],
      ['1,0', 'clareira'],
      ['2,0', 'roca'],
    ]);
    expect(nextStepOnMap(map, { q: 0, r: 0 }, { q: 2, r: 0 })).toEqual({ q: 1, r: 0 });
    expect(nextStepOnMap(map, { q: 0, r: 0 }, { q: 0, r: 5 })).toEqual({ q: 0, r: 0 });
  });

  it('avança com rng determinístico e sempre em hex ocupado', () => {
    const map = new Map([
      ['0,0', 'casa'],
      ['1,0', 'clareira'],
      ['2,0', 'roca'],
      ['1,-1', 'engenho'],
    ]);
    const rng = new Rng(1);
    let villagers = syncVillagers(map, []);
    expect(villagers).toHaveLength(1);
    for (let i = 0; i < 400; i += 1) {
      villagers = stepVillagers(villagers, map, 0.05, () => rng.next());
      for (const v of villagers) {
        expect(map.has(`${v.from.q},${v.from.r}`)).toBe(true);
        expect(map.has(`${v.to.q},${v.to.r}`)).toBe(true);
      }
    }
  });
});

describe('tutorial', () => {
  it('só aparece na fase 1 e segue a sequência', () => {
    const session = new Session(1, 8);
    expect(tutorialStep(session, false)?.id).toBe('select');
    expect(tutorialStep(session, true)).toBeNull();
    expect(tutorialStep(new Session(2, 8), false)).toBeNull();
    session.selectHand(0);
    session.place(validPlacements(session.map)[0]!);
    expect(tutorialStep(session, false)?.id).toBe('adjacency');
  });
});
