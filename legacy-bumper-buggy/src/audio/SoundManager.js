/**
 * Procedural Web Audio synthesizer for cheerful toy-physics sound effects.
 * Zero external audio assets required — works offline and on any static host.
 */
export class SoundManager {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.initialized = false;

    // Continuous engine nodes
    this.engineOsc = null;
    this.engineSubOsc = null;
    this.engineGain = null;
    this.nitroNoiseGain = null;
  }

  init() {
    if (this.initialized) {
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
      return;
    }
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;

    this.ctx = new AudioCtx();
    this.initialized = true;
    this._setupEngineLoop();
  }

  _setupEngineLoop() {
    if (!this.ctx) return;

    // Warm toy motor hum (filtered triangle + sine sub)
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 260;

    this.engineGain = this.ctx.createGain();
    this.engineGain.gain.value = 0.0;

    this.engineOsc = this.ctx.createOscillator();
    this.engineOsc.type = 'sawtooth';
    this.engineOsc.frequency.value = 52;

    this.engineSubOsc = this.ctx.createOscillator();
    this.engineSubOsc.type = 'triangle';
    this.engineSubOsc.frequency.value = 26;

    const subGain = this.ctx.createGain();
    subGain.gain.value = 0.6;

    this.engineOsc.connect(filter);
    this.engineSubOsc.connect(subGain);
    subGain.connect(filter);
    filter.connect(this.engineGain);
    this.engineGain.connect(this.ctx.destination);

    this.engineFilter = filter;
    this.engineOsc.start();
    this.engineSubOsc.start();

    // Nitro white-noise whoosh
    const bufferSize = this.ctx.sampleRate * 1.5;
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = noiseBuffer;
    noise.loop = true;

    const band = this.ctx.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.value = 650;
    band.Q.value = 1.2;

    this.nitroNoiseGain = this.ctx.createGain();
    this.nitroNoiseGain.gain.value = 0;

    noise.connect(band);
    band.connect(this.nitroNoiseGain);
    this.nitroNoiseGain.connect(this.ctx.destination);
    noise.start();
  }

  setMuted(muted) {
    this.muted = muted;
    if (this.muted && this.engineGain && this.ctx) {
      this.engineGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.05);
      this.nitroNoiseGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.05);
    }
  }

  toggleMute() {
    this.setMuted(!this.muted);
    return this.muted;
  }

  updateEngine(speedRatio, throttleActive, nitroActive, playing) {
    if (!this.initialized || !this.ctx || !this.engineGain) return;
    const now = this.ctx.currentTime;

    if (this.muted || !playing) {
      this.engineGain.gain.setTargetAtTime(0, now, 0.06);
      this.nitroNoiseGain.gain.setTargetAtTime(0, now, 0.06);
      return;
    }

    const clamped = Math.min(Math.max(speedRatio, 0), 1.6);
    const baseFreq = 46 + clamped * 82 + (throttleActive ? 18 : 0) + (nitroActive ? 34 : 0);
    this.engineOsc.frequency.setTargetAtTime(baseFreq, now, 0.07);
    this.engineSubOsc.frequency.setTargetAtTime(baseFreq * 0.5, now, 0.07);
    this.engineFilter.frequency.setTargetAtTime(210 + clamped * 320 + (nitroActive ? 260 : 0), now, 0.08);

    const targetVol = throttleActive ? 0.055 : 0.024;
    this.engineGain.gain.setTargetAtTime(targetVol, now, 0.08);
    this.nitroNoiseGain.gain.setTargetAtTime(nitroActive ? 0.07 : 0, now, 0.06);
  }

  playCoin(combo = 0) {
    if (this.muted || !this.ctx) return;
    const now = this.ctx.currentTime;
    const pitchBoost = Math.min(combo * 35, 280);

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(780 + pitchBoost, now);
    osc.frequency.setValueAtTime(1175 + pitchBoost, now + 0.065);

    gain.gain.setValueAtTime(0.13, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.29);
  }

  playFuel() {
    if (this.muted || !this.ctx) return;
    const now = this.ctx.currentTime;
    const notes = [440, 554.37, 659.25, 880];
    notes.forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      const t = now + idx * 0.055;
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.12, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(t);
      osc.stop(t + 0.19);
    });
  }

  playTrick() {
    if (this.muted || !this.ctx) return;
    const now = this.ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      const t = now + idx * 0.06;
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.11, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(t);
      osc.stop(t + 0.26);
    });
  }

  playBounce(intensity = 0.5) {
    if (this.muted || !this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(95 + intensity * 55, now);
    osc.frequency.exponentialRampToValueAtTime(48, now + 0.14);

    gain.gain.setValueAtTime(Math.min(0.14, 0.04 + intensity * 0.09), now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.16);
  }

  playGameOver() {
    if (this.muted || !this.ctx) return;
    const now = this.ctx.currentTime;
    const notes = [392, 349.23, 311.13, 261.63];
    notes.forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      const t = now + idx * 0.14;
      osc.frequency.setValueAtTime(freq, t);
      osc.frequency.linearRampToValueAtTime(freq * 0.94, t + 0.13);
      gain.gain.setValueAtTime(0.13, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.26);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(t);
      osc.stop(t + 0.28);
    });
  }
}
