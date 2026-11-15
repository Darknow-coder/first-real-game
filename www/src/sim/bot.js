// Autopilot: plays a World by choosing where to steer. Used to validate that
// every level can be completed, and as the attract-mode pilot behind menus.
import { ZONES, membership } from './zones.js';
import { MODE } from './crystal.js';
import { expectedMode } from './classify.js';
import { clamp, damp } from '../core/math.js';
import { WORLD_W } from './world.js';

const BASE_VALUE = { brume: 1, sec: 0.8, froid: 0.75, aurore: 0.9, tourbillon: 0.55, givre: 0.35, redoux: -4 };

/** Zone preferences derived from the level objectives. */
function preferencesFor(def) {
  const v = { ...BASE_VALUE };
  const prefs = { value: v, seekFlakes: false, avoidFlakes: true, stopAt: null, late: null };
  for (const o of def.objectives || []) {
    if (o.kind === 'type') {
      const types = Array.isArray(o.type) ? o.type : [o.type];
      for (const t of types) {
        if (t === 'plate' || t === 'sectored') Object.assign(v, { sec: 2, brume: -0.6, froid: -0.6, aurore: -0.6, givre: -0.4 });
        if (t === 'needle_star') Object.assign(v, { froid: 2, brume: -0.3, sec: -0.4 });
        if (t === 'rimed') Object.assign(v, { givre: 2.2 });
        if (t === 'boreal') Object.assign(v, { aurore: 2.2, brume: 0.2 });
        if (t === 'triangular') Object.assign(v, { tourbillon: 2.4, brume: -0.3, sec: -0.2, aurore: -0.2 });
        if (t === 'fernlike') Object.assign(v, { brume: 2, sec: -0.6, froid: -0.6 });
        if (t === 'stellar_plate') prefs.late = { atR: 22, value: { sec: 2.2, brume: -0.5, froid: -0.5 } };
        if (t === 'aggregate') {
          prefs.seekFlakes = true;
          prefs.avoidFlakes = false;
        }
        if (t === 'twelve') {
          prefs.seekTwins = true;
          prefs.avoidFlakes = false;
        }
      }
    }
    if (o.kind === 'nomelt') v.redoux = -12;
  }
  return prefs;
}

export class Autopilot {
  constructor(world, opts = {}) {
    this.world = world;
    this.target = opts.target || null; // Crystal built from the recipe
    this.prefs = preferencesFor(world.def);
    this.timer = 0;
    this.goalX = world.flake.x;
    this.jitter = opts.jitter ?? 0;
    this.lookahead = opts.lookahead ?? 2.2;
    this.caution = opts.caution ?? 1;
  }

  zoneValue(type, R) {
    const p = this.prefs;
    if (this.target) {
      const want = expectedMode(this.world.crystal, this.target);
      const Z = ZONES[type];
      if (type === 'redoux') return -6;
      if (want === -2) return -0.8;
      if (Z.mode === want) return 2;
      return -0.6;
    }
    if (p.late && R >= p.late.atR && p.late.value[type] !== undefined) return p.late.value[type];
    return p.value[type] ?? 0;
  }

  update(dt) {
    const w = this.world;
    if (w.status !== 'play') return;
    this.timer -= dt;
    if (this.timer <= 0) {
      this.timer = 0.12;
      this.goalX = this.decide();
    }
    w.setTarget(this.goalX, w.viewH * 0.33);
  }

  decide() {
    const w = this.world;
    const f = w.flake;
    const c = w.crystal;
    const R = c.R;
    const fy = w.flakeY;
    let best = f.tx;
    let bestScore = -Infinity;
    const steps = 12;
    const T = this.lookahead;
    const fall = w.final ? w.speed * 1.15 : w.speed;
    for (let cx = 16; cx <= WORLD_W - 16; cx += 12) {
      let score = 0;
      for (let i = 1; i <= steps; i++) {
        const t = (i / steps) * T;
        const x = f.x + (cx - f.x) * (1 - Math.exp(-11 * t)) + w.windNow * t * 0.6;
        const y = fy + fall * t;
        const wt = 1.2 - t / T; // nearer future matters more
        // Clouds.
        for (const z of w.zones) {
          if (!z.active && z.y - z.ry > y) continue;
          if (Math.abs(z.y - y) > z.ry) continue;
          const m = membership(z, x, y);
          if (m > 0) score += this.zoneValue(z.type, R) * m * wt;
        }
        // Hazards (linear prediction).
        for (const h of w.hazards) {
          if (h.hit) continue;
          const hx = h.x + h.vx * t;
          const hy = h.y + h.vy * t;
          const isFlake = h.type === 'flake';
          const d = Math.hypot(hx - x, hy - y);
          if (isFlake && (this.prefs.seekFlakes || (this.prefs.seekTwins && h.twin))) {
            score += Math.max(0, 6 - d * 0.05) * wt;
            continue;
          }
          const danger = (R + h.r + 7) * this.caution;
          if (d < danger) score -= (isFlake ? 18 : 60) * (1 - d / danger + 0.3) * (1.3 - t / T) * (w.final ? 0.35 : 1);
        }
        // Static obstacles.
        for (const o of w.obstacles) {
          const ax = o.x2 - o.x1;
          const ay = o.y2 - o.y1;
          const tt = clamp(((x - o.x1) * ax + (y - o.y1) * ay) / (ax * ax + ay * ay || 1), 0, 1);
          const d = Math.hypot(o.x1 + ax * tt - x, o.y1 + ay * tt - y);
          const danger = R + o.r + 8;
          if (d < danger) score -= 60 * (1 - d / danger + 0.3);
        }
        // Shards.
        for (const s of w.shards) {
          if (s.taken) continue;
          if (Math.abs(s.y - y) < 14 && Math.abs(s.x - x) < Math.max(11, R * 0.55 + 9)) score += 2.2 * wt;
        }
      }
      // Landing.
      const toGround = w.landing.y - fy;
      if (toGround < w.viewH * 0.95) {
        const k = 1 - toGround / (w.viewH * 0.95);
        const off = Math.max(0, Math.abs(cx - w.landing.x) - w.landing.w * 0.3);
        score -= off * (0.08 + k * (w.final ? 1.2 : 0.3));
      }
      // Prefer smooth moves.
      score -= Math.abs(cx - f.tx) * 0.004;
      score += this.jitter ? (Math.random() - 0.5) * this.jitter : 0;
      if (score > bestScore) {
        bestScore = score;
        best = cx;
      }
    }
    return best;
  }
}

/** Run a whole level headlessly with the autopilot. */
export function simulate(world, opts = {}) {
  const pilot = new Autopilot(world, opts);
  const dt = 1 / 60;
  const maxT = opts.maxT ?? 400;
  while (world.status === 'play' && world.t < maxT) {
    pilot.update(dt);
    world.update(dt);
    world.events.length = 0;
  }
  return world;
}

export { MODE, damp };
