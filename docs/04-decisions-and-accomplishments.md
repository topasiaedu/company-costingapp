# Decisions & Accomplishments — Source of Truth

**Last updated:** 10 July 2026  
**Supabase project:** `brmhzbjhpfqmmhatffmi`  
**Purpose:** Record what was built, what was decided, and how data should be interpreted. Use this doc when onboarding, auditing P&L, or continuing development.

Related docs: [01-project-overview.md](./01-project-overview.md) · [03-supabase-mcp.md](./03-supabase-mcp.md) · [05-pnl-month-view-plan.md](./05-pnl-month-view-plan.md)

---

## 1. What we accomplished

### Platform & tooling

- **Supabase MCP** configured (`.cursor/mcp.json`) for direct DB queries and migrations from Cursor.
- **Mastersheet CSV imported** into live Supabase (historical MYR rows + subscription templates).
- **Live subscriptions** inserted for company-wide tools (Cursor, Zoom, Supabase, Vercel, ChatGPT Plus, DigitalOcean, Automatic Sales, etc.).
- **FX rate corrected** to USD → MYR **4.03** (was incorrectly 0.22 in places; Vercel and other USD subs were showing wrong MYR amounts).

### P&L Report (`ProjectPnl.jsx`)

- **Dual view modes:** Monthly (amortized) vs Cash (invoice date) — toggle always visible above the table.
- **Amounts without repeated currency prefix** — cells show numbers only (e.g. `443.10`); footer states `Amounts in MYR`.
- **Collapsible project sections** — CAE, Dr Jasmine, Jeff, Company-wide headers collapse/expand; totals stay visible in header when collapsed.
- **Collapsible subscription groups** — Domains, Automatic Sales, Zoom Business, etc. show as parent rows with child lines.
- **Virtual monthly fill** — sparse monthly subs (e.g. Vercel, WABA) and yearly subs (domains, Automatic Sales) generate correct P&L rows without duplicate DB entries.
- **Yearly domain handling** — amortized view spreads $12/domain from renewal month; cash view shows full annual charge on billing date only (no double-count).

### Subscriptions (`RecurringManager.jsx`)

- **Unified Domains section** — all domains in one collapsible group (not four per-project parent rows).
- **Collapsed total fix** — Domains header sums active children (~$12 USD × count), not `$0.00/yr`.
- **+ Add domain** button on Domains group — pre-fills yearly $12 USD, Infrastructure, project selector.
- **On/Off per domain** — deactivate domains you will not renew without deleting history.

### Layout (`App.jsx`)

- **Fixed sidebar** — only main content scrolls; sidebar stays in place.
- **Collapsible sidebar** — chevron in sidebar header; icon-only rail (~64px) vs full (~208px); preference saved in `localStorage`.
- **P&L header simplified** — duplicate “Tech Department P&L” card removed; export/screenshot controls live in view bar.
- **P&L Month view** — Year grid / Month view layout toggle; vertical single-month breakdown with summary cards (total, vs last month, largest project, % YTD); cross-year month navigation; tall CSV export; click year-grid month column to drill down; zero rows hidden per view mode (amortized virtual rows still show).

### Data corrections (Supabase)

| Area | What changed |
|------|----------------|
| **Domains** | 11 active domains with real names, expiry-based billing dates, grouped per project in P&L |
| **Zoom** | Business $109.95/mo + Webinars 500 $79/mo; historical invoices Jan–Jun from actual Zoom billing (incl. Large Meeting one-off) |
| **AS Credits** | CAE & Dr Jasmine: individual USD wallet top-ups from Automatic Sales payment history (not MYR month-end aggregates) |
| **WABA** | Per-project only: CAE $15/mo, Dr Jasmine $15/mo — **no** company-wide $30 WABA |
| **OpenAI API Credits** | Template `r_openai_api` added (variable monthly; paste amounts like AS Credits) |
| **Duplicate names merged** | ChatGPT Plus, DigitalOcean, Zoom Business, Supabase, Automatic Sales, Google Workspace |

---

## 2. Business decisions (do not reverse without discussion)

### Projects

| Project | Purpose |
|---------|---------|
| **CAE** | Client project — domains, AS Credits wallet, WABA add-on |
| **Dr Jasmine** | Client project — domains, AS Credits wallet, WABA add-on |
| **Jeff** | Client project — 1 domain (`jeffleonglive.com`) |
| **Company-wide** | Shared tools (`project = null`) — ChatGPT, Zoom, Supabase, Automatic Sales platform fee, etc. |

### Automatic Sales vs AS Credits

| Item | What it is | How tracked |
|------|------------|-------------|
| **Automatic Sales** | Yearly platform ~**$997 USD**, renews **17 Oct** | Recurring `r_automate`; amortized in P&L monthly; cash charge in October |
| **AS Credits** | Variable wallet top-ups per subaccount (usage credits) | `expense_type: credit-reload`, project = CAE or Dr Jasmine; **paste each charge** from payment history |
| **WABA** | WhatsApp add-on **$15 USD/mo per subaccount** (CAE, Dr Jasmine only) | Recurring `r_waba_cae`, `r_waba_drjasmine` under `r_automate`; **not** company-wide |

**Decision:** Company-wide `r_waba` ($30/mo) was **deactivated** — we only pay WABA for the two project subaccounts at $15/mo each.

### Domains

- **~$12 USD/year** per domain (Namecheap).
- **P&L:** amortized monthly from renewal month; **cash view:** full charge on renewal date.
- **Not renewing:** `futureofsellingonline.com`, `whatsgenie.com`, `thebrandwarriors.com` — set `active: false`, notes `Not renewing`.
- **Subscriptions UI:** one **Domains** group; each child shows project badge.

#### Active domain inventory (July 2026)

| Project | Domains |
|---------|---------|
| **CAE (4)** | caegoh.com, caegohevent.com, caegohlive.com, predictabledestiny.com |
| **Dr Jasmine (4)** | drjasminechiew.com, drjasminechiewlive.com, drjasminelive.com, personalhealthlab.com |
| **Jeff (1)** | jeffleonglive.com |
| **Company-wide (2)** | nmmedia.app, topasiaedu.com |

### Zoom

| Item | Amount | Notes |
|------|--------|-------|
| **Zoom Workplace Business** | $109.95/mo (5 users) | Parent `r_zoom_business`; billing day **11**, month **7** |
| **Zoom Webinars (500)** | $79/mo | Add-on `r_zoom_webinars_500`, child of Zoom Business |
| **Historical (Jan–Jun 2026)** | Actual invoice totals | Split by ratio 109.95:79 when invoice combined both; extras (Large Meeting $54, prorated $14.43) as separate lines |

### ChatGPT vs OpenAI API

| Item | Amount | Notes |
|------|--------|-------|
| **ChatGPT Plus** | **$100 USD/mo** | Company-wide subscription going forward |
| **OpenAI API Credits** | Variable | Separate from ChatGPT Plus; add monthly via credit-reload or paste from OpenAI billing |

### Currency & P&L views

- **Display currency:** MYR  
- **USD → MYR rate:** **4.03** (in `currency_settings`)  
- **Amortized view:** yearly costs spread monthly; best for “monthly burn”  
- **Cash view:** charges in payment month; best for “when we actually paid”

### Historical vs live data

- **Jan–Jun 2026:** many subs still have **MYR rows** from mastersheet import (Zoom, ChatGPT, etc.) — intentional historical record.
- **Jul 2026+:** live **USD** amounts from actual subscriptions and payment imports.
- Do not delete historical MYR without a deliberate audit.

---

## 3. How to maintain data going forward

### Monthly workflow

1. Open app → subscriptions auto-generate current month for **active** recurring items.
2. **AS Credits (CAE / Dr Jasmine):** add expense per wallet top-up from Automatic Sales payment history (`credit-reload`, USD, actual date).
3. **OpenAI API Credits:** same pattern when OpenAI billing arrives.
4. Review **P&L** in amortized view for monthly burn; use **cash view** for invoice timing.
5. Export CSV or screenshot for stakeholders.

### Adding a domain

1. Subscriptions → **Domains** → **+ Add domain**
2. Enter domain name, pick project, confirm $12 USD/year and billing month/day from Namecheap expiry.
3. Toggle **Off** when not renewing (do not delete unless removing permanently).

### Pausing a subscription

- Flip **Off** on the subscription row — skips auto-generation; does not delete history.

---

## 4. Technical conventions (code)

| Concept | Location | Notes |
|---------|----------|-------|
| P&L grid builder | `src/data/parseMastersheetCsv.js` → `buildPnlGrid()` | View mode, virtual fill, grouping |
| Amortized vs cash filter | `filterExpensesForPnlView()` | Excludes `Annual invoice` vs `Amortized annual fee` |
| Yearly virtual amortization | `expandYearlyRecurringAmortized()` | From billing month through year-end |
| Monthly virtual fill | `expandMonthlyRecurringVirtual()` | Fills gaps; does **not** skip add-ons when parent bills same month |
| Subscription grouping | `parent_id` on `recurring` | WABA, Zoom Webinars, domain children |
| Domain group (Subscriptions UI) | `DOMAINS_GROUP_ID` in `RecurringManager.jsx` | Visual-only unified group |
| Expense notes | `EXPENSE_NOTE_AMORTIZED`, `EXPENSE_NOTE_ANNUAL_INVOICE` | `store.js` |

---

## 5. Open / pending items

| Item | Status | Action when ready |
|------|--------|-------------------|
| **OpenAI API Credits amounts** | Template exists (`r_openai_api`) | Paste monthly charges from OpenAI billing |
| **Artemo, Claude, Freepik** | In DB as MYR historical | Confirm if still active; normalize to USD if needed |
| **Contabo** | Excluded from import | Add if still subscribed |
| **Vercel deploy** | `vercel.json` present | Ensure env vars set on Vercel |
| **ChatGPT Plus Jul spike (RM 403)** | May be data issue | Verify Jul expense row vs $100 USD expected |
| **Domain names in P&L** | Using real names | Update if domains added/removed |

---

## 6. Clarifications still useful (if auditing)

1. Is **Artemo** (RM 384.51/mo) still active — what service is it?
2. Is **Claude** (RM 80/mo) still active or replaced by ChatGPT Plus?
3. Is **Freepik** (RM 55/mo) still subscribed?
4. Should **historical MYR** rows eventually be normalized to USD at 4.03 for all subs?

---

## 7. Key recurring IDs (reference)

| ID | Name | Project | Amount | Frequency |
|----|------|---------|--------|-----------|
| `r_automate` | Automatic Sales | company-wide | $997 | yearly |
| `r_waba_cae` | WABA | CAE | $15 | monthly |
| `r_waba_drjasmine` | WABA | Dr Jasmine | $15 | monthly |
| `r_zoom_business` | Zoom Business | company-wide | $109.95 | monthly |
| `r_zoom_webinars_500` | Zoom Webinars (500) | company-wide (add-on) | $79 | monthly |
| `r_chatgpt_plus` | ChatGPT Plus | company-wide | $100 | monthly |
| `r_openai_api` | OpenAI API Credits | company-wide | $0 (variable) | monthly |
| `r_waba` | WABA (old company-wide) | — | $30 | **inactive** |

Domain children use IDs like `r_domain_caegoh`, `r_domain_drjasminechiew`, etc., with `parent_id` pointing to `r_domains_cae`, `r_domains_drjasmine`, `r_domains_jeff`, or `r_domains_company`.

---

## 8. Local development

```bash
npm run dev -- --host 127.0.0.1 --port 5179 --strictPort
```

Open **http://127.0.0.1:5179/** — hard refresh (`Cmd+Shift+R`) after code or DB changes.

If UI looks stale, restart the Vite dev server (old processes can serve outdated bundles).

---

## Subscriptions upgrade (Agent 1)

**Date:** 10 July 2026  
**Scope:** Schema + billing logic + expense sync (no UI redesign)

### Implemented

- **`skipped_months` column** on `recurring` (JSONB array of `YYYY-MM` strings), mapped ↔ `skippedMonths` in `supabase.js`.
- **Billing model split:** `active` = long-term pause; per-month skip tracked in `skippedMonths` (separate from pause).
- **`store.js` helpers:** `isDomainParent`, `isDomainChild`, `isDueInMonth`, `getBillingStatus`.
- **`applyRecurring()`** respects `skippedMonths`, `active === false`, domain parent shells (`r_domains_*`), zero-amount rows, yearly billing month, and end dates.
- **New App.jsx handlers:** `handleRecurringPause`, `handleRecurringResume`, `handleRecurringBillMonth` (creates/deletes current-period expense + persists skip list). `handleRecurringToggle` now delegates to pause/resume for backward compatibility.
- **RecurringManager minimal tweak:** toggle calls `onBillMonth` for active due/billed/skipped rows; tooltips say “Bill this month” / “Skip this month”; paused rows use `onResume`; `expenses` prop passed for `getBillingStatus`.

### Manual step

Run `supabase-migration.sql` (or the `add_recurring_skipped_months` migration) on any DB not yet migrated.

### Blockers for Agent 2

- None on data layer. Agent 2 can import `getBillingStatus`, `isDueInMonth` from `store.js` and use `expenses` + `recurring` already wired in `App.jsx`.
- Run-rate helpers (`monthlyEquivalent`, `getSubscriptionRunRates`, `listDueThisMonth`) are **not** added yet — Agent 2 should add per plan §6.
- Summary cards and view tabs unchanged; “On/Off” pill labels remain until Agent 3.

---

## Subscriptions upgrade (Agent 2)

**Date:** 10 July 2026  
**Scope:** Summary cards + month header + run-rate helpers (no view tabs or filters)

### Implemented

- **`store.js` run-rate helpers:** `monthlyEquivalent`, `getSubscriptionRunRates`, `getThisMonthStats`.
  - Run rates include active subs only; domain parent shells (`r_domains_*`) excluded; domain children and add-ons included.
  - Yearly subs normalized as amount ÷ 12 in display currency.
  - This-month stats use `getBillingStatus` for due / billed / skipped counts and sum display-currency amounts for items still due.
- **`RecurringManager.jsx` summary cards** replaced misleading Monthly Cost / Yearly Cost / Active cards with **Monthly run rate**, **Annual run rate**, and **This month** (counts + due amount).
- **Page subheader** under title: `{Month YYYY} · N due · M billed` (+ skipped when &gt; 0).
- **Info banner** shortened to describe bill-this-month vs long-term pause.
- **Button** renamed to **Add subscription** (modal titles unchanged for Agent 3).

### Blockers for Agent 3

- None on helpers or stats. Agent 3 can import `getThisMonthStats`, `getBillingStatus`, `isDueInMonth` and add `listDueThisMonth` if needed for the This month tab.
- “This month” card uses count string as primary value (may need smaller type when Agent 3 adds denser layout).
- Row On/Off pills and modal “Add Recurring” copy still pending Agent 3.

---

## Subscriptions upgrade (Agent 3)

**Date:** 10 July 2026  
**Scope:** This month / All subscriptions view tabs + simplified rows + distinct skip vs pause controls

### Implemented

- **View tabs** below summary cards: **This month** (default) and **All subscriptions** (`useState` in `RecurringManager`).
- **This month view:** lists subs with `getBillingStatus` of due, billed, or skipped; domain children grouped under collapsible Domains when any qualify; sorted by billing day ascending via `buildThisMonthGroups`.
- **All subscriptions view:** full catalog with active + **Paused / cancelled** sections; includes not-due yearly subs; existing parent/add-on/domain grouping preserved.
- **Simplified rows:** subtitle shows `{category} · {billing date}` only; end date shown only when set; removed ∞ Infinite badge and “No end date” text.
- **Status badges:** Billed (green), Due (amber), Skipped / Paused (gray), Not due (muted).
- **Billing date format:** monthly → `Jul 25`; yearly → `Jul 1 · yearly`.
- **Bill this month** toggle (switch) on due/billed/skipped rows in This month view (and All view when status qualifies); calls `onBillMonth`. Domain group parent has no bill toggle.
- **Pause / Resume** icon buttons in All view only; long-term toggle via `onPause` / `onResume` — separate from skip-month.
- **Modal titles:** Add subscription / Edit subscription / Add domain / Edit domain.
- **Removed** dead `onToggle` prop from `RecurringManager` and `App.jsx` wiring.

### Blockers for Agent 4

- None on view tabs or row actions. Agent 4 can add search/filter/sort to **All subscriptions** view and domains search-within when expanded.
- Filter bar should respect `viewTab === 'all'` (or optionally also filter This month list).
- Domain group `+ Add domain` and expand/collapse already work; Agent 4 adds search-within-children when expanded.

---

## Subscriptions upgrade (Agent 4)

**Date:** 10 July 2026  
**Scope:** Search, filter, sort (All view) + domains group UX polish + empty states

### Implemented

- **Filter bar** on **All subscriptions** tab: search (name), category, project, status (Active/Paused), sort (Name A–Z, Cost high→low, Billing day). Client-side on loaded `recurring`; filters combine with AND logic.
- **This month** tab shows search only; filters apply to the visible due/billed/skipped list.
- **Grouping preserved:** parent match shows full child set; child-only match shows parent group with matching children only. Add-ons stay under parents after filter/sort.
- **Sort by cost** uses `monthlyEquivalent` in display currency (yearly subs ÷ 12, FX via `convertToDisplay`).
- **Domains group polish:** parent subtitle shows `{monthly}/mo · N domains · M active`; compact **Search domains** input when expanded (filters children by name or project); empty state **No domains match**. Child rows keep status badges and bill-month toggle from Agent 3.
- **Empty states:** All view with no filter matches → message + **Clear filters**; This month empty → **No subscriptions bill this month** + link to All subscriptions (or clear search when search active).

### Blockers for Agent 5

- None on filters or domains UX. Agent 5 can add duplicate, export CSV, upcoming renewals, and bulk skip-month on top of the filtered All view.
- `RecurringManager` already receives full `recurring` and `expenses` — export/duplicate can use the same array; bulk skip should respect `getBillingStatus` + `onBillMonth` patterns from Agent 1.
- Filter state is local (`useState`); Agent 5 does not need to change it unless bulk actions should apply to filtered subset only (recommended: act on filtered visible due items).

---

## Subscriptions upgrade (Agent 5)

**Date:** 10 July 2026  
**Scope:** QoL — duplicate, export CSV, upcoming renewals, bulk skip month

### Implemented

- **Duplicate subscription** — Copy icon on each row in **All subscriptions** view (not on Domains group parent). Creates new item via `onAdd` with `genId('r')` or `genId('r_domain_')`, name suffix ` (copy)`, `skippedMonths: []`; no expenses copied.
- **Export CSV** — **Export CSV** button in page header; flat list via `exportSubscriptionsToCSV()` in `store.js` (excludes `r_domains_*` shells). Columns: name, category, project, amount, currency, frequency, billing_day, billing_month, active, notes. Filename: `subscriptions-YYYY-MM-DD.csv`.
- **Upcoming renewals** — **Upcoming (30 days)** card below summary cards; `getUpcomingRenewals()` lists active subs whose billing date (billingDay in current or next calendar month) falls within 30 days; shows name, date, amount; capped at 10 with “+ N more”.
- **Bulk skip this month** — **Skip all unbilled** in This month view when `dueCount > 0`; confirm via `askConfirm`; `handleRecurringBulkSkip` in `App.jsx` adds current `YYYY-MM` to `skippedMonths` for each due item, deletes any existing expense, batch-saves. Acts on filtered visible due items in This month list.

### Blockers

- None. Subscriptions upgrade (Agents 1–5) is complete per plan §4.8 and §10.

---

## Next.js + OpenAI usage (Agent 1)

**Date:** 10 July 2026  
**Scope:** Next.js scaffold, TypeScript, Tailwind, Supabase client modules, placeholder page

### Implemented

- **Toolchain:** Replaced Vite with Next.js 15 (App Router), TypeScript (strict), React 18. Scripts: `dev`, `build`, `start`. Removed `vite` and `@vitejs/plugin-react` from dependencies.
- **Path alias:** `@/*` → project root (see comment in `tsconfig.json`). Agent 2 should import as `@/components/...`, `@/lib/...`, `@/types/...`.
- **App Router:** `app/layout.tsx`, `app/page.tsx` (placeholder “migration in progress”), `app/not-found.tsx`.
- **Styles:** `app/globals.css` copied from `src/index.css` (light/dark CSS variables, `.card`, `.sidebar`, P&L classes, etc.). `tailwind.config.js` scans `app/**`, `src/**`, `components/**`; accent theme preserved. `postcss.config.js` converted to CommonJS for Next.js compatibility.
- **Supabase libs:** `lib/supabase/client.ts` (browser, `isSupabaseConfigured`, `createClient`), `lib/supabase/server.ts` (cookie-based server client), `lib/supabase/admin.ts` (service role, throws if key missing).
- **Env:** `.env.example` updated with `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, optional `INGEST_SECRET`; `VITE_*` marked deprecated.
- **Vercel:** Removed `vercel.json` SPA rewrites — Next.js defaults apply.
- **Types:** `types/index.ts` stub with `AppSettings` interface.
- **Legacy:** `src/` left intact for Agent 2; `vite.config.js` and `index.html` still present (unused).

### Build status

- `npm run build` **passes** (Next.js 15.5.20, static `/` and `/_not-found`).
- No Vite packages in `package.json` dependencies.

### Blockers for Agent 2

- Port all `src/` components and data layer to TypeScript; replace `import.meta.env.VITE_*` with `process.env.NEXT_PUBLIC_*`.
- Update local `.env` and Vercel project settings: rename `VITE_SUPABASE_URL` → `NEXT_PUBLIC_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` → `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- Delete Vite artifacts when done: `src/main.jsx`, `index.html`, `vite.config.js`, and eventually empty `src/` after migration.
- Wire `app/page.tsx` to `AppShell`; use `"use client"` on interactive components; dynamic-import Recharts if SSR hydration errors occur.

---

## Next.js + OpenAI usage (Agent 2)

**Date:** 10 July 2026  
**Scope:** Full Vite SPA → Next.js App Router migration with TypeScript feature parity (5 tabs)

### Implemented

- **Data layer (TypeScript):**
  - `lib/data/supabase.ts` — all CRUD + auth; uses `process.env.NEXT_PUBLIC_*` via `@/lib/supabase/client`
  - `lib/data/store.ts` — defaults, currency utils, P&L/subscription helpers
  - `lib/data/parseMastersheetCsv.ts` — CSV import + `buildPnlGrid` / `slicePnlMonth`
- **Components:** Migrated all `src/components/*` → `components/*.tsx` with `"use client"`; `@/` imports
- **App shell:** `components/AppShell.tsx` — same state hub, 5 tabs (no AI Usage), sidebar collapse, auth flows
- **Routes:** `app/page.tsx` renders `<AppShell />`; `app/auth/reset/page.tsx` for password reset redirect target
- **Types:** `types/index.ts` — `Expense`, `Recurring`, `AppSettings`, `Category`, `Project`, `CurrencySettings`, import payloads
- **Cleanup:** Deleted `src/`, `index.html`, `vite.config.js`; `tailwind.config.js` scans `app/**` + `components/**` only
- **Env:** No `import.meta.env` or `VITE_*` in application code; `setup-supabase.js` updated to `NEXT_PUBLIC_*`

### Migrated files

| From | To |
|------|-----|
| `src/data/supabase.js` | `lib/data/supabase.ts` |
| `src/data/store.js` | `lib/data/store.ts` |
| `src/data/parseMastersheetCsv.js` | `lib/data/parseMastersheetCsv.ts` |
| `src/App.jsx` | `components/AppShell.tsx` |
| `src/components/*.jsx` (13 files) | `components/*.tsx` |
| `src/ResetPasswordPage.jsx` | `app/auth/reset/page.tsx` |

### Build status

- `npm run build` **passes** (Next.js 15.5.20)
- Routes: `/` (app shell), `/auth/reset`, `/_not-found`
- First Load JS for `/`: ~320 kB (includes Recharts client bundle)

### Manual steps

- Rename local `.env` keys: `VITE_SUPABASE_URL` → `NEXT_PUBLIC_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- Update Vercel project env vars to match `.env.example`

### Blockers for Agent 3

- None on app build. Agent 3 can add `openai_usage_events` migration, `lib/openai-pricing.ts`, and `app/api/openai-usage/route.ts` using existing `lib/supabase/admin.ts`.
- Optional follow-up: remove `// @ts-nocheck` from large ported files (`store.ts`, `parseMastersheetCsv.ts`, `RecurringManager.tsx`, etc.) by adding full strict types incrementally.

---

## Next.js + OpenAI usage (Agent 3)

**Date:** 10 July 2026  
**Scope:** `openai_usage_events` schema, server-side pricing, POST `/api/openai-usage` ingest (no UI)

### Implemented

- **Migration (`supabase-migration.sql`):** Table `openai_usage_events` with all plan §4.1 columns; partial unique index on `request_id`; indexes on `occurred_at` and `app_id`. RLS enabled — `SELECT` for `authenticated` only; writes via service role (no anon insert policy). Applied to live Supabase project via MCP.
- **Pricing (`lib/openai-pricing.ts`):** `OPENAI_PRICING_VERSION` = `"2026-07-10"`; `getModelPricing` / `estimateCostUsd` for gpt-4o, gpt-4o-mini, gpt-4-turbo, o1, o1-mini, o3-mini. Unknown models → cost `0` + server warning.
- **Validation (`lib/validations/openai-usage.ts`):** Zod `openaiUsageIngestSchema`; coerces `totalTokens` when within 2 of `promptTokens + completionTokens`.
- **API (`app/api/openai-usage/route.ts`):** POST only; optional `X-Ingest-Secret` when `INGEST_SECRET` set; 400 on validation error; 409 on duplicate `requestId`; 201 with `{ id, estimatedCostUsd, appId, model }`.
- **Types:** `OpenAiUsageEvent` in `types/index.ts`.
- **Dependency:** `zod` added to `package.json`.

### Example cost check

`gpt-4o-mini` with 1200 prompt + 340 completion tokens → `estimatedCostUsd` ≈ **0.000384** (input $0.15/1M, output $0.60/1M).

### Build status

- `npm run build` **passes** (includes dynamic route `ƒ /api/openai-usage`).

### Manual steps

1. Run the Agent 3 section of `supabase-migration.sql` in Supabase SQL Editor if not already applied (live project migrated via MCP during Agent 3).
2. Set `SUPABASE_SERVICE_ROLE_KEY` in `.env.local` / Vercel for ingest writes.
3. Optionally set `INGEST_SECRET` and send `X-Ingest-Secret` header from calling apps.

### curl example

```bash
curl -X POST http://localhost:3000/api/openai-usage \
  -H "Content-Type: application/json" \
  -d '{
    "appId": "cae-gpt",
    "appName": "CAE GPT Assistant",
    "requestId": "550e8400-e29b-41d4-a716-446655440000",
    "model": "gpt-4o-mini",
    "promptTokens": 1200,
    "completionTokens": 340,
    "totalTokens": 1540,
    "feature": "summarize-report",
    "occurredAt": "2026-07-10T09:15:00Z"
  }'
```

### Blockers for Agent 4

- **RPC not yet created:** `get_openai_usage_summary` and optional `get_openai_usage_events` functions still needed in `supabase-migration.sql`.
- **No UI tab:** `AppShell` still has 5 tabs — Agent 4 adds AI Usage tab + `OpenAiUsage.tsx`.
- **Seed data recommended:** POST 3–5 events via curl (different `appId`s) before testing charts.
- **Client helper:** `lib/data/openai-usage.ts` for RPC calls not yet created.

---

## Next.js + OpenAI usage (Agent 4)

**Date:** 10 July 2026  
**Scope:** Supabase RPC aggregations, AI Usage page, 6th sidebar tab

### Implemented

- **RPC (`supabase-migration.sql` + live Supabase via MCP):**
  - `get_openai_usage_summary(p_date_from, p_date_to)` → JSON with `totals`, `by_app`, `by_model`, `daily_trend`, `previous_period` (equal-length prior window for trend badge).
  - `get_openai_usage_events(p_date_from, p_date_to, p_app_id, p_limit)` → recent event rows for optional drill-down.
  - `GRANT EXECUTE` to `authenticated`; `SECURITY INVOKER` respects RLS on `openai_usage_events`.
- **Client helper (`lib/data/openai-usage.ts`):** `fetchUsageSummary`, `fetchUsageEvents`, typed summary/event interfaces with safe JSON parsing.
- **UI (`components/OpenAiUsage.tsx`):** Date range + quick ranges (This month, Last 3/6/12 mo); stat cards (tokens, est. cost USD + MYR via `currencySettings`, requests, avg tokens/request, cost trend badge); Recharts bar (by app), line (daily trend), pie (by model); apps-ranked table with MYR column when display ≠ USD; empty state with `POST /api/openai-usage` hint.
- **Nav (`components/AppShell.tsx`):** 6th tab `{ id: 'ai-usage', label: 'AI Usage', icon: Cpu }`; header subtitle for AI Usage.

### Build status

- `npm run build` **passes** (Next.js 15.5.20).

### Manual verification

1. Seed 3–5 events via curl (different `appId`s, models, dates within range).
2. Log in → **AI Usage** tab → confirm cards/charts/table populate.
3. Change date range → data refreshes.
4. Clear data or pick empty range → empty state appears.

### Blockers for Agent 5

- None on RPC or UI. Agent 5 can add OpenAPI spec + Swagger UI at `/api-docs` documenting `POST /api/openai-usage`.
- Optional: link to `/api-docs` from AI Usage empty state after Agent 5 lands.

---

## Next.js + OpenAI usage (Agent 5)

**Date:** 10 July 2026  
**Scope:** OpenAPI 3.0 spec + Swagger UI at `/api-docs` (final agent)

### Implemented

- **OpenAPI spec (`public/openapi.yaml`):** Hand-written OpenAPI 3.0.3 matching `app/api/openai-usage/route.ts` and `lib/validations/openai-usage.ts`. Documents `POST /api/openai-usage` with all camelCase request fields, optional `X-Ingest-Secret` header, tag **OpenAI Usage**, info title **Company Costing App — Ingest API**. Responses `201`, `400`, `401`, `409`, `500` with copy-pasteable examples (full + minimal request bodies).
- **Swagger UI (`app/api-docs/page.tsx`):** Client-only page; `swagger-ui-react` loaded via `dynamic(..., { ssr: false })` to avoid SSR errors. Loads spec from `/openapi.yaml`. Header with link back to main app; uses app CSS variables for background/card.
- **Dependencies:** `swagger-ui-react`, `@types/swagger-ui-react` (dev).
- **Docs:** `docs/README.md` — API documentation section linking to `/api-docs` and `public/openapi.yaml`.

### Build status

- `npm run build` **passes** (route `/api-docs` static; `/openapi.yaml` served from `public/`).

### Manual verification

1. Run app → open **`/api-docs`** → Swagger UI renders without hydration errors.
2. Expand **POST /api/openai-usage** → request schema shows all fields; example body is copy-pasteable.
3. **Try it out** against local dev: valid body → `201`; duplicate `requestId` → `409`.

### Section 10 checklists (docs/08)

All items in [08-nextjs-openai-usage-plan.md](./08-nextjs-openai-usage-plan.md) §10 are now **verifiable** via manual test (Agents 2–5 complete). Swagger subsection:

- [ ] `/api-docs` loads Swagger UI
- [ ] `POST /api/openai-usage` documented with request schema
- [ ] Try-it-out works against local/staging

---

*This document supersedes informal chat decisions for the topics above. Update it when subscription amounts, domain inventory, or business rules change.*
