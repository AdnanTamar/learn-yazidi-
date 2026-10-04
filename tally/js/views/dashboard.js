import { h, icon, clear, emptyState } from '../ui.js';
import * as store from '../store.js';
import { locale, ui, cs, state, money, pct, monthName, isCurrent, rerender, today, go, date, setMonth, curMonth, plural } from '../ctx.js';
import { monthSummary, safeToSpend, moneyLeaks, upcomingRecurring, goalStatus, emergencyStatus, insights, financialHealth, monthTotals, allocation, FREQUENCIES, annualCost } from '../calc.js';
import { addDays, addMonths, monthRange, monthOf, fmtMonth, dow } from '../dates.js';
import { monthSwitcher, statCard, openIncomeModal, openExpenseModal, avatar } from '../components.js';
import { allocationDonut, allocationMeter } from '../budget-editor.js';
import { categoryRow } from './budget.js';
import { barChart, progress } from '../charts.js';
import { visibleAlerts } from '../notify.js';
import { openMonthPicker } from '../components.js';
import { catOf } from '../ctx.js';
import { t, isRtl } from '../i18n.js';

const greeting = () => { const hr = new Date().getHours(); return t(hr < 5 ? 'Good night' : hr < 12 ? 'Good morning' : hr < 18 ? 'Good afternoon' : 'Good evening'); };

export function sectionHead(title, link, onLink) {
  return h('div', { class: 'card-head' }, h('h2', null, title), link ? h('button', { class: 'link', onclick: onLink }, t(link) + (isRtl() ? ' ‹' : ' ›')) : null);
}

export function alertList(list, { limit = 3, dismissable = true } = {}) {
  return h('div', { class: 'stack', style: { gap: '8px' }, role: 'list' }, list.slice(0, limit).map((a) => h('div', { class: 'alert-item ' + a.severity, role: 'listitem' }, h('span', { 'aria-hidden': 'true' }, a.icon), h('div', { class: 'grow' }, a.text),
    dismissable ? h('button', { class: 'icon-btn', style: { width: '28px', height: '28px' }, 'aria-label': 'Dismiss alert', onclick: () => store.dismissAlert(a.id, monthOf(today())) }, icon('close', 14)) : null)));
}

export function healthCard(st, tdy, { compact = false } = {}) {
  const hl = financialHealth(st, tdy);
  const color = hl.score >= 65 ? 'var(--good)' : hl.score >= 50 ? 'var(--warn)' : 'var(--bad)';
  const ring = h('div', { class: 'score-ring', style: { '--p': hl.score, '--sc': color }, role: 'img', 'aria-label': t('Financial health {score} out of 100, {label}', { score: hl.score, label: t(hl.label) }) }, h('div', null, h('b', null, hl.score), h('small', null, '/ 100')));
  const factors = hl.factors.map((f) => h('div', { class: 'factor' }, h('span', null, f.label), f.score == null ? h('span', { class: 'muted small' }, 'Not enough data') : progress(f.score, { color: f.score >= 65 ? 'var(--good)' : f.score >= 45 ? 'var(--warn)' : 'var(--bad)', label: f.label }), h('b', { style: { textAlign: 'end' } }, f.score == null ? '–' : f.score + '%'), compact ? null : h('span', { class: 'note' }, f.note)));
  return h('div', null, h('div', { class: 'score' }, ring, h('div', null, h('div', { style: { fontSize: '22px', fontWeight: 800, color } }, hl.label), h('div', { class: 'muted small' }, 'An informational score based on your savings, budget control, emergency fund, debt, recurring costs, overspending and income stability.'))),
    h('div', { style: { marginTop: '12px' } }, compact ? factors.slice(0, 4) : factors),
    h('p', { class: 'muted small', style: { marginTop: '10px' } }, 'This score is informational only and is not professional financial advice.'));
}

export function renderDashboard() {
  const st = cs(), tdy = today(), ym = ui.ym, cur = isCurrent();
  const s = monthSummary(st, ym);
  const safe = cur ? safeToSpend(st, tdy) : null;
  const mode = state().mode;
  const page = h('div', { class: 'page' });
  page.append(h('div', { class: 'page-head' }, h('div', null, h('h1', null, `${greeting()}${state().profile.name ? t(', ') + state().profile.name : ''}`), h('div', { class: 'sub' }, cur ? `${monthName(ym)} · ${date(tdy, { weekday: 'long', day: 'numeric', month: 'long' })}` : t('Viewing {month} (past month)', { month: monthName(ym) }))), monthSwitcher()));

  if (mode === 'demo') page.append(h('div', { class: 'banner', style: { marginBottom: '14px' } }, icon('info'), h('div', { class: 'grow' }, h('b', null, 'You are exploring demo data'), 'Nothing here is yours. Start with your own salary and all demo data is removed.'), h('button', { class: 'btn small primary', onclick: () => go('setup') }, 'Start with my data')));
  if (!cur) page.append(h('div', { class: 'banner', style: { marginBottom: '14px' } }, icon('history'), h('div', { class: 'grow' }, 'Past months keep the income and budgets they had at the time.'), h('button', { class: 'btn small', onclick: () => setMonth(curMonth()) }, 'Back to this month')));
  if (!s.income) page.append(h('div', { class: 'banner warn', style: { marginBottom: '14px' } }, icon('warn'), h('div', { class: 'grow' }, h('b', null, 'No income recorded for this month'), 'Add it to unlock budgets and the safe-to-spend number.'), h('button', { class: 'btn small primary', onclick: () => openIncomeModal() }, 'Add income')));

  const al = cur ? visibleAlerts() : [];
  const body = h('div', { class: 'stack' });

  /* stats */
  const heroCard = cur
    ? statCard({ label: 'Safe to spend today', cls: 'hero', value: h('span', null, money(safe.safeDaily), h('small', { style: { fontSize: '.45em', fontWeight: 600 } }, ' /day')), valueCls: safe.availableRaw < 0 ? 'bad' : '', sub: safe.availableRaw < 0 ? t('You are {amount} past what is safe. Committed bills and savings come first.', { amount: money(-safe.availableRaw) }) : t('{amount} safe to spend · {days} until payday', { amount: money(safe.available), days: plural(safe.days, 'day', 'days') }), accent: 'var(--accent)' })
    : statCard({ label: 'Savings rate', cls: 'hero', value: pct(s.savingsRate), valueCls: s.savingsRate < 0 ? 'bad' : '', sub: t('{amount} not spent', { amount: money(s.savings) }), accent: 'var(--accent)' });
  body.append(h('div', { class: 'stats' },
    statCard({ label: 'Total income', value: money(s.income), sub: 'Received this month', onClick: () => openIncomeModal(ym), accent: '#2aa6b8' }),
    statCard({ label: 'Total spent', value: money(s.spent), sub: t('{p} of salary', { p: pct(s.spentPct) }), accent: '#eb6834', onClick: () => go('expenses') }),
    statCard({ label: 'Remaining', value: money(s.remaining), valueCls: s.remaining < 0 ? 'bad' : '', sub: 'Income − spent', accent: s.remaining < 0 ? 'var(--bad)' : 'var(--good)' }),
    statCard({ label: 'Saved', value: money(s.saved), sub: t('{p} moved to savings', { p: pct(s.savedPct) }), accent: '#3d9a3d', onClick: () => go('goals') }),
    heroCard));

  if (al.length) body.append(h('div', { class: 'card' }, sectionHead('Alerts', al.length > 3 ? t('All {n}', { n: al.length }) : null, () => go('insights')), alertList(al)));

  /* five answers + where did it go */
  const spentCats = s.cats.filter((c) => c.cat.kind !== 'savings' && c.spent > 0).sort((a, b) => b.spent - a.spent);
  const days = cur ? safe.days : null;
  const glance = h('div', { class: 'card' }, sectionHead('Where did my money go?', 'Breakdown', () => go('budget')),
    s.spent > 0
      ? h('div', null,
        h('div', { class: 'alloc-bar', role: 'img', 'aria-label': 'Spending by category' }, spentCats.map((c) => h('i', { style: { width: (c.spent / Math.max(s.spent, 1)) * 100 + '%', background: c.cat.color }, title: `${c.cat.name} ${money(c.spent)}` }))),
        h('div', { class: 'legend', style: { marginTop: '10px' } }, spentCats.slice(0, 5).map((c) => h('div', { class: 'legend-row' }, h('i', { style: { background: c.cat.color } }), h('span', null, c.cat.name), h('span', { class: 'p' }, pct(Math.round((c.spent / s.spent) * 1000) / 10)), h('b', null, money(c.spent))))))
      : h('p', { class: 'muted' }, 'No spending recorded yet this month.'),
    h('div', { class: 'grid cols-2', style: { marginTop: '14px', gap: '10px' } },
      miniStat('Salary spent', pct(s.spentPct), progress(s.spentPct, { color: s.spentPct > 100 ? 'var(--bad)' : 'var(--accent)', label: 'Salary spent' })),
      miniStat('Saved', pct(s.savedPct), progress(s.savedPct, { color: 'var(--good)', label: 'Saved' })),
      cur ? miniStat('Until next payday', plural(days, 'day', 'days'), h('div', { class: 'small muted' }, date(safe.nextPayday))) : miniStat('Largest category', s.largestCat ? s.largestCat.cat.name : '–', h('div', { class: 'small muted' }, s.largestCat ? money(s.largestCat.spent) : '')),
      cur ? miniStat('Recommended daily limit', money(safe.safeDaily), h('div', { class: 'small muted' }, 'Updates every day')) : miniStat('Largest expense', s.largestExpense ? money(s.largestExpense.amount) : '–', h('div', { class: 'small muted' }, s.largestExpense?.description || ''))));
  body.append(glance);

  /* allocation */
  const a = allocation(st, s.plan);
  const donut = allocationDonut();
  donut.update(a, { onSelect: () => go('budget') });
  body.append(h('div', { class: 'card' }, sectionHead('Salary distribution', 'Edit plan', () => { ui.tab.budget = 'plan'; go('budget'); }), allocationMeter(a), h('div', { style: { marginTop: '16px' } }, donut.el)));

  /* budget categories (most used first) */
  const cats = [...s.cats].filter((c) => c.cat.kind !== 'savings' && (c.budget > 0 || c.spent > 0)).sort((a, b) => (b.usage === Infinity ? 1e9 : b.usage) - (a.usage === Infinity ? 1e9 : a.usage));
  const fixedVar = h('div', { class: 'grid cols-2', style: { gap: '10px', margin: '0 0 6px' } },
    miniStat('Fixed', money(s.fixedSpent), h('div', { class: 'small muted' }, t('of {amount} budgeted', { amount: money(s.fixedBudget) }))),
    miniStat('Variable', money(s.variableSpent), h('div', { class: 'small muted' }, t('of {amount} budgeted · you can reduce this', { amount: money(s.variableBudget) }))));
  body.append(h('div', { class: 'card' }, sectionHead('Budget categories', 'All', () => go('budget')), cats.length ? h('div', null, fixedVar, cats.slice(0, 6).map((c) => categoryRow(c))) : emptyState({ icon: '📊', title: 'No budgets yet', text: 'Create categories and give each a monthly budget.', action: h('button', { class: 'btn primary', onclick: () => { ui.tab.budget = 'plan'; go('budget'); } }, 'Set up budget') })));

  /* leaks + recurring */
  const two = h('div', { class: 'grid cols-2' });
  two.append(leaksCard(st, ym), upcomingCard(st, tdy));
  body.append(two);

  /* goals + health */
  const two2 = h('div', { class: 'grid cols-2' });
  two2.append(goalsCard(st, tdy, ym), h('div', { class: 'card' }, sectionHead('Financial health', 'Details', () => go('insights')), healthCard(st, tdy, { compact: true })));
  body.append(two2);

  /* insights */
  const ins = insights(st, tdy, ym);
  body.append(h('div', { class: 'card' }, sectionHead('Insights', 'More', () => go('insights')), ins.length ? h('div', { class: 'stack', style: { gap: '8px' } }, ins.slice(0, 4).map(insightItem)) : h('p', { class: 'muted' }, 'Insights appear once you have a few expenses.')));

  /* monthly chart */
  const months = monthRange(addMonths(ym, -5), ym);
  const tot = monthTotals(st, months);
  body.append(h('div', { class: 'card' }, sectionHead('Monthly spending', 'History', () => go('history')),
    barChart({ data: tot.map((x) => ({ key: x.ym, label: fmtMonth(x.ym, locale(), { month: 'long', year: 'numeric' }), short: fmtMonth(x.ym, locale(), { month: 'short' }), value: x.spent, empty: !x.hasData })), line: tot.map((x) => x.income), fmt: (v, c) => money(v, { compact: !!c }), highlightKey: ym, onSelect: (k) => setMonth(k), ariaLabel: 'Monthly spending versus income' })));
  page.append(body);
  return page;
}

function miniStat(label, value, extra) {
  return h('div', { style: { padding: '10px 12px', borderRadius: '14px', background: 'var(--track)' } }, h('div', { class: 'small muted' }, label), h('div', { style: { fontWeight: 800, fontSize: '18px', margin: '2px 0 6px' } }, value), extra);
}

export function insightItem(i) {
  return h('div', { class: 'alert-item ' + (i.kind === 'bad' ? 'bad' : i.kind === 'warn' ? 'warn' : i.kind === 'good' ? 'good' : 'info') }, h('span', { 'aria-hidden': 'true' }, i.icon), h('div', { class: 'grow' }, h('b', null, i.title), h('div', null, i.text)));
}

export function leaksCard(st, ym, { full = false } = {}) {
  const l = moneyLeaks(st, ym);
  const card = h('div', { class: 'card' }, sectionHead('Money leaks', full ? null : 'Details', () => go('insights')));
  if (!l.count) { card.append(h('p', { class: 'muted' }, t('No small purchases (≤ {amount}) this month. Nice and tight.', { amount: money(l.threshold) }))); return card; }
  card.append(h('p', { class: 'muted small' }, t('Small purchases (≤ {amount}) this month:', { amount: money(l.threshold) })), h('div', { style: { fontSize: '30px', fontWeight: 800, letterSpacing: '-.02em' } }, money(l.total)),
    h('div', { class: 'banner warn', style: { margin: '10px 0' } }, icon('warn'), h('div', { class: 'grow' }, 'Potential annual cost: ', h('b', { style: { display: 'inline' } }, money(l.annual)), h('div', { class: 'small muted' }, t('{n}, about {amount} each', { n: plural(l.count, 'purchase', 'purchases'), amount: money(l.average) })))),
    h('div', { class: 'list' }, l.groups.slice(0, full ? 12 : 4).map((g) => h('div', { class: 'item', style: { padding: '8px 0' } }, h('div', { class: 'grow' }, h('div', { class: 'title' }, g.name), h('div', { class: 'meta' }, `${g.count}×`)), h('div', { class: 'amt' }, money(g.total))))));
  return card;
}

function upcomingCard(st, tdy) {
  const up = upcomingRecurring(st, tdy, addDays(tdy, 45)).slice(0, 5);
  const card = h('div', { class: 'card' }, sectionHead('Upcoming payments', 'Recurring', () => go('recurring')));
  if (!up.length) { card.append(h('p', { class: 'muted' }, st.recurring.length ? 'Nothing due in the next 45 days.' : 'No recurring payments yet. Add rent, phone, subscriptions…'), st.recurring.length ? null : h('button', { class: 'btn small', style: { marginTop: '10px' }, onclick: () => go('recurring') }, 'Add recurring')); return card; }
  card.append(h('div', { class: 'list' }, up.map((u) => { const c = catOf(u.categoryId); return h('div', { class: 'item' }, c ? avatar(c, 36) : null, h('div', { class: 'grow' }, h('div', { class: 'title' }, u.rec.name), h('div', { class: 'meta' }, date(u.date, { weekday: 'short', day: 'numeric', month: 'short' }))), h('div', { class: 'amt' }, money(u.amount))); })));
  return card;
}

function goalsCard(st, tdy, ym) {
  const card = h('div', { class: 'card' }, sectionHead('Savings goals', 'All', () => go('goals')));
  const goals = st.goals.map((g) => goalStatus(st, g, tdy));
  const em = emergencyStatus(st, ym);
  card.append(h('div', { style: { marginBottom: '12px' } }, h('div', { class: 'row spread' }, h('span', null, '🛟 Emergency fund'), h('b', null, t('{n} months', { n: em.coverage }))), progress(em.progress, { color: 'var(--good)', label: 'Emergency fund progress' }), h('div', { class: 'small muted' }, t('{a} of {b} target', { a: money(em.current), b: money(em.targetAmount) }))));
  if (!goals.length) card.append(h('p', { class: 'muted small' }, 'No goals yet.'), h('button', { class: 'btn small', style: { marginTop: '8px' }, onclick: () => go('goals') }, 'Create a goal'));
  goals.slice(0, 3).forEach((g) => card.append(h('div', { style: { marginTop: '10px' } }, h('div', { class: 'row spread' }, h('span', null, `${g.goal.icon || '🎯'} ${g.goal.name}`), h('b', null, pct(g.progress))), progress(g.progress, { color: 'var(--accent)', label: g.goal.name }), h('div', { class: 'small muted' }, t('{a} of {b}', { a: money(g.current), b: money(g.goal.target) })))));
  return card;
}
