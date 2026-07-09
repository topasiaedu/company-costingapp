# P&L Month View — Agent Prompts

Use this doc to hand month-view work to separate agents. Each prompt is self-contained for a **~200k context** model but scoped to **one focused deliverable** (~2–4 hours, ~3–5 files).

**Before any agent starts:** Read these docs in order:

1. `docs/01-project-overview.md` — stack, schema, architecture
2. `docs/04-decisions-and-accomplishments.md` — P&L business rules, virtual fill, projects
3. `docs/05-pnl-month-view-plan.md` — full month view spec and confirmed decisions

**Run agents in order.** Agent 2 assumes Agent 1 is merged.

---

## How to use

1. Open a new agent chat
2. Paste the **Shared context block** + the **Task prompt** for that agent
3. Point the agent at the repo root: `company-costingapp`
4. Agent should run `npm run build` before finishing
5. Agent should **not** commit unless you ask
6. Do **not** run `npm start` / `npm run dev` — user has dev server running

---

## Shared context block (paste at top of every agent chat)

```
You are working on the Company Costing App — a React + Vite SPA for tracking tech department spend by project.

Stack: React 18 (JSX), Vite 5, Tailwind + CSS variables, Supabase (auth + Postgres). No Node backend. Deployed to Vercel.

Read these docs first:
- docs/01-project-overview.md
- docs/04-decisions-and-accomplishments.md
- docs/05-pnl-month-view-plan.md

Key paths for this feature:
- src/components/ProjectPnl.jsx — P&L Report UI (primary file)
- src/data/parseMastersheetCsv.js — buildPnlGrid(), virtual fill, grouping
- src/data/store.js — PNL_VIEW_MODES, fmtAmount, getProjectColor, currency utils

Existing P&L behavior (do not break):
- Year grid: projects × Jan–Dec columns, collapsible sections/groups
- View modes: PNL_VIEW_MODES.AMORTIZED (spread yearly, virtual monthly fill) vs CASH (invoice date only)
- buildPnlGrid(expenses, projects, year, currencySettings, { viewMode, recurring }) returns { year, months, sections, grandTotals, grandYearTotal, viewMode }
- exportPnlCsv(grid, display) — wide-format year CSV (keep as-is)

Confirmed product decisions:
- Default layout: YEAR grid (month view is opt-in toggle)
- Hide rows/groups/sections where month amount ≤ 0.005 — per active view mode (amortized still shows virtual rows)
- Cross-year month nav: Dec → Jan across year boundary
- No new tab; toggle on existing P&L Report tab
- No schema changes, no Dashboard changes, no import parser changes

Rules:
- Minimize scope; match existing JSX/style conventions (double quotes in new strings if file uses them)
- No TypeScript migration
- No new backend server
- Reuse buildPnlGrid() — slice month data from grid, do not duplicate virtual-fill logic
- Run npm run build and fix errors before done
- Do not commit unless asked
```

---

## Agent 1 — Month view core (data + UI)

**Depends on:** Nothing (baseline commit with year-grid P&L already merged)  
**Estimated scope:** 3–4 files, ~2–4 hours  
**Run first**

### Task prompt

```
Task: Implement P&L Month view — data layer, layout toggle, month navigation, vertical breakdown table, and summary cards.

Read docs/05-pnl-month-view-plan.md sections 3–5 before coding.

Files to touch:
- src/data/store.js
- src/data/parseMastersheetCsv.js
- src/components/ProjectPnl.jsx
- src/index.css (only if needed for month layout)

Requirements:

1) store.js — add layout constant:
   export const PNL_LAYOUT_MODES = { YEAR: 'year', MONTH: 'month' }

2) parseMastersheetCsv.js — add slicePnlMonth(grid, monthIndex):
   - Input: full return value of buildPnlGrid() + monthIndex (0–11)
   - Output structure per docs/05-pnl-month-view-plan.md §5.2
   - For each section/group/line: pick months[monthIndex] as amount
   - Filter: keep only items where amount > 0.005 (hide zero rows/groups/sections)
   - Compute: grandTotal, ytdTotal (sum Jan..monthIndex of grandTotals), prevMonthTotal
   - Cross-year prev month: if monthIndex === 0, prevMonthTotal comes from slicing same grid builder is NOT enough — build grid for year-1 OR pass prior year grid. Simplest approach: in ProjectPnl, when monthIndex===0, also call buildPnlGrid for year-1 and slice month 11 for prevMonthTotal. Agent 1 can implement prev-month helper in ProjectPnl useMemo.
   - Export slicePnlMonth from this file

3) ProjectPnl.jsx — layout toggle:
   - State: layoutMode (default PNL_LAYOUT_MODES.YEAR), month (default current month 0–11)
   - Control bar: add "Layout: [Year grid] [Month view]" pill group next to existing amortized/cash toggle
   - When YEAR: keep existing year picker and year table unchanged
   - When MONTH: show month+year picker with ◀ ▶ buttons; support cross-year (Jan prev → Dec year-1, Dec next → Jan year+1)
   - availableMonths: months that have any expense data in that year, plus always include current calendar month

4) ProjectPnl.jsx — month view UI (when layoutMode === MONTH):
   - Summary cards row (4 cards): Month total, vs last month (%), Largest project name+amount, % of YTD
   - Vertical table: same section/group/line hierarchy as year grid but ONE amount column
   - Reuse: getProjectColor, fmtAmount, collapsible section/group toggles (reuse collapsedGroups/collapsedSections state)
   - Sections expanded by default in month view (reset or use separate default — plan says expanded)
   - Domain groups collapsed by default (same as year grid)
   - Grand TOTAL row at bottom
   - Empty state when slice has no sections: "No expenses for {Month} {year}"

5) Keep year grid 100% working — no regressions to exportPnlCsv, screenshot mode, or year navigation

6) Do NOT implement in this task:
   - Month CSV export (Agent 2)
   - Click column header drill-down (Agent 2)
   - App.jsx changes
   - Dashboard changes

Acceptance criteria:
- P&L opens in Year grid by default; year view identical to before
- Month view toggle shows vertical breakdown for selected month
- Amortized vs Cash toggle affects month totals (same as year column for that month)
- Zero rows hidden; amortized virtual subs still visible in amortized mode
- Cross-year month navigation works
- Summary cards show correct totals and vs-last-month (including Jan → Dec prior year)
- npm run build passes

Reference — existing grid builder signature (read file, do not rewrite):
  buildPnlGrid(expenses, projects, year, currencySettings, { viewMode, recurring })

Reference — month index from date: parseInt(e.date.slice(5,7), 10) - 1
```

---

## Agent 2 — Export, drill-down & polish

**Depends on:** Agent 1 merged (slicePnlMonth + month view UI exist)  
**Estimated scope:** 2–3 files, ~1–3 hours  
**Run second**

### Task prompt

```
Task: Polish P&L Month view — tall CSV export, year-column drill-down, screenshot mode, and footer polish.

Read docs/05-pnl-month-view-plan.md sections 4.3–4.5 and 8 before coding.

Files to touch:
- src/data/parseMastersheetCsv.js (or keep export next to exportPnlCsv in ProjectPnl.jsx if that is where year export lives)
- src/components/ProjectPnl.jsx
- src/index.css (screenshot/print tweaks if needed)

Requirements:

1) exportPnlMonthCsv(slice, display) — tall-format CSV export:
   - Header: PROJECT COST,{Month} {year} (Amounts in {display})
   - For each section: project name as header row, then groups (indented name or prefix "  "), then ungrouped rows, then TOTAL,{amount}
   - Blank line between sections
   - Final row: Total Expenses,{grandTotal}
   - Comma-safe names (quote if contains comma)
   - Filename: tech-pnl-{year}-{monthShort}-{display}.csv (e.g. tech-pnl-2026-jul-MYR.csv)
   - Wire to Export CSV button when layoutMode === MONTH (year grid keeps exportPnlCsv)

2) Year column drill-down:
   - In year grid thead, make month column headers clickable (button or clickable th)
   - onClick: setLayoutMode(MONTH), setMonth(m.index), setYear(grid.year)
   - Subtle hover style; aria-label "View {month} in month view"

3) Screenshot mode:
   - Ensure pnl-screenshot-mode works in month view (toolbar hidden, table in frame)
   - Month view should not require horizontal scroll at typical desktop widths
   - Footer line in month view: "Generated {date} · {view mode} · {Month} {year} · Amounts in {display} · Total: {amount}"

4) View mode hint (month view only, small text under toggle):
   - Amortized: "Yearly costs spread evenly; inactive months filled for active subscriptions"
   - Cash: "Only charges with invoice/payment date in this month"

5) Optional small polish (if quick):
   - When switching layout YEAR → MONTH, preserve year; MONTH → YEAR, preserve year
   - Disable Export when empty state (no sections)

Do NOT:
- Rewrite buildPnlGrid or slicePnlMonth logic unless fixing a bug found during polish
- Add new tabs, schema changes, or Dashboard work
- Implement copy-to-clipboard TSV (out of scope)

Acceptance criteria:
- Month view Export CSV downloads tall-format file; opens correctly in Excel/Sheets
- Year grid Export CSV still works unchanged
- Clicking "Jul" (or any month) column header switches to month view for that month
- Screenshot mode works in both layouts
- npm run build passes

Manual verify against docs/05-pnl-month-view-plan.md §8 testing checklist items 8–10.
```

---

## Agent dependency diagram

```
Agent 1 — Month view core (slicePnlMonth + UI + summary cards)
    │
    ▼
Agent 2 — Export + drill-down + screenshot polish
```

---

## If something goes wrong

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| Month total ≠ year grid column | slicePnlMonth filtering or wrong monthIndex | Compare raw grid.grandTotals[i] vs slice.grandTotal |
| Amortized month shows empty | viewMode not passed to buildPnlGrid | Check useMemo deps |
| Cash month shows virtual rows | slice including _pnlVirtual | Cash filter happens in buildPnlGrid; don't re-add virtual rows in slice |
| prev month wrong in January | Cross-year not handled | buildPnlGrid(year-1) and slice month 11 |
| Year grid regressed | Agent 1 changed shared render path | Keep year/month as separate render branches |

---

## After both agents

Update `docs/05-pnl-month-view-plan.md` status to **Implemented** and add a note to `docs/04-decisions-and-accomplishments.md` §1 under P&L Report.

Optional follow-up (separate session, not in these prompts):

- Copy-to-clipboard TSV for Google Sheets
- "View in Expenses" deep-link with month filter
- MoM comparison bar chart per project in month view
