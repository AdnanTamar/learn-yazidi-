// State shape, setup/demo builders, validation. Pure (no DOM / storage).
import { addDays, addMonths, clampDay, dayOf, monthOf, validYmd, ymd, parseYmd, monthLen } from './dates.js';
import { rollover, fitToIncome, allocation, planIncome } from './calc.js';
import { amountToBp, pctToAmount } from './money.js';
import { t } from './i18n.js';
import { AR } from './i18n-ar.js';

export const VERSION = 1;
let counter = 0;
export const uid = () => Date.now().toString(36) + (counter++).toString(36) + Math.random().toString(36).slice(2, 6);

export const COLORS = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#3d9a3d', '#6a5ae0', '#e34948', '#2aa6b8', '#a0715a', '#6b7a99', '#8bb82e'];
export const ICONS = ['🏠', '🍽️', '🚗', '💡', '📺', '🛍️', '🎬', '🩺', '🧴', '🏦', '🛟', '📦', '💳', '☕', '✈️', '🎓', '👶', '🐶', '🎁', '🏋️', '📱', '🔧', '⛽', '🍺', '🎮', '📚', '💼', '🧾'];

// bp = basis points of income (1200 = 12%)
export const SUGGESTED = [
  { key: 'housing', name: 'Housing', icon: '🏠', color: COLORS[0], kind: 'fixed', essential: true, bp: 2800 },
  { key: 'food', name: 'Food', icon: '🍽️', color: COLORS[1], kind: 'variable', essential: true, bp: 1200 },
  { key: 'transport', name: 'Transportation', icon: '🚗', color: COLORS[2], kind: 'variable', essential: true, bp: 800 },
  { key: 'bills', name: 'Bills', icon: '💡', color: COLORS[3], kind: 'fixed', essential: true, bp: 800 },
  { key: 'subs', name: 'Subscriptions', icon: '📺', color: COLORS[4], kind: 'fixed', sub: true, bp: 300 },
  { key: 'shopping', name: 'Shopping', icon: '🛍️', color: COLORS[5], kind: 'variable', bp: 600 },
  { key: 'fun', name: 'Entertainment', icon: '🎬', color: COLORS[6], kind: 'variable', bp: 500 },
  { key: 'health', name: 'Health', icon: '🩺', color: COLORS[7], kind: 'variable', essential: true, bp: 400 },
  { key: 'personal', name: 'Personal', icon: '🧴', color: COLORS[8], kind: 'variable', bp: 300 },
  { key: 'savings', name: 'Savings', icon: '🏦', color: COLORS[9], kind: 'savings', bp: 1000 },
  { key: 'emergency', name: 'Emergency Fund', icon: '🛟', color: COLORS[10], kind: 'savings', fund: 'emergency', bp: 500 },
  { key: 'other', name: 'Other', icon: '📦', color: COLORS[11], kind: 'variable', bp: 400 },
];

export function defaultSettings() {
  return {
    theme: 'auto', language: null, leakThreshold: 1500, savingsRateTarget: 20,
    notifications: {
      enabled: true, browser: false,
      types: { budget: true, pace: true, low: true, recurring: true, savings: true, trend: true, rules: true, plan: true },
    },
    dismissed: {},
  };
}

export function emptyState() {
  return {
    version: VERSION, mode: 'empty',
    profile: { currency: 'EUR', locale: 'en', name: '', savingsStart: 0, debts: [], createdAt: null },
    settings: defaultSettings(),
    template: { sources: [], budgets: {} },
    months: {}, categories: [], expenses: [], recurring: [], goals: [], rules: [],
    emergency: { start: 0, targetMonths: 3, essentialOverride: null },
  };
}

/* ───────────── Setup wizard ───────────── */

/** Suggest categories + budgets for a salary, honouring recurring items, a savings target and debts. */
export function suggestBudget(setup) {
  const income = setup.income || 0;
  const categories = SUGGESTED.map((c) => ({ ...c, name: t(c.name), id: uid(), notes: '' }));
  const debtPay = (setup.debts || []).reduce((a, d) => a + (d.payment || 0), 0);
  if (debtPay > 0) categories.splice(4, 0, { key: 'debt', name: t('Debt payments'), icon: '💳', color: '#c2410c', kind: 'fixed', essential: true, bp: 0, id: uid(), notes: '' });
  const plan = { sources: [{ id: 'src1', name: setup.incomeName || t('Main job'), amount: income, payDay: setup.payDay || 1 }], budgets: {} };
  for (const c of categories) {
    const rec = (setup.recurring || []).filter((r) => r.categoryKey === c.key).reduce((a, r) => a + r.amount, 0);
    const def = pctToAmount(income, c.bp);
    if (c.key === 'savings' && setup.savingsTarget > 0) plan.budgets[c.id] = { mode: 'amount', value: setup.savingsTarget };
    else if (c.key === 'debt') plan.budgets[c.id] = { mode: 'amount', value: debtPay };
    else if (rec > def) plan.budgets[c.id] = { mode: 'amount', value: rec };
    else plan.budgets[c.id] = { mode: 'percent', value: c.bp };
  }
  const tmp = { categories };
  fitToIncome(tmp, plan);
  return { categories, plan };
}

/** Build the persisted state from wizard answers and the (edited) budget draft. */
export function buildState(setup, draft, today, newId = uid) {
  const s = emptyState();
  s.mode = 'user';
  s.profile = {
    currency: setup.currency, locale: setup.locale || 'en', name: setup.name || '',
    savingsStart: setup.savingsStart || 0,
    debts: (setup.debts || []).filter((d) => d.balance > 0 || d.payment > 0).map((d) => ({ id: newId(), name: d.name || 'Debt', balance: d.balance || 0, payment: d.payment || 0 })),
    createdAt: today,
  };
  s.categories = draft.categories.map((c) => ({ ...c }));
  s.template = JSON.parse(JSON.stringify(draft.plan));
  s.emergency.start = Math.min(setup.emergencyStart || 0, setup.savingsStart || 0);
  const catByKey = Object.fromEntries(s.categories.map((c) => [c.key, c]));
  const cur = monthOf(today);
  for (const r of setup.recurring || []) {
    const cat = catByKey[r.categoryKey] || catByKey.other || s.categories[0];
    s.recurring.push({
      id: newId(), name: r.name, amount: r.amount, frequency: 'monthly', categoryId: cat.id,
      startDate: clampDay(cur, r.day || 1), method: 'Bank transfer', active: true, generatedThrough: null,
    });
  }
  const debtCat = catByKey.debt;
  if (debtCat) for (const d of s.profile.debts.filter((x) => x.payment > 0)) {
    s.recurring.push({ id: newId(), name: t('{name} payment', { name: d.name }), amount: d.payment, frequency: 'monthly', categoryId: debtCat.id, startDate: clampDay(cur, 1), method: 'Bank transfer', active: true, generatedThrough: null });
  }
  rollover(s, today, newId);
  return s;
}

/** Rename untouched default categories when the language changes (user-renamed ones are left alone). */
export function relocalizeNames(state, lang) {
  const defaults = { debt: 'Debt payments', ...Object.fromEntries(SUGGESTED.map((c) => [c.key, c.name])) };
  for (const c of state.categories) {
    const en = defaults[c.key];
    if (!en) continue;
    const ar = AR[en];
    if (lang === 'ar' && c.name === en) c.name = ar;
    else if (lang === 'en' && c.name === ar) c.name = en;
  }
}

/* ───────────── Demo data ───────────── */

function mulberry32(a) {
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let x = Math.imul(a ^ (a >>> 15), 1 | a); x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x; return ((x ^ (x >>> 14)) >>> 0) / 4294967296; };
}

export function demoState(today) {
  const rnd = mulberry32(20260101);
  let n = 0;
  const id = () => 'demo' + (n++);
  const setup = {
    currency: 'EUR', locale: 'en', income: 220000, incomeName: t('Main job'), payDay: 25, savingsStart: 150000, savingsTarget: 25000,
    debts: [], recurring: [
      { name: t('Rent'), amount: 65000, categoryKey: 'housing', day: 1 },
      { name: t('Gym'), amount: 2999, categoryKey: 'subs', day: 3 },
      { name: t('Phone'), amount: 2500, categoryKey: 'bills', day: 5 },
      { name: t('Internet'), amount: 2990, categoryKey: 'bills', day: 8 },
      { name: t('Netflix'), amount: 1399, categoryKey: 'subs', day: 12 },
      { name: t('Spotify'), amount: 1099, categoryKey: 'subs', day: 14 },
      { name: t('Insurance'), amount: 4200, categoryKey: 'bills', day: 15 },
      { name: t('Transit pass'), amount: 4900, categoryKey: 'transport', day: 2 },
    ],
  };
  const draft = suggestBudget(setup);
  const s = buildState({ ...setup }, draft, today, id);
  // Re-do recurring from 6 months ago so there is history
  const cur = monthOf(today);
  const first = addMonths(cur, -5);
  s.mode = 'demo';
  s.recurring.forEach((r) => { r.startDate = clampDay(first, dayOf(r.startDate)); r.generatedThrough = null; });
  s.expenses = [];
  s.months = {};
  for (let i = 5; i >= 0; i--) {
    const ym = addMonths(cur, -i);
    const p = JSON.parse(JSON.stringify(s.template));
    if (i === 2) p.sources[0].amount = 245000; // a better month (bonus)
    if (i === 3) p.sources[0].amount = 220000;
    s.months[ym] = p;
  }
  s.profile.name = t('Demo');
  const cat = (key) => s.categories.find((c) => c.key === key).id;
  const pick = (a) => a[Math.floor(rnd() * a.length)];
  const between = (lo, hi) => Math.round((lo + rnd() * (hi - lo)) / 10) * 10;
  const methods = ['Debit card', 'Credit card', 'Cash', 'Apple Pay'];
  const add = (date, amount, key, description, method) => { if (date <= today) s.expenses.push({ id: id(), date, amount, categoryId: cat(key), description: t(description), method: method || pick(methods) }); };
  for (let i = 5; i >= 0; i--) {
    const ym = addMonths(cur, -i), len = monthLen(ym);
    for (let d = 1; d <= len; d++) {
      const date = ym + '-' + String(d).padStart(2, '0');
      const wd = new Date(Date.UTC(parseYmd(date).y, parseYmd(date).m - 1, d)).getUTCDay();
      if (wd === 6 || d % 4 === 0) add(date, between(2200, 6800), 'food', pick(['Supermarket', 'Groceries', 'Bakery & market']));
      if (rnd() < 0.55) add(date, between(300, 520), 'food', pick(['Coffee', 'Coffee', 'Latte']));
      if (rnd() < 0.22) add(date, between(250, 480), 'food', pick(['Snack', 'Vending machine', 'Pastry']));
      if (rnd() < 0.14) add(date, between(850, 1250), 'food', 'Fast food');
      if (rnd() < 0.1) add(date, between(600, 1400), 'food', 'Delivery');
      if (rnd() < 0.12) add(date, between(300, 1200), 'transport', pick(['Taxi', 'Fuel', 'Bike repair']));
      if ((wd === 5 || wd === 6) && rnd() < 0.45) add(date, between(1500, 4800), 'fun', pick(['Cinema', 'Dinner out', 'Drinks', 'Concert']));
      if (rnd() < 0.09) add(date, between(900, 4800), 'shopping', pick(['Clothes', 'Online order', 'Home items', 'Random shopping']));
      if (rnd() < 0.05) add(date, between(1000, 2500), 'personal', pick(['Haircut', 'Toiletries']));
    }
    add(ym + '-10', between(1500, 3500), 'health', 'Pharmacy');
    if (i === 1) add(ym + '-19', 18900, 'shopping', 'Sneakers');
    if (i === 0) add(ym + '-02', 14900, 'shopping', 'Headphones');
    const sd = clampDay(ym, 26);
    s.expenses.push({ id: id(), date: sd, amount: 10000, categoryId: cat('savings'), description: t('iPhone fund'), method: 'Bank transfer', fundId: 'g_iphone' });
    s.expenses.push({ id: id(), date: sd, amount: 5000, categoryId: cat('savings'), description: t('Trip fund'), method: 'Bank transfer', fundId: 'g_travel' });
    s.expenses.push({ id: id(), date: sd, amount: 10000, categoryId: cat('savings'), description: t('Monthly savings'), method: 'Bank transfer' });
    s.expenses.push({ id: id(), date: sd, amount: 11000, categoryId: cat('emergency'), description: t('Emergency top-up'), method: 'Bank transfer', fundId: 'emergency' });
  }
  s.expenses = s.expenses.filter((e) => e.date <= today);
  s.goals = [
    { id: 'g_iphone', name: t('New iPhone'), icon: '📱', target: 160000, start: 80000, deadline: addDays(today, 240), monthly: 10000, created: first },
    { id: 'g_travel', name: t('Summer trip'), icon: '✈️', target: 120000, start: 20000, deadline: addDays(today, 330), monthly: 5000, created: first },
  ];
  s.emergency = { start: 180000, targetMonths: 3, essentialOverride: null };
  s.rules = [
    { id: id(), type: 'maxCategory', categoryId: cat('shopping'), amount: 15000 },
    { id: id(), type: 'minSavings', categoryId: null, amount: 30000 },
  ];
  rollover(s, today, id);
  return s;
}

/* ───────────── Validation / migration (backup restore) ───────────── */

const isInt = (n) => Number.isInteger(n);

/** Returns { state, warnings } or throws Error with a readable message. */
export function sanitizeState(raw) {
  if (!raw || typeof raw !== 'object') throw new Error(t('This file does not look like a Tally backup.'));
  const base = emptyState();
  if (typeof raw.version !== 'number') throw new Error(t('Missing backup version.'));
  if (raw.version > VERSION) throw new Error(t('This backup was made by a newer version of Tally.'));
  const warnings = [];
  const s = { ...base, ...raw };
  s.profile = { ...base.profile, ...(raw.profile || {}) };
  s.settings = { ...base.settings, ...(raw.settings || {}), notifications: { ...base.settings.notifications, ...(raw.settings?.notifications || {}), types: { ...base.settings.notifications.types, ...(raw.settings?.notifications?.types || {}) } } };
  s.emergency = { ...base.emergency, ...(raw.emergency || {}) };
  for (const k of ['categories', 'expenses', 'recurring', 'goals', 'rules']) if (!Array.isArray(s[k])) throw new Error(`Backup is missing "${k}".`);
  if (!s.template || !Array.isArray(s.template.sources) || typeof s.template.budgets !== 'object') throw new Error(t('Backup is missing the budget template.'));
  if (!s.months || typeof s.months !== 'object') s.months = {};
  const catIds = new Set(s.categories.map((c) => c.id));
  const before = s.expenses.length;
  s.expenses = s.expenses.filter((e) => e && typeof e.id === 'string' && isInt(e.amount) && validYmd(e.date) && catIds.has(e.categoryId));
  if (s.expenses.length < before) warnings.push(t('{n} invalid expenses were skipped.', { n: before - s.expenses.length }));
  s.recurring = s.recurring.filter((r) => r && isInt(r.amount) && validYmd(r.startDate) && ['weekly', 'monthly', 'quarterly', 'yearly'].includes(r.frequency) && catIds.has(r.categoryId));
  s.version = VERSION;
  return { state: s, warnings };
}
