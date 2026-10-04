import { h, icon, clear, field, moneyInput, selectEl, toast, confirmDialog, segmented, emptyState } from '../ui.js';
import * as store from '../store.js';
import { ui, cs, state, money, pct, monthName, isCurrent, rerender, today, catOf } from '../ctx.js';
import { monthSummary, allocation, planFor, evaluateRules, ruleText, RULE_TYPES, planIncome, ensureMonth } from '../calc.js';
import { monthSwitcher, openIncomeModal, openCategoryModal, avatar, statCard } from '../components.js';
import { budgetEditor, allocationMeter, allocationDonut } from '../budget-editor.js';
import { progress } from '../charts.js';
import { parseMoney, toInput } from '../money.js';

/** One category row with usage bar and honest overspending warning. */
export function categoryRow(c, { onClick } = {}) {
  const cat = c.cat, saving = cat.kind === 'savings';
  const noBudget = c.budget === 0;
  const usage = noBudget ? 0 : c.usage;
  const over = !saving && c.spent > c.budget;
  const row = h(onClick ? 'button' : 'div', { class: 'cat-row' + (onClick ? ' item' : ''), type: onClick ? 'button' : null, onclick: onClick, style: onClick ? { display: 'block', width: '100%' } : null },
    h('div', { class: 'top' }, avatar(cat, 36), h('div', { class: 'grow' }, h('div', { style: { fontWeight: 650 } }, cat.name), h('div', { class: 'small muted' }, noBudget ? 'No budget set' : saving ? t('Saved {a} of {b}', { a: money(c.spent), b: money(c.budget) }) : `${money(c.spent)} / ${money(c.budget)}`)),
      noBudget ? (c.spent > 0 ? h('span', { class: 'badge warn' }, 'No budget') : null) : h('b', { class: over ? 'bad' : '' }, pct(c.usage))),
    progress(usage, { color: saving ? 'var(--good)' : cat.color, over, label: t('{name} usage', { name: cat.name }) }),
    noBudget ? null : h('div', { class: 'nums' }, h('span', null, saving ? (c.remaining > 0 ? t('{amount} still to save', { amount: money(c.remaining) }) : 'Goal reached') : c.remaining >= 0 ? t('{amount} left', { amount: money(c.remaining) }) : ''), h('span', null, t('{p} remaining', { p: pct(Math.max(0, c.remainingPct)) }))),
    over ? h('div', { class: 'warnline', role: 'alert' }, icon('warn', 16), noBudget ? t('{name}: {amount} spent with no budget.', { name: cat.name, amount: money(c.spent) }) : t('{name} is {amount} over budget.', { name: cat.name, amount: money(c.overBy) })) : null);
  return row;
}

const GROUPS = [['fixed', 'Fixed expenses', 'Same every month — hardest to reduce'], ['variable', 'Variable expenses', 'You control these — easiest to reduce'], ['savings', 'Savings', 'Money you set aside']];

export function renderBudget() {
  const tabKey = 'budget';
  const st = cs();
  const hasAny = st.expenses.some((e) => e.date.startsWith(ui.ym));
  ui.tab[tabKey] = ui.tab[tabKey] || (hasAny ? 'breakdown' : 'plan');
  const tab = ui.tab[tabKey];
  const page = h('div', { class: 'page' });
  page.append(h('div', { class: 'page-head' }, h('div', null, h('h1', null, 'Budget'), h('div', { class: 'sub' }, t('Plan vs. reality for {month}', { month: monthName(ui.ym) }))), monthSwitcher()),
    h('div', { style: { marginBottom: '14px' } }, segmented([['breakdown', 'Spending'], ['plan', 'Plan'], ['rules', 'Rules']], tab, (v) => { ui.tab[tabKey] = v; rerender(); }, 'Budget view')));
  page.append(tab === 'breakdown' ? breakdown(st) : tab === 'plan' ? plan(st) : rules(st));
  return page;
}

function breakdown(st) {
  const s = monthSummary(st, ui.ym);
  const wrap = h('div', { class: 'stack' });
  if (!s.income) wrap.append(h('div', { class: 'banner warn' }, icon('warn'), h('div', { class: 'grow' }, h('b', null, 'No income for this month'), 'Add your income to see budgets and percentages.', h('div', null, h('button', { class: 'btn small', style: { marginTop: '8px' }, onclick: () => openIncomeModal() }, 'Add income')))));
  const overs = s.cats.filter((c) => c.cat.kind !== 'savings' && c.spent > c.budget);
  if (overs.length) wrap.append(h('div', { class: 'banner bad', role: 'alert' }, icon('warn'), h('div', { class: 'grow' }, h('b', null, t('{n} categories are over budget', { n: overs.length })), h('ul', { style: { margin: '6px 0 0', paddingLeft: '18px' } }, overs.map((c) => h('li', null, c.budget ? t('{name} is {amount} over budget.', { name: c.cat.name, amount: money(c.overBy) }) : t('{name}: {amount} spent with no budget.', { name: c.cat.name, amount: money(c.spent) })))))));
  wrap.append(h('div', { class: 'stats' },
    statCard({ label: 'Budgeted', value: money(s.alloc.allocated, { compact: true }), sub: t('{p} of income', { p: pct(s.alloc.allocatedBp / 100) }) }),
    statCard({ label: 'Spent', value: money(s.spent, { compact: true }), sub: t('{p} of income', { p: pct(s.spentPct) }) }),
    statCard({ label: s.alloc.unallocated >= 0 ? 'Unallocated' : 'Over-allocated', value: money(Math.abs(s.alloc.unallocated), { compact: true }), valueCls: s.alloc.unallocated < 0 ? 'bad' : '', sub: 'not assigned to a category' })));
  const grid = h('div', { class: 'grid cols-2' });
  for (const [kind, title, sub] of GROUPS) {
    const cats = s.cats.filter((c) => c.cat.kind === kind);
    if (!cats.length) continue;
    const budget = cats.reduce((a, c) => a + c.budget, 0), spent = cats.reduce((a, c) => a + c.spent, 0);
    grid.append(h('div', { class: 'card' }, h('div', { class: 'card-head' }, h('div', null, h('h2', null, title), h('div', { class: 'small muted' }, sub)), h('div', { style: { textAlign: 'end' } }, h('b', null, money(spent)), h('div', { class: 'small muted' }, t('of {amount}', { amount: money(budget) })))),
      h('div', null, cats.map((c) => categoryRow(c)))));
  }
  wrap.append(grid);
  return wrap;
}

function plan(st) {
  const ym = ui.ym, cur = isCurrent();
  const wrap = h('div', { class: 'stack' });
  const p = planFor(st, ym);
  const income = planIncome(p);
  wrap.append(h('div', { class: 'card' }, h('div', { class: 'row spread wrap' },
    h('div', null, h('div', { class: 'small muted' }, 'Net income this month'), h('b', { style: { fontSize: '26px' } }, money(income)), h('div', { class: 'small muted' }, p.sources.map((x) => `${x.name} ${money(x.amount, { compact: true })}`).join(' · ') || 'No income yet')),
    h('button', { class: 'btn', onclick: () => openIncomeModal(ym) }, icon('edit', 16), 'Edit income'))));
  const meter = h('div'), donut = allocationDonut();
  const live = () => cs();
  const refresh = () => {
    const a = allocation(state(), planFor(state(), ym));
    clear(meter).append(allocationMeter(a)); donut.update(a, { onSelect: (id) => { const c = catOf(id); c && openCategoryModal({ category: c, onDone: rerender }); } });
  };
  const sums = () => monthSummary(live(), ym);
  const model = {
    categories: () => state().categories, plan: () => planFor(state(), ym),
    setBudget: (id, mode, value) => store.setBudget(ym, id, mode, value, cur && ui.budgetFuture !== false),
    move: (id, idx) => store.moveCategory(id, idx),
    edit: (c) => openCategoryModal({ category: c, onDone: rerender }), add: () => openCategoryModal({ onDone: rerender }),
    info: (id) => { const c = sums().cats.find((x) => x.cat.id === id); return c && { spent: c.spent, remaining: c.remaining }; },
  };
  const editor = budgetEditor({ model, onChange: (structural) => { refresh(); } });
  refresh();
  wrap.append(h('div', { class: 'card alloc-meter glass' }, meter), h('div', { class: 'card' }, h('div', { class: 'card-head' }, h('h2', null, 'Salary distribution')), donut.el));
  const futureBox = h('input', { type: 'checkbox', id: 'fut', checked: ui.budgetFuture !== false, onchange: (e) => { ui.budgetFuture = e.target.checked; } });
  wrap.append(h('div', { class: 'card' }, h('div', { class: 'card-head' }, h('h2', null, 'Categories & budgets')),
    cur ? h('div', { class: 'switch' }, h('label', { for: 'fut' }, 'Use these budgets for future months too'), futureBox) : h('p', { class: 'muted small', style: { marginBottom: '8px' } }, t('You are editing {month} only. Other months keep their own plan.', { month: monthName(ym) })),
    editor.el));
  return wrap;
}

function rules(st) {
  const ev = evaluateRules(st, ui.ym);
  const wrap = h('div', { class: 'stack' });
  const list = h('div', { class: 'list' });
  if (!ev.length) list.append(emptyState({ icon: '📏', title: 'No rules yet', text: 'Rules are personal limits, like “Never spend more than €300/month on shopping.” You will get a warning when one is broken.' }));
  ev.forEach((r) => {
    const badge = r.status === 'violated' ? h('span', { class: 'badge bad' }, 'Broken') : r.status === 'warning' ? h('span', { class: 'badge warn' }, 'Near limit') : h('span', { class: 'badge good' }, 'OK');
    const detail = r.rule.type.startsWith('max') ? t('{a} of {b}', { a: money(r.value), b: money(r.rule.amount) }) + (r.gap > 0 ? ' · ' + t('{amount} over', { amount: money(r.gap) }) : '') : t('{a} vs {b} minimum', { a: money(r.value), b: money(r.rule.amount) }) + (r.gap > 0 ? ' · ' + t('{amount} short', { amount: money(r.gap) }) : '');
    list.append(h('div', { class: 'item' }, h('div', { class: 'grow' }, h('div', { class: 'title', style: { whiteSpace: 'normal' } }, ruleText(st, r.rule, (c) => money(c))), h('div', { class: 'meta' }, detail)), badge,
      h('button', { class: 'icon-btn', 'aria-label': 'Edit rule', onclick: () => ruleModal(r.rule) }, icon('edit')), h('button', { class: 'icon-btn danger', 'aria-label': 'Delete rule', onclick: () => { store.deleteRule(r.rule.id); toast('Rule deleted.'); } }, icon('trash'))));
  });
  wrap.append(h('div', { class: 'card' }, h('div', { class: 'card-head' }, h('h2', null, 'Budget rules'), h('button', { class: 'btn small primary', onclick: () => ruleModal() }, icon('plus', 16), 'Add rule')), list));
  return wrap;
}

export function ruleModal(rule = null) {
  const st = state();
  const type = selectEl(Object.entries(RULE_TYPES).map(([k, v]) => [k, v.label]), rule?.type || 'maxCategory');
  const catSel = selectEl(st.categories.filter((c) => c.kind !== 'savings').map((c) => [c.id, `${c.icon} ${c.name}`]), rule?.categoryId || st.categories[0]?.id);
  const amt = moneyInput({ value: rule ? toInput(rule.amount) : '' });
  const catF = field('Category', catSel), amtF = field('Amount', amt), typeF = field('Rule', type);
  const upd = () => { catF.hidden = !RULE_TYPES[type.value].needsCat; };
  type.addEventListener('change', upd); upd();
  const m = require_modal();
  function require_modal() {
    return modalShim({ title: rule ? 'Edit rule' : 'New rule', body: h('div', null, typeF, catF, amtF), onSave: () => {
      const a = parseMoney(amt.value);
      if (!Number.isFinite(a) || a <= 0) return amtF.setError('Enter an amount greater than 0.');
      store.saveRule({ id: rule?.id, type: type.value, categoryId: RULE_TYPES[type.value].needsCat ? catSel.value : null, amount: a });
      toast('Rule saved.'); return true;
    } });
  }
  return m;
}
import { modal } from '../ui.js';
import { t } from '../i18n.js';
function modalShim({ title, body, onSave }) {
  const m = modal({ title, body, footer: [h('button', { class: 'btn ghost', onclick: () => m.close() }, 'Cancel'), h('button', { class: 'btn primary', onclick: () => { if (onSave() === true) m.close(); } }, 'Save rule')] });
  return m;
}
