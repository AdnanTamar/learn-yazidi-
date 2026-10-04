import { h, icon, clear, field, moneyInput, selectEl, segmented } from '../ui.js';
import { ui, cs, state, money, pct, today, plural, rerender } from '../ctx.js';
import { canAfford, whatIf, safeToSpend } from '../calc.js';
import { parseMoney } from '../money.js';
import { debounce } from '../ui.js';
import { t } from '../i18n.js';

export function renderPlanner() {
  const tab = ui.tab.planner || 'afford';
  const page = h('div', { class: 'page' });
  page.append(h('div', { class: 'page-head' }, h('div', null, h('h1', null, 'Planner'), h('div', { class: 'sub' }, 'Test a purchase before you make it')), segmented([['afford', 'Can I afford this?'], ['whatif', 'What-if simulator']], tab, (v) => { ui.tab.planner = v; rerender(); }, 'Planner tool')));
  if (state().mode === 'empty') return page;
  page.append(tab === 'afford' ? afford() : whatif());
  page.append(h('p', { class: 'muted small', style: { marginTop: '14px' } }, 'These are practical calculations based on the numbers in Tally, not financial advice.'));
  return page;
}

const catSelect = (extra = []) => selectEl([['', 'No category'], ...state().categories.filter((c) => c.kind !== 'savings').map((c) => [c.id, `${c.icon} ${c.name}`])], '', { 'aria-label': 'Category' });

function afford() {
  const amt = moneyInput({ big: true, placeholder: '300', 'data-autofocus': '', 'aria-label': 'Purchase amount' });
  const amtF = field('Purchase amount', amt);
  const cat = catSelect();
  const out = h('div', { 'aria-live': 'polite' });
  const run = () => {
    clear(out);
    if (amt.value.trim() === '') return out.append(h('p', { class: 'muted' }, 'Enter an amount to see what it would do to your month.'));
    const a = parseMoney(amt.value);
    if (!Number.isFinite(a) || a <= 0) return amtF.setError('Enter an amount greater than 0.');
    amtF.setError('');
    const st = cs(), r = canAfford(st, today(), a, cat.value || null);
    const v = { safe: ['✅', 'SAFE', 'You can afford this.'], caution: ['⚠️', 'CAUTION', 'Possible, with trade-offs.'], no: ['⛔', 'NOT RECOMMENDED', 'This would put your month at risk.'] }[r.verdict];
    out.append(h('div', { class: 'verdict ' + r.verdict, role: 'status' }, h('div', { class: 'ico' }, v[0]), h('div', null, h('div', { class: 'big' }, v[1]), h('div', { class: 'muted' }, v[2]))),
      h('ul', { class: 'reasons' }, r.reasons.map((x) => h('li', null, x))),
      h('div', { class: 'grid cols-2', style: { marginTop: '14px', gap: '10px' } },
        pair('Safe to spend', money(r.available), money(Math.max(0, r.after))), pair('Safe per day', money(r.safeDaily), money(r.afterDaily))));
  };
  const rd = debounce(run, 120);
  amt.addEventListener('input', rd); cat.addEventListener('change', run);
  run();
  const safe = safeToSpend(cs(), today());
  return h('div', { class: 'grid cols-2' }, h('div', { class: 'card' }, h('form', { onsubmit: (e) => e.preventDefault() }, amtF, field('Category (optional)', cat)), h('div', { class: 'small muted' }, t('Right now: {amount} safe to spend · {days} until payday · {rec} of recurring payments still due.', { amount: money(safe.available), days: plural(safe.days, 'day', 'days'), rec: money(safe.upcoming.reduce((a, u) => a + u.amount, 0)) }))), h('div', { class: 'card' }, out));
}
const pair = (label, a, b) => h('div', { style: { padding: '10px 12px', borderRadius: '14px', background: 'var(--track)' } }, h('div', { class: 'small muted' }, label), h('div', { class: 'row', style: { gap: '6px', flexWrap: 'wrap' } }, h('b', null, a), h('span', { class: 'muted' }, '→'), h('b', null, b)));

function whatif() {
  let source = 'month', monthly = false;
  const amt = moneyInput({ big: true, placeholder: '200', 'data-autofocus': '', 'aria-label': 'Hypothetical expense' });
  const amtF = field('What happens if I spend…', amt);
  const out = h('div', { 'aria-live': 'polite' });
  const rep = h('input', { type: 'checkbox', id: 'wrep', onchange: (e) => { monthly = e.target.checked; run(); } });
  const src = segmented([['month', 'From this month’s money'], ['savings', 'From my savings']], source, (v) => { source = v; run(); }, 'Funding');
  const run = () => {
    clear(out);
    if (amt.value.trim() === '') return out.append(h('p', { class: 'muted' }, 'Enter an amount to simulate it.'));
    const a = parseMoney(amt.value);
    if (!Number.isFinite(a) || a <= 0) return amtF.setError('Enter an amount greater than 0.');
    amtF.setError('');
    const w = whatIf(cs(), today(), { amount: a, source, monthly });
    const row = (k, a1, a2, bad) => [h('span', { class: 'k' }, k), h('b', null, a1), h('b', { class: bad ? 'bad' : '' }, '→ ' + a2)];
    out.append(h('div', { class: 'kv' },
      row('Current savings', money(w.savingsNow), money(w.savingsAfter), w.savingsAfter < w.savingsNow),
      row('Spent this month', money(w.spentNow), money(w.spentAfter), w.spentAfter > w.spentNow),
      row('Left this month', money(w.remainingNow), money(w.remainingAfter), w.remainingAfter < w.remainingNow),
      row('Safe per day', money(w.safeDailyNow), money(w.safeDailyAfter), w.safeDailyAfter < w.safeDailyNow),
      row('Savings rate', pct(w.savingsRateNow), pct(w.savingsRateAfter), w.savingsRateAfter < w.savingsRateNow)),
    h('div', { style: { marginTop: '14px' } }, w.planReduction > 0 ? h('div', { class: 'banner warn' }, icon('warn', 18), h('div', { class: 'grow' }, h('b', null, t('Savings reduced by {amount}', { amount: money(w.planReduction) })), w.goalDelays.length ? w.goalDelays.map((d) => h('div', null, t('{name}: delayed by about +{n}', { name: `${d.goal.icon || '🎯'} ${d.goal.name}`, n: plural(d.days, 'day', 'days') }))) : 'No savings goal has a monthly contribution, so no goal is delayed.')) : h('div', { class: 'banner good' }, icon('check', 18), h('div', { class: 'grow' }, 'No savings goal is delayed: this fits inside your safe-to-spend money.'))),
    monthly ? h('div', { class: 'banner', style: { marginTop: '10px' } }, icon('recurring', 18), h('div', { class: 'grow' }, h('b', null, t('{amount} every month', { amount: money(w.monthlyImpact) })), t('That is {amount} over a year.', { amount: money(w.annual) }))) : null);
  };
  amt.addEventListener('input', debounce(run, 120));
  run();
  return h('div', { class: 'grid cols-2' }, h('div', { class: 'card' }, h('form', { onsubmit: (e) => e.preventDefault() }, amtF), h('div', { class: 'field' }, h('label', null, 'Paid'), src), h('div', { class: 'switch' }, h('label', { for: 'wrep' }, 'It repeats every month (subscription, instalment)'), rep)), h('div', { class: 'card' }, out));
}
