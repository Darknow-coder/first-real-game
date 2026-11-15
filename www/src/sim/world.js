// Simulation of one fall: scrolling sky, steering, crystal growth, hazards,
// collectibles and landing. Pure logic (no DOM): runs in the browser and in
// Node (tests, autopilot validation).

import { Crystal, CORE_R } from './crystal.js';
import { ZONES, membership } from './zones.js';
import { RNG, hashString } from '../core/rng.js';
import { clamp, damp, wrapAngle, TAU } from '../core/math.js';

export const WORLD_W = 360;
export const BAND_TOP = 0.16;
export const BAND_BOTTOM = 0.6;
export const START_SY = 0.33;
/** Height of each landing object above the snow (world units). */
export const LANDING_H = { mitten: 118, scarf: 66, sleeve: 52, sled: 40, glass: 46 };

const SECTOR = Math.PI / 3;

export class World {
  /**
   * @param {object} def resolved level definition (see levels.js)
   * @param {{seed?: number, viewH?: number}} opts
   */
  constructor(def, opts = {}) {
    this.def = def;
    this.seed = (opts.seed ?? hashString(String(def.id ?? 'level'))) >>> 0;
    this.rng = new RNG(this.seed);
    this.viewH = Math.max(560, opts.viewH ?? 720);
    this.t = 0;
    this.camY = 0;
    this.baseSpeed = def.speed ?? 62;
    this.speed = this.baseSpeed;
    this.groundY = def.length;
    const L = def.landing ?? {};
    this.landing = {
      x: L.x ?? WORLD_W / 2,
      w: L.w ?? 96,
      kind: L.kind ?? 'mitten',
      y: this.groundY - (LANDING_H[L.kind ?? 'mitten'] ?? 30),
    };
    const sx = def.startX ?? WORLD_W / 2;
    const sy = this.viewH * START_SY;
    this.flake = { x: sx, sy, tx: sx, tsy: sy, vx: 0, rot: this.rng.range(0, TAU), spin: 0.2, inv: 0, shake: 0 };
    this.crystal = new Crystal((this.seed ^ 0x9e3779b9) >>> 0);
    this.zones = (def.zones || []).map((z, i) => ({
      id: i,
      type: z.type,
      x0: z.x,
      cx: z.x,
      y: z.y,
      rx: z.rx,
      ry: z.ry,
      density: z.density ?? 0.9,
      vx: z.vx ?? 0,
      ax: z.ax ?? 0,
      wf: z.wf ?? 0.35,
      phase: z.phase ?? i * 1.7,
      active: false,
      done: false,
    }));
    this.motes = [];
    this.hazards = [];
    this.spawners = (def.hazards || []).map((h, i) => ({ ...h, id: i, timer: h.delay ?? 0, fired: false }));
    this.obstacles = def.obstacles || [];
    this.shards = (def.shards || []).map((s) => ({ x: s.x, y: s.y, taken: false }));
    this.winds = def.winds || [];
    this.drafts = def.drafts || [];
    this.hints = (def.hints || []).map((h) => ({ ...h, shown: false }));
    this.events = [];
    this.status = 'play';
    this.reason = null;
    this.final = false;
    this.zoneKey = null;
    this.zoneQ = 0;
    this.beadAcc = 0;
    this.windNow = 0;
    this.lastDamage = null;
    this.stats = { shards: 0, shardsTotal: this.shards.length, motes: 0, hits: 0, merges: 0, time: 0, zoneTime: {} };
  }

  get flakeY() {
    return this.camY + this.flake.sy;
  }

  get progress() {
    return clamp((this.camY + this.flake.sy) / (this.landing.y), 0, 1);
  }

  // ----------------------------------------------------------- controls

  /** Relative steering (drag deltas in world units). */
  steer(dx, dy) {
    const f = this.flake;
    f.tx = clamp(f.tx + dx, 12, WORLD_W - 12);
    if (!this.final) f.tsy = clamp(f.tsy + dy, this.viewH * BAND_TOP, this.viewH * BAND_BOTTOM);
  }

  /** Absolute target (used by the autopilot). */
  setTarget(x, sy) {
    const f = this.flake;
    f.tx = clamp(x, 12, WORLD_W - 12);
    if (!this.final && sy !== undefined) f.tsy = clamp(sy, this.viewH * BAND_TOP, this.viewH * BAND_BOTTOM);
  }

  emit(type, data = {}) {
    this.events.push({ type, ...data });
  }

  // ------------------------------------------------------------- update

  update(dt) {
    if (this.status !== 'play') return;
    this.t += dt;
    this.stats.time += dt;
    const f = this.flake;
    const c = this.crystal;

    // Fall speed: heavier crystals fall a little faster; drafts push.
    let target = this.baseSpeed * (1 + c.R * 0.0035) + c.beadCount * 0.04;
    const fy = this.flakeY;
    for (const d of this.drafts) {
      const m = membership({ cx: d.x, y: d.y, rx: d.rx, ry: d.ry }, f.x, fy);
      if (m > 0) target += d.power * m;
    }
    target = clamp(target, 16, 200);
    this.speed += (target - this.speed) * damp(2.5, dt);

    // Camera / vertical motion.
    if (!this.final) {
      this.camY += this.speed * dt;
      const sy0 = f.sy;
      f.sy += (f.tsy - f.sy) * damp(9, dt);
      if (Math.abs(f.sy - sy0) < 1e-6) f.sy = f.tsy;
      if (this.camY >= this.groundY - this.viewH * 0.84) {
        this.final = true;
        this.emit('final');
        this.triggerHint('final');
      }
    } else {
      f.sy += this.speed * 1.15 * dt;
      f.tsy = f.sy;
    }

    // Wind.
    let wind = 0;
    for (const w of this.winds) {
      if (fy < w.from || fy > w.to) continue;
      let k = 1;
      if (w.gust) {
        const p = ((this.t + (w.gust.offset ?? 0)) % w.gust.period) / w.gust.period;
        const duty = w.gust.duty ?? 0.5;
        k = p < duty ? Math.sin((p / duty) * Math.PI) : 0;
      }
      wind += w.dir * w.power * k;
    }
    this.windNow = wind;
    if (wind) {
      f.tx = clamp(f.tx + wind * dt, 12, WORLD_W - 12);
      f.x += wind * dt * 0.6;
    }

    // Horizontal steering.
    const x0 = f.x;
    f.x += (f.tx - f.x) * damp(11, dt);
    f.x = clamp(f.x, 8, WORLD_W - 8);
    f.vx = (f.x - x0) / dt;
    f.inv = Math.max(0, f.inv - dt);
    f.shake = Math.max(0, f.shake - dt * 2.5);

    this.updateZones(dt);
    this.updateGrowth(dt);
    this.updateMotes();
    this.updateSpawners(dt);
    this.updateHazards(dt);
    this.updateObstacles();
    this.updateShards();
    this.updateHints();

    let spin = 0.2 + Math.min(0.5, Math.abs(f.vx) * 0.002);
    if (this.zoneKey === 'tourbillon') spin += 1.2;
    f.spin += (spin - f.spin) * damp(2, dt);
    f.rot = (f.rot + f.spin * dt) % TAU;

    if (c.R < 1.4) {
      this.status = 'failed';
      this.reason = this.lastDamage === 'melt' ? 'melted' : 'shattered';
      this.emit('failed', { reason: this.reason });
      return;
    }

    // Landing.
    const L = this.landing;
    const ny = this.flakeY;
    const reach = c.R * 0.3;
    if (ny >= L.y - reach && Math.abs(f.x - L.x) <= L.w / 2 + reach) {
      this.status = 'landed';
      this.emit('landed', { x: f.x, y: L.y });
    } else if (ny >= this.groundY - 6) {
      this.status = 'failed';
      this.reason = 'lost';
      this.emit('failed', { reason: 'lost' });
    }
  }

  updateZones() {
    const top = this.camY - 120;
    const bottom = this.camY + this.viewH + 520;
    for (const z of this.zones) {
      z.cx = z.x0 + z.vx * this.t + z.ax * Math.sin(this.t * z.wf + z.phase);
      if (!z.active && !z.done && z.y - z.ry < bottom && z.y + z.ry > top) {
        z.active = true;
        this.spawnMotes(z);
      } else if (z.active && z.y + z.ry < top) {
        z.active = false;
        z.done = true;
        this.motes = this.motes.filter((m) => m.z !== z);
      }
    }
  }

  spawnMotes(z) {
    const Z = ZONES[z.type];
    if (!Z || !Z.motes) return;
    const rng = new RNG(hashString(`${this.seed}:m:${z.id}`));
    const area = Math.PI * z.rx * z.ry;
    const n = Math.min(70, Math.round(area * Z.motes * z.density));
    for (let i = 0; i < n; i++) {
      let ox = 0;
      let oy = 0;
      for (let tries = 0; tries < 8; tries++) {
        ox = rng.range(-1, 1);
        oy = rng.range(-1, 1);
        if (ox * ox + oy * oy < 0.82) break;
      }
      this.motes.push({ z, ox: ox * z.rx, oy: oy * z.ry, ph: rng.range(0, TAU), x: 0, y: 0, alive: true });
    }
  }

  sampleZone(x, y) {
    let best = null;
    let bm = 0;
    for (const z of this.zones) {
      if (!z.active) continue;
      const m = membership(z, x, y);
      if (m > bm) {
        bm = m;
        best = z;
      }
    }
    return bm >= 0.1 ? { zone: best, m: bm } : { zone: null, m: 0 };
  }

  updateGrowth(dt) {
    const f = this.flake;
    const c = this.crystal;
    const { zone, m } = this.sampleZone(f.x, this.flakeY);
    const key = zone ? zone.type : null;
    if (key !== this.zoneKey) {
      this.zoneKey = key;
      this.emit('zone', { key });
      if (key) this.triggerHint(`zone:${key}`);
    }
    this.zoneQ = zone ? m * zone.density : 0;
    if (!zone) return;
    const Z = ZONES[zone.type];
    const q = this.zoneQ;
    this.stats.zoneTime[key] = (this.stats.zoneTime[key] || 0) + dt;
    if (Z.mode === 'melt') {
      c.melt(Z.rate * q * dt);
      this.lastDamage = 'melt';
    } else if (Z.mode === 'rime') {
      this.beadAcc += Z.rate * q * dt;
      if (this.beadAcc >= 1) {
        const n = Math.floor(this.beadAcc);
        this.beadAcc -= n;
        c.rime(n);
      }
    } else {
      c.grow(Z.mode, Z.rate * q * dt, q, Z.twist ? 1 : 0);
    }
  }

  updateMotes() {
    const f = this.flake;
    const c = this.crystal;
    const fy = this.flakeY;
    const cap = Math.max(10, c.R * 0.55 + 7);
    const cap2 = cap * cap;
    const t = this.t;
    let removed = false;
    for (const mo of this.motes) {
      const z = mo.z;
      mo.x = z.cx + mo.ox + Math.sin(t * 0.7 + mo.ph) * 5;
      mo.y = z.y + mo.oy + Math.cos(t * 0.55 + mo.ph) * 4;
      const dx = mo.x - f.x;
      const dy = mo.y - fy;
      if (dx * dx + dy * dy < cap2) {
        mo.alive = false;
        removed = true;
        const Z = ZONES[z.type];
        const q = this.zoneKey === z.type && this.zoneQ > 0 ? this.zoneQ : z.density;
        if (Z.mote === 'bead') c.rime(1);
        else c.grow(Z.mode, Z.mote, q, Z.twist ? 1 : 0);
        this.stats.motes++;
        this.emit('mote', { key: z.type, x: mo.x, y: mo.y });
      }
    }
    if (removed) this.motes = this.motes.filter((m) => m.alive);
  }

  updateSpawners(dt) {
    // Let the sky clear a few seconds before the final approach.
    if (this.final || this.camY > this.groundY - this.viewH * 0.84 - 260) return;
    const camY = this.camY;
    for (const s of this.spawners) {
      if (s.at !== undefined) {
        // One-shot spawn when the world point `at` comes into view.
        if (!s.fired && camY + this.viewH + 80 >= s.at) {
          s.fired = true;
          this.spawn(s);
        }
        continue;
      }
      if (camY < s.from || camY > s.to) continue;
      s.timer -= dt;
      if (s.timer <= 0) {
        this.spawn(s);
        const j = s.jitter ?? 0.3;
        s.timer += s.every * (1 - j + this.rng.next() * 2 * j);
      }
    }
  }

  spawn(s) {
    const rng = this.rng;
    const f = this.flake;
    const pickX = () => {
      if (s.x === 'aim') return clamp(f.x + rng.range(-28, 28), 16, WORLD_W - 16);
      if (Array.isArray(s.x)) return rng.range(s.x[0], s.x[1]);
      if (typeof s.x === 'number') return s.x;
      return rng.range(20, WORLD_W - 20);
    };
    const range = (v, a, b) => (Array.isArray(v) ? rng.range(v[0], v[1]) : v ?? rng.range(a, b));
    if (s.type === 'pellet' || s.type === 'hail') {
      const hail = s.type === 'hail';
      const r = range(s.r, hail ? 4.6 : 2.2, hail ? 6.2 : 3.2);
      const rel = range(s.rel, hail ? 170 : 100, hail ? 230 : 150);
      const y = this.camY - rel * 0.9 - r;
      this.hazards.push({ type: s.type, x: pickX(), y, vx: range(s.vx, -14, 14), vy: this.speed + rel, rel, r, rot: rng.range(0, TAU), hit: false, id: rng.next() });
    } else if (s.type === 'flake') {
      const size = range(s.size, 6, 13);
      const seed = (rng.next() * 4294967296) >>> 0;
      this.hazards.push({
        type: 'flake',
        x: pickX(),
        y: this.camY + this.viewH + 40,
        vx: 0,
        vy: this.speed * range(s.slow, 0.4, 0.6),
        r: size,
        size,
        seed,
        twin: !!s.twin,
        ph: rng.range(0, TAU),
        rot: rng.range(0, TAU),
        crystal: Crystal.random(seed, size),
        hit: false,
      });
    } else if (s.type === 'bird') {
      const dir = s.dir ?? (rng.next() < 0.5 ? 1 : -1);
      this.hazards.push({ type: 'bird', x: dir > 0 ? -30 : WORLD_W + 30, y: s.at, vx: dir * (s.speed ?? 95), vy: 0, r: 9, ph: rng.range(0, TAU), hit: false });
    }
  }

  updateHazards(dt) {
    const f = this.flake;
    const fy = this.flakeY;
    const c = this.crystal;
    const camY = this.camY;
    const out = [];
    for (const h of this.hazards) {
      h.x += h.vx * dt;
      h.y += h.vy * dt;
      if (h.type === 'flake') {
        h.x += Math.sin(this.t * 1.2 + h.ph) * 14 * dt;
        h.rot += dt * 0.3;
      } else if (h.type === 'pellet' || h.type === 'hail') {
        h.rot += dt * 3;
      }
      // Remove when far outside the view.
      if (h.y > camY + this.viewH + 160 || h.y < camY - 600 || h.x < -80 || h.x > WORLD_W + 80) continue;

      if (!h.hit && f.inv <= 0 && this.status === 'play') {
        if (h.type === 'flake') {
          const d = Math.hypot(h.x - f.x, h.y - fy);
          if (d < c.R * 0.72 + h.r * 0.72 + 2) {
            h.hit = true;
            this.stats.merges++;
            if (h.twin) {
              c.attach(h.seed, Math.max(4, c.R * 0.95), 0, 0, Math.PI / 6, true);
            } else {
              const a = Math.atan2(h.y - fy, h.x - f.x) - f.rot;
              const off = Math.min(d, c.R * 0.6 + h.r * 0.4);
              c.attach(h.seed, h.size, Math.cos(a) * off, Math.sin(a) * off, h.rot - f.rot, false);
            }
            f.inv = 0.5;
            f.shake = 0.6;
            this.emit('merge', { x: h.x, y: h.y, twin: h.twin });
            this.triggerHint('merge');
            continue; // absorbed
          }
        } else {
          const res = this.hitTest(h.x, h.y, h.r);
          if (res) {
            h.hit = true;
            this.applyHit(res, h.type, h.x, h.y);
            if (h.type !== 'bird') continue; // pellets shatter
          }
        }
      }
      out.push(h);
    }
    this.hazards = out;
  }

  /** Is something of radius `hr` at (hx, hy) touching the crystal? */
  hitTest(hx, hy, hr) {
    const f = this.flake;
    const c = this.crystal;
    const dx = hx - f.x;
    const dy = hy - this.flakeY;
    const d = Math.hypot(dx, dy);
    if (d > c.R + hr + 3) return null;
    const core = Math.max(3.2, c.Ravg * 0.22);
    if (d < core + hr) return { kind: 'core', d };
    // Test the two arms around the hazard against the real arm outline.
    const ang = Math.atan2(dy, dx) - f.rot;
    const k0 = Math.floor(ang / SECTOR);
    for (const kk of [k0, k0 + 1]) {
      const k = ((kk % 6) + 6) % 6;
      const delta = wrapAngle(ang - k * SECTOR);
      const along = d * Math.cos(delta);
      if (along < 0) continue;
      const perp = d * Math.abs(Math.sin(delta));
      const arm = c.arms[k];
      if (along > arm.R + hr) continue;
      const lateral = c.halfWidthAt(k, Math.min(along, arm.R));
      if (perp <= lateral + hr) return { kind: 'arm', arm: k, at: Math.max(CORE_R, along - hr - 0.5), d };
    }
    return null;
  }

  applyHit(res, kind, hx, hy) {
    const f = this.flake;
    const c = this.crystal;
    const heavy = kind === 'hail' || kind === 'bird' || kind === 'branch';
    if (res.kind === 'core') {
      c.crack(heavy ? 0.32 : 0.2);
    } else {
      c.breakArm(res.arm, res.at);
      if (heavy) {
        c.breakArm(res.arm + 1, res.at + 3);
        c.breakArm(res.arm - 1, res.at + 3);
      }
    }
    this.lastDamage = 'hit';
    this.stats.hits++;
    f.inv = heavy ? 0.9 : 0.6;
    f.shake = 1;
    const push = Math.sign(f.x - hx) || 1;
    f.tx = clamp(f.tx + push * (heavy ? 18 : 9), 12, WORLD_W - 12);
    this.emit('hit', { x: hx, y: hy, kind, core: res.kind === 'core' });
    this.triggerHint('hit');
  }

  updateObstacles() {
    if (!this.obstacles.length || this.flake.inv > 0) return;
    const f = this.flake;
    const fy = this.flakeY;
    const R = this.crystal.R;
    for (const o of this.obstacles) {
      if (Math.max(o.y1, o.y2) < fy - R - o.r - 4 || Math.min(o.y1, o.y2) > fy + R + o.r + 4) continue;
      // Closest point on the capsule axis.
      const ax = o.x2 - o.x1;
      const ay = o.y2 - o.y1;
      const t = clamp(((f.x - o.x1) * ax + (fy - o.y1) * ay) / (ax * ax + ay * ay || 1), 0, 1);
      const px = o.x1 + ax * t;
      const py = o.y1 + ay * t;
      const res = this.hitTest(px, py, o.r);
      if (res) {
        this.applyHit(res, 'branch', px, py);
        return;
      }
    }
  }

  updateShards() {
    const f = this.flake;
    const fy = this.flakeY;
    const cap = Math.max(11, this.crystal.R * 0.55 + 9);
    for (const s of this.shards) {
      if (s.taken) continue;
      if (Math.abs(s.y - fy) > cap || Math.abs(s.x - f.x) > cap) continue;
      if (Math.hypot(s.x - f.x, s.y - fy) < cap) {
        s.taken = true;
        this.stats.shards++;
        this.emit('shard', { x: s.x, y: s.y, n: this.stats.shards, total: this.stats.shardsTotal });
        this.triggerHint('shard');
      }
    }
  }

  updateHints() {
    for (const h of this.hints) {
      if (!h.shown && h.at !== undefined && this.camY >= h.at) {
        h.shown = true;
        this.emit('hint', { key: h.key, dur: h.dur });
      }
    }
  }

  triggerHint(on) {
    for (const h of this.hints) {
      if (!h.shown && h.on === on) {
        h.shown = true;
        this.emit('hint', { key: h.key, dur: h.dur });
      }
    }
  }
}
