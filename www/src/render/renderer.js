// Scene renderer: sky, clouds, hazards, ground, the player's crystal and FX.
import { THEMES, ZONE_GLYPH } from './themes.js';
import { ZONES } from '../sim/zones.js';
import { WORLD_W } from '../sim/world.js';
import { CrystalSprite, drawCrystal, crystalExtent } from './crystalRender.js';
import { cloudSprite, glowSprite, hexSprite, sparkleSprite, makeCanvas, rgba } from './sprites.js';
import { drawBackdrop, drawSnowGround, drawLandingObject, drawLandingHint, snowLine } from './ground.js';
import { FX } from './fx.js';
import { RNG } from '../core/rng.js';
import { clamp } from '../core/math.js';

const TAU = Math.PI * 2;
const MODE_ZONE = ['sec', 'brume', 'froid', 'aurore'];

function needleSprite(rgb) {
  const c = makeCanvas(32, 32);
  const g = c.getContext('2d');
  g.drawImage(glowSprite(rgb, 32, 0.15), 6, 6, 20, 20);
  g.strokeStyle = 'rgba(245,240,255,0.95)';
  g.lineWidth = 1.6;
  g.lineCap = 'round';
  g.beginPath();
  g.moveTo(8, 16);
  g.lineTo(24, 16);
  g.stroke();
  return c;
}

function dropletSprite() {
  const c = makeCanvas(24, 24);
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(10, 10, 1, 12, 12, 10);
  grad.addColorStop(0, 'rgba(255,255,255,0.95)');
  grad.addColorStop(0.5, 'rgba(200,230,255,0.55)');
  grad.addColorStop(1, 'rgba(200,230,255,0)');
  g.fillStyle = grad;
  g.beginPath();
  g.arc(12, 12, 10, 0, TAU);
  g.fill();
  return c;
}

function pelletSprite(hail) {
  const s = 48;
  const c = makeCanvas(s, s);
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(s * 0.4, s * 0.38, 1, s / 2, s / 2, s / 2);
  if (hail) {
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.35, 'rgba(205,230,255,0.95)');
    grad.addColorStop(0.85, 'rgba(120,160,215,0.9)');
    grad.addColorStop(1, 'rgba(90,130,190,0)');
  } else {
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.6, 'rgba(225,235,250,0.95)');
    grad.addColorStop(0.9, 'rgba(170,190,225,0.8)');
    grad.addColorStop(1, 'rgba(170,190,225,0)');
  }
  g.fillStyle = grad;
  g.beginPath();
  g.arc(s / 2, s / 2, s / 2, 0, TAU);
  g.fill();
  return c;
}

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.fx = new FX();
    this.flakeSprite = new CrystalSprite();
    this.hazardSprites = new WeakMap();
    this.ghost = null; // {canvas, half}
    this.sprites = {
      needle: needleSprite(ZONES.froid.rgb),
      droplet: dropletSprite(),
      pellet: pelletSprite(false),
      hail: pelletSprite(true),
      shard: sparkleSprite([255, 214, 140], 64),
    };
    this.windStreaks = [];
    this.flash = 0;
    this.shakeAmp = 0;
    this.time = 0;
    this.setQuality(2, false);
    this.resize();
  }

  /**
   * Quality levels (lowered automatically on slow devices):
   * 2 = full, 1 = reduced resolution, 0 = low resolution and fewer particles.
   */
  setQuality(q, apply = true) {
    this.quality = Math.max(0, Math.min(2, q));
    this.maxDpr = [1, 1.5, 2][this.quality];
    this.glowScale = [0.3, 0.33, 0.4][this.quality];
    this.particleScale = [0.55, 0.8, 1][this.quality];
    if (apply) this.resize();
  }

  resize() {
    const cssW = Math.max(1, window.innerWidth);
    const cssH = Math.max(1, window.innerHeight);
    this.dpr = Math.min(window.devicePixelRatio || 1, this.maxDpr);
    this.canvas.width = Math.round(cssW * this.dpr);
    this.canvas.height = Math.round(cssH * this.dpr);
    this.canvas.style.width = `${cssW}px`;
    this.canvas.style.height = `${cssH}px`;
    this.cssW = cssW;
    this.cssH = cssH;
    this.scale = Math.min(cssW / WORLD_W, cssH / 560);
    this.viewW = cssW / this.scale;
    this.viewH = cssH / this.scale;
    this.offX = (this.viewW - WORLD_W) / 2;
    this.ppu = this.scale * this.dpr;
    this.makeLayers();
  }

  makeLayers() {
    const rng = new RNG(99);
    this.stars = [];
    for (let i = 0; i < 140; i++) {
      this.stars.push({ x: rng.range(0, this.viewW), y: rng.range(0, this.viewH * 1.6), s: rng.range(0.4, 1.4), ph: rng.range(0, TAU), b: rng.chance(0.12) });
    }
    this.snowBack = [];
    for (let i = 0; i < 90; i++) this.snowBack.push({ x: rng.range(0, this.viewW), y: rng.range(0, this.viewH), s: rng.range(0.5, 1.3), ph: rng.range(0, TAU), k: rng.range(0.25, 0.5) });
    this.snowFront = [];
    for (let i = 0; i < 16; i++) this.snowFront.push({ x: rng.range(0, this.viewW), y: rng.range(0, this.viewH), s: rng.range(2, 4.5), ph: rng.range(0, TAU), k: rng.range(1.4, 1.8) });
    // Soft additive layer (clouds, aurora) rendered at reduced resolution:
    // these shapes are blurry anyway and this saves a lot of fill-rate.
    this.glow = makeCanvas(this.canvas.width * this.glowScale, this.canvas.height * this.glowScale);
    this.glowCtx = this.glow.getContext('2d');
    this.skyCache = null;
    this.auroraSprites = null;
  }

  setTarget(targetCrystal) {
    if (!targetCrystal) {
      this.ghost = null;
      return;
    }
    const half = Math.ceil(crystalExtent(targetCrystal) + 4);
    const ppu = Math.max(2, this.ppu);
    const c = makeCanvas(half * 2 * ppu, half * 2 * ppu);
    const g = c.getContext('2d');
    g.setTransform(ppu, 0, 0, ppu, c.width / 2, c.height / 2);
    drawCrystal(g, targetCrystal, { ghost: true });
    this.ghost = { canvas: c, half };
  }

  // ------------------------------------------------------------ sky layer

  drawSky(themeKey, camY, rise, noMoon = false) {
    const g = this.ctx;
    const th = THEMES[themeKey] || THEMES.peaks;
    const W = this.canvas.width;
    const H = this.canvas.height;
    if (!this.skyCache || this.skyCache.key !== themeKey) {
      // Sky gradient with the vignette baked in, at half resolution.
      const c = makeCanvas(Math.max(8, W / 2), Math.max(8, H / 2));
      const cg = c.getContext('2d');
      const grad = cg.createLinearGradient(0, 0, 0, c.height);
      grad.addColorStop(0, th.sky[0]);
      grad.addColorStop(0.55, th.sky[1]);
      grad.addColorStop(1, th.sky[2]);
      cg.fillStyle = grad;
      cg.fillRect(0, 0, c.width, c.height);
      const v = cg.createRadialGradient(c.width / 2, c.height * 0.42, Math.min(c.width, c.height) * 0.35, c.width / 2, c.height / 2, Math.max(c.width, c.height) * 0.75);
      v.addColorStop(0, 'rgba(0,0,8,0)');
      v.addColorStop(1, 'rgba(0,0,8,0.5)');
      cg.fillStyle = v;
      cg.fillRect(0, 0, c.width, c.height);
      this.skyCache = { key: themeKey, canvas: c };
    }
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalCompositeOperation = 'copy';
    g.drawImage(this.skyCache.canvas, 0, 0, W, H);
    g.globalCompositeOperation = 'source-over';
    // Horizon glow when approaching the ground.
    if (rise > 0) {
      const grad = g.createLinearGradient(0, H * 0.45, 0, H);
      grad.addColorStop(0, rgba(th.horizon, 0));
      grad.addColorStop(1, rgba(th.horizon, 0.22 * rise));
      g.fillStyle = grad;
      g.fillRect(0, H * 0.45, W, H * 0.55);
    }
    const s = this.ppu;
    // Stars.
    if (th.stars > 0) {
      const span = this.viewH * 1.6;
      g.fillStyle = '#fff';
      for (const st of this.stars) {
        let y = (st.y - camY * 0.02) % span;
        if (y < 0) y += span;
        if (y > this.viewH) continue;
        const fade = (1 - y / this.viewH) * th.stars;
        const tw = 0.55 + 0.45 * Math.sin(this.time * 1.7 + st.ph);
        const a = fade * tw * (st.b ? 1 : 0.7);
        if (a <= 0.03) continue;
        if (st.b) {
          g.globalAlpha = a * 0.8;
          const gs = st.s * 5 * s;
          g.drawImage(glowSprite([220, 230, 255], 32, 0.1), st.x * s - gs / 2, y * s - gs / 2, gs, gs);
        }
        g.globalAlpha = a;
        g.fillRect(st.x * s, y * s, st.s * s * 0.8, st.s * s * 0.8);
      }
      g.globalAlpha = 1;
    }
    // Moon.
    if (th.moon && !noMoon) {
      const mx = th.moon.x * this.viewW * s;
      const my = (th.moon.y * this.viewH - camY * 0.008) * s;
      const r = th.moon.r * s;
      if (my > -r * 4) {
        g.globalAlpha = 0.5;
        g.drawImage(glowSprite([200, 215, 255], 64, 0.05), mx - r * 4, my - r * 4, r * 8, r * 8);
        g.globalAlpha = 1;
        const mg = g.createRadialGradient(mx - r * 0.3, my - r * 0.3, r * 0.1, mx, my, r);
        mg.addColorStop(0, '#fbfcff');
        mg.addColorStop(1, '#c9d4ee');
        g.fillStyle = mg;
        g.beginPath();
        g.arc(mx, my, r, 0, TAU);
        g.fill();
        g.fillStyle = 'rgba(150,165,200,0.25)';
        for (const [ox, oy, rr] of [[-0.3, -0.2, 0.22], [0.25, 0.15, 0.16], [-0.05, 0.4, 0.12]]) {
          g.beginPath();
          g.arc(mx + ox * r, my + oy * r, rr * r, 0, TAU);
          g.fill();
        }
      }
    }
  }

  /** Aurora curtains (screen space) into context `g` at `s` px per unit. */
  drawAurora(g, s, strength, camY) {
    if (!this.auroraSprites) {
      const mk = (rgb) => {
        const c = makeCanvas(4, 128);
        const cg = c.getContext('2d');
        const grad = cg.createLinearGradient(0, 0, 0, 128);
        grad.addColorStop(0, rgba(rgb, 0));
        grad.addColorStop(0.55, rgba(rgb, 0.5));
        grad.addColorStop(0.8, rgba(rgb, 0.9));
        grad.addColorStop(1, rgba(rgb, 0));
        cg.fillStyle = grad;
        cg.fillRect(0, 0, 4, 128);
        return c;
      };
      this.auroraSprites = [mk([90, 255, 170]), mk([230, 110, 220]), mk([110, 210, 255])];
    }
    const t = this.time;
    g.save();
    g.globalCompositeOperation = 'lighter';
    const ribbons = [
      [0.16, 0, 120, 0.9],
      [0.27, 1, 90, 0.5],
      [0.21, 2, 70, 0.45],
    ];
    const lift = camY * 0.01;
    const step = this.quality === 0 ? 9 : 5;
    for (const [by, si, hgt, alpha] of ribbons) {
      const spr = this.auroraSprites[si];
      for (let x = -10; x < this.viewW + 10; x += step) {
        const y = by * this.viewH - lift + Math.sin(x * 0.011 + t * 0.25 + si * 2) * 26 + Math.sin(x * 0.033 + t * 0.4) * 9;
        const hh = hgt * (0.7 + 0.3 * Math.sin(x * 0.02 + t * 0.6 + si));
        const a = alpha * strength * (0.55 + 0.45 * Math.sin(x * 0.05 + t * 0.9 + si * 3));
        if (a <= 0.02) continue;
        g.globalAlpha = a * 0.55;
        g.drawImage(spr, x * s, (y - hh) * s, (step + 1) * s, hh * s);
      }
    }
    g.restore();
  }

  drawSnow(layer, camY, density, wind) {
    const g = this.ctx;
    const s = this.ppu;
    const t = this.time;
    const n = Math.round(layer.length * Math.min(1, density) * this.particleScale);
    const H = this.viewH + 20;
    for (let i = 0; i < n; i++) {
      const p = layer[i];
      let y = (p.y - camY * p.k + t * 12 * p.k) % H;
      if (y < 0) y += H;
      let x = (p.x + Math.sin(t * 0.6 + p.ph) * 8 + wind * t * 0.15 * p.k) % (this.viewW + 20);
      if (x < 0) x += this.viewW + 20;
      const size = p.s * s;
      if (p.s > 1.8) {
        g.globalAlpha = 0.28;
        g.drawImage(glowSprite([235, 242, 255], 32, 0.35), (x - p.s) * s, (y - 10 - p.s) * s, size * 2, size * 2);
      } else {
        g.globalAlpha = 0.55;
        g.fillStyle = '#eef4ff';
        g.fillRect(x * s, (y - 10) * s, size, size);
      }
    }
    g.globalAlpha = 1;
  }

  // ---------------------------------------------------------- world layer

  worldTransform(camY, sx = 0, sy = 0) {
    const p = this.ppu;
    this.ctx.setTransform(p, 0, 0, p, (this.offX + sx) * p, (-camY + sy) * p);
  }

  /** Soft cloud bodies, drawn into the low-resolution glow layer. */
  drawClouds(g, world) {
    const camY = world.camY;
    const top = camY - 60;
    const bottom = camY + this.viewH + 60;
    const t = this.time;
    g.save();
    g.globalCompositeOperation = 'lighter';
    for (const z of world.zones) {
      if (z.y + z.ry < top || z.y - z.ry > bottom) continue;
      const Z = ZONES[z.type];
      const spr = cloudSprite(Z.rgb);
      const base = z.type === 'redoux' ? 0.75 : 0.62;
      for (let i = 0; i < 3; i++) {
        const ox = Math.sin(z.id * 3.1 + i * 2.1 + t * 0.12) * z.rx * 0.16;
        const oy = Math.cos(z.id * 1.7 + i * 2.9 + t * 0.1) * z.ry * 0.14;
        const k = 0.86 + 0.08 * Math.sin(i * 1.3 + z.id);
        g.globalAlpha = base * (i === 0 ? 1 : 0.6);
        g.drawImage(spr, z.cx + ox - z.rx * k, z.y + oy - z.ry * k, z.rx * 2 * k, z.ry * 2 * k);
      }
      if (z.type === 'redoux') {
        g.globalAlpha = 0.35;
        g.strokeStyle = 'rgba(255,170,120,0.9)';
        g.lineWidth = 1.1;
        for (let i = 0; i < 4; i++) {
          const lx = z.cx + (i - 1.5) * z.rx * 0.38;
          g.beginPath();
          for (let yy = -z.ry * 0.7; yy <= z.ry * 0.7; yy += 6) {
            const y = z.y + yy - ((t * 30 + i * 37) % 24);
            const w = Math.sqrt(Math.max(0, 1 - (yy / z.ry) ** 2));
            g.lineTo(lx + Math.sin(yy * 0.12 + t * 3 + i) * 3 * w, y);
          }
          g.stroke();
        }
      }
    }
    g.restore();
  }

  /** Begin the glow layer; `fn(ctx)` draws into it; then it is added on top. */
  glowPass(fn) {
    const gg = this.glowCtx;
    gg.setTransform(1, 0, 0, 1, 0, 0);
    gg.clearRect(0, 0, this.glow.width, this.glow.height);
    fn(gg, this.ppu * this.glowScale);
    const g = this.ctx;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalCompositeOperation = 'lighter';
    g.drawImage(this.glow, 0, 0, this.canvas.width, this.canvas.height);
    g.globalCompositeOperation = 'source-over';
  }

  drawZones(world, opts) {
    const g = this.ctx;
    const camY = world.camY;
    const top = camY - 60;
    const bottom = camY + this.viewH + 60;
    const t = this.time;
    const fy = world.flakeY;
    g.save();
    g.globalCompositeOperation = 'lighter';
    // Motes.
    for (const m of world.motes) {
      if (m.y < top || m.y > bottom) continue;
      const type = m.z.type;
      const tw = 0.6 + 0.4 * Math.sin(t * 3 + m.ph);
      g.globalAlpha = tw;
      if (type === 'sec') {
        g.drawImage(hexSprite(ZONES.sec.rgb), m.x - 4.5, m.y - 4.5, 9, 9);
      } else if (type === 'froid') {
        g.save();
        g.translate(m.x, m.y);
        g.rotate(m.ph + t * 0.5);
        g.drawImage(this.sprites.needle, -6, -6, 12, 12);
        g.restore();
      } else if (type === 'givre') {
        g.drawImage(this.sprites.droplet, m.x - 3, m.y - 3, 6, 6);
      } else {
        const rgb = type === 'aurore' ? (m.ph > 3 ? [255, 130, 230] : [120, 255, 180]) : ZONES[type].rgb;
        g.drawImage(glowSprite(rgb, 32, 0.25), m.x - 4, m.y - 4, 8, 8);
      }
    }
    g.globalAlpha = 1;
    g.restore();

    // Labels for upcoming clouds.
    if (opts.labelFor) {
      g.save();
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.font = '800 11px Nunito, system-ui, sans-serif';
      for (const z of world.zones) {
        if (z.y - z.ry < fy + 30 || z.y - z.ry > bottom - 30) continue;
        const near = clamp((z.y - z.ry - fy - 30) / 140, 0, 1);
        const a = 0.9 * near;
        if (a < 0.05) continue;
        const Z = ZONES[z.type];
        const label = `${ZONE_GLYPH[z.type] || ''} ${opts.labelFor(z.type)}`;
        g.fillStyle = `rgba(6,10,26,${(a * 0.55).toFixed(3)})`;
        const w = g.measureText(label).width + 14;
        const ly = z.y - z.ry * 0.35;
        g.beginPath();
        g.roundRect(z.cx - w / 2, ly - 9, w, 18, 9);
        g.fill();
        g.fillStyle = rgba(Z.rgb.map((v) => Math.min(255, v + 40)), a);
        g.fillText(label, z.cx, ly + 0.5);
      }
      g.restore();
    }
  }

  drawShards(world) {
    const g = this.ctx;
    const t = this.time;
    const top = world.camY - 20;
    const bottom = world.camY + this.viewH + 20;
    g.save();
    g.globalCompositeOperation = 'lighter';
    for (const s of world.shards) {
      if (s.taken || s.y < top || s.y > bottom) continue;
      const pulse = 0.85 + 0.15 * Math.sin(t * 4 + s.x);
      const size = 15 * pulse;
      g.save();
      g.translate(s.x, s.y + Math.sin(t * 2 + s.y) * 2);
      g.rotate(t * 0.6 + s.x);
      g.drawImage(this.sprites.shard, -size / 2, -size / 2, size, size);
      g.restore();
    }
    g.restore();
  }

  drawHazards(world) {
    const g = this.ctx;
    const t = this.time;
    const camY = world.camY;
    for (const h of world.hazards) {
      if (h.y < camY - 30 || h.y > camY + this.viewH + 40) continue;
      if (h.type === 'pellet' || h.type === 'hail') {
        const spr = h.type === 'hail' ? this.sprites.hail : this.sprites.pellet;
        // Motion trail.
        const len = h.rel * 0.12;
        const grad = g.createLinearGradient(h.x, h.y - len, h.x, h.y);
        grad.addColorStop(0, 'rgba(220,235,255,0)');
        grad.addColorStop(1, 'rgba(220,235,255,0.35)');
        g.strokeStyle = grad;
        g.lineWidth = h.r * 1.4;
        g.lineCap = 'round';
        g.beginPath();
        g.moveTo(h.x, h.y - len);
        g.lineTo(h.x, h.y);
        g.stroke();
        g.drawImage(spr, h.x - h.r * 1.15, h.y - h.r * 1.15, h.r * 2.3, h.r * 2.3);
      } else if (h.type === 'flake') {
        let sp = this.hazardSprites.get(h);
        if (!sp) {
          sp = new CrystalSprite();
          this.hazardSprites.set(h, sp);
        }
        sp.sync(h.crystal, this.ppu, 0, true);
        g.save();
        g.globalAlpha = h.twin ? 0.95 : 0.8;
        if (h.twin) {
          g.globalCompositeOperation = 'lighter';
          g.drawImage(glowSprite([170, 220, 255], 64, 0.1), h.x - h.r * 2.2, h.y - h.r * 2.2, h.r * 4.4, h.r * 4.4);
          g.globalCompositeOperation = 'source-over';
        }
        sp.draw(g, h.x, h.y, h.rot);
        g.restore();
      } else if (h.type === 'bird') {
        const flap = Math.sin(t * 11 + h.ph);
        const dir = Math.sign(h.vx) || 1;
        g.save();
        g.translate(h.x, h.y);
        g.scale(dir * 1.5, 1.5);
        g.fillStyle = '#0a0e1c';
        g.strokeStyle = 'rgba(190,210,245,0.7)';
        g.lineWidth = 0.7;
        g.beginPath();
        g.ellipse(0, 0, 9, 3.6, 0, 0, TAU);
        g.fill();
        g.stroke();
        g.beginPath();
        g.moveTo(6, -1.5);
        g.lineTo(11, -0.5);
        g.lineTo(6, 1);
        g.fill();
        g.beginPath();
        g.moveTo(-3, 0);
        g.quadraticCurveTo(-1, -12 * flap - 2, 4, -14 * flap);
        g.quadraticCurveTo(3, -4 * flap, 3, 0);
        g.closePath();
        g.fill();
        g.stroke();
        g.beginPath();
        g.moveTo(-8, 0);
        g.lineTo(-12, -2.5);
        g.lineTo(-12, 2.5);
        g.closePath();
        g.fill();
        g.restore();
      }
    }
    // Warnings for hazards still above the view.
    g.save();
    g.lineCap = 'round';
    g.lineJoin = 'round';
    for (const h of world.hazards) {
      if ((h.type !== 'pellet' && h.type !== 'hail') || h.y >= camY + 2 || h.hit) continue;
      const k = clamp(1 - (camY - h.y) / (h.rel * 1.1), 0, 1);
      if (k <= 0) continue;
      const y = camY + 12;
      g.globalAlpha = 0.35 + 0.6 * k;
      g.strokeStyle = h.type === 'hail' ? 'rgba(255,190,140,1)' : 'rgba(230,240,255,1)';
      g.lineWidth = h.type === 'hail' ? 2.4 : 1.8;
      const w = h.type === 'hail' ? 7 : 5;
      g.beginPath();
      g.moveTo(h.x - w, y - 3);
      g.lineTo(h.x, y + 3);
      g.lineTo(h.x + w, y - 3);
      g.stroke();
    }
    g.restore();
  }

  drawObstacles(world) {
    if (!world.obstacles.length) return;
    const g = this.ctx;
    g.save();
    g.lineCap = 'round';
    for (const o of world.obstacles) {
      g.strokeStyle = '#2a1c16';
      g.lineWidth = o.r * 2;
      g.beginPath();
      g.moveTo(o.x1, o.y1);
      g.lineTo(o.x2, o.y2);
      g.stroke();
      // Needles.
      g.strokeStyle = '#123026';
      g.lineWidth = 1.2;
      const n = Math.round(Math.hypot(o.x2 - o.x1, o.y2 - o.y1) / 6);
      g.beginPath();
      for (let i = 1; i < n; i++) {
        const x = o.x1 + ((o.x2 - o.x1) * i) / n;
        const y = o.y1 + ((o.y2 - o.y1) * i) / n;
        g.moveTo(x, y);
        g.lineTo(x - 4, y + 7);
        g.moveTo(x, y);
        g.lineTo(x + 4, y + 7);
      }
      g.stroke();
      // Snow on top.
      g.strokeStyle = 'rgba(240,246,255,0.95)';
      g.lineWidth = o.r * 0.9;
      g.beginPath();
      g.moveTo(o.x1, o.y1 - o.r * 0.7);
      g.lineTo(o.x2, o.y2 - o.r * 0.7);
      g.stroke();
    }
    g.restore();
  }

  drawGround(world, themeKey) {
    const camY = world.camY;
    const gy = world.groundY;
    if (gy - camY > this.viewH + 320) return 0;
    const g = this.ctx;
    const th = THEMES[themeKey] || THEMES.peaks;
    const rise = clamp(1 - (gy - camY - this.viewH * 0.84) / (this.viewH * 0.9), 0, 1);
    const x0 = -this.offX - 10;
    const x1 = WORLD_W + this.offX + 10;
    drawBackdrop(g, th, themeKey, gy, x0, x1, this.time, rise);
    const L = world.landing;
    const hint = world.status === 'play' ? (world.final ? 1 : rise * 0.6) : 0;
    if (hint > 0) drawLandingHint(g, L.x, L.y, L.w, this.time, hint, 'glow');
    drawLandingObject(g, L.kind, L.x, L.y, L.w, this.time, snowLine(gy, L.x) + 4);
    drawSnowGround(g, th, gy, x0, x1, this.time);
    if (hint > 0) drawLandingHint(g, L.x, L.y, L.w, this.time, hint, 'arrow');
    return rise;
  }

  drawPlayer(world, opts) {
    const g = this.ctx;
    const f = world.flake;
    const c = world.crystal;
    const x = f.x + (f.shake > 0 ? Math.sin(this.time * 70) * f.shake * 2.5 : 0);
    const y = world.flakeY;
    const R = Math.max(c.R, 3);
    // Glow.
    g.save();
    g.globalCompositeOperation = 'lighter';
    const zrgb = world.zoneKey ? ZONES[world.zoneKey].rgb : [170, 205, 255];
    const gs = (R + 18) * 2.3;
    g.globalAlpha = 0.33 + 0.15 * world.zoneQ;
    g.drawImage(glowSprite(zrgb, 64, 0.12), x - gs / 2, y - gs / 2, gs, gs);
    g.restore();

    // Target ghost.
    if (this.ghost) {
      g.save();
      g.globalAlpha = 0.2;
      g.translate(x, y);
      g.rotate(f.rot);
      const hh = this.ghost.half;
      g.drawImage(this.ghost.canvas, -hh, -hh, hh * 2, hh * 2);
      g.restore();
    }

    // While the crystal is tiny, a soft marker makes it easy to find.
    if (R < 13) {
      const k = 1 - R / 13;
      g.save();
      g.globalCompositeOperation = 'lighter';
      g.globalAlpha = 0.55 * k;
      g.drawImage(glowSprite([235, 245, 255], 64, 0.2), x - 12, y - 12, 24, 24);
      g.restore();
      g.save();
      g.strokeStyle = `rgba(225,240,255,${(0.45 * k * (0.7 + 0.3 * Math.sin(this.time * 3))).toFixed(3)})`;
      g.lineWidth = 1.2;
      g.beginPath();
      g.arc(x, y, Math.max(R + 7, 13), 0, TAU);
      g.stroke();
      g.restore();
    }

    const blink = f.inv > 0 && Math.floor(this.time * 16) % 2 === 0;
    this.flakeSprite.sync(c, this.ppu, this.time * 1000);
    g.save();
    g.globalAlpha = blink ? 0.45 : 1;
    this.flakeSprite.draw(g, x, y, f.rot);
    g.restore();

    // Target ring: colour of the cloud needed now.
    if (opts.expected !== undefined && opts.expected !== null && world.status === 'play') {
      const rr = R + 7;
      g.save();
      g.lineWidth = 1.6;
      g.lineCap = 'round';
      if (opts.expected === -2) {
        g.strokeStyle = 'rgba(255,255,255,0.75)';
        g.setLineDash([2, 4]);
        g.beginPath();
        g.arc(x, y, rr, 0, TAU);
        g.stroke();
      } else if (opts.expected >= 0) {
        const rgb = ZONES[MODE_ZONE[opts.expected]].rgb;
        g.strokeStyle = rgba(rgb, 0.9);
        g.setLineDash([6, 5]);
        g.lineDashOffset = -this.time * 12;
        g.beginPath();
        g.arc(x, y, rr, 0, TAU);
        g.stroke();
      }
      g.restore();
    }
  }

  updateWind(dt, wind) {
    const strength = Math.min(1, Math.abs(wind) / 120);
    if (strength > 0.05 && this.windStreaks.length < 26 * strength) {
      this.windStreaks.push({ x: wind > 0 ? -30 : this.viewW + 30, y: Math.random() * this.viewH, len: 20 + Math.random() * 50, v: wind * (2.2 + Math.random()), life: 1 });
    }
    for (const s of this.windStreaks) s.x += s.v * dt;
    this.windStreaks = this.windStreaks.filter((s) => s.x > -100 && s.x < this.viewW + 100);
    this.windStrength = strength;
  }

  drawWind() {
    if (!this.windStreaks.length) return;
    const g = this.ctx;
    const s = this.ppu;
    g.save();
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.strokeStyle = 'rgba(225,235,255,0.22)';
    g.lineWidth = 1.2 * s;
    g.lineCap = 'round';
    g.beginPath();
    for (const st of this.windStreaks) {
      g.moveTo(st.x * s, st.y * s);
      g.lineTo((st.x - Math.sign(st.v) * st.len) * s, st.y * s);
    }
    g.stroke();
    g.restore();
  }

  // ---------------------------------------------------------------- frame

  /** Render one frame of a fall. */
  render(world, dt, opts = {}) {
    this.time += dt;
    const g = this.ctx;
    const themeKey = world.def.theme || 'peaks';
    const th = THEMES[themeKey] || THEMES.peaks;
    const camY = world.camY;
    this.fx.update(dt);
    this.updateWind(dt, world.windNow);
    this.flash = Math.max(0, this.flash - dt * 3);
    this.shakeAmp = Math.max(0, this.shakeAmp - dt * 4);

    const gy = world.groundY;
    const rise = clamp(1 - (gy - camY - this.viewH * 0.84) / (this.viewH * 0.9), 0, 1);
    this.drawSky(themeKey, camY, rise);
    g.setTransform(1, 0, 0, 1, 0, 0);
    this.drawSnow(this.snowBack, camY, th.snow * (opts.reduced ? 0.5 : 1), world.windNow);

    const sx = this.shakeAmp > 0 && !opts.reduced ? (Math.random() - 0.5) * this.shakeAmp * 5 : 0;
    const sy = this.shakeAmp > 0 && !opts.reduced ? (Math.random() - 0.5) * this.shakeAmp * 5 : 0;
    this.glowPass((gg, s) => {
      if (th.aurora > 0) this.drawAurora(gg, s, th.aurora, camY);
      gg.setTransform(s, 0, 0, s, (this.offX + sx) * s, (-camY + sy) * s);
      this.drawClouds(gg, world);
    });
    this.worldTransform(camY, sx, sy);
    // Darken outside the playfield on wide screens.
    if (this.offX > 4) {
      g.fillStyle = 'rgba(0,0,10,0.25)';
      g.fillRect(-this.offX - 2, camY - 10, this.offX + 2, this.viewH + 20);
      g.fillRect(WORLD_W, camY - 10, this.offX + 2, this.viewH + 20);
    }
    this.drawGround(world, themeKey);
    this.drawZones(world, opts);
    this.drawShards(world);
    this.drawObstacles(world);
    this.drawHazards(world);
    this.drawPlayer(world, opts);
    this.fx.draw(g);

    g.setTransform(1, 0, 0, 1, 0, 0);
    this.drawSnow(this.snowFront, camY, th.snow, world.windNow);
    this.drawWind();
    if (world.zoneKey === 'redoux') {
      g.fillStyle = `rgba(255,120,60,${(0.07 + 0.04 * Math.sin(this.time * 6)).toFixed(3)})`;
      g.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }
    if (this.flash > 0 && !opts.reduced) {
      g.fillStyle = `rgba(255,255,255,${(this.flash * 0.25).toFixed(3)})`;
      g.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }
  }

  /** Background for menus: sky, snow and a large slowly turning crystal. */
  renderMenu(dt, themeKey, crystal, opts = {}) {
    this.time += dt;
    const g = this.ctx;
    const th = THEMES[themeKey] || THEMES.peaks;
    const camY = this.time * 14;
    this.drawSky(themeKey, camY, 0.35, !!opts.noMoon);
    if (th.aurora > 0) this.glowPass((gg, s) => this.drawAurora(gg, s, th.aurora, camY));
    g.setTransform(1, 0, 0, 1, 0, 0);
    this.drawSnow(this.snowBack, camY, th.snow, 0);
    if (crystal) {
      this.worldTransform(0);
      const cx = WORLD_W / 2;
      const cy = this.viewH * (opts.y ?? 0.3);
      const R = Math.max(10, crystal.R);
      const k = (opts.size ?? 92) / R;
      g.save();
      g.globalCompositeOperation = 'lighter';
      g.globalAlpha = 0.35;
      const gs = (opts.size ?? 92) * 3;
      g.drawImage(glowSprite([150, 190, 255], 64, 0.1), cx - gs / 2, cy - gs / 2, gs, gs);
      g.restore();
      this.flakeSprite.sync(crystal, this.ppu * k, this.time * 1000, true);
      g.save();
      g.translate(cx, cy);
      g.scale(1 / 1, 1 / 1);
      this.flakeSprite.draw(g, 0, 0, this.time * 0.08, k);
      g.restore();
    }
    g.setTransform(1, 0, 0, 1, 0, 0);
    this.drawSnow(this.snowFront, camY, th.snow * 0.7, 0);
  }

  // -------------------------------------------------------------- events

  onEvent(e, world) {
    const f = world.flake;
    const target = { x: f.x, y: world.flakeY };
    switch (e.type) {
      case 'mote':
        this.fx.streak(e.x, e.y, ZONES[e.key].rgb, { get x() { return world.flake.x; }, get y() { return world.flakeY; } });
        break;
      case 'shard':
        this.fx.sparkle(e.x, e.y, [255, 214, 140], 12, 70, 3);
        this.fx.ring(e.x, e.y, [255, 220, 150], 4, 26, 0.5, 1.6);
        break;
      case 'hit':
        this.fx.ice(e.x, e.y, e.core ? 14 : 8, e.core ? 90 : 60);
        this.fx.ring(target.x, target.y, [200, 225, 255], 6, world.crystal.R + 20, 0.4, 2);
        this.shakeAmp = e.kind === 'hail' || e.core ? 1 : 0.6;
        this.flash = 0.6;
        break;
      case 'merge':
        this.fx.sparkle(e.x, e.y, [190, 220, 255], 14, 60, 2.5);
        this.fx.ring(target.x, target.y, [190, 220, 255], 6, 50, 0.6, 2);
        break;
      case 'landed':
        this.fx.sparkle(e.x, e.y, [255, 230, 170], 26, 90, 3);
        this.fx.ring(e.x, e.y, [255, 230, 170], 6, 80, 0.9, 2.5);
        break;
      case 'failed':
        this.fx.ice(target.x, target.y, 16, 70);
        break;
      default:
        break;
    }
  }
}
