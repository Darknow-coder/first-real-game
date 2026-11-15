// Tiny DOM helpers and the inline SVG icon set (original, drawn for Flocon).

export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'html') el.innerHTML = v;
    else if (v === true) el.setAttribute(k, '');
    else el.setAttribute(k, v);
  }
  for (const c of children.flat()) {
    if (c === null || c === undefined || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

const S = (body, extra = '') =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${extra}>${body}</svg>`;

export const ICONS = {
  pause: S('<path d="M9 5v14M15 5v14"/>'),
  back: S('<path d="M15 5l-7 7 7 7"/>'),
  close: S('<path d="M6 6l12 12M18 6L6 18"/>'),
  gear: S(
    '<circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2.2"/><path stroke-width="3.2" d="M12 2.6v2.6M12 18.8v2.6M2.6 12h2.6M18.8 12h2.6M5.4 5.4l1.8 1.8M16.8 16.8l1.8 1.8M5.4 18.6l1.8-1.8M16.8 7.2l1.8-1.8"/>',
  ),
  flake: S(
    '<path d="M12 2v20M3.3 7l17.4 10M3.3 17L20.7 7"/><path d="M12 5.5l-2-2M12 5.5l2-2M12 18.5l-2 2M12 18.5l2 2M5.7 8.4l-.7 2.7M5.7 8.4l-2.7-.7M18.3 15.6l.7-2.7M18.3 15.6l2.7.7M5.7 15.6l-2.7.7M5.7 15.6l.7 2.7M18.3 8.4l2.7-.7M18.3 8.4l-.7-2.7"/>',
  ),
  star: S('<path d="M12 3.2l2.6 5.5 6 .8-4.4 4.1 1.1 5.9L12 16.7l-5.3 2.8 1.1-5.9-4.4-4.1 6-.8z" fill="currentColor"/>'),
  starEmpty: S('<path d="M12 3.2l2.6 5.5 6 .8-4.4 4.1 1.1 5.9L12 16.7l-5.3 2.8 1.1-5.9-4.4-4.1 6-.8z"/>'),
  lock: S('<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 018 0v3"/>'),
  shard: S('<path d="M12 3c.6 4.2 2.4 6.6 7 9-4.6 2.4-6.4 4.8-7 9-.6-4.2-2.4-6.6-7-9 4.6-2.4 6.4-4.8 7-9z" fill="currentColor" stroke="none"/>'),
  heart: S('<path d="M12 20s-7-4.3-7-10a4 4 0 017-2.6A4 4 0 0119 10c0 5.7-7 10-7 10z" fill="currentColor"/>'),
  heartEmpty: S('<path d="M12 20s-7-4.3-7-10a4 4 0 017-2.6A4 4 0 0119 10c0 5.7-7 10-7 10z"/>'),
  download: S('<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>'),
  trash: S('<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>'),
  share: S('<circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="6" r="2.5"/><circle cx="18" cy="18" r="2.5"/><path d="M8.2 10.8l7.6-3.6M8.2 13.2l7.6 3.6"/>'),
  retry: S('<path d="M4 12a8 8 0 1 0 2.4-5.7"/><path d="M4 4v4h4"/>'),
  home: S('<path d="M4 11l8-7 8 7v9h-5v-6H9v6H4z"/>'),
  book: S('<path d="M4 5a2 2 0 012-2h13v16H6a2 2 0 00-2 2z"/><path d="M4 19V5M9 7h6"/>'),
  play: S('<path d="M8 5l11 7-11 7z" fill="currentColor"/>'),
  storm: S('<path d="M5 9h10a3 3 0 100-6M3 13h14a3 3 0 110 6M6 17h5"/>'),
  sun: S('<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5L19 19M5 19l1.5-1.5M17.5 6.5L19 5"/>'),
  moon: S('<path d="M20 14.5A8 8 0 019.5 4 8 8 0 1020 14.5z"/>'),
  check: S('<path d="M5 12.5l4.5 4.5L19 7.5"/>'),
  info: S('<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>'),
  ruler: S('<path d="M4 15L15 4l5 5L9 20z"/><path d="M8 11l2 2M11 8l2 2"/>'),
  sparkles: S('<path d="M12 3l1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6z" fill="currentColor" stroke="none"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z" fill="currentColor" stroke="none"/>'),
  target: S('<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/>'),
  drop: S('<path d="M12 3s6 6.5 6 11a6 6 0 01-12 0c0-4.5 6-11 6-11z"/>'),
  shield: S('<path d="M12 3l7 3v6c0 4.5-3 7.7-7 9-4-1.3-7-4.5-7-9V6z"/>'),
  land: S('<path d="M12 3v10M8 9l4 4 4-4"/><path d="M4 19c3-2 13-2 16 0"/>'),
};

export function icon(name, cls = '') {
  const span = document.createElement('span');
  span.className = `icon ${cls}`;
  span.style.display = 'contents';
  span.innerHTML = ICONS[name] || '';
  return span;
}

let toastTimer = null;
export function toast(msg, ms = 1800) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), ms);
}

/** Simple screen manager with fade transitions. */
export class Screens {
  constructor(root) {
    this.root = root;
    this.current = null;
    this.sheet = null;
  }

  show(el) {
    this.closeSheet(true);
    const prev = this.current;
    this.current = el;
    if (el) {
      this.root.append(el);
      requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('in')));
    }
    if (prev) {
      prev.classList.remove('in');
      prev.classList.add('out');
      setTimeout(() => prev.remove(), 380);
    }
  }

  clear() {
    this.show(null);
  }

  openSheet(content, { onClose, dismissable = true } = {}) {
    this.closeSheet(true);
    const backdrop = h('div', { class: 'sheet-backdrop' });
    const sheet = h('div', { class: 'sheet', role: 'dialog', 'aria-modal': 'true' }, content);
    const close = () => this.closeSheet();
    if (dismissable) backdrop.addEventListener('click', close);
    this.root.append(backdrop, sheet);
    this.sheet = { backdrop, sheet, onClose };
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        backdrop.classList.add('in');
        sheet.classList.add('in');
      }),
    );
    return close;
  }

  closeSheet(immediate = false) {
    const s = this.sheet;
    if (!s) return;
    this.sheet = null;
    s.backdrop.classList.remove('in');
    s.sheet.classList.remove('in');
    const rm = () => {
      s.backdrop.remove();
      s.sheet.remove();
    };
    if (immediate) rm();
    else setTimeout(rm, 320);
    s.onClose?.();
  }
}
