// Procedural skies for the endless "Tempête" mode and the daily flake.
import { RNG, hashString } from '../core/rng.js';
import { clamp, lerp } from '../core/math.js';
import { CHAPTERS } from './levels.js';

const THEMES = CHAPTERS.map((c) => c.theme);
const LANDING_BY_THEME = { peaks: 'mitten', forest: 'scarf', village: 'sleeve', blizzard: 'sled', aurora: 'glass' };

function weightedPick(rng, table) {
  let total = 0;
  for (const [, w] of table) total += w;
  let r = rng.next() * total;
  for (const [v, w] of table) {
    r -= w;
    if (r <= 0) return v;
  }
  return table[table.length - 1][0];
}

function growthTable(d, theme) {
  const t = [
    ['brume', 3],
    ['sec', 2.2],
    ['froid', d > 0.15 ? 1.4 : 0.4],
    ['givre', d > 0.25 ? 0.8 : 0],
  ];
  if (theme === 'aurora') t.push(['aurore', 1.8], ['tourbillon', 0.7]);
  else if (d > 0.6) t.push(['aurore', 0.4]);
  return t;
}

/**
 * Generate a level definition.
 * @param {{seed:number, difficulty:number, theme?:string, length?:number, id?:string}} o
 */
export function generateLevel(o) {
  const rng = new RNG(o.seed);
  const d = clamp(o.difficulty ?? 0.3, 0, 3);
  // Beyond 1, the "overdrive" keeps tightening the screws (endless mode).
  const over = Math.max(0, d - 1);
  const theme = o.theme ?? rng.pick(THEMES);
  const length = Math.round(o.length ?? lerp(2800, 3600, Math.min(1, d)));
  const def = {
    id: o.id ?? `gen-${o.seed}`,
    chapter: 0,
    index: 0,
    theme,
    length,
    speed: Math.round(lerp(60, 76, Math.min(1, d)) + over * 12),
    startX: 180,
    landing: { x: Math.round(rng.range(95, 265)), w: Math.round(Math.max(64, lerp(115, 85, Math.min(1, d)) - over * 18)), kind: LANDING_BY_THEME[theme] },
    objectives: [{ kind: 'land' }],
    target: null,
    zones: [],
    hazards: [],
    shards: [],
    winds: [],
    drafts: [],
    obstacles: [],
    hints: [],
  };

  let y = 520;
  const end = length - 430;
  while (y < end) {
    const step = rng.range(380, 520);
    if (rng.chance(0.55)) {
      // Two clouds side by side: a choice.
      const a = weightedPick(rng, growthTable(d, theme));
      let bType = weightedPick(rng, growthTable(d, theme));
      if (bType === a) bType = a === 'brume' ? 'sec' : 'brume';
      const ry = rng.range(120, 175);
      def.zones.push({ type: a, x: rng.range(70, 120), y: y + rng.range(-30, 30), rx: rng.range(60, 85), ry });
      def.zones.push({ type: bType, x: rng.range(240, 290), y: y + rng.range(-30, 30), rx: rng.range(60, 85), ry: ry * rng.range(0.85, 1.1) });
      if (d > 0.35 && rng.chance(0.35)) def.zones.push({ type: 'redoux', x: 180, y: y + rng.range(-40, 40), rx: 38, ry: ry * 1.1 });
    } else {
      const a = weightedPick(rng, growthTable(d, theme));
      def.zones.push({ type: a, x: rng.range(110, 250), y, rx: rng.range(90, 125), ry: rng.range(140, 200), density: rng.chance(0.3) ? 1 : 0.9 });
      if (d > 0.45 && rng.chance(0.4)) {
        def.zones.push({ type: 'redoux', x: rng.chance(0.5) ? 50 : 310, y: y + rng.range(-60, 60), rx: 40, ry: rng.range(150, 220) });
      }
    }
    if (rng.chance(0.75)) def.shards.push({ x: rng.range(40, 320), y: y + rng.range(160, 260) });
    y += step;
  }

  // Hazards scale with difficulty.
  const startH = 380;
  def.hazards.push({ type: 'pellet', from: startH, to: length - 700, every: Math.max(0.45, lerp(2.6, 0.85, Math.min(1, d)) - over * 0.25), x: d > 0.5 ? 'aim' : undefined });
  if (d > 0.35) def.hazards.push({ type: 'hail', from: 800, to: length - 800, every: Math.max(0.9, lerp(4, 1.8, Math.min(1, (d - 0.35) / 0.65)) - over * 0.6) });
  if (d > 0.55 && rng.chance(0.6)) def.hazards.push({ type: 'flake', from: 700, to: length - 900, every: rng.range(2.8, 4) });
  if (theme === 'forest' || rng.chance(0.25)) def.hazards.push({ type: 'bird', at: Math.round(length * rng.range(0.55, 0.8)), dir: rng.sign() });
  if (d > 0.25) {
    const n = d > 0.7 ? 2 : 1;
    for (let i = 0; i < n; i++) {
      const from = Math.round(rng.range(600, length - 1600));
      def.winds.push({ from, to: from + Math.round(rng.range(600, 900)), dir: rng.sign(), power: Math.round(lerp(65, 125, Math.min(1, d)) + over * 40), gust: { period: rng.range(2.6, 4), duty: 0.5 } });
    }
  }
  return def;
}

/** Recipe used as the target of the daily flake. */
export function generateRecipe(rng) {
  const modes = ['plate', 'dendrite', 'needle'];
  const first = rng.pick(['plate', 'needle', 'dendrite']);
  const steps = [[first, first === 'plate' ? rng.range(4, 7) : rng.range(5, 8), 0.75]];
  let last = first;
  const n = rng.int(2, 3);
  for (let i = 0; i < n; i++) {
    let m = rng.pick(modes);
    if (m === last) m = last === 'dendrite' ? 'plate' : 'dendrite';
    steps.push([m, m === 'dendrite' ? rng.range(9, 14) : rng.range(4, 8), m === 'dendrite' && rng.chance(0.5) ? 1 : 0.75]);
    last = m;
  }
  return steps.map(([m, dr, q]) => [m, Math.round(dr * 10) / 10, q]);
}

const ZONE_FOR_MODE = { plate: 'sec', dendrite: 'brume', needle: 'froid' };

/** The daily flake: a seeded sky built around a seeded target recipe. */
export function generateDaily(dateKey) {
  const seed = hashString(`flocon-daily-${dateKey}`);
  const rng = new RNG(seed);
  const recipe = generateRecipe(rng);
  const theme = rng.pick(THEMES);
  const def = {
    id: `daily-${dateKey}`,
    chapter: 0,
    index: 0,
    theme,
    length: 0,
    speed: 64,
    startX: 180,
    landing: { x: Math.round(rng.range(110, 250)), w: 100, kind: LANDING_BY_THEME[theme] },
    objectives: [{ kind: 'land' }, { kind: 'match', pct: 70 }, { kind: 'match', pct: 88 }],
    target: recipe,
    zones: [],
    hazards: [],
    shards: [],
    winds: [],
    drafts: [],
    obstacles: [],
    hints: [],
  };
  let y = 480;
  for (const [mode, dr] of recipe) {
    const type = ZONE_FOR_MODE[mode];
    // About 1.15 units of growth per second inside a dense cloud.
    const seconds = dr / 1.15;
    const span = Math.max(220, seconds * def.speed);
    const pieces = span > 520 ? 2 : 1;
    const ry = span / pieces / 2 + 20;
    let side = rng.chance(0.5) ? -1 : 1;
    for (let p = 0; p < pieces; p++) {
      const cy = y + ry;
      const x = 180 + side * rng.range(30, 80);
      def.zones.push({ type, x, y: cy, rx: rng.range(85, 110), ry });
      // A distractor on the other side.
      const others = Object.values(ZONE_FOR_MODE).filter((z) => z !== type);
      def.zones.push({ type: rng.pick(others), x: 180 - side * rng.range(105, 125), y: cy + rng.range(-40, 40), rx: 55, ry: ry * 0.8 });
      if (rng.chance(0.7)) def.shards.push({ x: 180 + side * rng.range(-60, 60), y: cy + rng.range(-ry * 0.5, ry * 0.5) });
      y += ry * 2 + 30;
      side = -side;
    }
    y += 80;
  }
  def.length = Math.round(y + 520);
  def.hazards.push({ type: 'pellet', from: 400, to: def.length - 700, every: 1.9 });
  if (rng.chance(0.5)) def.hazards.push({ type: 'hail', from: 900, to: def.length - 900, every: 3.4 });
  if (rng.chance(0.5)) {
    const from = Math.round(rng.range(700, Math.max(800, def.length - 1600)));
    def.winds.push({ from, to: from + 700, dir: rng.sign(), power: 80, gust: { period: 3.2, duty: 0.5 } });
  }
  return { def, seed };
}

/** Beauty the n-th flake of an endless run must reach to keep going. */
export function endlessQuota(n) {
  return Math.round(250 + 55 * n);
}

/** Difficulty of the n-th flake of an endless run (n starts at 0): no cap. */
export function endlessDifficulty(n) {
  return 0.12 + n * 0.11;
}

export function generateEndless(runSeed, n) {
  const seed = hashString(`tempete-${runSeed}-${n}`);
  const theme = THEMES[n % THEMES.length];
  const d = endlessDifficulty(n);
  const def = generateLevel({ seed, difficulty: d, theme, length: Math.round(lerp(2500, 3300, Math.min(1, d))), id: `endless-${runSeed}-${n}` });
  return { def, seed };
}
