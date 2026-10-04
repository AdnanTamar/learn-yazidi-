import { h, icon, clear, emptyState, field, moneyInput, selectEl, modal, toast, confirmDialog } from '../ui.js';
import * as store from '../store.js';
import { cs, state, money, date, today, catOf, go, rerender } from '../ctx.js';
import { FREQUENCIES, annualCost, monthlyCost, nextOccurrence, upcomingRecurring, PAYMENT_METHODS } from '../calc.js';
import { addDays, validYmd } from '../dates.js';
import { parseMoney, toInput } from '../money.js';
import { avatar, statCard } from '../components.js';

export function renderRecurring() {
  const st = cs(), t = today();
  const page = h('div', { class: 'page' });
  const active = st.recurring.filter((r) => r.active);
  const monthly = active.reduce((a, r) => a + monthlyCost(r), 0), yearly = active.reduce((a, r) => a + annualCost(r), 0);
  const fixedM = active.filter((r) => catOf(r.categoryId)?.kind === 'fixed').reduce((a, r) => a + monthlyCost(r), 0);
  const subsM = active.filter((r) => catOf(r.categoryId)?.sub).reduce((a, r) => a + monthlyCost(r), 0);
  page.append(h('div', { class: 'page-head' }, h('div', null, h('h1', null, 'Recurring'), h('div', { class: 'sub' }, 'Rent, phone, subscriptions and anything that repeats')), h('button', { class: 'btn primary', onclick: () => recurringModal() }, icon('plus', 18), 'Add recurring')));
  if (!st.recurring.length) {
    page.append(h('div', { class: 'card' }, emptyState({ icon: '🔁', title: 'No recurring expenses yet', text: 'Add things that repeat (rent, phone, Netflix, gym, insurance). Tally logs them automatically and keeps them out of your safe-to-spend money.', action: h('button', { class: 'btn primary', onclick: () => recurringModal() }, 'Add your first') })));
    return page;
  }
  page.append(h('div', { class: 'banner', style: { marginBottom: '14px' } }, icon('recurring'), h('div', { class: 'grow' }, 'Your recurring expenses cost ', h('b', { style: { display: 'inline' } }, money(monthly)), ' per month and ', h('b', { style: { display: 'inline' } }, money(yearly)), ' per year.')),
    h('div', { class: 'stats', style: { marginBottom: '14px' } }, statCard({ label: 'Per month', value: money(monthly) }), statCard({ label: 'Per year', value: money(yearly) }), statCard({ label: 'Fixed costs / mo', value: money(fixedM) }), statCard({ label: 'Subscriptions / mo', value: money(subsM) }), statCard({ label: 'Active items', value: active.length, sub: `${st.recurring.length - active.length} paused` })));
  const list = h('div', { class: 'card' });
  [...st.recurring].sort((a, b) => (nextOccurrence(a, t) || '9').localeCompare(nextOccurrence(b, t) || '9')).forEach((r) => {
    const c = catOf(r.categoryId); const next = r.active ? nextOccurrence(r, addDays(t, 1)) || nextOccurrence(r, t) : null;
    list.append(h('div', { class: 'item', style: { opacity: r.active ? 1 : 0.55, flexWrap: 'wrap' } }, c ? avatar(c) : null,
      h('div', { class: 'grow' }, h('div', { class: 'title' }, r.name, r.active ? null : h('span', { class: 'badge mute', style: { marginLeft: '8px' } }, 'Paused')),
        h('div', { class: 'meta' }, `${c?.name || ''} · ${r.active ? 'Next ' + (next ? date(next, { weekday: 'short', day: 'numeric', month: 'short' }) : '—') : 'Not active'}`)),
      h('div', { style: { textAlign: 'right' } }, h('div', { class: 'amt' }, `${money(r.amount)}/${{ weekly: 'week', monthly: 'month', quarterly: 'quarter', yearly: 'year' }[r.frequency]}`), h('div', { class: 'meta' }, `${money(annualCost(r))}/year`)),
      h('button', { class: 'icon-btn', 'aria-label': r.active ? `Pause ${r.name}` : `Resume ${r.name}`, title: r.active ? 'Pause' : 'Resume', onclick: () => { store.toggleRecurring(r.id); } }, h('span', { style: { fontSize: '15px' } }, r.active ? '⏸' : '▶️')),
      h('button', { class: 'icon-btn', 'aria-label': `Edit ${r.name}`, onclick: () => recurringModal(r) }, icon('edit')),
      h('button', { class: 'icon-btn danger', 'aria-label': `Delete ${r.name}`, onclick: async () => { if (await confirmDialog({ title: `Delete “${r.name}”?`, text: 'Past payments stay in your history. Future payments will no longer be added.', confirmLabel: 'Delete', danger: true })) { store.deleteRecurring(r.id); toast('Recurring payment deleted.'); } } }, icon('trash'))));
  });
  page.append(list);
  const up = upcomingRecurring(st, t, addDays(t, 30));
  page.append(h('div', { class: 'card', style: { marginTop: '14px' } }, h('div', { class: 'card-head' }, h('h2', null, 'Next 30 days')), up.length ? h('div', { class: 'list' }, up.map((u) => h('div', { class: 'item' }, h('div', { class: 'grow' }, h('div', { class: 'title' }, u.rec.name), h('div', { class: 'meta' }, date(u.date, { weekday: 'long', day: 'numeric', month: 'long' }))), h('div', { class: 'amt' }, money(u.amount))))) : h('p', { class: 'muted' }, 'Nothing due.'), up.length ? h('div', { class: 'row spread', style: { marginTop: '10px', paddingTop: '10px', borderTop: '1px solid var(--line)' } }, h('span', { class: 'muted' }, 'Total due'), h('b', null, money(up.reduce((a, u) => a + u.amount, 0)))) : null));
  return page;
}

export function recurringModal(rec = null) {
  const st = state();
  const name = h('input', { class: 'input', value: rec?.name || '', maxlength: 60, placeholder: 'e.g. Netflix', 'data-autofocus': '' });
  const nameF = field('Name', name);
  const amt = moneyInput({ value: rec ? toInput(rec.amount) : '' }); const amtF = field('Amount', amt);
  const freq = selectEl(Object.entries(FREQUENCIES).map(([k, v]) => [k, v.label]), rec?.frequency || 'monthly');
  const cat = selectEl(st.categories.map((c) => [c.id, `${c.icon} ${c.name}`]), rec?.categoryId || st.categories.find((c) => c.kind === 'fixed')?.id || st.categories[0]?.id);
  const start = h('input', { type: 'date', class: 'input', value: rec?.startDate || today() }); const startF = field(rec ? 'Anchor date (first payment)' : 'First payment date', start, { hint: rec ? 'Changing this only affects future dates.' : 'Past dates are added to your history automatically.' });
  const method = selectEl(PAYMENT_METHODS, rec?.method || 'Bank transfer');
  const m = modal({ title: rec ? 'Edit recurring expense' : 'New recurring expense', body: h('div', null, nameF, h('div', { class: 'form-row' }, amtF, field('Frequency', freq)), field('Category', cat), startF, field('Payment method', method)), footer: [h('button', { class: 'btn ghost', onclick: () => m.close() }, 'Cancel'), h('button', { class: 'btn primary', onclick: () => {
    let ok = true;
    if (!name.value.trim()) { nameF.setError('Give it a name.'); ok = false; } else nameF.setError('');
    const a = parseMoney(amt.value); if (!Number.isFinite(a) || a <= 0) { amtF.setError('Enter an amount greater than 0.'); ok = false; } else amtF.setError('');
    if (!validYmd(start.value)) { startF.setError('Pick a valid date.'); ok = false; } else startF.setError('');
    if (!ok) return;
    const patch = { name: name.value.trim(), amount: a, frequency: freq.value, categoryId: cat.value, startDate: start.value, method: method.value };
    if (rec && patch.startDate !== rec.startDate) patch.generatedThrough = rec.generatedThrough && rec.generatedThrough > today() ? rec.generatedThrough : today();
    store.saveRecurring(rec ? { id: rec.id, ...patch } : patch);
    m.close(); toast(rec ? 'Recurring expense updated.' : 'Recurring expense added.');
  } }, 'Save')] });
}
