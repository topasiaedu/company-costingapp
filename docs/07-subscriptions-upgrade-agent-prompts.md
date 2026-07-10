# Subscriptions Upgrade — Agent Implementation Prompts

**Last updated:** 10 July 2026  
**Design spec:** [06-subscriptions-upgrade-plan.md](./06-subscriptions-upgrade-plan.md)  
**Run agents in order (1 → 5).** Each prompt is sized for a ~200k context model doing implementation (not just planning).

Copy everything inside a prompt block into a **new agent chat** with the repo open. Do not combine agents unless you accept merge/conflict risk.

---

## Before any agent

Shared rules for all agents:

- Read [06-subscriptions-upgrade-plan.md](./06-subscriptions-upgrade-plan.md) first.
- Read [01-project-overview.md](./01-project-overview.md) for stack and schema overview.
- **Do not** run `npm start` or `npm run build` unless you need to verify — user likely has dev server running.
- **Do not** commit, push, or merge unless the user explicitly asks.
- Match existing code style: React JSX (not TypeScript), Tailwind + CSS variables, `date-fns`, patterns in nearby files.
- Minimize scope — only change files listed in each prompt.
- When finished, append a short bullet to [04-decisions-and-accomplishments.md](./04-decisions-and-accomplishments.md) under a new section **Subscriptions upgrade (Agent N)** describing what you implemented.
- If a prior agent’s work is missing, stop and report what’s missing — do not re-implement earlier phases.

---

## Agent 1 — Billing model & expense sync

**Estimated scope:** ~3–4 files, no UI redesign yet  
**Depends on:** nothing  
**Blocks:** Agents 2–5

### Prompt

```
You are implementing Agent 1 of the Subscriptions page upgrade for the Company Costing App.

Read these docs first:
- docs/06-subscriptions-upgrade-plan.md (sections 3, 5, 6, 7 — billing model, skipped_months, helpers, files)
- docs/01-project-overview.md (schema overview)

## Goal
Fix the core billing logic so "skip this month" is separate from "pause subscription", and toggling syncs expenses correctly. Minimal UI changes in this agent — focus on data layer and App.jsx handlers.

## Current behavior (bugs to fix)
1. `handleRecurringToggle` in src/App.jsx only flips `recurring.active` — it does NOT create/delete the current month's expense.
2. `applyRecurring()` in src/App.jsx runs on load and creates expenses for all `active` items — no way to persist "skip July".
3. UI treats Off = Paused long-term, conflicting with the "flip each month" copy.

## Implement

### 1. Database / Supabase
- Add migration in supabase-migration.sql:
  `ALTER TABLE recurring ADD COLUMN IF NOT EXISTS skipped_months JSONB DEFAULT '[]'::jsonb;`
- In src/data/supabase.js, map `skipped_months` ↔ `skippedMonths` (array of "YYYY-MM" strings) on read/write, same pattern as parent_id.

### 2. store.js helpers
Add and export (see plan §6 for behavior):
- `isDueInMonth(recurringItem, yearMonth)` — monthly always due; yearly only when billingMonth matches month of yearMonth
- `getBillingStatus(recurringItem, expenses, now)` — returns { status: 'billed'|'due'|'skipped'|'not-due'|'paused', expenseId?, dueDate? }
  - paused: active === false
  - skipped: current YYYY-MM in skippedMonths
  - billed: matching expense exists (month prefix for monthly, year prefix for yearly)
  - due: active, not skipped, isDueInMonth, not billed
  - not-due: active yearly sub outside billing month
- `isDomainParent(item)` / `isDomainChild(item)` — move from RecurringManager.jsx if needed here to avoid circular imports; use existing ID prefix rules (r_domains_, r_domain_)

### 3. applyRecurring() — src/App.jsx
Update to:
- Skip items where `active === false`
- Skip items where `skippedMonths` includes current `ym`
- Keep existing yearly billing month and endDate rules
- Skip domain parent shells (amount 0 / r_domains_ parents)

### 4. New handlers in App.jsx
Replace or supplement `handleRecurringToggle`:

**handleRecurringPause(id)** — long-term pause: set active false. Do not delete historical expenses.

**handleRecurringResume(id)** — set active true; call internal logic to apply current month expense if due and not skipped.

**handleRecurringBillMonth(id, billThisMonth boolean)** —
- If billThisMonth true: remove current YYYY-MM from skippedMonths; if due and no expense, create expense (same shape as applyRecurring uses)
- If billThisMonth false: add current YYYY-MM to skippedMonths; delete current month's expense for that recurringId if exists (use deleteExpense)
- Persist via saveOneRecurring + saveExpense/deleteExpense

Pass these handlers to RecurringManager (keep old onToggle temporarily if needed for compile, but wire new handlers).

### 5. RecurringManager minimal UI tweak
- Change toggle to call onBillMonth(id, !skippedThisMonth) instead of onToggle — OR add prop alongside existing until Agent 3 redesigns.
- Update tooltip/aria to "Bill this month" / "Skip this month"
- Pass `expenses` prop from App.jsx into RecurringManager (needed for getBillingStatus)

Do NOT redesign summary cards or views in this agent.

## Files you may edit
- supabase-migration.sql
- src/data/supabase.js
- src/data/store.js
- src/App.jsx
- src/components/RecurringManager.jsx (minimal — props + toggle wiring only)

## Do NOT edit
- ProjectPnl.jsx, Dashboard.jsx, parseMastersheetCsv.js

## Acceptance criteria
- [ ] skippedMonths persists to Supabase and survives reload
- [ ] Skipping current month deletes expense and applyRecurring does NOT recreate on reload
- [ ] Billing current month creates expense when due
- [ ] active false still means long-term paused (no new expenses)
- [ ] getBillingStatus returns correct status for monthly, yearly, paused, skipped, billed cases
- [ ] Domain children still work; parent shells not double-billed

## Manual verification
Describe in your summary how you tested: skip month → reload → expense stays gone; bill month → expense appears.

Append findings to docs/04-decisions-and-accomplishments.md under "Subscriptions upgrade (Agent 1)".
```

---

## Agent 2 — Summary cards & run-rate metrics

**Estimated scope:** ~2–3 files  
**Depends on:** Agent 1 (`skippedMonths`, helpers, expenses prop)  
**Blocks:** Agents 3–5 (UI should use same metrics)

### Prompt

```
You are implementing Agent 2 of the Subscriptions page upgrade for the Company Costing App.

Read:
- docs/06-subscriptions-upgrade-plan.md (sections 4.1, 4.2, 6)
- docs/04-decisions-and-accomplishments.md (Agent 1 section — confirm skippedMonths + helpers exist)

Verify Agent 1 landed: store.js has getBillingStatus/isDueInMonth, App.jsx passes expenses to RecurringManager. If not, stop and report.

## Goal
Replace the misleading Monthly Cost / Yearly Cost / Active cards with normalized run-rate metrics and a this-month billing summary. Add month context to the page header.

## Implement

### 1. store.js — run rate helpers
Add and export:
- `monthlyEquivalent(item, currencySettings)` — converts amount to display currency; if frequency yearly, divide by 12
- `getSubscriptionRunRates(recurring, currencySettings)` —
  - Include active items only (active !== false)
  - Exclude domain parent shells (isDomainParent)
  - Include domain children, add-ons, standalone subs
  - Return { monthly: number, annual: number } in display currency (annual = monthly * 12)

- `getThisMonthStats(recurring, expenses, currencySettings, now)` —
  - Count due, billed, skipped for current month (use getBillingStatus)
  - Sum amounts due (display currency) for items with status due (not yet billed)
  - Return { dueCount, billedCount, skippedCount, dueAmount, monthLabel }

### 2. RecurringManager.jsx — header + cards
Replace the 3-card grid (lines ~518-529) with:
- **Monthly run rate** — getSubscriptionRunRates().monthly, fmtCurrency, "/mo equivalent"
- **Annual run rate** — .annual, "/yr equivalent"
- **This month** — getThisMonthStats counts + due amount

Add page subheader under "Subscriptions" title:
`{Month YYYY} · {dueCount} due · {billedCount} billed` (include skipped count if > 0)

Keep the info banner for now but shorten copy to reflect new billing model (bill this month vs paused).

Remove old monthlyTotal/yearlyTotal logic that split by frequency only.

### 3. Terminology
Rename button "Add Recurring" → "Add subscription" (modal titles can wait for Agent 3).

## Files you may edit
- src/data/store.js
- src/components/RecurringManager.jsx

## Do NOT
- Build This month / All tabs yet (Agent 3)
- Add search/filters (Agent 4)
- Change App.jsx handlers unless props are missing

## Acceptance criteria
- [ ] Monthly run rate includes yearly subs as amount/12 (converted)
- [ ] Domain children counted once; parent shells not counted
- [ ] This month card counts match getBillingStatus for a spot-check of 3 subs
- [ ] Header shows current month name

Append to docs/04-decisions-and-accomplishments.md under "Subscriptions upgrade (Agent 2)".
```

---

## Agent 3 — This month / All views & simplified rows

**Estimated scope:** ~2 files (mainly RecurringManager.jsx)  
**Depends on:** Agents 1–2  
**Blocks:** Agents 4–5

### Prompt

```
You are implementing Agent 3 of the Subscriptions page upgrade for the Company Costing App.

Read:
- docs/06-subscriptions-upgrade-plan.md (sections 4.3, 4.4, 4.6)
- docs/04-decisions-and-accomplishments.md (Agents 1–2)

Verify: getBillingStatus, getThisMonthStats, onBillMonth/onPause/onResume handlers, expenses prop. Stop if missing.

## Goal
Add two view tabs and simplify subscription rows with clear billing status. Separate long-term pause from monthly skip in the UI.

## Implement

### 1. View tabs
Below summary cards, add pill toggle:
- **This month** (default)
- **All subscriptions**

State: local useState in RecurringManager.

**This month view**
- List items where getBillingStatus is due, billed, or skipped for current month
- Include domain children individually; show Domains as collapsible group if any domain child is due/billed/skipped this month
- Sort by billing day ascending

**All subscriptions view**
- Keep active + paused sections (rename paused header to "Paused / cancelled")
- Show full catalog with existing grouping (parents, add-ons, domains group)
- Include not-due yearly subs here

### 2. Simplified RecurringRow
Reduce subtitle clutter:
- Show: `{category} · {billing date}` only by default
- Show end date ONLY if endDate is set
- Remove ∞ Infinite badge for ongoing subs
- Add status badge: Billed (green), Due (amber), Skipped (gray), Not due (muted), Paused (gray)

Billing date format: monthly → "Day 25" or "Jul 25"; yearly → "Jul 1 · yearly"

### 3. Actions per row
- **Bill this month** toggle (pill or switch) — only in This month view, or when status is due/billed/skipped. Calls onBillMonth.
- **Pause** / **Resume** — in All view context menu or secondary button for long-term active toggle (onPause/onResume). Do NOT use pause for skip-month.
- Keep Edit and Delete

For domain group parent row: no bill toggle; keep + Add domain.

### 4. Modal copy
Update RecurringModal titles:
- Add subscription / Edit subscription / Add domain (not "Recurring")

### 5. Props
Ensure RecurringManager receives from App.jsx:
- expenses, onBillMonth, onPause, onResume (or equivalent from Agent 1)

Remove dead onToggle if fully replaced.

## Files you may edit
- src/components/RecurringManager.jsx
- src/App.jsx (only if prop wiring incomplete)

## Do NOT
- Add search/filter/sort (Agent 4)
- Add QoL features (Agent 5)

## Acceptance criteria
- [ ] Default tab is This month
- [ ] Paused subs only in All view under Paused / cancelled
- [ ] Status badges accurate for monthly and yearly subs
- [ ] Skip vs pause are distinct controls
- [ ] Rows no longer show "No end date" / ∞ for normal ongoing subs

Append to docs/04-decisions-and-accomplishments.md under "Subscriptions upgrade (Agent 3)".
```

---

## Agent 4 — Search, filter, sort & domains polish

**Estimated scope:** ~1–2 files  
**Depends on:** Agent 3 (view tabs + row components)  
**Blocks:** Agent 5

### Prompt

```
You are implementing Agent 4 of the Subscriptions page upgrade for the Company Costing App.

Read:
- docs/06-subscriptions-upgrade-plan.md (sections 4.5, 4.7)
- docs/04-decisions-and-accomplishments.md (Agents 1–3)

## Goal
Add list management tools for the All subscriptions view and polish the Domains group UX.

## Implement

### 1. Filter bar (All subscriptions view)
Show filter bar when All subscriptions tab is active (also show search in This month — filters apply to visible list only).

Controls:
- **Search** input — case-insensitive name match
- **Category** select — All + categories from props
- **Project** select — All, Company-wide, each project
- **Status** select — All, Active, Paused
- **Sort** select — Name A–Z, Cost high→low, Billing day

Filtering is client-side on recurring array. Sort applies after filter. Preserve parent/child grouping: if parent matches, show children; if child matches, show parent group.

### 2. Domains group polish
For the synthetic Domains (N) group:
- Subtitle on parent: monthly equivalent (from store helper) + "· N domains · M active"
- When expanded, show compact **search domains** input filtering domain children by name or project
- Empty filter state: "No domains match"
- Ensure child rows use same status badges and bill-month toggle as Agent 3

Do not change domain ID scheme or domainParentIdForProject logic.

### 3. Empty states
- All view + filters with no results: helpful message + clear filters button
- This month with nothing due: "No subscriptions bill this month" + link hint to All view

## Files you may edit
- src/components/RecurringManager.jsx
- src/data/store.js (only if small filter/sort utilities help)

## Do NOT
- Duplicate, export, bulk skip (Agent 5)
- Change billing logic from Agent 1

## Acceptance criteria
- [ ] Search finds domain by name when group expanded
- [ ] Filters combine correctly (category + project)
- [ ] Sort by cost uses monthlyEquivalent in display currency
- [ ] Grouping intact after filter (add-ons stay under parent)

Append to docs/04-decisions-and-accomplishments.md under "Subscriptions upgrade (Agent 4)".
```

---

## Agent 5 — Quality-of-life features

**Estimated scope:** ~2–3 files  
**Depends on:** Agents 1–4  
**Blocks:** nothing

### Prompt

```
You are implementing Agent 5 (final) of the Subscriptions page upgrade for the Company Costing App.

Read:
- docs/06-subscriptions-upgrade-plan.md (section 4.8)
- docs/04-decisions-and-accomplishments.md (Agents 1–4)

## Goal
Add quality-of-life features: duplicate subscription, export CSV, upcoming renewals, bulk skip unbilled this month.

## Implement

### 1. Duplicate subscription
In All subscriptions view, add duplicate action (copy icon) on each row (not on domain group parent).
- Creates new recurring item: genId('r') or genId('r_domain_') for domains
- Copy all fields except id; name += " (copy)"; skippedMonths = []; no expenses copied
- Call onAdd with new item

### 2. Export CSV
Button in page header area: "Export CSV"
- Flat export of all recurring items (not grouped)
- Columns: name, category, project, amount, currency, frequency, billing_day, billing_month, active, notes
- Use browser download (Blob + anchor), pattern similar to ExpensesTable export if one exists
- Filename: subscriptions-YYYY-MM-DD.csv

### 3. Upcoming renewals card
Below summary cards or above list:
- Title: "Upcoming (30 days)"
- List subs where billing date (billingDay in current or next calendar month) falls within next 30 days from today
- Show name, date, amount
- Cap at 10 items; "+ N more" if needed
- Include monthly and yearly subs

### 4. Bulk skip this month
In **This month** view, when dueCount > 0:
- Button: "Skip all unbilled"
- Confirm dialog (use existing ConfirmDialog pattern from App.jsx — pass callback prop or local confirm)
- For each item with status **due**: add current YYYY-MM to skippedMonths, do NOT create expense
- Batch save — add handleRecurringBulkSkip in App.jsx if cleaner

## Files you may edit
- src/components/RecurringManager.jsx
- src/App.jsx (bulk handler)
- src/data/store.js (upcoming renewals helper optional)

## Do NOT
- Redesign cards or views from prior agents
- Change P&L or Dashboard

## Acceptance criteria
- [ ] Duplicate appears in list after save
- [ ] CSV opens in Excel/Numbers with correct columns
- [ ] Upcoming shows at least one sub billing within 30 days (test with billingDay near today)
- [ ] Bulk skip sets all due items to skipped; reload does not recreate expenses

Append to docs/04-decisions-and-accomplishments.md under "Subscriptions upgrade (Agent 5)".

When done, all items in docs/06-subscriptions-upgrade-plan.md section 8 checklist should pass — note any exceptions in the doc.
```

---

## Optional: single-agent smoke test prompt

Use after Agent 5 if you want a fresh agent to verify integration without new features:

```
Read docs/06-subscriptions-upgrade-plan.md section 8 (manual test checklist).
Run through each checkbox against the codebase and local behavior.
Fix only regressions found; do not add features.
Report pass/fail list. Update docs/04-decisions-and-accomplishments.md with test results.
Do not commit unless asked.
```

---

## Agent sizing rationale

| Agent | Why this size |
|-------|----------------|
| **1** | Schema + App.jsx billing is the riskiest logic; isolate before UI churn |
| **2** | Metrics helpers + cards — self-contained, unblocks meaningful UI |
| **3** | Largest UI piece but one file; views + rows belong together |
| **4** | Filters + domains polish — independent of QoL |
| **5** | Nice-to-haves isolated so they can be skipped if time-constrained |

If Agent 3 context gets tight, split Agent 3 into **3a (tabs + list)** and **3b (row actions + modal copy)** — only if needed.
