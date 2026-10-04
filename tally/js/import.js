// CSV import (bank statements or Tally's own export) with manual category mapping.
import { h, icon, clear, modal, field, selectEl, toast, segmented } from './ui.js';
import { parseCsv, detectColumns, detectDateFormat, DATE_FORMATS, buildImportRows, suggestCategoryKey } from './csv.js';
import * as store from './store.js';
import { state, money, date, rerender } from './ctx.js';
import { monthOf } from './dates.js';

const SKIP = '__skip__';
const none = [['', '— none —']];

export function openImportModal() {
  const st = state();
  if (!st.categories.length) return toast('Create categories first.', { kind: 'bad' });
  const S = { text: '', rows: [], header: true, map: {}, dateFormat: 'YYYY-MM-DD', negExp: true, groups: [], skipDup: true, split: false };
  const body = h('div');
  const foot = h('div', { class: 'row', style: { width: '100%', justifyContent: 'flex-end', gap: '10px' } });
  const m = modal({ title: 'Import transactions (CSV)', body, wide: true, footer: foot });
  m.el.querySelector('.modal-foot').replaceChildren(foot);

  const setFoot = (...btns) => clear(foot).append(...btns.filter(Boolean));
  const cancel = h('button', { class: 'btn ghost', onclick: () => m.close() }, 'Cancel');

  /* step 1: choose */
  function stepFile() {
    const file = h('input', { type: 'file', accept: '.csv,.txt,text/csv,text/plain', class: 'input', 'aria-label': 'CSV file' });
    const paste = h('textarea', { class: 'input', placeholder: 'Or paste CSV text here…', rows: 6, 'aria-label': 'CSV text' });
    const err = h('div', { class: 'field-error', role: 'alert' });
    const go = (text) => {
      try {
        const rows = parseCsv(text);
        if (rows.length < 2) throw new Error('That file has no data rows.');
        S.text = text; S.rows = rows;
        const header = rows[0];
        const guess = detectColumns(header);
        S.header = isNaN(Number(header[guess.amount ?? 0]?.replace(',', '.'))) || guess.date != null;
        S.map = guess;
        if (S.map.date == null) S.map.date = 0;
        const data = S.header ? rows.slice(1) : rows;
        S.dateFormat = detectDateFormat(data.slice(0, 50).map((r) => r[S.map.date] || ''));
        const amts = data.map((r) => r[S.map.amount]).filter(Boolean);
        S.negExp = amts.filter((a) => /^\s*[-−(]/.test(a)).length >= amts.length / 3;
        stepMap();
      } catch (e) { err.textContent = e.message || 'Could not read that file.'; }
    };
    file.addEventListener('change', async () => { const f = file.files?.[0]; if (!f) return; if (f.size > 8 * 1024 * 1024) return (err.textContent = 'File is too large (max 8 MB).'); go(await f.text()); });
    clear(body).append(h('p', { class: 'muted', style: { marginBottom: '12px' } }, 'Export a CSV from your bank (no bank login needed) or use a file exported from Tally. Nothing leaves your device; the file is read in your browser.'), field('CSV file', file), paste, err);
    setFoot(cancel, h('button', { class: 'btn primary', onclick: () => (paste.value.trim() ? go(paste.value) : (err.textContent = 'Choose a file or paste some CSV text.')) }, 'Next'));
  }

  /* step 2: map columns */
  function stepMap() {
    const header = S.rows[0];
    const cols = header.map((hd, i) => [String(i), S.header ? (hd.trim() || `Column ${i + 1}`) : `Column ${i + 1} (e.g. ${(S.rows[0][i] || '').slice(0, 14)})`]);
    const sel = (key, label, optional = true) => { const s = selectEl(optional ? [...none, ...cols] : cols, S.map[key] != null ? String(S.map[key]) : '', { onchange: () => { S.map[key] = s.value === '' ? undefined : Number(s.value); } }); return field(label, s); };
    const hdr = h('input', { type: 'checkbox', id: 'hdr', checked: S.header, onchange: (e) => { S.header = e.target.checked; stepMap(); } });
    const fmtSel = selectEl(DATE_FORMATS, S.dateFormat, { onchange: () => { S.dateFormat = fmtSel.value; } });
    const sign = segmented([['neg', 'Negative = expense'], ['pos', 'Positive = expense']], S.negExp ? 'neg' : 'pos', (v) => { S.negExp = v === 'neg'; }, 'Sign convention');
    const data = (S.header ? S.rows.slice(1) : S.rows).slice(0, 4);
    clear(body).append(h('p', { class: 'muted', style: { marginBottom: '10px' } }, `${S.rows.length - (S.header ? 1 : 0)} rows found. Check that the columns are matched correctly.`),
      h('div', { class: 'switch' }, h('label', { for: 'hdr' }, 'First row contains column names'), hdr),
      h('div', { class: 'form-row' }, sel('date', 'Date', false), sel('description', 'Description')),
      h('div', { class: 'form-row' }, sel('amount', 'Amount'), sel('category', 'Category (optional)')),
      h('div', { class: 'form-row' }, sel('debit', 'Debit column (if separate)'), sel('credit', 'Credit column (if separate)')),
      h('div', { class: 'form-row' }, field('Date format', fmtSel), h('div', { class: 'field' }, h('label', null, 'Amount sign'), sign)),
      h('div', { class: 'table-scroll', style: { marginTop: '8px' } }, h('table', { class: 'tbl', 'aria-label': 'Preview' }, h('thead', null, h('tr', null, header.map((x, i) => h('th', null, S.header ? x : `#${i + 1}`)))), h('tbody', null, data.map((r) => h('tr', null, r.map((c) => h('td', null, c.slice(0, 30)))))))));
    setFoot(h('button', { class: 'btn ghost', onclick: stepFile }, 'Back'), cancel, h('button', { class: 'btn primary', onclick: () => {
      if (S.map.amount == null && S.map.debit == null && S.map.credit == null) return toast('Choose the Amount column (or Debit/Credit).', { kind: 'bad' });
      stepGroups();
    } }, 'Next'));
  }

  /* step 3: categories */
  function stepGroups() {
    const data = S.header ? S.rows.slice(1) : S.rows;
    const rows = buildImportRows(data, S.map, { dateFormat: S.dateFormat, negativeIsExpense: S.negExp });
    const ok = rows.filter((r) => !r.skip);
    const skippedIncome = rows.filter((r) => r.skip === 'income').length, bad = rows.filter((r) => r.skip && r.skip !== 'income').length;
    const have = new Set(st.expenses.map((e) => `${e.date}|${e.amount}|${(e.description || '').toLowerCase()}`));
    ok.forEach((r) => { r.dup = have.has(`${r.date}|${r.amount}|${r.description.toLowerCase()}`); });
    if (!ok.length) { clear(body).append(h('div', { class: 'banner bad' }, icon('warn'), h('div', { class: 'grow' }, h('b', null, 'No expenses found'), `Every row was skipped (${skippedIncome} income, ${bad} unreadable). Check the date format, amount column and sign convention.`))); setFoot(h('button', { class: 'btn', onclick: stepMap }, 'Back'), cancel); return; }
    const byCat = (name) => st.categories.find((c) => c.name.toLowerCase() === name.trim().toLowerCase());
    const byKey = (k) => st.categories.find((c) => c.key === k) || st.categories.find((c) => c.name.toLowerCase().startsWith({ food: 'food', transport: 'transport', subs: 'subscr', bills: 'bills', housing: 'hous', health: 'health', fun: 'entert', shopping: 'shop', other: 'other' }[k] || '#'));
    const fallback = byKey('other') || st.categories.find((c) => c.kind === 'variable') || st.categories[0];
    const groups = new Map();
    for (const r of ok) {
      const label = (S.map.category != null && r.rawCategory) ? r.rawCategory : (r.description || '(no description)');
      const key = label.toLowerCase();
      const g = groups.get(key) || { label, rows: [], total: 0, cat: null };
      g.rows.push(r); g.total += r.amount;
      if (!g.cat) g.cat = (S.map.category != null && byCat(r.rawCategory)) || byKey(suggestCategoryKey(r.description || label)) || fallback;
      groups.set(key, g);
    }
    S.groups = [...groups.values()].sort((a, b) => b.total - a.total);
    const catOpts = [[SKIP, '— Skip these —'], ...st.categories.map((c) => [c.id, `${c.icon} ${c.name}`])];
    const summary = h('div', { class: 'small muted' });
    const upd = () => {
      let n = 0, total = 0, dups = 0;
      S.groups.forEach((g) => { if (g.cat === SKIP) return; g.rows.forEach((r) => { if (r.dup && S.skipDup) dups++; else { n++; total += r.amount; } }); });
      summary.textContent = `${n} transactions · ${money(total)} to import${dups ? ` · ${dups} duplicates skipped` : ''}${skippedIncome ? ` · ${skippedIncome} income rows ignored` : ''}${bad ? ` · ${bad} unreadable rows ignored` : ''}`;
      importBtn.disabled = n === 0;
      importBtn.dataset.n = n;
    };
    const dupBox = h('input', { type: 'checkbox', id: 'dup', checked: S.skipDup, onchange: (e) => { S.skipDup = e.target.checked; upd(); } });
    const importBtn = h('button', { class: 'btn primary', onclick: () => {
      const list = [];
      S.groups.forEach((g) => { if (g.cat === SKIP) return; g.rows.forEach((r) => { if (r.dup && S.skipDup) return; list.push({ date: r.date, amount: r.amount, categoryId: g.cat, description: r.description.slice(0, 80), method: r.method || 'Bank transfer' }); }); });
      store.addExpenses(list);
      m.close(); toast(`Imported ${list.length} transactions.`);
    } }, 'Import');
    clear(body).append(h('p', { class: 'muted', style: { marginBottom: '10px' } }, 'Choose a category for each group of transactions. Pick “Skip” to leave a group out.'), summary,
      h('div', { class: 'switch' }, h('label', { for: 'dup' }, 'Skip transactions that already exist (same date, amount and description)'), dupBox),
      h('div', { class: 'table-scroll' }, h('table', { class: 'tbl', 'aria-label': 'Category mapping' }, h('thead', null, h('tr', null, h('th', null, 'Description'), h('th', { class: 'r' }, 'Count'), h('th', { class: 'r' }, 'Total'), h('th', null, 'Category'))),
        h('tbody', null, S.groups.map((g) => { const s = selectEl(catOpts, g.cat.id || g.cat, { 'aria-label': `Category for ${g.label}`, onchange: () => { g.cat = s.value === SKIP ? SKIP : s.value; upd(); } }); g.cat = g.cat.id || g.cat; return h('tr', null, h('td', { style: { maxWidth: '220px', overflow: 'hidden', textOverflow: 'ellipsis' } }, g.label), h('td', { class: 'r' }, g.rows.length), h('td', { class: 'r' }, money(g.total)), h('td', null, s)); })))));
    upd();
    setFoot(h('button', { class: 'btn ghost', onclick: stepMap }, 'Back'), cancel, importBtn);
  }
  stepFile();
  return m;
}
