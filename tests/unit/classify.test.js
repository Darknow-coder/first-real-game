import test from 'node:test';
import assert from 'node:assert/strict';
import { Crystal, MODE } from '../../www/src/sim/crystal.js';
import { analyse, similarity, expectedMode, TYPES, diameterMm } from '../../www/src/sim/classify.js';

const typeOf = (c) => analyse(c).type;

test('recipes produce the expected morphologies', () => {
  assert.equal(typeOf(Crystal.fromRecipe(1, [['plate', 2]])), 'prism');
  assert.equal(typeOf(Crystal.fromRecipe(1, [['plate', 10]])), 'plate');
  assert.equal(typeOf(Crystal.fromRecipe(1, [['plate', 6], ['dendrite', 1, 0.5], ['plate', 14]])), 'sectored');
  assert.equal(typeOf(Crystal.fromRecipe(1, [['dendrite', 22, 0.5]])), 'stellar_dendrite');
  assert.equal(typeOf(Crystal.fromRecipe(1, [['dendrite', 22, 1]])), 'fernlike');
  assert.equal(typeOf(Crystal.fromRecipe(1, [['needle', 22, 0.75]])), 'needle_star');
  assert.equal(typeOf(Crystal.fromRecipe(1, [['plate', 3], ['dendrite', 16, 0.75], ['plate', 7]])), 'stellar_plate');
  assert.equal(typeOf(Crystal.fromRecipe(1, [['plate', 9], ['dendrite', 14, 0.75]])), 'plate_dendrite');
  assert.equal(typeOf(Crystal.fromRecipe(1, [['plate', 3], ['aurora', 18, 0.75]])), 'boreal');
});

test('special morphologies: rime, graupel, melt, breaks, aggregates, twins, triangles', () => {
  const rimed = Crystal.fromRecipe(1, [['dendrite', 16, 0.75]]);
  rimed.rime(60);
  assert.equal(typeOf(rimed), 'rimed');
  const graupel = Crystal.fromRecipe(1, [['dendrite', 16, 0.75]]);
  graupel.rime(200);
  assert.equal(typeOf(graupel), 'graupel');
  const melted = Crystal.fromRecipe(1, [['dendrite', 20, 0.75]]);
  melted.melt(11);
  assert.equal(typeOf(melted), 'melted');
  const broken = Crystal.fromRecipe(1, [['dendrite', 20, 0.75]]);
  broken.breakArm(0, 6);
  broken.breakArm(2, 8);
  broken.breakArm(4, 7);
  assert.equal(typeOf(broken), 'broken');
  const agg = Crystal.fromRecipe(1, [['dendrite', 15, 0.75]]);
  agg.attach(5, 8, 5, 5, 0.3, false);
  assert.equal(typeOf(agg), 'aggregate');
  const twin = Crystal.fromRecipe(1, [['dendrite', 15, 0.75]]);
  twin.attach(5, 15, 0, 0, Math.PI / 6, true);
  assert.equal(typeOf(twin), 'twelve');
  const tri = new Crystal(1);
  tri.grow(MODE.PLATE, 14, 0.75, 1);
  assert.equal(typeOf(tri), 'triangular');
});

test('every type has a name in the notebook list', () => {
  assert.equal(new Set(TYPES).size, TYPES.length);
  assert.equal(TYPES.length, 16);
});

test('similarity: identical = 100 %, different shapes much lower', () => {
  const a = Crystal.fromRecipe(1, [['plate', 4], ['dendrite', 18, 0.75], ['plate', 6]]);
  const b = Crystal.fromRecipe(9, [['plate', 4], ['dendrite', 18, 0.75], ['plate', 6]]);
  assert.ok(similarity(a, b) > 0.99);
  const c = Crystal.fromRecipe(1, [['needle', 28, 0.75]]);
  assert.ok(similarity(c, a) < 0.35);
  const half = Crystal.fromRecipe(1, [['plate', 4], ['dendrite', 9, 0.75]]);
  const s = similarity(half, a);
  assert.ok(s > 0.3 && s < 0.6, `partial growth ${s}`);
});

test('expected mode follows the target profile, then asks to stop', () => {
  const target = Crystal.fromRecipe(1, [['plate', 4], ['dendrite', 10, 0.75]]);
  const c = new Crystal(2);
  assert.equal(expectedMode(c, target), MODE.PLATE);
  c.grow(MODE.PLATE, 5, 0.75);
  assert.equal(expectedMode(c, target), MODE.DENDRITE);
  c.grow(MODE.DENDRITE, 12, 0.75);
  assert.equal(expectedMode(c, target), -2);
});

test('beauty rewards size, variety and intact crystals', () => {
  const small = analyse(Crystal.fromRecipe(1, [['dendrite', 8, 0.75]])).beauty;
  const big = analyse(Crystal.fromRecipe(1, [['plate', 4], ['dendrite', 22, 0.75], ['plate', 6]])).beauty;
  assert.ok(big > small * 2);
  const c = Crystal.fromRecipe(1, [['plate', 4], ['dendrite', 22, 0.75], ['plate', 6]]);
  c.breakArm(1, 6);
  c.breakArm(3, 6);
  assert.ok(analyse(c).beauty < big);
  assert.equal(diameterMm(25), 5);
});
