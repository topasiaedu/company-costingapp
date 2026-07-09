# Company Costing App — Project Overview

## What this is

A **tech department spend tracker** that replaces a manual Google Sheets / CSV mastersheet workflow. The goal is to become the **single source of truth** for software and project costs — per project (e.g. CAE, Dr Jasmine) and company-wide shared tools (ChatGPT, Zoom, Supabase, etc.).

Instead of manually calculating and exporting a spreadsheet each month, you:

1. Record expenses, subscriptions, and credit reloads in the app
2. View dashboards and a **P&L Report** (mastersheet-style grid)
3. Screenshot or export CSV for stakeholders

---

## Who uses it

- **Single user** (solo operator) for now
- Same email/password login via Supabase Auth
- Data is private per user (RLS on all tables)

---

## Tech stack

| Layer | Technology |
|--------|------------|
| Frontend | React 18 (JSX), Vite 5 |
| Styling | Tailwind CSS 3 + CSS variables (light/dark) |
| Charts | Recharts |
| Dates | date-fns |
| Backend | **None** — no Node server |
| Auth + DB | Supabase (Auth + PostgreSQL via `@supabase/supabase-js`) |
| Hosting | **Vercel** (static SPA from `vite build` → `dist/`) |

**Render is not required.** The browser talks directly to Supabase.

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│  Browser (React SPA on Vercel)                          │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────────┐ │
│  │ App.jsx     │  │ Components   │  │ store.js        │ │
│  │ (state hub) │→ │ Dashboard,   │  │ (utils, defaults│ │
│  │             │  │ Expenses,    │  │  currency, etc.)│ │
│  │             │  │ P&L, Import… │  └─────────────────┘ │
│  └──────┬──────┘  └──────────────┘                      │
│         │                                                │
│         ▼                                                │
│  src/data/supabase.js  (all CRUD + auth)                │
└─────────┬───────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────┐
│  Supabase                                               │
│  • Auth (email/password, password reset)                │
│  • Postgres: expenses, recurring, settings, categories, │
│    currency_settings, projects                          │
│  • RLS: auth.uid()::text = user_id                      │
└─────────────────────────────────────────────────────────┘
```

**State pattern:** All app state lives in `App.jsx`. Components receive props; saves go through `supabase.js`. No Redux/React Query.

---

## Database schema (6 tables)

Schema file: `supabase-setup.sql` (already run on new project).

| Table | Purpose |
|--------|---------|
| `expenses` | Individual charges (one-off, subscription-generated, credit reloads) |
| `recurring` | Subscription templates (billing day, frequency, active/paused) |
| `settings` | App name, tagline, theme |
| `categories` | Category names + colors |
| `currency_settings` | Display currency (MYR) + exchange rates JSONB |
| `projects` | Project names + colors (CAE, Dr Jasmine, etc.) |

### Key columns on `expenses`

| Column | Notes |
|--------|--------|
| `project` | `NULL` = company-wide |
| `expense_type` | `subscription` \| `one-time` \| `credit-reload` |
| `recurring_id` | Links to `recurring` if auto-generated from subscription |

---

## Expense types (business logic)

| Type | Meaning | Example |
|------|---------|---------|
| **subscription** | Fixed recurring cost; template in `recurring` auto-generates monthly/yearly expenses | ChatGPT RM94.83/mo |
| **credit-reload** | Top-up event; counts as spend when reloaded, not usage burn | AS Credits |
| **one-time** | Single purchase | Mac hardware |

**AS Credits:** Each reload is recorded when you top up. The P&L counts reload amount in that month. Usage depletion is **not** tracked separately.

**Historical import dates:** Last day of month. **New entries:** Use actual date.

---

## App tabs & features

| Tab | File | Purpose |
|-----|------|---------|
| Dashboard | `Dashboard.jsx` | Monthly spend chart, category pie, spend by project, recent expenses |
| Expenses | `ExpensesTable.jsx` | Search, filter, add/edit/delete, CSV export, import trigger |
| P&L Report | `ProjectPnl.jsx` | Mastersheet-style grid: projects × months; export CSV; screenshot |
| Subscriptions | `RecurringManager.jsx` | Manage recurring templates, pause/activate |
| Settings | `Settings.jsx` | Theme, branding, categories, projects, currency, import |

### CSV import (bootstrap)

- File: `src/data/parseMastersheetCsv.js` + `ImportModal.jsx`
- Parses wide-format P&L CSV (months as columns, RM amounts)
- Skips summary rows (TOTAL, Cost %, Total Registers, etc.)
- Splits multi-line cells (e.g. Zoom → separate line items)
- Auto-detects recurring vs credit-reload vs one-time

**Source mastersheet reference:** wide CSV with sections `CAE`, `Dr Jasmine`, `SOFTWARE COST` (company-wide).

---

## Project structure

```
company-costingapp/
├── supabase-setup.sql      # Full DB schema + RLS (run once)
├── .env                    # VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY (not committed)
├── package.json
├── vite.config.js
├── index.html
└── src/
    ├── main.jsx
    ├── App.jsx             # Root: auth, tabs, state, CRUD handlers
    ├── index.css
    ├── data/
    │   ├── supabase.js     # Supabase client + all DB operations
    │   ├── store.js        # Defaults, currency utils, export helpers
    │   └── parseMastersheetCsv.js
    └── components/
        ├── Login.jsx, ResetPassword*.jsx
        ├── Dashboard.jsx
        ├── ExpensesTable.jsx, ExpenseModal.jsx
        ├── ProjectPnl.jsx, ImportModal.jsx
        ├── RecurringManager.jsx
        └── Settings.jsx
```

---

## Environment variables

```bash
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=your_publishable_or_anon_key
```

Set locally in `.env` and in Vercel project settings.

**Do not** expose `service_role` key in frontend or Vercel.

---

## Current status (as of setup)

| Item | Status |
|------|--------|
| New Supabase project | ✅ Created |
| `supabase-setup.sql` | ✅ Run |
| `.env` with URL + anon key | ✅ Configured |
| Core features (projects, import, P&L, subscriptions) | ✅ Implemented in codebase |
| Vercel deployment | ⏳ Pending |
| Real mastersheet CSV imported & verified | ⏳ Pending |
| Hardcoded fallback keys removed | ⏳ Pending |
| README / `.env.example` | ⏳ Pending |

---

## Deployment (Vercel)

- **Build command:** `npm run build`
- **Output directory:** `dist`
- **Framework:** Vite (or Other static)
- **Env vars:** `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
- SPA routing: all routes serve `index.html` (add `vercel.json` rewrites if needed)

---

## Design decisions (do not reverse without discussion)

1. **Projects** are a first-class field on expenses/recurring, not categories
2. **Company-wide** = `project: null` (shared software section)
3. **No custom backend** — Supabase only
4. **JSX not TypeScript** — match existing codebase
5. **Credit reloads** = top-up events, not wallet balance tracking
6. **App is source of truth** — CSV import is bootstrap only, not ongoing sync

---

## Out of scope (for now)

- Multi-user teams / roles
- AS Credits balance / burn-rate tracking
- Metrics rows from mastersheet (Total Registers, Cost %, etc.)
- Render / Docker / Node API server
- Migrating data from old Supabase project

---

## Related files

- `docs/02-agent-implementation-prompts.md` — Copy-paste prompts for implementation agents
- `docs/04-decisions-and-accomplishments.md` — **Source of truth** for business rules, data corrections, and open items
- `supabase-setup.sql` — Database setup
- `supabase-migration.sql` — Incremental migration (if upgrading old DB)
