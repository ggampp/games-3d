// Fases. Coordenadas em unidades de viga; pts são o eixo central da SUPERFÍCIE de rolagem.
// Pontas: 'start' (lampião), 'goal' (pino), 'cap' (batente: a bola volta),
// 'open' (borda: a bola cai, a menos que outra ponta pareça encostada nela na tela).
// gaps: vãos que a bola atravessa enquanto estiverem escondidos atrás de um bloco.
// pillars: colunas decorativas com pé curvo (também escondem coisas).

export const LEVELS = [
  {
    id: 1,
    name: 'Ponto de vista',
    hint: 'Arraste para girar. Quando as duas vigas parecerem uma só, solte a bola.',
    camera: { yaw: 35, pitch: 30 },
    tracks: [
      { pts: [[0, 3, 0], [4, 3, 0]], start: 'start', end: 'open' },
      { pts: [[4, 0, 3], [8, 0, 3]], start: 'open', end: 'goal' },
    ],
    pillars: [
      { x: 1, z: 0, top: 2.5, bottom: 0.4 },
      { x: 7, z: 3, top: -0.5, bottom: -2.6 },
    ],
  },
  {
    id: 2,
    name: 'Duas verdades',
    hint: 'Uma vista leva a bola até a metade. A outra, até o pino. Gire com a bola rolando.',
    camera: { yaw: 150, pitch: 50 },
    tracks: [
      { pts: [[0, 4, 0], [3, 4, 0]], start: 'start', end: 'open' },
      { pts: [[1, 2, -2], [1, 2, -6], [-2, 2, -6]], start: 'open', end: 'open' },
      { pts: [[-4, 4, -4], [-4, 4, 0]], start: 'open', end: 'goal' },
    ],
    pillars: [
      { x: 1, z: -6, top: 1.5, bottom: -0.6 },
      { x: -4, z: -2, top: 3.5, bottom: 1.2 },
    ],
  },
  {
    id: 3,
    name: 'O que não se vê',
    hint: 'Um vão escondido atrás de um bloco deixa de existir. Mantenha-o escondido até a bola passar.',
    camera: { yaw: 70, pitch: 25 },
    tracks: [
      { pts: [[0, 2, 0], [3, 2, 0]], start: 'start', end: 'open' },
      { pts: [[5, 2, 0], [9, 2, 0]], start: 'open', end: 'goal' },
    ],
    gaps: [[[0, 1], [1, 0]]],
    blocks: [{ c: [4, 4.2, 2.2], size: [1.6, 1.2, 1.2] }],
    pillars: [
      { x: 0, z: 0, top: 1.5, bottom: -0.6 },
      { x: 8, z: 0, top: 1.5, bottom: -0.6 },
    ],
  },
  {
    id: 4,
    name: 'Atrás do cubo',
    hint: 'Primeiro, encoste as vigas. Depois, esconda o vão — sem parar a bola.',
    camera: { yaw: 120, pitch: 30 },
    tracks: [
      { pts: [[0, 3, 0], [0, 3, 4]], start: 'start', end: 'open' },
      { pts: [[2, 1, 2], [6, 1, 2]], start: 'open', end: 'open' },
      { pts: [[8, 1, 2], [8, 1, -2]], start: 'open', end: 'goal' },
    ],
    gaps: [[[1, 1], [2, 0]]],
    blocks: [{ c: [8.6, 2.9, 3.6], size: [1.4, 1.4, 1.4] }],
    pillars: [
      { x: 0, z: 1, top: 2.5, bottom: 0.2 },
      { x: 3, z: 2, top: 0.5, bottom: -1.6 },
      { x: 8, z: -1, top: 0.5, bottom: -1.6 },
    ],
  },
  {
    id: 5,
    name: 'Escada de Penrose',
    hint: 'De um certo ângulo, a escada só sobe. De outro, o vão some.',
    camera: { yaw: -60, pitch: 55 },
    tracks: [
      { pts: [[0, 0, 0], [4, 0, 0]], start: 'start', end: 'open' },
      { pts: [[6, 2, 2], [6, 2, -2]], start: 'open', end: 'open' },
      { pts: [[8, 4, 0], [5, 4, 0]], start: 'open', end: 'open' },
      { pts: [[3, 4, 0], [3, 4, -4]], start: 'open', end: 'goal' },
    ],
    gaps: [[[2, 1], [3, 0]]],
    blocks: [{ c: [5.6, 5.9, -1.6], size: [1.6, 1.3, 1.3] }],
    pillars: [
      { x: 1, z: 0, top: -0.5, bottom: -2.6 },
      { x: 6, z: 1, top: 1.5, bottom: -0.6 },
      { x: 3, z: -3, top: 3.5, bottom: 1.4 },
    ],
  },
  {
    id: 6,
    name: 'A ponte',
    hint: 'Tudo o que você precisa já está aqui. Só falta o ângulo certo — três vezes.',
    camera: { yaw: 25, pitch: 28 },
    tracks: [
      { pts: [[0, 5, 0], [6, 5, 0], [6, 5, 3]], start: 'start', end: 'open' },
      { pts: [[4, 2, 1], [4, 2, -3], [1, 2, -3]], start: 'open', end: 'open' },
      { pts: [[-1, 2, -3], [-1, 2, 1], [-3, 2, 1]], start: 'open', end: 'open' },
      { pts: [[-5, 4, -1], [-5, 4, -5], [-2, 4, -5]], start: 'open', end: 'goal' },
    ],
    gaps: [[[1, 1], [2, 0]]],
    blocks: [{ c: [0, 4.1, -5.2], size: [1.6, 1.3, 1.3] }],
    pillars: [
      { x: 0, z: 0, top: 4.5, bottom: 2.6 },
      { x: 6, z: 3, top: 4.5, bottom: 2.4 },
      { x: 4, z: -3, top: 1.5, bottom: -0.6 },
      { x: -1, z: 1, top: 1.5, bottom: -0.6 },
      { x: -5, z: -5, top: 3.5, bottom: 1.4 },
    ],
  },
];
