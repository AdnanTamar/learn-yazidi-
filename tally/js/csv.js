// CSV parsing/export and bank-statement import mapping. Pure.
import { parseMoney } from './money.js';
import { validYmd, ymd, daysInMonth } from './dates.js';

export function detectDelimiter(text) {
  const head = text.split(/\r?\n/).slice(0, 5).join('\n');
  const counts = { ',': 0, ';': 0, '\t': 0, '|': 0 };
  let inQ = false;
  for (const ch of head) { if (ch === '"') inQ = !inQ; else if (!inQ && ch in counts) counts[ch]++; }
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
}

/** RFC-4180-ish parser: quotes, escaped quotes, newlines inside quotes. */
export function parseCsv(text, delimiter) {
  text = text.replace(/^﻿/, '');
  const d = delimiter || detectDelimiter(text);
  const rows = [];
  let row = [], field = '', inQ = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQ) {
      if (ch === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else inQ = false; }
      else field += ch;
    } else if (ch === '"') inQ = true;
    else if (ch === d) { row.push(field); field = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.some((c) => c.trim() !== '')) rows.push(row);
      row = [];
    } else field += ch;
  }
  row.push(field);
  if (row.some((c) => c.trim() !== '')) rows.push(row);
  return rows;
}

const esc = (v) => {
  let s = String(v ?? '');
  if (/^[=+\-@]/.test(s) && !/^-?\d+([.,]\d+)?$/.test(s)) s = "'" + s; // neutralise spreadsheet formulas
  return /[",\n\r;]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
};
export const toCsv = (rows) => rows.map((r) => r.map(esc).join(',')).join('\r\n') + '\r\n';

export function amountCsv(cents) {
  const neg = cents < 0, a = Math.abs(cents);
  return (neg ? '-' : '') + Math.floor(a / 100) + '.' + String(a % 100).padStart(2, '0');
}

export function expensesToCsv(state) {
  const cat = Object.fromEntries(state.categories.map((c) => [c.id, c.name]));
  const rows = [['Date', 'Amount', 'Category', 'Description', 'Payment method', 'Recurring']];
  for (const e of [...state.expenses].sort((a, b) => a.date.localeCompare(b.date))) {
    rows.push([e.date, amountCsv(e.amount), cat[e.categoryId] || '', e.description || '', e.method || '', e.recurringId ? 'yes' : '']);
  }
  return toCsv(rows);
}

/* ───── bank import ───── */

const HEADER_HINTS = {
  date: /^(date|booking date|transaction date|posted|value date|datum|buchungstag|fecha|data)/i,
  description: /(description|details|memo|narrative|payee|merchant|reference|text|name|verwendungszweck|concepto|beschreibung)/i,
  amount: /^(amount|value|sum|betrag|importe|total|amount \(.*\))$/i,
  debit: /(debit|withdrawal|paid out|money out|outgoing|soll)/i,
  credit: /(credit|deposit|paid in|money in|incoming|haben)/i,
  category: /(category|kategorie|categoria)/i,
  method: /(payment method|method|type|zahlungsart)/i,
};

export function detectColumns(headers) {
  const map = {};
  headers.forEach((h, i) => {
    for (const [k, re] of Object.entries(HEADER_HINTS)) if (map[k] == null && re.test(h.trim())) { map[k] = i; break; }
  });
  return map;
}

export const DATE_FORMATS = ['YYYY-MM-DD', 'DD/MM/YYYY', 'MM/DD/YYYY', 'DD.MM.YYYY', 'DD-MM-YYYY'];

export function parseDateWith(str, fmt) {
  const s = String(str || '').trim().split(/[ T]/)[0];
  let y, m, d, mt;
  if (fmt === 'YYYY-MM-DD' && (mt = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/))) [y, m, d] = [mt[1], mt[2], mt[3]];
  else if (fmt === 'DD/MM/YYYY' && (mt = s.match(/^(\d{1,2})[/](\d{1,2})[/](\d{2,4})$/))) [d, m, y] = [mt[1], mt[2], mt[3]];
  else if (fmt === 'MM/DD/YYYY' && (mt = s.match(/^(\d{1,2})[/](\d{1,2})[/](\d{2,4})$/))) [m, d, y] = [mt[1], mt[2], mt[3]];
  else if (fmt === 'DD.MM.YYYY' && (mt = s.match(/^(\d{1,2})[.](\d{1,2})[.](\d{2,4})$/))) [d, m, y] = [mt[1], mt[2], mt[3]];
  else if (fmt === 'DD-MM-YYYY' && (mt = s.match(/^(\d{1,2})-(\d{1,2})-(\d{2,4})$/))) [d, m, y] = [mt[1], mt[2], mt[3]];
  else return null;
  y = Number(y); m = Number(m); d = Number(d);
  if (y < 100) y += 2000;
  if (m < 1 || m > 12 || d < 1 || d > daysInMonth(y, m)) return null;
  const out = ymd(y, m, d);
  return validYmd(out) ? out : null;
}

export function detectDateFormat(samples) {
  let best = DATE_FORMATS[0], bestN = -1;
  for (const f of DATE_FORMATS) {
    const n = samples.filter((s) => parseDateWith(s, f)).length;
    if (n > bestN) { best = f; bestN = n; }
  }
  return best;
}

/**
 * Turn parsed CSV rows into candidate expenses.
 * mapping: {date, description, amount?, debit?, credit?, category?, method?} column indexes.
 * opts: {dateFormat, negativeIsExpense (true|false)}
 */
export function buildImportRows(rows, mapping, opts) {
  const out = [];
  rows.forEach((r, idx) => {
    const raw = (i) => (i == null ? '' : (r[i] ?? '').trim());
    const date = parseDateWith(raw(mapping.date), opts.dateFormat);
    let amount = NaN, skip = null;
    if (mapping.debit != null || mapping.credit != null) {
      const deb = parseMoney(raw(mapping.debit)), cre = parseMoney(raw(mapping.credit));
      if (Number.isFinite(deb) && deb !== 0) amount = Math.abs(deb);
      else if (Number.isFinite(cre) && cre !== 0) { amount = Math.abs(cre); skip = 'income'; }
    } else {
      const a = parseMoney(raw(mapping.amount));
      if (Number.isFinite(a) && a !== 0) {
        const isExpense = opts.negativeIsExpense ? a < 0 : a > 0;
        amount = Math.abs(a);
        if (!isExpense) skip = 'income';
      }
    }
    if (!date) skip = skip || 'bad date';
    if (!Number.isFinite(amount)) skip = skip || 'bad amount';
    out.push({
      line: idx, date, amount: Number.isFinite(amount) ? amount : 0, skip,
      description: raw(mapping.description), rawCategory: raw(mapping.category), method: raw(mapping.method),
    });
  });
  return out;
}

const KEYWORDS = [
  ['food', /(super ?market|grocer|aldi|lidl|carrefour|tesco|whole foods|bakery|coffee|cafe|café|restaurant|pizza|burger|mcdonald|kfc|starbucks|deliveroo|uber ?eats|just ?eat|snack|food)/i],
  ['transport', /(uber|taxi|fuel|petrol|shell|bp |gas station|train|metro|bus|parking|transit|toll)/i],
  ['subs', /(netflix|spotify|disney|hbo|prime video|youtube|apple\.com|icloud|gym|subscription)/i],
  ['bills', /(electric|water|internet|phone|vodafone|telecom|insurance|utility|energy)/i],
  ['housing', /(rent|mortgage|landlord)/i],
  ['health', /(pharmacy|doctor|dentist|clinic|hospital|health)/i],
  ['fun', /(cinema|movie|concert|bar |pub |theatre|game|steam|ticket)/i],
  ['shopping', /(amazon|zara|h&m|ikea|shop|store|mall|ebay|clothes)/i],
];
/** Suggest a category key from free text. */
export function suggestCategoryKey(text) {
  for (const [k, re] of KEYWORDS) if (re.test(text || '')) return k;
  return null;
}
