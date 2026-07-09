# QA notes — Agent 5 smoke pass

Date: 2026-07-08

## Automated / static verification

| # | Item | Status | Notes |
|---|------|--------|-------|
| 1 | Login / sign up / logout | **blocked (env)** | Requires live Supabase session. `.env` was empty locally; app shows Missing Config until `VITE_SUPABASE_*` are set. Code paths wired in `Login.jsx` / `App.jsx`. |
| 2 | Add subscription → Subscriptions + Expenses | **code OK** | `ExpenseModal` + `handleExpenseSave` create recurring template + expense. |
| 3 | Credit-reload badge | **code OK** | `expenseTypeLabel` / `EXPENSE_TYPES.CREDIT_RELOAD` used in table + modal. |
| 4 | One-time (Mac) badge | **code OK** | One-time type selectable; import marks Mac as one-time. |
| 5 | Edit / delete expense | **code OK** | Modal edit + delete with recurring cascade confirm. |
| 6 | Pause subscription / `applyRecurring` | **code OK** | `applyRecurring` skips `!r.active`; toggle persists via `saveOneRecurring`. |
| 7 | Settings save (projects, categories, currency, theme) | **code OK** | Bootstrap seeds defaults; handlers call supabase save helpers. |
| 8 | Import CSV → Expenses + P&L | **code OK** | Parser + ImportModal from Expenses & Settings; Append/Replace modes. Manual file import not run in this pass. |
| 9 | P&L export CSV | **code OK** | `exportPnlCsv` wide format with RM amounts. |
| 10 | Mobile sidebar | **code OK** | Menu toggle + overlay in `App.jsx`. |

## Fixes applied this pass

- Expenses footer total now converts to display currency (`convertToDisplay`) instead of summing raw amounts.
- Removed unused `src/data/recurringHelpers.js`.
- Left `store.js` localStorage helpers in place (still used as defaults / utils elsewhere; safe to leave).

## Known leftovers

- `.env` must be filled with real `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` before auth smoke tests.
- Full interactive browser smoke against Supabase was not possible without credentials.
- Vite CSS warning: `@import` for Google Fonts should precede `@tailwind` (cosmetic build warning).
