/**
 * CubeScrambler.js
 * Gerador de embaralhamento oficial no formato WCA (World Cube Association)
 * Garante que não haja movimentos redundantes ou consecutivos no mesmo eixo.
 */

const FACES_BY_AXIS = [
  ['U', 'D'], // Eixo Y
  ['L', 'R'], // Eixo X
  ['F', 'B']  // Eixo Z
];

const MODIFIERS = ['', "'", '2'];

export class CubeScrambler {
  /**
   * Gera uma sequência de embaralhamento WCA válida
   * @param {number} length Número de movimentos (padrão: 22)
   * @returns {string[]} Array com os movimentos gerados
   */
  static generateScramble(length = 22) {
    const scramble = [];
    let lastAxis = -1;
    let secondLastAxis = -1;

    for (let i = 0; i < length; i++) {
      let axis;
      do {
        axis = Math.floor(Math.random() * 3);
      } while (
        axis === lastAxis || 
        (axis === secondLastAxis && lastAxis !== -1 && FACES_BY_AXIS[lastAxis].includes(scramble[scramble.length - 1][0]))
      );

      const faceGroup = FACES_BY_AXIS[axis];
      const face = faceGroup[Math.floor(Math.random() * faceGroup.length)];
      const modifier = MODIFIERS[Math.floor(Math.random() * MODIFIERS.length)];

      scramble.push(face + modifier);

      secondLastAxis = lastAxis;
      lastAxis = axis;
    }

    return scramble;
  }

  /**
   * Retorna o scramble como string formatada para exibição
   */
  static generateScrambleString(length = 22) {
    return this.generateScramble(length).join(' ');
  }
}
