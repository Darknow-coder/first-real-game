// Integration: the autopilot must be able to land every campaign level.
import test from 'node:test';
import assert from 'node:assert/strict';
import { LEVELS } from '../../www/src/sim/levels.js';
import { World } from '../../www/src/sim/world.js';
import { Crystal } from '../../www/src/sim/crystal.js';
import { simulate } from '../../www/src/sim/bot.js';

for (const def of LEVELS) {
  test(`level ${def.id} can be completed`, () => {
    const target = def.target ? Crystal.fromRecipe(7, def.target) : null;
    let landed = 0;
    for (const viewH of [640, 820]) {
      const w = new World(def, { seed: 4242, viewH });
      simulate(w, { target });
      if (w.status === 'landed') landed++;
      assert.ok(w.t < 120, 'level duration is reasonable');
    }
    assert.ok(landed >= 1, `${def.id} landed ${landed}/2`);
  });
}
