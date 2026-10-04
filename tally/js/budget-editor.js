// Budget editor shared by the setup wizard (draft model) and the Budget page (live model).
import { h, icon, clear, toast } from './ui.js';
import { parseMoney, parsePercent, toInput, bpToInput, amountToBp } from './money.js';
import { budgetAmount, budgetBp, planIncome } from './calc.js';
import { money, pct } from './ctx.js';

const KIND_LABEL = { fixed: 'Fixed', variable: 'Variable', savings: 'Savings' };

/**
 * model = {
 *   categories(): Category[], plan(): {sources, budgets},
 *   setBudget(id, mode, value), move(id, index), edit(cat), add(),
 *   info?(id) -> {spent, remaining, usage} (live mode)
 * }
 */
export function budgetEditor({ model, onChange }) {
  const list = h('div', { class: 'list', role: 'list' });
  const rows = new Map();
  let dragId = null;

  const income = () => planIncome(model.plan());

  function sync(id) {
    const r = rows.get(id); if (!r) return;
    const plan = model.plan();
    const b = plan.budgets[id] || { mode: 'amount', value: 0 };
    const amt = budgetAmount(plan, id), bp = budgetBp(plan, id);
    if (document.activeElement !== r.amount) r.amount.value = amt ? toInput(amt) : (b.mode === 'amount' ? '0' : '0');
    if (document.activeElement !== r.pct) r.pct.value = bpToInput(bp);
    if (document.activeElement !== r.range) r.range.value = Math.min(50, bp / 100);
    r.amountWrap.classList.toggle('mode-on', b.mode === 'amount');
    r.pctWrap.classList.toggle('mode-on', b.mode === 'percent');
    r.modeBtn.textContent = b.mode === 'percent' ? '% of salary · follows your income' : 'Fixed amount · stays the same';
    r.modeBtn.setAttribute('aria-label', `Budget is ${b.mode === 'percent' ? 'a percentage of salary' : 'a fixed amount'}. Switch.`);
    if (model.info) {
      const i = model.info(id);
      r.info.textContent = i ? `Spent ${money(i.spent)} · ${i.remaining >= 0 ? money(i.remaining) + ' left' : money(-i.remaining) + ' over'}` : '';
      r.info.className = 'small ' + (i && i.remaining < 0 ? 'bad' : 'muted');
    }
  }
  const syncAll = () => model.categories().forEach((c) => sync(c.id));

  function commit(id, mode, value) {
    model.setBudget(id, mode, value);
    sync(id);
    onChange?.();
  }

  function build() {
    clear(list); rows.clear();
    const cats = model.categories();
    cats.forEach((c, idx) => {
      const err = h('div', { class: 'field-error', role: 'alert' });
      const amount = h('input', { class: 'input compact', type: 'text', inputmode: 'decimal', 'aria-label': `${c.name} budget amount`, autocomplete: 'off' });
      const pctIn = h('input', { class: 'input compact', type: 'text', inputmode: 'decimal', 'aria-label': `${c.name} percentage of salary`, autocomplete: 'off' });
      const range = h('input', { type: 'range', min: 0, max: 50, step: 0.5, 'aria-label': `${c.name} percentage slider` });
      amount.addEventListener('input', () => {
        const v = parseMoney(amount.value);
        if (amount.value.trim() === '') return commit(c.id, 'amount', 0), (err.textContent = '');
        if (!Number.isFinite(v) || v < 0) { err.textContent = 'Enter a valid amount.'; return; }
        err.textContent = ''; commit(c.id, 'amount', v);
      });
      pctIn.addEventListener('input', () => {
        const v = parsePercent(pctIn.value);
        if (pctIn.value.trim() === '') return commit(c.id, 'percent', 0), (err.textContent = '');
        if (!Number.isFinite(v) || v < 0 || v > 10000) { err.textContent = 'Enter a percentage between 0 and 100.'; return; }
        err.textContent = ''; commit(c.id, 'percent', v);
      });
      range.addEventListener('input', () => { err.textContent = ''; commit(c.id, 'percent', Math.round(Number(range.value) * 100)); });
      [amount, pctIn].forEach((el) => el.addEventListener('blur', () => { err.textContent = ''; sync(c.id); }));
      const modeBtn = h('button', { type: 'button', class: 'link small', onclick: () => {
        const plan = model.plan(); const b = plan.budgets[c.id] || { mode: 'amount', value: 0 };
        if (b.mode === 'percent') commit(c.id, 'amount', budgetAmount(plan, c.id));
        else commit(c.id, 'percent', Math.min(10000, amountToBp(b.value, income())));
      } });
      const amountWrap = h('div', { class: 'input-affix' }, amount, h('span', null, ''));
      const pctWrap = h('div', { class: 'input-affix' }, pctIn, h('span', null, '%'));
      amountWrap.lastChild.textContent = (money(0).replace(/[\d.,\s]/g, '') || '€').trim();
      const info = h('div', { class: 'small muted' });
      const row = h('div', { class: 'budget-row', role: 'listitem', 'data-id': c.id },
        h('div', { class: 'drag-handle', draggable: 'false', title: 'Drag to reorder', 'aria-hidden': 'true', onpointerdown: () => { row.draggable = true; }, onpointerup: () => { row.draggable = false; } }, icon('grip')),
        h('div', null,
          h('div', { class: 'head' },
            h('button', { type: 'button', class: 'name', onclick: () => model.edit(c), 'aria-label': `Edit category ${c.name}` }, `${c.icon} ${c.name}`),
            h('span', { class: 'badge mute' }, KIND_LABEL[c.kind] || c.kind),
            h('button', { type: 'button', class: 'icon-btn', 'aria-label': `Move ${c.name} up`, disabled: idx === 0, onclick: () => { model.move(c.id, idx - 1); build(); onChange?.(true); } }, icon('up', 16)),
            h('button', { type: 'button', class: 'icon-btn', 'aria-label': `Move ${c.name} down`, disabled: idx === cats.length - 1, onclick: () => { model.move(c.id, idx + 1); build(); onChange?.(true); } }, icon('down', 16))),
          h('div', { class: 'fields' }, amountWrap, pctWrap),
          range, err, modeBtn, info));
      row.addEventListener('dragstart', (e) => { dragId = c.id; row.classList.add('dragging'); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', c.id); });
      row.addEventListener('dragend', () => { dragId = null; row.draggable = false; row.classList.remove('dragging'); list.querySelectorAll('.drop-before').forEach((x) => x.classList.remove('drop-before')); });
      row.addEventListener('dragover', (e) => { if (!dragId || dragId === c.id) return; e.preventDefault(); row.classList.add('drop-before'); });
      row.addEventListener('dragleave', () => row.classList.remove('drop-before'));
      row.addEventListener('drop', (e) => {
        e.preventDefault(); row.classList.remove('drop-before');
        if (!dragId || dragId === c.id) return;
        const from = model.categories().findIndex((x) => x.id === dragId);
        let to = model.categories().findIndex((x) => x.id === c.id);
        if (from < to) to -= 1; // drop = insert before the target row
        model.move(dragId, to); build(); onChange?.(true);
      });
      rows.set(c.id, { amount, pct: pctIn, range, amountWrap, pctWrap, modeBtn, info });
      list.append(row);
    });
    syncAll();
  }
  build();
  const el = h('div', null, list,
    h('div', { style: { marginTop: '12px' } }, h('button', { class: 'btn', onclick: () => model.add() }, icon('plus', 16), 'Add category')));
  return { el, refresh: syncAll, rebuild: build };
}

/** Allocated / unallocated meter: stacked bar + plain-language explanation. */
export function allocationMeter(alloc, categories) {
  const income = alloc.income || 1;
  const bar = h('div', { class: 'alloc-bar', role: 'img', 'aria-label': `Allocated ${Math.round(alloc.allocatedBp / 100)}% of income` },
    alloc.rows.filter((r) => r.amount > 0).map((r) => h('i', { style: { width: Math.min(100, (r.amount / Math.max(income, alloc.allocated)) * 100) + '%', background: r.cat.color }, title: `${r.cat.name} ${money(r.amount)}` })));
  const over = alloc.over, un = alloc.unallocated;
  return h('div', null,
    h('div', { class: 'row spread wrap', style: { marginBottom: '8px' } },
      h('div', null, h('div', { class: 'small muted' }, 'Allocated'), h('b', { style: { fontSize: '20px' } }, money(alloc.allocated)), h('span', { class: 'muted small' }, ` · ${pct(alloc.allocatedBp / 100)}`)),
      h('div', { style: { textAlign: 'right' } }, h('div', { class: 'small muted' }, over ? 'Over-allocated' : 'Unallocated'), h('b', { style: { fontSize: '20px' }, class: over ? 'bad' : un > 0 ? 'warn' : 'good' }, money(over ? -un : un)))),
    bar,
    over
      ? h('div', { class: 'banner bad', role: 'alert', style: { marginTop: '12px' } }, icon('warn'), h('div', { class: 'grow' }, h('b', null, `Your budget is ${money(-un)} more than your income.`), 'You have planned to spend money you do not have. Lower some categories until this reads “Unallocated”.'))
      : un > 0
        ? h('div', { class: 'banner', style: { marginTop: '12px' } }, icon('info'), h('div', { class: 'grow' }, h('b', null, `${money(un)} has not been assigned yet.`), 'Unassigned money tends to disappear into small purchases. Give it a job (savings, a goal, a category) or keep it as a buffer.'))
        : h('div', { class: 'banner good', style: { marginTop: '12px' } }, icon('check'), h('div', { class: 'grow' }, h('b', null, 'Your whole income has a job.'), 'Nothing is left unassigned.')));
}

import { createDonut } from './charts.js';
import { fmt as _f } from './money.js';

/** Donut + legend for a plan allocation. Returns {el, update(alloc, {onSelect})}. */
export function allocationDonut() {
  const donut = createDonut({ size: 260 });
  const legend = h('div', { class: 'legend' });
  let hl = null;
  const wrap = h('div', { class: 'alloc-split' }, h('div', { class: 'donut-wrap' }, donut.el), legend);
  function update(alloc, { onSelect } = {}) {
    const inc = alloc.income || 0;
    const segs = alloc.rows.filter((r) => r.amount > 0).map((r) => ({ id: r.cat.id, label: r.cat.name, value: r.amount, color: r.cat.color, valueText: money(r.amount), subText: pct(Math.round((r.amount / (inc || 1)) * 1000) / 10) + ' of income' }));
    if (alloc.unallocated > 0) segs.push({ id: '_un', label: 'Unallocated', value: alloc.unallocated, color: 'var(--muted)', muted: true, valueText: money(alloc.unallocated), subText: 'not assigned yet' });
    donut.update({
      segments: segs, total: inc, over: alloc.over, onSelect: onSelect && ((id) => id !== '_un' && onSelect(id)),
      centerTop: alloc.over ? 'Over-allocated' : 'Allocated', centerMain: alloc.over ? money(-alloc.unallocated) : money(alloc.allocated), centerClass: alloc.over ? 'bad' : '',
      centerSub: alloc.over ? 'more than your income' : `of ${money(inc)}`, ariaLabel: `Salary distribution. Allocated ${money(alloc.allocated)} of ${money(inc)}.`,
    });
    clear(legend);
    segs.forEach((sg) => legend.append(h('div', { class: 'legend-row' }, h('i', { style: { background: sg.color, opacity: sg.muted ? 0.45 : 1 } }), h('span', null, sg.label), h('span', { class: 'p' }, pct(Math.round((sg.value / (inc || 1)) * 1000) / 10)), h('b', null, money(sg.value)))));
  }
  return { el: wrap, update };
}
