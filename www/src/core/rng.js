// Deterministic pseudo-random tools (seeded), used so that levels, the daily
// challenge and album replays are reproducible.

/** 32-bit string hash (cyrb-like). */
export function hashString(str) {
  let h1 = 0xdeadbeef ^ str.length;
  let h2 = 0x41c6ce57 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (h1 ^ h2) >>> 0;
}

/** Mulberry32 generator: returns a function giving floats in [0, 1). */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class RNG {
  constructor(seed = 1) {
    this.seed = seed >>> 0;
    this._next = mulberry32(this.seed);
  }
  next() {
    return this._next();
  }
  range(a, b) {
    return a + (b - a) * this._next();
  }
  int(a, b) {
    // inclusive
    return a + Math.floor(this._next() * (b - a + 1));
  }
  chance(p) {
    return this._next() < p;
  }
  pick(arr) {
    return arr[Math.floor(this._next() * arr.length)];
  }
  sign() {
    return this._next() < 0.5 ? -1 : 1;
  }
  /** Approximately normal distribution (mean 0, sd 1). */
  gauss() {
    return (this._next() + this._next() + this._next() + this._next() - 2) * 1.7320508;
  }
  shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(this._next() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }
  fork(salt) {
    return new RNG(hashString(`${this.seed}:${salt}`));
  }
}

/** Smooth 1D value noise in [-1, 1], deterministic for a given seed. */
export function noise1(x, seed = 0) {
  const i = Math.floor(x);
  const f = x - i;
  const u = f * f * (3 - 2 * f);
  const a = hashToUnit(i, seed);
  const b = hashToUnit(i + 1, seed);
  return (a + (b - a) * u) * 2 - 1;
}

function hashToUnit(i, seed) {
  let h = Math.imul(i ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(seed + 0x632be5ab, 0xc2b2ae35);
  h ^= h >>> 13;
  h = Math.imul(h, 0x27d4eb2f);
  h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}
