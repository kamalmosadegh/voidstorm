// All sound is synthesised with WebAudio: no audio files, nothing to load.
// Short oscillator blips for shots and explosions, a noise burst for hits,
// and a small step sequencer that loops a bass line and an arpeggio as music.

export class Sound {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.musicTimer = null;
    this.step = 0;
  }

  /** Browsers unlock audio on a user gesture; call this from clicks and keys. */
  unlock() {
    if (this.ctx !== null) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (Ctor === undefined) return;
    this.ctx = new Ctor();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.35;
    this.master.connect(this.ctx.destination);
    this.startMusic();
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.35;
    return this.muted;
  }

  tone(freq, dur, type = 'square', vol = 0.5, slideTo = null, delay = 0) {
    if (this.ctx === null || this.muted) return;
    const t0 = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo !== null) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(gain).connect(this.master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  noise(dur, vol = 0.5, delay = 0) {
    if (this.ctx === null || this.muted) return;
    const t0 = this.ctx.currentTime + delay;
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    const gain = this.ctx.createGain();
    gain.gain.value = vol;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 900;
    src.connect(filter).connect(gain).connect(this.master);
    src.start(t0);
  }

  shoot() { this.tone(880, 0.07, 'square', 0.10, 220); }
  enemyHit() { this.tone(300, 0.05, 'sawtooth', 0.10, 160); }
  explode(big = false) {
    this.noise(big ? 0.5 : 0.22, big ? 0.7 : 0.35);
    this.tone(big ? 120 : 180, big ? 0.45 : 0.2, 'triangle', 0.5, 40);
  }
  playerHit() {
    this.tone(140, 0.25, 'sawtooth', 0.5, 60);
    this.noise(0.18, 0.4);
  }
  dash() { this.noise(0.12, 0.15); this.tone(500, 0.12, 'sine', 0.15, 900); }
  pickup() { this.tone(660, 0.08, 'sine', 0.3); this.tone(990, 0.12, 'sine', 0.3, null, 0.07); }
  upgrade() {
    this.tone(523, 0.1, 'triangle', 0.35);
    this.tone(659, 0.1, 'triangle', 0.35, null, 0.09);
    this.tone(784, 0.16, 'triangle', 0.35, null, 0.18);
  }
  waveClear() { this.upgrade(); }
  gameOver() {
    this.tone(392, 0.25, 'triangle', 0.4);
    this.tone(311, 0.25, 'triangle', 0.4, null, 0.22);
    this.tone(233, 0.5, 'triangle', 0.4, null, 0.44);
  }
  victory() {
    [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.22, 'triangle', 0.35, null, i * 0.13));
  }

  /** A 16-step loop: minor-key bass on the beat, a soft arp above it. */
  startMusic() {
    const bass = [110, 0, 110, 0, 130.8, 0, 110, 0, 98, 0, 98, 0, 146.8, 0, 164.8, 0];
    const arp = [440, 523, 659, 523, 440, 523, 784, 659, 392, 494, 587, 494, 440, 587, 659, 784];
    this.musicTimer = setInterval(() => {
      if (this.ctx === null || this.muted) return;
      const i = this.step % 16;
      if (bass[i] > 0) this.tone(bass[i], 0.16, 'triangle', 0.20);
      if (i % 2 === 0) this.tone(arp[i], 0.1, 'sine', 0.06);
      this.step++;
    }, 132);
  }
}
