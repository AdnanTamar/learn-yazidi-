// App shell: router, layout, re-rendering, day rollover.
import { h, icon, clear, anyModalOpen } from './ui.js';
import * as store from './store.js';
import { ui, state, go, setRerender, setMoneyOverride, curMonth, today } from './ctx.js';
import { openExpenseModal } from './components.js';
import { renderDashboard } from './views/dashboard.js';
import { renderExpenses } from './views/expenses.js';
import { renderBudget } from './views/budget.js';
import { renderGoals } from './views/goals.js';
import { renderRecurring } from './views/recurring.js';
import { renderInsights } from './views/insights.js';
import { renderPlanner } from './views/planner.js';
import { renderHistory } from './views/history.js';
import { renderSettings } from './views/settings.js';
import { renderWizard, resetWizard } from './views/wizard.js';
import { applyTheme } from './theme.js';
import { maybeBrowserNotify } from './notify.js';
import { todayStr, monthOf } from './dates.js';

const ROUTES = {
  dashboard: ['Dashboard', renderDashboard], expenses: ['Expenses', renderExpenses], budget: ['Budget', renderBudget], goals: ['Goals', renderGoals],
  recurring: ['Recurring', renderRecurring], insights: ['Insights', renderInsights], planner: ['Planner', renderPlanner], history: ['History', renderHistory], settings: ['Settings', renderSettings],
};
const SIDEBAR = ['dashboard', 'expenses', 'budget', 'goals', 'recurring', 'insights', 'planner', 'history', 'settings'];
const MOBILE = ['dashboard', 'expenses', 'budget', 'goals', 'settings'];

const root = document.getElementById('app');
let shell = null, shellKind = null, lastRoute = null, lastDay = todayStr(), raf = 0;

const routeName = () => (location.hash.replace(/^#\/?/, '').split('?')[0] || 'dashboard');

function currentRoute() {
  const s = state();
  let r = routeName();
  if (s.mode === 'empty') return 'setup';
  if (r === 'setup' && s.mode === 'user') return 'dashboard';
  if (r !== 'setup' && !ROUTES[r]) return 'dashboard';
  return r;
}

function buildShell() {
  const main = h('main', { class: 'main', id: 'main', tabindex: '-1' });
  const link = (r, cls) => h('a', { class: cls, href: '#/' + r, 'data-route': r }, icon(r, cls === 'navlink' ? 20 : 22), h('span', null, ROUTES[r][0]));
  const theme = h('button', { class: 'navlink', onclick: () => { const cur = state().settings.theme; const dark = document.documentElement.dataset.theme === 'dark' || (cur === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches); const next = dark ? 'light' : 'dark'; store.setSettings({ theme: next }); applyTheme(next); } }, icon('moon', 20), h('span', null, 'Dark / light'));
  const sidebar = h('nav', { class: 'sidebar', 'aria-label': 'Main' }, h('div', { class: 'brand' }, h('div', { class: 'brand-mark', 'aria-hidden': 'true' }, '◔'), 'Tally'),
    ...SIDEBAR.map((r) => link(r, 'navlink')), h('div', { class: 'spacer' }), theme, h('div', { class: 'privacy-note' }, icon('lock', 16), 'Your data stays on this device.'));
  const bottom = h('nav', { class: 'bottomnav', 'aria-label': 'Main' }, ...MOBILE.map((r) => link(r, '')));
  const fab = h('button', { class: 'fab', 'aria-label': 'Add expense', title: 'Add expense (N)', onclick: () => openExpenseModal() }, icon('plus', 22), h('span', null, 'Add'));
  const app = h('div', { class: 'app' }, sidebar, main);
  return { app, main, sidebar, bottom, fab };
}

function render() {
  cancelAnimationFrame(raf);
  const route = currentRoute();
  const kind = route === 'setup' ? 'wizard' : 'app';
  const prevScroll = window.scrollY;
  const focusId = document.activeElement?.id;
  if (kind !== 'wizard') setMoneyOverride(null);
  if (kind === 'wizard') {
    if (shellKind !== 'wizard') { clear(root); shellKind = 'wizard'; shell = null; }
    let view;
    try { view = renderWizard(); } catch (e) { view = errorCard(e); }
    clear(root).append(view);
    document.title = 'Tally · Setup';
    if (lastRoute !== route) window.scrollTo(0, 0);
    lastRoute = route;
    return;
  }
  if (shellKind !== 'app') { shell = buildShell(); clear(root).append(shell.app, shell.bottom, shell.fab); shellKind = 'app'; }
  const [title, fn] = ROUTES[route];
  let page;
  try { page = fn(); } catch (e) { console.error(e); page = errorCard(e); }
  clear(shell.main).append(page);
  document.title = `Tally · ${title}`;
  document.querySelectorAll('[data-route]').forEach((a) => (a.dataset.route === route ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current')));
  const err = store.getError();
  if (err) shell.main.prepend(h('div', { class: 'banner bad', role: 'alert', style: { margin: '12px 16px 0' } }, h('div', { class: 'grow' }, err)));
  if (lastRoute !== route) { window.scrollTo(0, 0); lastRoute = route; if (!anyModalOpen()) shell.main.focus({ preventScroll: true }); }
  else { window.scrollTo(0, prevScroll); if (focusId) document.getElementById(focusId)?.focus({ preventScroll: true }); }
  maybeBrowserNotify();
}

function errorCard(e) {
  return h('div', { class: 'page' }, h('div', { class: 'card' }, h('h2', null, 'Something went wrong'), h('p', { class: 'muted', style: { margin: '8px 0 14px' } }, 'This screen could not be displayed. Your data is safe on this device.'), h('pre', { class: 'small muted', style: { whiteSpace: 'pre-wrap' } }, String(e?.message || e)),
    h('div', { class: 'row' }, h('button', { class: 'btn primary', onclick: () => { location.hash = '#/dashboard'; location.reload(); } }, 'Reload'))));
}

function schedule() { cancelAnimationFrame(raf); raf = requestAnimationFrame(render); }

function dayCheck() {
  const t = todayStr();
  if (t === lastDay) return;
  const wasCurrent = ui.ym === monthOf(lastDay);
  lastDay = t;
  store.dayRollover();
  if (wasCurrent) ui.ym = monthOf(t);
  render();
}

export async function boot() {
  root.setAttribute('aria-busy', 'true');
  let info;
  try { info = await store.load(); } catch (e) { console.error(e); }
  applyTheme(state().settings.theme || 'auto');
  setRerender(render);
  store.subscribe(schedule);
  window.addEventListener('hashchange', render);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') dayCheck(); });
  setInterval(dayCheck, 60 * 1000);
  document.addEventListener('keydown', (e) => {
    if (e.key.toLowerCase() === 'n' && !e.metaKey && !e.ctrlKey && !e.altKey && !anyModalOpen() && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName || '') && shellKind === 'app') { e.preventDefault(); openExpenseModal(); }
  });
  root.removeAttribute('aria-busy');
  render();
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) navigator.serviceWorker.register('./sw.js').catch(() => {});
}
