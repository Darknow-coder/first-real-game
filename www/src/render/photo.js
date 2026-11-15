// "Photographs" of crystals: macro shot on a dark support, used by the
// results screen, the album and image export.
import { drawCrystal, crystalExtent } from './crystalRender.js';
import { supportTexture } from './ground.js';
import { glowSprite, makeCanvas } from './sprites.js';

const textures = new Map();

function texture(kind, size) {
  const bucket = size <= 160 ? 160 : size <= 420 ? 420 : 900;
  const key = `${kind}:${bucket}`;
  if (!textures.has(key)) textures.set(key, supportTexture(kind, bucket, kind.length * 7 + 3));
  return textures.get(key);
}

/**
 * Draw a photo into `canvas` (square or not).
 * @param {object} o {support, fill (0..1 of the short side), rot, caption}
 */
export function drawPhoto(canvas, crystal, o = {}) {
  const g = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;
  const S = Math.max(W, H);
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.drawImage(texture(o.support || 'mitten', S), (W - S) / 2, (H - S) / 2, S, S);
  const ext = Math.max(8, crystalExtent(crystal));
  const scale = (Math.min(W, H) * (o.fill ?? 0.4)) / ext;
  const cx = W / 2;
  const cy = H * (o.cy ?? 0.5);
  // Soft light pooling around the crystal.
  g.save();
  g.globalCompositeOperation = 'lighter';
  g.globalAlpha = 0.22;
  const gs = ext * scale * 3.2;
  g.drawImage(glowSprite([170, 200, 255], 64, 0.08), cx - gs / 2, cy - gs / 2, gs, gs);
  g.restore();
  // Contact shadow.
  g.save();
  g.translate(cx + ext * scale * 0.04, cy + ext * scale * 0.06);
  g.scale(scale, scale);
  g.rotate(o.rot ?? 0);
  g.globalAlpha = 0.35;
  g.filter = 'blur(2px)';
  drawCrystal(g, crystal, { ghost: true, detail: 0.3 });
  g.restore();
  g.filter = 'none';
  g.save();
  g.translate(cx, cy);
  g.scale(scale, scale);
  g.rotate(o.rot ?? 0);
  drawCrystal(g, crystal, { detail: 1 });
  g.restore();
}

export function thumbnail(crystal, size, support) {
  const c = makeCanvas(size, size);
  drawPhoto(c, crystal, { support, fill: 0.42 });
  return c;
}
