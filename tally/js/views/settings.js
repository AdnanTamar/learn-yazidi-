import { h, icon, clear, field, moneyInput, selectEl, modal, toast, confirmDialog, segmented, download } from '../ui.js';
import * as store from '../store.js';
import { ui, cs, state, money, date, today, go, curMonth, rerender } from '../ctx.js';
import { planFor, planIncome, ALERT_TYPES } from '../calc.js';
import { expensesToCsv } from '../csv.js';
import { parseMoney, toInput, cleanLocale } from '../money.js';
import { openIncomeModal } from '../components.js';
import { openImportModal } from '../import.js';
import { CURRENCIES, LOCALES, resetWizard } from './wizard.js';
import { uid } from '../model.js';
import { applyTheme } from '../theme.js';

const switchRow = (id, label, checked, onChange, hint) => h('div', { class: 'switch' }, h('div', null, h('label', { for: id }, label), hint ? h('div', { class: 'small muted' }, hint) : null), h('input', { type: 'checkbox', id, checked, onchange: (e) => onChange(e.target.checked) }));

export function renderSettings() {
  const st = state();
  const page = h('div', { class: 'page' });
  page.append(h('div', { class: 'page-head' }, h('div', null, h('h1', null, 'Settings'), h('div', { class: 'sub' }, 'Your data, your rules'))));
  const grid = h('div', { class: 'grid cols-2' }), L = h('div', { class: 'stack' }), R = h('div', { class: 'stack' });

  /* explore (mobile quick links) */
  L.append(h('div', { class: 'card' }, h('div', { class: 'card-head' }, h('h2', null, 'Explore')), h('div', { class: 'list' }, [['recurring', 'Recurring expenses', 'Rent, subscriptions, annual cost'], ['insights', 'Insights', 'Health score, alerts, money leaks'], ['planner', 'Planner', 'Can I afford it? What-if simulator'], ['history', 'History & annual overview', 'Month by month and the whole year']].map(([r, t, s]) => h('button', { class: 'item', onclick: () => go(r) }, icon(r, 20), h('div', { class: 'grow' }, h('div', { class: 'title' }, t), h('div', { class: 'meta' }, s)), icon('chevR', 18))))));

  /* profile */
  const name = h('input', { class: 'input', value: st.profile.name || '', maxlength: 30, placeholder: 'Optional', onchange: () => store.setProfile({ name: name.value.trim() }) });
  const cur = selectEl(CURRENCIES, st.profile.currency, { onchange: () => store.setProfile({ currency: cur.value }) });
  const loc = selectEl(LOCALES, LOCALES.some(([v]) => v === st.profile.locale) ? st.profile.locale : '', { onchange: () => store.setProfile({ locale: loc.value || cleanLocale(navigator.language) }) });
  L.append(h('div', { class: 'card' }, h('div', { class: 'card-head' }, h('h2', null, 'Profile & format')), field('Name', name), h('div', { class: 'form-row' }, field('Currency', cur, { hint: 'Changing it only changes how amounts are displayed.' }), field('Number & date format', loc))));

  /* income */
  const plan = planFor(st, curMonth());
  L.append(h('div', { class: 'card' }, h('div', { class: 'card-head' }, h('h2', null, 'Income'), h('button', { class: 'btn small', onclick: () => openIncomeModal(curMonth()) }, icon('edit', 16), 'Edit')),
    plan.sources.length ? h('div', { class: 'list' }, plan.sources.map((x) => h('div', { class: 'item' }, h('div', { class: 'grow' }, h('div', { class: 'title' }, x.name), h('div', { class: 'meta' }, `Paid on day ${x.payDay}`)), h('div', { class: 'amt' }, money(x.amount))))) : h('p', { class: 'muted' }, 'No income yet.'),
    h('div', { class: 'row spread', style: { marginTop: '10px' } }, h('span', { class: 'muted' }, 'Total monthly income'), h('b', null, money(planIncome(plan)))),
    h('p', { class: 'muted small', style: { marginTop: '8px' } }, 'Had a different salary this month? Edit it and choose “This month only”. Earlier months are never rewritten.')));

  /* money basics */
  const sav = moneyInput({ value: toInput(st.profile.savingsStart) }); const savF = field('Savings balance before using Tally', sav);
  sav.addEventListener('change', () => { const v = parseMoney(sav.value || '0'); if (!Number.isFinite(v) || v < 0) return savF.setError('Enter a valid amount.'); savF.setError(''); store.setProfile({ savingsStart: v }); });
  const rate = h('input', { class: 'input', type: 'number', min: 1, max: 90, value: st.settings.savingsRateTarget, onchange: () => { const v = Math.min(90, Math.max(1, parseInt(rate.value, 10) || 20)); store.setSettings({ savingsRateTarget: v }); } });
  const leak = moneyInput({ value: toInput(st.settings.leakThreshold) }); const leakF = field('“Small purchase” limit (money leaks)', leak, { hint: 'Everyday purchases up to this amount count as small purchases.' });
  leak.addEventListener('change', () => { const v = parseMoney(leak.value); if (!Number.isFinite(v) || v < 100) return leakF.setError('Enter at least 1.00'); leakF.setError(''); store.setSettings({ leakThreshold: v }); });
  const debtsList = h('div', { class: 'list' });
  const drawDebts = () => { clear(debtsList); const d = state().profile.debts; if (!d.length) debtsList.append(h('p', { class: 'muted small' }, 'No debts recorded.')); d.forEach((x) => debtsList.append(h('div', { class: 'item' }, h('div', { class: 'grow' }, h('div', { class: 'title' }, x.name), h('div', { class: 'meta' }, x.payment ? `${money(x.payment)}/month` : 'No monthly payment')), h('div', { class: 'amt' }, money(x.balance))))); };
  drawDebts();
  L.append(h('div', { class: 'card' }, h('div', { class: 'card-head' }, h('h2', null, 'Savings & debts'), h('button', { class: 'btn small', onclick: debtsModal }, icon('edit', 16), 'Edit debts')), savF, field('Savings-rate goal (%)', rate, { hint: 'Used for the health score and savings alerts.' }), leakF, h('h3', { style: { fontSize: '14px', margin: '8px 0' } }, 'Debts'), debtsList));

  /* appearance */
  R.append(h('div', { class: 'card' }, h('div', { class: 'card-head' }, h('h2', null, 'Appearance')), segmented([['auto', 'Auto'], ['light', 'Light'], ['dark', 'Dark']], st.settings.theme || 'auto', (v) => { store.setSettings({ theme: v }); applyTheme(v); }, 'Theme')));

  /* notifications */
  const n = st.settings.notifications;
  const types = h('div', null, Object.entries(ALERT_TYPES).map(([k, label]) => switchRow('nt-' + k, label, n.types[k] !== false, (v) => store.commit((s) => { s.settings.notifications.types[k] = v; }, { silent: true }))));
  R.append(h('div', { class: 'card' }, h('div', { class: 'card-head' }, h('h2', null, icon('bell', 18), ' Alerts')),
    switchRow('n-on', 'Show alerts', n.enabled, (v) => { store.commit((s) => { s.settings.notifications.enabled = v; }); }, 'Budget warnings, pace, recurring payments, rules'), n.enabled ? types : null,
    'Notification' in window ? switchRow('n-br', 'Browser notifications', n.browser && Notification.permission === 'granted', async (v) => {
      if (v && Notification.permission !== 'granted') { const p = await Notification.requestPermission(); if (p !== 'granted') { toast('Notifications were not allowed in your browser.', { kind: 'bad' }); return rerender(); } }
      store.commit((s) => { s.settings.notifications.browser = v; });
    }, 'Optional pop-ups for serious alerts while Tally is open') : null));

  /* data */
  const restore = h('input', { type: 'file', accept: '.json,application/json', class: 'sr-only', id: 'restore', 'aria-label': 'Restore JSON backup' });
  restore.addEventListener('change', async () => {
    const f = restore.files?.[0]; if (!f) return;
    try {
      const obj = JSON.parse(await f.text());
      if (!(await confirmDialog({ title: 'Restore this backup?', text: 'This replaces ALL data currently in Tally on this device.', confirmLabel: 'Restore', danger: true }))) return;
      const warnings = await store.restoreBackup(obj);
      toast('Backup restored.' + (warnings.length ? ' ' + warnings.join(' ') : ''));
    } catch (e) { toast(e.message || 'That file could not be restored.', { kind: 'bad', timeout: 7000 }); }
    restore.value = '';
  });
  R.append(h('div', { class: 'card' }, h('div', { class: 'card-head' }, h('h2', null, 'Import & export')),
    h('div', { class: 'stack', style: { gap: '10px' } },
      h('div', { class: 'row wrap' }, h('button', { class: 'btn', onclick: () => download(`tally-expenses-${today()}.csv`, expensesToCsv(state()), 'text/csv') }, icon('download', 16), 'Export CSV'), h('button', { class: 'btn', onclick: openImportModal }, icon('upload', 16), 'Import CSV')),
      h('div', { class: 'row wrap' }, h('button', { class: 'btn', onclick: async () => { download(`tally-backup-${today()}.json`, JSON.stringify(await store.makeBackup(), null, 2), 'application/json'); toast('Backup downloaded.'); } }, icon('download', 16), 'JSON backup'), h('label', { class: 'btn', for: 'restore' }, icon('upload', 16), 'Restore JSON'), restore),
      h('p', { class: 'muted small' }, 'CSV import works with bank statement exports. No bank login or connection is needed; you map the columns and categories yourself.'))));

  /* privacy */
  const mode = store.getPersistMode();
  R.append(h('div', { class: 'card' }, h('div', { class: 'privacy-card' }, icon('lock', 22), h('div', null, h('h2', { style: { fontSize: '16px', marginBottom: '6px' } }, 'Privacy'), h('p', null, 'Your financial data stays on this device unless you choose to export or sync it.'), h('p', { class: 'muted small', style: { marginTop: '6px' } }, `Stored in: ${{ indexeddb: 'this browser (IndexedDB)', localstorage: 'this browser (localStorage fallback)', memory: 'memory only: data will be lost when you close this tab' }[mode]}. No accounts, no analytics, no servers. Clearing site data in your browser erases it, so keep a JSON backup.`)))));

  /* danger */
  R.append(h('div', { class: 'card' }, h('div', { class: 'card-head' }, h('h2', null, 'Reset')), h('p', { class: 'muted small', style: { marginBottom: '10px' } }, 'Erase everything on this device and start over with the setup.'),
    h('button', { class: 'btn danger', onclick: async () => { if (await confirmDialog({ title: 'Erase all data?', text: 'All expenses, budgets, goals and settings on this device will be deleted. Export a backup first if you might need it.', confirmLabel: 'Erase everything', danger: true })) { await store.resetAll(); resetWizard(); go('setup'); } } }, icon('trash', 16), 'Erase all data')));
  grid.append(L, R); page.append(grid);
  return page;

  function debtsModal() {
    const rows = state().profile.debts.map((d) => ({ ...d })); const list = h('div');
    const draw = () => { clear(list); rows.forEach((d, i) => { const nm = h('input', { class: 'input', value: d.name, maxlength: 40, 'aria-label': 'Debt name', placeholder: 'Name', oninput: () => { d.name = nm.value; } }); const bal = moneyInput({ value: toInput(d.balance), 'aria-label': 'Balance', placeholder: 'Balance', oninput: () => { const v = parseMoney(bal.value); d.balance = Number.isFinite(v) ? Math.max(0, v) : 0; } }); const pay = moneyInput({ value: d.payment ? toInput(d.payment) : '', 'aria-label': 'Monthly payment', placeholder: 'Monthly payment', oninput: () => { const v = parseMoney(pay.value); d.payment = Number.isFinite(v) ? Math.max(0, v) : 0; } }); list.append(h('div', { class: 'card tight', style: { marginBottom: '10px' } }, h('div', { class: 'form-row' }, nm, bal), h('div', { class: 'row', style: { marginTop: '8px' } }, h('div', { class: 'grow' }, pay), h('button', { class: 'icon-btn danger', 'aria-label': 'Remove debt', onclick: () => { rows.splice(i, 1); draw(); } }, icon('trash'))))); }); };
    draw();
    const m = modal({ title: 'Debts', body: h('div', null, list, h('button', { class: 'btn small', onclick: () => { rows.push({ id: uid(), name: '', balance: 0, payment: 0 }); draw(); } }, icon('plus', 16), 'Add debt'), h('p', { class: 'muted small', style: { marginTop: '10px' } }, 'Debts affect your financial health score. Add the monthly payment to your budget as a fixed category or recurring expense.')), footer: [h('button', { class: 'btn ghost', onclick: () => m.close() }, 'Cancel'), h('button', { class: 'btn primary', onclick: () => { store.saveDebts(rows.filter((d) => d.name.trim() || d.balance > 0).map((d) => ({ ...d, name: d.name.trim() || 'Debt' }))); m.close(); } }, 'Save')] });
  }
}
