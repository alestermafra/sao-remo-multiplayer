// Procedural Audio Synthesizer using Web Audio API
// No external mp3/wav files required, instant 0-latency playback!

class SoundSystem {
  constructor() {
    this.ctx = null;
    this.engineOsc = null;
    this.engineGain = null;
    this.isEngineRunning = false;
    this.initialized = false;
  }

  init() {
    if (this.initialized) return;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioCtx();
      this.initialized = true;
    } catch (e) {
      console.warn('Web Audio not supported');
    }
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  // Buzina "Bi-Bi!"
  playHorn() {
    this.init();
    this.resume();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    
    // First beep
    this._beep(now, 520, 0.1);
    this._beep(now, 650, 0.1);

    // Second beep slightly after
    this._beep(now + 0.14, 520, 0.15);
    this._beep(now + 0.14, 650, 0.15);
  }

  _beep(startTime, freq, duration) {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(freq, startTime);
    gain.gain.setValueAtTime(0.15, startTime);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(startTime);
    osc.stop(startTime + duration);
  }

  // Coin / Delivery Completion Chime
  playDeliverySuccess() {
    this.init();
    this.resume();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
    notes.forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.08);
      gain.gain.setValueAtTime(0.2, now + idx * 0.08);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 0.25);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now + idx * 0.08);
      osc.stop(now + idx * 0.08 + 0.3);
    });
  }

  // Step sound for walking
  playFootstep() {
    this.init();
    this.resume();
    if (!this.ctx) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const now = this.ctx.currentTime;

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(120, now);
    osc.frequency.exponentialRampToValueAtTime(40, now + 0.08);

    gain.gain.setValueAtTime(0.05, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.09);
  }

  // Jump sound
  playJump() {
    this.init();
    this.resume();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(180, now);
    osc.frequency.exponentialRampToValueAtTime(420, now + 0.15);

    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.18);
  }

  // Bike bell
  playBikeBell() {
    this.init();
    this.resume();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    [1200, 1600].forEach((freq, i) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + i * 0.06);
      gain.gain.setValueAtTime(0.12, now + i * 0.06);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.06 + 0.15);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now + i * 0.06);
      osc.stop(now + i * 0.06 + 0.2);
    });
  }

  // Engine sound loop that modulates with speed
  startEngine() {
    this.init();
    this.resume();
    if (!this.ctx || this.isEngineRunning) return;

    this.engineOsc = this.ctx.createOscillator();
    this.engineGain = this.ctx.createGain();

    this.engineOsc.type = 'sawtooth';
    this.engineOsc.frequency.setValueAtTime(65, this.ctx.currentTime);
    this.engineGain.gain.setValueAtTime(0.04, this.ctx.currentTime);

    // Lowpass filter for deep muffled motorbike sound
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(400, this.ctx.currentTime);

    this.engineOsc.connect(filter);
    filter.connect(this.engineGain);
    this.engineGain.connect(this.ctx.destination);

    this.engineOsc.start();
    this.isEngineRunning = true;
  }

  updateEngine(speedNormalized) {
    if (!this.engineOsc || !this.isEngineRunning) return;
    const baseFreq = 65;
    const targetFreq = baseFreq + speedNormalized * 140;
    this.engineOsc.frequency.setTargetAtTime(targetFreq, this.ctx.currentTime, 0.05);
  }

  stopEngine() {
    if (this.engineOsc && this.isEngineRunning) {
      try {
        this.engineOsc.stop();
        this.engineOsc.disconnect();
      } catch (e) {}
      this.isEngineRunning = false;
    }
  }
}

export const sounds = new SoundSystem();

