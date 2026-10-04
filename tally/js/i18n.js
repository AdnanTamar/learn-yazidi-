// Tiny i18n: English strings are the keys. Arabic lives in i18n-ar.js. Pure (no DOM needed at import time).
import { AR, AR_PLURAL } from './i18n-ar.js';

let lang = 'en';
export const getLang = () => lang;
export const isRtl = () => lang === 'ar';
export function setLang(l) {
  lang = l === 'ar' ? 'ar' : 'en';
  if (typeof document !== 'undefined') {
    const r = document.documentElement;
    r.lang = lang;
    r.dir = lang === 'ar' ? 'rtl' : 'ltr';
  }
}
/** Profile locale adjusted to the UI language so dates/numbers match it. */
export function effectiveLocale(profileLocale) {
  const l = String(profileLocale || 'en');
  if (lang === 'ar' && !/^ar/i.test(l) && /^en(-|$)/i.test(l)) return 'ar-u-nu-latn';
  if (lang !== 'ar' && /^ar/i.test(l)) return 'en';
  return l;
}
export const detectLang = (nav) => (/^ar\b/i.test(String(nav || '')) ? 'ar' : 'en');

const LRI = '⁦', PDI = '⁩';
const HAS_ARABIC = /[؀-ۿ]/;
function fill(str, params) {
  return str.replace(/\{(\w+)\}/g, (m, k) => {
    if (!(k in params)) return m;
    const v = String(params[k]);
    // keep numbers / amounts in one left-to-right run inside Arabic sentences
    return lang === 'ar' && /\d/.test(v) && !HAS_ARABIC.test(v) ? LRI + v + PDI : v;
  });
}

/** Translate `key` (an English string, optionally with {placeholders}). Unknown keys fall back to English. */
export function t(key, params) {
  if (typeof key !== 'string' || key === '') return key;
  let v = key;
  if (lang === 'ar') {
    const hit = AR[key];
    if (hit !== undefined) v = hit;
    else {
      const trimmed = key.trim();
      if (trimmed && trimmed !== key && AR[trimmed] !== undefined) v = key.replace(trimmed, AR[trimmed]);
    }
  }
  if (typeof v === 'function') return v(params || {});
  return params ? fill(v, params) : v;
}

/** "3 days" / Arabic dual & plural forms. `one`/`many` are the English singular/plural words (e.g. 'day','days'). */
export function plural(n, one, many) {
  if (lang !== 'ar') return `${n} ${n === 1 ? one : many}`;
  const f = AR_PLURAL[one];
  if (!f) return `${n} ${n === 1 ? one : many}`;
  if (n === 1) return f[0];
  if (n === 2) return f[1];
  if (n >= 3 && n <= 10) return `${n} ${f[2]}`;
  return `${n} ${f[3]}`;
}
