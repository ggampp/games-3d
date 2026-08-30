/**
 * CubeScanModal.js
 * Controlador do Modal de Escaneamento e Importação de Fotos dos 6 Lados do Cubo Real
 */

import { createIcons, icons } from 'lucide';
import { CubeImageScanner } from './CubeImageScanner.js';
import { FACE_NAMES } from '../cube/CubeState.js';
import { analyzeSixFacePhotos } from './scanSixFacesClient.js';
import { getExampleSixFacePhotos, COLOR_HEX_MAP } from './exampleSixFaceData.js';
import { countColors, validateSixFaces } from './sixFacesReconstructor.js';

export { COLOR_HEX_MAP };

export const COLOR_LABELS = {
  U: 'Branco',
  D: 'Amarelo',
  F: 'Verde',
  B: 'Azul',
  R: 'Vermelho',
  L: 'Laranja'
};

const ALL_FACES = ['U', 'L', 'F', 'R', 'B', 'D'];

export class CubeScanModal {
  constructor({ cubeState, cubeView, onApplyState }) {
    this.cubeState = cubeState;
    this.cubeView = cubeView;
    this.onApplyState = onApplyState || (() => {});

    this.activeColor = 'U'; // Cor selecionada na paleta do Editor 2D

    // Estado local das 54 facetas
    this.scannedFaces = {
      U: [...this.cubeState.faces.U],
      D: [...this.cubeState.faces.D],
      F: [...this.cubeState.faces.F],
      B: [...this.cubeState.faces.B],
      R: [...this.cubeState.faces.R],
      L: [...this.cubeState.faces.L]
    };

    // Estado das 6 fotos
    this.facePhotos = { U: null, L: null, F: null, R: null, B: null, D: null };
    this.faceRotations = { U: 0, L: 0, F: 0, R: 0, B: 0, D: 0 };
    this.detectedGrids = { U: null, L: null, F: null, R: null, B: null, D: null };
    this.isExampleLoaded = false;

    this.initElements();
    this.bindEvents();
    this.render2DNet();
    this.updateStatsAndValidation();
  }

  initElements() {
    this.modal = document.getElementById('scan-modal');
    this.btnOpenScan = document.getElementById('btn-scan-cube');
    this.btnOpenScanHeader = document.getElementById('btn-scan-cube-header');
    this.btnCloseModal = document.getElementById('btn-close-scan-modal');
    this.btnApplyAndSolve = document.getElementById('btn-apply-scan-solve');
    this.btnResetScan = document.getElementById('btn-reset-scan');

    // Abas
    this.tabButtons = document.querySelectorAll('.scan-tab-btn');
    this.tabContents = document.querySelectorAll('.scan-tab-pane');

    // Ações de topo 6 faces
    this.btnLoadSixExample = document.getElementById('btn-load-six-example');
    this.btnBatchUploadTrigger = document.getElementById('btn-batch-upload-trigger');
    this.inputBatchPhotos = document.getElementById('batch-photos-input');
    this.btnClearAllPhotos = document.getElementById('btn-clear-all-photos');

    // Elementos das 6 faces
    this.faceElements = {};
    for (const face of ALL_FACES) {
      this.faceElements[face] = {
        card: document.querySelector(`.face-card[data-face="${face}"]`),
        img: document.getElementById(`face-img-${face}`),
        ph: document.getElementById(`ph-face-${face}`),
        badge: document.getElementById(`badge-face-${face}`),
        miniGrid: document.getElementById(`mini-grid-${face}`),
        fileInput: document.getElementById(`file-input-${face}`),
        btnUpload: document.querySelector(`.btn-face-upload[data-face="${face}"]`),
        btnRotate: document.querySelector(`.btn-face-rotate[data-face="${face}"]`),
        btnRemove: document.querySelector(`.btn-face-remove[data-face="${face}"]`)
      };
    }

    // Status e Análise 6 Faces
    this.sixFacesStatus = document.getElementById('six-faces-status');
    this.btnAnalyzeSixFaces = document.getElementById('btn-analyze-six-faces');

    // Paleta de Cores e Editor 2D
    this.paletteButtons = document.querySelectorAll('.color-palette-chip');
    this.netContainer = document.getElementById('cube-2d-net');
    this.validationBadge = document.getElementById('scan-validation-badge');
    this.colorCountsContainer = document.getElementById('scan-color-counts');
  }

  bindEvents() {
    if (this.btnOpenScan) {
      this.btnOpenScan.addEventListener('click', () => this.open());
    }
    if (this.btnOpenScanHeader) {
      this.btnOpenScanHeader.addEventListener('click', () => this.open());
    }
    if (this.btnCloseModal) {
      this.btnCloseModal.addEventListener('click', () => this.close());
    }

    // Alternar Abas (6 Fotos vs Editor 2D)
    this.tabButtons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const tab = e.currentTarget.getAttribute('data-tab');
        this.switchTab(tab);
      });
    });

    // Seletor de cor ativa na paleta
    this.paletteButtons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const color = e.currentTarget.getAttribute('data-color');
        this.setActiveColor(color);
      });
    });

    // Botão de Exemplo 6 Faces
    if (this.btnLoadSixExample) {
      this.btnLoadSixExample.addEventListener('click', () => this.loadSixFaceExample());
    }

    // Upload em lote (múltiplas fotos)
    if (this.btnBatchUploadTrigger && this.inputBatchPhotos) {
      this.btnBatchUploadTrigger.addEventListener('click', () => this.inputBatchPhotos.click());
      this.inputBatchPhotos.addEventListener('change', (e) => this.handleBatchFiles(e));
    }

    // Limpar fotos
    if (this.btnClearAllPhotos) {
      this.btnClearAllPhotos.addEventListener('click', () => this.clearAllPhotos());
    }

    // Eventos individuais de cada Face Card
    for (const face of ALL_FACES) {
      const el = this.faceElements[face];
      if (!el) continue;

      if (el.btnUpload && el.fileInput) {
        el.btnUpload.addEventListener('click', () => el.fileInput.click());
        el.fileInput.addEventListener('change', (e) => this.handleFaceFile(face, e));
      }

      if (el.btnRotate) {
        el.btnRotate.addEventListener('click', () => this.rotateFacePhoto(face));
      }

      if (el.btnRemove) {
        el.btnRemove.addEventListener('click', () => this.clearFacePhoto(face));
      }

      // Permitir clicar no placeholder para disparar upload
      if (el.ph && el.fileInput) {
        el.ph.addEventListener('click', () => el.fileInput.click());
      }
    }

    // Analisar e Montar Cubo dos 6 Lados
    if (this.btnAnalyzeSixFaces) {
      this.btnAnalyzeSixFaces.addEventListener('click', () => this.analyzeAllSixFaces());
    }

    // Resetar edição no Editor 2D
    if (this.btnResetScan) {
      this.btnResetScan.addEventListener('click', () => {
        this.scannedFaces = {
          U: Array(9).fill('U'),
          D: Array(9).fill('D'),
          F: Array(9).fill('F'),
          B: Array(9).fill('B'),
          R: Array(9).fill('R'),
          L: Array(9).fill('L')
        };
        this.render2DNet();
        this.updateStatsAndValidation();
      });
    }

    // Aplicar e Iniciar Solução
    if (this.btnApplyAndSolve) {
      this.btnApplyAndSolve.addEventListener('click', () => this.applyAndSolve());
    }
  }

  open() {
    this.scannedFaces = {
      U: [...this.cubeState.faces.U],
      D: [...this.cubeState.faces.D],
      F: [...this.cubeState.faces.F],
      B: [...this.cubeState.faces.B],
      R: [...this.cubeState.faces.R],
      L: [...this.cubeState.faces.L]
    };

    this.render2DNet();
    this.updateStatsAndValidation();
    if (this.modal) this.modal.classList.remove('hidden');
    createIcons({ icons });
  }

  close() {
    if (this.modal) this.modal.classList.add('hidden');
  }

  switchTab(tabName) {
    this.tabButtons.forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-tab') === tabName);
    });
    this.tabContents.forEach(pane => {
      pane.classList.toggle('active', pane.getAttribute('data-pane') === tabName);
      pane.classList.toggle('hidden', pane.getAttribute('data-pane') !== tabName);
    });
    createIcons({ icons });
  }

  setActiveColor(color) {
    this.activeColor = color;
    this.paletteButtons.forEach(btn => {
      btn.classList.toggle('selected', btn.getAttribute('data-color') === color);
    });
  }

  setSixFacesStatus(message, kind = '') {
    if (!this.sixFacesStatus) return;
    this.sixFacesStatus.className = `six-faces-status${kind ? ` is-${kind}` : ''}`;
    this.sixFacesStatus.textContent = message;
  }

  refreshAnalyzeButton() {
    const loadedCount = ALL_FACES.filter(f => Boolean(this.facePhotos[f])).length;
    if (this.btnAnalyzeSixFaces) {
      this.btnAnalyzeSixFaces.disabled = loadedCount === 0;
    }
  }

  /**
   * Define a foto de uma face específica e executa a extração em tempo real
   */
  async setFaceImage(face, src) {
    this.facePhotos[face] = src;
    const el = this.faceElements[face];
    if (!el) return;

    if (el.img) {
      el.img.src = src;
      el.img.style.transform = `rotate(${this.faceRotations[face]}deg)`;
      el.img.classList.remove('hidden');
    }
    if (el.ph) el.ph.classList.add('hidden');
    if (el.badge) {
      el.badge.textContent = 'Carregada';
      el.badge.className = 'face-status-badge is-loaded';
    }

    // Extrai as cores em tempo real via Computer Vision
    try {
      const result = await CubeImageScanner.scanFaceImage(src, {
        rotation: this.faceRotations[face]
      });
      this.detectedGrids[face] = result.grid;
      this.renderMiniGrid(face, result.grid);
      if (el.badge) {
        el.badge.textContent = 'Extraída ✔';
        el.badge.className = 'face-status-badge is-scanned';
      }
    } catch (err) {
      console.warn(`Erro ao extrair face ${face}:`, err);
    }

    this.updateUploadProgressStatus();
    this.refreshAnalyzeButton();
  }

  /**
   * Renderiza a mini-grade 3x3 sobre o card da face
   */
  renderMiniGrid(face, grid) {
    const el = this.faceElements[face];
    if (!el || !el.miniGrid || !grid) return;

    el.miniGrid.innerHTML = grid.map((colorKey, i) => `
      <div class="mini-grid-cell" style="background-color: ${COLOR_HEX_MAP[colorKey] || '#fff'};" title="${face}[${i}]: ${COLOR_LABELS[colorKey] || colorKey}"></div>
    `).join('');
    el.miniGrid.classList.remove('hidden');
  }

  /**
   * Gira a foto da face em 90° e re-analisa
   */
  async rotateFacePhoto(face) {
    if (!this.facePhotos[face]) return;
    this.faceRotations[face] = (this.faceRotations[face] + 90) % 360;

    const el = this.faceElements[face];
    if (el && el.img) {
      el.img.style.transform = `rotate(${this.faceRotations[face]}deg)`;
    }

    try {
      const result = await CubeImageScanner.scanFaceImage(this.facePhotos[face], {
        rotation: this.faceRotations[face]
      });
      this.detectedGrids[face] = result.grid;
      this.renderMiniGrid(face, result.grid);
    } catch (err) {
      console.warn(`Erro ao girar face ${face}:`, err);
    }
  }

  /**
   * Limpa a foto de uma face
   */
  clearFacePhoto(face) {
    this.facePhotos[face] = null;
    this.faceRotations[face] = 0;
    this.detectedGrids[face] = null;

    const el = this.faceElements[face];
    if (!el) return;

    if (el.img) {
      el.img.src = '';
      el.img.classList.add('hidden');
    }
    if (el.ph) el.ph.classList.remove('hidden');
    if (el.badge) {
      el.badge.textContent = 'Vazia';
      el.badge.className = 'face-status-badge';
    }
    if (el.miniGrid) {
      el.miniGrid.innerHTML = '';
      el.miniGrid.classList.add('hidden');
    }
    if (el.fileInput) {
      el.fileInput.value = '';
    }

    this.updateUploadProgressStatus();
    this.refreshAnalyzeButton();
  }

  /**
   * Limpa todas as fotos
   */
  clearAllPhotos() {
    for (const face of ALL_FACES) {
      this.clearFacePhoto(face);
    }
    this.isExampleLoaded = false;
    this.setSixFacesStatus('Todas as fotos foram removidas. Adicione novas fotos das 6 faces.');
  }

  /**
   * Atualiza mensagem informativa de progresso do upload
   */
  updateUploadProgressStatus() {
    const loadedCount = ALL_FACES.filter(f => Boolean(this.facePhotos[f])).length;
    if (loadedCount === 6) {
      this.setSixFacesStatus('✔ Todas as 6 fotos foram adicionadas! Clique em "Analisar e Montar Cubo dos 6 Lados".', 'ok');
    } else if (loadedCount > 0) {
      const missing = ALL_FACES.filter(f => !this.facePhotos[f]);
      this.setSixFacesStatus(`${loadedCount} de 6 fotos adicionadas. Faltam: ${missing.map(f => `${f} (${COLOR_LABELS[f]})`).join(', ')}.`);
    } else {
      this.setSixFacesStatus('Adicione as 6 fotos ou clique em "Carregar 6 fotos de exemplo" para testar.');
    }
  }

  /**
   * Trata upload de arquivo individual
   */
  handleFaceFile(face, event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;

    this.isExampleLoaded = false;
    const reader = new FileReader();
    reader.onload = (e) => {
      this.setFaceImage(face, e.target.result);
    };
    reader.readAsDataURL(file);
  }

  /**
   * Trata upload em lote (múltiplas fotos)
   */
  handleBatchFiles(event) {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;

    this.isExampleLoaded = false;
    // Preenche as faces que estiverem vazias ou na sequência U, L, F, R, B, D
    const targetFaces = ALL_FACES.filter(f => !this.facePhotos[f]);
    const queue = targetFaces.length >= files.length ? targetFaces : ALL_FACES;

    files.forEach((file, index) => {
      const face = queue[index];
      if (!face) return;
      const reader = new FileReader();
      reader.onload = (e) => {
        this.setFaceImage(face, e.target.result);
      };
      reader.readAsDataURL(file);
    });

    if (this.inputBatchPhotos) this.inputBatchPhotos.value = '';
  }

  /**
   * Carrega o conjunto de 6 fotos de exemplo
   */
  async loadSixFaceExample() {
    this.isExampleLoaded = true;
    this.setSixFacesStatus('Carregando 6 fotos de exemplo...', 'busy');

    const examplePhotos = getExampleSixFacePhotos();
    for (const face of ALL_FACES) {
      await this.setFaceImage(face, examplePhotos[face]);
    }

    this.setSixFacesStatus('6 fotos de exemplo carregadas. Analisando e validando cubo virtual...', 'busy');
    await this.analyzeAllSixFaces();
  }

  /**
   * Analisa todas as 6 faces e monta o cubo
   */
  async analyzeAllSixFaces() {
    const loadedCount = ALL_FACES.filter(f => Boolean(this.facePhotos[f])).length;
    if (loadedCount === 0) {
      this.setSixFacesStatus('Adicione as fotos das faces antes de analisar.', 'error');
      return;
    }

    if (this.btnAnalyzeSixFaces) this.btnAnalyzeSixFaces.disabled = true;
    this.setSixFacesStatus('Processando as 6 imagens e conferindo consistência geométrica...', 'busy');

    try {
      const result = await analyzeSixFacePhotos(
        this.facePhotos,
        this.faceRotations,
        { allowExampleFixture: this.isExampleLoaded }
      );

      if (result.faces) {
        this.scannedFaces = {
          U: [...result.faces.U],
          D: [...result.faces.D],
          F: [...result.faces.F],
          B: [...result.faces.B],
          R: [...result.faces.R],
          L: [...result.faces.L]
        };
        this.render2DNet();
        this.updateStatsAndValidation();
      }

      const counts = countColors(this.scannedFaces);
      const countLine = ALL_FACES.map((c) => `${c}:${counts[c]}`).join('  ');
      const provName = result.provider || 'Visão Computacional';
      const warn = (result.warnings || []).join('\n');

      let verdict = '';
      if (result.solvable) {
        verdict = '✔ Cubo 100% Válido e Solucionável! Veja o mapa 2D e clique em "Aplicar no 3D e Resolver".';
      } else if (result.legal) {
        verdict = 'Contagem e peças válidas (9 de cada cor). Confira o mapa 2D antes de resolver.';
      } else {
        verdict = 'Leitura concluída. Algumas cores podem precisar de pequeno ajuste no Editor 2D.';
      }

      this.setSixFacesStatus(
        `${verdict}\nMétodo: ${provName}\nContagem de facetas: ${countLine}${warn ? `\n${warn}` : ''}`,
        result.solvable ? 'ok' : (result.legal ? '' : 'error')
      );

      this.switchTab('editor2d');
      createIcons({ icons });
    } catch (err) {
      this.setSixFacesStatus(err.message || 'Falha ao processar as fotos das 6 faces.', 'error');
    } finally {
      this.refreshAnalyzeButton();
    }
  }

  /**
   * Renderiza a grade 2D em formato de cruz clássica do Cubo Desdobrado
   */
  render2DNet() {
    if (!this.netContainer) return;

    const layout = [
      { face: 'U', label: 'U (Topo / Branco)', row: 1, col: 2 },
      { face: 'L', label: 'L (Esq / Laranja)', row: 2, col: 1 },
      { face: 'F', label: 'F (Frente / Verde)', row: 2, col: 2 },
      { face: 'R', label: 'R (Dir / Vermelho)', row: 2, col: 3 },
      { face: 'B', label: 'B (Trás / Azul)', row: 2, col: 4 },
      { face: 'D', label: 'D (Base / Amarelo)', row: 3, col: 2 }
    ];

    this.netContainer.innerHTML = '';

    layout.forEach(({ face, label, row, col }) => {
      const faceBlock = document.createElement('div');
      faceBlock.className = `net-face-block net-face-${face.toLowerCase()}`;
      faceBlock.style.gridRow = row;
      faceBlock.style.gridColumn = col;

      const title = document.createElement('div');
      title.className = 'net-face-title';
      title.innerText = face;
      title.title = label;
      faceBlock.appendChild(title);

      const grid = document.createElement('div');
      grid.className = 'net-facelet-grid';

      for (let i = 0; i < 9; i++) {
        const colorKey = this.scannedFaces[face][i] || face;
        const faceletBtn = document.createElement('button');
        faceletBtn.type = 'button';
        faceletBtn.className = 'net-facelet';
        faceletBtn.style.backgroundColor = COLOR_HEX_MAP[colorKey] || '#ffffff';
        faceletBtn.title = `${face}[${i}]: ${COLOR_LABELS[colorKey]}`;

        if (i === 4) {
          faceletBtn.classList.add('center-facelet');
        }

        faceletBtn.addEventListener('click', () => {
          this.scannedFaces[face][i] = this.activeColor;
          faceletBtn.style.backgroundColor = COLOR_HEX_MAP[this.activeColor];
          faceletBtn.title = `${face}[${i}]: ${COLOR_LABELS[this.activeColor]}`;
          this.updateStatsAndValidation();
        });

        grid.appendChild(faceletBtn);
      }

      faceBlock.appendChild(grid);
      this.netContainer.appendChild(faceBlock);
    });
  }

  /**
   * Atualiza a contagem das 6 cores e a validação do cubo
   */
  updateStatsAndValidation() {
    const counts = { U: 0, D: 0, F: 0, B: 0, R: 0, L: 0 };

    for (const face of FACE_NAMES) {
      for (let i = 0; i < 9; i++) {
        const c = this.scannedFaces[face][i];
        if (counts[c] !== undefined) counts[c]++;
      }
    }

    if (this.colorCountsContainer) {
      this.colorCountsContainer.innerHTML = Object.entries(counts).map(([color, count]) => {
        const isExact = count === 9;
        return `
          <div class="count-chip ${isExact ? 'count-ok' : 'count-warn'}">
            <span class="dot" style="background-color: ${COLOR_HEX_MAP[color]}; border: 1px solid rgba(0,0,0,0.2);"></span>
            <strong>${color}:</strong> ${count}/9
          </div>
        `;
      }).join('');
    }

    const isAllNine = Object.values(counts).every(c => c === 9);

    if (this.validationBadge) {
      if (isAllNine) {
        this.validationBadge.className = 'scan-validation-badge valid';
        this.validationBadge.innerHTML = '✔ Cubo 100% Válido! Pronto para resolver.';
        if (this.btnApplyAndSolve) this.btnApplyAndSolve.disabled = false;
      } else {
        this.validationBadge.className = 'scan-validation-badge invalid';
        this.validationBadge.innerHTML = '⚠️ Ajuste as cores no Editor 2D (cada uma das 6 cores deve ter exatamente 9 peças).';
      }
    }
  }

  /**
   * Aplica o estado ao cubo 3D e dispara o solucionador Kociemba
   */
  applyAndSolve() {
    const counts = { U: 0, D: 0, F: 0, B: 0, R: 0, L: 0 };
    for (const face of FACE_NAMES) {
      for (let i = 0; i < 9; i++) {
        const c = this.scannedFaces[face][i];
        if (counts[c] !== undefined) counts[c]++;
      }
    }

    const isAllNine = Object.values(counts).every(c => c === 9);
    if (!isAllNine) {
      const confirmContinue = confirm(
        'Atenção: A contagem de algumas cores não está em 9 peças. Deseja aplicar assim mesmo?'
      );
      if (!confirmContinue) return;
    }

    this.cubeState.setFaces(this.scannedFaces);
    this.cubeView.applyState(this.cubeState);
    this.close();
    this.onApplyState();
  }
}
