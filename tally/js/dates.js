// Timezone-proof date helpers. Dates are 'YYYY-MM-DD' strings, months are 'YYYY-MM'.
import { cleanLocale } from './money.js';
const pad = (n, w = 2) => String(n).padStart(w, '0');

export const parseYmd = (s) => { const [y, m, d] = s.split('-').map(Number); return { y, m, d }; };
export const ymd = (y, m, d) => `${pad(y, 4)}-${pad(m)}-${pad(d)}`;
export const toDays = (s) => { const { y, m, d } = parseYmd(s); return Math.round(Date.UTC(y, m - 1, d) / 86400000); };
export const fromDays = (n) => { const dt = new Date(n * 86400000); return ymd(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate()); };
export const addDays = (s, n) => fromDays(toDays(s) + n);
export const diffDays = (a, b) => toDays(a) - toDays(b);
export const daysInMonth = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate();
export const monthOf = (s) => s.slice(0, 7);
export const dayOf = (s) => Number(s.slice(8, 10));
export const dow = (s) => new Date(toDays(s) * 86400000).getUTCDay(); // 0 = Sunday

export function todayStr(now = new Date()) {
  return ymd(now.getFullYear(), now.getMonth() + 1, now.getDate());
}
export const ymParts = (ym) => { const [y, m] = ym.split('-').map(Number); return { y, m }; };
export const ymMake = (y, m) => `${pad(y, 4)}-${pad(m)}`;
export function addMonths(ym, n) {
  const { y, m } = ymParts(ym);
  const t = y * 12 + (m - 1) + n;
  return ymMake(Math.floor(t / 12), (t % 12) + 1);
}
export const monthDiff = (a, b) => { const A = ymParts(a), B = ymParts(b); return (A.y - B.y) * 12 + (A.m - B.m); };
export const firstOfMonth = (ym) => ym + '-01';
export const lastOfMonth = (ym) => { const { y, m } = ymParts(ym); return ymd(y, m, daysInMonth(y, m)); };
export const monthLen = (ym) => { const { y, m } = ymParts(ym); return daysInMonth(y, m); };
/** Date in month `ym` on day `d`, clamped to the month's length (31st in Feb -> 28/29). */
export function clampDay(ym, d) { return ym + '-' + pad(Math.min(Math.max(1, d), monthLen(ym))); }
export function monthRange(from, to) {
  const out = [];
  for (let m = from; monthDiff(m, to) <= 0; m = addMonths(m, 1)) out.push(m);
  return out;
}

export function validYmd(s) {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const { y, m, d } = parseYmd(s);
  return m >= 1 && m <= 12 && d >= 1 && d <= daysInMonth(y, m);
}

/** Next date strictly after `today` whose day-of-month is `payDay` (clamped). */
export function nextPayday(today, payDay) {
  const ym = monthOf(today);
  const thisMonth = clampDay(ym, payDay);
  if (diffDays(thisMonth, today) > 0) return thisMonth;
  return clampDay(addMonths(ym, 1), payDay);
}

export function fmtDate(s, locale = 'en', opts = { day: 'numeric', month: 'short' }) {
  const { y, m, d } = parseYmd(s);
  return new Intl.DateTimeFormat(cleanLocale(locale), { ...opts, timeZone: 'UTC' }).format(new Date(Date.UTC(y, m - 1, d)));
}
export function fmtMonth(ym, locale = 'en', opts = { month: 'long', year: 'numeric' }) {
  const { y, m } = ymParts(ym);
  return new Intl.DateTimeFormat(cleanLocale(locale), { ...opts, timeZone: 'UTC' }).format(new Date(Date.UTC(y, m - 1, 1)));
}
export function weekdayName(i, locale = 'en', width = 'short') {
  return new Intl.DateTimeFormat(cleanLocale(locale), { weekday: width, timeZone: 'UTC' }).format(new Date(Date.UTC(2023, 0, 1 + i)));
}
