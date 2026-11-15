// Offscreen canvas helpers and pre-rendered sprites (glows, motes...).

export function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w));
  c.height = Math.max(1, Math.ceil(h));
  return c;
}

export const rgba = (rgb, a) => `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${a})`;

const cache = new Map();

/** Soft radial glow sprite (white core fading to transparent). */
export function glowSprite(rgb, size = 64, hardness = 0.25) {
  const key = `g:${rgb.join(',')}:${size}:${hardness}`;
  if (cache.has(key)) return cache.get(key);
  const c = makeCanvas(size, size);
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, rgba(rgb, 1));
  grad.addColorStop(hardness, rgba(rgb, 0.55));
  grad.addColorStop(0.6, rgba(rgb, 0.16));
  grad.addColorStop(1, rgba(rgb, 0));
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  cache.set(key, c);
  return c;
}

/** Cloud sprite: soft blob, brighter in the middle, transparent at the edge. */
export function cloudSprite(rgb, size = 128) {
  const key = `c:${rgb.join(',')}:${size}`;
  if (cache.has(key)) return cache.get(key);
  const c = makeCanvas(size, size);
  const g = c.getContext('2d');
  const r = size / 2;
  const grad = g.createRadialGradient(r, r, 0, r, r, r);
  grad.addColorStop(0, rgba(rgb, 0.5));
  grad.addColorStop(0.45, rgba(rgb, 0.36));
  grad.addColorStop(0.75, rgba(rgb, 0.14));
  grad.addColorStop(1, rgba(rgb, 0));
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  cache.set(key, c);
  return c;
}

/** Tiny hexagon outline sprite used for "dry air" motes. */
export function hexSprite(rgb, size = 24) {
  const key = `h:${rgb.join(',')}:${size}`;
  if (cache.has(key)) return cache.get(key);
  const c = makeCanvas(size, size);
  const g = c.getContext('2d');
  const glow = glowSprite(rgb, 64, 0.1);
  g.globalAlpha = 0.5;
  g.drawImage(glow, 0, 0, size, size);
  g.globalAlpha = 1;
  g.strokeStyle = rgba([235, 245, 255], 0.95);
  g.lineWidth = size * 0.07;
  g.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const x = size / 2 + Math.cos(a) * size * 0.22;
    const y = size / 2 + Math.sin(a) * size * 0.22;
    if (i === 0) g.moveTo(x, y);
    else g.lineTo(x, y);
  }
  g.closePath();
  g.stroke();
  cache.set(key, c);
  return c;
}

/** Star-like sparkle for shards. */
export function sparkleSprite(rgb, size = 64) {
  const key = `s:${rgb.join(',')}:${size}`;
  if (cache.has(key)) return cache.get(key);
  const c = makeCanvas(size, size);
  const g = c.getContext('2d');
  g.drawImage(glowSprite(rgb, size, 0.15), 0, 0, size, size);
  g.translate(size / 2, size / 2);
  g.fillStyle = 'rgba(255,255,255,0.95)';
  for (let k = 0; k < 2; k++) {
    g.save();
    g.rotate((k * Math.PI) / 4);
    const L = k === 0 ? size * 0.46 : size * 0.26;
    const W = size * 0.05;
    g.beginPath();
    g.moveTo(-L, 0);
    g.quadraticCurveTo(0, -W, L, 0);
    g.quadraticCurveTo(0, W, -L, 0);
    g.moveTo(0, -L);
    g.quadraticCurveTo(-W, 0, 0, L);
    g.quadraticCurveTo(W, 0, 0, -L);
    g.fill();
    g.restore();
  }
  cache.set(key, c);
  return c;
}
