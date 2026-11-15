// Save system (localStorage, with an in-memory fallback). Robust to missing
// or corrupted data: everything is merged over defaults.
import { LEVELS, LEVEL_BY_ID, levelsOfChapter } from '../sim/levels.js';

export const SAVE_KEY = 'flocon.save.v1';
export const ALBUM_MAX = 150;

export function defaultSave() {
  return {
    v: 1,
    settings: { music: 0.6, sfx: 0.85, haptics: true, lang: null, sensitivity: 1, reduced: false, labels: true, support: 'auto' },
    levels: {},
    album: [],
    nextId: 1,
    types: {},
    badges: {},
    stats: { flakes: 0, shards: 0, plays: 0, landed: 0, failed: 0, time: 0 },
    endless: { best: 0, bestFlakes: 0, runs: 0 },
    daily: { date: null, best: 0, streak: 0, lastDone: null, history: {} },
    seen: {},
  };
}

function isObj(v) {
  return v && typeof v === 'object' && !Array.isArray(v);
}

/** Deep-merge `src` over `base`, keeping only keys/types known in base. */
function mergeKnown(base, src) {
  if (!isObj(src)) return base;
  const out = { ...base };
  for (const k of Object.keys(base)) {
    const b = base[k];
    const s = src[k];
    if (s === undefined) continue;
    if (isObj(b) && Object.keys(b).length) out[k] = mergeKnown(b, s);
    else if (isObj(b)) out[k] = isObj(s) ? s : b;
    else if (Array.isArray(b)) out[k] = Array.isArray(s) ? s : b;
    else if (b === null || typeof s === typeof b) out[k] = s;
  }
  return out;
}

export class Store {
  constructor(storage) {
    this.storage = storage ?? (typeof localStorage !== 'undefined' ? localStorage : null);
    this.memory = null;
    this.timer = null;
    this.data = this.load();
  }

  load() {
    let raw = null;
    try {
      raw = this.storage ? this.storage.getItem(SAVE_KEY) : this.memory;
    } catch {
      raw = this.memory;
    }
    if (!raw) return defaultSave();
    try {
      const parsed = JSON.parse(raw);
      const data = mergeKnown(defaultSave(), parsed);
      // Sanitise collections.
      data.album = data.album.filter((e) => e && typeof e.id === 'number' && Array.isArray(e.log)).slice(-ALBUM_MAX);
      for (const [id, st] of Object.entries(data.levels)) {
        if (!LEVEL_BY_ID[id] || !isObj(st) || !Array.isArray(st.stars)) delete data.levels[id];
        else st.stars = [0, 1, 2].map((i) => !!st.stars[i]);
      }
      data.nextId = Math.max(data.nextId | 0, ...data.album.map((e) => e.id + 1), 1);
      return data;
    } catch {
      return defaultSave();
    }
  }

  save() {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.flush(), 250);
  }

  flush() {
    clearTimeout(this.timer);
    const raw = JSON.stringify(this.data);
    try {
      if (this.storage) this.storage.setItem(SAVE_KEY, raw);
      else this.memory = raw;
    } catch {
      // Quota exceeded or storage disabled: trim the album and retry once.
      this.memory = raw;
      if (this.data.album.length > 40) {
        this.data.album = this.data.album.filter((e) => e.fav).concat(this.data.album.filter((e) => !e.fav).slice(-30));
        try {
          this.storage?.setItem(SAVE_KEY, JSON.stringify(this.data));
        } catch {
          /* give up silently */
        }
      }
    }
  }

  reset() {
    const settings = this.data.settings;
    this.data = defaultSave();
    this.data.settings = settings;
    this.flush();
  }

  // ------------------------------------------------------------ campaign

  level(id) {
    return this.data.levels[id] || { done: false, stars: [false, false, false], beauty: 0, match: 0 };
  }

  starCount(id) {
    return this.level(id).stars.filter(Boolean).length;
  }

  totalStars() {
    let n = 0;
    for (const l of LEVELS) n += this.starCount(l.id);
    return n;
  }

  chapterStars(ch) {
    return levelsOfChapter(ch).reduce((n, l) => n + this.starCount(l.id), 0);
  }

  isLevelUnlocked(id) {
    const i = LEVELS.findIndex((l) => l.id === id);
    if (i <= 0) return i === 0;
    return this.level(LEVELS[i - 1].id).done;
  }

  isChapterUnlocked(ch) {
    if (ch <= 1) return true;
    const prev = levelsOfChapter(ch - 1);
    return this.level(prev[prev.length - 1].id).done;
  }

  chapterDone(ch) {
    const ls = levelsOfChapter(ch);
    return this.level(ls[ls.length - 1].id).done;
  }

  /** Store a level result. Returns what changed. */
  recordLevel(id, stars, info = {}) {
    const prev = this.level(id);
    const merged = [0, 1, 2].map((i) => prev.stars[i] || !!stars[i]);
    const firstClear = !prev.done && !!stars[0];
    const newStars = merged.filter(Boolean).length - prev.stars.filter(Boolean).length;
    this.data.levels[id] = {
      done: prev.done || !!stars[0],
      stars: merged,
      beauty: Math.max(prev.beauty || 0, info.beauty || 0),
      match: Math.max(prev.match || 0, info.match || 0),
    };
    this.save();
    return { firstClear, newStars };
  }

  // --------------------------------------------------------------- album

  addFlake(entry) {
    const id = this.data.nextId++;
    const e = { id, t: Date.now(), fav: false, ...entry };
    this.data.album.push(e);
    if (this.data.album.length > ALBUM_MAX) {
      const idx = this.data.album.findIndex((x) => !x.fav);
      if (idx >= 0) this.data.album.splice(idx, 1);
    }
    this.save();
    return e;
  }

  removeFlake(id) {
    this.data.album = this.data.album.filter((e) => e.id !== id);
    this.save();
  }

  toggleFav(id) {
    const e = this.data.album.find((x) => x.id === id);
    if (e) e.fav = !e.fav;
    this.save();
    return e?.fav;
  }

  /** Mark a morphology as discovered; returns true the first time. */
  discover(type) {
    const known = this.data.types[type];
    this.data.types[type] = { n: (known?.n || 0) + 1, first: known?.first || Date.now() };
    this.save();
    return !known;
  }

  addBadges(badges) {
    const fresh = [];
    for (const b of badges) {
      if (!this.data.badges[b]) fresh.push(b);
      this.data.badges[b] = (this.data.badges[b] || 0) + 1;
    }
    this.save();
    return fresh;
  }

  // -------------------------------------------------------------- unlocks

  supportUnlocked(kind) {
    switch (kind) {
      case 'mitten':
        return true;
      case 'scarf':
        return this.chapterDone(1);
      case 'sleeve':
        return this.chapterDone(2);
      case 'sled':
        return this.chapterDone(3);
      case 'glass':
        return this.chapterDone(4);
      case 'velvet':
        return !!this.data.badges.masterpiece;
      default:
        return false;
    }
  }

  endlessUnlocked() {
    return this.chapterDone(1);
  }

  dailyUnlocked() {
    return this.level('1-3').done;
  }

  // --------------------------------------------------------------- daily

  recordDaily(dateKey, pct, prevDateKey) {
    const d = this.data.daily;
    if (d.date !== dateKey) {
      d.date = dateKey;
      d.best = 0;
    }
    const improved = pct > d.best;
    d.best = Math.max(d.best, pct);
    if (d.lastDone !== dateKey) {
      d.streak = d.lastDone === prevDateKey ? d.streak + 1 : 1;
      d.lastDone = dateKey;
    }
    d.history[dateKey] = d.best;
    const keys = Object.keys(d.history).sort();
    while (keys.length > 60) delete d.history[keys.shift()];
    this.save();
    return improved;
  }

  dailyBest(dateKey) {
    return this.data.daily.date === dateKey ? this.data.daily.best : 0;
  }

  dailyStreak(dateKey, prevDateKey) {
    const d = this.data.daily;
    return d.lastDone === dateKey || d.lastDone === prevDateKey ? d.streak : 0;
  }
}

export function dateKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function prevDateKey(date = new Date()) {
  const p = new Date(date.getFullYear(), date.getMonth(), date.getDate() - 1, 12);
  return dateKey(p);
}

export { LEVEL_BY_ID };
