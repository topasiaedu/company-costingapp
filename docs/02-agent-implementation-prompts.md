# Agent Implementation Prompts

Use this doc to hand work to separate agents. Each prompt is self-contained for a **~200k context** model but scoped to **one focused deliverable** (roughly 2–5 hours, ~3–8 files touched).

**Before any agent starts:** Read `docs/01-project-overview.md` for full context.

**Run agents in order** where noted. Later agents assume earlier work is merged.

---

## How to use

1. Open a new agent chat
2. Paste the **Context block** (shared, once per session) + the **Task prompt**
3. Point the agent at the repo root: `company-costingapp`
4. Agent should run `npm run build` before finishing
5. Agent should **not** commit unless you ask

---

## Shared context block (paste at top of every agent chat)

```
You are working on the Company Costing App — a React + Vite SPA for tracking tech department spend by project.

Stack: React 18 (JSX), Vite 5, Tailwind, Supabase (auth + Postgres). No Node backend. Deployed to Vercel.

Read docs/01-project-overview.md first.

Key paths:
- src/App.jsx — root state, tabs, CRUD
- src/data/supabase.js — all DB operations
- src/data/store.js — utils, defaults, currency
- src/data/parseMastersheetCsv.js — CSV import parser
- supabase-setup.sql — DB schema (already applied)

Env: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY (in .env, not committed)

Rules:
- Minimize scope; match existing JSX/style conventions
- No TypeScript migration
- No new backend server
- Do not commit secrets or service_role keys
- Run npm run build and fix errors before done
```

---

## Agent 1 — Production security & Vercel deploy

**Depends on:** Nothing  
**Estimated scope:** 3–5 files  
**Run first**

### Task prompt

```
Task: Production security cleanup + Vercel deployment config.

1. Remove hardcoded Supabase URL and anon key fallbacks from src/data/supabase.js.
   - Require import.meta.env.VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
   - Throw a clear console error or show a user-friendly "missing config" screen if unset

2. Add .env.example with:
   VITE_SUPABASE_URL=
   VITE_SUPABASE_ANON_KEY=

3. Ensure .env is in .gitignore (add if missing)

4. Scrub or redact service_role key from setup-supabase.js — file should only print SQL instructions, not contain live secrets

5. Add vercel.json for SPA routing (all paths → index.html) if not present

6. Add a short README.md with:
   - What the app does (one paragraph)
   - Local dev: npm install, npm run dev
   - Env vars required
   - Vercel deploy steps (build: npm run build, output: dist)

Acceptance criteria:
- npm run build succeeds with .env present
- No Supabase keys hardcoded in src/
- README + .env.example exist
- vercel.json handles client-side routing

Do NOT: add Render config, migrate to TypeScript, or change business logic.
```

---

## Agent 2 — First-run bootstrap & Supabase integration verify

**Depends on:** Agent 1 (env handling)  
**Estimated scope:** 4–6 files

### Task prompt

```
Task: First-login bootstrap and verify Supabase CRUD works end-to-end.

When a user logs in and tables are empty, seed sensible defaults:
- Projects: CAE, Dr Jasmine (from DEFAULT_PROJECTS in store.js)
- Categories: DEFAULT_CATEGORIES
- Currency: MYR display + DEFAULT_CURRENCY_SETTINGS rates
- Settings: DEFAULT_SETTINGS

Implementation guidance:
- In App.jsx loadAll effect (after Promise.all loads), detect empty projects/categories/settings/currency
- Save defaults via existing saveProjects, saveCategories, saveSettings, saveCurrencySettings
- Only seed once per user (don't overwrite existing data)

Also verify/fix:
- loadProjects handles missing `projects` table gracefully (log error, don't crash)
- currency_settings load maps DB shape { display_currency, rates } → app { display, rates }
- settings load works when no row exists (PGRST116)

Add a minimal dev-only comment in App.jsx or supabase.js listing tables the app expects.

Acceptance criteria:
- Fresh user: sign up → sees default projects CAE + Dr Jasmine in Settings
- Display currency defaults to MYR
- Add one expense → saves and reloads correctly
- npm run build passes

Files likely touched: App.jsx, supabase.js, possibly Settings.jsx

Do NOT: implement CSV import changes or P&L changes in this task.
```

---

## Agent 3 — CSV import pipeline (mastersheet bootstrap)

**Depends on:** Agent 2 (defaults exist)  
**Estimated scope:** 3–5 files

### Task prompt

```
Task: Harden the mastersheet CSV import for the real P&L format.

Reference format (wide CSV):
- Row 1: PROJECT COST, 2026
- Row 2: , January, February, ... December
- Sections: CAE, Dr Jasmine (project headers), SOFTWARE COST (company-wide)
- Amounts: RM24.42, "RM1,220.00", etc.
- Skip: TOTAL, Total Registers, Cost %, Tech Cost per lead, etc.

Business rules (must match):
- project: CAE / Dr Jasmine from section headers; SOFTWARE COST rows → project null (company-wide)
- AS Credits, Automatic Sales → expense_type credit-reload (variable monthly amounts)
- Stable same-amount every month → recurring subscription
- Mac → one-time (even if empty amounts in CSV)
- Multi-line cells (Zoom with bullet items) → split into separate line items e.g. "Zoom - 500 Participants meeting Monthly"
- Import dates: last day of each month for historical data
- Year from header row

Files:
- src/data/parseMastersheetCsv.js (parser)
- src/components/ImportModal.jsx (preview UX)

Improvements to make:
1. Test parser logic against the patterns above; fix edge cases
2. In ImportModal preview: allow user to edit monthly amounts for rows that need manual split (e.g. Zoom add-ons with warning)
3. Show clear summary: X expenses, Y recurring, Z credit reloads, by project
4. Handle import errors with user-visible messages (RLS failure, missing columns)

Acceptance criteria:
- ImportModal opens from Expenses and Settings
- Parser produces correct project assignment for CAE vs Dr Jasmine vs company-wide
- AS Credits rows are credit-reload, not recurring
- Append and Replace modes work (Replace clears user expenses + recurring first)
- npm run build passes

Do NOT: change P&L export layout or Vercel config in this task.
```

---

## Agent 4 — P&L Report & reporting UX

**Depends on:** Agent 3 (data can be imported)  
**Estimated scope:** 2–4 files

### Task prompt

```
Task: Polish the P&L Report tab so it replaces the spreadsheet for stakeholder reporting.

File: src/components/ProjectPnl.jsx (primary), possibly store.js for export helpers

Requirements:
1. Grid layout: project sections → expense rows → monthly columns (Jan–Dec) → row totals → section TOTAL → grand Total Expenses
2. Year selector works across all years that have expense data
3. Amounts respect currency_settings (convert to display currency, default MYR)
4. "Export CSV" produces a wide-format file similar to the original mastersheet:
   - PROJECT COST,{year}
   - Month headers
   - Project section headers
   - Expense rows with RM-prefixed amounts
   - TOTAL rows per section
5. "Ready to screenshot" — ensure table is readable: sticky first column, clear section headers, print-friendly contrast in light mode
6. Empty state when no data for selected year

Also add to Dashboard.jsx (small addition):
- "Spend by Project" bars should include Company-wide and all projects with data

Acceptance criteria:
- P&L Report shows CAE, Dr Jasmine, Company-wide sections when data exists
- Export CSV opens correctly in Excel/Sheets
- Grand total matches sum of expenses for that year (in display currency)
- npm run build passes

Do NOT: rewrite import parser or auth in this task.
```

---

## Agent 5 — QA pass, bug fixes & UX polish

**Depends on:** Agents 1–4 merged  
**Estimated scope:** Cross-cutting, targeted fixes only

### Task prompt

```
Task: End-to-end QA pass and targeted bug fixes. Do not refactor broadly.

Smoke test checklist (fix anything broken):
1. Login / sign up / logout
2. Add expense: subscription with recurring toggle → appears in Subscriptions + Expenses
3. Add credit-reload expense (AS Credits) → shows "Credit reload" badge, not recurring
4. Add one-time expense (Mac) → one-off badge
5. Edit/delete expense
6. Recurring: pause subscription → no new auto-generated expense next month logic (applyRecurring in App.jsx)
7. Settings: save projects, categories, currency, theme
8. Import CSV → data appears in Expenses and P&L Report
9. P&L export CSV
10. Mobile sidebar navigation works

Known issues to check/fix:
- ExpensesTable footer total may sum raw amounts ignoring currency conversion — fix to use display currency
- src/data/recurringHelpers.js may be dead code — remove if unused
- store.js still has localStorage functions from old version — leave utils, remove only if clearly unused and safe
- ExpenseModal: project + expense type fields work on create and edit
- handleExpenseSave in App.jsx syncs project to recurring template when editing subscription

Acceptance criteria:
- All 10 smoke items pass manually (document any blocked item in a QA.md note in docs/)
- npm run build passes
- No new features — fixes and polish only

Do NOT: add new tabs, change schema, or scope creep.
```

---

## Optional Agent 6 — Post-launch enhancements

**Only after Agents 1–5 are done and app is live on Vercel.**

### Task prompt

```
Task: Optional enhancements (pick only what fits in one session):

A) Import preview: inline grid to edit per-month amounts before import
B) P&L Report: copy-to-clipboard as TSV for pasting into Google Sheets
C) Dashboard: month-over-month comparison per project (not just overall)
D) ExpenseModal: duplicate subscription as template for new line item
E) Default billing day for new subscriptions = last day of month (match import convention)

Choose at most 2 items. Implement cleanly. npm run build must pass.

Do NOT: add credit wallet balance tracking or multi-user roles.
```

---

## Agent order summary

| Order | Agent | Focus |
|-------|--------|--------|
| 1 | Security + Vercel | Env, README, deploy config |
| 2 | First-run bootstrap | Defaults, Supabase verify |
| 3 | CSV import | Parser + ImportModal |
| 4 | P&L Report | Reporting + export |
| 5 | QA pass | Bug fixes, smoke test |
| 6 | Optional | Nice-to-haves |

Agents **1–4 can be parallelized** only if different branches; **5 must run last**. Agent **6 is optional**.

---

## What to give each agent

| Item | Include? |
|------|----------|
| This repo cloned locally | ✅ |
| `.env` with valid Supabase keys | ✅ (Agent 2+ need it to test) |
| `docs/01-project-overview.md` | ✅ |
| Mastersheet CSV sample | ✅ for Agent 3 (path on your machine) |
| Vercel account access | ✅ for Agent 1 only if deploying |

---

## Success definition (whole project)

The project is **done** when:

1. App runs on Vercel with env vars configured
2. You can sign up, see default projects (CAE, Dr Jasmine)
3. Import your mastersheet CSV successfully
4. P&L Report matches expected totals and can be exported/screenshotted
5. Ongoing spend is entered in the app, not the spreadsheet
