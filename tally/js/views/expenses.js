import { h, icon, clear, emptyState, selectEl, download } from '../ui.js';
import * as store from '../store.js';
import { ui, cs, state, money, date, monthName, isCurrent, rerender, today, catOf, plural } from '../ctx.js';
import { monthSummary, expensesIn, PAYMENT_METHODS, isLeakCandidate } from '../calc.js';
import { expensesToCsv } from '../csv.js';
import { monthSwitcher, openExpenseModal, expenseItem, statCard } from '../components.js';
import { openImportModal } from '../import.js';
import { t } from '../i18n.js';

export function renderExpenses() {
  const st = cs(), ym = ui.ym;
  const s = monthSummary(st, ym);
  const f = ui.expenseFilter;
  const page = h('div', { class: 'page' });
  page.append(h('div', { class: 'page-head' }, h('div', null, h('h1', null, 'Expenses'), h('div', { class: 'sub' }, t('{n} in {month}', { n: plural(s.count, 'transaction', 'transactions'), month: monthName(ym) }))), h('div', { class: 'row wrap' }, monthSwitcher(), h('button', { class: 'btn primary', onclick: () => openExpenseModal() }, icon('plus', 18), 'Add expense'))),
    h('div', { class: 'stats', style: { marginBottom: '14px' } },
      statCard({ label: 'Spent', value: money(s.spent), sub: plural(s.count, 'item', 'items') }),
      statCard({ label: 'Fixed', value: money(s.fixedSpent), sub: 'Rent, bills, subscriptions…' }),
      statCard({ label: 'Variable', value: money(s.variableSpent), sub: 'The part you can reduce' }),
      statCard({ label: 'Saved', value: money(s.saved), sub: 'Moved to savings' })));

  const q = h('input', { type: 'search', class: 'input', placeholder: 'Search description…', value: f.q, 'aria-label': 'Search expenses' });
  const cat = selectEl([['', 'All categories'], ...st.categories.map((c) => [c.id, `${c.icon} ${c.name}`])], f.cat, { 'aria-label': 'Filter by category' });
  const method = selectEl([['', 'All payment methods'], ...PAYMENT_METHODS], f.method, { 'aria-label': 'Filter by payment method' });
  const type = selectEl([['', 'All types'], ['spent', 'Spending only'], ['saved', 'Savings only'], ['recurring', 'Recurring only'], ['fixed', 'Fixed costs'], ['variable', 'Variable costs'], ['leaks', 'Small purchases']], f.type, { 'aria-label': 'Filter by type' });
  const list = h('div', { class: 'card' });
  const draw = () => {
    f.q = q.value; f.cat = cat.value; f.method = method.value; f.type = type.value;
    const needle = f.q.trim().toLowerCase();
    let items = expensesIn(st, ym).filter((e) => {
      const c = catOf(e.categoryId);
      if (f.cat && e.categoryId !== f.cat) return false;
      if (f.method && e.method !== f.method) return false;
      if (needle && !((e.description || '').toLowerCase().includes(needle) || (c?.name || '').toLowerCase().includes(needle))) return false;
      switch (f.type) {
        case 'spent': return c?.kind !== 'savings';
        case 'saved': return c?.kind === 'savings';
        case 'recurring': return !!e.recurringId;
        case 'fixed': return c?.kind === 'fixed';
        case 'variable': return c?.kind === 'variable';
        case 'leaks': return isLeakCandidate(st, e, st.settings.leakThreshold);
        default: return true;
      }
    });
    items = items.sort((a, b) => b.date.localeCompare(a.date) || 0);
    clear(list);
    if (!items.length) {
      list.append(s.count === 0
        ? emptyState({ icon: '🧾', title: t('No expenses in {month}', { month: monthName(ym) }), text: isCurrent() ? 'Tap “Add expense” to log your first one. It takes a few seconds.' : 'Nothing was recorded in this month.', action: h('button', { class: 'btn primary', onclick: () => openExpenseModal() }, icon('plus', 18), 'Add expense') })
        : emptyState({ icon: '🔍', title: 'No matches', text: 'Try clearing the search or filters.', action: h('button', { class: 'btn', onclick: () => { q.value = ''; cat.value = ''; method.value = ''; type.value = ''; draw(); } }, 'Clear filters') }));
      return;
    }
    const shown = items.slice(0, ui.shown);
    let curDay = null, box = null;
    const totals = {};
    items.forEach((e) => { if (catOf(e.categoryId)?.kind !== 'savings') totals[e.date] = (totals[e.date] || 0) + e.amount; });
    for (const e of shown) {
      if (e.date !== curDay) { curDay = e.date; list.append(h('div', { class: 'day-head' }, h('span', null, date(e.date, { weekday: 'long', day: 'numeric', month: 'short' })), h('span', null, totals[e.date] ? money(totals[e.date]) : ''))); box = h('div', { class: 'list' }); list.append(box); }
      box.append(expenseItem(e, () => openExpenseModal({ expense: e })));
    }
    if (items.length > shown.length) list.append(h('div', { style: { textAlign: 'center', padding: '12px' } }, h('button', { class: 'btn', onclick: () => { ui.shown += 80; draw(); } }, t('Show more ({n})', { n: items.length - shown.length }))));
  };
  [q, cat, method, type].forEach((el) => el.addEventListener(el === q ? 'input' : 'change', () => { ui.shown = 80; draw(); }));
  draw();
  page.append(h('div', { class: 'card tight', style: { marginBottom: '14px' } }, h('div', { class: 'grid cols-4', style: { gap: '8px' } }, q, cat, method, type)),
    list,
    h('div', { class: 'row wrap', style: { marginTop: '14px' } },
      h('button', { class: 'btn', onclick: () => { download(`tally-expenses-${today()}.csv`, expensesToCsv(state()), 'text/csv'); } }, icon('download', 16), 'Export CSV'),
      h('button', { class: 'btn', onclick: openImportModal }, icon('upload', 16), 'Import CSV')));
  return page;
}
