// In-game heads-up display (DOM overlay).
import { h, ICONS } from './dom.js';
import { t, num } from '../core/i18n.js';
import { ZONES } from '../sim/zones.js';
import { diameterMm } from '../sim/classify.js';
import { evaluate, KEEP_KINDS } from '../sim/objectives.js';

const OBJ_ICON = { shards: 'shard', size: 'ruler', beauty: 'sparkles', type: 'flake', match: 'target', intact: 'shield', nomelt: 'drop', badge: 'star' };

export class Hud {
  constructor(el, game) {
    this.el = el;
    this.game = game;
    this.hintTimer = 0;
    this.hintQueue = [];
  }

  setup({ title, objectives = [], mode = 'level' }) {
    this.mode = mode;
    this.objectives = objectives.filter((o) => o.kind !== 'land');
    const pause = h('button', { class: 'icon-btn', 'aria-label': t('pause.button'), html: ICONS.pause, onclick: () => this.game.pause() });
    this.titleEl = h('div', { class: 'hud-title' }, title);
    this.rightEl = h('div', { class: 'pill' }, h('span', { class: 'gold', html: ICONS.shard }), h('span', {}, '0'));
    this.rightVal = this.rightEl.lastChild;
    if (mode === 'endless') {
      this.rightEl = h('div', { class: 'hud-score' }, '0');
      this.rightVal = this.rightEl;
    }
    this.progress = h('div');
    this.chips = this.objectives.map((o) => {
      const val = h('span', {}, '');
      const chip = h('div', { class: 'chip' }, h('span', { html: ICONS[OBJ_ICON[o.kind] || 'star'] }), val);
      return { o, chip, val, last: '' };
    });
    this.zoneEl = h('div', { class: 'hud-zone', style: { opacity: 0 } });
    this.hintEl = h('div', { class: 'hud-hint' });
    this.bannerEl = h('div', { class: 'hud-banner' });
    this.dragHint = h('div', { class: 'drag-hint hidden' }, h('span', {}, '‹'), h('div', { class: 'finger' }), h('span', {}, '›'));
    this.el.replaceChildren(
      h('div', { class: 'hud-top' }, pause, this.titleEl, this.rightEl),
      h('div', { class: 'hud-progress' }, this.progress),
      h('div', { class: 'hud-chips' }, this.chips.map((c) => c.chip)),
      this.hintEl,
      this.zoneEl,
      this.bannerEl,
      this.dragHint,
    );
    this.lastZone = undefined;
    this.lastRight = '';
    this.hintTimer = 0;
    this.hintQueue = [];
    this.el.classList.remove('hidden');
  }

  hide() {
    this.el.classList.add('hidden');
  }

  show() {
    this.el.classList.remove('hidden');
  }

  setTitle(s) {
    this.titleEl.textContent = s;
  }

  showDragHint(on) {
    this.dragHint.classList.toggle('hidden', !on);
  }

  hint(key, dur = 4.2) {
    this.hintQueue.push({ text: t(key), dur });
    if (this.hintTimer <= 0) this.nextHint();
  }

  nextHint() {
    const next = this.hintQueue.shift();
    if (!next) {
      this.hintEl.classList.remove('show');
      return;
    }
    this.hintEl.textContent = next.text;
    this.hintEl.classList.add('show');
    this.hintTimer = next.dur;
  }

  banner(text, sub, ms = 1600) {
    this.bannerEl.replaceChildren(text, sub ? h('small', {}, sub) : '');
    this.bannerEl.classList.add('show');
    clearTimeout(this.bannerTimer);
    this.bannerTimer = setTimeout(() => this.bannerEl.classList.remove('show'), ms);
  }

  /** Called every frame while playing. */
  update(dt, world, analysis, extra = {}) {
    if (this.hintTimer > 0) {
      this.hintTimer -= dt;
      if (this.hintTimer <= 0) {
        this.hintEl.classList.remove('show');
        setTimeout(() => this.nextHint(), 380);
      }
    }
    this.progress.style.width = `${(world.progress * 100).toFixed(1)}%`;
    const right = this.mode === 'endless' ? num(extra.score ?? 0) : `${world.stats.shards}/${world.stats.shardsTotal}`;
    if (right !== this.lastRight) {
      this.rightVal.textContent = right;
      this.lastRight = right;
    }
    // Zone indicator.
    const key = world.zoneKey;
    if (key !== this.lastZone) {
      this.lastZone = key;
      if (key) {
        const rgb = ZONES[key].rgb;
        this.zoneEl.replaceChildren(
          h('span', { class: 'dot', style: { background: `rgb(${rgb})`, boxShadow: `0 0 10px rgb(${rgb})` } }),
          h('span', {}, t(`zone.${key}`)),
          h('span', { class: 'fx' }, `· ${t(`zone.short.${key}`)}`),
        );
        this.zoneEl.style.opacity = 1;
        this.zoneEl.style.borderColor = `rgba(${rgb},0.55)`;
      } else {
        this.zoneEl.style.opacity = 0;
      }
    }
    // Objective chips.
    for (const c of this.chips) {
      const r = evaluate(c.o, { world, analysis });
      let text = '';
      let state = '';
      switch (c.o.kind) {
        case 'shards':
          text = `${r.value}/${r.goal}`;
          state = r.value >= r.goal ? 'ok' : '';
          break;
        case 'size':
          text = t('hud.size', { v: `${diameterMm(world.crystal.R).toFixed(1)}/${r.goal}` });
          state = r.value >= r.goal ? 'ok' : '';
          break;
        case 'beauty':
          text = `${num(r.value)}/${num(r.goal)}`;
          state = r.value >= r.goal ? 'ok' : '';
          break;
        case 'match':
          text = `${r.value} % / ${r.goal} %`;
          state = r.value >= r.goal ? 'ok' : '';
          break;
        case 'type': {
          const want = Array.isArray(c.o.type) ? c.o.type : [c.o.type];
          text = analysis ? t(`type.${analysis.type}`) : '…';
          state = analysis && want.includes(analysis.type) ? 'ok' : '';
          break;
        }
        case 'intact':
          text = t('obj.intact');
          state = r.ratio >= 1 ? 'ok' : 'bad';
          break;
        case 'nomelt':
          text = t('obj.nomelt');
          state = r.ratio >= 1 ? 'ok' : 'bad';
          break;
        case 'badge':
          text = t(`badge.${c.o.badge}`);
          state = r.ratio >= 1 ? 'ok' : '';
          break;
        default:
          break;
      }
      if (KEEP_KINDS.has(c.o.kind) && state === 'ok') state = '';
      const sig = `${text}|${state}`;
      if (sig !== c.last) {
        c.val.textContent = text;
        c.chip.classList.toggle('ok', state === 'ok');
        c.chip.classList.toggle('bad', state === 'bad');
        c.last = sig;
      }
    }
  }
}
