// Procedural audio: every sound and the generative music are synthesised with
// the Web Audio API (no audio files, no licensing questions).

const NOTE = (midi) => 440 * Math.pow(2, (midi - 69) / 12);

// Chord progressions (MIDI notes). Pads use the first notes, melodies the rest.
const SONGS = {
  menu: { bpm: 62, chords: [[50, 62, 66, 69, 73], [47, 62, 66, 69, 71], [43, 59, 62, 66, 69], [45, 61, 64, 66, 69]] },
  peaks: { bpm: 70, chords: [[50, 62, 66, 69, 73], [47, 62, 66, 69, 71], [43, 59, 62, 66, 71], [45, 61, 64, 69, 71]] },
  forest: { bpm: 66, chords: [[40, 59, 62, 66, 67], [48, 60, 64, 67, 71], [43, 59, 62, 64, 67], [38, 57, 62, 66, 69]] },
  village: { bpm: 72, chords: [[41, 60, 64, 67, 71], [38, 57, 60, 64, 65], [46, 58, 62, 65, 69], [48, 60, 64, 67, 69]] },
  blizzard: { bpm: 76, chords: [[36, 55, 58, 62, 63], [44, 56, 60, 63, 67], [41, 56, 60, 63, 65], [43, 55, 60, 62, 65]] },
  aurora: { bpm: 64, chords: [[45, 61, 64, 68, 71], [42, 61, 64, 66, 69], [38, 62, 66, 68, 69], [40, 59, 64, 68, 71]] },
};

const MOTE_VOICE = {
  brume: { oct: 24, kind: 'glass', gain: 0.16 },
  sec: { oct: 12, kind: 'celesta', gain: 0.18 },
  froid: { oct: 24, kind: 'tiny', gain: 0.12 },
  givre: { oct: 0, kind: 'marimba', gain: 0.2 },
  aurore: { oct: 12, kind: 'bell', gain: 0.1 },
  tourbillon: { oct: 12, kind: 'glass', gain: 0.14 },
};

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.ok = typeof window !== 'undefined' && !!(window.AudioContext || window.webkitAudioContext);
    this.musicVol = 0.6;
    this.sfxVol = 0.85;
    this.song = null;
    this.songKey = null;
    this.bar = 0;
    this.nextBarTime = 0;
    this.eighth = 0;
    this.slots = new Map(); // quantized mote notes
    this.timer = null;
    this.windLevel = 0;
    this.sizzle = 0;
  }

  unlock() {
    if (!this.ok) return;
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      try {
        this.ctx = new AC({ latencyHint: 'interactive' });
      } catch {
        this.ok = false;
        return;
      }
      this.build();
    }
    if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
  }

  build() {
    const c = this.ctx;
    this.master = c.createGain();
    this.master.gain.value = 0.9;
    const comp = c.createDynamicsCompressor();
    comp.threshold.value = -16;
    comp.ratio.value = 4;
    comp.attack.value = 0.005;
    comp.release.value = 0.2;
    this.master.connect(comp).connect(c.destination);

    this.reverb = c.createConvolver();
    this.reverb.buffer = this.impulse(2.8, 2.6);
    this.reverbGain = c.createGain();
    this.reverbGain.gain.value = 0.5;
    this.reverb.connect(this.reverbGain).connect(this.master);

    this.musicBus = c.createGain();
    this.sfxBus = c.createGain();
    this.ambBus = c.createGain();
    this.musicBus.connect(this.master);
    this.sfxBus.connect(this.master);
    this.ambBus.connect(this.master);
    this.musicSend = c.createGain();
    this.musicSend.gain.value = 0.7;
    this.musicBus.connect(this.musicSend).connect(this.reverb);
    this.sfxSend = c.createGain();
    this.sfxSend.gain.value = 0.35;
    this.sfxBus.connect(this.sfxSend).connect(this.reverb);
    this.applyVolumes();

    this.noise = this.noiseBuffer(2);
    // Wind ambience: band-passed noise with a slow swell.
    const wind = c.createBufferSource();
    wind.buffer = this.noise;
    wind.loop = true;
    this.windFilter = c.createBiquadFilter();
    this.windFilter.type = 'bandpass';
    this.windFilter.frequency.value = 420;
    this.windFilter.Q.value = 0.6;
    this.windGain = c.createGain();
    this.windGain.gain.value = 0;
    wind.connect(this.windFilter).connect(this.windGain).connect(this.ambBus);
    wind.start();
    // Thaw sizzle.
    const fizz = c.createBufferSource();
    fizz.buffer = this.noise;
    fizz.loop = true;
    const hp = c.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 3500;
    this.sizzleGain = c.createGain();
    this.sizzleGain.gain.value = 0;
    fizz.connect(hp).connect(this.sizzleGain).connect(this.ambBus);
    fizz.start();

    this.timer = setInterval(() => this.schedule(), 40);
  }

  impulse(seconds, decay) {
    const c = this.ctx;
    const len = Math.floor(c.sampleRate * seconds);
    const buf = c.createBuffer(2, len, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
    return buf;
  }

  noiseBuffer(seconds) {
    const c = this.ctx;
    const len = Math.floor(c.sampleRate * seconds);
    const buf = c.createBuffer(1, len, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  setVolumes(music, sfx) {
    this.musicVol = music;
    this.sfxVol = sfx;
    this.applyVolumes();
  }

  applyVolumes() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.musicBus.gain.setTargetAtTime(this.musicVol * 0.55, t, 0.1);
    this.sfxBus.gain.setTargetAtTime(this.sfxVol, t, 0.05);
    this.ambBus.gain.setTargetAtTime(Math.max(this.sfxVol, this.musicVol) * 0.8, t, 0.1);
  }

  suspend() {
    if (this.ctx && this.ctx.state === 'running') this.ctx.suspend().catch(() => {});
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
  }

  get now() {
    return this.ctx ? this.ctx.currentTime : 0;
  }

  // ------------------------------------------------------------ voices

  env(gainNode, when, attack, peak, decay) {
    const g = gainNode.gain;
    g.setValueAtTime(0.0001, when);
    g.exponentialRampToValueAtTime(Math.max(0.0002, peak), when + attack);
    g.exponentialRampToValueAtTime(0.0001, when + attack + decay);
  }

  voice(freq, when, { kind = 'glass', gain = 0.2, dur = 1.2, pan = 0, bus } = {}) {
    if (!this.ctx) return;
    const c = this.ctx;
    const out = c.createGain();
    let node = out;
    if (pan && c.createStereoPanner) {
      const p = c.createStereoPanner();
      p.pan.value = Math.max(-1, Math.min(1, pan));
      out.connect(p);
      node = p;
    }
    node.connect(bus || this.sfxBus);
    const stopAt = when + dur + 0.1;
    const osc = (type, f, g) => {
      const o = c.createOscillator();
      o.type = type;
      o.frequency.setValueAtTime(f, when);
      const gn = c.createGain();
      gn.gain.value = g;
      o.connect(gn).connect(out);
      o.start(when);
      o.stop(stopAt);
      return o;
    };
    switch (kind) {
      case 'celesta':
        osc('sine', freq, 1);
        osc('sine', freq * 2, 0.25);
        osc('sine', freq * 4.2, 0.05);
        this.env(out, when, 0.004, gain, dur);
        break;
      case 'tiny':
        osc('sine', freq, 1);
        osc('sine', freq * 2.76, 0.18);
        this.env(out, when, 0.002, gain, dur * 0.4);
        break;
      case 'marimba': {
        const o = osc('sine', freq * 1.5, 1);
        o.frequency.exponentialRampToValueAtTime(freq, when + 0.03);
        osc('sine', freq * 4, 0.08);
        this.env(out, when, 0.003, gain, dur * 0.45);
        break;
      }
      case 'bell': {
        const carrier = c.createOscillator();
        carrier.frequency.value = freq;
        const mod = c.createOscillator();
        mod.frequency.value = freq * 1.4;
        const mg = c.createGain();
        mg.gain.setValueAtTime(freq * 2.2, when);
        mg.gain.exponentialRampToValueAtTime(freq * 0.05, when + dur);
        mod.connect(mg).connect(carrier.frequency);
        carrier.connect(out);
        carrier.start(when);
        mod.start(when);
        carrier.stop(stopAt);
        mod.stop(stopAt);
        this.env(out, when, 0.003, gain, dur);
        break;
      }
      case 'pad': {
        const f = c.createBiquadFilter();
        f.type = 'lowpass';
        f.frequency.value = 900;
        f.Q.value = 0.3;
        f.connect(out);
        for (const det of [-6, 5]) {
          const o = c.createOscillator();
          o.type = 'triangle';
          o.frequency.value = freq;
          o.detune.value = det;
          o.connect(f);
          o.start(when);
          o.stop(stopAt);
        }
        const g = out.gain;
        g.setValueAtTime(0.0001, when);
        g.exponentialRampToValueAtTime(gain, when + dur * 0.35);
        g.setValueAtTime(gain, when + dur * 0.6);
        g.exponentialRampToValueAtTime(0.0001, when + dur);
        break;
      }
      case 'glass':
      default:
        osc('sine', freq, 1);
        osc('sine', freq * 2.01, 0.3);
        osc('triangle', freq * 3.98, 0.04);
        this.env(out, when, 0.003, gain, dur);
        break;
    }
  }

  noiseHit(when, { type = 'highpass', freq = 3000, q = 0.7, gain = 0.3, dur = 0.08, bus } = {}) {
    if (!this.ctx) return;
    const c = this.ctx;
    const src = c.createBufferSource();
    src.buffer = this.noise;
    const f = c.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = c.createGain();
    src.connect(f).connect(g).connect(bus || this.sfxBus);
    this.env(g, when, 0.002, gain, dur);
    src.start(when, Math.random() * 1.5);
    src.stop(when + dur + 0.05);
  }

  // ------------------------------------------------------------- music

  playSong(key) {
    if (this.songKey === key) return;
    this.songKey = key;
    this.song = SONGS[key] || SONGS.menu;
    if (this.ctx) {
      this.bar = 0;
      this.nextBarTime = this.ctx.currentTime + 0.3;
    }
  }

  get barLength() {
    return (60 / this.song.bpm) * 4;
  }

  currentChord() {
    const s = this.song || SONGS.menu;
    return s.chords[(this.bar + s.chords.length - 1) % s.chords.length];
  }

  schedule() {
    if (!this.ctx || !this.song || this.ctx.state !== 'running') return;
    const now = this.ctx.currentTime;
    if (this.nextBarTime < now - 1) this.nextBarTime = now + 0.1;
    while (this.nextBarTime < now + 0.35) {
      const s = this.song;
      const chord = s.chords[this.bar % s.chords.length];
      const t0 = this.nextBarTime;
      const L = this.barLength;
      // Pad: root + three tones, long and soft.
      const padNotes = [chord[0], chord[1], chord[2], chord[3]];
      padNotes.forEach((m, i) => this.voice(NOTE(m), t0, { kind: 'pad', gain: i === 0 ? 0.05 : 0.035, dur: L * 1.9, bus: this.musicBus }));
      // Sparse music-box melody.
      const beats = 8;
      for (let i = 0; i < beats; i++) {
        if (Math.random() < (i % 2 === 0 ? 0.22 : 0.1)) {
          const m = chord[1 + Math.floor(Math.random() * (chord.length - 1))] + 12;
          this.voice(NOTE(m), t0 + (i * L) / beats, { kind: 'celesta', gain: 0.07, dur: 1.6, pan: Math.random() * 0.8 - 0.4, bus: this.musicBus });
        }
      }
      this.nextBarTime += L;
      this.bar++;
    }
  }

  /** Time of the next eighth note (for quantized gameplay notes). */
  nextSlot() {
    if (!this.song) return this.now + 0.01;
    const step = this.barLength / 8;
    const barStart = this.nextBarTime - this.barLength;
    const now = this.now + 0.02;
    const k = Math.ceil((now - barStart) / step);
    return barStart + k * step;
  }

  // -------------------------------------------------------------- sfx

  mote(type, x = 180) {
    if (!this.ctx) return;
    const v = MOTE_VOICE[type];
    if (!v) return;
    const when = this.nextSlot();
    const key = `${type}@${when.toFixed(3)}`;
    if (this.slots.has(key)) return;
    this.slots.set(key, true);
    if (this.slots.size > 64) this.slots.clear();
    const chord = this.currentChord();
    const idx = 1 + Math.floor(Math.random() * (chord.length - 1));
    this.voice(NOTE(chord[idx] + v.oct), when, { kind: v.kind, gain: v.gain, dur: v.kind === 'bell' ? 1.6 : 1.1, pan: (x - 180) / 220 });
  }

  shard(n = 1, total = 5) {
    if (!this.ctx) return;
    const t = this.now + 0.01;
    const chord = this.currentChord();
    const base = chord[1] + 12 + Math.round((n / Math.max(1, total)) * 5);
    [0, 4, 7].forEach((iv, i) => this.voice(NOTE(base + iv + 12), t + i * 0.06, { kind: 'bell', gain: 0.09, dur: 1.2 }));
  }

  hit(kind = 'pellet', core = false) {
    if (!this.ctx) return;
    const t = this.now + 0.005;
    this.noiseHit(t, { type: 'highpass', freq: 2500, gain: 0.35, dur: 0.07 });
    this.voice(NOTE(core ? 88 : 93), t, { kind: 'tiny', gain: 0.22, dur: 0.5 });
    this.voice(NOTE(core ? 81 : 86), t + 0.02, { kind: 'tiny', gain: 0.14, dur: 0.4 });
    if (kind === 'hail' || kind === 'bird' || kind === 'branch' || core) {
      this.voice(110, t, { kind: 'marimba', gain: 0.35, dur: 0.5 });
      this.noiseHit(t, { type: 'lowpass', freq: 400, gain: 0.4, dur: 0.18 });
    }
  }

  merge() {
    if (!this.ctx) return;
    const t = this.now + 0.01;
    this.noiseHit(t, { type: 'lowpass', freq: 900, gain: 0.25, dur: 0.25 });
    const chord = this.currentChord();
    chord.slice(1, 4).forEach((m, i) => this.voice(NOTE(m + 12), t + i * 0.03, { kind: 'glass', gain: 0.08, dur: 1 }));
  }

  land() {
    if (!this.ctx) return;
    const t = this.now + 0.02;
    this.noiseHit(t, { type: 'lowpass', freq: 700, gain: 0.18, dur: 0.3 });
    // Camera shutter.
    this.noiseHit(t + 0.35, { type: 'bandpass', freq: 3200, q: 2, gain: 0.45, dur: 0.025 });
    this.noiseHit(t + 0.42, { type: 'bandpass', freq: 2200, q: 2, gain: 0.35, dur: 0.035 });
    const chord = this.currentChord();
    chord.slice(1).forEach((m, i) => this.voice(NOTE(m + 12), t + 0.5 + i * 0.09, { kind: 'bell', gain: 0.08, dur: 2.4 }));
  }

  fail() {
    if (!this.ctx) return;
    const t = this.now + 0.02;
    [76, 72, 69, 64].forEach((m, i) => this.voice(NOTE(m), t + i * 0.16, { kind: 'celesta', gain: 0.12, dur: 1.4 }));
    this.noiseHit(t, { type: 'lowpass', freq: 600, gain: 0.2, dur: 0.9 });
  }

  newType() {
    if (!this.ctx) return;
    const t = this.now + 0.05;
    const chord = this.currentChord();
    const notes = [chord[1], chord[2], chord[3], chord[4], chord[1] + 12, chord[2] + 12, chord[3] + 12];
    notes.forEach((m, i) => this.voice(NOTE(m + 12), t + i * 0.07, { kind: 'glass', gain: 0.1, dur: 1.5, pan: -0.6 + i * 0.2 }));
  }

  ui(kind = 'tap') {
    if (!this.ctx) return;
    const t = this.now + 0.005;
    if (kind === 'back') this.voice(NOTE(79), t, { kind: 'tiny', gain: 0.1, dur: 0.25 });
    else if (kind === 'start') {
      this.voice(NOTE(74), t, { kind: 'celesta', gain: 0.14, dur: 0.9 });
      this.voice(NOTE(81), t + 0.08, { kind: 'celesta', gain: 0.12, dur: 1 });
    } else this.voice(NOTE(86), t, { kind: 'tiny', gain: 0.1, dur: 0.25 });
  }

  zone(type) {
    if (!this.ctx || !type) return;
    const t = this.now + 0.01;
    if (type === 'redoux') this.noiseHit(t, { type: 'bandpass', freq: 1200, q: 0.8, gain: 0.08, dur: 0.6 });
    else this.noiseHit(t, { type: 'bandpass', freq: 5200, q: 1.2, gain: 0.05, dur: 0.5 });
  }

  /** Continuous layers driven by the game state. */
  setAmbience(wind, sizzle, base = 0.05) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.windGain.gain.setTargetAtTime(base + Math.min(0.35, Math.abs(wind) / 350), t, 0.4);
    this.windFilter.frequency.setTargetAtTime(380 + Math.min(500, Math.abs(wind) * 3), t, 0.5);
    this.sizzleGain.gain.setTargetAtTime(sizzle * 0.06, t, 0.1);
  }
}
