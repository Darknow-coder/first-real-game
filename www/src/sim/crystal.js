// Snow crystal growth model.
//
// A crystal has six arms. Every growth increment is appended to each arm as a
// radial "segment" whose look depends on the growth mode (plate, dendrite,
// needle, aurora). Dendritic modes spawn side branches that keep growing while
// the mode lasts, exactly like real snow crystals whose shape records the
// conditions met during the fall.
//
// The model is deterministic and *chunk-invariant*: growing by 0.1 ten times
// or by 1.0 once gives the same geometry. Thanks to this, a crystal can be
// rebuilt from a compact event log (used by the album).

import { hashString } from '../core/rng.js';
import { RNG } from '../core/rng.js';

export const MODE = Object.freeze({ PLATE: 0, DENDRITE: 1, NEEDLE: 2, AURORA: 3 });
export const MODE_KEYS = ['plate', 'dendrite', 'needle', 'aurora'];
export const ARM_COUNT = 6;
export const CORE_R = 2.2;
export const R_MAX = 50;

/** Weight profiles applied per arm (index 0 = symmetric). */
export const WEIGHTS = [null, [1, 0.42, 1, 0.42, 1, 0.42]];

/**
 * Intensities are quantized so that live play and replays match exactly.
 * Floor buckets: only the very core of the densest clouds reaches 1.
 */
export function quantize(q) {
  return Math.max(1, Math.min(4, Math.floor(q * 4 + 1e-9))) / 4;
}

function unitHash(seed, i, salt) {
  return hashString(`${seed}|${i}|${salt}`) / 4294967296;
}

function newArm() {
  return {
    R: CORE_R,
    segs: [], // {r0, r1, m, q, w}
    branches: [], // {r, len, m, q, act, fern, cap, capOk, max}
    beads: [], // {br (branch ref or null for spine), p (distance), side, s, o}
    mode: -1, // current growth mode (-1 = none / interrupted)
    nextAt: 0,
    idx: 0, // spawn counter, used for deterministic spacing
    broken: 0,
  };
}

export class Crystal {
  constructor(seed = 1) {
    this.seed = seed >>> 0;
    this.rng = new RNG(this.seed ^ 0x5bd1e995);
    this.arms = [];
    for (let k = 0; k < ARM_COUNT; k++) this.arms.push(newArm());
    this.log = [];
    this.logging = true;
    this.version = 0;
    this.grown = 0; // total radial growth (unweighted)
    this.grownBy = [0, 0, 0, 0]; // per mode
    this.twisted = 0; // growth done with triangular weights
    this.melted = 0;
    this.hits = 0;
    this.beadCount = 0;
    this.attached = []; // aggregated crystals {c, ox, oy, rot}
    this.twelve = false;
  }

  /** Largest arm radius. */
  get R() {
    let r = 0;
    for (const a of this.arms) if (a.R > r) r = a.R;
    return r;
  }

  get Rmin() {
    let r = Infinity;
    for (const a of this.arms) if (a.R < r) r = a.R;
    return r;
  }

  get Ravg() {
    let r = 0;
    for (const a of this.arms) r += a.R;
    return r / ARM_COUNT;
  }

  // ---------------------------------------------------------------- growth

  /**
   * Grow every arm by `dr` (world units) in the given mode.
   * @param {number} mode MODE.*
   * @param {number} dr radial growth
   * @param {number} q intensity 0..1 (quantized internally)
   * @param {number} wId weight profile id (0 symmetric, 1 triangular)
   */
  grow(mode, dr, q = 1, wId = 0) {
    if (!(dr > 0)) return;
    q = quantize(q);
    const weights = WEIGHTS[wId] || null;
    for (let k = 0; k < ARM_COUNT; k++) {
      const d = dr * (weights ? weights[k] : 1);
      if (d > 0) this._growArm(this.arms[k], mode, d, q);
    }
    this.grown += dr;
    this.grownBy[mode] += dr;
    if (wId === 1) this.twisted += dr;
    this.version++;
    if (this.logging) {
      const last = this.log[this.log.length - 1];
      if (last && last[0] === 'g' && last[1] === mode && last[2] === q && last[3] === wId) last[4] += dr;
      else this.log.push(['g', mode, q, wId, dr]);
    }
  }

  _spacing(arm, mode, q) {
    const h = unitHash(this.seed, arm.idx, 'sp');
    if (mode === MODE.NEEDLE) return (7 - 2.5 * q) * (0.7 + 0.6 * h);
    if (mode === MODE.AURORA) return 3.4 * (0.85 + 0.3 * h);
    return (4.6 - 2.3 * q) * (0.85 + 0.3 * h);
  }

  _growArm(arm, mode, d, q) {
    const spawns = mode !== MODE.PLATE;
    if (arm.mode !== mode) {
      // Mode change: side branches stop growing. When switching to plate
      // growth, their tips become eligible for small plate caps.
      for (const b of arm.branches) {
        b.capOk = b.act && mode === MODE.PLATE;
        b.act = false;
      }
      arm.mode = mode;
      if (spawns) arm.nextAt = arm.R + this._spacing(arm, mode, q) * 0.55;
    }
    let spine = Math.min(d, Math.max(0, R_MAX - arm.R));
    const extra = d - spine; // growth beyond R_MAX only thickens branches
    let guard = 0;
    while (spine > 1e-9 && guard++ < 10000) {
      let step = spine;
      if (spawns && arm.nextAt > arm.R) step = Math.min(step, arm.nextAt - arm.R);
      this._extend(arm, mode, step, q);
      arm.R += step;
      this._growBranches(arm, mode, step);
      spine -= step;
      if (spawns && arm.R >= arm.nextAt - 1e-9) {
        this._spawn(arm, mode, q);
        arm.idx++;
        arm.nextAt = arm.R + this._spacing(arm, mode, q);
      }
    }
    if (extra > 0) {
      this._growBranches(arm, mode, extra);
      const last = arm.segs[arm.segs.length - 1];
      if (mode === MODE.PLATE && last && last.m === MODE.PLATE) last.w += extra * 0.85;
    }
  }

  _extend(arm, mode, step, q) {
    const last = arm.segs[arm.segs.length - 1];
    if (last && last.m === mode && Math.abs(last.r1 - arm.R) < 1e-6) {
      // Same mode: one continuous segment (the intensity only matters at
      // branch spawn time).
      last.r1 += step;
      last.q = q;
    } else {
      arm.segs.push({ r0: arm.R, r1: arm.R + step, m: mode, q, w: 0 });
    }
    if (mode === MODE.PLATE) arm.segs[arm.segs.length - 1].w += step * 0.85;
  }

  _growBranches(arm, mode, step) {
    for (const b of arm.branches) {
      if (b.act) {
        const rate = b.m === MODE.AURORA ? 0.62 : 0.55 + 0.35 * b.q;
        b.len = Math.min(b.len + step * rate, b.max);
      } else if (b.capOk && mode === MODE.PLATE) {
        if (b.len > 2) b.cap = Math.min(b.cap + step * 0.22, 1.5);
      }
    }
  }

  _spawn(arm, mode, q) {
    const r = Math.max(CORE_R, arm.R - 0.2);
    const max = Math.min(0.92 * r, 24);
    if (mode === MODE.NEEDLE) {
      const h = unitHash(this.seed, arm.idx, 'nl');
      arm.branches.push({ r, len: Math.min(max, 1.2 + 2.4 * h), m: mode, q, act: false, fern: false, cap: 0, capOk: false, max });
    } else {
      arm.branches.push({ r, len: 0, m: mode, q, act: true, fern: mode === MODE.DENDRITE && q >= 1, cap: 0, capOk: false, max });
    }
  }

  // ------------------------------------------------------------ modifiers

  /** Melting: arms shrink, branches shorten, plates thin out. */
  melt(dr) {
    if (!(dr > 0)) return;
    for (const arm of this.arms) {
      const newR = Math.max(0.6, arm.R - dr);
      this._truncate(arm, newR);
      for (const b of arm.branches) {
        b.len = Math.max(0, b.len - dr * 0.8);
        b.cap = Math.max(0, b.cap - dr * 0.5);
        b.act = false;
        b.capOk = false;
      }
      for (const s of arm.segs) if (s.m === MODE.PLATE) s.w = Math.max(0, s.w - dr * 0.6);
      arm.branches = arm.branches.filter((b) => b.len > 0.05 || b.cap > 0.05);
      arm.mode = -1;
      this._pruneBeads(arm);
    }
    this.melted += dr;
    this.version++;
    if (this.logging) {
      const last = this.log[this.log.length - 1];
      if (last && last[0] === 'm') last[1] += dr;
      else this.log.push(['m', dr]);
    }
  }

  /** Add `n` rime beads (frozen droplets) at random places on the crystal. */
  rime(n = 1) {
    let added = 0;
    for (let i = 0; i < n; i++) {
      // Always consume the same amount of randomness per bead (replay safety).
      const k = Math.floor(this.rng.next() * ARM_COUNT);
      const onBranch = this.rng.next();
      const pick = this.rng.next();
      const pos = this.rng.next();
      const side = this.rng.next() < 0.5 ? -1 : 1;
      const size = 0.35 + this.rng.next() * 0.45;
      const off = -0.3 + this.rng.next() * 0.8;
      const arm = this.arms[k];
      if (arm.beads.length >= 80) continue;
      const grown = arm.branches.filter((b) => b.len > 0.8);
      if (grown.length && onBranch < 0.55) {
        const b = grown[Math.floor(pick * grown.length)];
        arm.beads.push({ br: b, p: (0.25 + pos * 0.75) * b.len, side, s: size, o: off });
      } else {
        const r = CORE_R * 0.8 + pos * Math.max(0.1, arm.R - CORE_R * 0.8);
        arm.beads.push({ br: null, p: r, side, s: size, o: off });
      }
      added++;
    }
    this.beadCount += added;
    this.version++;
    if (this.logging) {
      const last = this.log[this.log.length - 1];
      if (last && last[0] === 'r') last[1] += n;
      else this.log.push(['r', n]);
    }
  }

  /** Break arm `k` at radius `atR` (a hazard hit it). */
  breakArm(k, atR) {
    const arm = this.arms[((k % ARM_COUNT) + ARM_COUNT) % ARM_COUNT];
    const r = Math.max(CORE_R * 0.9, Math.min(arm.R, atR));
    if (r >= arm.R - 0.05) return false;
    this._truncate(arm, r);
    for (const b of arm.branches) {
      b.act = false;
      b.capOk = false;
    }
    arm.mode = -1;
    arm.broken++;
    this._pruneBeads(arm);
    this.hits++;
    this.version++;
    if (this.logging) this.log.push(['b', k, r]);
    return true;
  }

  /** Crack the whole crystal: every arm loses a fraction of its length. */
  crack(frac) {
    for (const arm of this.arms) {
      this._truncate(arm, Math.max(0.6, arm.R * (1 - frac)));
      for (const b of arm.branches) {
        b.act = false;
        b.capOk = false;
      }
      arm.mode = -1;
      this._pruneBeads(arm);
    }
    this.hits++;
    this.version++;
    if (this.logging) this.log.push(['c', frac]);
  }

  /** Another crystal stuck to this one (aggregate or twin). */
  attach(seed, size, ox, oy, rot, twin = false) {
    const other = Crystal.random(seed, size);
    this.attached.push({ c: other, ox, oy, rot });
    if (twin) this.twelve = true;
    this.version++;
    if (this.logging) this.log.push(['a', seed, size, ox, oy, rot, twin ? 1 : 0]);
  }

  _truncate(arm, newR) {
    arm.R = Math.min(arm.R, newR);
    while (arm.segs.length) {
      const s = arm.segs[arm.segs.length - 1];
      if (s.r0 >= arm.R - 1e-9) arm.segs.pop();
      else {
        if (s.r1 > arm.R) s.r1 = arm.R;
        break;
      }
    }
    arm.branches = arm.branches.filter((b) => b.r < arm.R - 0.15);
    // Branches cannot reach further than the shortened arm allows.
    for (const b of arm.branches) b.max = Math.min(b.max, 0.92 * b.r);
  }

  _pruneBeads(arm) {
    arm.beads = arm.beads.filter((bd) => {
      if (!bd.br) return bd.p <= arm.R;
      return bd.br.len >= bd.p - 0.2 && arm.branches.includes(bd.br);
    });
  }

  /**
   * Half-width of the arm's outline at distance `x` along its spine (used
   * for precise hit tests: needles are thin, dendrites and plates wide).
   */
  halfWidthAt(k, x) {
    const arm = this.arms[k];
    if (x > arm.R) return 0;
    let w = 1.1;
    const first = arm.segs[0];
    const rc = first && first.m === MODE.PLATE && first.r0 <= CORE_R + 1e-6 ? first.r1 : CORE_R;
    if (x <= rc) w = Math.max(w, Math.min(x * 0.577, (rc - x) * 1.732));
    for (const s of arm.segs) {
      if (s.m !== MODE.PLATE || x < s.r0 || x > s.r1 || s === first) continue;
      const h = Math.min(s.w + 0.6, (s.r1 - s.r0) * 0.866, s.r0 * 0.5);
      w = Math.max(w, Math.min(h, (x - s.r0) * 1.732, (s.r1 - x) * 1.732));
    }
    for (const b of arm.branches) {
      if (x < b.r) continue;
      const half = b.len * 0.5;
      if (x <= b.r + half) w = Math.max(w, (x - b.r) * 1.732);
      else if (b.cap > 0 && x <= b.r + half + b.cap) w = Math.max(w, b.len * 0.866 + b.cap * 0.5);
    }
    return w;
  }

  // ----------------------------------------------------------- utilities

  /** Rebuild a crystal from its event log. */
  static fromLog(seed, log) {
    const c = new Crystal(seed);
    for (const e of log) {
      switch (e[0]) {
        case 'g':
          c.grow(e[1], e[4], e[2], e[3]);
          break;
        case 'm':
          c.melt(e[1]);
          break;
        case 'r':
          c.rime(e[1]);
          break;
        case 'b':
          c.breakArm(e[1], e[2]);
          break;
        case 'c':
          c.crack(e[1]);
          break;
        case 'a':
          c.attach(e[1], e[2], e[3], e[4], e[5], e[6] === 1);
          break;
        default:
          break;
      }
    }
    return c;
  }

  /** Build a crystal from a target recipe: [[modeKey, dr, q?], ...]. */
  static fromRecipe(seed, recipe) {
    const c = new Crystal(seed);
    for (const step of recipe) {
      const [key, dr, q = 0.75] = step;
      if (key === 'melt') c.melt(dr);
      else if (key === 'rime') c.rime(Math.round(dr));
      else c.grow(MODE_KEYS.indexOf(key), dr, q, key === 'twist' ? 1 : 0);
    }
    return c;
  }

  /** Small random crystal (used for neighbouring flakes / aggregates). */
  static random(seed, size) {
    const rng = new RNG(seed);
    const c = new Crystal(seed);
    c.logging = false;
    let guard = 0;
    while (c.R < size && guard++ < 40) {
      const mode = rng.pick([MODE.PLATE, MODE.DENDRITE, MODE.DENDRITE, MODE.NEEDLE]);
      c.grow(mode, Math.min(size - c.R + 0.01, rng.range(1.5, 5)), rng.range(0.4, 1));
    }
    return c;
  }

  /** Compact, JSON-friendly log (rounded numbers). */
  compactLog() {
    return this.log.map((e) => e.map((v) => (typeof v === 'number' && !Number.isInteger(v) ? Math.round(v * 1e4) / 1e4 : v)));
  }
}
