// Lightweight particle effects (world coordinates).
import { glowSprite } from './sprites.js';

const MAX = 420;

export class FX {
  constructor() {
    this.p = [];
  }

  clear() {
    this.p.length = 0;
  }

  add(o) {
    if (this.p.length >= MAX) this.p.shift();
    this.p.push({ life: 1, age: 0, vx: 0, vy: 0, size: 2, rot: 0, vr: 0, g: 0, ...o });
  }

  /** Vapour mote flying into the crystal. */
  streak(x, y, rgb, target) {
    this.add({ kind: 'streak', x, y, rgb, target, life: 0.35, size: 2.2 });
  }

  sparkle(x, y, rgb, n = 6, speed = 40, size = 2.4) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = speed * (0.4 + Math.random() * 0.8);
      this.add({ kind: 'spark', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, rgb, life: 0.5 + Math.random() * 0.5, size: size * (0.6 + Math.random() * 0.6) });
    }
  }

  ice(x, y, n = 8, speed = 70) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = speed * (0.4 + Math.random());
      this.add({
        kind: 'ice',
        x,
        y,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v - 20,
        g: 160,
        life: 0.6 + Math.random() * 0.5,
        size: 1.2 + Math.random() * 2.2,
        rot: Math.random() * 6,
        vr: (Math.random() - 0.5) * 14,
      });
    }
  }

  ring(x, y, rgb, r0 = 4, r1 = 40, life = 0.6, width = 1.5) {
    this.add({ kind: 'ring', x, y, rgb, r0, r1, life, width });
  }

  update(dt) {
    const out = [];
    for (const q of this.p) {
      q.age += dt;
      if (q.age >= q.life) continue;
      if (q.kind === 'streak' && q.target) {
        const k = Math.min(1, dt * 14);
        q.x += (q.target.x - q.x) * k;
        q.y += (q.target.y - q.y) * k;
      } else {
        q.vy += q.g * dt;
        q.x += q.vx * dt;
        q.y += q.vy * dt;
        q.vx *= 1 - dt * 2.2;
        q.vy *= 1 - dt * 1.2;
        q.rot += q.vr * dt;
      }
      out.push(q);
    }
    this.p = out;
  }

  draw(g) {
    if (!this.p.length) return;
    g.save();
    g.globalCompositeOperation = 'lighter';
    for (const q of this.p) {
      const k = 1 - q.age / q.life;
      if (q.kind === 'ring') {
        const r = q.r0 + (q.r1 - q.r0) * (1 - k * k);
        g.strokeStyle = `rgba(${q.rgb[0]},${q.rgb[1]},${q.rgb[2]},${(k * 0.8).toFixed(3)})`;
        g.lineWidth = q.width * k + 0.2;
        g.beginPath();
        g.arc(q.x, q.y, r, 0, Math.PI * 2);
        g.stroke();
      } else if (q.kind === 'ice') {
        g.save();
        g.translate(q.x, q.y);
        g.rotate(q.rot);
        g.fillStyle = `rgba(235,245,255,${(k * 0.9).toFixed(3)})`;
        g.beginPath();
        g.moveTo(0, -q.size);
        g.lineTo(q.size * 0.5, q.size * 0.6);
        g.lineTo(-q.size * 0.5, q.size * 0.6);
        g.closePath();
        g.fill();
        g.restore();
      } else {
        const sp = glowSprite(q.rgb || [255, 255, 255], 32, 0.2);
        const s = q.size * (q.kind === 'streak' ? 1 : 0.6 + k * 0.6) * 2.4;
        g.globalAlpha = Math.min(1, k * 1.4);
        g.drawImage(sp, q.x - s, q.y - s, s * 2, s * 2);
        g.globalAlpha = 1;
      }
    }
    g.restore();
  }
}
