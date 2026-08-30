/**
 * CubeView3D.js
 * Gerenciador de renderização Three.js, cena 3D, animações de rotação com pivot,
 * detecção de gestos (Raycasting no próprio cubo) e controles de câmera.
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { createCubieGeometry, createStickerGeometry, createCubieMaterials, THEMES } from './CubeGeometry.js';
import { sounds } from '../audio/SoundEffects.js';

export class CubeView3D {
  constructor(containerElement, onMoveExecuted = null) {
    this.container = containerElement;
    this.onMoveExecuted = onMoveExecuted;

    this.currentTheme = 'classic';
    this.currentStyle = 'stickerless';
    this.animDuration = 220; // ms

    this.cubies = [];
    this.isAnimating = false;
    this.moveQueue = [];

    // Raycasting & Drag Interaction
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
    this.dragStartPos = new THREE.Vector2();
    this.dragIntersection = null;
    this.isDraggingFace = false;

    this.initScene();
    this.initLights();
    this.initFloor();
    this.buildCube();
    this.initInteractions();
    this.animate();
  }

  initScene() {
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(
      42,
      this.container.clientWidth / this.container.clientHeight,
      0.1,
      100
    );
    this.camera.position.set(-4.8, 3.8, -5.0);

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance'
    });
    this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;

    this.container.appendChild(this.renderer.domElement);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.minDistance = 3.5;
    this.controls.maxDistance = 14;
    this.controls.rotateSpeed = 0.85;
    this.controls.target.set(0, 0, 0);

    this.cubeGroup = new THREE.Group();
    this.scene.add(this.cubeGroup);

    window.addEventListener('resize', this.onResize.bind(this));
  }

  initLights() {
    // Luz ambiente suave e neutra
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.25);
    this.scene.add(ambientLight);

    // Luz principal com sombra projetada suave
    const keyLight = new THREE.DirectionalLight(0xffffff, 1.5);
    keyLight.position.set(6, 10, 8);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 2048;
    keyLight.shadow.mapSize.height = 2048;
    keyLight.shadow.camera.near = 0.5;
    keyLight.shadow.camera.far = 25;
    keyLight.shadow.camera.left = -5;
    keyLight.shadow.camera.right = 5;
    keyLight.shadow.camera.top = 5;
    keyLight.shadow.camera.bottom = -5;
    keyLight.shadow.bias = -0.0005;
    this.scene.add(keyLight);

    // Luzes de preenchimento de estúdio neutras para visualização perfeita de todas as 6 faces
    const fillLightLeft = new THREE.DirectionalLight(0xffffff, 0.95);
    fillLightLeft.position.set(-7, 6, 6);
    this.scene.add(fillLightLeft);

    const fillLightBack = new THREE.DirectionalLight(0xffffff, 0.85);
    fillLightBack.position.set(5, 5, -7);
    this.scene.add(fillLightBack);

    const fillLightRearLeft = new THREE.DirectionalLight(0xffffff, 0.65);
    fillLightRearLeft.position.set(-6, -3, -6);
    this.scene.add(fillLightRearLeft);

    // Luz suave refletida de baixo
    const bounceLight = new THREE.DirectionalLight(0xffffff, 0.35);
    bounceLight.position.set(0, -6, 0);
    this.scene.add(bounceLight);
  }

  initFloor() {
    // Piso de estúdio sutil com sombra de contato elegante
    const floorGeo = new THREE.PlaneGeometry(18, 18);
    const floorMat = new THREE.ShadowMaterial({ opacity: 0.12 });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -2.4;
    floor.receiveShadow = true;
    this.scene.add(floor);
  }

  buildCube() {
    // Remove cubies antigos se existirem
    while (this.cubeGroup.children.length > 0) {
      const obj = this.cubeGroup.children[0];
      this.cubeGroup.remove(obj);
    }
    this.cubies = [];

    const cubieGeo = createCubieGeometry(0.96, 0.06, 4);
    const stickerGeo = createStickerGeometry(0.84, 0.06);
    const { coreMaterial, faceMaterials } = createCubieMaterials(this.currentTheme, this.currentStyle);

    const offset = 1.0;
    const stickerOffset = 0.486;

    // Normal vectors para as 6 faces (U: Branco, D: Amarelo, F: Verde, B: Azul, R: Vermelho, L: Laranja)
    const faceConfigs = [
      { face: 'R', normal: new THREE.Vector3(1, 0, 0), rot: [0, Math.PI / 2, 0], pos: [stickerOffset, 0, 0], cond: x => x === 1 },
      { face: 'L', normal: new THREE.Vector3(-1, 0, 0), rot: [0, -Math.PI / 2, 0], pos: [-stickerOffset, 0, 0], cond: x => x === -1 },
      { face: 'U', normal: new THREE.Vector3(0, 1, 0), rot: [-Math.PI / 2, 0, 0], pos: [0, stickerOffset, 0], cond: (x, y) => y === 1 },
      { face: 'D', normal: new THREE.Vector3(0, -1, 0), rot: [Math.PI / 2, 0, 0], pos: [0, -stickerOffset, 0], cond: (x, y) => y === -1 },
      { face: 'F', normal: new THREE.Vector3(0, 0, 1), rot: [0, 0, 0], pos: [0, 0, stickerOffset], cond: (x, y, z) => z === 1 },
      { face: 'B', normal: new THREE.Vector3(0, 0, -1), rot: [0, Math.PI, 0], pos: [0, 0, -stickerOffset], cond: (x, y, z) => z === -1 }
    ];

    for (let x = -1; x <= 1; x++) {
      for (let y = -1; y <= 1; y++) {
        for (let z = -1; z <= 1; z++) {
          // Ignora o núcleo interno invisível
          if (x === 0 && y === 0 && z === 0) continue;

          const cubieMesh = new THREE.Mesh(cubieGeo, coreMaterial);
          cubieMesh.castShadow = true;
          cubieMesh.receiveShadow = true;

          const cubieGroup = new THREE.Group();
          cubieGroup.position.set(x * offset, y * offset, z * offset);
          cubieGroup.add(cubieMesh);

          cubieGroup.userData = {
            gridPos: new THREE.Vector3(x, y, z),
            initialPos: new THREE.Vector3(x, y, z),
            stickers: []
          };

          // Adiciona adesivos nas faces externas
          faceConfigs.forEach(cfg => {
            let isOuter = false;
            if (cfg.face === 'R' || cfg.face === 'L') isOuter = cfg.cond(x);
            if (cfg.face === 'U' || cfg.face === 'D') isOuter = cfg.cond(x, y);
            if (cfg.face === 'F' || cfg.face === 'B') isOuter = cfg.cond(x, y, z);

            if (isOuter) {
              const stickerMesh = new THREE.Mesh(stickerGeo, faceMaterials[cfg.face]);
              stickerMesh.position.set(...cfg.pos);
              stickerMesh.rotation.set(...cfg.rot);
              stickerMesh.userData = {
                face: cfg.face,
                normal: cfg.normal.clone(),
                parentCubie: cubieGroup
              };
              cubieGroup.add(stickerMesh);
              cubieGroup.userData.stickers.push(stickerMesh);
            }
          });

          this.cubeGroup.add(cubieGroup);
          this.cubies.push(cubieGroup);
        }
      }
    }
  }

  setTheme(themeKey, style = 'stickerless') {
    this.currentTheme = themeKey;
    this.currentStyle = style;
    this.buildCube();
  }

  /**
   * Converte a coordenada 3D de um cubie para o índice 0-8 da facelet correspondente
   */
  getFaceletIndex(face, pos) {
    let row = 0;
    let col = 0;

    switch (face) {
      case 'U': // Topo (Y = 1): Olhando de cima com B em cima, F embaixo
        row = pos.z + 1; // z: -1->0, 0->1, 1->2
        col = pos.x + 1; // x: -1->0, 0->1, 1->2
        break;
      case 'D': // Base (Y = -1): Olhando de baixo com F em cima, B embaixo
        row = 1 - pos.z; // z: 1->0, 0->1, -1->2
        col = pos.x + 1; // x: -1->0, 0->1, 1->2
        break;
      case 'F': // Frente (Z = 1): Olhando de frente com U em cima, D embaixo
        row = 1 - pos.y; // y: 1->0, 0->1, -1->2
        col = pos.x + 1; // x: -1->0, 0->1, 1->2
        break;
      case 'B': // Trás (Z = -1): Olhando de trás com U em cima, D embaixo
        row = 1 - pos.y; // y: 1->0, 0->1, -1->2
        col = 1 - pos.x; // x: 1->0, 0->1, -1->2
        break;
      case 'R': // Direita (X = 1): Olhando de direita com U em cima, D embaixo, F na esq, B na dir
        row = 1 - pos.y; // y: 1->0, 0->1, -1->2
        col = 1 - pos.z; // z: 1->0, 0->1, -1->2
        break;
      case 'L': // Esquerda (X = -1): Olhando de esquerda com U em cima, D embaixo, B na esq, F na dir
        row = 1 - pos.y; // y: 1->0, 0->1, -1->2
        col = pos.z + 1; // z: -1->0, 0->1, 1->2
        break;
      default:
        return -1;
    }

    return row * 3 + col;
  }

  /**
   * Aplica um estado arbitrário de 54 facetas na cena 3D
   */
  applyState(cubeState) {
    this.buildCube();
    const { faceMaterials } = createCubieMaterials(this.currentTheme, this.currentStyle);

    this.cubies.forEach(cubie => {
      const pos = cubie.userData.gridPos;
      cubie.userData.stickers.forEach(sticker => {
        const face = sticker.userData.face;
        const idx = this.getFaceletIndex(face, pos);
        if (idx >= 0 && idx < 9 && cubeState.faces[face]) {
          const colorKey = cubeState.faces[face][idx];
          if (faceMaterials[colorKey]) {
            sticker.material = faceMaterials[colorKey];
          }
        }
      });
    });
  }

  setAnimationSpeed(ms) {
    this.animDuration = ms;
  }

  /**
   * Reseta a posição do cubo e da câmera
   */
  resetView() {
    const startPos = this.camera.position.clone();
    const targetPos = new THREE.Vector3(-4.8, 3.8, -5.0);
    const startTime = performance.now();
    const duration = 400;

    const animateCam = (currentTime) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(1, elapsed / duration);
      const ease = 1 - Math.pow(1 - progress, 3);

      this.camera.position.lerpVectors(startPos, targetPos, ease);
      this.controls.target.set(0, 0, 0);

      if (progress < 1) {
        requestAnimationFrame(animateCam);
      }
    };
    requestAnimationFrame(animateCam);
  }

  /**
   * Executa rotação de camada pelo código Singmaster (ex: U, R', F2, M, x, etc.)
   */
  rotate(move, immediate = false, callback = null) {
    if (immediate) {
      this.executeMoveInstant(move);
      if (callback) callback();
      return;
    }

    this.moveQueue.push({ move, callback });
    this.processQueue();
  }

  processQueue() {
    if (this.isAnimating || this.moveQueue.length === 0) return;

    const { move, callback } = this.moveQueue.shift();
    this.executeMoveAnimated(move, () => {
      if (callback) callback();
      this.processQueue();
    });
  }

  executeMoveInstant(move) {
    const parsed = this.parseMove(move);
    if (!parsed) return;

    const affectedCubies = this.getAffectedCubies(parsed.axis, parsed.layerCoord);
    const angle = parsed.angle;

    const pivot = new THREE.Group();
    this.scene.add(pivot);

    affectedCubies.forEach(c => pivot.attach(c));
    pivot.rotation[parsed.axis] += angle;
    pivot.updateMatrixWorld();

    affectedCubies.forEach(c => {
      this.cubeGroup.attach(c);
      c.updateMatrixWorld();
    });

    this.scene.remove(pivot);
    sounds.playTurn();
  }

  executeMoveAnimated(move, onComplete) {
    const parsed = this.parseMove(move);
    if (!parsed) {
      if (onComplete) onComplete();
      return;
    }

    this.isAnimating = true;
    const affectedCubies = this.getAffectedCubies(parsed.axis, parsed.layerCoord);
    const targetAngle = parsed.angle;

    const pivot = new THREE.Group();
    this.scene.add(pivot);

    affectedCubies.forEach(c => pivot.attach(c));

    const startTime = performance.now();
    const duration = move.endsWith('2') ? this.animDuration * 1.4 : this.animDuration;

    sounds.playTurn();

    const animateRotation = (currentTime) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(1, elapsed / duration);
      // Easing suave (easeOutCubic)
      const ease = 1 - Math.pow(1 - progress, 3);

      pivot.rotation[parsed.axis] = targetAngle * ease;

      if (progress < 1) {
        requestAnimationFrame(animateRotation);
      } else {
        pivot.rotation[parsed.axis] = targetAngle;
        pivot.updateMatrixWorld();

        affectedCubies.forEach(c => {
          this.cubeGroup.attach(c);
          c.updateMatrixWorld();
        });

        this.scene.remove(pivot);
        this.isAnimating = false;
        if (onComplete) onComplete();
      }
    };

    requestAnimationFrame(animateRotation);
  }

  parseMove(move) {
    if (!move) return null;

    let is2 = move.endsWith('2');
    let isPrime = move.endsWith("'") || move.endsWith("’");
    let face = move.replace(/['’2]/g, '');

    let axis = 'y';
    let layerCoord = 1; // 1 = outer positive, -1 = outer negative, 0 = slice, null = whole cube
    let baseAngle = -Math.PI / 2; // Sentido horário padrão para U

    switch (face) {
      case 'U':
        axis = 'y';
        layerCoord = 1;
        baseAngle = -Math.PI / 2;
        break;
      case 'D':
        axis = 'y';
        layerCoord = -1;
        baseAngle = Math.PI / 2;
        break;
      case 'L':
        axis = 'x';
        layerCoord = -1;
        baseAngle = Math.PI / 2;
        break;
      case 'R':
        axis = 'x';
        layerCoord = 1;
        baseAngle = -Math.PI / 2;
        break;
      case 'F':
        axis = 'z';
        layerCoord = 1;
        baseAngle = -Math.PI / 2;
        break;
      case 'B':
        axis = 'z';
        layerCoord = -1;
        baseAngle = Math.PI / 2;
        break;

      // Fatias
      case 'M': // Sentido de L
        axis = 'x';
        layerCoord = 0;
        baseAngle = Math.PI / 2;
        break;
      case 'E': // Sentido de D
        axis = 'y';
        layerCoord = 0;
        baseAngle = Math.PI / 2;
        break;
      case 'S': // Sentido de F
        axis = 'z';
        layerCoord = 0;
        baseAngle = -Math.PI / 2;
        break;

      // Rotações inteiras do cubo
      case 'x':
        axis = 'x';
        layerCoord = null;
        baseAngle = -Math.PI / 2;
        break;
      case 'y':
        axis = 'y';
        layerCoord = null;
        baseAngle = -Math.PI / 2;
        break;
      case 'z':
        axis = 'z';
        layerCoord = null;
        baseAngle = -Math.PI / 2;
        break;
      default:
        return null;
    }

    let angle = baseAngle;
    if (isPrime) angle = -angle;
    if (is2) angle = angle * 2;

    return { axis, layerCoord, angle };
  }

  getAffectedCubies(axis, layerCoord) {
    if (layerCoord === null) {
      return [...this.cubies];
    }

    const eps = 0.4;
    return this.cubies.filter(cubie => {
      const worldPos = new THREE.Vector3();
      cubie.getWorldPosition(worldPos);

      if (layerCoord === 1) return worldPos[axis] > eps;
      if (layerCoord === -1) return worldPos[axis] < -eps;
      if (layerCoord === 0) return Math.abs(worldPos[axis]) <= eps;
      return false;
    });
  }

  /**
   * Configuração de Interação Direta com Mouse / Toque no Cubo
   */
  initInteractions() {
    const el = this.renderer.domElement;

    el.addEventListener('pointerdown', this.onPointerDown.bind(this));
    el.addEventListener('pointermove', this.onPointerMove.bind(this));
    el.addEventListener('pointerup', this.onPointerUp.bind(this));
    el.addEventListener('pointercancel', this.onPointerUp.bind(this));
  }

  onPointerDown(event) {
    if (this.isAnimating) return;

    const rect = this.container.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.mouse, this.camera);
    const intersects = this.raycaster.intersectObjects(this.cubeGroup.children, true);

    if (intersects.length > 0) {
      const hit = intersects[0];
      this.dragIntersection = hit;
      this.dragStartPos.set(event.clientX, event.clientY);
      this.isDraggingFace = true;
      // Desabilita rotação de câmera para capturar o gesto no cubo
      this.controls.enabled = false;
    }
  }

  onPointerMove(event) {
    if (!this.isDraggingFace || !this.dragIntersection || this.isAnimating) return;

    const dx = event.clientX - this.dragStartPos.x;
    const dy = event.clientY - this.dragStartPos.y;
    const distSq = dx * dx + dy * dy;

    // Se o arraste ultrapassar o limiar de 18 pixels, calcula o movimento de face
    if (distSq > 324) {
      this.handleFaceDrag(dx, dy);
      this.isDraggingFace = false;
      this.dragIntersection = null;
      this.controls.enabled = true;
    }
  }

  onPointerUp() {
    this.isDraggingFace = false;
    this.dragIntersection = null;
    this.controls.enabled = true;
  }

  handleFaceDrag(dx, dy) {
    if (!this.dragIntersection) return;

    const hit = this.dragIntersection;
    const worldNormal = hit.face.normal.clone().applyQuaternion(hit.object.getWorldQuaternion(new THREE.Quaternion())).normalize();
    const hitWorldPos = hit.point.clone();

    // Determina a face principal atingida com base na normal mundial
    const absX = Math.abs(worldNormal.x);
    const absY = Math.abs(worldNormal.y);
    const absZ = Math.abs(worldNormal.z);

    let mainFace = 'F';
    if (absX > absY && absX > absZ) {
      mainFace = worldNormal.x > 0 ? 'R' : 'L';
    } else if (absY > absX && absY > absZ) {
      mainFace = worldNormal.y > 0 ? 'U' : 'D';
    } else {
      mainFace = worldNormal.z > 0 ? 'F' : 'B';
    }

    // Calcula o vetor de movimento 2D na tela
    const dragDir = new THREE.Vector2(dx, dy).normalize();
    const isHorizontal = Math.abs(dragDir.x) > Math.abs(dragDir.y);

    let determinedMove = null;

    if (mainFace === 'F') {
      if (isHorizontal) {
        // Arraste horizontal na face frontal gira U, E ou D
        const isRight = dx > 0;
        if (hitWorldPos.y > 0.4) determinedMove = isRight ? 'U' : "U'";
        else if (hitWorldPos.y < -0.4) determinedMove = isRight ? "D'" : 'D';
        else determinedMove = isRight ? "E'" : 'E';
      } else {
        // Arraste vertical na face frontal gira L, M ou R
        const isDown = dy > 0;
        if (hitWorldPos.x > 0.4) determinedMove = isDown ? 'R' : "R'";
        else if (hitWorldPos.x < -0.4) determinedMove = isDown ? "L'" : 'L';
        else determinedMove = isDown ? 'M' : "M'";
      }
    } else if (mainFace === 'R') {
      if (isHorizontal) {
        const isRight = dx > 0;
        if (hitWorldPos.y > 0.4) determinedMove = isRight ? 'U' : "U'";
        else if (hitWorldPos.y < -0.4) determinedMove = isRight ? "D'" : 'D';
        else determinedMove = isRight ? "E'" : 'E';
      } else {
        const isDown = dy > 0;
        if (hitWorldPos.z > 0.4) determinedMove = isDown ? "F'" : 'F';
        else if (hitWorldPos.z < -0.4) determinedMove = isDown ? 'B' : "B'";
        else determinedMove = isDown ? "S'" : 'S';
      }
    } else if (mainFace === 'U') {
      if (isHorizontal) {
        const isRight = dx > 0;
        if (hitWorldPos.z > 0.4) determinedMove = isRight ? 'F' : "F'";
        else if (hitWorldPos.z < -0.4) determinedMove = isRight ? "B'" : 'B';
        else determinedMove = isRight ? 'S' : "S'";
      } else {
        const isDown = dy > 0;
        if (hitWorldPos.x > 0.4) determinedMove = isDown ? 'R' : "R'";
        else if (hitWorldPos.x < -0.4) determinedMove = isDown ? "L'" : 'L';
        else determinedMove = isDown ? 'M' : "M'";
      }
    } else if (mainFace === 'L') {
      if (isHorizontal) {
        const isRight = dx > 0;
        if (hitWorldPos.y > 0.4) determinedMove = isRight ? "U'" : 'U';
        else if (hitWorldPos.y < -0.4) determinedMove = isRight ? 'D' : "D'";
        else determinedMove = isRight ? 'E' : "E'";
      } else {
        const isDown = dy > 0;
        if (hitWorldPos.z > 0.4) determinedMove = isDown ? 'F' : "F'";
        else if (hitWorldPos.z < -0.4) determinedMove = isDown ? "B'" : 'B';
        else determinedMove = isDown ? 'S' : "S'";
      }
    } else if (mainFace === 'D') {
      if (isHorizontal) {
        const isRight = dx > 0;
        if (hitWorldPos.z > 0.4) determinedMove = isRight ? "F'" : 'F';
        else if (hitWorldPos.z < -0.4) determinedMove = isRight ? 'B' : "B'";
        else determinedMove = isRight ? "S'" : 'S';
      } else {
        const isDown = dy > 0;
        if (hitWorldPos.x > 0.4) determinedMove = isDown ? "R'" : 'R';
        else if (hitWorldPos.x < -0.4) determinedMove = isDown ? 'L' : "L'";
        else determinedMove = isDown ? "M'" : 'M';
      }
    } else if (mainFace === 'B') {
      if (isHorizontal) {
        const isRight = dx > 0;
        if (hitWorldPos.y > 0.4) determinedMove = isRight ? "U'" : 'U';
        else if (hitWorldPos.y < -0.4) determinedMove = isRight ? 'D' : "D'";
        else determinedMove = isRight ? 'E' : "E'";
      } else {
        const isDown = dy > 0;
        if (hitWorldPos.x > 0.4) determinedMove = isDown ? "R'" : 'R';
        else if (hitWorldPos.x < -0.4) determinedMove = isDown ? 'L' : "L'";
        else determinedMove = isDown ? "M'" : 'M';
      }
    }

    if (determinedMove) {
      this.rotate(determinedMove);
      if (this.onMoveExecuted) {
        this.onMoveExecuted(determinedMove);
      }
    }
  }

  onResize() {
    if (!this.container) return;
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  animate() {
    requestAnimationFrame(this.animate.bind(this));
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }
}
