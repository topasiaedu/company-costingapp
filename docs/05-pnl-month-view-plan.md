# P&L Month View — Feature Plan

**Last updated:** 10 July 2026  
**Status:** Implemented (10 July 2026)  
**Depends on:** Current P&L year grid (`ProjectPnl.jsx`, `buildPnlGrid()`)

Related docs: [01-project-overview.md](./01-project-overview.md) · [04-decisions-and-accomplishments.md](./04-decisions-and-accomplishments.md)

---

## 1. Problem

The P&L Report tab today is a **year-wide mastersheet grid** (projects × Jan–Dec columns). That matches the original spreadsheet workflow for annual reporting, but it is awkward for the **monthly review workflow** documented in `04-decisions-and-accomplishments.md`:

1. Review amortized P&L for monthly burn
2. Switch to cash view for invoice timing
3. Export or screenshot for stakeholders

Questions like *"What did July cost, broken down by project and tool?"* require mentally scanning one column across a wide table. Screenshots of a single month are hard because the table is always 12+ columns wide.

The Dashboard has date-range filtering, but it uses **raw expenses only** — no virtual monthly fill, no yearly amortization, no P&L grouping. Dashboard totals will **not** match P&L numbers for the same month.

---

## 2. Goal

Add a **Month view** layout on the existing P&L Report tab — a second lens on the same data, not a new tab or a parallel reporting system.

| Lens | Purpose |
|------|---------|
| **Year grid** (default, unchanged) | Annual mastersheet; export wide CSV; compare months side-by-side |
| **Month view** (new, opt-in) | Single-month drill-down; vertical layout; better screenshots; tall CSV export |

Both layouts share:

- Amortized vs Cash toggle (same `PNL_VIEW_MODES`)
- Same `buildPnlGrid()` data pipeline (virtual fill, domain groups, yearly spread)
- Same project sections: CAE, Dr Jasmine, Jeff, Company-wide
- Export CSV + Ready to screenshot

---

## 3. Design decisions (confirmed)

These were agreed before implementation. **Do not change without discussion.**

| Decision | Choice | Notes |
|----------|--------|-------|
| Default layout on open | **Year grid** | Month view is opt-in via toggle |
| Zero rows / empty projects | **Hide when amount ≤ 0** | Filter applies per **active view mode** |
| Amortized visibility | **Virtual rows still show** | Monthly subs and yearly amortization produce non-zero amounts even without a real invoice that month |
| Cash visibility | **Only real charges** | No `_pnlVirtual` rows; domains/AS Credits appear only in payment month |
| Cross-year navigation | **Yes** | Dec 2025 ← → Jan 2026 without leaving month view |
| New tab? | **No** | Toggle on existing P&L Report tab |
| Revenue / profit | **Out of scope** | Cost tracker only; no income lines |
| Inline expense editing | **Out of scope v1** | Optional v2: link to Expenses tab filtered by month |

### Zero-row rule (important)

Hiding zeros is **not** "hide all subscriptions." It means:

```
slice.amount > 0.005  →  show row / group / section
slice.amount ≤ 0.005  →  hide
```

In **amortized** July: Zoom, domains, Automatic Sales amortized fee → **shown** (virtual fill).  
In **cash** July: only rows with actual July expenses → many subs **hidden** if no invoice.

---

## 4. UX specification

### 4.1 Control bar (extends existing view bar)

```
┌──────────────────────────────────────────────────────────────────┐
│ P&L view:  [Monthly (amortized)] [Cash (invoice date)]          │
│ Layout:    [Year grid ●] [Month view ○]                          │
│ Period:    ◀  July 2026  ▶     [Export CSV] [Ready to screenshot]│
└──────────────────────────────────────────────────────────────────┘
```

- **Year grid mode:** year picker behaves as today (`◀ 2026 ▶`).
- **Month view mode:** month+year picker (`◀ July 2026 ▶`), including cross-year (June 2026 → July 2026 → … → Dec 2026 → Jan 2027).
- Amortized/Cash pills unchanged; helper text below toggles stays.

### 4.2 Month view layout

**Summary strip** (4 cards above the table):

| Card | Calculation |
|------|-------------|
| Month total | `grid.grandTotals[monthIndex]` |
| vs last month | Current − previous month total; % change; handle Jan → use Dec prior year |
| Largest project | Project section with max `monthTotals[monthIndex]` |
| % of YTD | Month total ÷ sum(Jan…selected month) for same year |

**Main table** — vertical, one Amount column:

```
CAE                                         1,234.56
  Domains (4)                                 180.00
    caegoh.com                                 45.00
  AS Credits                                  500.00
  WABA                                         60.45

Company-wide                                2,100.00
  Zoom Business                               443.10
    ↳ Zoom Webinars (500)                     318.00
  ChatGPT Plus                                403.00

TOTAL                                       4,224.56
```

Behavior:

- Reuse project color headers and collapsible sections/groups from year grid
- **Sections expanded by default** in month view (user is drilling in)
- **Domain groups collapsed by default** (same as year grid)
- Hide rows/groups/sections where month amount is zero (per §3)
- Amount cells: numbers only, no currency prefix (match year grid)
- Footer: generated timestamp, view mode, display currency, month total

### 4.3 Year grid enhancement

Clicking a **month column header** (e.g. "Jul") switches to Month view for that year+month.

### 4.4 Export

| Layout | CSV shape |
|--------|-----------|
| Year grid | Wide format (existing `exportPnlCsv`) — 12 month columns |
| Month view | **Tall format** — one Amount column, section headers, indented children |

Example month CSV:

```csv
PROJECT COST,July 2026 (Amounts in MYR)
CAE
Domains (4),180.00
  caegoh.com,45.00
AS Credits,500.00
TOTAL,1234.56

Company-wide
Zoom Business,443.10
  Zoom Webinars (500),318.00
TOTAL,2100.00

Total Expenses,4224.56
```

### 4.5 Screenshot mode

Existing screenshot mode (`pnl-screenshot-mode`) should work in month view — hide toolbar, scroll table into frame, 30s dismiss timer. Month view should be **more screenshot-friendly** (no horizontal scroll).

---

## 5. Technical approach

### 5.1 Do not rebuild P&L logic

All month data comes from the existing grid builder:

```
expenses + recurring + currencySettings + viewMode
        ↓
   buildPnlGrid()          ← parseMastersheetCsv.js (unchanged logic)
        ↓
   slicePnlMonth(grid, monthIndex)   ← NEW thin helper
        ↓
   Month view UI / export
```

`buildPnlGrid()` already handles:

- `filterExpensesForPnlView()` — amortized vs cash
- `expandMonthlyRecurringVirtual()` — sparse monthly subs
- `expandYearlyRecurringAmortized()` — yearly spread
- `organizePnlRows()` — domain groups, Zoom add-ons

### 5.2 New helper: `slicePnlMonth(grid, monthIndex)`

Add to `src/data/parseMastersheetCsv.js` (next to `buildPnlGrid`) or `src/data/store.js`.

Returns a month-scoped structure:

```js
{
  year, monthIndex, monthLabel, viewMode,
  grandTotal,
  prevMonthTotal,      // null if Jan and no prior-year slice in same call
  prevYear, prevMonthIndex,  // for cross-year comparison
  ytdTotal,
  sections: [{
    project, monthTotal,
    groups: [{ id, name, amount, lines: [{ label, amount, isAddon }] }],
    rows: [{ name, amount }],
  }],
}
```

Filter rules when slicing:

- `line.amount > 0.005` → keep line
- `group.amount > 0.005` → keep group (sum of visible lines)
- `section.monthTotal > 0.005` → keep section

### 5.3 New constant: `PNL_LAYOUT_MODES`

Add to `src/data/store.js`:

```js
export const PNL_LAYOUT_MODES = {
  YEAR: 'year',
  MONTH: 'month',
}
```

### 5.4 Month navigation state

In `ProjectPnl.jsx`:

```js
const [layoutMode, setLayoutMode] = useState(PNL_LAYOUT_MODES.YEAR)
const [month, setMonth] = useState(new Date().getMonth()) // 0–11
```

When layout is YEAR: `year` state drives `buildPnlGrid`.  
When layout is MONTH: `year` + `month` drive grid build + slice.

**Available months:** derive from expenses dates + ensure current month is always navigable (same pattern as `availableYears`).

**Cross-year:** `changeMonth(delta)` decrements Jan → Dec of `year - 1`, increments Dec → Jan of `year + 1`.

### 5.5 Files touched (expected)

| File | Changes |
|------|---------|
| `src/data/store.js` | `PNL_LAYOUT_MODES` |
| `src/data/parseMastersheetCsv.js` | `slicePnlMonth()`, `exportPnlMonthCsv()` |
| `src/components/ProjectPnl.jsx` | Layout toggle, month picker, month table UI, summary cards |
| `src/index.css` | Optional: month-view-specific styles (minimal) |

**Do not change:** `App.jsx` tab wiring, Supabase schema, import parser, Dashboard.

### 5.6 Acceptance criteria (full feature)

1. P&L opens in **Year grid** by default; existing year view unchanged
2. **Month view** toggle shows vertical breakdown for selected month
3. Amortized vs Cash affects month totals consistently with year grid column
4. Zero rows/sections hidden; amortized virtual rows still appear
5. Cross-year month navigation works
6. Month Export CSV downloads tall-format file
7. Screenshot mode works in month view
8. Click month column header → month view
9. `npm run build` passes

---

## 6. Out of scope (v1)

- New app tab
- Revenue / profit lines
- MoM sparklines per line item
- Inline expense edit from month view
- Copy-to-clipboard TSV (optional v2)
- Dashboard changes
- Supabase schema changes

---

## 7. Testing checklist (manual)

1. Open P&L → defaults to Year grid, current year
2. Toggle Month view → shows current month vertical breakdown
3. Amortized July → Zoom, domains, Automatic Sales amortized lines visible
4. Cash July → only actual July invoices; no virtual rows
5. Navigate Dec 2025 → Jan 2026 → totals change correctly
6. Jeff hidden in cash month with no charges; visible in amortized if domain active
7. Year grid Jul column total === Month view July grand total (same view mode)
8. Export month CSV → opens in Excel/Sheets with correct sections
9. Ready to screenshot → toolbar hides in month view
10. Click "Jul" column header in year grid → switches to Month view, July selected
11. `npm run build` passes

---

*Update this doc when month view ships or decisions change.*
