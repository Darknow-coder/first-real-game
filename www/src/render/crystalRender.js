// Procedural drawing of snow crystals (the visual heart of the game).
import { MODE, CORE_R } from '../sim/crystal.js';
import { makeCanvas } from './sprites.js';

const SIN60 = 0.8660254;
const ROT = [];
for (let k = 0; k < 6; k++) ROT.push([Math.cos((k * Math.PI) / 3), Math.sin((k * Math.PI) / 3)]);

/** Farthest point of the crystal from its centre (units). */
export function crystalExtent(c, depth = 0) {
  let e = CORE_R;
  for (const arm of c.arms) {
    if (arm.R > e) e = arm.R;
    for (const b of arm.branches) {
      const x = b.r + b.len * 0.5;
      const y = b.len * SIN60;
      const d = Math.sqrt(x * x + y * y) + b.cap;
      if (d > e) e = d;
    }
  }
  if (depth === 0) {
    for (const a of c.attached) {
      const d = Math.hypot(a.ox, a.oy) + crystalExtent(a.c, 1);
      if (d > e) e = d;
    }
  }
  return e;
}

function spineWidth(s) {
  switch (s.m) {
    case MODE.NEEDLE:
      return 0.45;
    case MODE.PLATE:
      return 0.5;
    case MODE.AURORA:
      return 0.85;
    default:
      return 0.7 + 0.35 * s.q;
  }
}

/**
 * Draw a crystal centred on the origin of the current transform, in crystal
 * units. Options: alpha, ghost (flat translucent silhouette), detail (0..1).
 */
export function drawCrystal(g, c, o = {}) {
  const alpha = o.alpha ?? 1;
  const ghost = !!o.ghost;
  const detail = o.detail ?? 1;

  const plates = new Path2D();
  const ridges = new Path2D();
  const auroraSpine = new Path2D();
  const auroraBranches = new Path2D();
  const branchFill = new Path2D();
  const ticks = new Path2D();
  const beads = new Path2D();
  const halo = new Path2D();
  const spines = new Map(); // width -> Path2D

  let rot = ROT[0];
  const P = (x, y) => [x * rot[0] - y * rot[1], x * rot[1] + y * rot[0]];
  const moveTo = (path, x, y) => {
    const p = P(x, y);
    path.moveTo(p[0], p[1]);
  };
  const lineTo = (path, x, y) => {
    const p = P(x, y);
    path.lineTo(p[0], p[1]);
  };
  const poly = (path, pts) => {
    moveTo(path, pts[0], pts[1]);
    for (let i = 2; i < pts.length; i += 2) lineTo(path, pts[i], pts[i + 1]);
    path.closePath();
  };
  const seg = (path, x0, y0, x1, y1) => {
    moveTo(path, x0, y0);
    lineTo(path, x1, y1);
  };
  /** Tapered stroke as a filled quad. */
  const taper = (path, x0, y0, x1, y1, w0, w1) => {
    const dx = x1 - x0;
    const dy = y1 - y0;
    const L = Math.hypot(dx, dy) || 1;
    const nx = (-dy / L) * 0.5;
    const ny = (dx / L) * 0.5;
    poly(path, [x0 + nx * w0, y0 + ny * w0, x1 + nx * w1, y1 + ny * w1, x1 - nx * w1, y1 - ny * w1, x0 - nx * w0, y0 - ny * w0]);
  };
  const hex = (path, cx, cy, r, phase = 0) => {
    const pts = [];
    for (let i = 0; i < 6; i++) {
      const a = phase + (i * Math.PI) / 3;
      pts.push(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    }
    poly(path, pts);
  };

  // Central plate (or the initial prism). Each vertex sits on an arm, at the
  // distance that arm's central plate reached (triangular crystals!).
  const rcs = c.arms.map((arm) => {
    const s = arm.segs[0];
    return s && s.m === MODE.PLATE && s.r0 <= CORE_R + 1e-6 ? Math.max(CORE_R, s.r1) : CORE_R;
  });
  const rc = Math.min(...rcs);
  rot = ROT[0];
  {
    const pts = [];
    for (let k = 0; k < 6; k++) pts.push(ROT[k][0] * rcs[k], ROT[k][1] * rcs[k]);
    poly(plates, pts);
    poly(halo, pts);
  }
  if (rc > CORE_R * 1.5) {
    hex(ridges, 0, 0, rc * 0.62);
    if (rc > 6) hex(ridges, 0, 0, rc * 0.3);
  } else {
    hex(ridges, 0, 0, rc * 0.45);
  }

  for (let k = 0; k < 6; k++) {
    const arm = c.arms[k];
    rot = ROT[k];
    if (rcs[k] > CORE_R * 1.5) seg(ridges, 0, 0, Math.min(rcs[k], arm.R), 0);

    // Plate paddles.
    for (let i = 0; i < arm.segs.length; i++) {
      const s = arm.segs[i];
      if (s.m !== MODE.PLATE) continue;
      if (i === 0 && s.r0 <= CORE_R + 1e-6) continue; // central plate
      const len = s.r1 - s.r0;
      const h = Math.min(s.w + 0.6, len * SIN60, s.r0 * 0.5);
      if (h < 0.3) continue;
      const a = Math.min(h * 0.577, len / 2);
      poly(plates, [s.r0, 0, s.r0 + a, h, s.r1 - a, h, s.r1, 0, s.r1 - a, -h, s.r0 + a, -h]);
      poly(halo, [s.r0, 0, s.r0 + a, h, s.r1 - a, h, s.r1, 0, s.r1 - a, -h, s.r0 + a, -h]);
      seg(ridges, s.r0 + a, h, s.r1 - a, -h);
      seg(ridges, s.r0 + a, -h, s.r1 - a, h);
    }

    // Spine (inside plates it is only a faint ridge).
    for (const s of arm.segs) {
      if (s.m === MODE.PLATE) {
        seg(ridges, s.r0, 0, s.r1, 0);
        continue;
      }
      if (s.m === MODE.AURORA) {
        seg(auroraSpine, s.r0, 0, s.r1, 0);
      } else {
        const w = Math.round(spineWidth(s) * 20) / 20;
        if (!spines.has(w)) spines.set(w, new Path2D());
        seg(spines.get(w), s.r0, 0, s.r1, 0);
      }
      seg(halo, s.r0, 0, s.r1, 0);
    }

    // Side branches (mirrored on both sides of the spine).
    for (const b of arm.branches) {
      if (b.len < 0.15 && b.cap < 0.1) continue;
      const tx = b.r + b.len * 0.5;
      const ty = b.len * SIN60;
      const base = b.m === MODE.NEEDLE ? 0.38 : 0.55 + 0.3 * b.q;
      const tip = b.m === MODE.NEEDLE ? 0.12 : 0.18;
      for (const side of [1, -1]) {
        if (b.m === MODE.AURORA) seg(auroraBranches, b.r, 0, tx, ty * side);
        else taper(branchFill, b.r, 0, tx, ty * side, base, tip);
        seg(halo, b.r, 0, tx, ty * side);
        if (b.cap > 0.2) hex(plates, tx, ty * side, b.cap, Math.PI / 6);
        if (b.fern && detail > 0.4 && b.len > 2.4) {
          for (let d = 1.3; d < b.len - 0.7; d += 1.25) {
            const px = b.r + d * 0.5;
            const py = d * SIN60 * side;
            const tl = Math.min(1.9, (b.len - d) * 0.42);
            seg(ticks, px, py, px + tl, py);
            seg(ticks, px, py, px - tl * 0.5, py + tl * SIN60 * side);
          }
        }
      }
    }

    // Rime beads.
    for (const bd of arm.beads) {
      let x;
      let y;
      if (!bd.br) {
        x = bd.p;
        y = bd.side * (0.55 + bd.o * 0.6);
      } else {
        const b = bd.br;
        const d = Math.min(bd.p, b.len);
        x = b.r + d * 0.5 - SIN60 * bd.o * 0.6 * bd.side;
        y = (d * SIN60 + 0.5 * bd.o * 0.6) * bd.side;
      }
      const p = P(x, y);
      beads.moveTo(p[0] + bd.s, p[1]);
      beads.arc(p[0], p[1], bd.s, 0, Math.PI * 2);
    }
  }

  g.save();
  g.globalAlpha *= alpha;
  g.lineCap = 'round';
  g.lineJoin = 'round';

  if (ghost) {
    g.fillStyle = 'rgba(220,235,255,0.5)';
    g.strokeStyle = 'rgba(220,235,255,0.75)';
    g.fill(plates);
    g.lineWidth = 1.2;
    g.stroke(halo);
    g.fill(branchFill);
    g.stroke(auroraSpine);
    g.stroke(auroraBranches);
    g.restore();
    return;
  }

  // Soft halo.
  g.strokeStyle = 'rgba(160,205,255,0.10)';
  g.lineWidth = 3.2;
  g.stroke(halo);
  g.strokeStyle = 'rgba(190,225,255,0.12)';
  g.lineWidth = 1.6;
  g.stroke(halo);

  // Plates.
  const plateGrad = g.createRadialGradient(0, 0, 0, 0, 0, Math.max(4, c.R));
  plateGrad.addColorStop(0, 'rgba(230,244,255,0.42)');
  plateGrad.addColorStop(1, 'rgba(190,222,255,0.26)');
  g.fillStyle = plateGrad;
  g.fill(plates);
  g.strokeStyle = 'rgba(244,250,255,0.85)';
  g.lineWidth = 0.32;
  g.stroke(plates);
  g.strokeStyle = 'rgba(255,255,255,0.32)';
  g.lineWidth = 0.17;
  g.stroke(ridges);

  // Spines and branches.
  g.strokeStyle = 'rgba(246,251,255,0.96)';
  for (const [w, path] of spines) {
    g.lineWidth = w;
    g.stroke(path);
  }
  g.fillStyle = 'rgba(242,249,255,0.95)';
  g.fill(branchFill);
  if (detail > 0.4) {
    g.strokeStyle = 'rgba(236,246,255,0.85)';
    g.lineWidth = 0.26;
    g.stroke(ticks);
  }

  // Aurora-tinted growth: colour depends on the distance to the centre.
  const R = Math.max(4, c.R);
  const ag = g.createRadialGradient(0, 0, 0, 0, 0, R);
  const hues = [160, 185, 210, 290, 330, 160];
  hues.forEach((h, i) => ag.addColorStop(i / (hues.length - 1), `hsla(${h},95%,80%,0.95)`));
  g.strokeStyle = ag;
  g.lineWidth = 0.85;
  g.stroke(auroraSpine);
  g.lineWidth = 0.6;
  g.stroke(auroraBranches);

  g.fillStyle = 'rgba(250,253,255,0.95)';
  g.fill(beads);
  g.restore();

  // Aggregated / twin crystals.
  for (const a of c.attached) {
    g.save();
    g.translate(a.ox, a.oy);
    g.rotate(a.rot);
    drawCrystal(g, a.c, { alpha: alpha * (c.twelve ? 1 : 0.9), detail });
    g.restore();
  }
}

/** Cached bitmap of a crystal, re-rendered only when it changed. */
export class CrystalSprite {
  constructor() {
    this.canvas = null;
    this.version = -1;
    this.ppu = 0;
    this.half = 0; // half size in units
    this.lastRender = -1e9;
  }

  sync(c, ppu, now = 0, force = false) {
    const changed = c.version !== this.version || Math.abs(ppu - this.ppu) > 0.01;
    if (!changed && this.canvas) return;
    if (!force && this.canvas && Math.abs(ppu - this.ppu) <= 0.01 && now - this.lastRender < 50) return;
    const extent = crystalExtent(c) + 3;
    let half = this.half;
    if (!this.canvas || extent > half || Math.abs(ppu - this.ppu) > 0.01) {
      half = Math.ceil(Math.max(extent * 1.2, 10));
      const px = Math.ceil(half * 2 * ppu);
      this.canvas = makeCanvas(px, px);
      this.half = half;
    }
    const g = this.canvas.getContext('2d');
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, this.canvas.width, this.canvas.height);
    g.setTransform(ppu, 0, 0, ppu, this.canvas.width / 2, this.canvas.height / 2);
    drawCrystal(g, c);
    this.version = c.version;
    this.ppu = ppu;
    this.lastRender = now;
  }

  draw(ctx, x, y, rot, scale = 1) {
    if (!this.canvas) return;
    const s = this.half * scale;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.drawImage(this.canvas, -s, -s, s * 2, s * 2);
    ctx.restore();
  }
}
