/**
 * Leitura de exemplo para fotos de 5 faces (cubo apoiado na mesa girado 180°).
 * Topo: Vermelho compartilhado em ambas as fotos.
 * Foto 1: Topo (Vermelho), Frente/Esq (Amarelo), Direita (Azul).
 * Foto 2: Topo (Vermelho girado 180°), Frente/Esq (Branco), Direita (Verde).
 * Base Oculta (Laranja): Deduzida automaticamente pela geometria do cubo.
 */

export const EXAMPLE_TWO_SHOT_PHOTOS = {
  photo1: '/cubo_exemplo_novo_01.jpeg',
  photo2: '/cubo_exemplo_novo_02.jpeg'
};

export const EXAMPLE_TWO_SHOT_READINGS = {
  photo1: {
    top: {
      center: 'red',
      grid: [
        'green', 'green', 'white',
        'blue', 'red', 'yellow',
        'green', 'orange', 'blue'
      ]
    },
    front: {
      center: 'yellow',
      grid: [
        'orange', 'white', 'white',
        'yellow', 'yellow', 'blue',
        'blue', 'blue', 'white'
      ]
    },
    right: {
      center: 'blue',
      grid: [
        'red', 'green', 'blue',
        'orange', 'blue', 'green',
        'red', 'yellow', 'red'
      ]
    }
  },
  photo2: {
    top: {
      center: 'red',
      grid: [
        'blue', 'orange', 'green',
        'yellow', 'red', 'blue',
        'white', 'green', 'green'
      ]
    },
    front: {
      center: 'white',
      grid: [
        'orange', 'red', 'orange',
        'orange', 'white', 'white',
        'blue', 'blue', 'red'
      ]
    },
    right: {
      center: 'green',
      grid: [
        'yellow', 'yellow', 'white',
        'green', 'green', 'red',
        'yellow', 'white', 'yellow'
      ]
    }
  }
};
