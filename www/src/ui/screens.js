// All menu screens and sheets (DOM).
import { h, ICONS, toast } from './dom.js';
import { t, tn, num, getLang, LANGS } from '../core/i18n.js';
import { CHAPTERS, LEVELS, LEVEL_BY_ID, levelsOfChapter } from '../sim/levels.js';
import { ZONES } from '../sim/zones.js';
import { TYPES, diameterMm } from '../sim/classify.js';
import { Crystal, MODE_KEYS } from '../sim/crystal.js';
import { thumbnail, drawPhoto } from '../render/photo.js';
import { supportTexture, SUPPORT_KINDS } from '../render/ground.js';
import { makeCanvas } from '../render/sprites.js';

const MODE_ZONE = { plate: 'sec', dendrite: 'brume', needle: 'froid', aurora: 'aurore', twist: 'tourbillon' };

function iconSpan(name, cls = '') {
  return h('span', { class: cls, html: ICONS[name], style: { display: 'inline-flex' } });
}

function starIcons(n, total = 3) {
  return h(
    'span',
    { class: 'mini-stars' },
    [...Array(total)].map((_, i) => h('span', { class: i < n ? 'gold' : '', style: { opacity: i < n ? 1 : 0.35, display: 'inline-flex' }, html: i < n ? ICONS.star : ICONS.starEmpty })),
  );
}

export function objectiveText(o, def) {
  switch (o.kind) {
    case 'land':
      return t('obj.land', { the: t(`the.${def?.landing?.kind || 'mitten'}`) });
    case 'shards':
      return t('obj.shards', { n: o.n });
    case 'size':
      return t('obj.size', { mm: o.mm });
    case 'beauty':
      return t('obj.beauty', { n: num(o.n) });
    case 'type': {
      const types = Array.isArray(o.type) ? o.type : [o.type];
      return t('obj.type', { type: types.map((x) => t(`type.${x}`)).join(t('obj.or')) });
    }
    case 'match':
      return t('obj.match', { pct: o.pct });
    case 'intact':
      return t('obj.intact');
    case 'nomelt':
      return t('obj.nomelt');
    case 'badge':
      return t(`obj.badge.${o.badge}`);
    default:
      return '';
  }
}

/** Small canvas with a crystal photo. */
function crystalCanvas(crystal, size, support = 'velvet') {
  const c = thumbnail(crystal, Math.round(size * Math.min(2, window.devicePixelRatio || 1)), support);
  c.style.width = `${size}px`;
  c.style.height = `${size}px`;
  return c;
}

function recipeLegend(recipe) {
  return h(
    'div',
    { class: 'legend' },
    h('div', { style: { fontWeight: 800, color: 'var(--text)' } }, t('intro.target')),
    recipe.map(([mode]) => {
      const z = MODE_ZONE[mode] || 'brume';
      const rgb = ZONES[z].rgb;
      return h('div', { class: 'row' }, h('span', { class: 'dot', style: { background: `rgb(${rgb})` } }), `${t(`zone.${z}`)} · ${t(`zone.short.${z}`)}`);
    }),
  );
}

// ------------------------------------------------------------------ title

export function titleScreen(game) {
  const el = h(
    'div',
    { class: 'screen title-screen', onclick: () => game.goMenu(true) },
    h(
      'div',
      { class: 'title-block' },
      h('h1', { class: 'logo' }, t('app.title')),
      h('p', { class: 'tagline' }, t('app.tagline')),
      h('div', { class: 'tap-start pulse' }, t('tap.start')),
    ),
    h('div', { class: 'studio' }, t('app.studio')),
  );
  return el;
}

// ------------------------------------------------------------------- menu

export function menuScreen(game) {
  const s = game.store;
  const totalStars = s.totalStars();
  const albumN = s.data.album.length;
  const typesN = Object.keys(s.data.types).length;
  const today = game.today();
  const dailyBest = s.dailyBest(today.key);
  const endlessOk = s.endlessUnlocked();
  const dailyOk = s.dailyUnlocked();

  const card = (opts) =>
    h(
      'button',
      { class: `card ${opts.cls || ''} ${opts.locked ? 'locked' : ''}`, onclick: opts.locked ? () => toast(opts.lockMsg) : opts.onclick },
      h('span', { class: 'ic', html: ICONS[opts.icon] }),
      h('span', { class: 'txt' }, h('div', { class: 't1' }, opts.title), h('div', { class: 't2' }, opts.sub)),
      opts.right ? h('span', { class: 'right' }, opts.right) : null,
    );

  return h(
    'div',
    { class: 'screen menu-screen' },
    h(
      'div',
      { class: 'menu-head' },
      h('h1', { class: 'logo small' }, t('app.title')),
      h('button', { class: 'icon-btn', 'aria-label': t('menu.settings'), html: ICONS.gear, onclick: () => game.goSettings() }),
    ),
    h('div', { class: 'spacer' }),
    h(
      'div',
      { class: 'col' },
      card({
        cls: 'primary',
        icon: 'moon',
        title: t('menu.campaign'),
        sub: t('menu.campaign.sub'),
        right: h('span', { class: 'gold', style: { display: 'inline-flex', alignItems: 'center', gap: '4px' } }, iconSpan('star'), `${totalStars}/${LEVELS.length * 3}`),
        onclick: () => game.goCampaign(),
      }),
      card({
        icon: 'target',
        title: t('menu.daily'),
        sub: dailyOk ? (dailyBest ? t('menu.dailyDone', { v: dailyBest }) : t('menu.daily.sub')) : t('menu.locked.daily'),
        locked: !dailyOk,
        lockMsg: t('menu.locked.daily'),
        right: dailyOk ? (s.dailyStreak(today.key, today.prev) ? `🔥 ${s.dailyStreak(today.key, today.prev)}` : null) : iconSpan('lock'),
        onclick: () => game.openDailyIntro(),
      }),
      card({
        icon: 'storm',
        title: t('menu.endless'),
        sub: endlessOk ? (s.data.endless.best ? t('menu.best', { n: num(s.data.endless.best) }) : t('menu.endless.sub')) : t('menu.locked.endless'),
        locked: !endlessOk,
        lockMsg: t('menu.locked.endless'),
        right: endlessOk ? null : iconSpan('lock'),
        onclick: () => game.openEndlessIntro(),
      }),
      card({
        icon: 'book',
        title: t('menu.album'),
        sub: tn('menu.album.sub', albumN, { k: typesN, t: TYPES.length }),
        onclick: () => game.goAlbum(),
      }),
    ),
  );
}

// --------------------------------------------------------------- campaign

export function campaignScreen(game, focusChapter) {
  const s = game.store;
  const list = h('div', { class: 'chapters scroll' });
  let nextId = null;
  for (const l of LEVELS) {
    if (s.isLevelUnlocked(l.id) && !s.level(l.id).done) {
      nextId = l.id;
      break;
    }
  }
  for (const ch of CHAPTERS) {
    const unlocked = s.isChapterUnlocked(ch.id);
    const stars = s.chapterStars(ch.id);
    const nights = levelsOfChapter(ch.id).map((l) => {
      const st = s.level(l.id);
      const open = s.isLevelUnlocked(l.id);
      const n = st.stars.filter(Boolean).length;
      return h(
        'button',
        {
          class: `night ${st.done ? 'done' : ''} ${open ? '' : 'locked'} ${l.id === nextId ? 'next' : ''}`,
          'aria-label': `${l.id} ${t(`lvl.${l.id}`)}`,
          onclick: () => (open ? game.openLevelIntro(l.id) : toast(t('common.locked'))),
        },
        open ? h('span', {}, String(l.index)) : h('span', { class: 'lock', html: ICONS.lock, style: { display: 'inline-flex' } }),
        st.done ? starIcons(n) : null,
      );
    });
    const chEl = h(
      'div',
      { class: 'chapter', 'data-ch': ch.id },
      h(
        'div',
        { class: `banner theme-${ch.theme}` },
        h('div', { class: 'num' }, t('ch.chapter', { n: ch.id })),
        h('div', { class: 'name' }, t(`ch.${ch.id}`)),
        h('div', { class: 'desc' }, t(`ch.${ch.id}.desc`)),
        h('div', { class: 'stars pill' }, h('span', { class: 'gold', html: ICONS.star, style: { display: 'inline-flex' } }), `${stars}/18`),
      ),
      unlocked ? h('div', { class: 'nights' }, nights) : h('div', { class: 'locked-msg' }, iconSpan('lock'), t('ch.locked')),
    );
    list.append(chEl);
  }
  const el = h(
    'div',
    { class: 'screen' },
    h(
      'div',
      { class: 'topbar' },
      h('button', { class: 'icon-btn', 'aria-label': t('common.back'), html: ICONS.back, onclick: () => game.goMenu() }),
      h('h2', {}, t('menu.campaign')),
      h('div', { class: 'pill' }, h('span', { class: 'gold', html: ICONS.star, style: { display: 'inline-flex' } }), `${s.totalStars()}/${LEVELS.length * 3}`),
    ),
    list,
  );
  const focus = focusChapter ?? (nextId ? LEVEL_BY_ID[nextId].chapter : 1);
  setTimeout(() => {
    const target = list.querySelector(`[data-ch="${focus}"]`);
    if (target && focus > 1) list.scrollTop = target.offsetTop - 8;
  }, 30);
  return el;
}

export function levelIntro(game, id) {
  const def = LEVEL_BY_ID[id];
  const st = game.store.level(id);
  const body = h('div', { class: 'body' });
  def.objectives.forEach((o, i) => {
    body.append(
      h(
        'div',
        { class: `objective ${st.stars[i] ? 'done' : ''}` },
        h('span', { class: st.stars[i] ? 'gold' : '', html: st.stars[i] ? ICONS.star : ICONS.starEmpty, style: { display: 'inline-flex' } }),
        h('span', {}, objectiveText(o, def)),
      ),
    );
  });
  if (def.target) {
    const target = Crystal.fromRecipe(7, def.target);
    body.prepend(h('div', { class: 'target-preview' }, crystalCanvas(target, 92, 'velvet'), recipeLegend(def.target)));
  }
  return h(
    'div',
    {},
    h('div', { class: 'kicker' }, `${t(`ch.${def.chapter}`)} · ${def.id}`),
    h('h3', {}, t(`lvl.${id}`)),
    body,
    h('button', { class: 'btn primary block', onclick: () => game.startLevel(id) }, h('span', { html: ICONS.play, style: { display: 'inline-flex' } }), t('intro.play')),
  );
}

// ----------------------------------------------------------------- pause

export function pauseSheet(game) {
  const objs = game.def?.objectives || [];
  const body = h('div', { class: 'body' });
  if (objs.length) {
    body.append(h('div', { class: 'kicker' }, t('pause.objectives')));
    for (const o of objs) body.append(h('div', { class: 'objective' }, h('span', { html: ICONS.starEmpty, style: { display: 'inline-flex' } }), objectiveText(o, game.def)));
  }
  return h(
    'div',
    {},
    h('h3', {}, t('pause.title')),
    body,
    h(
      'div',
      { class: 'col', style: { maxWidth: 'none' } },
      h('button', { class: 'btn primary block', onclick: () => game.resume() }, h('span', { html: ICONS.play, style: { display: 'inline-flex' } }), t('pause.resume')),
      h(
        'div',
        { class: 'btn-row' },
        h('button', { class: 'btn', onclick: () => game.restart() }, h('span', { html: ICONS.retry, style: { display: 'inline-flex' } }), t('pause.restart')),
        h('button', { class: 'btn', onclick: () => game.openGuide(true) }, h('span', { html: ICONS.info, style: { display: 'inline-flex' } }), t('pause.guide')),
      ),
      h('button', { class: 'btn ghost block', onclick: () => game.quit() }, h('span', { html: ICONS.home, style: { display: 'inline-flex' } }), t('pause.quit')),
    ),
  );
}

export function guideSheet(game, fromPause) {
  const rows = ['brume', 'sec', 'froid', 'givre', 'aurore', 'tourbillon', 'redoux'].map((k) => {
    const rgb = ZONES[k].rgb;
    return h(
      'div',
      { class: 'guide-row' },
      h('span', { class: 'sw', style: { background: `radial-gradient(circle, rgb(${rgb}), rgba(${rgb},0.2))`, color: `rgba(${rgb},0.6)` } }),
      h('div', {}, h('div', { class: 't1' }, `${t(`zone.${k}`)} · ${t(`zone.short.${k}`)}`), h('div', { class: 't2' }, t(`zone.desc.${k}`))),
    );
  });
  return h(
    'div',
    { style: { display: 'flex', flexDirection: 'column', minHeight: 0 } },
    h('h3', {}, t('pause.guide')),
    h('div', { class: 'body scroll', style: { minHeight: 0 } }, rows),
    h('button', { class: 'btn primary block', onclick: () => (fromPause ? game.pause(true) : game.screens.closeSheet()) }, t('common.ok')),
  );
}

// --------------------------------------------------------------- results

export function photoBlock(crystal, support, { badge, serial, flash = true } = {}) {
  const size = Math.round(Math.min(window.innerWidth * 0.78, window.innerHeight * 0.42, 340) * Math.min(2, window.devicePixelRatio || 1));
  const canvas = makeCanvas(size, size);
  drawPhoto(canvas, crystal, { support, fill: 0.4, rot: -Math.PI / 2 });
  const flashEl = h('div', { class: `flash ${flash ? 'go' : ''}` });
  return h('div', { class: 'photo-wrap' }, canvas, flashEl, badge ? h('div', { class: 'badge' }, badge) : null, serial ? h('div', { class: 'serial' }, serial) : null);
}

export function resultScreen(game, r) {
  const items = [];
  const stats = [
    h('div', { class: 'stat' }, h('div', { class: 'k' }, t('res.size')), h('div', { class: 'v' }, `${diameterMm(r.crystal.R).toFixed(1)} mm`)),
    h('div', { class: 'stat' }, h('div', { class: 'k' }, t('res.beauty')), h('div', { class: 'v' }, num(r.analysis.beauty))),
    r.analysis.match !== null
      ? h('div', { class: 'stat' }, h('div', { class: 'k' }, t('res.match')), h('div', { class: 'v' }, `${Math.round(r.analysis.match * 100)} %`))
      : h('div', { class: 'stat' }, h('div', { class: 'k' }, t('res.shards')), h('div', { class: 'v' }, `${r.stats.shards}/${r.stats.shardsTotal}`)),
  ];
  items.push(photoBlock(r.crystal, r.support, { badge: r.newType ? t('res.newType') : null, serial: r.entry ? t('res.unique', { id: r.entry.id }) : null }));
  items.push(
    h(
      'div',
      { class: 'result-name' },
      h('div', { class: 'type' }, t(`type.${r.analysis.type}`)),
      r.analysis.badges.length ? h('div', { class: 'badges' }, r.analysis.badges.map((b) => h('span', { class: 'tag' }, t(`badge.${b}`)))) : null,
    ),
  );
  items.push(h('div', { class: 'stats' }, stats));
  if (r.objectives) {
    items.push(
      h(
        'div',
        { class: 'stars-row' },
        r.objectives.map((o, i) =>
          h(
            'div',
            { class: `star-line ${o.done ? 'done' : 'miss'}`, style: { animationDelay: `${0.25 + i * 0.25}s` } },
            h('span', { html: o.done ? ICONS.star : ICONS.starEmpty, style: { display: 'inline-flex' } }),
            objectiveText(o.obj, r.def),
          ),
        ),
      ),
    );
  }
  if (r.extra) items.push(r.extra);
  for (const msg of r.messages || []) items.push(h('div', { class: 'center-text', style: { color: 'var(--gold)', fontWeight: 800 } }, msg));
  items.push(r.buttons);
  return h('div', { class: 'screen result scroll' }, h('div', { class: 'col' }, items));
}

export function failScreen(game, r) {
  const icon = h('div', { class: 'fail-icon', html: ICONS.flake });
  return h(
    'div',
    { class: 'screen result' },
    h(
      'div',
      { class: 'col' },
      icon,
      h('h2', { class: 'fail-title' }, t(`res.failed.${r.reason}`)),
      h('p', { class: 'fail-tip' }, t(`res.tip.${r.reason}`)),
      r.extra || null,
      r.buttons,
    ),
  );
}

export function buttons(list) {
  return h(
    'div',
    { class: 'col', style: { gap: '10px', marginTop: '6px' } },
    list.map((row) =>
      Array.isArray(row)
        ? h(
            'div',
            { class: 'btn-row' },
            row.map((b) => h('button', { class: `btn ${b.cls || ''}`, onclick: b.onclick }, b.icon ? h('span', { html: ICONS[b.icon], style: { display: 'inline-flex' } }) : null, b.label)),
          )
        : h('button', { class: `btn block ${row.cls || ''}`, onclick: row.onclick }, row.icon ? h('span', { html: ICONS[row.icon], style: { display: 'inline-flex' } }) : null, row.label),
    ),
  );
}

// ------------------------------------------------------------ daily/endless

export function dailyIntro(game, def) {
  const s = game.store;
  const today = game.today();
  const best = s.dailyBest(today.key);
  const streak = s.dailyStreak(today.key, today.prev);
  const target = Crystal.fromRecipe(7, def.target);
  return h(
    'div',
    {},
    h('div', { class: 'kicker' }, today.key),
    h('h3', {}, t('daily.title')),
    h(
      'div',
      { class: 'body' },
      h('p', { class: 'center-text', style: { margin: 0, textAlign: 'left' } }, t('daily.desc')),
      h('div', { class: 'target-preview' }, crystalCanvas(target, 92, 'velvet'), recipeLegend(def.target)),
      h('div', { class: 'objective' }, h('span', { class: 'gold', html: ICONS.target, style: { display: 'inline-flex' } }), t('daily.best'), h('span', { class: 'val' }, best ? `${best} %` : '—')),
      h('div', { class: 'objective' }, h('span', { html: ICONS.sparkles, style: { display: 'inline-flex' } }), tn('daily.streak', streak)),
    ),
    h('button', { class: 'btn primary block', onclick: () => game.startDaily() }, h('span', { html: ICONS.play, style: { display: 'inline-flex' } }), t('daily.start')),
  );
}

export function endlessIntro(game) {
  const e = game.store.data.endless;
  return h(
    'div',
    {},
    h('div', { class: 'kicker' }, t('menu.endless')),
    h('h3', {}, t('endless.title')),
    h(
      'div',
      { class: 'body' },
      h('p', { class: 'center-text', style: { margin: 0, textAlign: 'left' } }, t('endless.desc')),
      h('div', { class: 'objective' }, h('span', { class: 'gold', html: ICONS.star, style: { display: 'inline-flex' } }), t('endless.best'), h('span', { class: 'val' }, e.best ? num(e.best) : '—')),
      h('div', { class: 'objective' }, h('span', { html: ICONS.flake, style: { display: 'inline-flex' } }), t('endless.flakes'), h('span', { class: 'val' }, e.bestFlakes ? String(e.bestFlakes) : '—')),
    ),
    h('button', { class: 'btn primary block', onclick: () => game.startEndless() }, h('span', { html: ICONS.play, style: { display: 'inline-flex' } }), t('endless.start')),
  );
}

// ------------------------------------------------------------------ album

export function albumScreen(game, tab = 'flakes') {
  const s = game.store;
  const content = h('div', { class: 'scroll', style: { flex: 1, width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: '12px' } });
  const tabs = ['flakes', 'types', 'supports'].map((k) => h('button', { class: `tab ${tab === k ? 'on' : ''}`, onclick: () => game.goAlbum(k) }, t(`album.${k}`)));

  if (tab === 'flakes') {
    const entries = [...s.data.album].reverse();
    if (!entries.length) content.append(h('div', { class: 'empty' }, t('album.empty')));
    const grid = h('div', { class: 'grid' });
    content.append(grid);
    // Render thumbnails progressively to keep the UI responsive.
    let i = 0;
    const px = Math.round(130 * Math.min(2, window.devicePixelRatio || 1));
    const batch = () => {
      if (!grid.isConnected && i > 0) return;
      const end = Math.min(entries.length, i + 6);
      for (; i < end; i++) {
        const e = entries[i];
        const cell = h('button', { class: 'thumb', 'aria-label': t(`type.${e.type}`), onclick: () => game.openFlake(e.id) });
        try {
          const c = Crystal.fromLog(e.seed, e.log);
          cell.append(thumbnail(c, px, game.supportFor(e)));
        } catch {
          cell.append(h('div', { class: 'empty' }, '?'));
        }
        if (e.fav) cell.append(h('span', { class: 'fav', html: ICONS.heart }));
        grid.append(cell);
      }
      if (i < entries.length) requestAnimationFrame(batch);
    };
    requestAnimationFrame(batch);
  } else if (tab === 'types') {
    const known = Object.keys(s.data.types).length;
    content.append(h('div', { class: 'center-text', style: { marginBottom: '10px', fontWeight: 800 } }, t('album.discovered', { n: known, t: TYPES.length })));
    const list = h('div', { class: 'col', style: { paddingBottom: '24px' } });
    for (const type of TYPES) {
      const info = s.data.types[type];
      const entry = info ? [...s.data.album].reverse().find((e) => e.type === type) : null;
      let canvas;
      if (entry) {
        try {
          canvas = thumbnail(Crystal.fromLog(entry.seed, entry.log), 128, 'velvet');
        } catch {
          canvas = makeCanvas(128, 128);
        }
      } else {
        canvas = makeCanvas(128, 128);
        const g = canvas.getContext('2d');
        g.fillStyle = '#0b1020';
        g.fillRect(0, 0, 128, 128);
        g.fillStyle = 'rgba(160,180,220,0.4)';
        g.font = '700 54px Fraunces, serif';
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.fillText('?', 64, 68);
      }
      list.append(
        h(
          'div',
          { class: `type-card ${info ? '' : 'unknown'}` },
          canvas,
          h('div', {}, h('div', { class: 't1' }, info ? t(`type.${type}`) : t('album.unknown')), h('div', { class: 't2' }, info ? t(`type.desc.${type}`) : t('album.hint', { h: t(`type.hint.${type}`) }))),
          info ? h('div', { class: 'count' }, t('album.count', { n: info.n })) : null,
        ),
      );
    }
    content.append(list);
  } else {
    content.append(h('div', { class: 'center-text', style: { marginBottom: '10px' } }, t('album.supportHint')));
    const grid = h('div', { class: 'support-grid' });
    const current = s.data.settings.support;
    const auto = h(
      'button',
      { class: `support ${current === 'auto' ? 'on' : ''}`, onclick: () => game.setSupport('auto') },
      (() => {
        const c = makeCanvas(150, 100);
        const g = c.getContext('2d');
        const grad = g.createLinearGradient(0, 0, 150, 100);
        grad.addColorStop(0, '#151d3f');
        grad.addColorStop(0.5, '#3f1422');
        grad.addColorStop(1, '#14261c');
        g.fillStyle = grad;
        g.fillRect(0, 0, 150, 100);
        return c;
      })(),
      t('support.auto'),
    );
    grid.append(auto);
    for (const k of SUPPORT_KINDS) {
      const ok = s.supportUnlocked(k);
      const tex = supportTexture(k, 150, 5);
      const c = makeCanvas(150, 100);
      c.getContext('2d').drawImage(tex, 0, -25);
      grid.append(
        h(
          'button',
          { class: `support ${current === k ? 'on' : ''} ${ok ? '' : 'locked'}`, onclick: () => (ok ? game.setSupport(k) : toast(t(`unlock.${k}`))) },
          c,
          h('div', {}, t(`support.${k}`)),
          ok ? null : h('div', { class: 'cond' }, t(`unlock.${k}`)),
        ),
      );
    }
    content.append(grid);
  }

  return h(
    'div',
    { class: 'screen' },
    h(
      'div',
      { class: 'topbar' },
      h('button', { class: 'icon-btn', 'aria-label': t('common.back'), html: ICONS.back, onclick: () => game.goMenu() }),
      h('h2', {}, t('album.title')),
    ),
    h('div', { class: 'tabs', style: { marginTop: '10px' } }, tabs),
    content,
  );
}

export function flakeSheet(game, e) {
  const c = Crystal.fromLog(e.seed, e.log);
  const date = new Date(e.t).toLocaleDateString(getLang() === 'fr' ? 'fr-FR' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  const place = e.level && LEVEL_BY_ID[e.level] ? t(`lvl.${e.level}`) : e.level === 'daily' ? t('daily.title') : t('endless.title');
  const favBtn = h('button', { class: 'btn', onclick: () => {
    const on = game.store.toggleFav(e.id);
    favBtn.replaceChildren(h('span', { html: on ? ICONS.heart : ICONS.heartEmpty, style: { display: 'inline-flex', color: '#ff8fa8' } }), t('album.fav'));
  } }, h('span', { html: e.fav ? ICONS.heart : ICONS.heartEmpty, style: { display: 'inline-flex', color: '#ff8fa8' } }), t('album.fav'));
  return h(
    'div',
    { class: 'col', style: { maxWidth: 'none', minHeight: 0 } },
    photoBlock(c, game.supportFor(e), { serial: t('res.unique', { id: e.id }), flash: false }),
    h(
      'div',
      { class: 'result-name' },
      h('div', { class: 'type' }, t(`type.${e.type}`)),
      h('div', { class: 'center-text', style: { fontSize: '13px' } }, t('album.from', { place, date })),
      e.badges?.length ? h('div', { class: 'badges' }, e.badges.map((b) => h('span', { class: 'tag' }, t(`badge.${b}`)))) : null,
    ),
    h(
      'div',
      { class: 'stats' },
      h('div', { class: 'stat' }, h('div', { class: 'k' }, t('res.size')), h('div', { class: 'v' }, `${(e.mm ?? diameterMm(c.R)).toFixed(1)} mm`)),
      h('div', { class: 'stat' }, h('div', { class: 'k' }, t('res.beauty')), h('div', { class: 'v' }, num(e.beauty || 0))),
      h('div', { class: 'stat' }, h('div', { class: 'k' }, t('res.match')), h('div', { class: 'v' }, e.match ? `${e.match} %` : '—')),
    ),
    h(
      'div',
      { class: 'btn-row' },
      favBtn,
      h('button', { class: 'btn', onclick: () => game.exportImage(c, e) }, h('span', { html: ICONS.download, style: { display: 'inline-flex' } }), t('res.save')),
      h('button', { class: 'btn danger', 'aria-label': t('album.delete'), onclick: () => {
        if (confirm(t('album.confirmDelete'))) {
          game.store.removeFlake(e.id);
          game.screens.closeSheet();
          game.goAlbum('flakes');
        }
      } }, h('span', { html: ICONS.trash, style: { display: 'inline-flex' } })),
    ),
  );
}

// --------------------------------------------------------------- settings

export function settingsScreen(game) {
  const st = game.store.data.settings;
  const slider = (key, label) => {
    const input = h('input', { type: 'range', min: 0, max: 1, step: 0.05, value: st[key], 'aria-label': label });
    input.addEventListener('input', () => game.setSetting(key, Number(input.value)));
    return h('div', { class: 'setting' }, h('label', {}, label), input);
  };
  const toggle = (key, label) => {
    const sw = h('button', { class: `switch ${st[key] ? 'on' : ''}`, role: 'switch', 'aria-checked': String(!!st[key]), 'aria-label': label });
    sw.addEventListener('click', () => {
      const v = !game.store.data.settings[key];
      game.setSetting(key, v);
      sw.classList.toggle('on', v);
      sw.setAttribute('aria-checked', String(v));
    });
    return h('div', { class: 'setting' }, h('label', {}, label), sw);
  };
  const sens = h('input', { type: 'range', min: 0.6, max: 1.8, step: 0.05, value: st.sensitivity, 'aria-label': t('set.sensitivity') });
  sens.addEventListener('input', () => game.setSetting('sensitivity', Number(sens.value)));
  const lang = getLang();
  const langSeg = h(
    'div',
    { class: 'seg' },
    LANGS.map((l) => h('button', { class: l === lang ? 'on' : '', onclick: () => game.setLanguage(l) }, l.toUpperCase())),
  );
  return h(
    'div',
    { class: 'screen' },
    h(
      'div',
      { class: 'topbar' },
      h('button', { class: 'icon-btn', 'aria-label': t('common.back'), html: ICONS.back, onclick: () => game.goMenu() }),
      h('h2', {}, t('set.title')),
    ),
    h(
      'div',
      { class: 'col scroll', style: { flex: 1, paddingTop: '12px' } },
      slider('music', t('set.music')),
      slider('sfx', t('set.sfx')),
      h('div', { class: 'setting' }, h('label', {}, t('set.sensitivity')), sens),
      toggle('haptics', t('set.haptics')),
      toggle('labels', t('set.labels')),
      toggle('reduced', t('set.reduced')),
      h('div', { class: 'setting' }, h('label', {}, t('set.lang')), langSeg),
      h('button', { class: 'btn ghost block', onclick: () => game.openGuide(false) }, h('span', { html: ICONS.info, style: { display: 'inline-flex' } }), t('pause.guide')),
      h('button', { class: 'btn ghost block danger', onclick: () => {
        if (confirm(t('set.resetConfirm'))) {
          game.store.reset();
          toast('✓');
          game.goMenu();
        }
      } }, h('span', { html: ICONS.trash, style: { display: 'inline-flex' } }), t('set.reset')),
      h('div', { class: 'credits' }, h('strong', {}, t('set.credits')), '\n', t('set.creditsText')),
    ),
  );
}
