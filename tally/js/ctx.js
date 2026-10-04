// Shared UI context: current route/month, formatters and navigation helpers.
import * as store from './store.js';
import { cleanLocale } from './money.js';
import { effectiveLocale } from './i18n.js';
import { todayStr, monthOf, fmtDate, fmtMonth, addMonths } from './dates.js';

export const ui = { ym: monthOf(todayStr()), tab: {}, lastCategory: null, lastMethod: 'Debit card', expenseFilter: { q: '', cat: '', method: '', type: '' }, shown: 80 };
export const today = () => todayStr();
export const curMonth = () => monthOf(todayStr());
export const isCurrent = () => ui.ym === curMonth();
export const state = () => store.getState();
export const cs = () => store.calcState();
let moneyOverride = null;
export const setMoneyOverride = (f) => { moneyOverride = f; };
export const money = (c, opts) => (moneyOverride ? moneyOverride(c, opts) : store.money(c, opts));
export const locale = () => cleanLocale(effectiveLocale(state().profile.locale));
export const date = (d, opts) => fmtDate(d, locale(), opts);
export const monthName = (ym, opts) => fmtMonth(ym, locale(), opts);
export const pct = (n) => `${n % 1 === 0 ? n : n.toFixed(1)}%`;

let rerenderFn = () => {};
export const setRerender = (f) => { rerenderFn = f; };
export const rerender = () => rerenderFn();
export const go = (route) => { if (location.hash === '#/' + route) rerender(); else location.hash = '#/' + route; };
export function setMonth(ym) {
  const cur = curMonth();
  ui.ym = ym > cur ? cur : ym;
  rerender();
}
export const shiftMonth = (n) => setMonth(addMonths(ui.ym, n));
export const catOf = (id) => state().categories.find((c) => c.id === id);
export { plural } from './i18n.js';
