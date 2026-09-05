import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// Low-Poly Western Shotgun Viewmodel Rig with Espingarda.glb integration
export function createShotgunViewmodel(onLoadCallback) {
  const rootGroup = new THREE.Group();
  rootGroup.name = 'viewmodel_root';

  // Base materials for character arms & hands
  const skinMat = new THREE.MeshStandardMaterial({
    color: 0xd29d77, // Low-poly skin tone
    metalness: 0.05,
    roughness: 0.65,
    flatShading: true,
  });

  const sleeveMat = new THREE.MeshStandardMaterial({
    color: 0x937047, // Rough western canvas cowboy shirt
    metalness: 0.05,
    roughness: 0.9,
    flatShading: true,
  });

  // Weapon Group
  const weaponGroup = new THREE.Group();
  weaponGroup.name = 'shotgun_mesh';

  // Group that will hold the GLB model
  const glbContainer = new THREE.Group();
  glbContainer.name = 'glb_container';
  weaponGroup.add(glbContainer);

  // Group for the procedural placeholder (visible while GLB loads)
  const proceduralGroup = new THREE.Group();
  proceduralGroup.name = 'procedural_placeholder';

  // Base placeholder materials
  const gunmetalMat = new THREE.MeshStandardMaterial({
    color: 0x3d434a,
    metalness: 0.8,
    roughness: 0.35,
    flatShading: true,
  });
  const woodMat = new THREE.MeshStandardMaterial({
    color: 0x8b4b2c,
    metalness: 0.05,
    roughness: 0.65,
    flatShading: true,
  });

  // Simple placeholder receiver & barrel
  const phReceiver = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.16, 0.55), gunmetalMat);
  proceduralGroup.add(phReceiver);
  const phBarrel = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.034, 1.2, 8).rotateX(-Math.PI / 2), gunmetalMat);
  phBarrel.position.set(0, 0.048, 0.85);
  proceduralGroup.add(phBarrel);
  const phStock = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.18, 0.5), woodMat);
  phStock.position.set(0, -0.12, -0.5);
  proceduralGroup.add(phStock);
  weaponGroup.add(proceduralGroup);

  // Pump group (supports pump action motion)
  const pumpGroup = new THREE.Group();
  pumpGroup.name = 'shotgun_pump';
  weaponGroup.add(pumpGroup);

  // Character Arms & Hands (Matching Reference 2)
  const armGroup = new THREE.Group();
  armGroup.name = 'player_arms';

  // Left Forearm (Supporting the pump forend)
  const leftForearmGeo = new THREE.CylinderGeometry(0.065, 0.085, 0.85, 6);
  leftForearmGeo.rotateZ(-0.35);
  leftForearmGeo.rotateX(0.72);
  const leftForearm = new THREE.Mesh(leftForearmGeo, sleeveMat);
  leftForearm.position.set(-0.16, -0.32, 0.28);
  leftForearm.castShadow = true;
  armGroup.add(leftForearm);

  // Left Hand (Wrapping the pump grip under the barrel)
  const leftHandGroup = new THREE.Group();
  const leftHandGeo = new THREE.BoxGeometry(0.095, 0.085, 0.14);
  const leftHand = new THREE.Mesh(leftHandGeo, skinMat);
  leftHandGroup.add(leftHand);

  // Left Thumb
  const thumbGeo = new THREE.BoxGeometry(0.035, 0.04, 0.09);
  const thumb = new THREE.Mesh(thumbGeo, skinMat);
  thumb.position.set(0.025, 0.06, -0.01);
  thumb.rotation.set(-0.2, -0.2, 0.4);
  leftHandGroup.add(thumb);

  leftHandGroup.position.set(-0.06, -0.06, 0.48);
  leftHandGroup.rotation.set(0.25, 0.1, -0.32);
  armGroup.add(leftHandGroup);

  // Right Forearm (Grip & Trigger)
  const rightForearmGeo = new THREE.CylinderGeometry(0.07, 0.09, 0.88, 6);
  rightForearmGeo.rotateZ(0.26);
  rightForearmGeo.rotateX(0.92);
  const rightForearm = new THREE.Mesh(rightForearmGeo, sleeveMat);
  rightForearm.position.set(0.18, -0.42, -0.15);
  rightForearm.castShadow = true;
  armGroup.add(rightForearm);

  // Right Hand
  const rightHandGeo = new THREE.BoxGeometry(0.09, 0.11, 0.12);
  const rightHand = new THREE.Mesh(rightHandGeo, skinMat);
  rightHand.position.set(0.05, -0.14, -0.24);
  rightHand.rotation.set(0.42, -0.2, 0.3);
  armGroup.add(rightHand);

  weaponGroup.add(armGroup);

  // Muzzle Flash & Light
  const muzzleFlashGroup = new THREE.Group();
  muzzleFlashGroup.position.set(0, 0.08, 1.25);
  muzzleFlashGroup.visible = false;

  const flashMat = new THREE.MeshBasicMaterial({
    color: 0xffe070,
    transparent: true,
    opacity: 0.95,
  });

  const cone1 = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.45, 5), flashMat);
  cone1.rotateX(Math.PI / 2);
  muzzleFlashGroup.add(cone1);

  const cone2 = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.35, 4), flashMat);
  cone2.rotateX(Math.PI / 2);
  cone2.rotateZ(Math.PI / 4);
  muzzleFlashGroup.add(cone2);

  const muzzleLight = new THREE.PointLight(0xffaa22, 0, 15);
  muzzleFlashGroup.add(muzzleLight);

  weaponGroup.add(muzzleFlashGroup);

  // Viewmodel position and rotation in camera space
  weaponGroup.position.set(0.24, -0.26, -0.55);
  weaponGroup.rotation.set(-0.05, -0.07, 0.04);
  rootGroup.add(weaponGroup);

  // Load Espingarda.glb via GLTFLoader
  const loader = new GLTFLoader();
  loader.load(
    '/Espingarda.glb',
    (gltf) => {
      console.log('Espingarda.glb loaded successfully!', gltf);
      const model = gltf.scene;

      // Enable shadows and configure materials
      model.traverse((child) => {
        if (child.isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
          if (child.material) {
            child.material.roughness = 0.45;
            child.material.metalness = 0.65;
            child.material.needsUpdate = true;
          }
        }
      });

      // Orient the shotgun so the barrel points forward along +Z:
      // In Espingarda.glb original coordinates:
      // +X is barrel (forward), -X is stock, +Y is up.
      // Rotating by -90 deg (-Math.PI / 2) on Y maps +X to +Z.
      model.rotation.y = -Math.PI / 2;
      
      // Fine-tune scale and offset relative to the viewmodel grip and sights
      model.scale.set(1.15, 1.15, 1.15);
      model.position.set(0, -0.05, 0.15);

      // Add to container and hide the temporary procedural mesh
      glbContainer.add(model);
      proceduralGroup.visible = false;

      // Adjust muzzle flash position to match tip of the real barrel
      muzzleFlashGroup.position.set(0, 0.07, 1.28);

      if (onLoadCallback) onLoadCallback(gltf);
    },
    (xhr) => {
      if (xhr.lengthComputable) {
        const percent = Math.round((xhr.loaded / xhr.total) * 100);
        console.log(`Loading Espingarda.glb: ${percent}%`);
      }
    },
    (error) => {
      console.error('Error loading Espingarda.glb:', error);
    }
  );

  return {
    root: rootGroup,
    weapon: weaponGroup,
    pump: pumpGroup,
    muzzleFlash: muzzleFlashGroup,
    muzzleLight: muzzleLight,
    defaultPosition: new THREE.Vector3(0.24, -0.26, -0.55),
    defaultRotation: new THREE.Euler(-0.05, -0.07, 0.04),
    pumpRestZ: 0.65,
  };
}
