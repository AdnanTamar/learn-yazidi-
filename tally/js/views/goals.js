import { h, icon, clear, emptyState, field, moneyInput, selectEl, modal, toast, confirmDialog, segmented } from '../ui.js';
import * as store from '../store.js';
import { cs, state, money, date, today, pct, curMonth, rerender, plural } from '../ctx.js';
import { goalStatus, emergencyStatus, totalSavings, goalCurrent, essentialMonthly } from '../calc.js';
import { addMonths, validYmd } from '../dates.js';
import { parseMoney, toInput } from '../money.js';
import { statCard } from '../components.js';
import { progress } from '../charts.js';

const GOAL_ICONS = ['🎯', '📱', '✈️', '🚗', '💻', '🏠', '🏖️', '🎓', '💍', '🎁', '🛠️', '🚲'];

export function renderGoals() {
  const st = cs(), t = today();
  const page = h('div', { class: 'page' });
  const goals = st.goals.map((g) => goalStatus(st, g, t));
  page.append(h('div', { class: 'page-head' }, h('div', null, h('h1', null, 'Goals'), h('div', { class: 'sub' }, 'Emergency fund and what you are saving for')), h('button', { class: 'btn primary', onclick: () => goalModal() }, icon('plus', 18), 'New goal')),
    h('div', { class: 'stats', style: { marginBottom: '14px' } }, statCard({ label: 'Total savings', value: money(totalSavings(st)), sub: 'Starting balance + everything you saved' }), statCard({ label: 'Goals', value: goals.length, sub: `${goals.filter((g) => g.done).length} reached` }), statCard({ label: 'Planned monthly', value: money(st.goals.reduce((a, g) => a + (g.monthly || 0), 0)), sub: 'across all goals' })));
  page.append(emergencyCard(st));
  const grid = h('div', { class: 'grid cols-2', style: { marginTop: '14px' } });
  if (!goals.length) page.append(h('div', { class: 'card', style: { marginTop: '14px' } }, emptyState({ icon: '🎯', title: 'No savings goals yet', text: 'Create a goal like “New laptop” or “Summer trip”. Tally works out how much to save each month.', action: h('button', { class: 'btn primary', onclick: () => goalModal() }, 'Create a goal') })));
  goals.forEach((g) => grid.append(goalCard(g)));
  page.append(grid);
  return page;
}

function goalCard(g) {
  const { goal } = g;
  const status = g.done ? h('span', { class: 'badge good' }, '✓ Reached') : g.onTrack === true ? h('span', { class: 'badge good' }, 'On track') : g.onTrack === false ? h('span', { class: 'badge warn' }, 'Behind') : null;
  return h('div', { class: 'card' },
    h('div', { class: 'row spread' }, h('div', { class: 'row' }, h('div', { class: 'avatar', style: { background: 'var(--accent-soft)' } }, goal.icon || '🎯'), h('div', null, h('h3', null, goal.name), h('div', { class: 'small muted' }, goal.deadline ? `By ${date(goal.deadline, { day: 'numeric', month: 'short', year: 'numeric' })}` : 'No deadline'))), status),
    h('div', { style: { margin: '14px 0 6px', display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' } }, h('b', { style: { fontSize: '24px' } }, money(g.current)), h('span', { class: 'muted' }, `of ${money(goal.target)} · ${pct(g.progress)}`)),
    progress(g.progress, { color: g.done ? 'var(--good)' : 'var(--accent)', label: `${goal.name} progress` }),
    h('div', { class: 'kv small', style: { marginTop: '12px' } },
      h('span', { class: 'k' }, 'Still to save'), h('b', null, money(g.remaining)), h('span'),
      goal.deadline ? [h('span', { class: 'k' }, 'Needed per month'), h('b', null, money(g.required)), h('span', { class: 'muted' }, `${plural(g.monthsLeft, 'month', 'months')} left`)] : null,
      goal.monthly ? [h('span', { class: 'k' }, 'Planned per month'), h('b', null, money(goal.monthly)), h('span')] : null,
      g.projected ? [h('span', { class: 'k' }, 'At that pace'), h('b', null, date(g.projected, { day: 'numeric', month: 'short', year: 'numeric' })), h('span')] : null),
    goal.deadline && !g.done && goal.monthly && goal.monthly < g.required ? h('div', { class: 'banner warn', style: { marginTop: '10px' } }, icon('warn', 18), h('div', { class: 'grow' }, `Your plan is ${money(g.required - goal.monthly)}/month short of the deadline.`)) : null,
    h('div', { class: 'row wrap', style: { marginTop: '14px' } }, h('button', { class: 'btn small primary', onclick: () => contributeModal(goal.id, goal.name) }, icon('plus', 16), 'Add money'), h('button', { class: 'btn small', onclick: () => contributeModal(goal.id, goal.name, true) }, 'Withdraw'), h('button', { class: 'btn small ghost', onclick: () => goalModal(goal) }, icon('edit', 16), 'Edit'),
      h('button', { class: 'icon-btn danger', 'aria-label': `Delete ${goal.name}`, onclick: async () => { if (await confirmDialog({ title: `Delete “${goal.name}”?`, text: 'The money you saved stays in your savings history.', confirmLabel: 'Delete', danger: true })) store.deleteGoal(goal.id); } }, icon('trash'))));
}

function emergencyCard(st) {
  const e = emergencyStatus(st, curMonth());
  const tone = e.level === 'strong' || e.level === 'good' ? 'good' : e.level === 'building' ? 'warn' : 'bad';
  const msg = { strong: 'Strong cushion. You could handle a long gap in income.', good: 'You have reached your target. Keep it topped up.', building: 'A good start. Keep building towards your target.', low: 'Less than one month of essentials is covered.' }[e.level];
  return h('div', { class: 'card' }, h('div', { class: 'card-head' }, h('h2', null, '🛟 Emergency fund'), h('div', { class: 'row' }, h('button', { class: 'btn small primary', onclick: () => contributeModal('emergency', 'Emergency fund') }, icon('plus', 16), 'Add money'), h('button', { class: 'btn small', onclick: () => emergencySettings() }, 'Settings'))),
    h('div', { class: 'grid cols-3', style: { gap: '10px' } },
      h('div', null, h('div', { class: 'small muted' }, 'Emergency savings'), h('b', { style: { fontSize: '22px' } }, money(e.current))),
      h('div', null, h('div', { class: 'small muted' }, 'Essential monthly expenses'), h('b', { style: { fontSize: '22px' } }, money(e.essential)), h('div', { class: 'small muted' }, { budget: 'from your essential budgets', spending: 'from your essential spending', manual: 'set manually' }[e.essentialSource])),
      h('div', null, h('div', { class: 'small muted' }, 'Emergency coverage'), h('b', { style: { fontSize: '22px' }, class: tone }, `${e.coverage} months`))),
    h('div', { style: { margin: '14px 0 6px' } }, progress(e.progress, { color: `var(--${tone})`, label: 'Emergency fund progress to target' })),
    h('div', { class: 'row spread wrap small muted' }, h('span', null, `Target: ${e.targetMonths} months = ${money(e.targetAmount)}`), h('span', null, e.needed > 0 ? `${money(e.needed)} to go` : 'Target reached')),
    h('p', { style: { marginTop: '8px' } }, msg), h('p', { class: 'muted small' }, 'Common guidance is 3–6 months of essential expenses. Choose the target that fits your situation; this is not financial advice.'));
}

function emergencySettings() {
  const e = state().emergency, cur = emergencyStatus(cs(), curMonth());
  const tm = h('input', { class: 'input', type: 'number', min: 1, max: 24, step: 1, value: e.targetMonths || 3 });
  const ov = moneyInput({ value: e.essentialOverride ? toInput(e.essentialOverride) : '', placeholder: `Automatic (${money(essentialMonthly(cs(), curMonth()).amount)})` });
  const st0 = moneyInput({ value: e.start ? toInput(e.start) : '' });
  const tmF = field('Target (months of essential expenses)', tm, { hint: 'Most people aim for 3 to 6 months.' }), ovF = field('Essential monthly expenses (override)', ov, { hint: 'Leave empty to use your essential-category budgets.' }), s0F = field('Amount already in your emergency fund (before using Tally)', st0);
  const m = modal({ title: 'Emergency fund settings', body: h('div', null, tmF, ovF, s0F), footer: [h('button', { class: 'btn ghost', onclick: () => m.close() }, 'Cancel'), h('button', { class: 'btn primary', onclick: () => {
    const months = parseInt(tm.value, 10); if (!(months >= 1 && months <= 24)) return tmF.setError('Choose between 1 and 24 months.');
    const o = ov.value.trim() === '' ? null : parseMoney(ov.value); if (o != null && (!Number.isFinite(o) || o < 0)) return ovF.setError('Enter a valid amount or leave empty.');
    const s0 = st0.value.trim() === '' ? 0 : parseMoney(st0.value); if (!Number.isFinite(s0) || s0 < 0) return s0F.setError('Enter a valid amount.');
    store.saveEmergency({ targetMonths: months, essentialOverride: o || null, start: s0 }); m.close();
  } }, 'Save')] });
}

export function goalModal(goal = null) {
  let iconSel = goal?.icon || '🎯';
  const name = h('input', { class: 'input', value: goal?.name || '', maxlength: 40, placeholder: 'e.g. New laptop', 'data-autofocus': '' }); const nameF = field('Name', name);
  const target = moneyInput({ value: goal ? toInput(goal.target) : '' }); const targetF = field('Target amount', target);
  const start = moneyInput({ value: goal?.start ? toInput(goal.start) : '' }); const startF = field('Already saved', start, { hint: 'Money you had set aside for this before.' });
  const deadline = h('input', { type: 'date', class: 'input', value: goal?.deadline || '' }); const dlF = field('Deadline (optional)', deadline);
  const monthly = moneyInput({ value: goal?.monthly ? toInput(goal.monthly) : '' }); const monF = field('Planned monthly contribution', monthly);
  const need = h('div', { class: 'banner', hidden: true });
  const icons = h('div', { class: 'chips' });
  const drawIcons = () => { clear(icons).append(...GOAL_ICONS.map((i) => h('button', { type: 'button', class: 'chip', 'aria-pressed': String(i === iconSel), 'aria-label': 'Icon ' + i, onclick: () => { iconSel = i; drawIcons(); } }, i))); };
  drawIcons();
  const calc = () => {
    const tg = parseMoney(target.value), sv = start.value.trim() ? parseMoney(start.value) : 0;
    if (Number.isFinite(tg) && tg > 0 && validYmd(deadline.value) && Number.isFinite(sv)) {
      const g = goalStatus({ ...state(), expenses: goal ? state().expenses : [] }, { id: goal?.id || '_new', target: tg, start: sv, deadline: deadline.value, monthly: 0 }, today());
      need.hidden = false; clear(need).append(icon('info', 18), h('div', { class: 'grow' }, g.done ? 'You already have enough for this goal.' : `Save about ${money(g.required)} per month for ${plural(g.monthsLeft, 'month', 'months')} to reach it by the deadline.`));
    } else need.hidden = true;
  };
  [target, start, deadline].forEach((el) => el.addEventListener('input', calc)); calc();
  const m = modal({ title: goal ? 'Edit goal' : 'New savings goal', body: h('div', null, nameF, h('div', { class: 'field' }, h('label', null, 'Icon'), icons), h('div', { class: 'form-row' }, targetF, startF), dlF, need, h('div', { style: { height: '12px' } }), monF), footer: [h('button', { class: 'btn ghost', onclick: () => m.close() }, 'Cancel'), h('button', { class: 'btn primary', onclick: () => {
    let ok = true;
    if (!name.value.trim()) { nameF.setError('Give your goal a name.'); ok = false; } else nameF.setError('');
    const tg = parseMoney(target.value); if (!Number.isFinite(tg) || tg <= 0) { targetF.setError('Enter a target greater than 0.'); ok = false; } else targetF.setError('');
    const sv = start.value.trim() ? parseMoney(start.value) : 0; if (!Number.isFinite(sv) || sv < 0) { startF.setError('Enter a valid amount.'); ok = false; } else startF.setError('');
    const mo = monthly.value.trim() ? parseMoney(monthly.value) : 0; if (!Number.isFinite(mo) || mo < 0) { monF.setError('Enter a valid amount.'); ok = false; } else monF.setError('');
    if (deadline.value && !validYmd(deadline.value)) { dlF.setError('Pick a valid date.'); ok = false; } else dlF.setError('');
    if (!ok) return;
    store.saveGoal({ id: goal?.id, name: name.value.trim(), icon: iconSel, target: tg, start: sv, monthly: mo, deadline: deadline.value || null });
    m.close(); toast(goal ? 'Goal updated.' : 'Goal created.');
  } }, 'Save goal')] });
}

export function contributeModal(fundId, label, withdraw = false) {
  const amt = moneyInput({ big: true, 'data-autofocus': '' }); const amtF = field(withdraw ? `Withdraw from ${label}` : `Add to ${label}`, amt);
  const dt = h('input', { type: 'date', class: 'input', value: today() }); const dtF = field('Date', dt);
  const m = modal({ title: withdraw ? 'Withdraw money' : 'Add money', body: h('form', { onsubmit: (e) => { e.preventDefault(); go(); } }, amtF, dtF, h('p', { class: 'muted small' }, withdraw ? 'This records a withdrawal from your savings.' : 'This is recorded as money moved to savings (not as spending).'), h('button', { type: 'submit', hidden: true })),
    footer: [h('button', { class: 'btn ghost', onclick: () => m.close() }, 'Cancel'), h('button', { class: 'btn primary', onclick: go }, withdraw ? 'Withdraw' : 'Add money')] });
  function go() {
    const a = parseMoney(amt.value); if (!Number.isFinite(a) || a <= 0) return amtF.setError('Enter an amount greater than 0.');
    if (!validYmd(dt.value)) return dtF.setError('Pick a valid date.');
    store.contribute(fundId, withdraw ? -a : a, dt.value);
    m.close(); toast(withdraw ? `Withdrew ${money(a)}.` : `Added ${money(a)} to ${label}.`);
  }
}
