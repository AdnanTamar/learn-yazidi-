import test from 'node:test';
import assert from 'node:assert/strict';
import { parseMoney, fmt, pctToAmount, amountToBp, roundDiv, toInput, parsePercent } from '../js/money.js';
import { addMonths, clampDay, nextPayday, diffDays, monthLen } from '../js/dates.js';
import * as C from '../js/calc.js';
import { emptyState, buildState, suggestBudget, demoState, sanitizeState, uid } from '../js/model.js';
import { parseCsv, buildImportRows, detectDateFormat, expensesToCsv, toCsv, detectColumns } from '../js/csv.js';

let n = 0;
const id = () => 'id' + n++;
const TODAY = '2026-10-10';

/** The exact example from the brief: salary 2,200; Rent 500, Food 300, Transport 150, Bills 150, Shopping 150, Fun 100, Savings 400. */
function briefState() {
  const s = emptyState();
  s.mode = 'user';
  const mk = (name, kind, amount) => { const c = { id: 'c_' + name, name, icon: 'x', color: '#000', kind, essential: false }; s.categories.push(c); s.template.budgets[c.id] = { mode: 'amount', value: amount }; return c; };
  mk('Rent', 'fixed', 50000); mk('Food', 'variable', 30000); mk('Transport', 'variable', 15000); mk('Bills', 'fixed', 15000);
  mk('Shopping', 'variable', 15000); mk('Fun', 'variable', 10000); mk('Savings', 'savings', 40000);
  s.template.sources = [{ id: 's1', name: 'Job', amount: 220000, payDay: 25 }];
  C.rollover(s, TODAY, id);
  return s;
}
const exp = (s, date, amount, cat, extra = {}) => s.expenses.push({ id: id(), date, amount, categoryId: 'c_' + cat, description: '', method: 'Cash', ...extra });

test('money parsing & formatting is exact', () => {
  assert.equal(parseMoney('2,200'), 220000);
  assert.equal(parseMoney('13.99'), 1399);
  assert.equal(parseMoney('13,99'), 1399);
  assert.equal(parseMoney('1.234,56'), 123456);
  assert.equal(parseMoney('0.1') + parseMoney('0.2'), 30); // no float drift: 10 + 20 cents
  assert.ok(Number.isNaN(parseMoney('abc')));
  assert.equal(toInput(1399), '13.99');
  assert.equal(fmt(220000, 'EUR', 'en'), '€2,200.00');
  assert.equal(fmt(220000, 'EUR', 'en', { compact: true }), '€2,200');
  assert.equal(parsePercent('12,5%'), 1250);
});

test('percent <-> amount conversions round correctly', () => {
  assert.equal(pctToAmount(220000, 1500), 33000); // 15% of 2,200
  assert.equal(pctToAmount(220000, 800), 17600);
  assert.equal(pctToAmount(220000, 2000), 44000);
  assert.equal(amountToBp(33000, 220000), 1500);
  assert.equal(pctToAmount(33333, 3333), 11110); // 111.10 (rounded)
  assert.equal(roundDiv(5, 2), 3); assert.equal(roundDiv(-5, 2), -3);
});

test('brief example: allocated 1,750 and unallocated 450', () => {
  const s = briefState();
  const a = C.allocation(s, C.planFor(s, '2026-10'));
  assert.equal(a.allocated, 175000);
  assert.equal(a.unallocated, 45000);
  assert.equal(a.over, false);
});

test('over-allocation is detected', () => {
  const s = briefState();
  s.months['2026-10'].budgets['c_Fun'] = { mode: 'amount', value: 100000 };
  const a = C.allocation(s, C.planFor(s, '2026-10'));
  assert.equal(a.over, true);
  assert.equal(a.unallocated, -45000);
});

test('percentage budgets follow the salary; historical months are untouched', () => {
  const s = emptyState(); s.mode = 'user';
  s.categories.push({ id: 'f', name: 'Food', kind: 'variable' }, { id: 't', name: 'Transport', kind: 'variable' }, { id: 'sv', name: 'Savings', kind: 'savings' });
  s.template = { sources: [{ id: 'a', name: 'Job', amount: 220000, payDay: 25 }], budgets: { f: { mode: 'percent', value: 1500 }, t: { mode: 'percent', value: 800 }, sv: { mode: 'percent', value: 2000 } } };
  s.months['2026-08'] = JSON.parse(JSON.stringify(s.template));
  C.rollover(s, '2026-10-05', id); // creates Sep + Oct from template
  assert.deepEqual(Object.keys(s.months).sort(), ['2026-08', '2026-09', '2026-10']);
  assert.equal(C.budgetAmount(C.planFor(s, '2026-10'), 'f'), 33000);
  // Salary changes this month only
  s.months['2026-10'].sources[0].amount = 245000;
  assert.equal(C.budgetAmount(C.planFor(s, '2026-10'), 'f'), 36750); // 15% of 2,450
  assert.equal(C.budgetAmount(C.planFor(s, '2026-10'), 'sv'), 49000);
  // History preserved
  assert.equal(C.planIncome(C.planFor(s, '2026-09')), 220000);
  assert.equal(C.budgetAmount(C.planFor(s, '2026-09'), 'f'), 33000);
  assert.equal(C.budgetAmount(C.planFor(s, '2026-08'), 't'), 17600);
  // Next month rolls over from the template (normal salary), not from the one-off month
  C.rollover(s, '2026-11-02', id);
  assert.equal(C.planIncome(C.planFor(s, '2026-11')), 220000);
  // Template change affects only months created afterwards
  s.template.sources[0].amount = 250000;
  C.rollover(s, '2026-12-01', id);
  assert.equal(C.planIncome(C.planFor(s, '2026-12')), 250000);
  assert.equal(C.planIncome(C.planFor(s, '2026-11')), 220000);
  assert.equal(C.planIncome(C.planFor(s, '2026-09')), 220000);
});

test('rollover fills skipped months and is idempotent', () => {
  const s = briefState();
  C.rollover(s, '2027-02-03', id);
  assert.deepEqual(Object.keys(s.months).sort(), ['2026-10', '2026-11', '2026-12', '2027-01', '2027-02']);
  const snapshot = JSON.stringify(s.months);
  C.rollover(s, '2027-02-03', id);
  assert.equal(JSON.stringify(s.months), snapshot);
});

test('remaining, savings, savings rate, category usage', () => {
  const s = briefState();
  exp(s, '2026-10-01', 50000, 'Rent');
  exp(s, '2026-10-03', 25000, 'Food');
  exp(s, '2026-10-04', 20000, 'Shopping');         // 200 vs 150 budget
  exp(s, '2026-10-05', 40000, 'Savings');           // moved to savings, not "spent"
  const m = C.monthSummary(s, '2026-10');
  assert.equal(m.spent, 95000);
  assert.equal(m.saved, 40000);
  assert.equal(m.remaining, 125000);               // 2,200 - 950
  assert.equal(m.savings, 125000);
  assert.equal(m.savingsRate, 56.8);               // 1250 / 2200
  const food = m.cats.find((c) => c.cat.id === 'c_Food');
  assert.equal(food.remaining, 5000); assert.equal(food.usage, 83.3);
  const shop = m.cats.find((c) => c.cat.id === 'c_Shopping');
  assert.equal(shop.over, true); assert.equal(shop.overBy, 5000); assert.equal(shop.usage, 133.3);
});

test('safe to spend reserves unpaid fixed costs and planned savings', () => {
  const s = briefState();
  exp(s, '2026-10-01', 50000, 'Rent');
  exp(s, '2026-10-04', 30000, 'Food');
  const r = C.safeToSpend(s, TODAY);
  // remaining 2200-800 = 1400; reserve Bills 150 + Savings 400 => 850 available
  assert.equal(r.summary.remaining, 140000);
  assert.equal(r.reservedFixed, 15000);
  assert.equal(r.reservedSavings, 40000);
  assert.equal(r.available, 85000);
  assert.equal(r.days, 15);                         // Oct 10 -> Oct 25
  assert.equal(r.safeDaily, Math.floor(85000 / 15));
});

test('paying the planned savings does not shrink safe-to-spend twice', () => {
  const s = briefState();
  const before = C.safeToSpend(s, TODAY);
  exp(s, '2026-10-02', 40000, 'Savings');
  const after = C.safeToSpend(s, TODAY);
  assert.equal(after.available, before.available); // money moved from remaining to saved, reserve released
});

test('payday: days until, clamping to short months', () => {
  assert.equal(nextPayday('2026-10-10', 25), '2026-10-25');
  assert.equal(nextPayday('2026-10-25', 25), '2026-11-25');
  assert.equal(nextPayday('2026-02-10', 31), '2026-02-28');
  assert.equal(nextPayday('2026-12-30', 5), '2027-01-05');
  assert.equal(clampDay('2028-02', 31), '2028-02-29');
});

test('recurring: occurrences, month-end clamping, costs', () => {
  const rec = { frequency: 'monthly', startDate: '2026-01-31', amount: 1399 };
  assert.equal(C.occurrence(rec, 1), '2026-02-28');
  assert.equal(C.occurrence(rec, 2), '2026-03-31'); // no drift
  assert.equal(C.annualCost(rec), 16788);
  assert.equal(C.monthlyCost(rec), 1399);
  assert.equal(C.annualCost({ frequency: 'weekly', amount: 1000 }), 52000);
  assert.equal(C.monthlyCost({ frequency: 'weekly', amount: 1000 }), 4333);
  assert.equal(C.monthlyCost({ frequency: 'yearly', amount: 12000 }), 1000);
  assert.equal(C.monthlyCost({ frequency: 'quarterly', amount: 3000 }), 1000);
});

test('recurring expenses are generated once per due date (idempotent, catches up after a gap)', () => {
  const s = briefState();
  s.categories.push({ id: 'c_Subs', name: 'Subs', kind: 'fixed' });
  s.recurring.push({ id: 'r1', name: 'Netflix', amount: 1399, frequency: 'monthly', categoryId: 'c_Subs', startDate: '2026-08-15', active: true, generatedThrough: null });
  C.rollover(s, '2026-10-10', id);
  const dates = s.expenses.filter((e) => e.recurringId === 'r1').map((e) => e.date);
  assert.deepEqual(dates, ['2026-08-15', '2026-09-15']);
  C.rollover(s, '2026-10-10', id);
  assert.equal(s.expenses.filter((e) => e.recurringId === 'r1').length, 2);
  C.rollover(s, '2026-12-20', id);
  assert.deepEqual(s.expenses.filter((e) => e.recurringId === 'r1').map((e) => e.date), ['2026-08-15', '2026-09-15', '2026-10-15', '2026-11-15', '2026-12-15']);
  // paused items do not generate
  s.recurring[0].active = false;
  C.rollover(s, '2027-03-01', id);
  assert.equal(s.expenses.filter((e) => e.recurringId === 'r1').length, 5);
});

test('upcoming recurring is reserved in safe-to-spend and not double counted once generated', () => {
  const s = briefState();
  s.recurring.push({ id: 'r1', name: 'Gym', amount: 3000, frequency: 'monthly', categoryId: 'c_Shopping', startDate: '2026-10-20', active: true, generatedThrough: null });
  const r = C.safeToSpend(s, TODAY);
  assert.equal(r.upcoming.length, 1);
  assert.equal(r.reservedVariable, 3000);
  C.rollover(s, '2026-10-20', id);
  const r2 = C.safeToSpend(s, '2026-10-20');
  assert.equal(r2.upcoming.length, 0);
});

test('goals: required monthly saving, progress and projected date', () => {
  const s = briefState();
  s.goals.push({ id: 'g1', name: 'iPhone', target: 160000, start: 80000, deadline: '2027-04-10', monthly: 10000 });
  const g = C.goalStatus(s, s.goals[0], TODAY);
  assert.equal(g.progress, 50);
  assert.equal(g.remaining, 80000);
  assert.equal(g.monthsLeft, 6);
  assert.equal(g.required, 13334);                  // ceil(80000/6)
  assert.equal(g.onTrack, false);                   // 800/100 = 8 months > 6
  exp(s, '2026-10-12', 40000, 'Savings', { fundId: 'g1' });
  const g2 = C.goalStatus(s, s.goals[0], TODAY);
  assert.equal(g2.current, 120000); assert.equal(g2.progress, 75);
  exp(s, '2026-10-13', 40000, 'Savings', { fundId: 'g1' });
  assert.equal(C.goalStatus(s, s.goals[0], TODAY).done, true);
});

test('emergency coverage', () => {
  const s = briefState();
  s.categories.forEach((c) => { if (['Rent', 'Food', 'Bills', 'Transport'].includes(c.name)) c.essential = true; });
  s.emergency.start = 300000;
  const e = C.emergencyStatus(s, '2026-10');
  assert.equal(e.essential, 110000);               // 500+300+150+150 ... Rent 500 + Food 300 + Transport 150 + Bills 150 = 1,100
  assert.equal(e.coverage, 2.7);
  assert.equal(e.targetAmount, 330000);
  s.emergency.essentialOverride = 120000;
  assert.equal(C.emergencyStatus(s, '2026-10').coverage, 2.5);
});

test('money leaks: small purchases and annual projection', () => {
  const s = briefState();
  exp(s, '2026-10-01', 450, 'Food', { description: 'Coffee' });
  exp(s, '2026-10-02', 450, 'Food', { description: 'coffee' });
  exp(s, '2026-10-03', 980, 'Food', { description: 'Fast food' });
  exp(s, '2026-10-04', 5000, 'Food', { description: 'Groceries' });   // too big
  exp(s, '2026-10-05', 500, 'Rent');                                  // fixed -> not a leak
  const l = C.moneyLeaks(s, '2026-10');
  assert.equal(l.count, 3); assert.equal(l.total, 1880); assert.equal(l.annual, 22560);
  assert.equal(l.groups[0].name, 'Fast food');
  assert.equal(l.groups.find((g) => g.name.toLowerCase() === 'coffee').count, 2);
});

test('rules evaluate and flag violations', () => {
  const s = briefState();
  s.rules.push({ id: 'r1', type: 'maxCategory', categoryId: 'c_Shopping', amount: 10000 });
  s.rules.push({ id: 'r2', type: 'minSavings', amount: 100000 });
  exp(s, '2026-10-02', 12000, 'Shopping');
  const [a, b] = C.evaluateRules(s, '2026-10');
  assert.equal(a.status, 'violated'); assert.equal(a.gap, 2000);
  assert.equal(b.status, 'ok');
  exp(s, '2026-10-03', 110000, 'Rent');
  assert.equal(C.evaluateRules(s, '2026-10')[1].status, 'violated');
});

test('can I afford this: safe / caution / not recommended', () => {
  const s = briefState();
  exp(s, '2026-10-01', 50000, 'Rent');
  const small = C.canAfford(s, TODAY, 2000);
  assert.equal(small.verdict, 'safe');
  // available = 2200-500 -150 bills - 400 savings = 1150 ; 1300 eats 150 of planned savings
  const mid = C.canAfford(s, TODAY, 130000);
  assert.equal(mid.verdict, 'caution'); assert.equal(mid.savingsHit, 15000);
  assert.match(mid.reasons[0], /reduce your planned savings by/);
  const big = C.canAfford(s, TODAY, 160000);
  assert.equal(big.verdict, 'no'); assert.equal(big.billsHit, 5000); assert.equal(big.savingsHit, 40000);
  const huge = C.canAfford(s, TODAY, 250000);
  assert.equal(huge.verdict, 'no');
});

test('what-if: savings drop and goal delay', () => {
  const s = briefState();
  s.profile.savingsStart = 150000;
  s.goals.push({ id: 'g1', name: 'Trip', target: 100000, start: 0, deadline: '2027-10-10', monthly: 33333 });
  const w = C.whatIf(s, TODAY, { amount: 20000, source: 'savings' });
  assert.equal(w.savingsNow, 150000); assert.equal(w.savingsAfter, 130000);
  assert.equal(w.goalDelays[0].days, 19);          // 200 / (333.33/30.4375)
  const m = C.whatIf(s, TODAY, { amount: 20000, source: 'month' });
  assert.equal(m.spentAfter - m.spentNow, 20000);
  assert.equal(m.remainingAfter, m.remainingNow - 20000);
});

test('financial health is bounded and explains itself', () => {
  const s = demoState(TODAY);
  const h = C.financialHealth(s, TODAY);
  assert.ok(h.score >= 0 && h.score <= 100);
  assert.ok(h.factors.length >= 6);
  const empty = C.financialHealth(briefState(), TODAY);
  assert.ok(empty.score >= 0 && empty.score <= 100);
});

test('setup builds a plan that never exceeds income and honours recurring items', () => {
  const setup = { currency: 'EUR', income: 220000, payDay: 25, savingsTarget: 40000, debts: [{ name: 'Card', balance: 100000, payment: 5000 }],
    recurring: [{ name: 'Rent', amount: 90000, categoryKey: 'housing', day: 1 }, { name: 'Netflix', amount: 1399, categoryKey: 'subs', day: 12 }] };
  const d = suggestBudget(setup);
  const st = buildState(setup, d, '2026-10-20', id);
  const a = C.allocation(st, C.planFor(st, '2026-10'));
  assert.ok(a.allocated <= a.income, 'allocated within income');
  const housing = st.categories.find((c) => c.key === 'housing');
  assert.ok(C.budgetAmount(C.planFor(st, '2026-10'), housing.id) >= 90000);
  assert.equal(st.expenses.filter((e) => e.recurringId).length, 3); // rent, netflix(12th), debt payment (1st)
  assert.equal(st.mode, 'user');
  assert.equal(st.expenses.some((e) => String(e.id).startsWith('demo')), false);
});

test('demo data is realistic and self-consistent', () => {
  const s = demoState(TODAY);
  assert.equal(s.mode, 'demo');
  assert.ok(s.expenses.length > 100);
  assert.ok(s.expenses.every((e) => e.date <= TODAY));
  assert.equal(Object.keys(s.months).length, 6);
  const sep = C.monthSummary(s, '2026-09'), aug = C.monthSummary(s, '2026-08');
  assert.equal(C.planIncome(aug.plan), 245000);    // the "bonus" month keeps its own income
  assert.equal(sep.income, 220000);
});

test('backup sanitising rejects garbage and drops invalid rows', () => {
  assert.throws(() => sanitizeState(null));
  assert.throws(() => sanitizeState({}));
  const s = demoState(TODAY);
  const copy = JSON.parse(JSON.stringify(s));
  copy.expenses.push({ id: 'bad', date: 'nope', amount: 5.5, categoryId: 'x' });
  const { state, warnings } = sanitizeState(copy);
  assert.equal(state.expenses.length, s.expenses.length);
  assert.equal(warnings.length, 1);
});

test('csv: parse quotes/delimiters, bank import mapping, export round-trip', () => {
  const text = 'Date;Description;Amount\n05.10.2026;"Café ""Roma"", Berlin";-4,50\n06.10.2026;Salary;2200,00\n07.10.2026;Lidl;-32,10\n';
  const rows = parseCsv(text);
  assert.equal(rows.length, 4);
  assert.equal(rows[1][1], 'Café "Roma", Berlin');
  const map = detectColumns(rows[0]);
  assert.deepEqual([map.date, map.description, map.amount], [0, 1, 2]);
  const fmtGuess = detectDateFormat(rows.slice(1).map((r) => r[0]));
  assert.equal(fmtGuess, 'DD.MM.YYYY');
  const out = buildImportRows(rows.slice(1), map, { dateFormat: fmtGuess, negativeIsExpense: true });
  assert.equal(out[0].amount, 450); assert.equal(out[0].date, '2026-10-05'); assert.equal(out[0].skip, null);
  assert.equal(out[1].skip, 'income');
  assert.equal(out[2].amount, 3210);
  const s = briefState(); exp(s, '2026-10-01', 450, 'Food', { description: '=HYPERLINK("x")' });
  const csv = expensesToCsv(s);
  assert.match(csv, /^Date,Amount,Category/);
  assert.match(csv, /'=HYPERLINK/);
  assert.equal(parseCsv(csv)[1][1], '4.50');
});
