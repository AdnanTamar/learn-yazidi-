import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { t, plural, setLang, getLang, detectLang, effectiveLocale } from '../js/i18n.js';
import { AR } from '../js/i18n-ar.js';
import { parseMoney, parsePercent, fmt, cleanLocale } from '../js/money.js';
import { demoState, relocalizeNames, suggestBudget } from '../js/model.js';
import * as C from '../js/calc.js';

const files = (dir) => readdirSync(dir).flatMap((f) => (statSync(join(dir, f)).isDirectory() ? files(join(dir, f)) : f.endsWith('.js') ? [join(dir, f)] : []));

test('English is the default and interpolates', () => {
  setLang('en');
  assert.equal(t('{a} of {b}', { a: '€1', b: '€2' }), '€1 of €2');
  assert.equal(plural(1, 'day', 'days'), '1 day');
  assert.equal(plural(3, 'day', 'days'), '3 days');
});

test('Arabic: translation, interpolation with isolated numbers, plural forms, fallback', () => {
  setLang('ar');
  assert.equal(getLang(), 'ar');
  assert.equal(t('Dashboard'), 'لوحة التحكم');
  assert.match(t('{a} of {b}', { a: '€1', b: '€2' }), /^⁦€1⁩ من ⁦€2⁩$/);
  assert.equal(t('Some brand new untranslated text'), 'Some brand new untranslated text');
  assert.equal(t('Next ', undefined), 'التالي ');
  assert.equal(plural(1, 'day', 'days'), 'يوم');
  assert.equal(plural(2, 'day', 'days'), 'يومان');
  assert.equal(plural(5, 'day', 'days'), '5 أيام');
  assert.equal(plural(21, 'day', 'days'), '21 يومًا');
  setLang('en');
});

test('every t(\'…\') key used in the source has an Arabic translation', () => {
  const missing = new Set();
  for (const f of files(new URL('../js', import.meta.url).pathname)) {
    if (f.endsWith('i18n-ar.js') || f.endsWith('i18n.js')) continue;
    const src = readFileSync(f, 'utf8');
    for (const m of src.matchAll(/(?<![\w.$])t\('((?:[^'\\]|\\.)*)'/g)) {
      const key = m[1].replace(/\\'/g, "'");
      if (!(key in AR) && !(key.trim() in AR)) missing.add(key);
    }
  }
  assert.deepEqual([...missing], []);
});

test('Arabic placeholders match the English ones', () => {
  const bad = [];
  for (const [k, v] of Object.entries(AR)) {
    if (typeof v !== 'string') continue;
    const a = (k.match(/\{\w+\}/g) || []).sort().join(), b = (v.match(/\{\w+\}/g) || []).sort().join();
    if (a !== b) bad.push(k);
  }
  assert.deepEqual(bad, []);
});

test('Arabic-Indic digits and separators are accepted in inputs', () => {
  assert.equal(parseMoney('٢٢٠٠'), 220000);
  assert.equal(parseMoney('١٢٫٥٠'), 1250);
  assert.equal(parseMoney('١٬٢٣٤٫٥٦'), 123456);
  assert.equal(parsePercent('١٢٫٥'), 1250);
});

test('Arabic locale formatting keeps the exact amount', () => {
  const s = fmt(220000, 'EUR', 'ar-u-nu-latn');
  assert.match(s, /2,200\.00/);
  assert.equal(cleanLocale('ar-u-nu-latn'), 'ar-u-nu-latn');
  assert.ok(Number.isFinite(parseMoney(s)) && parseMoney(s) === 220000);
});

test('language detection and effective locale', () => {
  assert.equal(detectLang('ar-SA'), 'ar'); assert.equal(detectLang('en-US'), 'en');
  setLang('ar'); assert.equal(effectiveLocale('en'), 'ar-u-nu-latn'); assert.equal(effectiveLocale('de-DE'), 'de-DE');
  setLang('en'); assert.equal(effectiveLocale('ar-u-nu-latn'), 'en'); assert.equal(effectiveLocale('en-GB'), 'en-GB');
});

test('insights, alerts and verdicts render in Arabic without leaking English templates', () => {
  setLang('ar');
  const st = demoState('2026-10-04');
  const money = (c) => (c / 100).toFixed(2);
  st.fmt = money;
  const out = [...C.insights(st, '2026-10-04'), ...C.alerts(st, '2026-10-04').map((a) => ({ text: a.text })), ...C.canAfford(st, '2026-10-04', 30000).reasons.map((text) => ({ text }))];
  assert.ok(out.length > 5);
  for (const i of out) assert.match(i.text, /[؀-ۿ]/, `not translated: ${i.text}`);
  assert.equal(st.categories.find((c) => c.key === 'food').name, 'الطعام');
  setLang('en');
});

test('default category names follow the language, custom names are kept', () => {
  setLang('en');
  const { categories } = suggestBudget({ income: 220000, payDay: 25 });
  const state = { categories: categories.map((c) => ({ ...c })) };
  state.categories.find((c) => c.key === 'food').name = 'Groceries';
  relocalizeNames(state, 'ar');
  assert.equal(state.categories.find((c) => c.key === 'housing').name, 'السكن');
  assert.equal(state.categories.find((c) => c.key === 'food').name, 'Groceries');
  relocalizeNames(state, 'en');
  assert.equal(state.categories.find((c) => c.key === 'housing').name, 'Housing');
});
