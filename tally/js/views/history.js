import { h, icon, clear, emptyState, segmented } from '../ui.js';
import { ui, cs, state, money, pct, monthName, rerender, today, curMonth, setMonth, go, locale } from '../ctx.js';
import { monthSummary, monthTotals, dailySpend } from '../calc.js';
import { addMonths, monthRange, ymParts, ymMake, fmtMonth } from '../dates.js';
import { monthSwitcher, statCard } from '../components.js';
import { barChart, lineChart, calendarHeat } from '../charts.js';

export function renderHistory() {
  const tab = ui.tab.history || 'month';
  const page = h('div', { class: 'page' });
  page.append(h('div', { class: 'page-head' }, h('div', null, h('h1', null, 'History'), h('div', { class: 'sub' }, tab === 'month' ? 'Month by month, compared' : 'Your year at a glance')), h('div', { class: 'row wrap' }, segmented([['month', 'Month'], ['year', 'Year']], tab, (v) => { ui.tab.history = v; rerender(); }, 'History view'), tab === 'month' ? monthSwitcher() : yearSwitcher())));
  page.append(tab === 'month' ? monthView() : yearView());
  return page;
}

const delta = (v, goodWhenUp) => {
  if (v === 0) return h('span', { class: 'delta flat' }, '±0');
  const up = v > 0, good = up === goodWhenUp;
  return h('b', { class: 'delta ' + (good ? 'down' : 'up') }, (up ? '+' : '−') + money(Math.abs(v)));
};

function monthView() {
  const st = cs(), ym = ui.ym, prev = addMonths(ym, -1);
  const s = monthSummary(st, ym), p = monthSummary(st, prev);
  if (!s.count && s.plan.virtual) return h('div', { class: 'card' }, emptyState({ icon: '🗓️', title: `No data for ${monthName(ym)}`, text: 'Nothing was recorded in this month.' }));
  const wrap = h('div', { class: 'stack' });
  wrap.append(h('div', { class: 'stats' },
    statCard({ label: 'Income', value: money(s.income) }), statCard({ label: 'Expenses', value: money(s.spent) }),
    statCard({ label: 'Savings', value: money(s.savings), valueCls: s.savings < 0 ? 'bad' : '', sub: 'Income − expenses' }), statCard({ label: 'Savings rate', value: pct(s.savingsRate), valueCls: s.savingsRate < 0 ? 'bad' : '' }),
    statCard({ label: 'Budget performance', value: s.budgetedCount ? `${s.withinBudget}/${s.budgetedCount}` : '–', sub: s.overspend ? `${money(s.overspend)} over in total` : s.budgetedCount ? 'categories within budget' : 'No budgets set' })));
  const grid = h('div', { class: 'grid cols-2' });
  grid.append(h('div', { class: 'card' }, h('div', { class: 'card-head' }, h('h2', null, 'Highlights')),
    h('div', { class: 'list' },
      h('div', { class: 'item' }, h('div', { class: 'grow' }, h('div', { class: 'meta' }, 'Largest category'), h('div', { class: 'title' }, s.largestCat ? `${s.largestCat.cat.icon} ${s.largestCat.cat.name}` : '–')), h('div', { class: 'amt' }, s.largestCat ? money(s.largestCat.spent) : '')),
      h('div', { class: 'item' }, h('div', { class: 'grow' }, h('div', { class: 'meta' }, 'Largest individual expense'), h('div', { class: 'title' }, s.largestExpense ? s.largestExpense.description || '(no description)' : '–')), h('div', { class: 'amt' }, s.largestExpense ? money(s.largestExpense.amount) : '')),
      h('div', { class: 'item' }, h('div', { class: 'grow' }, h('div', { class: 'meta' }, 'Fixed vs variable spending'), h('div', { class: 'title' }, `${money(s.fixedSpent)} fixed · ${money(s.variableSpent)} variable`))))),
  h('div', { class: 'card' }, h('div', { class: 'card-head' }, h('h2', null, `${monthName(ym, { month: 'long' })} vs ${monthName(prev, { month: 'long' })}`)),
    p.count || !p.plan.virtual ? h('div', { class: 'kv' },
      h('span', { class: 'k' }, 'Income'), h('b', null, money(s.income)), delta(s.income - p.income, true),
      h('span', { class: 'k' }, 'Expenses'), h('b', null, money(s.spent)), delta(s.spent - p.spent, false),
      h('span', { class: 'k' }, 'Savings'), h('b', null, money(s.savings)), delta(s.savings - p.savings, true),
      h('span', { class: 'k' }, 'Savings rate'), h('b', null, pct(s.savingsRate)), h('b', { class: 'delta ' + (s.savingsRate - p.savingsRate >= 0 ? 'down' : 'up') }, `${s.savingsRate - p.savingsRate >= 0 ? '+' : '−'}${Math.abs(Math.round((s.savingsRate - p.savingsRate) * 10) / 10)} pts`))
      : h('p', { class: 'muted' }, 'No data for the previous month to compare with.')));
  wrap.append(grid);
  const rows = s.cats.filter((c) => c.spent > 0 || c.budget > 0).sort((a, b) => b.spent - a.spent);
  const pc = Object.fromEntries(p.cats.map((c) => [c.cat.id, c.spent]));
  wrap.append(h('div', { class: 'card' }, h('div', { class: 'card-head' }, h('h2', null, 'By category')), h('div', { class: 'table-scroll' }, h('table', { class: 'tbl' }, h('thead', null, h('tr', null, ['Category', 'Spent', 'Budget', 'Used', `vs ${monthName(prev, { month: 'short' })}`].map((x, i) => h('th', { class: i ? 'r' : '' }, x)))),
    h('tbody', null, rows.map((c) => h('tr', null, h('td', null, `${c.cat.icon} ${c.cat.name}`), h('td', { class: 'r' }, money(c.spent)), h('td', { class: 'r' }, money(c.budget)), h('td', { class: 'r' }, c.budget ? h('span', { class: c.spent > c.budget && c.cat.kind !== 'savings' ? 'bad' : '' }, pct(c.usage)) : '–'), h('td', { class: 'r' }, delta(c.spent - (pc[c.cat.id] || 0), c.cat.kind === 'savings')))))))));
  wrap.append(h('div', { class: 'card' }, h('div', { class: 'card-head' }, h('h2', null, 'Daily spending')), calendarHeat({ ym, values: dailySpend(st, ym), fmt: (v) => money(v), locale: locale() })));
  return wrap;
}

function yearSwitcher() {
  const y = ymParts(ui.ym).y, maxY = ymParts(curMonth()).y;
  return h('div', { class: 'monthbar', role: 'group', 'aria-label': 'Year' },
    h('button', { class: 'icon-btn', 'aria-label': 'Previous year', onclick: () => setMonth(ymMake(y - 1, ymParts(ui.ym).m)) }, icon('chevL')),
    h('span', { class: 'label', style: { padding: '6px 14px', fontWeight: 700, minWidth: '70px', textAlign: 'center' } }, y),
    h('button', { class: 'icon-btn', 'aria-label': 'Next year', disabled: y >= maxY, onclick: () => setMonth(ymMake(y + 1, ymParts(ui.ym).m)) }, icon('chevR')));
}

function yearView() {
  const st = cs(), year = ymParts(ui.ym).y, cur = curMonth();
  const months = monthRange(ymMake(year, 1), ymMake(year, 12));
  const tot = monthTotals(st, months);
  const data = tot.filter((m) => m.hasData && m.ym <= cur);
  if (!data.length) return h('div', { class: 'card' }, emptyState({ icon: '📅', title: `No data for ${year}`, text: 'Add expenses to see your annual overview.' }));
  const sum = (f) => data.reduce((a, m) => a + f(m), 0);
  const income = sum((m) => m.income), spent = sum((m) => m.spent), saved = income - spent;
  const spendData = data.filter((m) => m.count > 0);
  const hi = [...spendData].sort((a, b) => b.spent - a.spent)[0], lo = [...spendData].sort((a, b) => a.spent - b.spent)[0];
  const name = (ym) => fmtMonth(ym, locale(), { month: 'long' });
  const wrap = h('div', { class: 'stack' });
  wrap.append(h('div', { class: 'stats' },
    statCard({ label: 'Total income', value: money(income) }), statCard({ label: 'Total expenses', value: money(spent) }), statCard({ label: 'Total savings', value: money(saved), valueCls: saved < 0 ? 'bad' : '', sub: `${income ? pct(Math.round((saved / income) * 1000) / 10) : '0%'} of income` }),
    statCard({ label: 'Avg monthly spending', value: money(Math.round(spent / data.length)), sub: `over ${data.length} month${data.length === 1 ? '' : 's'}` }), statCard({ label: 'Avg monthly savings', value: money(Math.round(saved / data.length)) })),
  h('div', { class: 'grid cols-2' },
    h('div', { class: 'card' }, h('div', { class: 'small muted' }, 'Highest spending month'), h('b', { style: { fontSize: '22px' } }, hi ? name(hi.ym) : '–'), h('div', { class: 'muted' }, hi ? money(hi.spent) : '')),
    h('div', { class: 'card' }, h('div', { class: 'small muted' }, 'Lowest spending month'), h('b', { style: { fontSize: '22px' } }, lo ? name(lo.ym) : '–'), h('div', { class: 'muted' }, lo ? money(lo.spent) : ''))));
  wrap.append(h('div', { class: 'card' }, h('div', { class: 'card-head' }, h('h2', null, 'Monthly spending')),
    barChart({ data: tot.map((m) => ({ key: m.ym, label: fmtMonth(m.ym, locale(), { month: 'long', year: 'numeric' }), short: fmtMonth(m.ym, locale(), { month: 'short' }), value: m.hasData && m.ym <= cur ? m.spent : 0, empty: !m.hasData || m.ym > cur })), line: tot.map((m) => (m.hasData && m.ym <= cur ? m.income : null)), fmt: (v, c) => money(v, { compact: !!c }), highlightKey: ui.ym, onSelect: (k) => { ui.tab.history = 'month'; setMonth(k); }, ariaLabel: `Spending by month in ${year}` })));
  const labels = tot.map((m) => fmtMonth(m.ym, locale(), { month: 'short' }));
  wrap.append(h('div', { class: 'card' }, h('div', { class: 'card-head' }, h('h2', null, 'Savings by month')), h('p', { class: 'muted small', style: { marginBottom: '6px' } }, 'Income minus expenses. Negative months are shown as zero in the chart.'),
    lineChart({ labels, series: [{ id: 'sav', label: 'Savings', color: 'var(--good)', points: tot.map((m) => (m.hasData && m.ym <= cur ? Math.max(0, m.savings) : null)) }, { id: 'sp', label: 'Spent', color: 'var(--accent)', points: tot.map((m) => (m.hasData && m.ym <= cur ? m.spent : null)) }], fmt: (v, c) => money(v, { compact: !!c }), ariaLabel: 'Savings and spending per month' })));
  wrap.append(h('div', { class: 'card' }, h('div', { class: 'table-scroll' }, h('table', { class: 'tbl' }, h('thead', null, h('tr', null, ['Month', 'Income', 'Spent', 'Savings'].map((x, i) => h('th', { class: i ? 'r' : '' }, x)))), h('tbody', null, data.map((m) => h('tr', null, h('td', null, name(m.ym)), h('td', { class: 'r' }, money(m.income)), h('td', { class: 'r' }, money(m.spent)), h('td', { class: 'r ' + (m.savings < 0 ? 'bad' : '') }, money(m.savings)))))))));
  return wrap;
}
