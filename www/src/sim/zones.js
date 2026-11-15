// Atmospheric zone types: each cloud shapes the crystal in its own way.
import { MODE } from './crystal.js';

/**
 * mode: a crystal growth MODE, or 'melt' / 'rime'.
 * rate: radial growth per second at full intensity (melt: loss per second).
 * mote: growth given by each vapour mote absorbed ('bead' = one rime bead).
 * motes: mote density (motes per square unit of cloud).
 */
export const ZONES = {
  brume: { key: 'brume', mode: MODE.DENDRITE, rate: 0.95, mote: 0.34, motes: 1 / 650, rgb: [96, 238, 226] },
  sec: { key: 'sec', mode: MODE.PLATE, rate: 0.75, mote: 0.3, motes: 1 / 850, rgb: [128, 170, 255] },
  froid: { key: 'froid', mode: MODE.NEEDLE, rate: 1.05, mote: 0.32, motes: 1 / 800, rgb: [186, 146, 255] },
  givre: { key: 'givre', mode: 'rime', rate: 6, mote: 'bead', motes: 1 / 650, rgb: [205, 236, 255] },
  redoux: { key: 'redoux', mode: 'melt', rate: 2.4, mote: null, motes: 0, rgb: [255, 150, 104] },
  aurore: { key: 'aurore', mode: MODE.AURORA, rate: 0.9, mote: 0.32, motes: 1 / 750, rgb: [120, 255, 176] },
  tourbillon: { key: 'tourbillon', mode: MODE.PLATE, twist: true, rate: 0.8, mote: 0.3, motes: 1 / 800, rgb: [255, 206, 120] },
};

export const ZONE_KEYS = Object.keys(ZONES);

/** Zone membership in [0, 1] for a point, with a soft edge. */
export function membership(z, x, y) {
  const dx = (x - z.cx) / z.rx;
  const dy = (y - z.y) / z.ry;
  const e = dx * dx + dy * dy;
  if (e >= 1) return 0;
  const m = (1 - e) * 1.7;
  return m > 1 ? 1 : m;
}
