// Ground scenes (end of each fall), landing objects and photo backdrops.
import { RNG } from '../core/rng.js';
import { makeCanvas } from './sprites.js';

const TAU = Math.PI * 2;

function roundRect(g, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  g.beginPath();
  g.moveTo(x + rr, y);
  g.lineTo(x + w - rr, y);
  g.quadraticCurveTo(x + w, y, x + w, y + rr);
  g.lineTo(x + w, y + h - rr);
  g.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
  g.lineTo(x + rr, y + h);
  g.quadraticCurveTo(x, y + h, x, y + h - rr);
  g.lineTo(x, y + rr);
  g.quadraticCurveTo(x, y, x + rr, y);
  g.closePath();
}

/** Snow surface height (world y) at x. */
export function snowLine(groundY, x) {
  return groundY - 14 + Math.sin(x * 0.031) * 4 + Math.sin(x * 0.011 + 1.3) * 6;
}

// ------------------------------------------------------------ backdrops

function mountains(g, x0, x1, base, height, color, cap, seed) {
  const rng = new RNG(seed);
  g.fillStyle = color;
  g.beginPath();
  g.moveTo(x0, base + 400);
  let x = x0;
  const peaks = [];
  g.lineTo(x, base - height * 0.3);
  while (x < x1) {
    const w = rng.range(40, 90);
    const h = height * rng.range(0.45, 1);
    peaks.push([x + w / 2, base - h, w]);
    g.lineTo(x + w / 2, base - h);
    x += w;
    g.lineTo(x, base - height * rng.range(0.15, 0.4));
  }
  g.lineTo(x1, base + 400);
  g.closePath();
  g.fill();
  if (cap) {
    g.fillStyle = cap;
    for (const [px, py, w] of peaks) {
      g.beginPath();
      g.moveTo(px, py);
      g.lineTo(px + w * 0.22, py + w * 0.28);
      g.lineTo(px + w * 0.08, py + w * 0.22);
      g.lineTo(px - w * 0.05, py + w * 0.3);
      g.lineTo(px - w * 0.22, py + w * 0.28);
      g.closePath();
      g.fill();
    }
  }
}

function pine(g, x, base, h, color, snow) {
  const w = h * 0.42;
  g.fillStyle = color;
  g.fillRect(x - h * 0.03, base - h * 0.12, h * 0.06, h * 0.14);
  for (let i = 0; i < 3; i++) {
    const top = base - h + i * h * 0.24;
    const bw = w * (0.55 + i * 0.25);
    const bh = h * 0.42;
    g.fillStyle = color;
    g.beginPath();
    g.moveTo(x, top);
    g.lineTo(x + bw / 2, top + bh);
    g.lineTo(x - bw / 2, top + bh);
    g.closePath();
    g.fill();
    if (snow) {
      g.fillStyle = snow;
      g.beginPath();
      g.moveTo(x, top + 1);
      g.lineTo(x + bw * 0.3, top + bh * 0.62);
      g.lineTo(x + bw * 0.12, top + bh * 0.55);
      g.lineTo(x - bw * 0.05, top + bh * 0.66);
      g.lineTo(x - bw * 0.3, top + bh * 0.6);
      g.closePath();
      g.fill();
    }
  }
}

function house(g, x, base, w, h, color, roof, win, t, seed) {
  const rng = new RNG(seed);
  g.fillStyle = color;
  g.fillRect(x - w / 2, base - h, w, h + 40);
  // Roof with snow.
  g.fillStyle = roof;
  g.beginPath();
  g.moveTo(x - w / 2 - 6, base - h);
  g.lineTo(x, base - h - w * 0.45);
  g.lineTo(x + w / 2 + 6, base - h);
  g.closePath();
  g.fill();
  g.fillStyle = 'rgba(235,240,250,0.9)';
  g.beginPath();
  g.moveTo(x - w / 2 - 6, base - h);
  g.lineTo(x, base - h - w * 0.45);
  g.lineTo(x + w / 2 + 6, base - h);
  g.lineTo(x + w / 2 + 2, base - h + 3);
  g.lineTo(x, base - h - w * 0.45 + 5);
  g.lineTo(x - w / 2 - 2, base - h + 3);
  g.closePath();
  g.fill();
  // Chimney.
  if (rng.chance(0.7)) {
    const cx = x + w * rng.range(-0.25, 0.25);
    g.fillStyle = color;
    g.fillRect(cx - 4, base - h - w * 0.4, 8, w * 0.3);
  }
  // Windows.
  const n = Math.max(1, Math.round(w / 22));
  for (let i = 0; i < n; i++) {
    const wx = x - w / 2 + ((i + 0.5) * w) / n;
    const flick = 0.85 + Math.sin(t * 2 + seed + i) * 0.08;
    g.fillStyle = `rgba(${win[0]},${win[1]},${win[2]},${(0.75 * flick).toFixed(3)})`;
    g.fillRect(wx - 4, base - h * 0.62, 8, 10);
  }
}

/**
 * Draw the scenery below the fall: distant silhouettes and the snow surface.
 * Coordinates are world units; `rise` (0..1) animates distant layers.
 */
export function drawBackdrop(g, theme, themeKey, groundY, x0, x1, t, rise) {
  const lift = (1 - rise) * 110;
  const base = groundY - 6;
  switch (themeKey) {
    case 'peaks':
      mountains(g, x0, x1, base - 40 + lift * 1.2, 260, theme.far, 'rgba(210,222,248,0.55)', 11);
      mountains(g, x0, x1, base - 10 + lift * 0.8, 150, theme.near, 'rgba(225,234,252,0.7)', 12);
      break;
    case 'forest': {
      const rng = new RNG(21);
      for (let x = x0 - 20; x < x1 + 20; x += rng.range(18, 30)) pine(g, x, base - 30 + lift * 1.1, rng.range(90, 150), theme.far, 'rgba(200,225,225,0.35)');
      for (let x = x0 - 10; x < x1 + 20; x += rng.range(26, 44)) pine(g, x, base + 4 + lift * 0.7, rng.range(70, 120), theme.near, 'rgba(225,240,240,0.7)');
      break;
    }
    case 'village': {
      const rng = new RNG(31);
      mountains(g, x0, x1, base - 70 + lift * 1.2, 110, theme.far, null, 33);
      // Bell tower.
      const tx = 70;
      g.fillStyle = theme.near;
      g.fillRect(tx - 12, base - 170 + lift * 0.8, 24, 200);
      g.beginPath();
      g.moveTo(tx - 16, base - 170 + lift * 0.8);
      g.lineTo(tx, base - 215 + lift * 0.8);
      g.lineTo(tx + 16, base - 170 + lift * 0.8);
      g.fill();
      g.fillStyle = 'rgba(255,205,130,0.8)';
      g.beginPath();
      g.arc(tx, base - 145 + lift * 0.8, 5, 0, TAU);
      g.fill();
      for (let x = x0 + 10; x < x1; x += rng.range(48, 70)) {
        if (Math.abs(x - tx) < 30) continue;
        house(g, x, base - 4 + lift * 0.8, rng.range(34, 52), rng.range(28, 48), theme.near, '#2a1d3a', theme.windows, t, Math.round(x));
      }
      break;
    }
    case 'blizzard': {
      const rng = new RNG(41);
      mountains(g, x0, x1, base - 30 + lift, 120, theme.far, 'rgba(220,228,240,0.4)', 43);
      // Fence line.
      g.strokeStyle = 'rgba(40,30,30,0.8)';
      g.lineWidth = 2;
      for (let x = x0; x < x1; x += 26) {
        const y = base - 22 + lift * 0.6 + Math.sin(x * 0.05) * 3;
        g.beginPath();
        g.moveTo(x, y);
        g.lineTo(x + rng.range(-1, 1), y - 22);
        g.stroke();
      }
      g.beginPath();
      for (let x = x0; x < x1; x += 8) g.lineTo(x, base - 36 + lift * 0.6 + Math.sin(x * 0.05) * 3);
      g.stroke();
      break;
    }
    case 'aurora':
    default: {
      mountains(g, x0, x1, base - 60 + lift * 1.2, 200, theme.far, 'rgba(200,235,235,0.4)', 51);
      // Frozen lake band reflecting the aurora.
      const y = base - 30 + lift * 0.8;
      const grad = g.createLinearGradient(0, y, 0, y + 40);
      grad.addColorStop(0, 'rgba(60,160,140,0.35)');
      grad.addColorStop(1, 'rgba(10,30,40,0.9)');
      g.fillStyle = grad;
      g.fillRect(x0, y, x1 - x0, 60);
      break;
    }
  }
}

export function drawSnowGround(g, theme, groundY, x0, x1, t) {
  const grad = g.createLinearGradient(0, groundY - 24, 0, groundY + 120);
  grad.addColorStop(0, theme.ground[0]);
  grad.addColorStop(1, theme.ground[1]);
  g.fillStyle = grad;
  g.beginPath();
  g.moveTo(x0, groundY + 400);
  for (let x = x0; x <= x1 + 8; x += 8) g.lineTo(x, snowLine(groundY, x));
  g.lineTo(x1 + 8, groundY + 400);
  g.closePath();
  g.fill();
  // Sparkles in the snow.
  const rng = new RNG(7);
  for (let i = 0; i < 40; i++) {
    const x = rng.range(x0, x1);
    const y = snowLine(groundY, x) + rng.range(4, 60);
    const a = 0.5 + 0.5 * Math.sin(t * rng.range(1, 3) + i);
    if (a < 0.6) continue;
    g.fillStyle = `rgba(255,255,255,${((a - 0.6) * 2).toFixed(2)})`;
    g.fillRect(x, y, 1.2, 1.2);
  }
}

// ------------------------------------------------------- landing objects

function knitMarks(g, x, y, w, h, color, step = 5) {
  g.strokeStyle = color;
  g.lineWidth = 0.8;
  g.beginPath();
  for (let yy = y + step; yy < y + h; yy += step) {
    for (let xx = x + step / 2; xx < x + w; xx += step) {
      g.moveTo(xx - step * 0.35, yy - step * 0.4);
      g.lineTo(xx, yy);
      g.lineTo(xx + step * 0.35, yy - step * 0.4);
    }
  }
  g.stroke();
}

export function drawLandingObject(g, kind, x, top, w, t, groundY) {
  const ground = groundY ?? top + 40;
  g.save();
  switch (kind) {
    case 'mitten': {
      // A child's raised, mittened hand.
      const handH = Math.min(w * 0.92, ground - top - 34);
      const left = x - w / 2;
      g.fillStyle = '#18214a';
      g.beginPath();
      g.ellipse(x + w * 0.5, top + handH * 0.62, w * 0.15, w * 0.27, 0.45, 0, TAU);
      g.fill();
      const grad = g.createLinearGradient(left, 0, left + w, 0);
      grad.addColorStop(0, '#141b3d');
      grad.addColorStop(0.5, '#243163');
      grad.addColorStop(1, '#18214a');
      g.fillStyle = grad;
      roundRect(g, left, top, w, handH + 12, w * 0.46);
      g.fill();
      g.save();
      roundRect(g, left, top, w, handH + 12, w * 0.46);
      g.clip();
      knitMarks(g, left, top, w, handH + 12, 'rgba(120,140,200,0.22)', 6);
      const by = top + handH * 0.58;
      g.fillStyle = 'rgba(230,236,248,0.9)';
      g.fillRect(left, by, w, 3);
      g.fillRect(left, by + 15, w, 3);
      g.beginPath();
      for (let xx = left; xx < left + w; xx += 10) {
        g.moveTo(xx, by + 13);
        g.lineTo(xx + 5, by + 5);
        g.lineTo(xx + 10, by + 13);
      }
      g.strokeStyle = 'rgba(230,236,248,0.9)';
      g.lineWidth = 2;
      g.stroke();
      // Soft highlight on the fingertips.
      const hl = g.createRadialGradient(x - w * 0.15, top + w * 0.18, 2, x - w * 0.15, top + w * 0.18, w * 0.5);
      hl.addColorStop(0, 'rgba(150,170,230,0.25)');
      hl.addColorStop(1, 'rgba(150,170,230,0)');
      g.fillStyle = hl;
      g.fillRect(left, top, w, handH);
      g.restore();
      // Ribbed cuff down to the snow.
      const cuffTop = top + handH;
      g.fillStyle = '#2d3b72';
      roundRect(g, left - 5, cuffTop, w + 10, ground - cuffTop + 20, 7);
      g.fill();
      g.strokeStyle = 'rgba(15,20,45,0.55)';
      g.lineWidth = 1.4;
      g.beginPath();
      for (let xx = left - 2; xx < left + w + 6; xx += 6) {
        g.moveTo(xx, cuffTop + 3);
        g.lineTo(xx, ground + 16);
      }
      g.stroke();
      break;
    }
    case 'scarf': {
      // Fence rail with posts, a knitted scarf draped over it.
      g.fillStyle = '#3b2a22';
      g.fillRect(x - w / 2 - 34, top + 6, 10, ground - top + 10);
      g.fillRect(x + w / 2 + 24, top + 6, 10, ground - top + 10);
      g.fillStyle = '#4a352a';
      roundRect(g, x - w / 2 - 44, top + 6, w + 88, 12, 5);
      g.fill();
      g.fillStyle = 'rgba(240,244,250,0.95)';
      roundRect(g, x - w / 2 - 44, top + 3, w + 88, 5, 3);
      g.fill();
      const hang = Math.min(70, ground - top - 14);
      g.fillStyle = '#5b1d2e';
      roundRect(g, x - w / 2, top, w, 16, 7);
      g.fill();
      g.fillRect(x + w * 0.18, top + 8, w * 0.22, hang);
      g.fillRect(x + w * 0.02, top + 8, w * 0.18, hang * 0.8);
      g.fillStyle = 'rgba(205,165,80,0.9)';
      for (const yy of [top + hang * 0.4, top + hang * 0.66]) g.fillRect(x + w * 0.02, yy, w * 0.38, 4);
      g.strokeStyle = 'rgba(205,165,80,0.85)';
      g.lineWidth = 1.2;
      g.beginPath();
      for (let xx = x + w * 0.04; xx < x + w * 0.4; xx += 4) {
        const yb = xx > x + w * 0.2 ? top + 8 + hang : top + 8 + hang * 0.8;
        g.moveTo(xx, yb);
        g.lineTo(xx + Math.sin(t + xx) * 1.5, yb + 7);
      }
      g.stroke();
      knitMarks(g, x - w / 2 + 4, top + 1, w - 8, 14, 'rgba(255,170,180,0.18)', 5);
      break;
    }
    case 'sleeve': {
      // A coat sleeve resting on a bench.
      g.fillStyle = '#3d2c25';
      g.fillRect(x - w / 2 - 30, top + 16, w + 60, 9);
      g.fillRect(x - w / 2 - 22, top + 24, 7, ground - top);
      g.fillRect(x + w / 2 + 15, top + 24, 7, ground - top);
      g.fillStyle = 'rgba(240,244,250,0.9)';
      g.fillRect(x - w / 2 - 30, top + 14, w + 60, 3);
      const grad = g.createLinearGradient(0, top, 0, top + 18);
      grad.addColorStop(0, '#2a4a39');
      grad.addColorStop(1, '#17291f');
      g.fillStyle = grad;
      roundRect(g, x - w / 2, top, w, 18, 9);
      g.fill();
      g.fillStyle = '#21392c';
      roundRect(g, x + w / 2 - 18, top - 1, 20, 20, 5);
      g.fill();
      g.strokeStyle = 'rgba(10,25,15,0.5)';
      g.lineWidth = 1;
      g.beginPath();
      for (let xx = x + w / 2 - 16; xx < x + w / 2 + 1; xx += 3) {
        g.moveTo(xx, top + 1);
        g.lineTo(xx, top + 17);
      }
      g.stroke();
      knitMarks(g, x - w / 2 + 4, top + 1, w - 26, 16, 'rgba(160,220,180,0.16)', 5);
      break;
    }
    case 'sled': {
      g.strokeStyle = '#2a1712';
      g.lineWidth = 4;
      g.beginPath();
      g.moveTo(x - w / 2 - 4, top + 26);
      g.lineTo(x + w / 2, top + 26);
      g.quadraticCurveTo(x + w / 2 + 22, top + 26, x + w / 2 + 16, top + 6);
      g.stroke();
      g.lineWidth = 3;
      for (const xx of [x - w * 0.32, x, x + w * 0.32]) {
        g.beginPath();
        g.moveTo(xx, top + 10);
        g.lineTo(xx, top + 26);
        g.stroke();
      }
      const grad = g.createLinearGradient(0, top, 0, top + 10);
      grad.addColorStop(0, '#6b2c22');
      grad.addColorStop(1, '#3d1812');
      g.fillStyle = grad;
      roundRect(g, x - w / 2, top, w, 10, 3);
      g.fill();
      g.strokeStyle = 'rgba(20,8,5,0.6)';
      g.lineWidth = 1;
      g.beginPath();
      for (let xx = x - w / 2 + 14; xx < x + w / 2; xx += 14) {
        g.moveTo(xx, top + 1);
        g.lineTo(xx, top + 9);
      }
      g.stroke();
      break;
    }
    case 'glass':
    default: {
      // A block of clear black ice cut from the frozen lake.
      const hgt = ground - top + 20;
      const grad = g.createLinearGradient(0, top, 0, top + hgt);
      grad.addColorStop(0, 'rgba(40,95,105,0.97)');
      grad.addColorStop(1, 'rgba(6,18,26,0.97)');
      g.fillStyle = grad;
      roundRect(g, x - w / 2, top, w, hgt, 4);
      g.fill();
      g.strokeStyle = 'rgba(150,230,225,0.55)';
      g.lineWidth = 1;
      roundRect(g, x - w / 2, top, w, hgt, 4);
      g.stroke();
      g.strokeStyle = 'rgba(190,255,245,0.95)';
      g.lineWidth = 1.6;
      g.beginPath();
      g.moveTo(x - w / 2 + 3, top + 0.8);
      g.lineTo(x + w / 2 - 3, top + 0.8);
      g.stroke();
      g.strokeStyle = 'rgba(150,230,210,0.18)';
      g.lineWidth = 3;
      g.beginPath();
      for (let i = 0; i < 3; i++) {
        const xx = x - w * 0.3 + i * w * 0.25;
        g.moveTo(xx, top + 4);
        g.lineTo(xx + 12, top + hgt * 0.8);
      }
      g.stroke();
      break;
    }
  }
  g.restore();
}

/** Glow (behind the object) or bobbing arrow showing where to land. */
export function drawLandingHint(g, x, top, w, t, strength, part = 'both') {
  if (strength <= 0) return;
  const pulse = 0.6 + 0.4 * Math.sin(t * 3);
  if (part !== 'arrow') {
    g.save();
    g.globalCompositeOperation = 'lighter';
    const grad = g.createRadialGradient(x, top, 0, x, top, w * 0.8);
    grad.addColorStop(0, `rgba(255,220,150,${(0.28 * pulse * strength).toFixed(3)})`);
    grad.addColorStop(1, 'rgba(255,220,150,0)');
    g.fillStyle = grad;
    g.beginPath();
    g.ellipse(x, top, w * 0.8, w * 0.45, 0, 0, TAU);
    g.fill();
    g.restore();
  }
  if (part === 'glow') return;
  const ay = top - 34 + Math.sin(t * 4) * 4;
  g.save();
  g.globalAlpha = strength * 0.9;
  g.strokeStyle = 'rgba(255,226,160,0.95)';
  g.lineWidth = 2.4;
  g.lineCap = 'round';
  g.lineJoin = 'round';
  g.beginPath();
  g.moveTo(x - 7, ay - 5);
  g.lineTo(x, ay + 2);
  g.lineTo(x + 7, ay - 5);
  g.stroke();
  g.restore();
}

// --------------------------------------------------------- photo backdrops

const SUPPORTS = {
  mitten: { base: '#151d3f', light: [70, 95, 160], fiber: [150, 170, 230] },
  scarf: { base: '#3f1422', light: [140, 50, 70], fiber: [230, 150, 160] },
  sleeve: { base: '#14261c', light: [55, 105, 75], fiber: [150, 210, 170] },
  velvet: { base: '#0c0a12', light: [40, 30, 55], fiber: [90, 80, 110] },
};

/** Background texture for snowflake photos. */
export function supportTexture(kind, size, seed = 3) {
  const c = makeCanvas(size, size);
  const g = c.getContext('2d');
  const rng = new RNG(seed);
  if (kind === 'sled') {
    g.fillStyle = '#2c130e';
    g.fillRect(0, 0, size, size);
    const plank = size / 3.2;
    for (let p = 0; p < 4; p++) {
      const y0 = p * plank;
      for (let i = 0; i < 70; i++) {
        const y = y0 + rng.range(0, plank);
        g.strokeStyle = `rgba(${rng.int(90, 130)},${rng.int(40, 60)},${rng.int(30, 45)},${rng.range(0.15, 0.4).toFixed(2)})`;
        g.lineWidth = rng.range(0.6, 2.2) * (size / 600);
        g.beginPath();
        const ph = rng.range(0, 6);
        for (let x = 0; x <= size; x += size / 40) g.lineTo(x, y + Math.sin(x * 0.01 + ph) * 4 * (size / 600));
        g.stroke();
      }
      g.fillStyle = 'rgba(0,0,0,0.6)';
      g.fillRect(0, y0 - 2, size, 4 * (size / 600));
    }
  } else if (kind === 'glass') {
    const grad = g.createLinearGradient(0, 0, size, size);
    grad.addColorStop(0, '#03090e');
    grad.addColorStop(0.5, '#0a1f28');
    grad.addColorStop(1, '#03080c');
    g.fillStyle = grad;
    g.fillRect(0, 0, size, size);
    g.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 3; i++) {
      const gg = g.createLinearGradient(0, size * (0.2 + i * 0.25), size, size * (0.1 + i * 0.3));
      gg.addColorStop(0, 'rgba(60,200,150,0)');
      gg.addColorStop(0.5, `rgba(${i === 1 ? '200,80,170' : '60,200,150'},0.07)`);
      gg.addColorStop(1, 'rgba(60,200,150,0)');
      g.fillStyle = gg;
      g.fillRect(0, 0, size, size);
    }
    for (let i = 0; i < 60; i++) {
      g.fillStyle = `rgba(180,240,255,${rng.range(0.05, 0.25).toFixed(2)})`;
      g.beginPath();
      g.arc(rng.range(0, size), rng.range(0, size), rng.range(0.5, 2.5) * (size / 600), 0, TAU);
      g.fill();
    }
    g.globalCompositeOperation = 'source-over';
  } else {
    const s = SUPPORTS[kind] || SUPPORTS.mitten;
    g.fillStyle = s.base;
    g.fillRect(0, 0, size, size);
    const st = Math.max(6, Math.round(size / 46));
    if (kind !== 'velvet') {
      for (let y = 0; y < size + st; y += st) {
        for (let x = 0; x < size + st; x += st) {
          const v = rng.range(0.5, 1);
          g.strokeStyle = `rgba(${s.light[0]},${s.light[1]},${s.light[2]},${(0.32 * v).toFixed(3)})`;
          g.lineWidth = st * 0.34;
          g.lineCap = 'round';
          g.beginPath();
          g.moveTo(x - st * 0.4, y - st * 0.45);
          g.quadraticCurveTo(x - st * 0.1, y, x, y + st * 0.1);
          g.moveTo(x + st * 0.4, y - st * 0.45);
          g.quadraticCurveTo(x + st * 0.1, y, x, y + st * 0.1);
          g.stroke();
        }
      }
    }
    for (let i = 0; i < (kind === 'velvet' ? 2500 : 500); i++) {
      g.strokeStyle = `rgba(${s.fiber[0]},${s.fiber[1]},${s.fiber[2]},${rng.range(0.03, 0.1).toFixed(3)})`;
      g.lineWidth = rng.range(0.4, 1) * (size / 600);
      const x = rng.range(0, size);
      const y = rng.range(0, size);
      const L = rng.range(3, 14) * (size / 600);
      const a = rng.range(0, TAU);
      g.beginPath();
      g.moveTo(x, y);
      g.quadraticCurveTo(x + Math.cos(a + 0.6) * L, y + Math.sin(a + 0.6) * L, x + Math.cos(a) * L * 1.6, y + Math.sin(a) * L * 1.6);
      g.stroke();
    }
  }
  // Depth of field: darker, softer edges.
  const v = g.createRadialGradient(size / 2, size / 2, size * 0.2, size / 2, size / 2, size * 0.72);
  v.addColorStop(0, 'rgba(0,0,0,0)');
  v.addColorStop(1, 'rgba(0,0,0,0.6)');
  g.fillStyle = v;
  g.fillRect(0, 0, size, size);
  return c;
}

export const SUPPORT_KINDS = ['mitten', 'scarf', 'sleeve', 'sled', 'glass', 'velvet'];
