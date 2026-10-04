// First-run setup wizard.
import { h, icon, clear, field, moneyInput, selectEl, toast, confirmDialog } from '../ui.js';
import { parseMoney, toInput, fmt, pctToAmount, cleanLocale } from '../money.js';
import { SUGGESTED, suggestBudget, uid } from '../model.js';
import { allocation, planIncome, setBudget as _sb } from '../calc.js';
import * as store from '../store.js';
import { ui, go, rerender, setMoneyOverride } from '../ctx.js';
import { budgetEditor, allocationMeter, allocationDonut } from '../budget-editor.js';
import { openCategoryModal } from '../components.js';
import { todayStr, monthOf } from '../dates.js';

export const CURRENCIES = [['EUR', 'Euro (€)'], ['USD', 'US dollar ($)'], ['GBP', 'British pound (£)'], ['CHF', 'Swiss franc (CHF)'], ['SEK', 'Swedish krona (kr)'], ['NOK', 'Norwegian krone (kr)'], ['DKK', 'Danish krone (kr)'], ['PLN', 'Polish złoty (zł)'], ['CZK', 'Czech koruna (Kč)'], ['HUF', 'Hungarian forint (Ft)'], ['RON', 'Romanian leu (lei)'], ['TRY', 'Turkish lira (₺)'], ['CAD', 'Canadian dollar ($)'], ['AUD', 'Australian dollar ($)'], ['NZD', 'New Zealand dollar ($)'], ['INR', 'Indian rupee (₹)'], ['BRL', 'Brazilian real (R$)'], ['MXN', 'Mexican peso ($)'], ['ZAR', 'South African rand (R)'], ['AED', 'UAE dirham (AED)']];
export const LOCALES = [['', 'Automatic (this device)'], ['en-US', 'English (US) 1,234.56'], ['en-GB', 'English (UK) 1,234.56'], ['de-DE', 'Deutsch 1.234,56'], ['fr-FR', 'Français 1 234,56'], ['es-ES', 'Español 1.234,56'], ['it-IT', 'Italiano 1.234,56'], ['nl-NL', 'Nederlands 1.234,56'], ['pt-PT', 'Português 1 234,56'], ['sv-SE', 'Svenska 1 234,56'], ['pl-PL', 'Polski 1 234,56'], ['tr-TR', 'Türkçe 1.234,56']];
const PRESETS = [['Rent', 'housing', 1], ['Phone', 'bills', 5], ['Internet', 'bills', 8], ['Netflix', 'subs', 12], ['Spotify', 'subs', 14], ['Gym', 'subs', 3], ['Insurance', 'bills', 15], ['Transit pass', 'transport', 2]];

const W = { step: 0, setup: null, draft: null, sig: '' };
function fresh() {
  const loc = cleanLocale(navigator.language);
  const guess = /-(US)$/.test(loc) ? 'USD' : /-(GB)$/.test(loc) ? 'GBP' : /-(CH)$/.test(loc) ? 'CHF' : 'EUR';
  W.step = 0; W.draft = null; W.sig = '';
  W.setup = { name: '', currency: guess, locale: loc, income: 0, incomeName: 'Main job', payDay: 25, savingsStart: 0, emergencyStart: 0, savingsTarget: 0, debts: [], recurring: [] };
}
export function resetWizard() { W.setup = null; }

export function renderWizard() {
  if (!W.setup) fresh();
  setMoneyOverride((c, o) => fmt(c, W.setup.currency, W.setup.locale, o));
  const root = h('div', { class: 'wizard' });
  const total = 5;
  root.append(h('div', { class: 'row spread', style: { marginBottom: '14px' } },
    h('div', { class: 'brand', style: { padding: 0 } }, h('div', { class: 'brand-mark' }, '◔'), 'Tally'),
    store.getState().mode === 'demo' ? h('button', { class: 'link', onclick: () => go('dashboard') }, 'Back to demo') : null),
  h('div', { class: 'steps', 'aria-label': `Step ${W.step + 1} of ${total}` }, Array.from({ length: total }, (_, i) => h('i', { class: i <= W.step ? 'on' : '' }))));
  const steps = [stepIncome, stepSavings, stepRecurring, stepAllocate, stepReady];
  root.append(steps[W.step](root));
  return root;
}

const next = () => { W.step++; rerender(); window.scrollTo(0, 0); };
const back = () => { W.step--; rerender(); window.scrollTo(0, 0); };
const nav = (onNext, { nextLabel = 'Continue', skip = null } = {}) => h('div', { class: 'row spread', style: { marginTop: '18px' } },
  W.step > 0 ? h('button', { class: 'btn ghost', onclick: back }, 'Back') : h('span'),
  h('div', { class: 'row' }, skip ? h('button', { class: 'btn ghost', onclick: skip }, 'Skip') : null, h('button', { class: 'btn primary', onclick: onNext }, nextLabel)));

function stepIncome() {
  const S = W.setup;
  const name = h('input', { class: 'input', value: S.name, placeholder: 'Optional', maxlength: 30, autocomplete: 'given-name' });
  const inc = moneyInput({ value: S.income ? toInput(S.income) : '', big: true, 'data-autofocus': '' });
  const incF = field('Monthly NET salary (after tax)', inc, { hint: 'What actually arrives in your account each month.' });
  const cur = selectEl(CURRENCIES, S.currency);
  const loc = selectEl(LOCALES, LOCALES.some(([v]) => v === S.locale) ? S.locale : '');
  const src = h('input', { class: 'input', value: S.incomeName, maxlength: 40 });
  const day = h('input', { class: 'input', type: 'number', min: 1, max: 31, value: S.payDay, inputmode: 'numeric' });
  const dayF = field('Salary payment day', day, { hint: 'Day of the month your salary arrives (used for “days until payday”).' });
  const go1 = () => {
    const v = parseMoney(inc.value);
    if (!Number.isFinite(v) || v <= 0) return incF.setError('Enter your monthly net salary, for example 2200.');
    const d = parseInt(day.value, 10);
    if (!(d >= 1 && d <= 31)) return dayF.setError('Enter a day between 1 and 31.');
    Object.assign(S, { income: v, name: name.value.trim(), currency: cur.value, locale: loc.value || cleanLocale(navigator.language), incomeName: src.value.trim() || 'Main job', payDay: d });
    next();
  };
  const form = h('form', { onsubmit: (e) => { e.preventDefault(); go1(); } },
    h('h1', null, 'Let’s put your salary to work.'), h('p', { class: 'muted', style: { marginBottom: '18px' } }, 'Takes about two minutes. Everything stays on this device.'),
    field('What should we call you?', name), incF, h('div', { class: 'form-row' }, field('Currency', cur), field('Number format', loc)),
    h('div', { class: 'form-row' }, field('Income source', src), dayF), h('button', { type: 'submit', hidden: true }));
  return h('div', null, h('div', { class: 'card' }, form),
    nav(go1, { nextLabel: 'Continue' }),
    store.getState().mode !== 'demo' ? h('p', { class: 'muted small', style: { textAlign: 'center', marginTop: '26px' } }, 'Just looking around? ', h('button', { class: 'link', onclick: () => { store.startDemo(); resetWizard(); go('dashboard'); } }, 'Explore with demo data')) : null,
    h('div', { class: 'privacy-note', style: { justifyContent: 'center' } }, icon('lock', 16), 'Your financial data stays on this device unless you choose to export or sync it.'));
}

function stepSavings() {
  const S = W.setup;
  const sav = moneyInput({ value: S.savingsStart ? toInput(S.savingsStart) : '' });
  const emg = moneyInput({ value: S.emergencyStart ? toInput(S.emergencyStart) : '' });
  const tgt = moneyInput({ value: S.savingsTarget ? toInput(S.savingsTarget) : '' });
  const savF = field('Current savings', sav), emgF = field('…of which emergency fund', emg, { hint: 'Money you would only touch in a real emergency.' }), tgtF = field('Desired monthly savings', tgt);
  const debts = S.debts;
  const dwrap = h('div');
  const draw = () => {
    clear(dwrap);
    debts.forEach((d, i) => {
      const nm = h('input', { class: 'input', value: d.name, placeholder: 'e.g. Credit card', maxlength: 40, 'aria-label': 'Debt name', oninput: () => { d.name = nm.value; } });
      const bal = moneyInput({ value: d.balance ? toInput(d.balance) : '', placeholder: 'Balance', 'aria-label': 'Debt balance', oninput: () => { const v = parseMoney(bal.value); d.balance = Number.isFinite(v) ? Math.max(0, v) : 0; } });
      const pay = moneyInput({ value: d.payment ? toInput(d.payment) : '', placeholder: 'Monthly payment', 'aria-label': 'Monthly payment', oninput: () => { const v = parseMoney(pay.value); d.payment = Number.isFinite(v) ? Math.max(0, v) : 0; } });
      dwrap.append(h('div', { class: 'card tight', style: { marginBottom: '10px' } }, h('div', { class: 'form-row' }, nm, bal), h('div', { class: 'row', style: { marginTop: '8px' } }, h('div', { class: 'grow' }, pay), h('button', { class: 'icon-btn danger', 'aria-label': 'Remove debt', onclick: () => { debts.splice(i, 1); draw(); } }, icon('trash')))));
    });
  };
  draw();
  const go2 = () => {
    const parse = (el, f) => { if (el.value.trim() === '') return 0; const v = parseMoney(el.value); if (!Number.isFinite(v) || v < 0) { f.setError('Enter a valid amount or leave it empty.'); return null; } f.setError(''); return v; };
    const a = parse(sav, savF), b = parse(emg, emgF), c = parse(tgt, tgtF);
    if (a == null || b == null || c == null) return;
    if (b > a) return emgF.setError('This cannot be more than your current savings.');
    Object.assign(S, { savingsStart: a, emergencyStart: b, savingsTarget: c });
    next();
  };
  return h('div', null, h('div', { class: 'card' }, h('h1', null, 'Savings & debts'), h('p', { class: 'muted', style: { marginBottom: '16px' } }, 'All optional. Skip anything you prefer not to enter now; you can add it later.'),
    savF, emgF, tgtF, h('h3', { style: { margin: '16px 0 8px' } }, 'Existing debts'), dwrap,
    h('button', { class: 'btn small', onclick: () => { debts.push({ name: '', balance: 0, payment: 0 }); draw(); } }, icon('plus', 16), 'Add a debt')),
  nav(go2, { skip: () => next() }));
}

function stepRecurring() {
  const S = W.setup;
  const list = h('div');
  const draw = () => {
    clear(list);
    S.recurring.forEach((r, i) => {
      const nm = h('input', { class: 'input', value: r.name, maxlength: 40, 'aria-label': 'Name', oninput: () => { r.name = nm.value; } });
      const amt = moneyInput({ value: r.amount ? toInput(r.amount) : '', 'aria-label': 'Monthly amount', oninput: () => { const v = parseMoney(amt.value); r.amount = Number.isFinite(v) ? Math.max(0, v) : 0; } });
      const cat = selectEl([...SUGGESTED.filter((c) => c.kind !== 'savings').map((c) => [c.key, `${c.icon} ${c.name}`])], r.categoryKey, { 'aria-label': 'Category', onchange: () => { r.categoryKey = cat.value; } });
      const day = h('input', { class: 'input', type: 'number', min: 1, max: 31, value: r.day, 'aria-label': 'Day of month', oninput: () => { r.day = Math.min(31, Math.max(1, parseInt(day.value, 10) || 1)); } });
      list.append(h('div', { class: 'card tight', style: { marginBottom: '10px' } }, h('div', { class: 'form-row' }, nm, amt), h('div', { class: 'form-row', style: { marginTop: '8px' } }, cat, h('div', { class: 'row' }, h('span', { class: 'muted small' }, 'on day'), h('div', { class: 'grow' }, day), h('button', { class: 'icon-btn danger', 'aria-label': `Remove ${r.name || 'item'}`, onclick: () => { S.recurring.splice(i, 1); draw(); } }, icon('trash'))))));
    });
  };
  draw();
  const go3 = () => {
    const bad = S.recurring.find((r) => !r.name.trim() || !(r.amount > 0));
    if (bad) return toast('Give each recurring expense a name and an amount, or remove it.', { kind: 'bad' });
    next();
  };
  return h('div', null, h('div', { class: 'card' }, h('h1', null, 'Recurring monthly expenses'), h('p', { class: 'muted', style: { marginBottom: '14px' } }, 'Rent, phone, subscriptions… we will add them automatically every month and make sure your budget covers them.'),
    h('div', { class: 'chips', style: { marginBottom: '14px' } }, PRESETS.map(([n, k, d]) => h('button', { class: 'chip', onclick: () => { S.recurring.push({ name: n, amount: 0, categoryKey: k, day: d }); draw(); } }, '+ ' + n))), list,
    h('button', { class: 'btn small', onclick: () => { S.recurring.push({ name: '', amount: 0, categoryKey: 'bills', day: 1 }); draw(); } }, icon('plus', 16), 'Add custom')),
  nav(go3, { skip: () => { S.recurring = []; next(); } }));
}

function draftModel(draft, onChange) {
  return {
    categories: () => draft.categories,
    plan: () => draft.plan,
    setBudget: (id, mode, value) => { draft.plan.budgets[id] = { mode, value }; },
    move: (id, idx) => { const i = draft.categories.findIndex((c) => c.id === id); const [c] = draft.categories.splice(i, 1); draft.categories.splice(idx, 0, c); },
    edit: (c) => openCategoryModal({ category: c, adapter, onDone: () => { editor.rebuild(); onChange(true); } }),
    add: () => openCategoryModal({ adapter, onDone: () => { editor.rebuild(); onChange(true); } }),
  };
}
let editor, adapter;

function stepAllocate() {
  const S = W.setup;
  const sig = JSON.stringify([S.currency, S.savingsTarget, S.debts, S.recurring]);
  if (!W.draft) { W.draft = suggestBudget(S); W.sig = sig; }
  else if (W.sig !== sig) { W.draft = suggestBudget(S); W.sig = sig; }
  const draft = W.draft;
  draft.plan.sources = [{ id: 'src1', name: S.incomeName, amount: S.income, payDay: S.payDay }];
  const money = (c) => fmt(c, S.currency, S.locale);
  const meterBox = h('div');
  const donut = allocationDonut();
  const refresh = () => {
    const a = allocation({ categories: draft.categories }, draft.plan);
    clear(meterBox).append(allocationMeter(a));
    donut.update(a);
  };
  adapter = {
    categories: () => draft.categories,
    update: (id, patch) => Object.assign(draft.categories.find((c) => c.id === id), patch),
    add: (patch) => { const c = { id: uid(), key: 'c' + uid(), notes: '', ...patch }; draft.categories.push(c); draft.plan.budgets[c.id] = { mode: 'amount', value: 0 }; },
    remove: async (cat, done) => {
      if (draft.categories.length <= 1) return;
      if (await confirmDialog({ title: `Delete “${cat.name}”?`, text: 'It will be removed from your plan.', confirmLabel: 'Delete', danger: true })) {
        draft.categories = draft.categories.filter((c) => c.id !== cat.id); delete draft.plan.budgets[cat.id];
        S.recurring.forEach((r) => { if (r.categoryKey === cat.key) r.categoryKey = 'other'; });
        done?.();
      }
    },
  };
  const model = draftModel(draft, (structural) => { if (structural) editor.rebuild(); refresh(); });
  editor = budgetEditor({ model, onChange: () => refresh() });
  refresh();
  const go4 = () => {
    const a = allocation({ categories: draft.categories }, draft.plan);
    if (a.over) return toast(`Your budget is ${money(-a.unallocated)} over your income. Lower a category to continue.`, { kind: 'bad' });
    next();
  };
  return h('div', null,
    h('div', { class: 'big-claim', style: { margin: '6px 0 6px' } }, `Your ${money(S.income).replace(/\.00$/, '')} salary needs a job.`),
    h('p', { class: 'muted', style: { marginBottom: '14px' } }, 'We suggested a split. Rename, reorder or change anything. Type an amount or a percentage; the other one is calculated for you.'),
    h('div', { class: 'card alloc-meter glass' }, meterBox),
    h('div', { class: 'card', style: { marginTop: '14px' } }, donut.el),
    h('div', { class: 'card', style: { marginTop: '14px' } }, h('div', { class: 'card-head' }, h('h2', null, 'Categories')), editor.el),
    nav(go4, { nextLabel: 'Review my plan' }));
}

function stepReady() {
  const S = W.setup, draft = W.draft;
  const money = (c) => fmt(c, S.currency, S.locale);
  const a = allocation({ categories: draft.categories }, draft.plan);
  const sum = (kindFn) => a.rows.filter((r) => kindFn(r.cat)).reduce((x, r) => x + r.amount, 0);
  const planned = sum((c) => c.kind !== 'savings'), savings = sum((c) => c.kind === 'savings');
  const un = a.unallocated;
  const finish = () => {
    store.finishSetup(S, draft);
    setMoneyOverride(null);
    resetWizard();
    ui.ym = monthOf(todayStr());
    go('dashboard');
    toast('Your monthly plan is ready. Add your first expense with the + button.');
  };
  const line = (label, value, cls = '') => h('div', { class: 'answer' }, h('q', null, label), h('b', { class: cls }, value));
  return h('div', null, h('div', { class: 'card' }, h('div', { class: 'big-claim' }, 'Your monthly plan is ready.'),
    h('div', { style: { margin: '16px 0 6px' } }, line('Income', money(S.income)), line('Planned expenses', money(planned)), line('Savings', money(savings), 'good'), line('Unallocated', money(un), un > 0 ? 'warn' : 'good')),
    un > 0 ? h('div', { class: 'banner', style: { marginTop: '10px' } }, icon('info'), h('div', { class: 'grow' }, h('b', null, `What does the ${money(un)} unallocated mean?`), 'It is money without a job. It is not spent or saved, so it is the easiest money to waste. You can go back and assign it, or keep it as a buffer for surprises.')) : null),
    h('div', { class: 'row spread', style: { marginTop: '18px' } }, h('button', { class: 'btn ghost', onclick: back }, 'Adjust plan'), h('button', { class: 'btn primary', onclick: finish, 'data-autofocus': '' }, 'Open my dashboard')));
}
