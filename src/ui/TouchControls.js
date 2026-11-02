export class InputManager {
  constructor() {
    this.forward = 0;
    this.turn = 0;
    this.isSprinting = false;
    this.onJump = null;
    this.onChatOpen = null;
    this.enabled = false; // Bloqueado até o jogador definir o nome

    this.joystickTouchId = null;
    this.joystickCenter = { x: 0, y: 0 };
    this.runHeld = false;

    this.initKeyboard();
    this.initTouch();
  }

  initKeyboard() {
    window.addEventListener('keydown', (e) => {
      // Don't capture keys if typing in modal or chat input
      if (document.activeElement && document.activeElement.tagName === 'INPUT') {
        if (e.key === 'Escape') document.activeElement.blur();
        return;
      }

      if (!this.enabled) return;

      switch (e.code) {
        case 'KeyW':
        case 'ArrowUp':
          this.forward = 1;
          break;
        case 'KeyS':
        case 'ArrowDown':
          this.forward = -0.6;
          break;
        case 'KeyA':
        case 'ArrowLeft':
          this.turn = 1;
          break;
        case 'KeyD':
        case 'ArrowRight':
          this.turn = -1;
          break;
        case 'Space':
          if (this.onJump) this.onJump();
          break;
        case 'ShiftLeft':
        case 'ShiftRight':
          this.isSprinting = true;
          break;
        case 'Enter':
          if (this.onChatOpen) this.onChatOpen();
          break;
      }
    });

    window.addEventListener('keyup', (e) => {
      if (document.activeElement && document.activeElement.tagName === 'INPUT') return;
      if (!this.enabled) {
        this.forward = 0;
        this.turn = 0;
        this.isSprinting = false;
        return;
      }

      switch (e.code) {
        case 'KeyW':
        case 'ArrowUp':
          if (this.forward > 0) this.forward = 0;
          break;
        case 'KeyS':
        case 'ArrowDown':
          if (this.forward < 0) this.forward = 0;
          break;
        case 'KeyA':
        case 'ArrowLeft':
          if (this.turn > 0) this.turn = 0;
          break;
        case 'KeyD':
        case 'ArrowRight':
          if (this.turn < 0) this.turn = 0;
          break;
        case 'ShiftLeft':
        case 'ShiftRight':
          this.isSprinting = false;
          break;
      }
    });
  }

  initTouch() {
    const isTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
    if (isTouch && document.body) {
      document.body.classList.add('has-touch');
    }

    const pad = document.getElementById('touch-joystick-zone');
    const knob = document.getElementById('touch-joystick-knob');
    if (!pad || !knob) return;

    const handleStart = (e) => {
      if (!this.enabled) return;
      e.preventDefault();
      const touch = e.changedTouches[0];
      this.joystickTouchId = touch.identifier;
      const rect = pad.getBoundingClientRect();
      this.joystickCenter = {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2
      };
      this.updateJoystick(touch.clientX, touch.clientY, knob);
    };

    const handleMove = (e) => {
      if (!this.enabled) return;
      e.preventDefault();
      for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        if (touch.identifier === this.joystickTouchId) {
          this.updateJoystick(touch.clientX, touch.clientY, knob);
          break;
        }
      }
    };

    const handleEnd = (e) => {
      for (let i = 0; i < e.changedTouches.length; i++) {
        if (e.changedTouches[i].identifier === this.joystickTouchId) {
          this.joystickTouchId = null;
          this.turn = 0;
          if (this.forward > 0 && !this.runHeld) this.forward = 0;
          knob.style.transform = `translate(0px, 0px)`;
          break;
        }
      }
    };

    pad.addEventListener('touchstart', handleStart, { passive: false });
    window.addEventListener('touchmove', handleMove, { passive: false });
    window.addEventListener('touchend', handleEnd);
    window.addEventListener('touchcancel', handleEnd);

    // Right side Action Buttons (Pular e Correr)
    const btnJump = document.getElementById('btn-jump');
    const btnRun = document.getElementById('btn-run');

    if (btnJump) {
      btnJump.addEventListener('touchstart', (e) => {
        if (!this.enabled) return;
        e.preventDefault();
        if (this.onJump) this.onJump();
      });
    }

    if (btnRun) {
      btnRun.addEventListener('touchstart', (e) => {
        if (!this.enabled) return;
        e.preventDefault();
        this.forward = 1;
        this.isSprinting = true;
        this.runHeld = true;
      });
      btnRun.addEventListener('touchend', (e) => {
        e.preventDefault();
        this.forward = 0;
        this.isSprinting = false;
        this.runHeld = false;
      });
    }
  }

  updateJoystick(clientX, clientY, knob) {
    if (!this.enabled) return;
    const maxRadius = 45;
    const dx = clientX - this.joystickCenter.x;
    const dy = clientY - this.joystickCenter.y;
    const dist = Math.hypot(dx, dy);
    const clampedDist = Math.min(dist, maxRadius);
    const angle = Math.atan2(dy, dx);

    const nx = Math.cos(angle) * clampedDist;
    const ny = Math.sin(angle) * clampedDist;

    knob.style.transform = `translate(${nx}px, ${ny}px)`;

    // Map X to turn (-1 to 1)
    this.turn = - (nx / maxRadius);

    // Joystick Y controls walking forward / backward
    if (!this.runHeld) {
      this.forward = - (ny / maxRadius);
    }
  }
}
