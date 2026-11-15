// Procedural cloud textures (fractal value noise), one style per cloud type.
import { makeCanvas } from './sprites.js';

function hash2(x, y, seed) {
  let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(seed, 1442695041);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function vnoise(x, y, seed) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi, seed);
  const b = hash2(xi + 1, yi, seed);
  const c = hash2(xi, yi + 1, seed);
  const d = hash2(xi + 1, yi + 1, seed);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

export function fbm(x, y, seed, octaves = 5) {
  let sum = 0;
  let amp = 0.5;
  let norm = 0;
  for (let o = 0; o < octaves; o++) {
    sum += vnoise(x, y, seed + o * 17) * amp;
    norm += amp;
    x *= 2.03;
    y *= 2.03;
    amp *= 0.5;
  }
  return sum / norm;
}

/** Per-type look: frequency, anisotropy, swirl, contrast, colours. */
const STYLES = {
  brume: { freq: 2.6, sx: 1, sy: 1, swirl: 0, contrast: 1.5, cut: 0.38, core: [215, 255, 250], rim: [96, 238, 226] },
  sec: { freq: 1.8, sx: 1, sy: 1, swirl: 0, contrast: 1.05, cut: 0.3, core: [205, 220, 255], rim: [128, 170, 255], octaves: 4 },
  froid: { freq: 2.2, sx: 0.35, sy: 2.2, swirl: 0, contrast: 1.7, cut: 0.42, core: [235, 215, 255], rim: [186, 146, 255] },
  givre: { freq: 4.2, sx: 1, sy: 1, swirl: 0, contrast: 1.6, cut: 0.36, core: [250, 252, 255], rim: [190, 225, 255] },
  redoux: { freq: 2, sx: 0.5, sy: 2.4, swirl: 0, contrast: 1.2, cut: 0.32, core: [255, 195, 140], rim: [255, 120, 80] },
  aurore: { freq: 2.2, sx: 0.4, sy: 3, swirl: 0, contrast: 1.6, cut: 0.38, core: [150, 255, 200], rim: [235, 110, 220] },
  tourbillon: { freq: 2.4, sx: 1, sy: 1, swirl: 3.2, contrast: 1.6, cut: 0.4, core: [255, 236, 190], rim: [255, 190, 100] },
  mist: { freq: 1.6, sx: 1.6, sy: 0.7, swirl: 0, contrast: 1.1, cut: 0.35, core: [170, 190, 235], rim: [110, 130, 190], octaves: 4 },
};

const cache = new Map();

/**
 * A soft, noisy cloud texture (transparent edges) for the given type.
 * Several variants exist per type so neighbouring clouds look different.
 */
export function cloudTexture(type, variant = 0, size = 160) {
  const key = `${type}:${variant}:${size}`;
  if (cache.has(key)) return cache.get(key);
  const st = STYLES[type] || STYLES.brume;
  const c = makeCanvas(size, size);
  const g = c.getContext('2d');
  const img = g.createImageData(size, size);
  const d = img.data;
  const seed = (variant + 1) * 7919 + type.length * 131;
  const oct = st.octaves ?? 5;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let u = (x / (size - 1)) * 2 - 1;
      let v = (y / (size - 1)) * 2 - 1;
      const r = Math.sqrt(u * u + v * v);
      if (r >= 1) continue;
      if (st.swirl) {
        const a = st.swirl * (1 - r) * (1 - r);
        const cu = Math.cos(a);
        const su = Math.sin(a);
        const nu = u * cu - v * su;
        v = u * su + v * cu;
        u = nu;
      }
      const n = fbm((u * st.freq) / st.sx + 11.3, (v * st.freq) / st.sy + 7.1, seed, oct);
      // Elliptic falloff: dense in the middle, wispy towards the edge.
      const fall = 1 - smooth(0.25, 1, r);
      let dens = (n - st.cut) * st.contrast + fall * 0.55 - 0.18;
      dens *= fall;
      if (dens <= 0) continue;
      dens = Math.min(1, dens * 1.6);
      const k = Math.min(1, dens) * 0.65;
      const i = (y * size + x) * 4;
      d[i] = st.rim[0] + (st.core[0] - st.rim[0]) * k;
      d[i + 1] = st.rim[1] + (st.core[1] - st.rim[1]) * k;
      d[i + 2] = st.rim[2] + (st.core[2] - st.rim[2]) * k;
      d[i + 3] = 255 * Math.pow(dens, 1.1);
    }
  }
  g.putImageData(img, 0, 0);
  cache.set(key, c);
  return c;
}

function smooth(a, b, v) {
  const t = Math.min(1, Math.max(0, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

/** Pre-generate textures a few at a time so the first sight of a cloud never stutters. */
export function prewarmClouds(types, done) {
  const jobs = [];
  for (const t of types) for (let v = 0; v < 2; v++) jobs.push([t, v]);
  const step = () => {
    const job = jobs.shift();
    if (!job) {
      done?.();
      return;
    }
    cloudTexture(job[0], job[1]);
    setTimeout(step, 0);
  };
  step();
}

export const CLOUD_TYPES = Object.keys(STYLES);
