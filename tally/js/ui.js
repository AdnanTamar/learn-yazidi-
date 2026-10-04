// Tiny DOM toolkit: hyperscript, icons, modal, toast, form fields. All text goes through textContent (no innerHTML with user data).
const SVG_NS = 'http://www.w3.org/2000/svg';

export function h(tag, props, ...children) {
  const el = document.createElement(tag);
  applyProps(el, props);
  append(el, children);
  return el;
}
export function s(tag, props, ...children) {
  const el = document.createElementNS(SVG_NS, tag);
  applyProps(el, props, true);
  append(el, children);
  return el;
}
function applyProps(el, props, isSvg) {
  if (!props) return;
  for (const [k, v] of Object.entries(props)) {
    if (v == null || v === false) continue;
    if (k === 'class') el.setAttribute('class', v);
    else if (k === 'style' && typeof v === 'object') { for (const [sk, sv] of Object.entries(v)) { if (sk.startsWith('--')) el.style.setProperty(sk, sv); else el.style[sk] = sv; } }
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'value' && !isSvg) el.value = v;
    else if ((k === 'checked' || k === 'disabled' || k === 'selected' || k === 'hidden' || k === 'required') && !isSvg) el[k] = !!v;
    else el.setAttribute(k, v === true ? '' : v);
  }
}
function append(el, children) {
  for (const c of children.flat(Infinity)) {
    if (c == null || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
}
export const clear = (el) => { while (el.firstChild) el.removeChild(el.firstChild); return el; };
export const $ = (sel, root = document) => root.querySelector(sel);

const ICONS = {
  dashboard: 'M3 11.5 12 4l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z',
  expenses: 'M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM3 10h18M7 15h4',
  budget: 'M12 3a9 9 0 1 0 9 9h-9zM15 3.5A9 9 0 0 1 20.5 9H15z',
  goals: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 16.5a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9zM12 12.5a.5.5 0 1 0 0-1 .5.5 0 0 0 0 1z',
  settings: 'M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM19.4 13.5a7.7 7.7 0 0 0 0-3l2-1.6-2-3.4-2.4 1a7.6 7.6 0 0 0-2.6-1.5L14 2.5h-4l-.4 2.5A7.6 7.6 0 0 0 7 6.5l-2.4-1-2 3.4 2 1.6a7.7 7.7 0 0 0 0 3l-2 1.6 2 3.4 2.4-1a7.6 7.6 0 0 0 2.6 1.5l.4 2.5h4l.4-2.5a7.6 7.6 0 0 0 2.6-1.5l2.4 1 2-3.4z',
  recurring: 'M17 2l4 4-4 4M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4M21 13v2a3 3 0 0 1-3 3H3',
  insights: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
  history: 'M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5M12 7v5l3 2',
  planner: 'M5 3h14a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zM8 7h8M8 12h2M12 12h2M16 12h0M8 16h2M12 16h2M16 16h0',
  plus: 'M12 5v14M5 12h14',
  close: 'M6 6l12 12M18 6 6 18',
  trash: 'M4 7h16M10 11v6M14 11v6M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13M9 7V4h6v3',
  edit: 'M4 20h4L19 9l-4-4L4 16zM14 6l4 4',
  chevL: 'M15 5l-7 7 7 7',
  chevR: 'M9 5l7 7-7 7',
  up: 'M12 19V5M5 12l7-7 7 7',
  down: 'M12 5v14M19 12l-7 7-7-7',
  download: 'M12 4v11M7 11l5 5 5-5M5 20h14',
  upload: 'M12 16V5M7 9l5-5 5 5M5 20h14',
  lock: 'M6 11h12v9H6zM8 11V8a4 4 0 0 1 8 0v3',
  warn: 'M12 3 2 20h20zM12 10v4M12 17h0',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  grip: 'M9 6h0M9 12h0M9 18h0M15 6h0M15 12h0M15 18h0',
  camera: 'M4 8h3l2-3h6l2 3h3v11H4zM12 17a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z',
  bell: 'M6 9a6 6 0 0 1 12 0c0 6 2 7 2 7H4s2-1 2-7zM10 20a2 2 0 0 0 4 0',
  moon: 'M20 14.5A8.5 8.5 0 0 1 9.5 4 8.5 8.5 0 1 0 20 14.5z',
  sun: 'M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4',
  search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-4-4',
  info: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 11v5M12 8h0',
  more: 'M5 12h0M12 12h0M19 12h0',
};
export function icon(name, size = 20) {
  return s('svg', { viewBox: '0 0 24 24', width: size, height: size, fill: 'none', stroke: 'currentColor', 'stroke-width': 1.8, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true', class: 'icon' }, s('path', { d: ICONS[name] || ICONS.info }));
}

/* ───── toast ───── */
let toastHost;
export function toast(message, { action, onAction, kind = 'info', timeout = 4500 } = {}) {
  if (!toastHost) { toastHost = h('div', { class: 'toasts', role: 'status', 'aria-live': 'polite' }); document.body.append(toastHost); }
  const t = h('div', { class: 'toast ' + kind }, h('span', null, message));
  if (action) t.append(h('button', { class: 'btn small ghost', onclick: () => { onAction?.(); t.remove(); } }, action));
  toastHost.append(t);
  setTimeout(() => t.remove(), timeout);
}

/* ───── modal / sheet ───── */
const openModals = [];
export function modal({ title, body, footer, wide = false, onClose, labelledBy }) {
  const opener = document.activeElement;
  const titleId = 'm' + Math.random().toString(36).slice(2, 8);
  const dialog = h('div', { class: 'modal glass' + (wide ? ' wide' : ''), role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': titleId },
    h('header', { class: 'modal-head' }, h('h2', { id: titleId }, title), h('button', { class: 'icon-btn', 'aria-label': 'Close', onclick: () => api.close() }, icon('close'))),
    h('div', { class: 'modal-body' }, body),
    footer ? h('footer', { class: 'modal-foot' }, footer) : null);
  const backdrop = h('div', { class: 'backdrop', onmousedown: (e) => { if (e.target === backdrop) api.close(); } }, dialog);
  const appRoot = document.getElementById('app');
  const onKey = (e) => {
    if (openModals[openModals.length - 1] !== api) return;
    if (e.key === 'Escape') { e.preventDefault(); api.close(); }
    if (e.key === 'Tab') {
      const f = [...dialog.querySelectorAll('a[href],button:not([disabled]),input:not([disabled]):not([type=hidden]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])')].filter((x) => x.offsetParent !== null);
      if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  };
  const api = {
    el: dialog,
    close(result) {
      if (!backdrop.isConnected) return;
      document.removeEventListener('keydown', onKey, true);
      openModals.splice(openModals.indexOf(api), 1);
      backdrop.classList.add('closing');
      setTimeout(() => backdrop.remove(), 140);
      if (!openModals.length) { document.body.classList.remove('modal-open'); appRoot?.removeAttribute('inert'); }
      onClose?.(result);
      if (opener && opener.focus && document.contains(opener)) opener.focus();
    },
  };
  openModals.push(api);
  document.body.append(backdrop);
  document.body.classList.add('modal-open');
  appRoot?.setAttribute('inert', '');
  document.addEventListener('keydown', onKey, true);
  requestAnimationFrame(() => {
    const auto = dialog.querySelector('[data-autofocus]') || dialog.querySelector('input,select,textarea,button:not(.icon-btn)');
    auto?.focus();
  });
  return api;
}
export const anyModalOpen = () => openModals.length > 0;

export function confirmDialog({ title, text, confirmLabel = 'Confirm', danger = false }) {
  return new Promise((resolve) => {
    let done = false;
    const finish = (v) => { if (done) return; done = true; m.close(); resolve(v); };
    const m = modal({
      title, body: h('p', { class: 'muted' }, text),
      footer: [h('button', { class: 'btn ghost', onclick: () => finish(false) }, 'Cancel'), h('button', { class: 'btn ' + (danger ? 'danger' : 'primary'), 'data-autofocus': '', onclick: () => finish(true) }, confirmLabel)],
      onClose: () => { if (!done) { done = true; resolve(false); } },
    });
  });
}

/* ───── form helpers ───── */
let fid = 0;
export function field(label, input, { hint, error } = {}) {
  const id = input.id || (input.id = 'f' + ++fid);
  const err = h('div', { class: 'field-error', id: id + '-err', role: 'alert' }, error || '');
  input.setAttribute('aria-describedby', id + '-err' + (hint ? ' ' + id + '-hint' : ''));
  const w = h('div', { class: 'field' }, h('label', { for: id }, label), input, hint ? h('div', { class: 'hint', id: id + '-hint' }, hint) : null, err);
  w.setError = (msg) => { err.textContent = msg || ''; input.toggleAttribute('aria-invalid', !!msg); w.classList.toggle('invalid', !!msg); };
  return w;
}
export function moneyInput({ value = '', placeholder = '0.00', big = false, ...rest } = {}) {
  return h('input', { type: 'text', inputmode: 'decimal', autocomplete: 'off', class: 'input' + (big ? ' big' : ''), placeholder, value, ...rest });
}
export function selectEl(options, value, props = {}) {
  const sel = h('select', { class: 'input', ...props }, options.map((o) => { const [v, l] = Array.isArray(o) ? o : [o, o]; return h('option', { value: v, selected: v === value }, l); }));
  sel.value = value;
  return sel;
}
export function segmented(options, value, onChange, label) {
  const wrap = h('div', { class: 'segmented', role: 'radiogroup', 'aria-label': label });
  const render = (v) => {
    clear(wrap);
    options.forEach(([val, text]) => {
      const b = h('button', { type: 'button', role: 'radio', 'aria-checked': String(v === val), class: v === val ? 'on' : '', onclick: () => { value = val; render(val); onChange(val); } }, text);
      wrap.append(b);
    });
  };
  render(value);
  wrap.get = () => value;
  return wrap;
}
export function emptyState({ icon: ic = '📭', title, text, action }) {
  return h('div', { class: 'empty' }, h('div', { class: 'empty-icon', 'aria-hidden': 'true' }, ic), h('h3', null, title), h('p', { class: 'muted' }, text), action || null);
}
export function download(filename, text, type = 'text/plain') {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = h('a', { href: url, download: filename });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
export const debounce = (fn, ms = 150) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
