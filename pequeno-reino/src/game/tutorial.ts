import type { Session } from './session';

export type TutorialStep = {
  id: string;
  text: string;
  voice: string | null;
};

const STEPS: TutorialStep[] = [
  {
    id: 'select',
    text: 'Escolha uma carta na mão (ou tecle 1, 2, 3) e toque num hexágono claro ao lado do reino para posar.',
    voice: 'tutorial-1',
  },
  {
    id: 'adjacency',
    text: 'Passe o mouse sobre um hex vago para ver o que a carta rende ali. Prédios gostam de vizinhos certos: o engenho adora uma roça.',
    voice: 'tutorial-2',
  },
  {
    id: 'harmony',
    text: 'Natureza, Povo e Água são as três cores do reino. Um reino equilibrado rende mais estrelas no fim da fase.',
    voice: 'tutorial-3',
  },
  {
    id: 'economy',
    text: 'Pão, farinha, madeira, peixe e pedra viram moedas. Com 2 moedas você compra um pacote novo. Descartar e desfazer também ajudam.',
    voice: null,
  },
  {
    id: 'finish',
    text: 'Missões cumpridas! Continue posando para somar pontos, ou encerre a fase quando quiser.',
    voice: null,
  },
];

/** Passo de tutorial adequado ao estado atual da sessão (só na fase 1). */
export function tutorialStep(session: Session, tutorialDone: boolean): TutorialStep | null {
  if (tutorialDone || session.phaseId !== 1 || session.status !== 'playing') return null;
  const placed = session.map.size - 1;
  if (session.questsDone) return STEPS[4]!;
  if (placed === 0) return STEPS[0]!;
  if (placed === 1) return STEPS[1]!;
  if (placed === 2) return STEPS[2]!;
  if (placed === 3) return STEPS[3]!;
  return null;
}
