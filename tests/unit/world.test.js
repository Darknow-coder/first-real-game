import test from 'node:test';
import assert from 'node:assert/strict';
import { World, WORLD_W } from '../../www/src/sim/world.js';
import { LEVEL_BY_ID } from '../../www/src/sim/levels.js';

const tiny = (extra = {}) => ({
  id: 'tiny',
  theme: 'peaks',
  length: 1400,
  speed: 70,
  landing: { x: 180, w: 120, kind: 'mitten' },
  objectives: [{ kind: 'land' }],
  zones: [{ type: 'brume', x: 180, y: 500, rx: 120, ry: 160 }],
  hazards: [],
  shards: [{ x: 180, y: 700 }],
  winds: [],
  drafts: [],
  obstacles: [],
  hints: [],
  ...extra,
});

function run(world, steer) {
  let guard = 0;
  while (world.status === 'play' && guard++ < 60 * 300) {
    if (steer) steer(world);
    world.update(1 / 60);
  }
  return world;
}

test('a passive flake falling straight down lands on a centred target', () => {
  const w = run(new World(tiny(), { seed: 1, viewH: 720 }));
  assert.equal(w.status, 'landed');
  assert.ok(w.crystal.R > 5, 'it grew in the mist');
  assert.equal(w.stats.shards, 1);
});

test('missing the target means the flake is lost in the snow', () => {
  const w = run(new World(tiny({ landing: { x: 60, w: 50, kind: 'sled' } }), { seed: 1, viewH: 720 }), (wd) => wd.setTarget(320));
  assert.equal(w.status, 'failed');
  assert.equal(w.reason, 'lost');
});

test('a thaw cloud can melt a flake away', () => {
  const def = tiny({ zones: [{ type: 'redoux', x: 180, y: 500, rx: 150, ry: 400, density: 1 }] });
  const w = run(new World(def, { seed: 1, viewH: 720 }));
  assert.equal(w.status, 'failed');
  assert.equal(w.reason, 'melted');
});

test('steering is clamped inside the playfield', () => {
  const w = new World(tiny(), { seed: 1, viewH: 720 });
  w.steer(-10000, -10000);
  for (let i = 0; i < 120; i++) w.update(1 / 60);
  assert.ok(w.flake.x >= 8 && w.flake.x <= WORLD_W - 8);
  assert.ok(w.flake.sy >= 720 * 0.16 - 1e-6);
});

test('hazards spawn and can hit the crystal', () => {
  const def = tiny({ length: 3000, hazards: [{ type: 'pellet', from: 0, to: 2500, every: 0.3, x: 'aim' }], zones: [{ type: 'brume', x: 180, y: 600, rx: 150, ry: 800 }] });
  const w = run(new World(def, { seed: 3, viewH: 720 }));
  assert.ok(w.stats.hits > 0);
  assert.ok(w.crystal.hits > 0);
});

test('same seed and same inputs give the same result (determinism)', () => {
  const def = LEVEL_BY_ID['1-4'];
  const a = run(new World(def, { seed: 5, viewH: 720 }), (wd) => wd.setTarget(150 + Math.sin(wd.t) * 80));
  const b = run(new World(def, { seed: 5, viewH: 720 }), (wd) => wd.setTarget(150 + Math.sin(wd.t) * 80));
  assert.equal(a.status, b.status);
  assert.equal(a.crystal.R, b.crystal.R);
  assert.equal(a.stats.hits, b.stats.hits);
  assert.equal(a.t, b.t);
});

test('wind pushes the flake sideways', () => {
  const def = tiny({ length: 2000, zones: [], winds: [{ from: 0, to: 1800, dir: 1, power: 100 }] });
  const w = new World(def, { seed: 1, viewH: 720 });
  for (let i = 0; i < 120; i++) w.update(1 / 60);
  assert.ok(w.flake.x > 250);
});

test('neighbour flakes merge into an aggregate', () => {
  const def = tiny({ length: 2600, hazards: [{ type: 'flake', from: 0, to: 2000, every: 0.4, x: [178, 182], size: [8, 9] }] });
  const w = run(new World(def, { seed: 2, viewH: 720 }));
  assert.ok(w.stats.merges > 0);
  assert.ok(w.crystal.attached.length > 0);
});
