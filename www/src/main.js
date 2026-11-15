// Flocon — game controller: screens, game modes, main loop.
import { Renderer } from './render/renderer.js';
import { AudioEngine } from './core/audio.js';
import { Input } from './core/input.js';
import { Store, dateKey, prevDateKey } from './core/storage.js';
import { t, tn, setLang, detectLang, getLang, num } from './core/i18n.js';
import { hashString } from './core/rng.js';
import { Screens, toast, h, ICONS } from './ui/dom.js';
import { Hud } from './ui/hud.js';
import * as S from './ui/screens.js';
import { World } from './sim/world.js';
import { Crystal } from './sim/crystal.js';
import { analyse, expectedMode, diameterMm } from './sim/classify.js';
import { evaluateAll } from './sim/objectives.js';
import { LEVEL_BY_ID, nextLevelId, levelsOfChapter } from './sim/levels.js';
import { generateDaily, generateEndless, endlessQuota } from './sim/generator.js';
import { Autopilot } from './sim/bot.js';
import { drawPhoto } from './render/photo.js';
import { makeCanvas } from './render/sprites.js';

const STEP = 1 / 60;
const params = new URLSearchParams(location.search);
const DEBUG = params.has('debug');

const SHOWCASE = [
  ['plate', 3.4, 0.75],
  ['dendrite', 13, 1],
  ['plate', 2.6, 0.75],
  ['dendrite', 9, 0.75],
  ['plate', 3.5, 0.75],
];

/** Grows a crystal progressively from a recipe (title-screen animation). */
class Grower {
  constructor(seed, recipe, speed = 9) {
    this.crystal = new Crystal(seed);
    this.recipe = recipe;
    this.i = 0;
    this.done = 0;
    this.speed = speed;
  }
  update(dt) {
    let budget = dt * this.speed;
    while (budget > 0 && this.i < this.recipe.length) {
      const [key, dr, q] = this.recipe[this.i];
      const d = Math.min(budget, dr - this.done);
      if (key === 'plate' || key === 'dendrite' || key === 'needle' || key === 'aurora') {
        this.crystal.grow(['plate', 'dendrite', 'needle', 'aurora'].indexOf(key), d, q);
      }
      this.done += d;
      budget -= d;
      if (this.done >= dr - 1e-9) {
        this.i++;
        this.done = 0;
      }
    }
  }
}

class Game {
  constructor() {
    this.store = new Store();
    if (params.has('reset')) this.store.reset();
    setLang(params.get('lang') || this.store.data.settings.lang || detectLang());
    this.canvas = document.getElementById('game');
    this.renderer = new Renderer(this.canvas);
    this.audio = new AudioEngine();
    this.input = new Input(this.canvas);
    this.screens = new Screens(document.getElementById('ui'));
    this.hud = new Hud(document.getElementById('hud'), this);
    this.state = 'boot';
    this.world = null;
    this.def = null;
    this.target = null;
    this.mode = 'level';
    this.acc = 0;
    this.last = 0;
    this.endTimer = 0;
    this.analysis = null;
    this.analysisTimer = 0;
    this.menuTheme = 'peaks';
    this.grower = new Grower(11, SHOWCASE);
    this.menuCrystal = null;
    this.autopilot = null;
    this.speed = Math.max(0.25, Math.min(8, Number(params.get('speed')) || 1));
    this.fps = { n: 0, t: 0, v: 60 };
    this.perf = { slow: 0, frames: 0, t: 0 };
    this.applySettings();
    this.bind();
    if (DEBUG && params.get('unlock') === 'all') this.debugUnlockAll();
    this.goTitle();
    if (DEBUG && params.get('level')) this.startLevel(params.get('level'));
    requestAnimationFrame((ts) => this.loop(ts));
  }

  // -------------------------------------------------------------- setup

  bind() {
    window.addEventListener('resize', () => this.onResize());
    window.addEventListener('orientationchange', () => setTimeout(() => this.onResize(), 200));
    const unlock = () => {
      this.audio.unlock();
      this.audio.setVolumes(this.store.data.settings.music, this.store.data.settings.sfx);
    };
    window.addEventListener('pointerdown', unlock, { capture: true });
    window.addEventListener('touchend', unlock, { capture: true });
    window.addEventListener('keydown', (e) => {
      unlock();
      if (e.key === 'Escape' || e.key === 'Backspace') {
        e.preventDefault();
        this.onBack();
      } else if (e.key === ' ' && this.state === 'play') this.pause();
    });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        if (this.state === 'play') this.pause();
        this.audio.suspend();
        this.store.flush();
      } else {
        this.audio.resume();
        this.last = 0;
      }
    });
    window.addEventListener('pagehide', () => this.store.flush());
    // Keyboard steering for desktop players.
    this.keys = new Set();
    window.addEventListener('keydown', (e) => this.keys.add(e.key));
    window.addEventListener('keyup', (e) => this.keys.delete(e.key));
    this.onResize();
  }

  onResize() {
    this.renderer.resize();
    this.input.unitsPerPx = 1 / this.renderer.scale;
    if (this.world) this.world.viewH = Math.max(560, this.renderer.viewH);
    if (this.target) this.renderer.setTarget(this.target);
    const rot = document.getElementById('rotate-text');
    if (rot) rot.textContent = t('common.rotate');
    // A phone turned sideways shows the "rotate" overlay: pause the fall.
    const sideways = window.matchMedia?.('(orientation: landscape) and (max-height: 520px) and (pointer: coarse)').matches;
    if (sideways && this.state === 'play') this.pause();
  }

  applySettings() {
    const st = this.store.data.settings;
    this.audio.setVolumes(st.music, st.sfx);
    this.input.sensitivity = st.sensitivity;
  }

  setSetting(key, value) {
    this.store.data.settings[key] = value;
    this.store.save();
    this.applySettings();
    if (key === 'sfx') this.audio.ui();
  }

  setLanguage(l) {
    this.store.data.settings.lang = l;
    this.store.save();
    setLang(l);
    this.goSettings();
  }

  setSupport(k) {
    this.store.data.settings.support = k;
    this.store.save();
    this.audio.ui();
    this.goAlbum('supports');
  }

  supportFor(entry) {
    const s = this.store.data.settings.support;
    return s === 'auto' ? entry.support || 'mitten' : s;
  }

  today() {
    const d = new Date();
    return { key: dateKey(d), prev: prevDateKey(d) };
  }

  haptic(ms) {
    if (this.store.data.settings.haptics && navigator.vibrate) {
      try {
        navigator.vibrate(ms);
      } catch {
        /* ignore */
      }
    }
  }

  // --------------------------------------------------------- navigation

  setMenuState(state) {
    this.state = state;
    this.world = null;
    this.autopilot = null;
    this.input.enabled = false;
    this.hud.hide();
    this.audio.playSong('menu');
    this.audio.setAmbience(0, 0, 0.03);
  }

  goTitle() {
    this.setMenuState('title');
    this.screens.show(S.titleScreen(this));
  }

  goMenu(fromTitle = false) {
    this.audio.ui('start');
    if (fromTitle && !this.store.level('1-1').done) {
      this.startLevel('1-1');
      return;
    }
    this.setMenuState('menu');
    this.refreshMenuCrystal();
    this.screens.show(S.menuScreen(this));
  }

  refreshMenuCrystal() {
    const album = this.store.data.album;
    const fav = [...album].reverse().find((e) => e.fav) || album[album.length - 1];
    if (fav) {
      try {
        this.menuCrystal = Crystal.fromLog(fav.seed, fav.log);
        return;
      } catch {
        /* fall back to the showcase */
      }
    }
    this.menuCrystal = null;
  }

  goCampaign(focusCh, openLevel) {
    this.audio.ui();
    this.setMenuState('campaign');
    this.screens.show(S.campaignScreen(this, focusCh));
    if (openLevel) setTimeout(() => this.openLevelIntro(openLevel), 250);
  }

  openLevelIntro(id) {
    this.audio.ui();
    this.menuTheme = LEVEL_BY_ID[id].theme;
    this.screens.openSheet(S.levelIntro(this, id));
  }

  openDailyIntro() {
    this.audio.ui();
    const { def } = generateDaily(this.today().key);
    this.screens.openSheet(S.dailyIntro(this, def));
  }

  openEndlessIntro() {
    this.audio.ui();
    this.screens.openSheet(S.endlessIntro(this));
  }

  goAlbum(tab = 'flakes') {
    this.audio.ui();
    this.setMenuState('album');
    this.screens.show(S.albumScreen(this, tab));
  }

  openFlake(id) {
    const e = this.store.data.album.find((x) => x.id === id);
    if (!e) return;
    this.audio.ui();
    this.screens.openSheet(S.flakeSheet(this, e));
  }

  goSettings() {
    this.audio.ui();
    this.setMenuState('settings');
    this.screens.show(S.settingsScreen(this));
  }

  openGuide(fromPause) {
    this.audio.ui();
    this.screens.openSheet(S.guideSheet(this, fromPause), {
      onClose: () => {
        if (fromPause && this.state === 'paused' && !this.screens.sheet) setTimeout(() => this.state === 'paused' && !this.screens.sheet && this.pause(true), 0);
      },
    });
  }

  onBack() {
    if (this.screens.sheet) {
      if (this.state === 'paused') this.resume();
      else this.screens.closeSheet();
      return;
    }
    switch (this.state) {
      case 'play':
        this.pause();
        break;
      case 'campaign':
      case 'album':
      case 'settings':
      case 'result':
        this.goMenu();
        break;
      case 'menu':
        this.goTitle();
        break;
      default:
        break;
    }
  }

  // ----------------------------------------------------------- play modes

  startLevel(id) {
    const def = LEVEL_BY_ID[id];
    if (!def) return;
    this.mode = 'level';
    this.levelId = id;
    this.target = def.target ? Crystal.fromRecipe(7, def.target) : null;
    this.beginWorld(def, hashString(`level-${id}`), t(`lvl.${id}`));
    this.hud.banner(t(`lvl.${id}`), `${t(`ch.${def.chapter}`)} · ${id}`, 1900);
  }

  startDaily() {
    const { def, seed } = generateDaily(this.today().key);
    this.mode = 'daily';
    this.levelId = null;
    this.target = Crystal.fromRecipe(7, def.target);
    this.beginWorld(def, seed, t('daily.title'));
  }

  startEndless() {
    this.mode = 'endless';
    this.levelId = null;
    this.target = null;
    this.endless = { runSeed: (Math.random() * 1e9) >>> 0, n: 0, score: 0, landed: 0, best: null, newTypes: 0 };
    this.nextEndlessFlake();
  }

  nextEndlessFlake() {
    const e = this.endless;
    const { def, seed } = generateEndless(e.runSeed, e.n);
    e.quota = endlessQuota(e.n);
    def.objectives = [{ kind: 'land' }, { kind: 'beauty', n: e.quota }];
    this.beginWorld(def, seed, t('endless.flakeN', { n: e.n + 1 }));
    this.hud.banner(t('endless.flakeN', { n: e.n + 1 }), t('endless.quota', { n: num(e.quota) }), 1800);
  }

  beginWorld(def, seed, title) {
    this.screens.closeSheet(true);
    this.screens.clear();
    this.def = def;
    this.world = new World(def, { seed, viewH: Math.max(560, this.renderer.viewH) });
    this.renderer.fx.clear();
    this.renderer.setTarget(this.target);
    this.hud.setup({ title, objectives: def.objectives, mode: this.mode });
    this.input.reset();
    this.input.enabled = true;
    this.state = 'play';
    this.acc = 0;
    this.analysis = analyse(this.world.crystal, this.target);
    this.analysisTimer = 0;
    this.audio.playSong(def.theme);
    this.autopilot = params.has('autopilot') ? new Autopilot(this.world, { target: this.target }) : null;
    this.hud.showDragHint(!this.autopilot && this.mode === 'level' && def.id === '1-1' && !this.store.level('1-1').done);
    this.store.data.stats.plays++;
    this.store.save();
  }

  pause(reopen = false) {
    if (this.state !== 'play' && !(reopen && this.state === 'paused')) return;
    this.state = 'paused';
    this.input.enabled = false;
    this.audio.ui('back');
    this.screens.openSheet(S.pauseSheet(this), {
      onClose: () => {
        if (this.state === 'paused' && !this.guideOpen) this.resumeSoon();
      },
    });
  }

  resumeSoon() {
    // Called when the sheet is dismissed by tapping outside.
    setTimeout(() => {
      if (this.state === 'paused' && !this.screens.sheet) this.resume();
    }, 0);
  }

  resume() {
    if (this.state !== 'paused') return;
    this.state = 'play';
    this.screens.closeSheet();
    this.state = 'play';
    this.input.reset();
    this.input.enabled = true;
    this.last = 0;
    this.audio.ui();
  }

  restart() {
    this.screens.closeSheet(true);
    if (this.mode === 'daily') this.startDaily();
    else if (this.mode === 'endless') this.startEndless();
    else this.startLevel(this.levelId);
  }

  quit() {
    this.screens.closeSheet(true);
    if (this.mode === 'level') this.goCampaign(this.def?.chapter);
    else this.goMenu();
  }

  // ----------------------------------------------------------- main loop

  loop(ts) {
    requestAnimationFrame((n) => this.loop(n));
    let dt = this.last ? (ts - this.last) / 1000 : STEP;
    this.last = ts;
    dt = Math.min(0.05, Math.max(0, dt));
    if (DEBUG) this.tickFps(dt);
    this.watchPerformance(dt);
    try {
      this.frame(dt);
    } catch (err) {
      console.error(err);
    }
  }

  frame(dt) {
    const w = this.world;
    if (this.state === 'play' && w) {
      const inp = this.input.consume();
      let kx = 0;
      let ky = 0;
      if (this.keys.has('ArrowLeft') || this.keys.has('a') || this.keys.has('q')) kx -= 1;
      if (this.keys.has('ArrowRight') || this.keys.has('d')) kx += 1;
      if (this.keys.has('ArrowUp') || this.keys.has('w') || this.keys.has('z')) ky -= 1;
      if (this.keys.has('ArrowDown') || this.keys.has('s')) ky += 1;
      if (inp.dx || inp.dy) w.steer(inp.dx, inp.dy);
      if (kx || ky) w.steer(kx * 220 * dt, ky * 220 * dt);
      if (this.input.touched || kx || ky) this.hud.showDragHint(false);
      this.acc += dt * this.speed;
      let steps = 0;
      while (this.acc >= STEP && steps < 12) {
        this.autopilot?.update(STEP);
        w.update(STEP);
        this.acc -= STEP;
        steps++;
        this.processEvents();
        if (w.status !== 'play') break;
      }
      this.analysisTimer -= dt;
      if (this.analysisTimer <= 0) {
        this.analysisTimer = 0.25;
        this.analysis = analyse(w.crystal, this.target);
      }
      this.renderWorld(dt);
      this.hud.update(dt, w, this.analysis, { score: this.endless?.score });
      const th = w.def.theme;
      this.audio.setAmbience(w.windNow, w.zoneKey === 'redoux' ? w.zoneQ : 0, th === 'blizzard' ? 0.12 : 0.045);
      if (w.status !== 'play') this.onWorldEnd();
    } else if ((this.state === 'paused' || this.state === 'ending') && w) {
      this.renderWorld(this.state === 'ending' ? dt : 0);
      if (this.state === 'ending') {
        this.endTimer -= dt;
        if (this.endTimer <= 0) this.endAction?.();
      }
    } else {
      if (this.state === 'title') this.grower.update(dt);
      const crystal = this.state === 'title' ? this.grower.crystal : this.menuCrystal || this.grower.crystal;
      if (this.state !== 'title' && this.grower.i < this.grower.recipe.length) this.grower.update(dt * 4);
      const y = this.state === 'title' ? 0.36 : this.state === 'menu' ? 0.27 : 0.5;
      const size = this.state === 'title' ? 112 : 96;
      const showCrystal = ['title', 'menu'].includes(this.state);
      this.renderer.renderMenu(dt, this.menuTheme, showCrystal ? crystal : null, { y, size, noMoon: !showCrystal });
    }
  }

  renderWorld(dt) {
    const st = this.store.data.settings;
    const w = this.world;
    this.renderer.render(w, dt, {
      labelFor: st.labels ? (type) => t(`zone.short.${type}`) : null,
      expected: this.target && w.status === 'play' ? expectedMode(w.crystal, this.target) : null,
      reduced: st.reduced,
    });
  }

  processEvents() {
    const w = this.world;
    for (const e of w.events) {
      this.renderer.onEvent(e, w);
      switch (e.type) {
        case 'mote':
          this.audio.mote(e.key, e.x);
          break;
        case 'shard':
          this.audio.shard(e.n, e.total);
          this.haptic(8);
          break;
        case 'hit':
          this.audio.hit(e.kind, e.core);
          this.haptic(e.core || e.kind === 'hail' ? 40 : 22);
          break;
        case 'merge':
          this.audio.merge();
          this.haptic(15);
          break;
        case 'zone':
          this.audio.zone(e.key);
          break;
        case 'hint':
          this.hud.hint(e.key, e.dur);
          break;
        default:
          break;
      }
    }
    w.events.length = 0;
  }

  /** Lower the rendering quality if the device cannot keep up. */
  watchPerformance(dt) {
    if (document.hidden || !['play', 'title', 'menu'].includes(this.state)) return;
    const p = this.perf;
    p.frames++;
    if (dt > 0.03) p.slow++;
    p.t += dt;
    if (p.t >= 3) {
      if (p.slow / p.frames > 0.5 && this.renderer.quality > 0 && !params.has('hq')) {
        this.renderer.setQuality(this.renderer.quality - 1);
        this.input.unitsPerPx = 1 / this.renderer.scale;
        if (this.target) this.renderer.setTarget(this.target);
      }
      p.slow = 0;
      p.frames = 0;
      p.t = 0;
    }
  }

  tickFps(dt) {
    this.fps.n++;
    this.fps.t += dt;
    if (this.fps.t >= 1) {
      this.fps.v = Math.round(this.fps.n / this.fps.t);
      this.fps.n = 0;
      this.fps.t = 0;
      document.title = `Flocon · ${this.fps.v} fps`;
    }
  }

  // ------------------------------------------------------------- endings

  onWorldEnd() {
    const w = this.world;
    this.input.enabled = false;
    this.state = 'ending';
    if (w.status === 'landed') {
      this.audio.land();
      this.haptic(14);
      this.endTimer = this.mode === 'endless' ? 0.9 : 1.15;
      this.endAction = () => this.finishLanded();
    } else {
      this.audio.fail();
      this.haptic(60);
      this.endTimer = 1.2;
      this.endAction = () => this.finishFailed();
    }
  }

  recordFlake(analysis, extra = {}) {
    const w = this.world;
    const c = w.crystal;
    const isNew = this.store.discover(analysis.type);
    const freshBadges = this.store.addBadges(analysis.badges);
    const entry = this.store.addFlake({
      seed: c.seed,
      log: c.compactLog(),
      level: this.mode === 'level' ? this.levelId : this.mode,
      type: analysis.type,
      badges: analysis.badges,
      beauty: analysis.beauty,
      mm: diameterMm(c.R),
      support: w.landing.kind,
      match: analysis.match !== null ? Math.round(analysis.match * 100) : 0,
      ...extra,
    });
    const st = this.store.data.stats;
    st.flakes++;
    st.landed++;
    st.shards += w.stats.shards;
    st.time += w.t;
    this.store.save();
    if (isNew) this.audio.newType();
    return { entry, isNew, freshBadges };
  }

  finishLanded() {
    const w = this.world;
    const analysis = analyse(w.crystal, this.target);
    if (this.mode === 'endless') {
      const e = this.endless;
      if (!e.best || analysis.beauty > e.best.analysis.beauty) e.best = { analysis, crystal: w.crystal, support: w.landing.kind, world: w };
      if (analysis.beauty < e.quota) {
        // The photographer only keeps flakes that are beautiful enough.
        this.finishEndless('quota', analysis);
        return;
      }
      e.score += analysis.beauty;
      e.landed++;
      const isNew = !this.store.data.types[analysis.type];
      if (isNew) {
        this.recordFlake(analysis);
        e.newTypes++;
        toast(`${t('res.newType')} ${t(`type.${analysis.type}`)}`);
      }
      this.hud.banner(`+${num(analysis.beauty)}`, t(`type.${analysis.type}`), 1400);
      e.n++;
      this.state = 'ending';
      this.endTimer = 1.3;
      this.endAction = () => this.nextEndlessFlake();
      return;
    }

    const objectives = evaluateAll(this.def.objectives, { world: w, analysis });
    const stars = objectives.map((o) => o.done);
    const messages = [];
    const before = {
      endless: this.store.endlessUnlocked(),
      daily: this.store.dailyUnlocked(),
      supports: ['scarf', 'sleeve', 'sled', 'glass', 'velvet'].filter((k) => this.store.supportUnlocked(k)),
    };
    let rec = { firstClear: false };
    let extra = null;
    if (this.mode === 'level') {
      rec = this.store.recordLevel(this.levelId, stars, { beauty: analysis.beauty, match: analysis.match !== null ? Math.round(analysis.match * 100) : 0 });
    }
    const { entry, isNew, freshBadges } = this.recordFlake(analysis);
    for (const b of freshBadges) messages.push(`${t(`badge.${b}`)} !`);

    if (this.mode === 'daily') {
      const today = this.today();
      const pct = Math.round((analysis.match ?? 0) * 100);
      const improved = this.store.recordDaily(today.key, pct, today.prev);
      if (improved) messages.push(t('res.newRecord'));
      extra = h(
        'div',
        { class: 'stats', style: { gridTemplateColumns: '1fr 1fr' } },
        h('div', { class: 'stat' }, h('div', { class: 'k' }, t('daily.best')), h('div', { class: 'v' }, `${this.store.dailyBest(today.key)} %`)),
        h('div', { class: 'stat' }, h('div', { class: 'k' }, '🔥'), h('div', { class: 'v' }, tn('daily.streak', this.store.dailyStreak(today.key, today.prev)))),
      );
    }

    // Unlock messages.
    if (!before.daily && this.store.dailyUnlocked()) messages.push(t('res.unlocked', { x: t('menu.daily') }));
    if (!before.endless && this.store.endlessUnlocked()) messages.push(t('res.unlocked', { x: t('menu.endless') }));
    for (const k of ['scarf', 'sleeve', 'sled', 'glass', 'velvet']) {
      if (!before.supports.includes(k) && this.store.supportUnlocked(k)) messages.push(t('res.unlocked', { x: t(`support.${k}`) }));
    }
    if (this.mode === 'level' && rec.firstClear) {
      const ch = this.def.chapter;
      const ls = levelsOfChapter(ch);
      if (ls[ls.length - 1].id === this.levelId) messages.unshift(ch === 5 ? t('res.ending') : t('res.chapterDone'));
    }

    const next = this.mode === 'level' ? nextLevelId(this.levelId) : null;
    const rows = [];
    if (this.mode === 'level') {
      if (next && this.store.isLevelUnlocked(next)) {
        rows.push({ label: t('res.next'), cls: 'primary', icon: 'play', onclick: () => this.goCampaign(LEVEL_BY_ID[next].chapter, next) });
        rows.push([
          { label: t('res.retry'), icon: 'retry', onclick: () => this.startLevel(this.levelId) },
          { label: t('res.save'), icon: 'download', onclick: () => this.exportImage(w.crystal, entry) },
        ]);
      } else {
        rows.push({ label: t('res.retry'), cls: 'primary', icon: 'retry', onclick: () => this.startLevel(this.levelId) });
        rows.push([{ label: t('res.save'), icon: 'download', onclick: () => this.exportImage(w.crystal, entry) }]);
      }
      rows.push([
        { label: t('res.campaign'), icon: 'moon', cls: 'ghost', onclick: () => this.goCampaign(this.def.chapter) },
        { label: t('res.album'), icon: 'book', cls: 'ghost', onclick: () => this.goAlbum() },
      ]);
    } else {
      rows.push({ label: t('res.retry'), cls: 'primary', icon: 'retry', onclick: () => this.startDaily() });
      rows.push([
        { label: t('daily.share'), icon: 'share', onclick: () => this.shareDaily(Math.round((analysis.match ?? 0) * 100)) },
        { label: t('res.save'), icon: 'download', onclick: () => this.exportImage(w.crystal, entry) },
      ]);
      rows.push({ label: t('res.menu'), icon: 'home', cls: 'ghost', onclick: () => this.goMenu() });
    }

    this.hud.hide();
    this.state = 'result';
    this.input.enabled = false;
    this.screens.show(
      S.resultScreen(this, {
        crystal: w.crystal,
        support: this.supportFor({ support: w.landing.kind }),
        analysis,
        stats: w.stats,
        objectives,
        def: this.def,
        entry,
        newType: isNew,
        extra,
        messages,
        buttons: S.buttons(rows),
      }),
    );
  }

  finishFailed() {
    const w = this.world;
    this.store.data.stats.failed++;
    this.store.save();
    if (this.mode === 'endless') {
      this.finishEndless(w.reason);
      return;
    }
    this.hud.hide();
    this.state = 'result';
    const rows = [
      { label: t('res.retry'), cls: 'primary', icon: 'retry', onclick: () => this.restart() },
      { label: this.mode === 'level' ? t('menu.campaign') : t('res.menu'), cls: 'ghost', icon: 'home', onclick: () => this.quit() },
    ];
    this.screens.show(S.failScreen(this, { reason: w.reason, buttons: S.buttons(rows) }));
  }

  finishEndless(reason, lastAnalysis = null) {
    const e = this.endless;
    const rec = this.store.data.endless;
    const isRecord = e.score > rec.best;
    rec.best = Math.max(rec.best, e.score);
    rec.bestFlakes = Math.max(rec.bestFlakes, e.landed);
    rec.runs++;
    this.store.save();
    let entry = null;
    if (e.best && e.best.world) {
      const prevWorld = this.world;
      this.world = e.best.world;
      if (!this.store.data.album.some((x) => x.log && x.seed === e.best.crystal.seed)) entry = this.recordFlake(e.best.analysis).entry;
      this.world = prevWorld;
    }
    this.hud.hide();
    this.state = 'result';
    const statsEl = h(
      'div',
      { class: 'stats' },
      h('div', { class: 'stat' }, h('div', { class: 'k' }, t('endless.score')), h('div', { class: 'v' }, num(e.score))),
      h('div', { class: 'stat' }, h('div', { class: 'k' }, t('endless.flakes')), h('div', { class: 'v' }, String(e.landed))),
      h('div', { class: 'stat' }, h('div', { class: 'k' }, t('endless.best')), h('div', { class: 'v' }, num(rec.best))),
    );
    const rows = S.buttons([
      { label: t('res.retry'), cls: 'primary', icon: 'retry', onclick: () => this.startEndless() },
      { label: t('res.menu'), cls: 'ghost', icon: 'home', onclick: () => this.goMenu() },
    ]);
    const why = reason === 'quota' && lastAnalysis ? `${t('res.failed.quota')} (${num(lastAnalysis.beauty)} / ${num(e.quota)})` : t(`res.failed.${reason}`);
    const items = [h('h2', { class: 'fail-title' }, t('endless.over')), h('p', { class: 'fail-tip' }, why)];
    if (e.best) items.push(S.photoBlock(e.best.crystal, this.supportFor({ support: e.best.support }), { serial: entry ? t('res.unique', { id: entry.id }) : null }));
    items.push(statsEl);
    if (isRecord && e.score > 0) items.push(h('div', { class: 'center-text', style: { color: 'var(--gold)', fontWeight: 800 } }, t('res.newRecord')));
    items.push(rows);
    this.screens.show(h('div', { class: 'screen result scroll' }, h('div', { class: 'col' }, items)));
  }

  // -------------------------------------------------------------- sharing

  async shareDaily(pct) {
    const text = t('daily.shareText', { date: this.today().key, pct });
    try {
      if (navigator.share) {
        await navigator.share({ text });
        return;
      }
      await navigator.clipboard.writeText(text);
      toast(t('daily.copied'));
    } catch {
      toast(text, 3500);
    }
  }

  async exportImage(crystal, entry) {
    const W = 1080;
    const H = 1350;
    const c = makeCanvas(W, H);
    const g = c.getContext('2d');
    g.fillStyle = '#070b1c';
    g.fillRect(0, 0, W, H);
    const photo = makeCanvas(W, W);
    drawPhoto(photo, crystal, { support: this.supportFor(entry || {}), fill: 0.4, rot: -Math.PI / 2 });
    g.drawImage(photo, 0, 0);
    g.fillStyle = '#eaf2ff';
    g.textAlign = 'center';
    g.font = '600 64px Fraunces, Georgia, serif';
    g.fillText(t(`type.${entry?.type || 'prism'}`), W / 2, W + 110);
    g.font = '700 34px Nunito, sans-serif';
    g.fillStyle = '#9db0d6';
    const info = [entry ? t('res.unique', { id: entry.id }) : null, `${diameterMm(crystal.R).toFixed(1)} mm`, entry ? `${t('res.beauty')} ${num(entry.beauty)}` : null].filter(Boolean).join('  ·  ');
    g.fillText(info, W / 2, W + 175);
    g.font = 'italic 400 30px Fraunces, Georgia, serif';
    g.fillStyle = '#cfe6ff';
    g.fillText(`${t('app.title')} — ${t('app.tagline')}`, W / 2, H - 50);
    const blob = await new Promise((res) => c.toBlob(res, 'image/png'));
    if (!blob) return;
    const name = `flocon-${entry?.id ?? 'photo'}.png`;
    try {
      const file = new File([blob], name, { type: 'image/png' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: t('app.title') });
        return;
      }
    } catch {
      /* fall back to a download */
    }
    const url = URL.createObjectURL(blob);
    const a = h('a', { href: url, download: name });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    toast('✓');
  }

  // ---------------------------------------------------------------- debug

  debugUnlockAll() {
    for (const id of Object.keys(LEVEL_BY_ID)) {
      if (!this.store.level(id).done) this.store.recordLevel(id, [true, false, false]);
    }
  }
}

window.addEventListener('DOMContentLoaded', () => {
  const game = new Game();
  window.__flocon = game;
  // Android (Capacitor): hardware back button, and pause when the app is hidden.
  const App = window.Capacitor?.Plugins?.App;
  if (App?.addListener) {
    App.addListener('backButton', () => game.onBack());
    App.addListener('pause', () => game.state === 'play' && game.pause());
  }
});

if ('serviceWorker' in navigator && location.protocol === 'https:' && !DEBUG) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}

export { Game, ICONS };
