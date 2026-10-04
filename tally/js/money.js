// Money is stored as integer minor units (cents). Never floats.

/** Parse user input like "1,234.56", "12,5", "€ 12", "-3.20" into integer cents. NaN if invalid. */
/** Arabic-Indic / Persian digits and Arabic separators -> ASCII. */
export function normalizeDigits(str) {
  return String(str ?? '').replace(/[\u0660-\u0669]/g, (d) => d.charCodeAt(0) - 0x660).replace(/[\u06F0-\u06F9]/g, (d) => d.charCodeAt(0) - 0x6f0).replace(/\u066B/g, '.').replace(/\u066C/g, ',').replace(/\u060C/g, ',');
}

export function parseMoney(input) {
  if (typeof input === 'number') return Number.isFinite(input) ? Math.round(input * 100) : NaN;
  let s = normalizeDigits(input).trim().replace(/[^\d.,\-−]/g, '').replace('−', '-');
  if (!s || s === '-') return NaN;
  const neg = s.startsWith('-');
  s = s.replace(/-/g, '');
  const lastDot = s.lastIndexOf('.');
  const lastComma = s.lastIndexOf(',');
  const sep = Math.max(lastDot, lastComma);
  let intPart = s, frac = '';
  if (sep >= 0) {
    const sepChar = s[sep];
    const count = s.split(sepChar).length - 1;
    const bothKinds = lastDot >= 0 && lastComma >= 0;
    const head = s.slice(0, sep).replace(/[.,]/g, '');
    const after = s.length - sep - 1;
    // Multiple of the same separator, or a lone one followed by exactly 3 digits after a 1-3 digit head, means thousands grouping.
    const grouping = !bothKinds && (count > 1 || (after === 3 && /^[1-9]\d{0,2}$/.test(head)));
    if (grouping) intPart = s.replace(/[.,]/g, '');
    else { intPart = head; frac = s.slice(sep + 1); }
  }
  if (!/^\d*$/.test(intPart) || !/^\d*$/.test(frac)) return NaN;
  if (!intPart && !frac) return NaN;
  const cents = Number(intPart || '0') * 100 + Math.round(Number((frac + '00').slice(0, 2) + (frac.length > 2 ? '.' + frac.slice(2) : '')));
  if (!Number.isSafeInteger(cents)) return NaN;
  return neg ? -cents : cents;
}

/** Percent (e.g. "12.5") -> basis points (1250). NaN if invalid. */
export function parsePercent(input) {
  const s = normalizeDigits(input).trim().replace('%', '').replace('\u066A', '').replace(',', '.');
  if (s === '' || !/^-?\d*\.?\d*$/.test(s)) return NaN;
  const n = Number(s);
  return Number.isFinite(n) ? Math.round(n * 100) : NaN;
}

/** income(cents) * bp / 10000, rounded half away from zero. */
export function pctToAmount(incomeCents, bp) {
  return roundDiv(incomeCents * bp, 10000);
}

/** amount / income as basis points (rounded). 0 if income is 0. */
export function amountToBp(amountCents, incomeCents) {
  if (!incomeCents) return 0;
  return roundDiv(amountCents * 10000, incomeCents);
}

/** Integer division rounding half away from zero. */
export function roundDiv(n, d) {
  if (!d) return 0;
  const q = Math.abs(n) / Math.abs(d);
  const r = Math.floor(q + 0.5 + 1e-9);
  return (n < 0) !== (d < 0) ? -r : r;
}

/** Percentage with one decimal as a number, e.g. 84.8. */
export function pct1(part, whole) {
  if (!whole) return 0;
  return Math.round((part * 1000) / whole + 1e-9) / 10;
}

/** Browser locales can be odd (e.g. "en-US@posix"); return something Intl accepts. */
export function cleanLocale(l) {
  try { return Intl.getCanonicalLocales(String(l || '').replace('_', '-').split('@')[0].split('.')[0])[0] || 'en'; } catch { return 'en'; }
}

const cache = new Map();
function nf(currency, locale, minFrac) {
  const key = `${currency}|${locale}|${minFrac}`;
  if (!cache.has(key)) {
    let f;
    const opts = { style: 'currency', currency, minimumFractionDigits: minFrac, maximumFractionDigits: 2 };
    try { f = new Intl.NumberFormat(cleanLocale(locale), opts); }
    catch { f = new Intl.NumberFormat('en', { ...opts, currency: 'EUR' }); }
    cache.set(key, f);
  }
  return cache.get(key);
}

/** Format cents. `compact` drops ".00" when the amount is whole. */
export function fmt(cents, currency = 'EUR', locale = 'en', { compact = false, sign = false } = {}) {
  const c = Math.round(cents || 0);
  const whole = c % 100 === 0;
  const s = nf(currency, locale, compact && whole ? 0 : 2).format(c / 100);
  if (sign && c > 0) return '+' + s;
  return s;
}

/** Plain decimal string for inputs: 123456 -> "1234.56" */
export function toInput(cents) {
  if (cents == null || Number.isNaN(cents)) return '';
  const neg = cents < 0;
  const a = Math.abs(Math.round(cents));
  const s = Math.floor(a / 100) + '.' + String(a % 100).padStart(2, '0');
  return (neg ? '-' : '') + s.replace(/\.00$/, '');
}

export function bpToInput(bp) {
  return (Math.round(bp) / 100).toString();
}
