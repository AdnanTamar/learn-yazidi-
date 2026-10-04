// Shared components & modals used by several views.
import { h, icon, modal, toast, field, moneyInput, selectEl, segmented, clear, confirmDialog } from './ui.js';
import * as store from './store.js';
import { ui, today, state, money, date, monthName, catOf, setMonth, shiftMonth, curMonth, rerender, pct } from './ctx.js';
import { parseMoney, toInput } from './money.js';
import { addDays, addMonths, monthOf, validYmd, ymParts, ymMake, lastOfMonth, clampDay } from './dates.js';
import { PAYMENT_METHODS, FREQUENCIES, planFor, monthSummary, goalCurrent } from './calc.js';
import { COLORS, ICONS } from './model.js';

export const avatar = (cat, size) => h('div', { class: 'avatar', style: { background: cat.color + '26', color: cat.color, ...(size ? { width: size + 'px', height: size + 'px' } : {}) }, 'aria-hidden': 'true' }, cat.icon);

export function statCard({ label, value, sub, cls = '', accent, valueCls = '', onClick, extra }) {
  const tag = onClick ? 'button' : 'div';
  return h(tag, { class: 'card stat ' + cls + (onClick ? ' interactive' : ''), onclick: onClick, type: onClick ? 'button' : null },
    accent ? h('i', { class: 'accent-bar', style: { background: accent } }) : null,
    h('div', { class: 'label' }, label), h('div', { class: 'value ' + valueCls }, value), sub ? h('div', { class: 'sub' }, sub) : null, extra || null);
}

/* ───── month switcher ───── */
export function monthSwitcher({ compact = false } = {}) {
  const cur = curMonth();
  return h('div', { class: 'monthbar', role: 'group', 'aria-label': 'Month' },
    h('button', { class: 'icon-btn', 'aria-label': 'Previous month', onclick: () => shiftMonth(-1) }, icon('chevL')),
    h('button', { class: 'label', 'aria-label': `${monthName(ui.ym)}. Choose month`, onclick: openMonthPicker }, monthName(ui.ym, compact ? { month: 'short', year: 'numeric' } : undefined)),
    h('button', { class: 'icon-btn', 'aria-label': 'Next month', disabled: ui.ym >= cur, onclick: () => shiftMonth(1) }, icon('chevR')));
}
export function openMonthPicker() {
  let year = ymParts(ui.ym).y;
  const cur = curMonth(), maxYear = ymParts(cur).y;
  const body = h('div');
  const m = modal({ title: 'Choose a month', body });
  const draw = () => {
    const st = state();
    clear(body).append(
      h('div', { class: 'row spread', style: { marginBottom: '12px' } },
        h('button', { class: 'icon-btn', 'aria-label': 'Previous year', onclick: () => { year--; draw(); } }, icon('chevL')),
        h('strong', { 'aria-live': 'polite' }, year),
        h('button', { class: 'icon-btn', 'aria-label': 'Next year', disabled: year >= maxYear, onclick: () => { year++; draw(); } }, icon('chevR'))),
      h('div', { class: 'month-grid' }, Array.from({ length: 12 }, (_, i) => {
        const ym = ymMake(year, i + 1);
        const has = st.months[ym] || st.expenses.some((e) => e.date.startsWith(ym));
        const spent = has ? monthSummary(st, ym).spent : null;
        return h('button', { 'aria-pressed': String(ym === ui.ym), disabled: ym > cur, onclick: () => { setMonth(ym); m.close(); } },
          monthName(ym, { month: 'long' }), h('small', null, spent != null ? money(spent, { compact: true }) : '—'));
      })));
  };
  draw();
}

/* ───── receipts ───── */
export async function fileToReceipt(file) {
  if (!file.type.startsWith('image/')) throw new Error('Please choose an image file.');
  if (file.size > 15 * 1024 * 1024) throw new Error('That image is too large (max 15 MB).');
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, 1280 / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas');
  c.width = Math.round(bmp.width * scale); c.height = Math.round(bmp.height * scale);
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', 0.72);
}
export async function showReceipt(id) {
  const url = await store.getReceipt(id);
  if (!url) return toast('Receipt not found.', { kind: 'bad' });
  modal({ title: 'Receipt', body: h('img', { src: url, alt: 'Receipt photo', style: { maxWidth: '100%', borderRadius: '12px' } }) });
}

/* ───── expense modal (add / edit) ───── */
export function openExpenseModal({ expense = null, preset = {} } = {}) {
  const st = state();
  if (!st.categories.length) return toast('Create a category first (Budget tab).', { kind: 'bad' });
  const editing = !!expense;
  const nonDefault = st.categories.find((c) => c.id === ui.lastCategory) || st.categories.find((c) => c.kind === 'variable') || st.categories[0];
  let catId = expense?.categoryId || preset.categoryId || nonDefault.id;
  let method = expense?.method || ui.lastMethod || 'Debit card';
  let picked = editing;
  let receiptData = null, receiptRemoved = false, hadReceipt = !!expense?.hasReceipt;
  const defaultDate = (() => {
    if (expense) return expense.date;
    const t = today();
    return monthOf(t) === ui.ym ? t : lastOfMonth(ui.ym);
  })();

  const amount = moneyInput({ big: true, value: expense ? toInput(expense.amount) : preset.amount ? toInput(preset.amount) : '', 'data-autofocus': '', 'aria-label': 'Amount', enterkeyhint: 'done' });
  const amountField = field('Amount', amount);
  const dateIn = h('input', { type: 'date', class: 'input', value: defaultDate, max: '2100-12-31', min: '2000-01-01' });
  const dateField = field('Date', dateIn);
  const desc = h('input', { type: 'text', class: 'input', value: expense?.description || preset.description || '', placeholder: 'e.g. Coffee, Rent, Netflix', maxlength: 80, list: 'recent-desc', autocomplete: 'off' });
  const recent = [...new Map(st.expenses.slice(-400).reverse().filter((e) => e.description).map((e) => [e.description.toLowerCase(), e])).values()].slice(0, 40);
  const dl = h('datalist', { id: 'recent-desc' }, recent.map((e) => h('option', { value: e.description })));
  const catErr = h('div', { class: 'field-error', role: 'alert' });
  const catWrap = h('div', { class: 'cat-pick', role: 'radiogroup', 'aria-label': 'Category' });
  const fundSel = h('select', { class: 'input', 'aria-label': 'Savings goal' });
  const fundField = field('Put towards', fundSel);
  const drawFunds = () => {
    clear(fundSel).append(h('option', { value: '' }, 'General savings'), h('option', { value: 'emergency' }, '🛟 Emergency fund'), ...state().goals.map((g) => h('option', { value: g.id }, `${g.icon || '🎯'} ${g.name}`)));
    const c = catOf(catId);
    fundSel.value = expense?.fundId ?? (c?.fund === 'emergency' ? 'emergency' : preset.fundId || '');
  };
  const drawCats = () => {
    clear(catWrap).append(...st.categories.map((c) => h('button', { type: 'button', role: 'radio', 'aria-checked': String(c.id === catId), 'aria-pressed': String(c.id === catId), onclick: () => { catId = c.id; picked = true; drawCats(); catErr.textContent = ''; } },
      h('span', { 'aria-hidden': 'true' }, c.icon), h('span', { class: 'n' }, c.name))));
    const c = catOf(catId);
    fundField.hidden = c?.kind !== 'savings';
    savingsNote.hidden = c?.kind !== 'savings';
    if (c?.kind === 'savings') drawFunds();
    recurWrap.hidden = !!expense?.recurringId;
  };
  desc.addEventListener('change', () => {
    if (picked) return;
    const hit = recent.find((e) => e.description.toLowerCase() === desc.value.trim().toLowerCase());
    if (hit && catOf(hit.categoryId)) { catId = hit.categoryId; method = hit.method || method; drawCats(); drawMethods(); }
  });
  const savingsNote = h('p', { class: 'hint muted small', style: { margin: '-4px 0 10px' } }, 'Savings are moved aside, not counted as spent.');
  const methodWrap = h('div', { class: 'chips', role: 'radiogroup', 'aria-label': 'Payment method' });
  const drawMethods = () => { clear(methodWrap).append(...PAYMENT_METHODS.map((m) => h('button', { type: 'button', class: 'chip', role: 'radio', 'aria-checked': String(m === method), 'aria-pressed': String(m === method), onclick: () => { method = m; drawMethods(); } }, m))); };
  const repeat = h('input', { type: 'checkbox', id: 'rep' });
  const freq = selectEl(Object.entries(FREQUENCIES).map(([k, v]) => [k, v.label]), 'monthly', { 'aria-label': 'Repeat frequency' });
  freq.hidden = true;
  repeat.addEventListener('change', () => { freq.hidden = !repeat.checked; });
  const recurWrap = h('div', { class: 'row', style: { margin: '4px 0 12px' } }, repeat, h('label', { for: 'rep', class: 'grow' }, 'Repeats (recurring expense)'), freq);
  const note = expense?.recurringId ? h('p', { class: 'hint muted small' }, '🔁 Generated from a recurring payment. Edit the recurring item on the Recurring page to change future payments.') : null;
  const rec = h('input', { type: 'file', accept: 'image/*', capture: 'environment', class: 'sr-only', id: 'rcpt', 'aria-label': 'Attach receipt photo' });
  const prev = h('img', { class: 'receipt-prev', alt: 'Receipt preview', hidden: true });
  const rmBtn = h('button', { type: 'button', class: 'btn small ghost', hidden: true, onclick: () => { receiptData = null; receiptRemoved = true; hadReceipt = false; prev.hidden = true; rmBtn.hidden = true; rec.value = ''; } }, 'Remove receipt');
  rec.addEventListener('change', async () => {
    const f = rec.files?.[0]; if (!f) return;
    try { receiptData = await fileToReceipt(f); prev.src = receiptData; prev.hidden = false; rmBtn.hidden = false; receiptRemoved = false; }
    catch (e) { toast(e.message || 'Could not read that image.', { kind: 'bad' }); rec.value = ''; }
  });
  if (hadReceipt) store.getReceipt(expense.id).then((u) => { if (u) { prev.src = u; prev.hidden = false; rmBtn.hidden = false; } });
  const recBox = h('div', null, h('label', { class: 'btn small ghost', for: 'rcpt' }, icon('camera', 16), 'Receipt photo (optional)'), rec, rmBtn, prev);

  const quick = h('div', { class: 'chips', style: { marginTop: '-4px', marginBottom: '8px' } },
    [['Today', today()], ['Yesterday', addDays(today(), -1)]].map(([l, d]) => h('button', { type: 'button', class: 'chip', onclick: () => { dateIn.value = d; } }, l)));

  const validate = () => {
    let ok = true;
    const a = parseMoney(amount.value);
    if (!Number.isFinite(a) || a <= 0) { amountField.setError('Enter an amount greater than 0.'); ok = false; }
    else if (a > 99999999999) { amountField.setError('That amount is too large.'); ok = false; } else amountField.setError('');
    if (!validYmd(dateIn.value)) { dateField.setError('Pick a valid date.'); ok = false; } else dateField.setError('');
    if (!catOf(catId)) { catErr.textContent = 'Choose a category.'; ok = false; }
    return ok ? { amount: a } : null;
  };
  const save = async (again) => {
    const v = validate(); if (!v) return;
    const c = catOf(catId);
    const data = { date: dateIn.value, amount: v.amount, categoryId: catId, description: desc.value.trim(), method };
    if (c.kind === 'savings') data.fundId = fundSel.value || null; else data.fundId = null;
    if (!data.fundId) delete data.fundId;
    try {
      let id;
      if (editing) { store.updateExpense(expense.id, { ...data, fundId: data.fundId || undefined }); id = expense.id; if (!data.fundId) store.commit((s) => { delete s.expenses.find((e) => e.id === id).fundId; }, { silent: true }); }
      else id = store.addExpense(data, { recurring: repeat.checked ? freq.value : null }).id;
      if (receiptData) { await store.putReceipt(id, receiptData); store.updateExpense(id, { hasReceipt: true }); }
      else if (receiptRemoved && editing) { await store.deleteReceipt(id); store.commit((s) => { delete s.expenses.find((e) => e.id === id).hasReceipt; }); }
    } catch (e) { return toast(e.message || 'Could not save.', { kind: 'bad' }); }
    ui.lastCategory = catId; ui.lastMethod = method;
    if (monthOf(data.date) > curMonth()) { /* future-dated: stays visible on its own month */ }
    toast(editing ? 'Expense updated.' : `Added ${money(v.amount)} to ${c.name}.`, editing ? {} : { action: 'Undo', onAction: () => store.deleteExpense(state().expenses[state().expenses.length - 1]?.id) });
    if (again && !editing) { amount.value = ''; desc.value = ''; amount.focus(); rerender(); } else m.close();
  };
  const del = editing ? h('button', { class: 'btn danger ghost', style: { marginRight: 'auto', color: 'var(--bad)' }, onclick: async () => {
    if (await confirmDialog({ title: 'Delete this expense?', text: `${money(expense.amount)} · ${expense.description || catOf(expense.categoryId)?.name}`, confirmLabel: 'Delete', danger: true })) { store.deleteExpense(expense.id); m.close(); toast('Expense deleted.'); }
  } }, icon('trash', 16), 'Delete') : null;
  const body = h('form', { onsubmit: (e) => { e.preventDefault(); save(false); } }, amountField, h('div', { class: 'field' }, h('label', null, 'Category'), catWrap, catErr), savingsNote, fundField,
    dateField, quick, field('Description', desc), dl, h('div', { class: 'field' }, h('label', null, 'Payment method'), methodWrap), editing ? note : recurWrap, recBox,
    h('button', { type: 'submit', hidden: true }));
  const m = modal({ title: editing ? 'Edit expense' : 'Add expense', body, footer: [del, h('button', { class: 'btn ghost', onclick: () => m.close() }, 'Cancel'), editing ? null : h('button', { class: 'btn', onclick: () => save(true) }, 'Save & add another'), h('button', { class: 'btn primary', onclick: () => save(false) }, editing ? 'Save changes' : 'Save expense')] });
  drawCats(); drawMethods();
  return m;
}

/* ───── income modal ───── */
export function openIncomeModal(ym = ui.ym) {
  const plan = planFor(state(), ym);
  const rows = plan.sources.map((x) => ({ ...x }));
  const isCur = ym === curMonth();
  let scope = isCur ? 'future' : 'month';
  const list = h('div');
  const total = h('strong');
  const err = h('div', { class: 'field-error', role: 'alert' });
  const redraw = () => {
    clear(list);
    if (!rows.length) list.append(h('p', { class: 'muted' }, 'No income yet. Add your salary below.'));
    rows.forEach((r, i) => {
      const name = h('input', { class: 'input', value: r.name, placeholder: 'Main job, Freelance…', 'aria-label': 'Income source name', maxlength: 40, oninput: () => { r.name = name.value; } });
      const amt = moneyInput({ value: toInput(r.amount), 'aria-label': 'Monthly amount (net)', oninput: () => { const v = parseMoney(amt.value); r.amount = Number.isFinite(v) ? v : 0; r._bad = !Number.isFinite(v) && amt.value.trim() !== ''; sum(); } });
      const day = h('input', { class: 'input', type: 'number', min: 1, max: 31, value: r.payDay || 1, 'aria-label': 'Payment day of month', oninput: () => { r.payDay = Math.min(31, Math.max(1, parseInt(day.value, 10) || 1)); } });
      list.append(h('div', { class: 'card tight', style: { marginBottom: '10px' } },
        h('div', { class: 'form-row' }, h('div', { class: 'field' }, h('label', null, 'Source'), name), h('div', { class: 'field' }, h('label', null, 'Net amount'), amt)),
        h('div', { class: 'row spread' }, h('div', { class: 'field', style: { margin: 0, flex: 1 } }, h('label', null, 'Paid on day of month'), day),
          h('button', { class: 'icon-btn danger', 'aria-label': `Remove ${r.name || 'income source'}`, onclick: () => { rows.splice(i, 1); redraw(); } }, icon('trash')))));
    });
    sum();
  };
  const sum = () => { total.textContent = money(rows.reduce((a, r) => a + (r.amount || 0), 0)); };
  redraw();
  const scopeSel = isCur ? segmented([['month', 'This month only'], ['future', 'This month & future']], scope, (v) => { scope = v; }, 'Apply to') : h('p', { class: 'hint muted small' }, 'You are editing a past month. Other months are not affected.');
  const body = h('div', null,
    h('p', { class: 'muted small', style: { marginBottom: '12px' } }, 'Enter your NET (after-tax) income. Budgets set as a percentage update automatically. Earlier months keep their own income.'),
    list, h('button', { class: 'btn small', onclick: () => { rows.push({ id: 'src' + Math.random().toString(36).slice(2, 7), name: '', amount: 0, payDay: 1 }); redraw(); } }, icon('plus', 16), 'Add income source'),
    h('div', { class: 'row spread', style: { margin: '14px 0 6px' } }, h('span', null, 'Total monthly income'), total), err,
    h('div', { style: { marginTop: '10px' } }, scopeSel));
  const m = modal({ title: `Income · ${monthName(ym)}`, body, footer: [h('button', { class: 'btn ghost', onclick: () => m.close() }, 'Cancel'), h('button', { class: 'btn primary', onclick: () => {
    if (rows.some((r) => r._bad)) return (err.textContent = 'One of the amounts is not a valid number.');
    const clean = rows.filter((r) => r.name.trim() || r.amount > 0).map((r) => ({ id: r.id, name: r.name.trim() || 'Income', amount: Math.max(0, r.amount || 0), payDay: r.payDay || 1 }));
    store.setIncome(ym, clean, scope);
    m.close(); toast('Income updated. Percentage budgets were recalculated.');
  } }, 'Save income')] });
}

/* ───── category modal ───── */
export function openCategoryModal({ category = null, onDone, adapter = null } = {}) {
  const st = state();
  const names = () => (adapter ? adapter.categories() : st.categories);
  const c = category ? { ...category } : { name: '', icon: '📦', color: COLORS[names().length % COLORS.length], kind: 'variable', essential: false, sub: false, notes: '' };
  const name = h('input', { class: 'input', value: c.name, maxlength: 30, placeholder: 'e.g. Groceries', 'data-autofocus': '' });
  const nameField = field('Name', name);
  const icons = h('div', { class: 'chips', role: 'radiogroup', 'aria-label': 'Icon' });
  const colors = h('div', { class: 'chips', role: 'radiogroup', 'aria-label': 'Color' });
  const draw = () => {
    clear(icons).append(...ICONS.map((i) => h('button', { type: 'button', class: 'chip', role: 'radio', 'aria-checked': String(i === c.icon), 'aria-pressed': String(i === c.icon), 'aria-label': 'Icon ' + i, onclick: () => { c.icon = i; draw(); } }, i)));
    clear(colors).append(...COLORS.map((col) => h('button', { type: 'button', class: 'chip', role: 'radio', 'aria-checked': String(col === c.color), 'aria-pressed': String(col === c.color), 'aria-label': 'Color ' + col, onclick: () => { c.color = col; draw(); } }, h('span', { class: 'dot', style: { background: col } }), col === c.color ? '✓' : '')));
  };
  draw();
  const kind = segmented([['fixed', 'Fixed'], ['variable', 'Variable'], ['savings', 'Savings']], c.kind, (v) => { c.kind = v; }, 'Type');
  const essential = h('input', { type: 'checkbox', checked: !!c.essential, id: 'ess' });
  const sub = h('input', { type: 'checkbox', checked: !!c.sub, id: 'subc' });
  const notes = h('textarea', { class: 'input', maxlength: 300, placeholder: 'Optional notes' }, c.notes || '');
  const body = h('div', null, nameField, h('div', { class: 'field' }, h('label', null, 'Icon'), icons), h('div', { class: 'field' }, h('label', null, 'Color'), colors),
    h('div', { class: 'field' }, h('label', null, 'Type'), kind, h('div', { class: 'hint' }, 'Fixed = same every month (rent, insurance). Variable = you control it (food, shopping). Savings = money you set aside.')),
    h('div', { class: 'switch' }, h('label', { for: 'ess' }, 'Essential (counts towards emergency fund target)'), essential),
    h('div', { class: 'switch' }, h('label', { for: 'subc' }, 'Subscriptions category (used for subscription totals)'), sub),
    field('Notes', notes));
  const del = category ? h('button', { class: 'btn ghost', style: { marginRight: 'auto', color: 'var(--bad)' }, onclick: () => (adapter ? adapter.remove(category, () => { m.close(); onDone?.(); }) : deleteCategoryFlow(category, () => { m.close(); onDone?.(); })) }, icon('trash', 16), 'Delete') : null;
  const m = modal({ title: category ? 'Edit category' : 'New category', body, footer: [del, h('button', { class: 'btn ghost', onclick: () => m.close() }, 'Cancel'), h('button', { class: 'btn primary', onclick: () => {
    const n = name.value.trim();
    if (!n) return nameField.setError('Give the category a name.');
    if (names().some((x) => x.id !== category?.id && x.name.toLowerCase() === n.toLowerCase())) return nameField.setError('You already have a category with this name.');
    const patch = { name: n, icon: c.icon, color: c.color, kind: kind.get(), essential: essential.checked, sub: sub.checked, notes: notes.value.trim() };
    if (adapter) { if (category) adapter.update(category.id, patch); else adapter.add(patch); }
    else if (category) store.updateCategory(category.id, patch); else store.addCategory(patch);
    m.close(); onDone?.();
  } }, 'Save')] });
}

export async function deleteCategoryFlow(category, done) {
  const st = state();
  const others = st.categories.filter((c) => c.id !== category.id);
  if (!others.length) return toast('You need at least one category.', { kind: 'bad' });
  const used = st.expenses.filter((e) => e.categoryId === category.id).length + st.recurring.filter((r) => r.categoryId === category.id).length;
  if (!used) {
    if (await confirmDialog({ title: `Delete “${category.name}”?`, text: 'This category has no expenses.', confirmLabel: 'Delete', danger: true })) { store.deleteCategory(category.id, others[0].id); done?.(); rerender(); }
    return;
  }
  const sel = selectEl(others.map((c) => [c.id, `${c.icon} ${c.name}`]), (others.find((c) => c.name === 'Other') || others[0]).id);
  const m = modal({ title: `Delete “${category.name}”?`, body: h('div', null, h('p', { class: 'muted', style: { marginBottom: '12px' } }, `${used} expense${used === 1 ? '' : 's'} / recurring item${used === 1 ? '' : 's'} use this category. Move them to:`), field('Move to', sel)),
    footer: [h('button', { class: 'btn ghost', onclick: () => m.close() }, 'Cancel'), h('button', { class: 'btn danger', onclick: () => { store.deleteCategory(category.id, sel.value); m.close(); done?.(); rerender(); toast('Category deleted.'); } }, 'Delete category')] });
}

/* ───── expense list item ───── */
export function expenseItem(e, onClick) {
  const c = catOf(e.categoryId) || { icon: '❔', color: '#999', name: 'Unknown', kind: 'variable' };
  const saved = c.kind === 'savings';
  return h('button', { class: 'item', type: 'button', onclick: onClick, 'aria-label': `${e.description || c.name}, ${money(e.amount)}, ${date(e.date)}. Edit` },
    avatar(c), h('div', { class: 'grow' }, h('div', { class: 'title' }, e.description || c.name),
      h('div', { class: 'meta' }, [c.name, e.method, e.recurringId ? '🔁 recurring' : null, e.hasReceipt ? '📎 receipt' : null].filter(Boolean).join(' · '))),
    h('div', { class: 'amt' }, saved ? h('span', { class: 'good' }, (e.amount < 0 ? '' : '→ ') + money(e.amount)) : money(e.amount), saved ? h('div', { class: 'meta' }, e.amount < 0 ? 'withdrawn' : 'saved') : null));
}
export { pct, goalCurrent };
