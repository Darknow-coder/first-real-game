import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { DICTS, t, setLang, tn } from '../../www/src/core/i18n.js';
import { TYPES } from '../../www/src/sim/classify.js';
import { ZONE_KEYS } from '../../www/src/sim/zones.js';

const SRC = new URL('../../www/src/', import.meta.url).pathname;

function files(dir) {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? files(p) : p.endsWith('.js') ? [p] : [];
  });
}

test('French and English have exactly the same keys', () => {
  const fr = Object.keys(DICTS.fr).sort();
  const en = Object.keys(DICTS.en).filter((k) => k !== 'app.studio').sort();
  const missingEn = fr.filter((k) => k !== 'app.studio' && !DICTS.en[k]);
  const extraEn = en.filter((k) => !DICTS.fr[k]);
  assert.deepEqual(missingEn, []);
  assert.deepEqual(extraEn, []);
});

test('every literal key used in the code exists', () => {
  const missing = [];
  for (const f of files(SRC)) {
    const src = readFileSync(f, 'utf8');
    for (const m of src.matchAll(/\bt\(\s*'([a-zA-Z0-9_.-]+)'/g)) if (!DICTS.fr[m[1]]) missing.push(`${m[1]} (${f})`);
    for (const m of src.matchAll(/\btn\(\s*'([a-zA-Z0-9_.-]+)'/g)) if (!DICTS.fr[`${m[1]}.one`]) missing.push(`${m[1]}.one (${f})`);
  }
  assert.deepEqual(missing, []);
});

test('all types and zones are named, described and hinted', () => {
  for (const lang of ['fr', 'en']) {
    for (const ty of TYPES) for (const k of [`type.${ty}`, `type.desc.${ty}`, `type.hint.${ty}`]) assert.ok(DICTS[lang][k], `${lang} ${k}`);
    for (const z of ZONE_KEYS) for (const k of [`zone.${z}`, `zone.short.${z}`, `zone.desc.${z}`]) assert.ok(DICTS[lang][k], `${lang} ${k}`);
  }
});

test('interpolation and plurals', () => {
  setLang('fr');
  assert.equal(t('obj.shards', { n: 3 }), "Attrape 3 éclats d'étoile");
  assert.equal(tn('daily.streak', 1), 'Série : 1 jour');
  assert.equal(tn('daily.streak', 4), 'Série : 4 jours');
  setLang('en');
  assert.equal(tn('daily.streak', 0), 'Streak: 0 days');
  assert.equal(t('missing.key'), 'missing.key');
  setLang('fr');
});
