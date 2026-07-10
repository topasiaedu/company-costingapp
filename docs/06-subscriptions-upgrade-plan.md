# Subscriptions Page Upgrade — Feature Plan

**Last updated:** 10 July 2026  
**Status:** Planned — not yet implemented  
**Primary file today:** `src/components/RecurringManager.jsx`  
**Related logic:** `src/App.jsx` (`applyRecurring`, toggle handlers), `src/data/store.js`, `src/data/supabase.js`

Related docs: [01-project-overview.md](./01-project-overview.md) · [04-decisions-and-accomplishments.md](./04-decisions-and-accomplishments.md) · [07-subscriptions-upgrade-agent-prompts.md](./07-subscriptions-upgrade-agent-prompts.md)

---

## 1. Problem

The **Subscriptions** tab (`RecurringManager.jsx`) is the catalog of recurring charge templates. Active templates auto-generate expenses via `applyRecurring()` in `App.jsx` when the app loads.

Today the page is hard to use because:

| Issue | What happens today |
|-------|-------------------|
| **On/Off means two things** | UI copy says “flip each month,” but Off moves the row to **Paused** and sets `active: false` on the template — it reads as permanent, not “skip July.” |
| **Toggle does not sync expenses** | `handleRecurringToggle` only flips `active` in Supabase. It does **not** create or delete the current month’s expense. Auto-generation only runs on load via `applyRecurring()`. |
| **Summary cards are misleading** | “Monthly Cost” sums only monthly-frequency subs; “Yearly Cost” sums yearly subs in yearly amounts. Mixed currencies are converted for totals, but there is no single **monthly run rate** or **annual run rate**. |
| **Domains are a special case** | Synthetic `Domains (N)` group, hidden parent IDs (`r_domains_*`, `r_domain_*`), separate “Add domain” flow, no toggle on the group row — breaks the pattern learned from other rows. |
| **Rows are metadata-heavy** | Every row shows category, billing day, end date, notes, ∞ badge, add-on badge — but not **whether this month’s charge exists** or **when it bills next**. |
| **No list tools** | ~26+ subscriptions with no search, filter, or sort. |
| **Terminology mismatch** | Nav says “Subscriptions”; button says “Add Recurring”; code uses `recurring`. |

---

## 2. Goal

Make the Subscriptions page answer three questions quickly:

1. **How much do we spend?** — One normalized monthly/annual run rate in the user’s display currency.
2. **What bills this month?** — Clear per-subscription status: due, billed, skipped, not due (yearly).
3. **How do I manage the catalog?** — Search, filter, edit, add domains and add-ons without special-case confusion.

Improvements are **UI + client logic only** unless noted. Supabase schema gets one small additive column (see §5).

---

## 3. Design decisions (confirmed for implementation)

These were agreed during brainstorming. **Do not change without discussion.**

| Decision | Choice | Notes |
|----------|--------|-------|
| Billing vs subscription state | **Separate concepts** | Template `active` = long-term enrolled vs paused/cancelled. Per-month “bill or skip” is tracked separately (see §5). |
| Skip-this-month UX | **“Bill this month” toggle** | Not the same as pausing the subscription. Label clearly; do not use “On/Off” alone. |
| Toggle side effect | **Must sync expenses** | Turning off for current month removes/skips the expense; turning on creates it (if due). Must survive app reload (`applyRecurring` must respect skips). |
| Paused section | **Long-term only** | Rows with `active: false` — cancelled or intentionally paused subscriptions. Not “skipped July.” |
| Summary primary metric | **Monthly run rate** | All active subs normalized to monthly equivalent in display currency. Secondary: annual run rate (= monthly × 12). |
| Yearly subs in “this month” | **Only in billing month** | Same rule as `applyRecurring`: yearly items appear in “Due this month” only when `billingMonth === current month`. |
| Domains | **Keep grouped, improve UX** | Still one collapsible `Domains (N)` group; add search-within, clearer totals, consistent child rows. No separate nav tab. |
| View modes | **Two tabs on same page** | **This month** (default) and **All subscriptions** (catalog). Same data, different lens. |
| DB migration | **Add `skipped_months`** | JSON array of `YYYY-MM` strings on `recurring`. No breaking changes to existing rows. |
| P&L / Dashboard | **Out of scope** | Do not change P&L virtual fill or Dashboard charts in this upgrade. Subscriptions page only (+ shared helpers in `store.js`). |
| Price history / alerts | **Phase 2 QoL** | Duplicate, export CSV, upcoming renewals — see Agent 5 in prompts doc. |

---

## 4. UX specification

### 4.1 Page header

```
Subscriptions                                    [+ Add subscription]
July 2026 · 8 due this month · 5 already billed
```

- Show current calendar month/year.
- Counts derived from billing rules + expense linkage (not raw `active` count alone).

### 4.2 Summary cards (replace current 3 cards)

| Card | Content |
|------|---------|
| **Monthly run rate** | Sum of active subs → monthly equivalent, display currency. Subtext: `/mo equivalent` |
| **Annual run rate** | Monthly run rate × 12. Subtext: `/yr equivalent` |
| **This month** | `N due · M billed · K skipped` with total due amount in display currency |

Optional compact row below cards: category chips with monthly equivalent (top 3 categories).

Remove the old split “Monthly Cost” / “Yearly Cost” cards that only sum by frequency.

### 4.3 View tabs

```
[ This month ● ]  [ All subscriptions ]
```

**This month (default)**

- Lists subscriptions that are **due in the current month** (monthly always; yearly only in billing month).
- Also show active monthly/yearly subs already billed or explicitly skipped this month (so nothing “disappears”).
- Each row shows:
  - Name, amount (native currency + frequency)
  - Billing date (e.g. “Jul 25” or “Jul 1 · yearly”)
  - **Status badge:** `Billed` · `Due` · `Skipped` · `Not due` (yearly, wrong month — only in All view or greyed subsection)
  - **Bill this month** toggle (only when due or skipped/billed this month)
- Do **not** show ∞ Infinite / “No end date” unless end date is set (then show “Ends YYYY-MM-DD”).

**All subscriptions**

- Full catalog: active groups, paused section (unchanged concept, clearer label: **Paused / cancelled**).
- Same row actions: edit, delete, long-term pause/resume.
- Search + filters visible in this view (and optionally in This month too).

### 4.4 “Bill this month” toggle behavior

| User action | Template | Expense | `skipped_months` |
|-------------|----------|---------|------------------|
| Skip this month (was billing) | `active` stays `true` | Delete expense for current `YYYY-MM` if exists | Append current `YYYY-MM` |
| Bill this month (was skipped) | `active` stays `true` | Create expense if due and missing | Remove current `YYYY-MM` |
| Pause subscription (long-term) | `active` → `false` | Do not auto-delete history; stop future auto-gen | Unchanged |
| Resume subscription | `active` → `true` | Run same logic as `applyRecurring` for current month if not skipped | Unchanged |

**`applyRecurring()` update:** Before creating an expense for `ym`, skip if `skipped_months` includes `ym`.

### 4.5 Domains group

Keep synthetic parent row `Domains (N)`:

- Show aggregated yearly total (display currency) and monthly equivalent subtext.
- Expand/collapse children sorted by project then name.
- **Search within domains** when expanded (filter children client-side).
- Group row: no “Bill this month” (children toggle individually).
- Keep **+ Add domain** on group row.
- Child rows: same status + toggle pattern as other subs.

Domain IDs and `parent_id` wiring stay as today (`r_domain_*`, `domainParentIdForProject`, etc.).

### 4.6 Add / Edit modal

- Rename copy: **Add subscription** / **Edit subscription** / **Add domain** (keep domain preset).
- Primary button on page: **+ Add subscription** (not “Add Recurring”).
- Keep existing fields; optional improvement: collapse “Duration” and “Part of” under **Advanced** — only if Agent 3 has time within scope.

### 4.7 Search, filter, sort (All subscriptions view)

| Control | Behavior |
|---------|----------|
| Search | Case-insensitive match on `name` |
| Category | Dropdown, includes “All” |
| Project | Dropdown: Company-wide + projects |
| Status | Active / Paused |
| Sort | Name A–Z, Cost high–low, Billing day |

Filters are client-side on the `recurring` array already loaded in `App.jsx`.

### 4.8 Quality-of-life (Phase 2 — Agent 5)

| Feature | Behavior |
|---------|----------|
| Duplicate | Copy template with new `genId('r')`, name suffix “ (copy)”, no expenses copied |
| Export CSV | Download all subscriptions (flat list) with columns: name, category, project, amount, currency, frequency, billing day/month, active, notes |
| Upcoming renewals | Card or section: items billing in next 30 days (by billing day in current/next month) |
| Bulk skip month | Button: “Skip all unbilled due this month” with confirm dialog — adds `YYYY-MM` to `skipped_months` for all eligible |

---

## 5. Data model change

### 5.1 New column: `skipped_months`

Add to `recurring` table (via `supabase-migration.sql` pattern):

```sql
ALTER TABLE recurring ADD COLUMN IF NOT EXISTS skipped_months JSONB DEFAULT '[]'::jsonb;
```

App shape (camelCase in JS):

```js
skippedMonths: string[]  // e.g. ["2026-07", "2026-08"]
```

Wire in `src/data/supabase.js` map functions (`parent_id` pattern).

Existing rows: default `[]`. No backfill required.

### 5.2 No change to `expenses` schema

Monthly skip is inferred from `skipped_months` + absence of expense. Billed = expense exists for `recurring_id` + current month (or current year for yearly).

---

## 6. New shared helpers (`store.js`)

Implement (names can vary; behavior must match):

| Helper | Purpose |
|--------|---------|
| `monthlyEquivalent(amount, frequency, currency, currencySettings)` | Monthly amount in display currency |
| `getSubscriptionRunRates(recurring, currencySettings)` | `{ monthly, annual }` for active subs (exclude domain parent shells, include domain children) |
| `getBillingStatus(recurringItem, expenses, now)` | `{ status: 'billed'|'due'|'skipped'|'not-due'|'paused', expenseId?, dueDate? }` |
| `isDueInMonth(recurringItem, yearMonth)` | Monthly always true; yearly when `billingMonth` matches |
| `listDueThisMonth(recurring, expenses, now)` | Items for “This month” tab |

Use existing `convertToDisplay`, `groupRecurringItems`, domain helpers from `RecurringManager.jsx` — **move** domain detection helpers to `store.js` if Agents need them from both files (avoid duplication).

---

## 7. Files likely touched

| File | Changes |
|------|---------|
| `src/components/RecurringManager.jsx` | Main UI rewrite (views, cards, rows, filters) |
| `src/App.jsx` | `applyRecurring`, `handleRecurringToggle`, new handler for bill/skip month, pass `expenses` into RecurringManager |
| `src/data/store.js` | Run-rate and billing-status helpers |
| `src/data/supabase.js` | `skipped_months` ↔ `skippedMonths` mapping |
| `supabase-migration.sql` | New column |
| `docs/04-decisions-and-accomplishments.md` | Agent should append summary when done (each agent) |

**Do not modify:** `ProjectPnl.jsx`, `parseMastersheetCsv.js`, `Dashboard.jsx` (unless a helper import is required).

---

## 8. Manual test checklist

Use local dev (`npm run dev`). Do not commit unless asked.

### Billing model

- [ ] Active monthly sub shows **Due** in This month before load generates expense; after app reload, **Billed** if expense created.
- [ ] Toggle **Skip this month** → expense removed, status **Skipped**, reload does not recreate expense.
- [ ] Toggle **Bill this month** after skip → expense recreated.
- [ ] Yearly sub only appears in This month during its `billingMonth`.
- [ ] Paused sub (`active: false`) does not appear in This month; appears under Paused / cancelled in All view.
- [ ] Paused sub does not auto-generate on reload.

### Summary cards

- [ ] Monthly run rate includes monthly + yearly subs (yearly ÷ 12) in display currency.
- [ ] USD subs converted correctly per Settings exchange rates.
- [ ] Domain children included; synthetic domain parent shells excluded from double-count.

### Views & filters

- [ ] This month / All subscriptions tabs switch without losing state.
- [ ] Search filters by name in All view.
- [ ] Category and project filters work together.
- [ ] Domains group expand, search-within, add domain still works.

### QoL (after Agent 5)

- [ ] Duplicate creates new template without expenses.
- [ ] Export CSV downloads reasonable file.
- [ ] Upcoming renewals shows items in next 30 days.

---

## 9. Implementation phases

Work is split across **5 agent tasks** in [07-subscriptions-upgrade-agent-prompts.md](./07-subscriptions-upgrade-agent-prompts.md).

| Phase | Agent | Focus |
|-------|-------|-------|
| 1 | Agent 1 | Schema + billing logic + expense sync |
| 2 | Agent 2 | Summary cards + month header + run-rate helpers |
| 3 | Agent 3 | This month / All views + simplified rows |
| 4 | Agent 4 | Search, filter, sort + domains UX polish |
| 5 | Agent 5 | QoL: duplicate, export, renewals, bulk skip |

**Run agents in order.** Each agent depends on the previous unless noted.

---

## 10. Success criteria

The upgrade is done when:

1. A user can see **one monthly run rate number** they trust.
2. **This month** view shows what will hit expenses / P&L for the current month.
3. Skipping a month does not require “pausing” the subscription and survives reload.
4. Domains remain manageable at 10+ items with search.
5. Terminology consistently says **subscription** in the UI.
