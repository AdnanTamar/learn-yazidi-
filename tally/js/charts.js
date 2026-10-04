// Small dependency-free charts (SVG / HTML). Colors come from CSS variables so light/dark just work.
import { h, s, clear } from './ui.js';
import { dow, weekdayName } from './dates.js';

/* ───── tooltip ───── */
let tipEl;
function tip() {
  if (!tipEl) { tipEl = h('div', { class: 'tooltip', role: 'tooltip', hidden: true }); document.body.append(tipEl); }
  return tipEl;
}
export function showTip(content, x, y) {
  const t = tip();
  clear(t).append(...[].concat(content));
  t.hidden = false;
  const r = t.getBoundingClientRect();
  const left = Math.min(window.innerWidth - r.width - 8, Math.max(8, x - r.width / 2));
  const top = y - r.height - 12 < 8 ? y + 18 : y - r.height - 12;
  t.style.transform = `translate(${Math.round(left)}px, ${Math.round(top)}px)`;
}
export function hideTip() { if (tipEl) tipEl.hidden = true; }
document.addEventListener('pointerdown', (e) => { if (!e.target.closest?.('[data-tip]')) hideTip(); }, true);
const tipLines = (title, rows) => [h('strong', null, title), ...rows.map((r) => h('div', { class: 'tip-row' }, r.color ? h('i', { style: { background: r.color } }) : null, h('span', null, r.label), h('b', null, r.value)))];
export { tipLines };

/** Re-render fn(width) whenever the container width changes. */
function responsive(host, render) {
  let last = 0;
  const run = () => { const w = Math.round(host.clientWidth); if (w && w !== last) { last = w; clear(host); host.append(render(w)); } };
  if ('ResizeObserver' in window) new ResizeObserver(run).observe(host); else window.addEventListener('resize', run);
  requestAnimationFrame(run);
  return host;
}

/* ───── donut ───── */
export function createDonut({ size = 220, thickness = 26 } = {}) {
  const R = (200 - thickness) / 2 - 2, C = 2 * Math.PI * R;
  const ring = s('g', { transform: 'rotate(-90 100 100)' });
  const track = s('circle', { cx: 100, cy: 100, r: R, fill: 'none', 'stroke-width': thickness, class: 'donut-track' });
  const cTop = h('div', { class: 'donut-top' }), cMain = h('div', { class: 'donut-main' }), cSub = h('div', { class: 'donut-sub' });
  const center = h('div', { class: 'donut-center', 'aria-live': 'polite' }, cTop, cMain, cSub);
  const svg = s('svg', { viewBox: '0 0 200 200', class: 'donut-svg', role: 'group', 'aria-label': 'Salary distribution' }, track, ring);
  const el = h('div', { class: 'donut', style: { maxWidth: size + 'px' } }, svg, center);
  let cfg = null, active = null;
  const showCenter = (seg) => {
    if (seg) { cTop.textContent = seg.label; cMain.textContent = seg.valueText; cSub.textContent = seg.subText || ''; cMain.className = 'donut-main'; }
    else { cTop.textContent = cfg.centerTop || ''; cMain.textContent = cfg.centerMain || ''; cSub.textContent = cfg.centerSub || ''; cMain.className = 'donut-main' + (cfg.centerClass ? ' ' + cfg.centerClass : ''); }
  };
  const setActive = (id) => {
    active = id;
    ring.classList.toggle('has-active', !!id);
    [...ring.children].forEach((c) => c.classList.toggle('active', c.dataset.id === id));
    showCenter(id ? cfg.segments.find((x) => x.id === id) : null);
  };
  function update(next) {
    cfg = next;
    const segs = next.segments.filter((x) => x.value > 0);
    const total = Math.max(next.total, segs.reduce((a, x) => a + x.value, 0)) || 1;
    const existing = new Map([...ring.children].map((c) => [c.dataset.id, c]));
    let offset = 0;
    const gap = segs.length > 1 ? 1.4 : 0;
    segs.forEach((seg) => {
      let c = existing.get(seg.id);
      if (!c) {
        c = s('circle', { cx: 100, cy: 100, r: R, fill: 'none', 'stroke-width': thickness, class: 'donut-seg', 'data-id': seg.id, 'data-tip': '', tabindex: 0, role: 'img', 'stroke-dasharray': `0 ${C}` });
        c.addEventListener('pointerenter', () => setActive(seg.id));
        c.addEventListener('pointerleave', () => { setActive(null); hideTip(); });
        c.addEventListener('focus', () => setActive(seg.id));
        c.addEventListener('blur', () => setActive(null));
        c.addEventListener('click', () => { const sg = cfg.segments.find((x) => x.id === c.dataset.id); sg && cfg.onSelect?.(sg.id); });
        c.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); cfg.onSelect?.(c.dataset.id); } });
        ring.append(c);
      }
      existing.delete(seg.id);
      const len = Math.max(0, (seg.value / total) * C - gap);
      c.setAttribute('stroke', seg.color);
      c.setAttribute('stroke-dasharray', `${len} ${C - len}`);
      c.setAttribute('stroke-dashoffset', String(-offset));
      c.setAttribute('aria-label', `${seg.label}: ${seg.valueText}${seg.subText ? ', ' + seg.subText : ''}`);
      c.classList.toggle('striped', !!seg.muted);
      c.classList.toggle('clickable', !!next.onSelect);
      offset += (seg.value / total) * C;
    });
    existing.forEach((c) => c.remove());
    el.classList.toggle('over', !!next.over);
    svg.setAttribute('aria-label', next.ariaLabel || 'Salary distribution');
    showCenter(active && next.segments.find((x) => x.id === active) ? next.segments.find((x) => x.id === active) : null);
  }
  return { el, update };
}

/* ───── bar chart (HTML columns, selective labels) ───── */
export function barChart({ data, fmt, height = 170, max, line, lineLabel = 'Income', ariaLabel = 'Bar chart', onSelect, highlightKey }) {
  const top = max || Math.max(1, ...data.map((d) => d.value), ...(line || []).filter((v) => v != null)) * 1.08;
  const maxIdx = data.reduce((bi, d, i, a) => (d.value > a[bi].value ? i : bi), 0);
  const cols = data.map((d, i) => {
    const pct = Math.max(d.value > 0 ? 2 : 0, (d.value / top) * 100);
    const col = h('button', {
      type: 'button', class: 'bar-col' + (d.key === highlightKey ? ' current' : '') + (d.empty ? ' empty' : ''), 'data-tip': '',
      'aria-label': `${d.label}: ${fmt(d.value)}${d.sub ? ', ' + d.sub : ''}`,
      onclick: () => onSelect?.(d.key),
      onpointerenter: (e) => { const r = col.getBoundingClientRect(); showTip(tipLines(d.label, [{ label: d.tipLabel || 'Spent', value: fmt(d.value), color: 'var(--accent)' }, ...(line && line[i] ? [{ label: lineLabel, value: fmt(line[i]) }] : []), ...(d.sub ? [{ label: d.sub, value: '' }] : [])]), r.left + r.width / 2, r.top); },
      onpointerleave: hideTip, onfocus: () => { const r = col.getBoundingClientRect(); showTip(tipLines(d.label, [{ label: d.tipLabel || 'Spent', value: fmt(d.value) }]), r.left + r.width / 2, r.top); }, onblur: hideTip,
    },
    h('span', { class: 'bar-val' }, d.value > 0 && (i === maxIdx || d.key === highlightKey) ? fmt(d.value, true) : ''),
    h('span', { class: 'bar-track', style: { height: height + 'px' } },
      line && line[i] ? h('i', { class: 'bar-line', style: { bottom: Math.min(100, (line[i] / top) * 100) + '%' } }) : null,
      h('span', { class: 'bar', style: { height: pct + '%' } })),
    h('span', { class: 'bar-label' }, d.short || d.label));
    return col;
  });
  return h('div', { class: 'bars', role: 'group', 'aria-label': ariaLabel, style: { '--n': data.length } }, cols,
    line ? h('div', { class: 'chart-legend' }, h('span', null, h('i', { class: 'sw bar-sw' }), data[0]?.tipLabel || 'Spent'), h('span', null, h('i', { class: 'sw line-sw' }), lineLabel)) : null);
}

/* ───── line chart ───── */
export function lineChart({ labels, series, fmt, height = 210, yMax, ariaLabel = 'Line chart', xEvery = 1 }) {
  const host = h('div', { class: 'linechart', role: 'group', 'aria-label': ariaLabel });
  const legend = series.length > 1 ? h('div', { class: 'chart-legend' }, series.map((x) => h('span', null, h('i', { class: 'sw', style: { background: x.color, borderTop: x.dash ? '2px dashed ' + x.color : '' } }), x.label))) : null;
  const box = h('div', { class: 'linebox' });
  host.append(box); if (legend) host.append(legend);
  responsive(box, (W) => {
    const m = { l: 44, r: 12, t: 10, b: 24 }, iw = W - m.l - m.r, ih = height - m.t - m.b;
    const all = series.flatMap((x) => x.points.filter((p) => p != null));
    const top = yMax || Math.max(1, ...all) * 1.1;
    const n = labels.length;
    const X = (i) => m.l + (n <= 1 ? iw / 2 : (i / (n - 1)) * iw), Y = (v) => m.t + ih - (v / top) * ih;
    const svg = s('svg', { viewBox: `0 0 ${W} ${height}`, width: W, height, class: 'line-svg' });
    for (let g = 0; g <= 3; g++) {
      const v = (top / 3) * g, y = Y(v);
      svg.append(s('line', { x1: m.l, x2: W - m.r, y1: y, y2: y, class: 'grid' }), s('text', { x: m.l - 6, y: y + 3.5, 'text-anchor': 'end', class: 'axis' }, fmt(Math.round(v), true)));
    }
    labels.forEach((l, i) => { if (i % xEvery === 0 || i === n - 1) svg.append(s('text', { x: X(i), y: height - 6, 'text-anchor': 'middle', class: 'axis' }, l)); });
    for (const ser of series) {
      let d = '';
      ser.points.forEach((p, i) => { if (p == null) return; d += (d && ser.points[i - 1] != null ? 'L' : 'M') + X(i).toFixed(1) + ' ' + Y(p).toFixed(1); });
      svg.append(s('path', { d, fill: 'none', stroke: ser.color, 'stroke-width': 2, 'stroke-dasharray': ser.dash ? '5 4' : null, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }));
      const last = ser.points.map((p, i) => (p != null ? i : -1)).filter((i) => i >= 0).pop();
      if (last != null) svg.append(s('circle', { cx: X(last), cy: Y(ser.points[last]), r: 4, fill: ser.color, stroke: 'var(--surface)', 'stroke-width': 2 }));
    }
    const cross = s('line', { y1: m.t, y2: m.t + ih, class: 'cross', visibility: 'hidden' });
    const dots = series.map((x) => s('circle', { r: 4.5, fill: x.color, stroke: 'var(--surface)', 'stroke-width': 2, visibility: 'hidden' }));
    svg.append(cross, ...dots);
    const hit = s('rect', { x: m.l, y: m.t, width: iw, height: ih, fill: 'transparent', 'data-tip': '', tabindex: 0, role: 'img', 'aria-label': ariaLabel + '. Use left and right arrow keys to read values.' });
    const at = (i, clientX, clientY) => {
      i = Math.max(0, Math.min(n - 1, i));
      cross.setAttribute('x1', X(i)); cross.setAttribute('x2', X(i)); cross.setAttribute('visibility', 'visible');
      series.forEach((x, k) => { if (x.points[i] != null) { dots[k].setAttribute('cx', X(i)); dots[k].setAttribute('cy', Y(x.points[i])); dots[k].setAttribute('visibility', 'visible'); } });
      const r = svg.getBoundingClientRect();
      showTip(tipLines(labels[i], series.filter((x) => x.points[i] != null).map((x) => ({ label: x.label, value: fmt(x.points[i]), color: x.color }))), clientX ?? r.left + X(i), clientY ?? r.top + m.t + 20);
    };
    const idxFrom = (e) => { const r = svg.getBoundingClientRect(); return Math.round(((e.clientX - r.left - m.l) / iw) * (n - 1)); };
    let cur = n - 1;
    hit.addEventListener('pointermove', (e) => { cur = idxFrom(e); at(cur, e.clientX, e.clientY); });
    hit.addEventListener('pointerdown', (e) => { cur = idxFrom(e); at(cur, e.clientX, e.clientY); });
    hit.addEventListener('pointerleave', () => { hideTip(); cross.setAttribute('visibility', 'hidden'); dots.forEach((d) => d.setAttribute('visibility', 'hidden')); });
    hit.addEventListener('keydown', (e) => { if (e.key === 'ArrowLeft') { cur = Math.max(0, cur - 1); at(cur); e.preventDefault(); } if (e.key === 'ArrowRight') { cur = Math.min(n - 1, cur + 1); at(cur); e.preventDefault(); } });
    hit.addEventListener('blur', () => { hideTip(); cross.setAttribute('visibility', 'hidden'); });
    svg.append(hit);
    return svg;
  });
  return host;
}

/* ───── calendar heatmap (one hue, light -> dark) ───── */
export function calendarHeat({ ym, values, fmt, locale = 'en', onSelect }) {
  const [y, m] = ym.split('-').map(Number);
  const first = ym + '-01';
  const lead = (dow(first) + 6) % 7; // Monday first
  const max = Math.max(1, ...values);
  const level = (v) => (v <= 0 ? 0 : Math.min(4, 1 + Math.floor((v / max) * 4 - 1e-9)));
  const head = [1, 2, 3, 4, 5, 6, 0].map((d) => h('div', { class: 'heat-dow' }, weekdayName(d, locale, 'narrow')));
  const cells = [];
  for (let i = 0; i < lead; i++) cells.push(h('div', { class: 'heat-cell blank' }));
  values.forEach((v, i) => {
    const day = i + 1, date = `${ym}-${String(day).padStart(2, '0')}`;
    const c = h('button', {
      type: 'button', class: 'heat-cell l' + level(v), 'data-tip': '', 'aria-label': `${date}: ${fmt(v)}`, onclick: () => onSelect?.(date),
      onpointerenter: () => { const r = c.getBoundingClientRect(); showTip(tipLines(date, [{ label: 'Spent', value: fmt(v) }]), r.left + r.width / 2, r.top); }, onpointerleave: hideTip,
      onfocus: () => { const r = c.getBoundingClientRect(); showTip(tipLines(date, [{ label: 'Spent', value: fmt(v) }]), r.left + r.width / 2, r.top); }, onblur: hideTip,
    }, h('span', null, String(day)));
    cells.push(c);
  });
  const legend = h('div', { class: 'heat-legend' }, h('span', null, 'Less'), [0, 1, 2, 3, 4].map((l) => h('i', { class: 'heat-cell l' + l })), h('span', null, 'More'));
  return h('div', { class: 'heat' }, h('div', { class: 'heat-grid' }, head, cells), legend);
}

/* ───── progress bar ───── */
export function progress(pct, { color = 'var(--accent)', over = false, label } = {}) {
  const w = Math.max(0, Math.min(100, pct));
  return h('div', { class: 'progress' + (over ? ' over' : ''), role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-valuenow': Math.round(Math.min(pct, 999)), 'aria-label': label }, h('span', { style: { width: w + '%', background: over ? 'var(--bad)' : color } }));
}
