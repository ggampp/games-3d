/**
 * CubeState.js
 * Modelo matemático do Cubo Mágico 3x3
 * Gerencia o estado das 54 facetas (facelets), movimentações lógicas e verificação de resolvido.
 */

// Convenção de Cores Padrão WCA:
// U: White (0), R: Red (1), F: Green (2), D: Yellow (3), L: Orange (4), B: Blue (5)
export const FACE_NAMES = ['U', 'R', 'F', 'D', 'L', 'B'];

export const DEFAULT_COLORS = {
  U: '#ffffff', // Branco
  R: '#dc2626', // Vermelho
  F: '#16a34a', // Verde
  D: '#facc15', // Amarelo
  L: '#ea580c', // Laranja
  B: '#2563eb'  // Azul
};

export class CubeState {
  constructor() {
    this.history = [];
    this.redoStack = [];
    this.reset();
  }

  reset() {
    // Array com 6 faces x 9 facetas = 54 facetas
    // Cada face contém 9 elementos com o índice da face de 0 a 5
    this.faces = {
      U: Array(9).fill('U'),
      R: Array(9).fill('R'),
      F: Array(9).fill('F'),
      D: Array(9).fill('D'),
      L: Array(9).fill('L'),
      B: Array(9).fill('B')
    };
    this.history = [];
    this.redoStack = [];
  }

  clone() {
    const clone = new CubeState();
    clone.faces = {
      U: [...this.faces.U],
      R: [...this.faces.R],
      F: [...this.faces.F],
      D: [...this.faces.D],
      L: [...this.faces.L],
      B: [...this.faces.B]
    };
    clone.history = [...this.history];
    return clone;
  }

  isSolved() {
    for (const face of FACE_NAMES) {
      const center = this.faces[face][4];
      for (let i = 0; i < 9; i++) {
        if (this.faces[face][i] !== center) {
          return false;
        }
      }
    }
    return true;
  }

  /**
   * Lista as faces (posições físicas U/R/F/D/L/B) cujas 9 facetas estão uniformes.
   * Usado para o feedback de "face completa".
   */
  getSolvedFaces() {
    const solved = [];
    for (const face of FACE_NAMES) {
      const f = this.faces[face];
      const center = f[4];
      let uniform = true;
      for (let i = 0; i < 9; i++) {
        if (f[i] !== center) { uniform = false; break; }
      }
      if (uniform) solved.push(face);
    }
    return solved;
  }

  /**
   * Define o estado a partir de um objeto com as 6 faces
   */
  setFaces(facesObj) {
    for (const face of FACE_NAMES) {
      if (facesObj[face] && Array.isArray(facesObj[face])) {
        this.faces[face] = [...facesObj[face]];
      }
    }
    this.history = [];
    this.redoStack = [];
  }

  /**
   * Define o estado a partir de uma string de 54 caracteres (U...R...F...D...L...B...)
   */
  setFrom54(str54) {
    if (!str54 || str54.length !== 54) return false;
    const order = ['U', 'R', 'F', 'D', 'L', 'B'];
    let offset = 0;
    for (const face of order) {
      this.faces[face] = str54.slice(offset, offset + 9).split('');
      offset += 9;
    }
    this.history = [];
    this.redoStack = [];
    return true;
  }

  /**
   * Valida se o estado possui exatamente 9 peças de cada cor e centros consistentes
   */
  validateState() {
    const counts = { U: 0, R: 0, F: 0, D: 0, L: 0, B: 0 };
    for (const face of FACE_NAMES) {
      for (let i = 0; i < 9; i++) {
        const color = this.faces[face][i];
        if (counts[color] !== undefined) {
          counts[color]++;
        } else {
          return { valid: false, message: `Cor desconhecida encontrada: ${color}` };
        }
      }
    }

    for (const [color, count] of Object.entries(counts)) {
      if (count !== 9) {
        return {
          valid: false,
          counts,
          message: `Contagem incorreta: a cor ${color} possui ${count} peças (esperado: 9)`
        };
      }
    }

    return { valid: true, counts, message: 'Configuração válida!' };
  }

  /**
   * Rotaciona uma face em 90 graus no sentido horário
   * Índices de uma face 3x3:
   * 0 1 2
   * 3 4 5
   * 6 7 8
   */
  rotateFaceClockwise(face) {
    const f = this.faces[face];
    const old = [...f];
    f[0] = old[6]; f[1] = old[3]; f[2] = old[0];
    f[3] = old[7]; f[4] = old[4]; f[5] = old[1];
    f[6] = old[8]; f[7] = old[5]; f[8] = old[2];
  }

  rotateFaceCounterClockwise(face) {
    const f = this.faces[face];
    const old = [...f];
    f[0] = old[2]; f[1] = old[5]; f[2] = old[8];
    f[3] = old[1]; f[4] = old[4]; f[5] = old[7];
    f[6] = old[0]; f[7] = old[3]; f[8] = old[6];
  }

  /**
   * Aplica um movimento na notação Singmaster
   */
  applyMove(move, recordHistory = true) {
    if (!move) return;

    // Normaliza variações como "U2" -> "U U"
    if (move.endsWith('2')) {
      const base = move.slice(0, -1);
      this.applyMove(base, false);
      this.applyMove(base, false);
      if (recordHistory) {
        this.history.push(move);
        this.redoStack = [];
      }
      return;
    }

    const isPrime = move.endsWith("'") || move.endsWith("’");
    const face = move.replace(/['’]/g, '');

    switch (face) {
      case 'U':
        if (!isPrime) {
          this.rotateFaceClockwise('U');
          const temp = [this.faces.F[0], this.faces.F[1], this.faces.F[2]];
          this.faces.F[0] = this.faces.R[0]; this.faces.F[1] = this.faces.R[1]; this.faces.F[2] = this.faces.R[2];
          this.faces.R[0] = this.faces.B[0]; this.faces.R[1] = this.faces.B[1]; this.faces.R[2] = this.faces.B[2];
          this.faces.B[0] = this.faces.L[0]; this.faces.B[1] = this.faces.L[1]; this.faces.B[2] = this.faces.L[2];
          this.faces.L[0] = temp[0]; this.faces.L[1] = temp[1]; this.faces.L[2] = temp[2];
        } else {
          this.rotateFaceCounterClockwise('U');
          const temp = [this.faces.F[0], this.faces.F[1], this.faces.F[2]];
          this.faces.F[0] = this.faces.L[0]; this.faces.F[1] = this.faces.L[1]; this.faces.F[2] = this.faces.L[2];
          this.faces.L[0] = this.faces.B[0]; this.faces.L[1] = this.faces.B[1]; this.faces.L[2] = this.faces.B[2];
          this.faces.B[0] = this.faces.R[0]; this.faces.B[1] = this.faces.R[1]; this.faces.B[2] = this.faces.R[2];
          this.faces.R[0] = temp[0]; this.faces.R[1] = temp[1]; this.faces.R[2] = temp[2];
        }
        break;

      case 'D':
        if (!isPrime) {
          this.rotateFaceClockwise('D');
          const temp = [this.faces.F[6], this.faces.F[7], this.faces.F[8]];
          this.faces.F[6] = this.faces.L[6]; this.faces.F[7] = this.faces.L[7]; this.faces.F[8] = this.faces.L[8];
          this.faces.L[6] = this.faces.B[6]; this.faces.L[7] = this.faces.B[7]; this.faces.L[8] = this.faces.B[8];
          this.faces.B[6] = this.faces.R[6]; this.faces.B[7] = this.faces.R[7]; this.faces.B[8] = this.faces.R[8];
          this.faces.R[6] = temp[0]; this.faces.R[7] = temp[1]; this.faces.R[8] = temp[2];
        } else {
          this.rotateFaceCounterClockwise('D');
          const temp = [this.faces.F[6], this.faces.F[7], this.faces.F[8]];
          this.faces.F[6] = this.faces.R[6]; this.faces.F[7] = this.faces.R[7]; this.faces.F[8] = this.faces.R[8];
          this.faces.R[6] = this.faces.B[6]; this.faces.R[7] = this.faces.B[7]; this.faces.R[8] = this.faces.B[8];
          this.faces.B[6] = this.faces.L[6]; this.faces.B[7] = this.faces.L[7]; this.faces.B[8] = this.faces.L[8];
          this.faces.L[6] = temp[0]; this.faces.L[7] = temp[1]; this.faces.L[8] = temp[2];
        }
        break;

      case 'L':
        if (!isPrime) {
          this.rotateFaceClockwise('L');
          const temp = [this.faces.U[0], this.faces.U[3], this.faces.U[6]];
          this.faces.U[0] = this.faces.B[8]; this.faces.U[3] = this.faces.B[5]; this.faces.U[6] = this.faces.B[2];
          this.faces.B[8] = this.faces.D[0]; this.faces.B[5] = this.faces.D[3]; this.faces.B[2] = this.faces.D[6];
          this.faces.D[0] = this.faces.F[0]; this.faces.D[3] = this.faces.F[3]; this.faces.D[6] = this.faces.F[6];
          this.faces.F[0] = temp[0]; this.faces.F[3] = temp[1]; this.faces.F[6] = temp[2];
        } else {
          this.rotateFaceCounterClockwise('L');
          const temp = [this.faces.U[0], this.faces.U[3], this.faces.U[6]];
          this.faces.U[0] = this.faces.F[0]; this.faces.U[3] = this.faces.F[3]; this.faces.U[6] = this.faces.F[6];
          this.faces.F[0] = this.faces.D[0]; this.faces.F[3] = this.faces.D[3]; this.faces.F[6] = this.faces.D[6];
          this.faces.D[0] = this.faces.B[8]; this.faces.D[3] = this.faces.B[5]; this.faces.D[6] = this.faces.B[2];
          this.faces.B[8] = temp[0]; this.faces.B[5] = temp[1]; this.faces.B[2] = temp[2];
        }
        break;

      case 'R':
        if (!isPrime) {
          this.rotateFaceClockwise('R');
          const temp = [this.faces.U[2], this.faces.U[5], this.faces.U[8]];
          this.faces.U[2] = this.faces.F[2]; this.faces.U[5] = this.faces.F[5]; this.faces.U[8] = this.faces.F[8];
          this.faces.F[2] = this.faces.D[2]; this.faces.F[5] = this.faces.D[5]; this.faces.F[8] = this.faces.D[8];
          this.faces.D[2] = this.faces.B[6]; this.faces.D[5] = this.faces.B[3]; this.faces.D[8] = this.faces.B[0];
          this.faces.B[6] = temp[0]; this.faces.B[3] = temp[1]; this.faces.B[0] = temp[2];
        } else {
          this.rotateFaceCounterClockwise('R');
          const temp = [this.faces.U[2], this.faces.U[5], this.faces.U[8]];
          this.faces.U[2] = this.faces.B[6]; this.faces.U[5] = this.faces.B[3]; this.faces.U[8] = this.faces.B[0];
          this.faces.B[6] = this.faces.D[2]; this.faces.B[3] = this.faces.D[5]; this.faces.B[0] = this.faces.D[8];
          this.faces.D[2] = this.faces.F[2]; this.faces.D[5] = this.faces.F[5]; this.faces.D[8] = this.faces.F[8];
          this.faces.F[2] = temp[0]; this.faces.F[5] = temp[1]; this.faces.F[8] = temp[2];
        }
        break;

      case 'F':
        if (!isPrime) {
          this.rotateFaceClockwise('F');
          const temp = [this.faces.U[6], this.faces.U[7], this.faces.U[8]];
          this.faces.U[6] = this.faces.L[8]; this.faces.U[7] = this.faces.L[5]; this.faces.U[8] = this.faces.L[2];
          this.faces.L[8] = this.faces.D[2]; this.faces.L[5] = this.faces.D[1]; this.faces.L[2] = this.faces.D[0];
          this.faces.D[2] = this.faces.R[0]; this.faces.D[1] = this.faces.R[3]; this.faces.D[0] = this.faces.R[6];
          this.faces.R[0] = temp[0]; this.faces.R[3] = temp[1]; this.faces.R[6] = temp[2];
        } else {
          this.rotateFaceCounterClockwise('F');
          const temp = [this.faces.U[6], this.faces.U[7], this.faces.U[8]];
          this.faces.U[6] = this.faces.R[0]; this.faces.U[7] = this.faces.R[3]; this.faces.U[8] = this.faces.R[6];
          this.faces.R[0] = this.faces.D[2]; this.faces.R[3] = this.faces.D[1]; this.faces.R[6] = this.faces.D[0];
          this.faces.D[2] = this.faces.L[8]; this.faces.D[1] = this.faces.L[5]; this.faces.D[0] = this.faces.L[2];
          this.faces.L[8] = temp[0]; this.faces.L[5] = temp[1]; this.faces.L[2] = temp[2];
        }
        break;

      case 'B':
        if (!isPrime) {
          this.rotateFaceClockwise('B');
          const temp = [this.faces.U[2], this.faces.U[1], this.faces.U[0]];
          this.faces.U[2] = this.faces.R[8]; this.faces.U[1] = this.faces.R[5]; this.faces.U[0] = this.faces.R[2];
          this.faces.R[8] = this.faces.D[6]; this.faces.R[5] = this.faces.D[7]; this.faces.R[2] = this.faces.D[8];
          this.faces.D[6] = this.faces.L[0]; this.faces.D[7] = this.faces.L[3]; this.faces.D[8] = this.faces.L[6];
          this.faces.L[0] = temp[0]; this.faces.L[3] = temp[1]; this.faces.L[6] = temp[2];
        } else {
          this.rotateFaceCounterClockwise('B');
          const temp = [this.faces.U[2], this.faces.U[1], this.faces.U[0]];
          this.faces.U[2] = this.faces.L[0]; this.faces.U[1] = this.faces.L[3]; this.faces.U[0] = this.faces.L[6];
          this.faces.L[0] = this.faces.D[6]; this.faces.L[3] = this.faces.D[7]; this.faces.L[6] = this.faces.D[8];
          this.faces.D[6] = this.faces.R[8]; this.faces.D[7] = this.faces.R[5]; this.faces.D[8] = this.faces.R[2];
          this.faces.R[8] = temp[0]; this.faces.R[5] = temp[1]; this.faces.R[2] = temp[2];
        }
        break;

      // Movimentos de Fatias (Slices)
      case 'M': // Sentido do L
        if (!isPrime) {
          // M = L' R x' (equivalente a mover fatia central no sentido L)
          const temp = [this.faces.U[1], this.faces.U[4], this.faces.U[7]];
          this.faces.U[1] = this.faces.B[7]; this.faces.U[4] = this.faces.B[4]; this.faces.U[7] = this.faces.B[1];
          this.faces.B[7] = this.faces.D[1]; this.faces.B[4] = this.faces.D[4]; this.faces.B[1] = this.faces.D[7];
          this.faces.D[1] = this.faces.F[1]; this.faces.D[4] = this.faces.F[4]; this.faces.D[7] = this.faces.F[7];
          this.faces.F[1] = temp[0]; this.faces.F[4] = temp[1]; this.faces.F[7] = temp[2];
        } else {
          const temp = [this.faces.U[1], this.faces.U[4], this.faces.U[7]];
          this.faces.U[1] = this.faces.F[1]; this.faces.U[4] = this.faces.F[4]; this.faces.U[7] = this.faces.F[7];
          this.faces.F[1] = this.faces.D[1]; this.faces.F[4] = this.faces.D[4]; this.faces.F[7] = this.faces.D[7];
          this.faces.D[1] = this.faces.B[7]; this.faces.D[4] = this.faces.B[4]; this.faces.D[7] = this.faces.B[1];
          this.faces.B[7] = temp[0]; this.faces.B[4] = temp[1]; this.faces.B[1] = temp[2];
        }
        break;

      case 'E': // Sentido do D
        if (!isPrime) {
          const temp = [this.faces.F[3], this.faces.F[4], this.faces.F[5]];
          this.faces.F[3] = this.faces.L[3]; this.faces.F[4] = this.faces.L[4]; this.faces.F[5] = this.faces.L[5];
          this.faces.L[3] = this.faces.B[3]; this.faces.L[4] = this.faces.B[4]; this.faces.L[5] = this.faces.B[5];
          this.faces.B[3] = this.faces.R[3]; this.faces.B[4] = this.faces.R[4]; this.faces.B[5] = this.faces.R[5];
          this.faces.R[3] = temp[0]; this.faces.R[4] = temp[1]; this.faces.R[5] = temp[2];
        } else {
          const temp = [this.faces.F[3], this.faces.F[4], this.faces.F[5]];
          this.faces.F[3] = this.faces.R[3]; this.faces.F[4] = this.faces.R[4]; this.faces.F[5] = this.faces.R[5];
          this.faces.R[3] = this.faces.B[3]; this.faces.R[4] = this.faces.B[4]; this.faces.R[5] = this.faces.B[5];
          this.faces.B[3] = this.faces.L[3]; this.faces.B[4] = this.faces.L[4]; this.faces.B[5] = this.faces.L[5];
          this.faces.L[3] = temp[0]; this.faces.L[4] = temp[1]; this.faces.L[5] = temp[2];
        }
        break;

      case 'S': // Sentido do F
        if (!isPrime) {
          const temp = [this.faces.U[3], this.faces.U[4], this.faces.U[5]];
          this.faces.U[3] = this.faces.L[7]; this.faces.U[4] = this.faces.L[4]; this.faces.U[5] = this.faces.L[1];
          this.faces.L[7] = this.faces.D[5]; this.faces.L[4] = this.faces.D[4]; this.faces.L[1] = this.faces.D[3];
          this.faces.D[5] = this.faces.R[1]; this.faces.D[4] = this.faces.R[4]; this.faces.D[3] = this.faces.R[7];
          this.faces.R[1] = temp[0]; this.faces.R[4] = temp[1]; this.faces.R[7] = temp[2];
        } else {
          const temp = [this.faces.U[3], this.faces.U[4], this.faces.U[5]];
          this.faces.U[3] = this.faces.R[1]; this.faces.U[4] = this.faces.R[4]; this.faces.U[5] = this.faces.R[7];
          this.faces.R[1] = this.faces.D[5]; this.faces.R[4] = this.faces.D[4]; this.faces.R[7] = this.faces.D[3];
          this.faces.D[5] = this.faces.L[7]; this.faces.D[4] = this.faces.L[4]; this.faces.D[3] = this.faces.L[1];
          this.faces.L[7] = temp[0]; this.faces.L[4] = temp[1]; this.faces.L[1] = temp[2];
        }
        break;

      // Rotações de todo o cubo nos eixos
      case 'x':
        if (!isPrime) {
          this.applyMove('R', false);
          this.applyMove("M'", false);
          this.applyMove("L'", false);
        } else {
          this.applyMove("R'", false);
          this.applyMove('M', false);
          this.applyMove('L', false);
        }
        break;

      case 'y':
        if (!isPrime) {
          this.applyMove('U', false);
          this.applyMove("E'", false);
          this.applyMove("D'", false);
        } else {
          this.applyMove("U'", false);
          this.applyMove('E', false);
          this.applyMove('D', false);
        }
        break;

      case 'z':
        if (!isPrime) {
          this.applyMove('F', false);
          this.applyMove('S', false);
          this.applyMove("B'", false);
        } else {
          this.applyMove("F'", false);
          this.applyMove("S'", false);
          this.applyMove('B', false);
        }
        break;
    }

    if (recordHistory) {
      this.history.push(move);
      this.redoStack = [];
    }
  }

  /**
   * Inverte um movimento para desfazer
   */
  getInverseMove(move) {
    if (move.endsWith('2')) return move;
    if (move.endsWith("'") || move.endsWith("’")) return move.slice(0, -1);
    return move + "'";
  }

  undo() {
    if (this.history.length === 0) return null;
    const lastMove = this.history.pop();
    const inverse = this.getInverseMove(lastMove);
    this.applyMove(inverse, false);
    this.redoStack.push(lastMove);
    return inverse;
  }

  redo() {
    if (this.redoStack.length === 0) return null;
    const move = this.redoStack.pop();
    this.applyMove(move, false);
    this.history.push(move);
    return move;
  }

  /**
   * Retorna representação de string de 54 caracteres: UUUUUUUUURRRRRRRRR...
   */
  toString54() {
    return FACE_NAMES.map(f => this.faces[f].join('')).join('');
  }
}
