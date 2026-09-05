import * as THREE from 'three';
import { audio } from './audioEngine.js';

export class PlayerController {
  constructor(camera, domElement, viewmodelRig) {
    this.camera = camera;
    this.domElement = domElement;
    this.viewmodelRig = viewmodelRig;

    // Movement speeds & physics
    this.walkSpeed = 5.2;
    this.sprintSpeed = 8.6;
    this.jumpForce = 6.8;
    this.gravity = 19.0;
    this.playerHeight = 1.75;

    // State
    this.position = new THREE.Vector3(0, this.playerHeight, 8); // Start in middle of street facing saloon
    this.velocity = new THREE.Vector3();
    this.isGrounded = true;
    this.isLocked = false;
    this.isSprinting = false;

    // Camera rotation angles
    this.yaw = 0;
    this.pitch = 0;
    this.mouseSensitivity = 0.0022;

    // Input flags
    this.keys = {
      forward: false,
      backward: false,
      left: false,
      right: false,
      sprint: false,
      jump: false,
    };

    // Weapon mechanics
    this.maxAmmo = 6;
    this.currentAmmo = 6;
    this.isShooting = false;
    this.isReloading = false;
    this.lastShootTime = 0;
    this.shootCooldown = 0.75; // Time between shots (pump action cycle)

    // Sway and bobbing variables
    this.mouseDeltaX = 0;
    this.mouseDeltaY = 0;
    this.swayPos = new THREE.Vector3();
    this.swayRot = new THREE.Euler();
    this.bobTimer = 0;
    this.bobOffset = new THREE.Vector3();
    this.footstepTimer = 0;

    // Recoil state
    this.recoilZ = 0;
    this.recoilRotX = 0;
    this.recoilRotZ = 0;

    // Pump action state
    this.pumpOffsetZ = 0;

    // Camera child setup
    this.camera.add(this.viewmodelRig.root);

    // Callbacks for UI updates
    this.onAmmoChange = null;
    this.onShootCallback = null;

    this.initEvents();
  }

  initEvents() {
    // Pointer Lock
    document.addEventListener('pointerlockchange', () => {
      this.isLocked = document.pointerLockElement === this.domElement;
      const blocker = document.getElementById('blocker');
      if (this.isLocked) {
        if (blocker) blocker.classList.add('hidden');
        audio.init();
      } else {
        if (blocker) blocker.classList.remove('hidden');
      }
    });

    // Mouse movement
    window.addEventListener('mousemove', (e) => {
      if (!this.isLocked) return;
      this.mouseDeltaX = e.movementX || 0;
      this.mouseDeltaY = e.movementY || 0;

      this.yaw -= this.mouseDeltaX * this.mouseSensitivity;
      this.pitch -= this.mouseDeltaY * this.mouseSensitivity;

      // Clamp vertical pitch (prevent backflips)
      const maxPitch = Math.PI / 2 - 0.05;
      this.pitch = Math.max(-maxPitch, Math.min(maxPitch, this.pitch));
    });

    // Keyboard controls
    window.addEventListener('keydown', (e) => {
      if (!this.isLocked) return;
      switch (e.code) {
        case 'KeyW': case 'ArrowUp': this.keys.forward = true; break;
        case 'KeyS': case 'ArrowDown': this.keys.backward = true; break;
        case 'KeyA': case 'ArrowLeft': this.keys.left = true; break;
        case 'KeyD': case 'ArrowRight': this.keys.right = true; break;
        case 'ShiftLeft': case 'ShiftRight': this.keys.sprint = true; break;
        case 'Space':
          if (this.isGrounded) {
            this.velocity.y = this.jumpForce;
            this.isGrounded = false;
            audio.playJump();
          }
          break;
        case 'KeyR':
          this.reload();
          break;
      }
    });

    window.addEventListener('keyup', (e) => {
      switch (e.code) {
        case 'KeyW': case 'ArrowUp': this.keys.forward = false; break;
        case 'KeyS': case 'ArrowDown': this.keys.backward = false; break;
        case 'KeyA': case 'ArrowLeft': this.keys.left = false; break;
        case 'KeyD': case 'ArrowRight': this.keys.right = false; break;
        case 'ShiftLeft': case 'ShiftRight': this.keys.sprint = false; break;
      }
    });

    // Shooting
    window.addEventListener('mousedown', (e) => {
      if (this.isLocked && e.button === 0) {
        this.shoot();
      }
    });
  }

  requestLock() {
    this.domElement.requestPointerLock();
  }

  shoot() {
    const now = performance.now() / 1000;
    if (now - this.lastShootTime < this.shootCooldown || this.isReloading) return;

    if (this.currentAmmo <= 0) {
      audio.playDryClick();
      this.lastShootTime = now;
      return;
    }

    this.lastShootTime = now;
    this.currentAmmo--;
    if (this.onAmmoChange) this.onAmmoChange(this.currentAmmo, this.maxAmmo);

    // Audio
    audio.playGunshot();
    audio.playPumpAction();

    // Trigger visual muzzle flash
    this.viewmodelRig.muzzleFlash.visible = true;
    this.viewmodelRig.muzzleLight.intensity = 4.5;
    setTimeout(() => {
      this.viewmodelRig.muzzleFlash.visible = false;
      this.viewmodelRig.muzzleLight.intensity = 0;
    }, 55);

    // Recoil impulse
    this.recoilZ = 0.16; // Kick back
    this.recoilRotX = 0.28; // Muzzle lift
    this.recoilRotZ = (Math.random() - 0.5) * 0.06;

    // Crosshair pop
    const ch = document.getElementById('crosshair');
    if (ch) {
      ch.classList.add('recoil');
      setTimeout(() => ch.classList.remove('recoil'), 100);
    }

    // Call external callback for bullet raycast & particles
    if (this.onShootCallback) {
      this.onShootCallback();
    }
  }

  reload() {
    if (this.isReloading || this.currentAmmo === this.maxAmmo) return;
    this.isReloading = true;

    const needed = this.maxAmmo - this.currentAmmo;
    for (let i = 0; i < needed; i++) {
      audio.playShellInsert(i * 0.35);
    }

    setTimeout(() => {
      audio.playPumpAction();
      this.currentAmmo = this.maxAmmo;
      this.isReloading = false;
      if (this.onAmmoChange) this.onAmmoChange(this.currentAmmo, this.maxAmmo);
    }, needed * 350 + 200);
  }

  update(delta) {
    if (!this.isLocked) {
      this.mouseDeltaX = 0;
      this.mouseDeltaY = 0;
    }

    // 1. Camera orientation from yaw and pitch
    const euler = new THREE.Euler(0, 0, 0, 'YXZ');
    euler.x = this.pitch;
    euler.y = this.yaw;
    this.camera.quaternion.setFromEuler(euler);

    // 2. Movement calculations
    const moveDir = new THREE.Vector3();
    if (this.keys.forward) moveDir.z -= 1;
    if (this.keys.backward) moveDir.z += 1;
    if (this.keys.left) moveDir.x -= 1;
    if (this.keys.right) moveDir.x += 1;
    moveDir.normalize();

    // Transform move direction relative to camera yaw
    const forward = new THREE.Vector3(0, 0, -1).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.yaw);
    const right = new THREE.Vector3(1, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.yaw);
    const targetVel = new THREE.Vector3()
      .addScaledVector(forward, -moveDir.z)
      .addScaledVector(right, moveDir.x);

    this.isSprinting = this.keys.sprint && this.keys.forward && this.isGrounded;
    const currentSpeed = this.isSprinting ? this.sprintSpeed : this.walkSpeed;
    targetVel.multiplyScalar(currentSpeed);

    // Smooth horizontal velocity damping
    const smoothFactor = this.isGrounded ? 12.0 : 3.0;
    this.velocity.x += (targetVel.x - this.velocity.x) * smoothFactor * delta;
    this.velocity.z += (targetVel.z - this.velocity.z) * smoothFactor * delta;

    // Gravity & Ground collision
    this.velocity.y -= this.gravity * delta;
    this.position.x += this.velocity.x * delta;
    this.position.y += this.velocity.y * delta;
    this.position.z += this.velocity.z * delta;

    // Keep within town limits
    this.position.x = Math.max(-28, Math.min(28, this.position.x));
    this.position.z = Math.max(-45, Math.min(45, this.position.z));

    if (this.position.y <= this.playerHeight) {
      this.position.y = this.playerHeight;
      this.velocity.y = 0;
      this.isGrounded = true;
    }

    this.camera.position.copy(this.position);

    // Dynamic FOV when sprinting
    const targetFov = this.isSprinting ? 75 : 70;
    this.camera.fov += (targetFov - this.camera.fov) * 8 * delta;
    this.camera.updateProjectionMatrix();

    // 3. Footstep sound triggers
    const horizontalSpeed = Math.sqrt(this.velocity.x * this.velocity.x + this.velocity.z * this.velocity.z);
    if (this.isGrounded && horizontalSpeed > 1.2) {
      this.footstepTimer += delta * (this.isSprinting ? 2.8 : 1.9);
      if (this.footstepTimer >= 1.0) {
        audio.playFootstep(this.isSprinting);
        this.footstepTimer = 0;
      }
    } else {
      this.footstepTimer = 0;
    }

    // 4. Viewmodel Sway (inertia lag on mouse movement)
    const swayAmount = 0.00065;
    const maxSway = 0.04;
    const targetSwayX = Math.max(-maxSway, Math.min(maxSway, -this.mouseDeltaX * swayAmount));
    const targetSwayY = Math.max(-maxSway, Math.min(maxSway, this.mouseDeltaY * swayAmount));

    this.swayPos.x += (targetSwayX - this.swayPos.x) * 10 * delta;
    this.swayPos.y += (targetSwayY - this.swayPos.y) * 10 * delta;
    this.swayRot.z += (-this.mouseDeltaX * 0.001 - this.swayRot.z) * 10 * delta;
    this.swayRot.x += (-this.mouseDeltaY * 0.001 - this.swayRot.x) * 10 * delta;

    // Reset mouse delta after applying
    this.mouseDeltaX = 0;
    this.mouseDeltaY = 0;

    // 5. Weapon Bobbing (walking oscillation)
    if (this.isGrounded && horizontalSpeed > 0.8) {
      const bobSpeed = this.isSprinting ? 14 : 9;
      this.bobTimer += delta * bobSpeed;
      const bobX = Math.sin(this.bobTimer * 0.5) * (this.isSprinting ? 0.016 : 0.009);
      const bobY = Math.abs(Math.sin(this.bobTimer)) * (this.isSprinting ? 0.018 : 0.01);
      this.bobOffset.set(bobX, -bobY, 0);
    } else {
      this.bobTimer = 0;
      this.bobOffset.lerp(new THREE.Vector3(), 8 * delta);
    }

    // 6. Recoil Recovery & Pump action cycle animation
    this.recoilZ = THREE.MathUtils.lerp(this.recoilZ, 0, 8 * delta);
    this.recoilRotX = THREE.MathUtils.lerp(this.recoilRotX, 0, 10 * delta);
    this.recoilRotZ = THREE.MathUtils.lerp(this.recoilRotZ, 0, 8 * delta);

    // Pump sliding back & forth based on time since shot
    const timeSinceShot = (performance.now() / 1000) - this.lastShootTime;
    if (timeSinceShot > 0.18 && timeSinceShot < 0.38) {
      // Sliding pump back
      const pumpProgress = (timeSinceShot - 0.18) / 0.2;
      this.pumpOffsetZ = -Math.sin(pumpProgress * Math.PI) * 0.14;
    } else if (timeSinceShot >= 0.38 && timeSinceShot < 0.55) {
      // Return forward
      const returnProgress = (timeSinceShot - 0.38) / 0.17;
      this.pumpOffsetZ = -0.14 * (1 - returnProgress);
    } else {
      this.pumpOffsetZ = 0;
    }
    this.viewmodelRig.pump.position.z = this.viewmodelRig.pumpRestZ + this.pumpOffsetZ;

    // Apply combined transform to weapon viewmodel
    const defPos = this.viewmodelRig.defaultPosition;
    const defRot = this.viewmodelRig.defaultRotation;

    this.viewmodelRig.weapon.position.set(
      defPos.x + this.swayPos.x + this.bobOffset.x,
      defPos.y + this.swayPos.y + this.bobOffset.y,
      defPos.z + this.recoilZ
    );

    this.viewmodelRig.weapon.rotation.set(
      defRot.x + this.recoilRotX + this.swayRot.x,
      defRot.y + this.swayPos.x * 0.6,
      defRot.z + this.recoilRotZ + this.swayRot.z
    );
  }
}
