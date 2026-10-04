# Tally — where did my money go?

A private, local-first salary and budget planner. Vanilla JS (ES modules), no build step, no dependencies, no server.
Your financial data stays on this device (IndexedDB) unless you choose to export it.

## Run
Modules need an HTTP server (not `file://`):

```
cd tally
npm start        # python3 -m http.server 8080  → http://localhost:8080
npm test         # node --test: calculation engine, CSV, rollover, history, goals…
```

## What it does
- **Setup wizard**: net salary, currency, payday, savings, debts, recurring bills → a suggested, fully editable budget ("Your €2,200 salary needs a job"). Skip anything optional.
- **Dashboard** answering five questions at a glance: income received, spent, where it went, what is left, and **safe to spend today** (pool ÷ days until payday).
- **Budget**: custom categories (name, icon, colour, fixed/variable/savings), amount *or* % of income with the other value calculated, drag/arrow reordering, live allocated/unallocated meter and donut, loud over-allocation warning, rules.
- **Expenses**: fast add (N key / + button), search & filters, recurring, receipt photos, edit/delete with undo.
- **Recurring**, **Goals** (required monthly saving, projected date), **Emergency fund** (months of coverage, configurable target), **Insights**, **Money leaks**, **Health score** (informational), **Alerts**, **Can I afford this?**, **What-if simulator**, **History** (month compare) and **Annual overview**.
- **Import/Export**: CSV export, bank-statement CSV import with manual column + category mapping, JSON backup/restore. No bank connection needed.
- **English and Arabic (العربية)** with full right-to-left layout. Language follows your browser by default and can be switched in the setup header or Settings. Arabic-Indic digits are accepted in inputs, and default category names follow the language.
- Dark/light/auto themes, mobile bottom nav + desktop sidebar, keyboard accessible, installable/offline (service worker).

## Design decisions
- **Money is integer cents** everywhere; percentages are basis points. Display rounding only.
- **Calendar months.** Each month stores its own snapshot of income and budgets, so changing your salary never rewrites history. Editing income offers "this month only" or "this month & future". New months roll over from the template; skipped months are filled in; recurring expenses are generated once per due date (idempotent, month-end clamping).
- **Spent vs saved.** Spending excludes savings-category transfers. *Remaining* = income − spent; *Safe to spend* = remaining − money already moved to savings − unspent fixed/savings budgets − recurring payments due before payday.
- **Demo mode** is clearly flagged and wiped completely when you set up your own profile.

## Layout
`js/calc.js` pure calculations · `js/model.js` state, setup, demo, validation · `js/csv.js` · `js/money.js`/`dates.js` · `js/store.js` persistence + mutations · `js/charts.js` SVG/HTML charts · `js/views/*` screens · `tests/` unit tests.

## Translating
UI strings are English keys passed through `t()` (`js/i18n.js`); `h()` translates text and `aria-label`/`placeholder`/`title` automatically. Add a language by adding a dictionary like `js/i18n-ar.js`. `npm test` checks that every `t('…')` key has a translation and that placeholders match.
