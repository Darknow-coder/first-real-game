// Morphology classification, beauty score and similarity to a target crystal.
import { MODE, CORE_R } from './crystal.js';

/** Morphological types, in the order shown in the notebook. */
export const TYPES = [
  'prism',
  'plate',
  'sectored',
  'stellar_plate',
  'plate_dendrite',
  'stellar_dendrite',
  'fernlike',
  'needle_star',
  'rimed',
  'graupel',
  'melted',
  'broken',
  'aggregate',
  'boreal',
  'triangular',
  'twelve',
];

export function metrics(c) {
  const len = [0, 0, 0, 0];
  let total = 0;
  let branchCount = 0;
  let dend = 0;
  let fern = 0;
  let caps = 0;
  let broken = 0;
  let centralPlate = 0;
  for (const arm of c.arms) {
    for (const s of arm.segs) {
      const L = s.r1 - s.r0;
      len[s.m] += L;
      total += L;
    }
    const first = arm.segs[0];
    if (first && first.m === MODE.PLATE && first.r0 <= CORE_R + 1e-6) centralPlate += first.r1 - first.r0;
    for (const b of arm.branches) {
      if (b.len > 0.6) {
        branchCount++;
        if (b.m === MODE.DENDRITE) {
          dend++;
          if (b.fern) fern++;
        }
      }
      if (b.cap > 0.6) caps++;
    }
    if (arm.broken > 0) broken++;
  }
  const frac = len.map((v) => (total > 0 ? v / total : 0));
  const R = c.R;
  const Rmin = c.Rmin;
  // Inner / outer mode, read along the longest arm (ignoring tiny segments).
  let longest = c.arms[0];
  for (const a of c.arms) if (a.R > longest.R) longest = a;
  const segs = longest.segs.filter((s) => s.r1 - s.r0 >= 1);
  const inner = segs.length ? segs[0].m : -1;
  const outer = segs.length ? segs[segs.length - 1].m : -1;
  const distinct = frac.filter((f) => f >= 0.12).length;
  return {
    R,
    Rmin,
    sym: R > 0 ? Rmin / R : 1,
    frac,
    total,
    branchCount,
    fernRatio: dend > 0 ? fern / dend : 0,
    caps,
    beads: c.beadCount,
    meltFrac: c.grown > 0 ? c.melted / c.grown : 0,
    melted: c.melted,
    hits: c.hits,
    broken,
    aggregate: c.attached.length > 0 && !c.twelve,
    twelve: c.twelve,
    triangular: c.twisted > 6 && c.twisted > 0.35 * c.grown,
    inner,
    outer,
    distinct,
    centralFrac: total > 0 ? centralPlate / total : 0,
    sizeMm: diameterMm(R),
  };
}

/** Crystal radius (world units) to a real-world diameter in millimetres. */
export function diameterMm(R) {
  return Math.round(R * 2 * 0.1 * 10) / 10;
}

export function classify(m) {
  if (m.twelve) return 'twelve';
  if (m.aggregate) return 'aggregate';
  if (m.beads >= 150) return 'graupel';
  if (m.meltFrac >= 0.45 && m.R < 20) return 'melted';
  if (m.triangular) return 'triangular';
  if (m.broken >= 3) return 'broken';
  if (m.R < 5.5) return 'prism';
  const [plate, dend, needle, aurora] = m.frac;
  if (aurora >= 0.35) return 'boreal';
  if (m.beads >= 45) return 'rimed';
  if (m.inner === MODE.PLATE && m.centralFrac >= 0.25 && dend + needle >= 0.3 && m.outer !== MODE.PLATE) return 'plate_dendrite';
  if (dend >= 0.55 && m.outer !== MODE.PLATE) return m.fernRatio >= 0.5 ? 'fernlike' : 'stellar_dendrite';
  if (needle >= 0.45 && m.outer !== MODE.PLATE) return 'needle_star';
  if (plate >= 0.7) return m.centralFrac >= 0.6 || m.R < 14 ? 'plate' : 'sectored';
  if (m.outer === MODE.PLATE && plate >= 0.15 && dend + needle + aurora >= 0.3) return 'stellar_plate';
  if (m.inner === MODE.PLATE && plate >= 0.2 && dend + needle >= 0.3) return 'plate_dendrite';
  // Fallback: dominant mode.
  const best = m.frac.indexOf(Math.max(...m.frac));
  return ['plate', 'stellar_dendrite', 'needle_star', 'boreal'][best] || 'prism';
}

export function badges(m) {
  const out = [];
  if (m.R >= 50 && m.broken === 0) out.push('giant');
  if (m.hits === 0 && m.meltFrac < 0.05 && m.distinct >= 3 && m.R >= 38 && !m.aggregate) out.push('masterpiece');
  return out;
}

export function beauty(m) {
  const size = m.R * 14;
  const complexity = m.distinct * 120 + Math.min(m.branchCount, 240) * 1.5 + m.caps * 3 + (m.fernRatio > 0.4 ? 60 : 0);
  const rime = Math.min(m.beads, 60) * 2;
  const aurora = m.frac[3] * 220;
  let k = 0.55 + 0.45 * Math.pow(m.sym, 1.5);
  k *= 1 - Math.min(0.7, m.meltFrac * 1.2);
  if (m.beads > 150) k *= 0.85;
  if (m.twelve) k *= 1.5;
  else if (m.aggregate) k *= 0.8;
  if (m.triangular) k *= 1.25;
  return Math.max(0, Math.round((size + complexity + rime + aurora) * k));
}

/** Radial mode profile of one arm: mode index per 0.5-unit bin (-1 = empty). */
function armProfile(arm, step = 0.5) {
  const n = Math.max(0, Math.ceil((arm.R - CORE_R) / step));
  const out = new Int8Array(n).fill(-1);
  for (const s of arm.segs) {
    const a = Math.max(0, Math.floor((s.r0 - CORE_R) / step));
    const b = Math.min(n, Math.ceil((s.r1 - CORE_R) / step));
    for (let i = a; i < b; i++) out[i] = s.m;
  }
  return out;
}

function modeMatch(a, b) {
  if (a === b) return a === -1 ? 0 : 1;
  if (a === -1 || b === -1) return 0;
  const pair = (x, y) => (a === x && b === y) || (a === y && b === x);
  if (pair(MODE.DENDRITE, MODE.AURORA)) return 0.5;
  if (pair(MODE.DENDRITE, MODE.NEEDLE)) return 0.3;
  return 0;
}

/** Similarity in [0, 1] between a crystal and a target crystal. */
export function similarity(c, target) {
  let sum = 0;
  for (let k = 0; k < c.arms.length; k++) {
    const p = armProfile(c.arms[k]);
    const t = armProfile(target.arms[k]);
    const n = Math.max(p.length, t.length);
    if (n === 0) {
      sum += 1;
      continue;
    }
    let s = 0;
    for (let i = 0; i < n; i++) s += modeMatch(i < p.length ? p[i] : -1, i < t.length ? t[i] : -1);
    sum += s / n;
  }
  let score = sum / c.arms.length;
  if (c.attached.length && !target.attached.length) score *= 0.85;
  return Math.max(0, Math.min(1, score));
}

/**
 * The growth mode the target expects at the current growth front of the
 * crystal (used by the HUD ring that tells the player where to go).
 */
export function expectedMode(c, target) {
  const r = c.R + 0.3;
  const arm = target.arms[0];
  if (r >= arm.R) return -2; // target size reached: stop growing
  for (const s of arm.segs) if (r >= s.r0 && r < s.r1) return s.m;
  return arm.segs.length ? arm.segs[0].m : -1;
}

export function analyse(c, target = null) {
  const m = metrics(c);
  return {
    metrics: m,
    type: classify(m),
    badges: badges(m),
    beauty: beauty(m),
    match: target ? similarity(c, target) : null,
  };
}
