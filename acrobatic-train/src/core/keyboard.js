/**
 * Keyboard Input Controller for Acrobatic Train 3D
 * Provides dual-hand keyboard controls with visual HUD feedback.
 */

export class KeyboardController {
  constructor(handlers = {}) {
    this.handlers = handlers; // { onMoveFront, onMoveRear, onStraighten, onCenter, onAction, onMute }
    this.keyElements = {
      'KeyA': document.getElementById('key-A'),
      'KeyD': document.getElementById('key-D'),
      'KeyW': document.getElementById('key-W'),
      'KeyH': document.getElementById('key-H'),
      'KeyP': document.getElementById('key-P'),
      'ArrowLeft': document.getElementById('key-Left'),
      'ArrowRight': document.getElementById('key-Right'),
    };

    this.activeKeys = new Set();
    this.initListeners();
    this.initTouchListeners();
  }

  initListeners() {
    window.addEventListener('keydown', (e) => this.handleKeyDown(e));
    window.addEventListener('keyup', (e) => this.handleKeyUp(e));
  }

  handleKeyDown(e) {
    if (e.repeat) return; // Ignore auto-repeat to require deliberate taps for track shifts
    this.activeKeys.add(e.code);
    this.highlightKey(e.code, true);

    switch (e.code) {
      // Front Bogie: Left
      case 'KeyA':
      case 'KeyQ':
        e.preventDefault();
        this.handlers.onMoveFront?.(-1);
        break;

      // Front Bogie: Right
      case 'KeyD':
      case 'KeyE':
        e.preventDefault();
        this.handlers.onMoveFront?.(1);
        break;

      // Rear Bogie: Left
      case 'ArrowLeft':
      case 'KeyJ':
      case 'KeyZ':
        e.preventDefault();
        this.handlers.onMoveRear?.(-1);
        break;

      // Rear Bogie: Right
      case 'ArrowRight':
      case 'KeyL':
      case 'KeyC':
        e.preventDefault();
        this.handlers.onMoveRear?.(1);
        break;

      // Quick Align: Straighten train (align rear to front)
      case 'KeyW':
      case 'ArrowUp':
        e.preventDefault();
        this.handlers.onStraighten?.();
        break;

      // Center both bogies
      case 'KeyS':
      case 'ArrowDown':
        e.preventDefault();
        this.handlers.onCenter?.();
        break;

      // Action / Start / Restart
      case 'Space':
      case 'Enter':
        e.preventDefault();
        this.handlers.onAction?.();
        break;

      // Locomotive Horn / Whistle
      case 'KeyH':
        e.preventDefault();
        this.handlers.onHorn?.();
        break;

      // Pause / Resume
      case 'KeyP':
      case 'Escape':
        e.preventDefault();
        this.handlers.onPause?.();
        break;

      // Cycle Train Skin
      case 'KeyT':
        e.preventDefault();
        this.handlers.onCycleSkin?.();
        break;

      // Mute / Sound Toggle
      case 'KeyM':
        e.preventDefault();
        this.handlers.onMute?.();
        break;
    }
  }

  handleKeyUp(e) {
    this.activeKeys.delete(e.code);
    this.highlightKey(e.code, false);
  }

  highlightKey(code, isActive) {
    const el = this.keyElements[code];
    if (el) {
      if (isActive) {
        el.classList.add('active');
      } else {
        el.classList.remove('active');
      }
    }
  }

  initTouchListeners() {
    const bindControl = (id, action) => {
      const el = document.getElementById(id);
      if (!el) return;

      const onPress = (e) => {
        if (e.cancelable) e.preventDefault();
        el.classList.add('active');
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
          try { navigator.vibrate(20); } catch {}
        }
        action();
      };

      const onRelease = (e) => {
        if (e.cancelable) e.preventDefault();
        el.classList.remove('active');
      };

      el.addEventListener('pointerdown', onPress, { passive: false });
      el.addEventListener('pointerup', onRelease, { passive: false });
      el.addEventListener('pointercancel', onRelease, { passive: false });
      el.addEventListener('pointerleave', onRelease, { passive: false });
    };

    // Mobile Touch HUD (2 Left buttons & 2 Right buttons + Center Align)
    bindControl('touch-front-left', () => this.handlers.onMoveFront?.(-1));
    bindControl('touch-rear-left', () => this.handlers.onMoveRear?.(-1));
    bindControl('touch-front-right', () => this.handlers.onMoveFront?.(1));
    bindControl('touch-rear-right', () => this.handlers.onMoveRear?.(1));
    bindControl('touch-align', () => this.handlers.onStraighten?.());

    // Desktop Cab Console clickable keys
    bindControl('key-A', () => this.handlers.onMoveFront?.(-1));
    bindControl('key-D', () => this.handlers.onMoveFront?.(1));
    bindControl('key-Left', () => this.handlers.onMoveRear?.(-1));
    bindControl('key-Right', () => this.handlers.onMoveRear?.(1));
    bindControl('key-W', () => this.handlers.onStraighten?.());
    bindControl('key-H', () => this.handlers.onHorn?.());
    bindControl('key-P', () => this.handlers.onPause?.());
  }
}
