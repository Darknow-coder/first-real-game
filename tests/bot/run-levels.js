// Plays every campaign level (and a few generated skies) with the autopilot
// and reports whether each one can be completed, plus objective results.
// Usage: node tests/bot/run-levels.js [levelId] [--runs=3]
import { LEVELS } from '../../www/src/sim/levels.js';
import { World } from '../../www/src/sim/world.js';
import { Crystal } from '../../www/src/sim/crystal.js';
import { simulate } from '../../www/src/sim/bot.js';
import { analyse } from '../../www/src/sim/classify.js';
import { evaluateAll } from '../../www/src/sim/objectives.js';
import { generateDaily, generateEndless } from '../../www/src/sim/generator.js';

const args = process.argv.slice(2);
const only = args.find((a) => !a.startsWith('--'));
const runs = Number((args.find((a) => a.startsWith('--runs=')) || '--runs=3').split('=')[1]);
const viewHs = [640, 720, 820];

function play(def, seed, viewH) {
  const target = def.target ? Crystal.fromRecipe(7, def.target) : null;
  const world = new World(def, { seed, viewH });
  simulate(world, { target });
  const analysis = analyse(world.crystal, target);
  const objs = evaluateAll(def.objectives, { world, analysis });
  return { world, analysis, objs };
}

const rows = [];
let failures = 0;
const defs = LEVELS.filter((l) => !only || l.id === only);
for (const def of defs) {
  let landed = 0;
  const stars = [0, 0, 0];
  const info = [];
  for (let r = 0; r < runs; r++) {
    const viewH = viewHs[r % viewHs.length];
    const { world, analysis, objs } = play(def, 1000 + r * 77, viewH);
    if (world.status === 'landed') landed++;
    objs.forEach((o, i) => {
      if (o.done) stars[i]++;
    });
    info.push(
      `${world.status === 'landed' ? 'OK ' : world.reason?.padEnd(3)} t=${world.t.toFixed(0)}s R=${world.crystal.R.toFixed(1)} ${analysis.type} b=${analysis.beauty}` +
        `${analysis.match !== null ? ` m=${Math.round(analysis.match * 100)}%` : ''} sh=${world.stats.shards}/${world.stats.shardsTotal} hits=${world.crystal.hits} log=${world.crystal.log.length}`,
    );
  }
  if (landed < runs) failures++;
  rows.push(`${def.id.padEnd(5)} landed ${landed}/${runs}  stars ${stars.join('/')}  | ${info[0]}`);
  if (only) info.slice(1).forEach((s) => rows.push(`      ${s}`));
}

if (!only) {
  for (let i = 0; i < 3; i++) {
    const { def, seed } = generateDaily(`2026-11-${15 + i}`);
    const { world, analysis } = play(def, seed, 720);
    rows.push(`daily${i} ${world.status} t=${world.t.toFixed(0)} R=${world.crystal.R.toFixed(1)} ${analysis.type} m=${Math.round((analysis.match ?? 0) * 100)}% len=${def.length}`);
  }
  for (let n = 0; n < 10; n += 3) {
    const { def, seed } = generateEndless(42, n);
    const { world, analysis } = play(def, seed, 720);
    rows.push(`endless#${n} ${world.status} ${world.reason ?? ''} t=${world.t.toFixed(0)} R=${world.crystal.R.toFixed(1)} ${analysis.type} hits=${world.crystal.hits}`);
  }
}

console.log(rows.join('\n'));
console.log(failures ? `\n${failures} level(s) not always completed by the autopilot` : '\nAll levels completed by the autopilot');
process.exitCode = failures ? 1 : 0;
