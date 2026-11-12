/**
 * Fully procedural audio (WebAudio) — no asset downloads, nothing to license.
 * Engine note, tyre/landing thumps, coin chimes, a tiny ambient bed and UI clicks.
 * Every call is guarded: if the context is unavailable the game runs silently.
 */
export class AudioManager {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private sfxBus: GainNode | null = null;
  private musicBus: GainNode | null = null;
  private engineOsc: OscillatorNode | null = null;
  private engineOsc2: OscillatorNode | null = null;
  private engineFilter: BiquadFilterNode | null = null;
  private engineGain: GainNode | null = null;
  private musicTimer: number | null = null;
  private musicStep = 0;

  private sfxVolume = 0.8;
  private musicVolume = 0.35;
  private muted = false;

  get enabled(): boolean {
    return this.ctx !== null;
  }

  /** Must be called from a user gesture (click / tap / keydown). */
  init(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    try {
      const Ctor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 1;
      this.master.connect(this.ctx.destination);

      this.sfxBus = this.ctx.createGain();
      this.sfxBus.gain.value = this.sfxVolume;
      this.sfxBus.connect(this.master);

      this.musicBus = this.ctx.createGain();
      this.musicBus.gain.value = this.musicVolume * 0.5;
      this.musicBus.connect(this.master);

      this.buildEngine();
    } catch {
      this.ctx = null;
    }
  }

  resume(): void {
    if (this.ctx?.state === 'suspended') void this.ctx.resume();
  }

  suspend(): void {
    if (this.ctx?.state === 'running') void this.ctx.suspend();
  }

  setVolumes(sfx: number, music: number, muted: boolean): void {
    this.sfxVolume = sfx;
    this.musicVolume = music;
    this.muted = muted;
    if (this.ctx && this.master && this.sfxBus && this.musicBus) {
      const now = this.ctx.currentTime;
      this.master.gain.setTargetAtTime(muted ? 0 : 1, now, 0.05);
      this.sfxBus.gain.setTargetAtTime(sfx, now, 0.05);
      this.musicBus.gain.setTargetAtTime(music * 0.5, now, 0.05);
    }
  }

  private buildEngine(): void {
    if (!this.ctx || !this.sfxBus) return;
    const ctx = this.ctx;
    this.engineGain = ctx.createGain();
    this.engineGain.gain.value = 0;

    this.engineFilter = ctx.createBiquadFilter();
    this.engineFilter.type = 'lowpass';
    this.engineFilter.frequency.value = 520;
    this.engineFilter.Q.value = 6;

    this.engineOsc = ctx.createOscillator();
    this.engineOsc.type = 'sawtooth';
    this.engineOsc.frequency.value = 58;

    this.engineOsc2 = ctx.createOscillator();
    this.engineOsc2.type = 'square';
    this.engineOsc2.frequency.value = 87;
    this.engineOsc2.detune.value = 8;

    const sub = ctx.createGain();
    sub.gain.value = 0.35;

    this.engineOsc.connect(this.engineFilter);
    this.engineOsc2.connect(sub);
    sub.connect(this.engineFilter);
    this.engineFilter.connect(this.engineGain);
    this.engineGain.connect(this.sfxBus);

    this.engineOsc.start();
    this.engineOsc2.start();
  }

  /** speedRatio 0..1, throttle 0..1 */
  updateEngine(speedRatio: number, throttle: number, running: boolean): void {
    if (!this.ctx || !this.engineGain || !this.engineOsc || !this.engineOsc2 || !this.engineFilter) return;
    const now = this.ctx.currentTime;
    const target = running ? 0.05 + throttle * 0.11 + speedRatio * 0.07 : 0;
    this.engineGain.gain.setTargetAtTime(target, now, 0.08);
    const rpm = 52 + speedRatio * 190 + throttle * 26;
    this.engineOsc.frequency.setTargetAtTime(rpm, now, 0.09);
    this.engineOsc2.frequency.setTargetAtTime(rpm * 1.51, now, 0.09);
    this.engineFilter.frequency.setTargetAtTime(320 + speedRatio * 900 + throttle * 260, now, 0.1);
  }

  private blip(
    freq: number,
    duration: number,
    type: OscillatorType,
    gain: number,
    slideTo?: number,
  ): void {
    if (!this.ctx || !this.sfxBus) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), now + duration);
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(gain, now + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.connect(g);
    g.connect(this.sfxBus);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  private noise(duration: number, gain: number, filterFreq: number, sweepTo?: number): void {
    if (!this.ctx || !this.sfxBus) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const frames = Math.floor(ctx.sampleRate * duration);
    const buffer = ctx.createBuffer(1, frames, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < frames; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / frames);
    }
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(filterFreq, now);
    if (sweepTo) filter.frequency.exponentialRampToValueAtTime(sweepTo, now + duration);
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, now);
    g.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    src.connect(filter);
    filter.connect(g);
    g.connect(this.sfxBus);
    src.start(now);
  }

  playCoin(): void {
    this.blip(1180, 0.1, 'triangle', 0.16, 1760);
    setTimeout(() => this.blip(1760, 0.09, 'triangle', 0.1), 55);
  }

  playCrash(): void {
    this.noise(0.55, 0.5, 1400, 120);
    this.blip(120, 0.4, 'sawtooth', 0.22, 42);
  }

  playLanding(intensity: number): void {
    const k = Math.max(0.05, Math.min(1, intensity));
    this.noise(0.22, 0.16 + k * 0.3, 900, 90);
  }

  playJump(): void {
    this.blip(320, 0.16, 'sine', 0.08, 620);
  }

  playCheckpoint(): void {
    [523, 659, 784].forEach((f, i) => setTimeout(() => this.blip(f, 0.16, 'triangle', 0.12), i * 70));
  }

  playFinish(): void {
    [523, 659, 784, 1046].forEach((f, i) =>
      setTimeout(() => this.blip(f, 0.28, 'triangle', 0.14), i * 110),
    );
  }

  playClick(): void {
    this.blip(680, 0.05, 'square', 0.06, 520);
  }

  /** Very light generative bed: slow arpeggio over a drone. */
  startMusic(): void {
    if (!this.ctx || this.musicTimer !== null) return;
    const notes = [130.81, 155.56, 196.0, 233.08, 196.0, 155.56];
    const tick = () => {
      if (!this.ctx || !this.musicBus) return;
      const ctx = this.ctx;
      const now = ctx.currentTime;
      const freq = notes[this.musicStep % notes.length];
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      g.gain.setValueAtTime(0, now);
      g.gain.linearRampToValueAtTime(0.06, now + 0.6);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 2.4);
      osc.connect(g);
      g.connect(this.musicBus);
      osc.start(now);
      osc.stop(now + 2.5);
      this.musicStep++;
    };
    tick();
    this.musicTimer = window.setInterval(tick, 1500);
  }

  stopMusic(): void {
    if (this.musicTimer !== null) {
      window.clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
  }

  dispose(): void {
    this.stopMusic();
    this.updateEngine(0, 0, false);
    try {
      this.engineOsc?.stop();
      this.engineOsc2?.stop();
      void this.ctx?.close();
    } catch {
      /* ignore */
    }
    this.ctx = null;
    this.master = null;
    this.sfxBus = null;
    this.musicBus = null;
    this.engineOsc = null;
    this.engineOsc2 = null;
    this.engineFilter = null;
    this.engineGain = null;
  }
}
