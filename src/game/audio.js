// Sound, synthesised.
//
// Every sound here is generated with oscillators and noise at runtime - there
// are no audio files to download, nothing to licence, and the whole thing adds
// about 6 KB to the bundle instead of several megabytes. For a game whose
// vocabulary is chimes, thuds, hammering and a rocket, that is a fair trade.
//
// Browsers refuse to start audio without a user gesture, so nothing is created
// until the first key press or click; before that every call is a no-op rather
// than an error.

/** Master volume. Children's game, likely no headphones: keep it modest. */
const MASTER_GAIN = 0.32;

export class Audio {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.enabled = true;
    this.lastFootstep = 0;

    // The first gesture unlocks playback. Once is enough.
    const unlock = () => {
      this.ensure();
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
  }

  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return this.ctx;
    }
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return null;
    this.ctx = new Ctor();
    this.master = this.ctx.createGain();
    this.master.gain.value = MASTER_GAIN;
    this.master.connect(this.ctx.destination);
    return this.ctx;
  }

  get ready() { return !!this.ctx && this.enabled; }
  setEnabled(on) {
    this.enabled = on;
    if (this.master) this.master.gain.value = on ? MASTER_GAIN : 0;
  }

  /** One shaped oscillator note. The building block for most of these. */
  tone(freq, { dur = 0.18, type = 'sine', gain = 0.5, at = 0, sweepTo = null, attack = 0.008 } = {}) {
    if (!this.ready) return;
    const t = this.ctx.currentTime + at;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (sweepTo) osc.frequency.exponentialRampToValueAtTime(Math.max(1, sweepTo), t + dur);

    // Exponential decay, because linear fades sound synthetic.
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);

    osc.connect(g).connect(this.master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  /** Filtered noise burst: footsteps, thuds, hammering, rocket exhaust. */
  noise(dur = 0.2, { gain = 0.3, at = 0, freq = 900, q = 1, type = 'bandpass', sweepTo = null } = {}) {
    if (!this.ready) return;
    const t = this.ctx.currentTime + at;
    const frames = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buffer = this.ctx.createBuffer(1, frames, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < frames; i++) data[i] = Math.random() * 2 - 1;

    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.setValueAtTime(freq, t);
    if (sweepTo) filter.frequency.exponentialRampToValueAtTime(Math.max(20, sweepTo), t + dur);
    filter.Q.value = q;

    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);

    src.connect(filter).connect(g).connect(this.master);
    src.start(t);
    src.stop(t + dur + 0.02);
  }

  // -------------------------------------------------------------------------
  // The game's vocabulary
  // -------------------------------------------------------------------------

  /** Soft scuff. Rate-limited, because it is driven from the movement loop. */
  footstep(running = false) {
    const now = performance.now();
    const gap = running ? 260 : 380;
    if (now - this.lastFootstep < gap) return;
    this.lastFootstep = now;
    this.noise(0.07, { gain: running ? 0.13 : 0.09, freq: 420 + Math.random() * 160, q: 1.4 });
  }

  /** Picking up a supply: a small bright two-note lift. */
  pickup() {
    this.tone(880, { dur: 0.09, type: 'triangle', gain: 0.32 });
    this.tone(1320, { dur: 0.13, type: 'triangle', gain: 0.26, at: 0.06 });
  }

  /** Right answer: a rising major arpeggio. Unmistakably "yes". */
  correct() {
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) =>
      this.tone(f, { dur: 0.3, type: 'triangle', gain: 0.3, at: i * 0.085 }));
  }

  /**
   * Wrong answer: gentle, low, short. Deliberately NOT a buzzer - a child who
   * is already unsure does not need to be told off by the sound design.
   */
  wrong() {
    this.tone(300, { dur: 0.16, type: 'sine', gain: 0.22, sweepTo: 232 });
  }

  /** A piece of a building dropping into place. */
  buildPiece(index = 0) {
    this.noise(0.11, { gain: 0.2, freq: 260 + index * 40, q: 2.2 });
    this.tone(150 + index * 22, { dur: 0.13, type: 'square', gain: 0.12 });
  }

  /** A structure finished. */
  buildComplete() {
    [392, 523.25, 659.25].forEach((f, i) =>
      this.tone(f, { dur: 0.38, type: 'triangle', gain: 0.26, at: i * 0.1 }));
  }

  /** A plank landing on the bridge: wood, not metal. */
  plank() {
    this.noise(0.14, { gain: 0.26, freq: 320, q: 1.6, sweepTo: 180 });
  }

  /** Station chime when a signpost becomes the active one. */
  stationReady() {
    this.tone(1174.66, { dur: 0.22, type: 'sine', gain: 0.2 });
    this.tone(1567.98, { dur: 0.26, type: 'sine', gain: 0.15, at: 0.09 });
  }

  /**
   * A single soft tick the instant "Press E" becomes available at whatever
   * the child is standing next to. This is distinct from `stationReady()`
   * (which marks a signpost becoming the world's ONE active target, once,
   * from a distance): this one fires every time the child arrives in reach
   * of something they can actually act on, so it has to be small enough to
   * hear a hundred times without noticing it as an effect.
   */
  promptReady() {
    this.tone(740, { dur: 0.07, type: 'sine', gain: 0.13 });
  }

  /** Rank up. Bigger than a correct answer, because it is. */
  rankUp() {
    [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) =>
      this.tone(f, { dur: 0.45, type: 'triangle', gain: 0.28, at: i * 0.09 }));
  }

  /**
   * Ignition and climb. A low rumble that builds, plus broadband exhaust that
   * sweeps down as she leaves - the sound equivalent of the camera pulling back.
   */
  ignition() {
    if (!this.ready) return;
    this.tone(58, { dur: 2.6, type: 'sawtooth', gain: 0.3, attack: 0.5 });
    this.tone(41, { dur: 3.0, type: 'square', gain: 0.16, attack: 0.7 });
    for (let i = 0; i < 10; i++) {
      this.noise(0.5, { gain: 0.2, freq: 700, q: 0.6, at: i * 0.28, sweepTo: 180 });
    }
  }

  /** Rolling exhaust while the engine burns. Call at intervals, not per frame. */
  exhaust() {
    this.noise(0.42, { gain: 0.11, freq: 520, q: 0.5, sweepTo: 160 });
  }

  /** Reaching orbit. */
  orbit() {
    [659.25, 783.99, 987.77, 1318.5].forEach((f, i) =>
      this.tone(f, { dur: 0.7, type: 'sine', gain: 0.26, at: i * 0.13 }));
  }

  /** Fell short. Descending, resigned, but not punishing. */
  shortfall() {
    [587.33, 493.88, 392].forEach((f, i) =>
      this.tone(f, { dur: 0.4, type: 'sine', gain: 0.22, at: i * 0.14 }));
  }
}

export const audio = new Audio();
