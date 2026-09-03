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

const WIZARD_STEPS = [
  {
    face: 'U',
    title: 'Topo branco',
    hint: 'Aponte a face BRANCA para a câmera. A face VERDE deve ficar na parte de baixo da foto.'
  },
  {
    face: 'F',
    title: 'Frente verde',
    hint: 'Aponte a face VERDE. Mantenha o BRANCO no topo da foto.'
  },
  {
    face: 'R',
    title: 'Direita vermelha',
    hint: 'Aponte a face VERMELHA. Mantenha o BRANCO no topo da foto.'
  },
  {
    face: 'B',
    title: 'Trás azul',
    hint: 'Aponte a face AZUL. Mantenha o BRANCO no topo da foto.'
  },
  {
    face: 'L',
    title: 'Esquerda laranja',
    hint: 'Aponte a face LARANJA. Mantenha o BRANCO no topo da foto.'
  },
  {
    face: 'D',
    title: 'Base amarela',
    hint: 'Vire o cubo e aponte o AMARELO. A face VERDE deve ficar no topo da foto.'
  }
];

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

    this.wizardIndex = 0;
    this.wizardGrid = Array(9).fill(null);
    this.wizardSelectedCell = -1;
    this.wizardStream = null;
    this.wizardLive = false;
    this.wizardRaf = 0;
    this.wizardConfirmed = { U: false, L: false, F: false, R: false, B: false, D: false };

    this.initElements();
    this.bindEvents();
    this.render2DNet();
    this.updateStatsAndValidation();
    this.renderWizard();
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

    this.btnApplyScan = document.getElementById('btn-apply-scan');
    this.wizardStepsEl = document.getElementById('wizard-steps');
    this.wizardFaceDot = document.getElementById('wizard-face-dot');
    this.wizardFaceTitle = document.getElementById('wizard-face-title');
    this.wizardFaceHint = document.getElementById('wizard-face-hint');
    this.wizardVideo = document.getElementById('wizard-video');
    this.wizardFreeze = document.getElementById('wizard-freeze');
    this.wizardIdle = document.getElementById('wizard-idle');
    this.wizardGridOverlay = document.getElementById('wizard-grid-overlay');
    this.wizardColorGrid = document.getElementById('wizard-color-grid');
    this.wizardPalette = document.getElementById('wizard-palette');
    this.wizardStatus = document.getElementById('wizard-status');
    this.btnWizardPrev = document.getElementById('btn-wizard-prev');
    this.btnWizardCamera = document.getElementById('btn-wizard-camera');
    this.btnWizardCapture = document.getElementById('btn-wizard-capture');
    this.btnWizardFile = document.getElementById('btn-wizard-file');
    this.wizardFileInput = document.getElementById('wizard-file-input');
    this.btnWizardNext = document.getElementById('btn-wizard-next');
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

    if (this.btnApplyAndSolve) {
      this.btnApplyAndSolve.addEventListener('click', () => this.applyAndSolve(true));
    }
    if (this.btnApplyScan) {
      this.btnApplyScan.addEventListener('click', () => this.applyAndSolve(false));
    }

    if (this.btnWizardPrev) {
      this.btnWizardPrev.addEventListener('click', () => this.wizardGo(-1));
    }
    if (this.btnWizardNext) {
      this.btnWizardNext.addEventListener('click', () => this.confirmWizardFace());
    }
    if (this.btnWizardCamera) {
      this.btnWizardCamera.addEventListener('click', () => this.startWizardCamera());
    }
    if (this.btnWizardCapture) {
      this.btnWizardCapture.addEventListener('click', () => this.captureWizardFrame());
    }
    if (this.btnWizardFile && this.wizardFileInput) {
      this.btnWizardFile.addEventListener('click', () => this.wizardFileInput.click());
      this.wizardFileInput.addEventListener('change', (e) => this.handleWizardFile(e));
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
    this.renderWizard();
    this.switchTab('camera');
    if (this.modal) this.modal.classList.remove('hidden');
    createIcons({ icons });
  }

  close() {
    this.stopWizardCamera();
    if (this.modal) this.modal.classList.add('hidden');
  }

  switchTab(tabName) {
    if (tabName !== 'camera') {
      this.wizardLive = false;
    }
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

  currentWizardStep() {
    return WIZARD_STEPS[this.wizardIndex];
  }

  renderWizard() {
    const step = this.currentWizardStep();
    if (!step) return;

    if (this.wizardStepsEl) {
      this.wizardStepsEl.innerHTML = WIZARD_STEPS.map((s, i) => {
        const done = this.wizardConfirmed[s.face];
        const current = i === this.wizardIndex;
        const cls = current ? 'is-current' : done ? 'is-done' : '';
        return `<li class="${cls}">${i + 1}. ${s.face}</li>`;
      }).join('');
    }

    if (this.wizardFaceDot) {
      this.wizardFaceDot.style.background = COLOR_HEX_MAP[step.face];
    }
    if (this.wizardFaceTitle) {
      this.wizardFaceTitle.textContent = `${this.wizardIndex + 1}/6 · ${step.title}`;
    }
    if (this.wizardFaceHint) {
      this.wizardFaceHint.textContent = step.hint;
    }

    if (this.wizardGridOverlay && this.wizardGridOverlay.childElementCount !== 9) {
      this.wizardGridOverlay.innerHTML = Array.from({ length: 9 }, () => '<span></span>').join('');
    }

    if (this.wizardPalette && this.wizardPalette.childElementCount === 0) {
      this.wizardPalette.innerHTML = FACE_NAMES.map((color) => `
        <button type="button" class="color-palette-chip" data-color="${color}"
          style="background:${COLOR_HEX_MAP[color]}; width:28px; height:28px; border-radius:50%; border:2px solid rgba(15,23,42,0.2);"
          title="${COLOR_LABELS[color]}"></button>
      `).join('');
      this.wizardPalette.querySelectorAll('button').forEach((btn) => {
        btn.addEventListener('click', () => {
          if (this.wizardSelectedCell < 0) this.wizardSelectedCell = 0;
          this.wizardGrid[this.wizardSelectedCell] = btn.getAttribute('data-color');
          this.paintWizardGrid();
        });
      });
    }

    const stored = this.detectedGrids[step.face];
    if (stored) {
      this.wizardGrid = [...stored];
    } else {
      this.wizardGrid = Array(9).fill(null);
    }
    this.paintWizardGrid();
    this.updateWizardButtons();
    createIcons({ icons });
  }

  paintWizardGrid() {
    if (!this.wizardColorGrid) return;
    const step = this.currentWizardStep();
    if (step) this.wizardGrid[4] = step.face;

    if (this.wizardColorGrid.childElementCount !== 9) {
      this.wizardColorGrid.innerHTML = '';
      for (let i = 0; i < 9; i++) {
        const cell = document.createElement('button');
        cell.type = 'button';
        cell.className = 'wizard-color-cell';
        if (i === 4) cell.classList.add('is-center');
        cell.addEventListener('click', () => {
          this.wizardSelectedCell = i;
          this.paintWizardGrid();
        });
        this.wizardColorGrid.appendChild(cell);
      }
    }

    const cells = this.wizardColorGrid.children;
    for (let i = 0; i < 9; i++) {
      const color = this.wizardGrid[i];
      const cell = cells[i];
      cell.classList.toggle('is-selected', i === this.wizardSelectedCell);
      cell.style.background = color ? COLOR_HEX_MAP[color] : '#cbd5e1';
      cell.title = color ? COLOR_LABELS[color] : 'sem cor';
    }

    const ready = this.wizardGrid.every(Boolean);
    if (this.btnWizardNext) this.btnWizardNext.disabled = !ready;
  }

  updateWizardButtons() {
    if (this.btnWizardPrev) this.btnWizardPrev.disabled = this.wizardIndex === 0;
    if (this.btnWizardCapture) this.btnWizardCapture.disabled = !this.wizardLive;
  }

  setWizardStatus(message) {
    if (this.wizardStatus) this.wizardStatus.textContent = message;
  }

  wizardGo(delta) {
    const next = this.wizardIndex + delta;
    if (next < 0 || next >= WIZARD_STEPS.length) return;
    this.wizardIndex = next;
    this.wizardSelectedCell = -1;
    this.renderWizard();
  }

  async startWizardCamera() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      this.setWizardStatus('Este navegador não permite câmera. Use “Usar foto” e envie uma imagem da face.');
      return;
    }

    try {
      this.stopWizardCamera();
      this.wizardStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 720 }, height: { ideal: 720 } },
        audio: false
      });
      if (this.wizardVideo) {
        this.wizardVideo.srcObject = this.wizardStream;
        await this.wizardVideo.play();
      }
      if (this.wizardFreeze) this.wizardFreeze.classList.add('hidden');
      if (this.wizardIdle) this.wizardIdle.classList.add('hidden');
      this.wizardLive = true;
      this.updateWizardButtons();
      this.setWizardStatus('Enquadre a face no quadrado. As 9 cores atualizam ao vivo — depois toque em Capturar.');
      this.loopWizardPreview();
    } catch (err) {
      this.setWizardStatus('Não foi possível abrir a câmera. Permita o acesso ou envie uma foto.');
      console.warn(err);
    }
  }

  stopWizardCamera() {
    this.wizardLive = false;
    if (this.wizardRaf) {
      cancelAnimationFrame(this.wizardRaf);
      this.wizardRaf = 0;
    }
    if (this.wizardStream) {
      this.wizardStream.getTracks().forEach((track) => track.stop());
      this.wizardStream = null;
    }
    if (this.wizardVideo) this.wizardVideo.srcObject = null;
    this.updateWizardButtons();
  }

  loopWizardPreview() {
    if (!this.wizardLive || !this.wizardVideo) return;
    const video = this.wizardVideo;
    if (video.readyState >= 2 && video.videoWidth > 0) {
      try {
        this.wizardGrid = CubeImageScanner.extractGridColors(video);
        this.paintWizardGrid();
      } catch {
        /* frame ainda não está pronto */
      }
    }
    this.wizardRaf = requestAnimationFrame(() => this.loopWizardPreview());
  }

  captureWizardFrame() {
    if (!this.wizardVideo || !this.wizardLive) return;
    this.wizardLive = false;
    if (this.wizardRaf) cancelAnimationFrame(this.wizardRaf);

    const video = this.wizardVideo;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 480;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.9);

    this.wizardGrid = CubeImageScanner.extractGridColors(video);
    this.paintWizardGrid();

    if (this.wizardFreeze) {
      this.wizardFreeze.src = dataUrl;
      this.wizardFreeze.classList.remove('hidden');
    }

    const step = this.currentWizardStep();
    this.facePhotos[step.face] = dataUrl;
    this.detectedGrids[step.face] = [...this.wizardGrid];
    this.setWizardStatus('Foto congelada. Toque numa célula e numa cor se precisar corrigir, depois confirme.');
    this.updateWizardButtons();
  }

  handleWizardFile(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (e) => {
      const src = e.target.result;
      this.stopWizardCamera();
      if (this.wizardIdle) this.wizardIdle.classList.add('hidden');
      if (this.wizardFreeze) {
        this.wizardFreeze.src = src;
        this.wizardFreeze.classList.remove('hidden');
      }
      try {
        const result = await CubeImageScanner.scanFaceImage(src);
        this.wizardGrid = result.grid;
        this.paintWizardGrid();
        const step = this.currentWizardStep();
        this.facePhotos[step.face] = src;
        this.detectedGrids[step.face] = [...this.wizardGrid];
        this.setWizardStatus('Foto lida. Corrija as cores se alguma estiver errada e confirme a face.');
      } catch (err) {
        this.setWizardStatus(err.message || 'Falha ao ler a foto.');
      }
    };
    reader.readAsDataURL(file);
    event.target.value = '';
  }

  async confirmWizardFace() {
    if (!this.wizardGrid.every(Boolean)) return;
    const step = this.currentWizardStep();
    this.scannedFaces[step.face] = [...this.wizardGrid];
    this.detectedGrids[step.face] = [...this.wizardGrid];
    this.wizardConfirmed[step.face] = true;
    this.render2DNet();
    this.updateStatsAndValidation();

    if (this.wizardIndex < WIZARD_STEPS.length - 1) {
      this.wizardIndex += 1;
      this.wizardSelectedCell = -1;
      if (this.wizardFreeze) this.wizardFreeze.classList.add('hidden');
      this.renderWizard();
      this.setWizardStatus(`Face ${step.face} ok. Agora fotografe: ${this.currentWizardStep().title}.`);
      if (this.wizardStream && this.wizardVideo) {
        this.wizardLive = true;
        this.updateWizardButtons();
        this.loopWizardPreview();
      } else if (this.wizardIdle) {
        this.wizardIdle.classList.remove('hidden');
      }
      return;
    }

    const missing = ALL_FACES.filter((f) => !this.scannedFaces[f] || this.scannedFaces[f].length !== 9);
    if (missing.length) {
      this.setWizardStatus(`Ainda faltam faces: ${missing.join(', ')}.`);
      return;
    }

    this.stopWizardCamera();
    this.switchTab('editor2d');
    this.setWizardStatus('As 6 faces foram lidas. Confira o mapa 2D e aplique no cubo 3D.');
  }

  /**
   * Aplica o estado ao cubo 3D e opcionalmente dispara o solucionador.
   */
  applyAndSolve(startSolver = true) {
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

    try {
      this.cubeState.setFaces(this.scannedFaces);
    } catch (err) {
      alert(err.message || 'Não foi possível aplicar este cubo.');
      return;
    }
    this.cubeView.applyState(this.cubeState);
    this.close();
    this.onApplyState(startSolver);
  }
}
