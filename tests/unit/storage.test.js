import test from 'node:test';
import assert from 'node:assert/strict';
import { Store, SAVE_KEY, defaultSave, dateKey, prevDateKey, ALBUM_MAX } from '../../www/src/core/storage.js';

class MemStorage {
  constructor(init = {}) {
    this.m = new Map(Object.entries(init));
  }
  getItem(k) {
    return this.m.has(k) ? this.m.get(k) : null;
  }
  setItem(k, v) {
    this.m.set(k, String(v));
  }
}

test('fresh save uses defaults', () => {
  const s = new Store(new MemStorage());
  assert.deepEqual(s.data, defaultSave());
  assert.ok(s.isLevelUnlocked('1-1'));
  assert.ok(!s.isLevelUnlocked('1-2'));
  assert.ok(!s.isChapterUnlocked(2));
});

test('corrupted or hostile data falls back safely', () => {
  for (const raw of ['{not json', 'null', '[]', '42', JSON.stringify({ settings: 'x', levels: { '9-9': { stars: [1] }, '1-1': 'bad' }, album: [null, { id: 'x' }] })]) {
    const s = new Store(new MemStorage({ [SAVE_KEY]: raw }));
    assert.equal(typeof s.data.settings.music, 'number');
    assert.deepEqual(s.data.levels, {});
    assert.deepEqual(s.data.album, []);
  }
});

test('stars merge and unlock the next level and chapter', () => {
  const st = new MemStorage();
  const s = new Store(st);
  let r = s.recordLevel('1-1', [true, false, true]);
  assert.ok(r.firstClear);
  assert.equal(r.newStars, 2);
  r = s.recordLevel('1-1', [true, true, false]);
  assert.ok(!r.firstClear);
  assert.equal(r.newStars, 1);
  assert.deepEqual(s.level('1-1').stars, [true, true, true]);
  assert.ok(s.isLevelUnlocked('1-2'));
  for (const id of ['1-2', '1-3', '1-4', '1-5', '1-6']) s.recordLevel(id, [true, false, false]);
  assert.ok(s.isChapterUnlocked(2));
  assert.ok(s.endlessUnlocked());
  assert.ok(s.supportUnlocked('scarf'));
  s.flush();
  const again = new Store(st);
  assert.equal(again.totalStars(), 8);
});

test('album keeps favourites when trimming', () => {
  const s = new Store(new MemStorage());
  const first = s.addFlake({ seed: 1, log: [], type: 'plate' });
  s.toggleFav(first.id);
  for (let i = 0; i < ALBUM_MAX + 5; i++) s.addFlake({ seed: i, log: [], type: 'plate' });
  assert.equal(s.data.album.length, ALBUM_MAX);
  assert.ok(s.data.album.some((e) => e.id === first.id));
});

test('daily streak counts consecutive days', () => {
  const s = new Store(new MemStorage());
  s.recordDaily('2026-11-14', 70, '2026-11-13');
  s.recordDaily('2026-11-15', 80, '2026-11-14');
  assert.equal(s.data.daily.streak, 2);
  s.recordDaily('2026-11-15', 60, '2026-11-14');
  assert.equal(s.dailyBest('2026-11-15'), 80);
  s.recordDaily('2026-11-18', 50, '2026-11-17');
  assert.equal(s.data.daily.streak, 1);
});

test('discovering types and badges reports novelty once', () => {
  const s = new Store(new MemStorage());
  assert.ok(s.discover('fernlike'));
  assert.ok(!s.discover('fernlike'));
  assert.deepEqual(s.addBadges(['giant']), ['giant']);
  assert.deepEqual(s.addBadges(['giant']), []);
});

test('storage failures do not crash the game', () => {
  const broken = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('quota'); } };
  const s = new Store(broken);
  s.recordLevel('1-1', [true, true, true]);
  assert.doesNotThrow(() => s.flush());
});

test('date keys', () => {
  assert.equal(dateKey(new Date(2026, 0, 5)), '2026-01-05');
  assert.equal(prevDateKey(new Date(2026, 2, 1)), '2026-02-28');
});
