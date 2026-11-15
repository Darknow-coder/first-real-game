// Chapter banners drawn with the game's own landscape renderer.
import { THEMES } from './themes.js';
import { drawPanorama } from './ground.js';
import { makeCanvas, glowSprite } from './sprites.js';
import { RNG } from '../core/rng.js';

const cache = new Map();

export function chapterBanner(themeKey, cssW, cssH, seed = 1) {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const key = `${themeKey}|${cssW}|${cssH}|${dpr}|${seed}`;
  if (cache.has(key)) return cache.get(key);
  const W = Math.round(cssW * dpr);
  const H = Math.round(cssH * dpr);
  const c = makeCanvas(W, H);
  const g = c.getContext('2d');
  const th = THEMES[themeKey] || THEMES.peaks;
  const sky = g.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, th.sky[0]);
  sky.addColorStop(0.7, th.sky[1]);
  sky.addColorStop(1, th.sky[2]);
  g.fillStyle = sky;
  g.fillRect(0, 0, W, H);
  const rng = new RNG(seed * 31 + themeKey.length);
  for (let i = 0; i < 60; i++) {
    g.fillStyle = `rgba(255,255,255,${rng.range(0.2, 0.85).toFixed(2)})`;
    const s = rng.range(0.6, 1.6) * dpr;
    g.fillRect(rng.range(0, W), rng.range(0, H * 0.6), s, s);
  }
  if (th.aurora) {
    g.globalCompositeOperation = 'lighter';
    for (let x = 0; x < W; x += 3 * dpr) {
      const y = H * 0.18 + Math.sin(x * 0.012 + 1) * H * 0.08;
      const hh = H * (0.25 + 0.15 * Math.sin(x * 0.03));
      const grad = g.createLinearGradient(0, y - hh, 0, y);
      grad.addColorStop(0, 'rgba(90,255,170,0)');
      grad.addColorStop(1, x % (40 * dpr) < 14 * dpr ? 'rgba(230,110,220,0.35)' : 'rgba(90,255,170,0.35)');
      g.fillStyle = grad;
      g.fillRect(x, y - hh, 3 * dpr, hh);
    }
    g.globalCompositeOperation = 'source-over';
  }
  if (th.moon) {
    const mx = W * 0.86;
    const my = H * 0.25;
    const r = H * 0.11;
    g.globalAlpha = 0.6;
    g.drawImage(glowSprite([200, 215, 255], 64, 0.05), mx - r * 4, my - r * 4, r * 8, r * 8);
    g.globalAlpha = 1;
    g.fillStyle = '#eef2ff';
    g.beginPath();
    g.arc(mx, my, r, 0, Math.PI * 2);
    g.fill();
  }
  // Landscape in "units": 0.45 of the panorama scale fits a short banner.
  const u = (H / 210) * 1.0;
  const w = W / u;
  g.setTransform(u, 0, 0, u, 0, 0);
  drawPanorama(g, th, themeKey, w, 210, 125, 0, seed + 4);
  g.setTransform(1, 0, 0, 1, 0, 0);
  // Darken the bottom-left for the text.
  const shade = g.createLinearGradient(0, 0, W, 0);
  shade.addColorStop(0, 'rgba(4,7,20,0.65)');
  shade.addColorStop(0.65, 'rgba(4,7,20,0.1)');
  shade.addColorStop(1, 'rgba(4,7,20,0)');
  g.fillStyle = shade;
  g.fillRect(0, 0, W, H);
  cache.set(key, c);
  return c;
}
