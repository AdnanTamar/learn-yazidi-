// Pure calculation engine. No DOM, no storage. All money in integer cents.
import { pctToAmount, amountToBp, roundDiv, pct1 } from './money.js';
import {
  addDays, addMonths, clampDay, daysInMonth, diffDays, dow, dayOf, firstOfMonth, lastOfMonth, monthDiff, monthLen,
  monthOf, monthRange, nextPayday, parseYmd, ymd, ymParts, toDays, fromDays,
} from './dates.js';

export const FREQUENCIES = {
  weekly: { label: 'Weekly', perYear: 52 },
  monthly: { label: 'Monthly', perYear: 12 },
  quarterly: { label: 'Quarterly', perYear: 4 },
  yearly: { label: 'Yearly', perYear: 1 },
};
export const PAYMENT_METHODS = ['Cash', 'Debit card', 'Credit card', 'Bank transfer', 'Apple Pay', 'Other'];

const sum = (arr, f = (x) => x) => arr.reduce((a, x) => a + f(x), 0);
const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));

/* ───────────────────────── Category / month plan ───────────────────────── */

export const catById = (state, id) => state.categories.find((c) => c.id === id);
export const isSavingsCat = (state, id) => catById(state, id)?.kind === 'savings';

export function incomeTotal(sources) {
  return sum(sources || [], (s) => s.amount || 0);
}

/** Main income source = the largest one (drives "days until payday"). */
export function mainSource(sources) {
  return [...(sources || [])].sort((a, b) => b.amount - a.amount)[0] || null;
}

function clonePlan(p) { return JSON.parse(JSON.stringify(p)); }

/**
 * Plan (income + budgets) for a month. Stored snapshots are authoritative, so editing the salary later never
 * rewrites history. A month without a snapshot is derived (virtually) from the nearest earlier snapshot,
 * else the nearest later one, else the template - and is flagged `virtual`.
 */
export function planFor(state, ym) {
  const stored = state.months[ym];
  if (stored) return { ...stored, virtual: false };
  const keys = Object.keys(state.months).sort();
  const earlier = keys.filter((k) => k < ym).pop();
  const later = keys.find((k) => k > ym);
  const base = state.months[earlier] || state.months[later] || state.template;
  const p = clonePlan(base);
  return { sources: p.sources, budgets: p.budgets, virtual: true };
}

/** Materialise a month's snapshot (copy of what planFor would give) so it can be edited independently. */
export function ensureMonth(state, ym) {
  if (!state.months[ym]) {
    const p = planFor(state, ym);
    state.months[ym] = { sources: p.sources, budgets: p.budgets };
  }
  return state.months[ym];
}

export function planIncome(plan) { return incomeTotal(plan.sources); }

export function budgetAmount(plan, catId) {
  const b = plan.budgets[catId];
  if (!b) return 0;
  return b.mode === 'percent' ? pctToAmount(planIncome(plan), b.value) : b.value;
}
export function budgetBp(plan, catId) {
  const b = plan.budgets[catId];
  if (!b) return 0;
  return b.mode === 'percent' ? b.value : amountToBp(b.value, planIncome(plan));
}

/** Allocated vs unallocated for a plan. */
export function allocation(state, plan) {
  const income = planIncome(plan);
  const rows = state.categories.map((c) => ({ cat: c, amount: budgetAmount(plan, c.id), bp: budgetBp(plan, c.id) }));
  const allocated = sum(rows, (r) => r.amount);
  return {
    income, rows, allocated,
    unallocated: income - allocated,
    allocatedBp: amountToBp(allocated, income),
    over: allocated > income,
  };
}

/* ───────────────────────── Recurring expenses ───────────────────────── */

export function annualCost(rec) { return rec.amount * FREQUENCIES[rec.frequency].perYear; }
export function monthlyCost(rec) { return roundDiv(annualCost(rec), 12); }

/** k-th occurrence date (k >= 0) of a recurring item, anchored on its start date (no day drift). */
export function occurrence(rec, k) {
  const { y, m, d } = parseYmd(rec.startDate);
  if (rec.frequency === 'weekly') return addDays(rec.startDate, 7 * k);
  const step = rec.frequency === 'monthly' ? 1 : rec.frequency === 'quarterly' ? 3 : 12;
  const ym = addMonths(ymd(y, m, 1).slice(0, 7), step * k);
  return clampDay(ym, d);
}

/** All occurrences with from < date <= to  (from exclusive so `generatedThrough` works naturally). */
export function occurrencesBetween(rec, fromExcl, toIncl) {
  const out = [];
  for (let k = 0; k < 5000; k++) {
    const d = occurrence(rec, k);
    if (d > toIncl) break;
    if (!fromExcl || d > fromExcl) out.push(d);
  }
  return out;
}

export function nextOccurrence(rec, afterIncl) {
  for (let k = 0; k < 5000; k++) {
    const d = occurrence(rec, k);
    if (d >= afterIncl) return d;
  }
  return null;
}

/** Generates due recurring expenses up to `today`. Idempotent: advances rec.generatedThrough. Returns count added. */
export function generateRecurring(state, today, newId) {
  let added = 0;
  for (const rec of state.recurring) {
    if (!rec.active) continue;
    const dates = occurrencesBetween(rec, rec.generatedThrough || null, today);
    for (const date of dates) {
      state.expenses.push({
        id: newId(), date, amount: rec.amount, categoryId: rec.categoryId, description: rec.name,
        method: rec.method || 'Bank transfer', recurringId: rec.id, fundId: rec.fundId || null,
      });
      added++;
    }
    if (dates.length) rec.generatedThrough = dates[dates.length - 1];
    else if (!rec.generatedThrough && rec.startDate > today) { /* not started yet */ }
  }
  return added;
}

/**
 * Monthly rollover: materialise snapshots from the template for every month between the latest existing
 * snapshot and the current month (so a missed month still gets a plan), then generate recurring expenses.
 */
export function rollover(state, today, newId) {
  const cur = monthOf(today);
  const keys = Object.keys(state.months).sort();
  const last = keys[keys.length - 1];
  if (!last) {
    state.months[cur] = clonePlan(state.template);
  } else if (monthDiff(cur, last) > 0) {
    for (const ym of monthRange(addMonths(last, 1), cur)) state.months[ym] = clonePlan(state.template);
  }
  return generateRecurring(state, today, newId);
}

/* ───────────────────────── Month summary ───────────────────────── */

export const expensesIn = (state, ym) => state.expenses.filter((e) => e.date.startsWith(ym));
export const spentOnly = (state, list) => list.filter((e) => !isSavingsCat(state, e.categoryId));

export function monthSummary(state, ym) {
  const plan = planFor(state, ym);
  const income = planIncome(plan);
  const list = expensesIn(state, ym);
  const spendList = spentOnly(state, list);
  const spent = sum(spendList, (e) => e.amount);
  const saved = sum(list.filter((e) => isSavingsCat(state, e.categoryId)), (e) => e.amount);
  const alloc = allocation(state, plan);

  const cats = state.categories.map((c) => {
    const budget = budgetAmount(plan, c.id);
    const catSpent = sum(list.filter((e) => e.categoryId === c.id), (e) => e.amount);
    return {
      cat: c, budget, spent: catSpent, remaining: budget - catSpent,
      remainingPct: budget ? pct1(budget - catSpent, budget) : 0,
      usage: budget ? pct1(catSpent, budget) : (catSpent > 0 ? Infinity : 0),
      over: budget > 0 ? catSpent > budget : catSpent > 0 && c.kind !== 'savings',
      overBy: Math.max(0, catSpent - budget),
      bp: budgetBp(plan, c.id),
    };
  });
  const byKind = (k) => cats.filter((c) => c.cat.kind === k);
  const nonSavings = cats.filter((c) => c.cat.kind !== 'savings');
  const largestCat = [...nonSavings].filter((c) => c.spent > 0).sort((a, b) => b.spent - a.spent)[0] || null;
  const largestExpense = [...spendList].sort((a, b) => b.amount - a.amount)[0] || null;
  const overspend = sum(nonSavings, (c) => c.overBy);
  const budgeted = nonSavings.filter((c) => c.budget > 0);

  return {
    ym, plan, income, spent, saved, count: list.length,
    remaining: income - spent,
    savings: income - spent,
    savingsRate: income ? pct1(income - spent, income) : 0,
    spentPct: income ? pct1(spent, income) : 0,
    savedPct: income ? pct1(saved, income) : 0,
    alloc, cats,
    fixedSpent: sum(byKind('fixed'), (c) => c.spent), variableSpent: sum(byKind('variable'), (c) => c.spent),
    fixedBudget: sum(byKind('fixed'), (c) => c.budget), variableBudget: sum(byKind('variable'), (c) => c.budget),
    savingsBudget: sum(byKind('savings'), (c) => c.budget),
    largestCat, largestExpense, overspend,
    withinBudget: budgeted.filter((c) => !c.over).length, budgetedCount: budgeted.length,
    hasData: list.length > 0 || !plan.virtual,
  };
}

/* ───────────────────────── Safe to spend ───────────────────────── */

export function upcomingRecurring(state, fromExcl, toIncl) {
  const out = [];
  for (const rec of state.recurring) {
    if (!rec.active) continue;
    for (const date of occurrencesBetween(rec, fromExcl, toIncl)) {
      if (date > (rec.generatedThrough || '')) out.push({ rec, date, amount: rec.amount, categoryId: rec.categoryId });
    }
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

export function daysUntilPayday(state, today, ym = monthOf(today)) {
  const src = mainSource(planFor(state, ym).sources);
  const payDay = src?.payDay || 1;
  const next = nextPayday(today, payDay);
  return { next, days: Math.max(1, diffDays(next, today)), payDay };
}

/**
 * Safe to spend = money left this month, minus what is already spoken for:
 *  - unspent portions of fixed/savings budgets (rent not yet paid, planned savings not yet moved)
 *  - known recurring payments due before the next payday
 * Safe daily = that pool / days until the next payday.
 */
export function safeToSpend(state, today) {
  const ym = monthOf(today);
  const s = monthSummary(state, ym);
  const { next, days } = daysUntilPayday(state, today, ym);
  const upcoming = upcomingRecurring(state, today, next);
  const reserveByCat = {};
  for (const c of s.cats) {
    const up = sum(upcoming.filter((u) => u.categoryId === c.cat.id), (u) => u.amount);
    const budgetLeft = Math.max(0, c.budget - c.spent);
    reserveByCat[c.cat.id] = c.cat.kind === 'variable' ? up : Math.max(budgetLeft, up);
  }
  const reservedFixed = sum(s.cats.filter((c) => c.cat.kind === 'fixed'), (c) => reserveByCat[c.cat.id]);
  const reservedSavings = sum(s.cats.filter((c) => c.cat.kind === 'savings'), (c) => reserveByCat[c.cat.id]);
  const reservedVariable = sum(s.cats.filter((c) => c.cat.kind === 'variable'), (c) => reserveByCat[c.cat.id]);
  const reserved = reservedFixed + reservedSavings + reservedVariable;
  const cashLeft = s.remaining - s.saved; // money still in your account this month
  const availableRaw = cashLeft - reserved;
  const available = Math.max(0, availableRaw);
  const safeDaily = Math.floor(available / days);
  return {
    ym, summary: s, days, nextPayday: next, upcoming, reserveByCat,
    reservedFixed, reservedSavings, reservedVariable, reserved,
    cashLeft, availableRaw, available, safeDaily,
  };
}

/* ───────────────────────── Savings, goals, emergency fund ───────────────────────── */

export function fundTotal(state, fundId) {
  return sum(state.expenses.filter((e) => e.fundId === fundId), (e) => e.amount);
}
export function totalSavings(state) {
  return (state.profile.savingsStart || 0) + sum(state.expenses.filter((e) => isSavingsCat(state, e.categoryId)), (e) => e.amount);
}
export function goalCurrent(state, goal) { return (goal.start || 0) + fundTotal(state, goal.id); }

export function goalStatus(state, goal, today) {
  const current = goalCurrent(state, goal);
  const remaining = Math.max(0, goal.target - current);
  const progress = goal.target ? clamp(pct1(current, goal.target), 0, 100) : 0;
  const done = current >= goal.target;
  let monthsLeft = null, required = null, projected = null, onTrack = null, daysLeft = null;
  if (goal.deadline) {
    daysLeft = diffDays(goal.deadline, today);
    monthsLeft = Math.max(1, Math.ceil(Math.max(0, daysLeft) / 30.4375));
    required = done ? 0 : Math.ceil(remaining / monthsLeft);
  }
  if (!done && goal.monthly > 0) {
    projected = addDays(today, Math.ceil((remaining / goal.monthly) * 30.4375));
    if (goal.deadline) onTrack = projected <= goal.deadline;
  }
  return { goal, current, remaining, progress, done, monthsLeft, daysLeft, required, projected, onTrack };
}

export function essentialMonthly(state, ym) {
  const o = state.emergency.essentialOverride;
  if (o != null && o > 0) return { amount: o, source: 'manual' };
  const s = monthSummary(state, ym);
  const ess = s.cats.filter((c) => c.cat.essential && c.cat.kind !== 'savings');
  const planned = sum(ess, (c) => c.budget);
  if (planned > 0) return { amount: planned, source: 'budget' };
  return { amount: sum(ess, (c) => c.spent), source: 'spending' };
}

export function emergencyStatus(state, ym) {
  const current = (state.emergency.start || 0) + fundTotal(state, 'emergency');
  const ess = essentialMonthly(state, ym);
  const coverage = ess.amount ? Math.round((current / ess.amount) * 10) / 10 : 0;
  const targetMonths = state.emergency.targetMonths || 3;
  const targetAmount = ess.amount * targetMonths;
  return {
    current, essential: ess.amount, essentialSource: ess.source, coverage, targetMonths, targetAmount,
    needed: Math.max(0, targetAmount - current),
    progress: targetAmount ? clamp(pct1(current, targetAmount), 0, 100) : 0,
    level: coverage >= 6 ? 'strong' : coverage >= targetMonths ? 'good' : coverage >= 1 ? 'building' : 'low',
  };
}

/* ───────────────────────── Series & helpers for charts/insights ───────────────────────── */

export function monthTotals(state, months) {
  return months.map((ym) => {
    const s = monthSummary(state, ym);
    return { ym, income: s.income, spent: s.spent, saved: s.saved, savings: s.savings, count: s.count, hasData: s.count > 0 || !s.plan.virtual };
  });
}

/** Spending per day of month. `discretionary` keeps only variable-category, non-recurring purchases (what you actually choose). */
export function dailySpend(state, ym, discretionary = false) {
  const n = monthLen(ym);
  const arr = new Array(n).fill(0);
  const list = discretionary
    ? expensesIn(state, ym).filter((e) => !e.recurringId && catById(state, e.categoryId)?.kind === 'variable')
    : spentOnly(state, expensesIn(state, ym));
  for (const e of list) arr[dayOf(e.date) - 1] += e.amount;
  return arr;
}

export function spentByCat(state, ym, uptoDay = 99) {
  const m = {};
  for (const e of spentOnly(state, expensesIn(state, ym))) {
    if (dayOf(e.date) <= uptoDay) m[e.categoryId] = (m[e.categoryId] || 0) + e.amount;
  }
  return m;
}

/* ───────────────────────── Money leaks ───────────────────────── */

export const isLeakCandidate = (state, e, threshold) =>
  e.amount > 0 && e.amount <= threshold && !e.recurringId && catById(state, e.categoryId)?.kind === 'variable';

export function moneyLeaks(state, ym) {
  const threshold = state.settings.leakThreshold;
  const list = expensesIn(state, ym).filter((e) => isLeakCandidate(state, e, threshold));
  const total = sum(list, (e) => e.amount);
  const groups = new Map();
  for (const e of list) {
    const key = (e.description || catById(state, e.categoryId)?.name || 'Other').trim().toLowerCase();
    const g = groups.get(key) || { name: e.description?.trim() || catById(state, e.categoryId)?.name || 'Other', count: 0, total: 0 };
    g.count++; g.total += e.amount;
    groups.set(key, g);
  }
  return {
    ym, threshold, count: list.length, total, annual: total * 12,
    average: list.length ? roundDiv(total, list.length) : 0,
    groups: [...groups.values()].sort((a, b) => b.total - a.total),
  };
}

/* ───────────────────────── Rules ───────────────────────── */

export const RULE_TYPES = {
  maxCategory: { label: 'Spend at most … on a category per month', needsCat: true },
  maxTotal: { label: 'Spend at most … in total per month', needsCat: false },
  minSavings: { label: 'Always keep at least … left over each month', needsCat: false },
  minBalance: { label: 'Keep at least … untouched in savings', needsCat: false },
};

export function ruleText(state, rule, fmtMoney) {
  const a = fmtMoney(rule.amount);
  const c = catById(state, rule.categoryId)?.name || 'category';
  switch (rule.type) {
    case 'maxCategory': return `Never spend more than ${a}/month on ${c}.`;
    case 'maxTotal': return `Never spend more than ${a}/month in total.`;
    case 'minSavings': return `Always save at least ${a} each month.`;
    case 'minBalance': return `Keep at least ${a} untouched in savings.`;
    default: return 'Rule';
  }
}

export function evaluateRules(state, ym) {
  const s = monthSummary(state, ym);
  return state.rules.map((rule) => {
    let value = 0, ok = true, warn = false, detail = '';
    switch (rule.type) {
      case 'maxCategory': {
        value = s.cats.find((c) => c.cat.id === rule.categoryId)?.spent || 0;
        ok = value <= rule.amount; warn = ok && value >= rule.amount * 0.9;
        detail = ok ? `${value} of ${rule.amount}` : `over by ${value - rule.amount}`;
        break;
      }
      case 'maxTotal':
        value = s.spent; ok = value <= rule.amount; warn = ok && value >= rule.amount * 0.9; break;
      case 'minSavings':
        value = s.savings; ok = value >= rule.amount; warn = ok && value < rule.amount * 1.1; break;
      case 'minBalance':
        value = totalSavings(state); ok = value >= rule.amount; warn = ok && value < rule.amount * 1.1; break;
    }
    const gap = rule.type.startsWith('max') ? value - rule.amount : rule.amount - value; // >0 = violated by
    return { rule, value, ok, warn, status: !ok ? 'violated' : warn ? 'warning' : 'ok', gap };
  });
}

/* ───────────────────────── Financial health ───────────────────────── */

export const healthLabel = (n) => (n >= 80 ? 'Excellent' : n >= 65 ? 'Good' : n >= 50 ? 'Fair' : n >= 35 ? 'Needs attention' : 'At risk');

export function financialHealth(state, today) {
  const ym = monthOf(today);
  const s = monthSummary(state, ym);
  const em = emergencyStatus(state, ym);
  const factors = [];
  const add = (key, label, weight, score, note) => factors.push({ key, label, weight, score: score == null ? null : Math.round(clamp(score, 0, 100)), note });

  const targetRate = state.settings.savingsRateTarget || 20;
  add('savings', 'Savings', 20, s.income ? (Math.max(0, s.savingsRate) / targetRate) * 100 : null,
    s.income ? `${s.savingsRate}% saved vs a ${targetRate}% goal` : 'Add income to score this');

  const nonSav = s.cats.filter((c) => c.cat.kind !== 'savings');
  const totalBudget = sum(nonSav, (c) => c.budget);
  const overRatio = totalBudget ? s.overspend / totalBudget : 0;
  const unbudgetedSpend = sum(nonSav.filter((c) => c.budget === 0), (c) => c.spent);
  add('budget', 'Budget control', 20, totalBudget ? 100 * (1 - Math.min(1, (s.overspend + unbudgetedSpend * 0) / totalBudget * 3)) : null,
    s.overspend ? `${Math.round(overRatio * 1000) / 10}% over budget in total` : 'Within budget');

  add('emergency', 'Emergency fund', 20, em.essential ? (em.coverage / em.targetMonths) * 100 : null, `${em.coverage} of ${em.targetMonths} months covered`);

  const debt = sum(state.profile.debts || [], (d) => d.balance);
  const pay = sum(state.profile.debts || [], (d) => d.payment || 0);
  const annualIncome = s.income * 12;
  const debtScore = debt === 0 ? 100 : annualIncome ? 100 - (debt / annualIncome) * 200 - (s.income ? (pay / s.income) * 100 : 0) : null;
  add('debt', 'Debt level', 10, debtScore, debt ? 'Debt balance compared with yearly income' : 'No debt recorded');

  const recMonthly = sum(state.recurring.filter((r) => r.active), monthlyCost);
  const recShare = s.income ? recMonthly / s.income : null;
  add('recurring', 'Recurring costs', 10, recShare == null ? null : 100 - ((recShare - 0.3) / 0.3) * 100,
    recShare == null ? 'Add income to score this' : `${Math.round(recShare * 100)}% of income is committed`);

  add('overspending', 'Overspending', 10, s.income ? 100 - ((s.spentPct - 80) / 20) * 100 : null, s.income ? `${s.spentPct}% of income spent` : 'Add income to score this');

  const hist = monthRange(addMonths(ym, -5), ym).filter((m) => state.months[m]).map((m) => planIncome(state.months[m])).filter((n) => n > 0);
  let stab = null, stabNote = 'Needs at least 2 months of history';
  if (hist.length >= 2) {
    const mean = sum(hist) / hist.length;
    const sd = Math.sqrt(sum(hist, (x) => (x - mean) ** 2) / hist.length);
    const cv = mean ? sd / mean : 0;
    stab = 100 - cv * 400;
    stabNote = cv < 0.02 ? 'Income is steady' : `Income varies by about ${Math.round(cv * 100)}%`;
  }
  add('stability', 'Income stability', 10, stab, stabNote);

  const used = factors.filter((f) => f.score != null);
  const w = sum(used, (f) => f.weight);
  const score = w ? Math.round(sum(used, (f) => f.score * f.weight) / w) : 0;
  return { score, label: healthLabel(score), factors };
}

/* ───────────────────────── Insights ───────────────────────── */

export function insights(state, today, ym = monthOf(today)) {
  const out = [];
  const money = state.fmt || ((c) => String(c / 100));
  const s = monthSummary(state, ym);
  const isCur = ym === monthOf(today);
  const day = isCur ? dayOf(today) : monthLen(ym);
  const push = (id, kind, icon, title, text) => out.push({ id, kind, icon, title, text });
  if (s.count === 0) return out;

  const nonSav = s.cats.filter((c) => c.cat.kind !== 'savings');
  if (s.largestCat) {
    const share = s.income ? Math.round((s.largestCat.spent / s.income) * 100) : null;
    push('top', 'info', s.largestCat.cat.icon, 'Highest spending', `${s.largestCat.cat.name} is your biggest category at ${money(s.largestCat.spent)}${share != null ? ` (${share}% of your income)` : ''}.`);
  }

  const prev = addMonths(ym, -1);
  const prevByCat = spentByCat(state, prev, day);
  const curByCat = spentByCat(state, ym, day);
  const prevHas = expensesIn(state, prev).length > 0;
  if (prevHas) {
    const deltas = nonSav.map((c) => ({ c, d: (curByCat[c.cat.id] || 0) - (prevByCat[c.cat.id] || 0), p: prevByCat[c.cat.id] || 0 }))
      .sort((a, b) => b.d - a.d);
    const up = deltas[0];
    if (up && up.d >= 1000) push('grow', 'warn', '📈', 'Fastest-growing', `You spent ${money(up.d)} more on ${up.c.cat.name.toLowerCase()} than ${isCur ? 'at this point' : 'in'} last month.`);
    const down = deltas[deltas.length - 1];
    if (down && down.d <= -1000) push('shrink', 'good', '📉', 'Spending down', `${down.c.cat.name} is ${money(-down.d)} lower than ${isCur ? 'at this point' : 'in'} last month.`);
  }

  for (const c of nonSav.filter((c) => c.over && c.budget > 0).sort((a, b) => b.overBy - a.overBy)) {
    push('over-' + c.cat.id, 'bad', '⚠️', `${c.cat.name} over budget`, `${c.cat.name} is ${money(c.overBy)} over budget (${money(c.spent)} of ${money(c.budget)}).`);
  }

  // Unusual expenses: far above that category's median
  const six = monthRange(addMonths(ym, -5), ym);
  const hist = state.expenses.filter((e) => six.includes(monthOf(e.date)) && !e.recurringId && catById(state, e.categoryId)?.kind === 'variable');
  const unusual = [];
  for (const e of expensesIn(state, ym).filter((e) => !e.recurringId && catById(state, e.categoryId)?.kind === 'variable')) {
    const peers = hist.filter((h) => h.categoryId === e.categoryId && h.id !== e.id).map((h) => h.amount).sort((a, b) => a - b);
    if (peers.length < 5) continue;
    const med = peers[Math.floor(peers.length / 2)];
    if (e.amount >= med * 3 && e.amount >= 2000) unusual.push({ e, med });
  }
  unusual.sort((a, b) => b.e.amount - a.e.amount);
  if (unusual[0]) push('unusual', 'warn', '🔎', 'Unusual expense', `${unusual[0].e.description || catById(state, unusual[0].e.categoryId).name} (${money(unusual[0].e.amount)}) is much bigger than your usual ${catById(state, unusual[0].e.categoryId).name.toLowerCase()} purchase (~${money(unusual[0].med)}).`);

  const leaks = moneyLeaks(state, ym);
  if (leaks.count >= 3) push('leaks', 'warn', '💧', 'Small purchases add up', `You spent ${money(leaks.total)} on small purchases ${leaks.count} times. That is about ${money(leaks.annual)} a year.`);

  const recs = state.recurring.filter((r) => r.active);
  if (recs.length) {
    const m = sum(recs, monthlyCost);
    push('recurring', 'info', '🔁', 'Recurring expenses', `${recs.length} recurring payments cost ${money(m)}/month (${money(m * 12)}/year)${s.income ? ` - ${Math.round((m / s.income) * 100)}% of income` : ''}.`);
    const subs = recs.filter((r) => catById(state, r.categoryId)?.sub);
    if (subs.length) push('subs', 'info', '📺', 'Subscriptions', `Your subscriptions cost ${money(sum(subs, monthlyCost))}/month.`);
  }

  const spendList = expensesIn(state, ym).filter((e) => !e.recurringId && catById(state, e.categoryId)?.kind === 'variable');
  const wkEnd = sum(spendList.filter((e) => [0, 6].includes(dow(e.date))), (e) => e.amount);
  if (spendList.length >= 6) {
    const share = Math.round((wkEnd / sum(spendList, (e) => e.amount)) * 100);
    if (share >= 36) push('weekend', 'info', '🎉', 'Weekend spending', `${share}% of your spending happens on weekends (2 of 7 days).`);
  }

  const byDow = new Array(7).fill(0), cntDow = new Array(7).fill(0);
  const days = dailySpend(state, ym, true);
  days.slice(0, day).forEach((v, i) => { const d = dow(ym + '-' + String(i + 1).padStart(2, '0')); byDow[d] += v; cntDow[d]++; });
  const avgDow = byDow.map((v, i) => (cntDow[i] ? v / cntDow[i] : 0));
  const maxI = avgDow.indexOf(Math.max(...avgDow));
  if (Math.max(...avgDow) > 0 && spendList.length >= 6) push('dow', 'info', '📅', 'Daily pattern', `${['Sundays', 'Mondays', 'Tuesdays', 'Wednesdays', 'Thursdays', 'Fridays', 'Saturdays'][maxI]} are your most expensive day (about ${money(Math.round(avgDow[maxI]))} on average).`);

  const trend = monthRange(addMonths(ym, -2), ym).map((m) => ({ m, v: monthSummary(state, m) })).filter((x) => x.v.count > 0);
  if (trend.length === 3 && !isCur) {
    const [a, b, c] = trend.map((t) => t.v.spent);
    if (a < b && b < c) push('trend', 'warn', '📈', 'Monthly trend', `Spending has risen three months in a row (${money(a)} → ${money(c)}).`);
    else if (a > b && b > c) push('trend', 'good', '📉', 'Monthly trend', `Spending has fallen three months in a row (${money(a)} → ${money(c)}).`);
  }

  if (isCur) {
    const safe = safeToSpend(state, today);
    const elapsed = Math.max(1, dayOf(today));
    const dailyVar = s.variableSpent / elapsed;
    if (dailyVar > 0 && safe.available >= 0) {
      const lasts = Math.floor(safe.available / dailyVar);
      if (lasts < safe.days) push('pace', 'bad', '⏳', 'Spending pace', `At your current rate you may run out of your variable budget ${safe.days - lasts} day${safe.days - lasts === 1 ? '' : 's'} before payday.`);
      else push('pace', 'good', '✅', 'Spending pace', `At your current rate your variable budget lasts until payday.`);
    }
  }
  if (s.income && s.savingsRate >= (state.settings.savingsRateTarget || 20) && !isCur) push('saved', 'good', '💰', 'Saved well', `You saved ${s.savingsRate}% of your income this month.`);
  return out;
}

/* ───────────────────────── Alerts ───────────────────────── */

export const ALERT_TYPES = {
  budget: 'Category budget warnings',
  pace: 'Daily spending pace',
  low: 'Low money before payday',
  recurring: 'Upcoming recurring payments',
  savings: 'Savings milestones',
  trend: 'Spending trends',
  rules: 'Budget rule violations',
  plan: 'Budget plan problems',
};

export function alerts(state, today) {
  const ym = monthOf(today);
  const money = state.fmt || ((c) => String(c / 100));
  const out = [];
  const push = (type, severity, icon, text) => out.push({ id: `${type}:${text}`, type, severity, icon, text });
  const s = monthSummary(state, ym);
  const safe = safeToSpend(state, today);

  for (const c of s.cats) {
    if (c.cat.kind === 'savings' || !c.budget) continue;
    if (c.spent > c.budget) push('budget', 'bad', '🚨', `${c.cat.name} is ${money(c.overBy)} over budget.`);
    else if (c.usage >= 80) push('budget', 'warn', '⚠️', `You have spent ${Math.round(c.usage)}% of your ${c.cat.name.toLowerCase()} budget.`);
  }
  const last7 = (() => {
    let t = 0;
    for (let i = 0; i < 7; i++) { const d = addDays(today, -i); if (monthOf(d) === ym) t += dailySpend(state, ym, true)[dayOf(d) - 1] || 0; }
    return t;
  })();
  const recentDaily = Math.round(last7 / Math.min(7, dayOf(today)));
  if (safe.safeDaily > 0 && recentDaily > safe.safeDaily * 1.25 && recentDaily - safe.safeDaily >= 100) {
    push('pace', 'warn', '⚠️', `You are spending ${money(recentDaily, true)}/day but your safe limit is ${money(safe.safeDaily, true)}/day.`);
  } else if (safe.availableRaw <= 0 && s.count > 0 && s.income) {
    push('pace', 'bad', '🚨', `Nothing is safe to spend right now: your remaining money is already committed.`);
  }
  if (s.income && safe.available > 0 && safe.available < s.income * 0.15) {
    push('low', 'warn', '⚠️', `You have ${money(safe.available, true)} safe to spend and ${safe.days} days until payday.`);
  }
  for (const u of safe.upcoming) {
    const dd = diffDays(u.date, today);
    if (dd >= 1 && dd <= 3) push('recurring', 'info', '🔔', `A recurring payment of ${money(u.amount)} (${u.rec.name}) is coming ${dd === 1 ? 'tomorrow' : `in ${dd} days`}.`);
  }
  if (s.income && s.savingsRate >= (state.settings.savingsRateTarget || 20) && s.count > 3) push('savings', 'good', '💰', `You are on track to save ${s.savingsRate}% of your income this month.`);
  const prevByCat = spentByCat(state, addMonths(ym, -1), dayOf(today));
  const curByCat = spentByCat(state, ym, dayOf(today));
  for (const c of s.cats) {
    const p = prevByCat[c.cat.id] || 0, n = curByCat[c.cat.id] || 0;
    if (c.cat.kind !== 'savings' && p >= 2000 && n - p >= 1000 && n >= p * 1.15) push('trend', 'warn', '📈', `Your ${c.cat.name.toLowerCase()} spending increased by ${Math.round(((n - p) / p) * 100)}% compared with last month.`);
  }
  for (const r of evaluateRules(state, ym)) {
    if (r.status === 'violated') push('rules', 'bad', '🚫', `Rule broken: ${ruleText(state, r.rule, money)}`);
  }
  if (s.alloc.over) push('plan', 'bad', '🚨', `Your budget is over-allocated by ${money(-s.alloc.unallocated)}.`);
  else if (s.alloc.income && s.alloc.unallocated > 0) push('plan', 'info', '🧭', `${money(s.alloc.unallocated)} of your income has no job yet.`);
  const rank = { bad: 0, warn: 1, info: 2, good: 3 };
  return out.sort((a, b) => rank[a.severity] - rank[b.severity]);
}

/* ───────────────────────── Afford & What-if ───────────────────────── */

export function withExpense(state, exp) {
  return { ...state, expenses: [...state.expenses, { id: '_tmp', method: 'Other', ...exp }] };
}

export function canAfford(state, today, amount, categoryId = null) {
  const money = state.fmt || ((c) => String(c / 100));
  const safe = safeToSpend(state, today);
  const s = safe.summary;
  const reasons = [];
  let verdict = 'safe';
  const bump = (v) => { const r = { safe: 0, caution: 1, no: 2 }; if (r[v] > r[verdict]) verdict = v; };

  const after = safe.available - amount;
  const shortfall = Math.max(0, amount - safe.available);
  const savingsHit = Math.min(shortfall, safe.reservedSavings);
  const billsHit = Math.max(0, shortfall - safe.reservedSavings);
  const afterDaily = Math.floor(Math.max(0, after) / safe.days);

  if (amount > safe.cashLeft) {
    bump('no');
    reasons.push(`It is more than the ${money(Math.max(0, safe.cashLeft))} you have left this month.`);
  } else if (shortfall === 0) {
    reasons.push(`You can afford this: it uses ${money(amount)} of your ${money(safe.available)} safe-to-spend money.`);
    if (safe.safeDaily > 0 && afterDaily < safe.safeDaily * 0.5) { bump('caution'); reasons.push(`Your safe daily limit would fall from ${money(safe.safeDaily)} to ${money(afterDaily)} for the next ${safe.days} days.`); }
    else reasons.push(`Your safe daily limit would go from ${money(safe.safeDaily)} to ${money(afterDaily)}.`);
  } else if (billsHit === 0) {
    bump('caution');
    reasons.push(`You can afford this, but it would reduce your planned savings by ${money(savingsHit)} this month.`);
  } else {
    bump('no');
    if (savingsHit > 0) reasons.push(`It would wipe out ${money(savingsHit)} of planned savings and leave ${money(billsHit)} short of upcoming bills and fixed costs.`);
    else reasons.push(`It would leave you ${money(billsHit)} short for bills and fixed costs still to come this month.`);
  }
  if (categoryId) {
    const c = s.cats.find((x) => x.cat.id === categoryId);
    if (c && c.cat.kind !== 'savings' && c.budget > 0 && c.spent + amount > c.budget) {
      bump('caution');
      reasons.push(`${c.cat.name} would go ${money(c.spent + amount - c.budget)} over its ${money(c.budget)} budget.`);
    }
  }
  const before = evaluateRules(state, safe.ym).filter((r) => r.status === 'violated').map((r) => r.rule.id);
  const hypo = withExpense(state, { date: today, amount, categoryId: categoryId || state.categories.find((c) => c.kind === 'variable')?.id });
  const nowBroken = evaluateRules(hypo, safe.ym).filter((r) => r.status === 'violated' && !before.includes(r.rule.id));
  for (const r of nowBroken) { bump('caution'); reasons.push(`It would break your rule: ${ruleText(state, r.rule, money)}`); }
  if (safe.upcoming.length) reasons.push(`Upcoming recurring payments before payday: ${money(sum(safe.upcoming, (u) => u.amount))}.`);
  reasons.push(`${safe.days} day${safe.days === 1 ? '' : 's'} until payday.`);
  return { verdict, reasons, available: safe.available, after, safeDaily: safe.safeDaily, afterDaily, days: safe.days, savingsHit, billsHit };
}

export function whatIf(state, today, { amount, source = 'month', monthly = false, categoryId = null }) {
  const ym = monthOf(today);
  const safe = safeToSpend(state, today);
  const s = safe.summary;
  const savingsNow = totalSavings(state);
  const fromSavings = source === 'savings';
  const shortfall = Math.max(0, amount - safe.available);
  const planReduction = fromSavings ? amount : Math.min(shortfall, safe.reservedSavings);
  const goals = state.goals.map((g) => goalStatus(state, g, today)).filter((g) => !g.done);
  const goalDelays = goals.filter((g) => g.goal.monthly > 0).map((g) => ({
    goal: g.goal, days: Math.ceil(planReduction / (g.goal.monthly / 30.4375)),
  })).filter((d) => d.days > 0);
  const spendAfter = fromSavings ? s.spent : s.spent + amount;
  return {
    savingsNow, savingsAfter: fromSavings ? savingsNow - amount : savingsNow,
    spentNow: s.spent, spentAfter: spendAfter,
    remainingNow: s.remaining, remainingAfter: fromSavings ? s.remaining : s.remaining - amount,
    safeDailyNow: safe.safeDaily, safeDailyAfter: fromSavings ? safe.safeDaily : Math.floor(Math.max(0, safe.available - amount) / safe.days),
    savingsRateNow: s.savingsRate, savingsRateAfter: s.income && !fromSavings ? pct1(s.income - spendAfter, s.income) : s.savingsRate,
    planReduction, goalDelays, annual: monthly ? amount * 12 : null, monthlyImpact: monthly ? amount : fromSavings ? 0 : amount,
    nextYearTotal: monthly ? amount * 12 : amount, days: safe.days, ym,
  };
}

/* ───────────────────────── Budget editing helpers ───────────────────────── */

export function setBudget(plan, catId, mode, value) { plan.budgets[catId] = { mode, value }; }

/** Shrink budgets (variable first, then savings, then fixed) proportionally until allocated <= income. */
export function fitToIncome(state, plan) {
  const income = planIncome(plan);
  if (!income) return plan;
  const setAmount = (id, amt) => {
    const b = plan.budgets[id];
    plan.budgets[id] = b.mode === 'percent' ? { mode: 'percent', value: Math.floor((amt * 10000) / income) } : { mode: 'amount', value: amt };
  };
  for (const kind of ['variable', 'savings', 'fixed']) {
    const a = allocation(state, plan);
    const over = a.allocated - income;
    if (over <= 0) break;
    const rows = a.rows.filter((r) => r.cat.kind === kind && r.amount > 0);
    const pool = sum(rows, (r) => r.amount);
    if (!pool) continue;
    const cut = Math.min(over, pool);
    for (const r of rows) setAmount(r.cat.id, r.amount - Math.ceil((cut * r.amount) / pool));
  }
  // exact clean-up of rounding leftovers
  for (let i = 0; i < 20; i++) {
    const a = allocation(state, plan);
    const over = a.allocated - income;
    if (over <= 0) break;
    const big = [...a.rows].sort((x, y) => y.amount - x.amount)[0];
    plan.budgets[big.cat.id] = { mode: 'amount', value: Math.max(0, big.amount - over) };
  }
  return plan;
}
