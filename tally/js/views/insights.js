import { h, icon, clear, emptyState } from '../ui.js';
import { locale, ui, cs, state, money, pct, monthName, isCurrent, today, go, date, plural } from '../ctx.js';
import { insights, monthSummary, dailySpend, spentOnly, expensesIn, catById } from '../calc.js';
import { dayOf, monthLen, dow, weekdayName, addDays } from '../dates.js';
import { monthSwitcher } from '../components.js';
import { lineChart, calendarHeat, barChart } from '../charts.js';
import { healthCard, alertList, insightItem, leaksCard, sectionHead } from './dashboard.js';
import { visibleAlerts } from '../notify.js';

export function renderInsights() {
  const st = cs(), t = today(), ym = ui.ym, cur = isCurrent();
  const s = monthSummary(st, ym);
  const page = h('div', { class: 'page' });
  page.append(h('div', { class: 'page-head' }, h('div', null, h('h1', null, 'Insights'), h('div', { class: 'sub' }, 'What your spending is telling you')), h('div', { class: 'row wrap' }, monthSwitcher(), h('button', { class: 'btn', onclick: () => go('planner') }, icon('planner', 16), 'Planner'))));
  if (s.count === 0) { page.append(h('div', { class: 'card' }, emptyState({ icon: '💡', title: 'Not enough data yet', text: `Add a few expenses in ${monthName(ym)} and insights will appear here.` }))); page.append(h('div', { class: 'card', style: { marginTop: '14px' } }, sectionHead('Financial health'), healthCard(st, t))); return page; }
  const al = cur ? visibleAlerts() : [];
  const grid = h('div', { class: 'grid cols-2' });
  const left = h('div', { class: 'stack' }), right = h('div', { class: 'stack' });
  left.append(h('div', { class: 'card' }, sectionHead('Financial health'), healthCard(st, t)));
  if (cur) left.append(h('div', { class: 'card' }, sectionHead('Alerts', 'Notification settings', () => go('settings')), al.length ? alertList(al, { limit: 20 }) : h('p', { class: 'muted' }, state().settings.notifications.enabled ? 'No alerts right now. Everything looks fine.' : 'Notifications are turned off in Settings.')));
  left.append(leaksCard(st, ym, { full: true }));
  const ins = insights(st, t, ym);
  right.append(h('div', { class: 'card' }, sectionHead('What we noticed'), ins.length ? h('div', { class: 'stack', style: { gap: '8px' } }, ins.map(insightItem)) : h('p', { class: 'muted' }, 'Nothing stands out yet.')));
  /* pace chart */
  const n = monthLen(ym), upto = cur ? dayOf(t) : n;
  const daily = dailySpend(st, ym);
  let acc = 0; const cum = daily.map((v, i) => { acc += v; return i < upto ? acc : null; });
  const budget = s.cats.filter((c) => c.cat.kind !== 'savings').reduce((a, c) => a + c.budget, 0);
  const pace = daily.map((_, i) => Math.round((budget * (i + 1)) / n));
  right.append(h('div', { class: 'card' }, sectionHead('Spending pace'), h('p', { class: 'muted small', style: { marginBottom: '8px' } }, 'Cumulative spending against an even pace through your total budget.'),
    lineChart({ labels: daily.map((_, i) => String(i + 1)), series: [{ id: 'spent', label: 'Spent', color: 'var(--accent)', points: cum }, { id: 'pace', label: 'Even budget pace', color: 'var(--muted)', dash: true, points: pace }], fmt: (v, c) => money(v, { compact: !!c }), xEvery: n > 20 ? 5 : 3, ariaLabel: 'Cumulative spending versus budget pace' })));
  right.append(h('div', { class: 'card' }, sectionHead('Daily spending heatmap'), calendarHeat({ ym, values: dailySpend(st, ym), fmt: (v) => money(v), locale: locale() })));
  /* weekday pattern */
  const sum = new Array(7).fill(0), cnt = new Array(7).fill(0);
  const disc = dailySpend(st, ym, true);
  disc.slice(0, upto).forEach((v, i) => { const d = dow(`${ym}-${String(i + 1).padStart(2, '0')}`); sum[d] += v; cnt[d]++; });
  const order = [1, 2, 3, 4, 5, 6, 0];
  right.append(h('div', { class: 'card' }, sectionHead('Average by weekday'), h('p', { class: 'muted small', style: { marginBottom: '8px' } }, 'Everyday spending only (rent and other recurring bills excluded).'),
    barChart({ data: order.map((d) => ({ key: String(d), label: weekdayName(d, locale(), 'long'), short: weekdayName(d, locale(), 'short'), value: cnt[d] ? Math.round(sum[d] / cnt[d]) : 0, tipLabel: 'Average' })), fmt: (v, c) => money(v, { compact: !!c }), height: 120, ariaLabel: 'Average spending by weekday' })));
  grid.append(left, right);
  page.append(grid);
  return page;
}
