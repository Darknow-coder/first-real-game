import test from 'node:test';
import assert from 'node:assert/strict';
import { LEVELS, CHAPTERS, levelsOfChapter, nextLevelId } from '../../www/src/sim/levels.js';
import { ZONES } from '../../www/src/sim/zones.js';
import { DICTS } from '../../www/src/core/i18n.js';
import { generateDaily, generateEndless, generateLevel, endlessDifficulty } from '../../www/src/sim/generator.js';
import { LANDING_H } from '../../www/src/sim/world.js';

const OBJ_KINDS = new Set(['land', 'shards', 'size', 'beauty', 'type', 'match', 'intact', 'nomelt', 'badge']);
const HAZARDS = new Set(['pellet', 'hail', 'flake', 'bird']);
const RECIPE_MODES = new Set(['plate', 'dendrite', 'needle', 'aurora']);

export function validateDef(def) {
  const errs = [];
  if (!(def.length > 1500)) errs.push('length');
  if (!(def.speed > 30 && def.speed < 120)) errs.push('speed');
  const L = def.landing;
  if (!LANDING_H[L.kind]) errs.push(`landing kind ${L.kind}`);
  if (L.x - L.w / 2 < 8 || L.x + L.w / 2 > 352) errs.push('landing out of bounds');
  if (def.objectives[0].kind !== 'land') errs.push('first objective must be land');
  for (const o of def.objectives) if (!OBJ_KINDS.has(o.kind)) errs.push(`objective ${o.kind}`);
  for (const z of def.zones) {
    if (!ZONES[z.type]) errs.push(`zone type ${z.type}`);
    if (z.x < 0 || z.x > 360) errs.push(`zone x ${z.x}`);
    if (z.y - z.ry < 250 || z.y + z.ry > def.length - 150) errs.push(`zone y ${z.type}@${z.y}`);
    if (z.rx < 30 || z.ry < 60) errs.push('zone too small');
  }
  for (const s of def.shards) if (s.x < 10 || s.x > 350 || s.y < 300 || s.y > def.length - 120) errs.push(`shard ${s.x},${s.y}`);
  for (const h of def.hazards) {
    if (!HAZARDS.has(h.type)) errs.push(`hazard ${h.type}`);
    if (h.at === undefined && !(h.every > 0.2)) errs.push('hazard rate');
  }
  if (def.target) for (const [m, dr] of def.target) if (!RECIPE_MODES.has(m) || !(dr > 0)) errs.push(`recipe ${m}`);
  return errs;
}

test('campaign has 5 chapters of 6 nights', () => {
  assert.equal(CHAPTERS.length, 5);
  assert.equal(LEVELS.length, 30);
  for (const ch of CHAPTERS) assert.equal(levelsOfChapter(ch.id).length, 6);
  assert.equal(new Set(LEVELS.map((l) => l.id)).size, 30);
  assert.equal(nextLevelId('1-6'), '2-1');
  assert.equal(nextLevelId('5-6'), null);
});

test('every level definition is valid', () => {
  for (const def of LEVELS) {
    assert.deepEqual(validateDef(def), [], `level ${def.id}`);
    assert.equal(def.objectives.length, 3, `level ${def.id} has 3 objectives`);
  }
});

test('every level and chapter has a name in French and English', () => {
  for (const lang of ['fr', 'en']) {
    for (const def of LEVELS) assert.ok(DICTS[lang][`lvl.${def.id}`], `${lang} lvl.${def.id}`);
    for (const ch of CHAPTERS) assert.ok(DICTS[lang][`ch.${ch.id}`], `${lang} ch.${ch.id}`);
  }
});

test('hint keys used by levels exist', () => {
  for (const def of LEVELS) for (const h of def.hints) assert.ok(DICTS.fr[h.key] && DICTS.en[h.key], h.key);
});

test('generated skies are valid and deterministic', () => {
  for (let s = 1; s < 25; s++) {
    const a = generateLevel({ seed: s, difficulty: (s % 12) / 10 });
    assert.deepEqual(validateDef(a), [], `gen ${s}`);
    assert.deepEqual(generateLevel({ seed: s, difficulty: (s % 12) / 10 }), a);
  }
  const d1 = generateDaily('2026-11-15');
  assert.deepEqual(generateDaily('2026-11-15'), d1);
  assert.notDeepEqual(generateDaily('2026-11-16').def.target, d1.def.target);
  assert.deepEqual(validateDef(d1.def), []);
  for (let n = 0; n < 12; n++) assert.deepEqual(validateDef(generateEndless(9, n).def), [], `endless ${n}`);
  assert.ok(endlessDifficulty(8) > endlessDifficulty(1));
});
