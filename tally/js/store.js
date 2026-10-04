// Local-first persistence (IndexedDB, with localStorage fallback) + all state mutations.
import { emptyState, buildState, demoState, sanitizeState, uid, VERSION, relocalizeNames } from './model.js';
import { rollover, ensureMonth, planFor, catById, FREQUENCIES } from './calc.js';
import { todayStr, monthOf, addDays } from './dates.js';
import { fmt as fmtMoney, cleanLocale } from './money.js';
import { setLang, getLang, detectLang, effectiveLocale } from './i18n.js';
import { t } from './i18n.js';

const DB_NAME = 'tally-local';
const LS_KEY = 'tally.state.v1';
let db = null;
let persistMode = 'memory';
let state = emptyState();
let saveTimer = null;
const listeners = new Set();
let lastSaveError = null;

function openDb() {
  return new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) return reject(new Error('IndexedDB unavailable'));
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => { const d = req.result; d.createObjectStore('kv'); d.createObjectStore('receipts'); };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error('IndexedDB blocked'));
  });
}
const tx = (store, mode, fn) => new Promise((resolve, reject) => {
  const trn = db.transaction(store, mode);
  const out = fn(trn.objectStore(store));
  trn.oncomplete = () => resolve(out && 'result' in out ? out.result : undefined);
  trn.onerror = () => reject(trn.error);
  trn.onabort = () => reject(trn.error);
});

export async function load() {
  let raw = null;
  try {
    db = await openDb();
    persistMode = 'indexeddb';
    raw = await tx('kv', 'readonly', (s) => s.get('state'));
    if (!raw) { // migrate from localStorage fallback if present
      const ls = localStorage.getItem(LS_KEY);
      if (ls) raw = JSON.parse(ls);
    }
  } catch {
    db = null;
    try { persistMode = 'localstorage'; const ls = localStorage.getItem(LS_KEY); raw = ls ? JSON.parse(ls) : null; }
    catch { persistMode = 'memory'; }
  }
  if (raw) {
    try { state = sanitizeState(raw).state; }
    catch (err) { console.error('Stored data invalid, starting fresh', err); state = emptyState(); lastSaveError = 'Your saved data could not be read. A fresh start was created.'; }
  }
  try { navigator.storage?.persist?.(); } catch { /* best effort */ }
  initLanguage();
  if (state.mode !== 'empty') rollover(state, todayStr(), uid);
  save();
  return { persistMode, error: lastSaveError };
}

export const getState = () => state;
export const getPersistMode = () => persistMode;
export const getError = () => lastSaveError;
export function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }
const notify = () => listeners.forEach((f) => f());

function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(flush, 120);
}
export async function flush() {
  clearTimeout(saveTimer);
  const snapshot = JSON.parse(JSON.stringify(state));
  try {
    if (db) await tx('kv', 'readwrite', (s) => s.put(snapshot, 'state'));
    else if (persistMode === 'localstorage') localStorage.setItem(LS_KEY, JSON.stringify(snapshot));
    lastSaveError = null;
  } catch (err) {
    lastSaveError = 'Could not save to this device: ' + (err?.message || err);
    console.error(err);
    notify();
  }
}
window.addEventListener('pagehide', () => { flush(); });
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush(); });

/** Run a mutation. {silent:true} saves without re-rendering (used while typing in live editors). */
export function commit(mutator, { silent = false } = {}) {
  mutator(state);
  save();
  if (!silent) notify();
}

/** State view for calc/insight functions (adds money formatter). Not persisted. */
export function calcState() {
  const { currency } = state.profile;
  const locale = effectiveLocale(state.profile.locale);
  return Object.assign(Object.create(null), state, { fmt: (c, compact = false) => fmtMoney(c, currency, locale, { compact }) });
}
export const money = (c, opts) => fmtMoney(c, state.profile.currency, effectiveLocale(state.profile.locale), opts);

/* ───────── receipts ───────── */
export async function putReceipt(id, dataUrl) { if (db) await tx('receipts', 'readwrite', (s) => s.put(dataUrl, id)); else try { localStorage.setItem('tally.receipt.' + id, dataUrl); } catch { throw new Error(t('Not enough storage for this receipt.')); } }
export async function getReceipt(id) {
  if (db) return tx('receipts', 'readonly', (s) => s.get(id));
  return localStorage.getItem('tally.receipt.' + id);
}
export async function deleteReceipt(id) { if (db) await tx('receipts', 'readwrite', (s) => s.delete(id)); else localStorage.removeItem('tally.receipt.' + id); }
export async function allReceipts() {
  if (!db) return {};
  return new Promise((resolve, reject) => {
    const out = {}; const trn = db.transaction('receipts', 'readonly'); const req = trn.objectStore('receipts').openCursor();
    req.onsuccess = () => { const c = req.result; if (c) { out[c.key] = c.value; c.continue(); } else resolve(out); };
    req.onerror = () => reject(req.error);
  });
}
async function clearReceipts() { if (db) await tx('receipts', 'readwrite', (s) => s.clear()); }

/* ───────── language ───────── */
export function initLanguage() {
  let l = state.settings?.language;
  if (!l) { try { l = localStorage.getItem('tally.lang'); } catch { /* optional */ } }
  setLang(l || detectLang(navigator.language));
}
export function setLanguage(l) {
  setLang(l);
  try { localStorage.setItem('tally.lang', getLang()); } catch { /* optional */ }
  commit((s) => {
    s.settings.language = getLang();
    const cur = s.profile.locale || '';
    if (getLang() === 'ar' && !cur.startsWith('ar')) s.profile.locale = 'ar-u-nu-latn';
    if (getLang() === 'en' && cur.startsWith('ar')) { const n = cleanLocale(navigator.language); s.profile.locale = n.startsWith('ar') ? 'en' : n; }
    if (s.mode === 'demo') Object.assign(s, demoState(todayStr()), { settings: s.settings, profile: { ...s.profile, ...demoState(todayStr()).profile, locale: s.profile.locale } });
    else relocalizeNames(s, getLang());
  });
}

/* ───────── lifecycle ───────── */
export function startDemo() { commit((s) => { Object.assign(s, demoState(todayStr())); }); clearReceipts(); }
export function finishSetup(setup, draft) {
  const next = buildState(setup, draft, todayStr());
  next.settings = { ...next.settings, ...(state.settings || {}), language: getLang() };
  commit((s) => { Object.keys(s).forEach((k) => delete s[k]); Object.assign(s, next); });
  clearReceipts(); // demo/previous data must never mix with real data
}
export async function resetAll() { commit((s) => { Object.keys(s).forEach((k) => delete s[k]); Object.assign(s, emptyState()); }); await clearReceipts(); }
export async function restoreBackup(obj) {
  const { state: next, warnings } = sanitizeState(obj.state || obj);
  await clearReceipts();
  if (obj.receipts) for (const [k, v] of Object.entries(obj.receipts)) if (typeof v === 'string' && v.startsWith('data:image/')) await putReceipt(k, v);
  commit((s) => { Object.keys(s).forEach((k) => delete s[k]); Object.assign(s, next); rollover(s, todayStr(), uid); });
  return warnings;
}
export async function makeBackup() {
  return { app: 'tally', format: 'tally-backup', version: VERSION, exportedAt: new Date().toISOString(), state: JSON.parse(JSON.stringify(state)), receipts: await allReceipts() };
}
export function dayRollover() {
  if (state.mode === 'empty') return false;
  const before = JSON.stringify([Object.keys(state.months).length, state.expenses.length]);
  rollover(state, todayStr(), uid);
  const changed = before !== JSON.stringify([Object.keys(state.months).length, state.expenses.length]);
  if (changed) save();
  return changed;
}

/* ───────── expenses ───────── */
export function addExpense(e, { recurring = null } = {}) {
  const exp = { id: uid(), method: 'Debit card', description: '', ...e };
  const cat = catById(state, exp.categoryId);
  if (cat?.fund === 'emergency' && !exp.fundId) exp.fundId = 'emergency';
  commit((s) => {
    ensureMonth(s, monthOf(exp.date));
    if (recurring) {
      const rid = uid();
      s.recurring.push({ id: rid, name: exp.description || cat?.name || 'Recurring', amount: exp.amount, frequency: recurring, categoryId: exp.categoryId, startDate: exp.date, method: exp.method, active: true, generatedThrough: exp.date, fundId: exp.fundId || null });
      exp.recurringId = rid;
    }
    s.expenses.push(exp);
  });
  return exp;
}
export function updateExpense(id, patch) {
  commit((s) => {
    const e = s.expenses.find((x) => x.id === id);
    if (!e) return;
    Object.assign(e, patch);
    ensureMonth(s, monthOf(e.date));
  });
}
export function deleteExpense(id) {
  commit((s) => { s.expenses = s.expenses.filter((e) => e.id !== id); });
  deleteReceipt(id).catch(() => {});
}
export function addExpenses(list) {
  commit((s) => {
    for (const e of list) { ensureMonth(s, monthOf(e.date)); s.expenses.push({ id: uid(), method: 'Other', description: '', ...e }); }
  });
}

/* ───────── recurring ───────── */
export function saveRecurring(rec) {
  commit((s) => {
    const i = s.recurring.findIndex((r) => r.id === rec.id);
    if (i >= 0) s.recurring[i] = { ...s.recurring[i], ...rec };
    else s.recurring.push({ id: uid(), active: true, generatedThrough: null, method: 'Bank transfer', ...rec });
    rollover(s, todayStr(), uid);
  });
}
export function deleteRecurring(id, { keepHistory = true } = {}) {
  commit((s) => {
    s.recurring = s.recurring.filter((r) => r.id !== id);
    if (keepHistory) s.expenses.forEach((e) => { if (e.recurringId === id) delete e.recurringId; });
    else s.expenses = s.expenses.filter((e) => e.recurringId !== id);
  });
}
export function toggleRecurring(id) {
  commit((s) => {
    const r = s.recurring.find((x) => x.id === id);
    if (!r) return;
    r.active = !r.active;
    if (r.active) r.generatedThrough = todayStr(); // resuming never back-fills the paused period
  });
}

/* ───────── categories & budgets ───────── */
export function addCategory(c) {
  const cat = { id: uid(), notes: '', essential: false, kind: 'variable', icon: '📦', color: '#6b7a99', ...c };
  commit((s) => {
    s.categories.push(cat);
    const p = ensureMonth(s, monthOf(todayStr()));
    p.budgets[cat.id] = { mode: 'amount', value: 0 };
    s.template.budgets[cat.id] = { mode: 'amount', value: 0 };
  }, { silent: true });
  return cat;
}
export function updateCategory(id, patch) { commit((s) => { Object.assign(s.categories.find((c) => c.id === id), patch); }, { silent: true }); }
export function moveCategory(id, toIndex) {
  commit((s) => {
    const i = s.categories.findIndex((c) => c.id === id);
    if (i < 0) return;
    const [c] = s.categories.splice(i, 1);
    s.categories.splice(Math.max(0, Math.min(toIndex, s.categories.length)), 0, c);
  }, { silent: true });
}
export function deleteCategory(id, reassignTo) {
  commit((s) => {
    s.expenses.forEach((e) => { if (e.categoryId === id) e.categoryId = reassignTo; });
    s.recurring.forEach((r) => { if (r.categoryId === id) r.categoryId = reassignTo; });
    s.rules = s.rules.filter((r) => r.categoryId !== id);
    s.categories = s.categories.filter((c) => c.id !== id);
    delete s.template.budgets[id];
    // Past months keep their stored budgets; only the current plan drops the category.
    const cur = s.months[monthOf(todayStr())];
    if (cur) delete cur.budgets[id];
  }, { silent: true });
}
/** Edit a budget on a month's plan. If `future`, the template (used for upcoming months) follows. */
export function setBudget(ym, catId, mode, value, future) {
  commit((s) => {
    ensureMonth(s, ym).budgets[catId] = { mode, value };
    if (future) s.template.budgets[catId] = { mode, value };
  }, { silent: true });
}
export function setIncome(ym, sources, scope) {
  commit((s) => {
    ensureMonth(s, ym).sources = JSON.parse(JSON.stringify(sources));
    if (scope === 'future') s.template.sources = JSON.parse(JSON.stringify(sources));
  });
}

/* ───────── goals, emergency ───────── */
export function saveGoal(g) {
  if (g.id == null) { g = { ...g }; delete g.id; }
  commit((s) => {
    const i = s.goals.findIndex((x) => x.id === g.id);
    if (i >= 0) s.goals[i] = { ...s.goals[i], ...g };
    else s.goals.push({ id: uid(), start: 0, monthly: 0, icon: '🎯', created: todayStr(), ...g });
  });
}
export function deleteGoal(id) {
  commit((s) => { s.goals = s.goals.filter((g) => g.id !== id); s.expenses.forEach((e) => { if (e.fundId === id) delete e.fundId; }); });
}
export function savingsCategory(preferEmergency = false) {
  let c = state.categories.find((x) => x.kind === 'savings' && (preferEmergency ? x.fund === 'emergency' : !x.fund));
  c = c || state.categories.find((x) => x.kind === 'savings');
  if (!c) c = addCategory({ name: preferEmergency ? 'Emergency Fund' : 'Savings', icon: preferEmergency ? '🛟' : '🏦', kind: 'savings', fund: preferEmergency ? 'emergency' : undefined, color: '#a0715a' });
  return c;
}
/** Move money into (or out of, when negative) a goal / the emergency fund. Recorded as a savings transaction. */
export function contribute(fundId, amount, date = todayStr(), note = '') {
  const isEm = fundId === 'emergency';
  const cat = savingsCategory(isEm);
  const goal = state.goals.find((g) => g.id === fundId);
  addExpense({ date, amount, categoryId: cat.id, fundId, method: 'Bank transfer', description: note || (amount < 0 ? 'Withdrawal' : isEm ? 'Emergency fund' : goal ? goal.name : 'Savings') });
}

/* ───────── rules, settings ───────── */
export function saveRule(r) { commit((s) => { const i = s.rules.findIndex((x) => x.id === r.id); if (i >= 0) s.rules[i] = r; else s.rules.push({ ...r, id: uid() }); }); }
export function deleteRule(id) { commit((s) => { s.rules = s.rules.filter((r) => r.id !== id); }); }
export function setSettings(patch) { commit((s) => { Object.assign(s.settings, patch); }); }
export function setProfile(patch) { commit((s) => { Object.assign(s.profile, patch); }); }
export function dismissAlert(id, ym) { commit((s) => { s.settings.dismissed[ym + '|' + id] = true; }); }
export function saveEmergency(patch) { commit((s) => { Object.assign(s.emergency, patch); }); }
export function saveDebts(debts) { commit((s) => { s.profile.debts = debts; }); }
export { FREQUENCIES, planFor, addDays };
