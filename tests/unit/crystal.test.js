import test from 'node:test';
import assert from 'node:assert/strict';
import { Crystal, MODE, CORE_R, R_MAX } from '../../www/src/sim/crystal.js';

const summary = (c) => ({
  R: c.arms.map((a) => +a.R.toFixed(6)),
  segs: c.arms.map((a) => a.segs.map((s) => [s.m, +s.r0.toFixed(6), +s.r1.toFixed(6), +s.w.toFixed(6)])),
  branches: c.arms.map((a) => a.branches.map((b) => [+b.r.toFixed(6), +b.len.toFixed(6), +b.cap.toFixed(6), b.fern])),
  beads: c.arms.map((a) => a.beads.length),
});

test('starts as a small hexagonal prism', () => {
  const c = new Crystal(1);
  assert.equal(c.R, CORE_R);
  assert.equal(c.arms.length, 6);
});

test('growth is chunk-invariant (many small steps == one big step)', () => {
  const a = new Crystal(42);
  const b = new Crystal(42);
  for (let i = 0; i < 600; i++) a.grow(MODE.DENDRITE, 0.03, 0.75);
  b.grow(MODE.DENDRITE, 18, 0.75);
  assert.deepEqual(summary(a), summary(b));
  for (let i = 0; i < 100; i++) a.grow(MODE.PLATE, 0.05, 0.5);
  b.grow(MODE.PLATE, 5, 0.5);
  assert.deepEqual(summary(a), summary(b));
});

test('a crystal rebuilt from its log is identical', () => {
  const c = new Crystal(7);
  c.grow(MODE.PLATE, 4, 0.75);
  for (let i = 0; i < 50; i++) c.grow(MODE.DENDRITE, 0.2, i % 7 === 0 ? 1 : 0.75);
  c.rime(5);
  c.grow(MODE.NEEDLE, 3, 0.75);
  c.melt(1.5);
  c.breakArm(2, 9);
  c.grow(MODE.AURORA, 4, 0.75);
  c.attach(99, 8, 3, 2, 0.4, false);
  const r = Crystal.fromLog(c.seed, c.compactLog());
  const sa = summary(c);
  const sb = summary(r);
  assert.deepEqual(sb.segs.map((x) => x.length), sa.segs.map((x) => x.length));
  sa.R.forEach((v, i) => assert.ok(Math.abs(v - sb.R[i]) < 1e-3));
  assert.deepEqual(sb.beads, sa.beads);
  assert.equal(r.attached.length, 1);
});

test('dendrite growth spawns symmetric side branches that keep growing', () => {
  const c = new Crystal(3);
  c.grow(MODE.DENDRITE, 20, 1);
  const counts = c.arms.map((a) => a.branches.length);
  assert.ok(counts[0] > 3);
  assert.ok(counts.every((n) => n === counts[0]), 'all arms identical');
  assert.ok(c.arms[0].branches.some((b) => b.fern));
  for (const b of c.arms[0].branches) assert.ok(b.len <= b.max + 1e-9);
});

test('mode change stops branches and plate growth caps them', () => {
  const c = new Crystal(3);
  c.grow(MODE.DENDRITE, 12, 0.75);
  const before = c.arms[0].branches.map((b) => b.len);
  c.grow(MODE.PLATE, 5, 0.75);
  const after = c.arms[0].branches.map((b) => b.len);
  assert.deepEqual(after, before);
  assert.ok(c.arms[0].branches.some((b) => b.cap > 0));
});

test('melting shrinks the crystal', () => {
  const c = Crystal.fromRecipe(1, [['dendrite', 15, 0.75]]);
  const R = c.R;
  c.melt(4);
  assert.ok(Math.abs(c.R - (R - 4)) < 1e-6);
  assert.ok(c.melted === 4);
});

test('breaking an arm truncates only that arm', () => {
  const c = Crystal.fromRecipe(1, [['dendrite', 15, 0.75]]);
  const R = c.R;
  assert.ok(c.breakArm(2, 8));
  assert.ok(Math.abs(c.arms[2].R - 8) < 1e-9);
  assert.equal(c.arms[0].R, R);
  assert.equal(c.hits, 1);
  assert.ok(c.arms[2].branches.every((b) => b.r < 8));
});

test('radius is capped at R_MAX', () => {
  const c = new Crystal(2);
  c.grow(MODE.NEEDLE, R_MAX * 2, 0.75);
  assert.ok(c.R <= R_MAX + 1e-9);
});

test('triangular weights make alternate arms shorter', () => {
  const c = new Crystal(2);
  c.grow(MODE.PLATE, 10, 0.75, 1);
  assert.ok(c.arms[0].R > c.arms[1].R * 1.5);
  assert.ok(Math.abs(c.arms[0].R - c.arms[2].R) < 1e-9);
});

test('half-width: needles are thin, plates and dendrites wide', () => {
  const n = Crystal.fromRecipe(1, [['needle', 20, 0.75]]);
  const d = Crystal.fromRecipe(1, [['dendrite', 20, 1]]);
  assert.ok(n.halfWidthAt(0, 15) < d.halfWidthAt(0, 15));
});
