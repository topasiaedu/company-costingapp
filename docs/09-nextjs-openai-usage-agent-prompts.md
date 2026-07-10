# Next.js Migration + OpenAI Usage — Agent Implementation Prompts

**Last updated:** 10 July 2026  
**Design spec:** [08-nextjs-openai-usage-plan.md](./08-nextjs-openai-usage-plan.md)  
**Run agents in order (1 → 5).** Each prompt is sized for a ~200k context model doing implementation (not just planning).

Copy everything inside a prompt block into a **new agent chat** with the repo open. Do not combine agents unless you accept merge/conflict risk.

---

## Before any agent

Shared rules for all agents:

- Read [08-nextjs-openai-usage-plan.md](./08-nextjs-openai-usage-plan.md) first.
- Read [01-project-overview.md](./01-project-overview.md) for current app behavior and schema.
- **Do not** run `npm start` or `npm run dev` unless you need to verify — user likely has a dev server running.
- **Do not** commit, push, or merge unless the user explicitly asks.
- Use **TypeScript** for all new and migrated code (`.ts` / `.tsx`).
- Match existing visual style: Tailwind + CSS variables in `index.css`, `date-fns`, Recharts, Lucide icons.
- Minimize scope — only change files listed in each prompt.
- When finished, append a short bullet section to [04-decisions-and-accomplishments.md](./04-decisions-and-accomplishments.md) under **Next.js + OpenAI usage (Agent N)** describing what you implemented.
- If a prior agent's work is missing, stop and report what's missing — do not re-implement earlier phases.

---

## Agent 1 — Next.js scaffold & toolchain

**Estimated scope:** ~10–15 files (config, layout, lib stubs)  
**Depends on:** nothing  
**Blocks:** Agents 2–5

### Prompt

```
You are implementing Agent 1 of the Next.js migration + OpenAI usage feature for the Company Costing App.

Read these docs first:
- docs/08-nextjs-openai-usage-plan.md (sections 2, 3, 7, 8)
- docs/01-project-overview.md (tech stack, env vars)

## Goal
Replace the Vite toolchain with Next.js (App Router) + TypeScript + Tailwind. Set up folder structure, Supabase client modules, and global styles. Do NOT migrate feature components yet — Agent 2 does that. End state: `npm run build` passes with a minimal placeholder page proving the stack works.

## Current repo facts
- Vite + React 18 + JSX in src/
- Env: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY
- Tailwind 3 + postcss already configured
- Deployed on Vercel with vercel.json SPA rewrites (will change)

## Implement

### 1. Initialize Next.js in this repo
- Add Next.js 14+ (App Router), React 18, TypeScript, @types packages
- Remove Vite-specific deps (@vitejs/plugin-react, vite) and scripts — but keep old src/ intact until Agent 2 migrates it (do not delete src/ yet)
- package.json scripts: "dev": "next dev", "build": "next build", "start": "next start"
- tsconfig.json with strict mode, path alias `@/*` → project root or `src/*` (pick one, document in comment)
- next.config.ts (or .mjs) — minimal, no experimental flags unless needed

### 2. Tailwind + PostCSS
- Move/adapt tailwind.config to scan `app/**` and `src/**` (or `components/**` if you relocate)
- Keep existing theme extensions from current tailwind.config.js
- Copy src/index.css → app/globals.css (preserve all CSS variables and .card, .sidebar, etc.)
- postcss.config unchanged in spirit

### 3. App Router skeleton
```
app/
  layout.tsx          # html/body, import globals.css
  page.tsx            # placeholder: "Company Costing — migration in progress"
  not-found.tsx       # optional minimal
```

### 4. Supabase lib modules (TypeScript)
Create typed client helpers (do not port all CRUD yet — Agent 2):

- `lib/supabase/client.ts` — browser client using createBrowserClient from @supabase/ssr OR createClient from @supabase/supabase-js with NEXT_PUBLIC_* env vars. Export `isSupabaseConfigured` boolean.
- `lib/supabase/server.ts` — server client for Route Handlers (cookies pattern with @supabase/ssr)
- `lib/supabase/admin.ts` — service role client using SUPABASE_SERVICE_ROLE_KEY (server-only; throw if missing when used)

Add dependency: `@supabase/ssr` if using cookie pattern.

### 5. Environment
- Update `.env.example`:
  - NEXT_PUBLIC_SUPABASE_URL
  - NEXT_PUBLIC_SUPABASE_ANON_KEY
  - SUPABASE_SERVICE_ROLE_KEY (comment: server only, for ingest API)
  - INGEST_SECRET (optional, comment only)
- Add brief comment that VITE_* vars are deprecated

### 6. Vercel
- Replace vercel.json SPA rewrites with Next.js defaults (or delete vercel.json if unnecessary)
- Framework preset should be Next.js

### 7. Placeholder types
- `types/index.ts` — empty export or AppSettings stub; Agent 2/3 will expand

## Files you may create/edit
- package.json, package-lock.json
- tsconfig.json, next.config.*
- app/layout.tsx, app/page.tsx, app/globals.css
- lib/supabase/*.ts
- types/index.ts
- tailwind.config.js (or .ts)
- .env.example
- vercel.json (update or remove)
- Delete or stop using: vite.config.js, index.html (after confirming Next builds — ok to leave src/ for Agent 2)

## Do NOT
- Migrate Dashboard, App.jsx, or other components (Agent 2)
- Create openai_usage_events table (Agent 3)
- Run npm run dev unless needed to verify build

## Acceptance criteria
- [ ] `npm run build` succeeds
- [ ] Placeholder page renders at /
- [ ] globals.css includes dark mode CSS variables from original index.css
- [ ] lib/supabase/client.ts exports working browser client pattern
- [ ] lib/supabase/admin.ts uses service role env (server-only)
- [ ] .env.example documents new variable names
- [ ] No Vite in package.json dependencies

## Manual verification
Note in summary: build output, any warnings, path alias chosen.

Append findings to docs/04-decisions-and-accomplishments.md under "Next.js + OpenAI usage (Agent 1)".
```

---

## Agent 2 — Migrate existing app to Next.js

**Estimated scope:** ~20 files (full src/ migration)  
**Depends on:** Agent 1 (Next scaffold, lib/supabase, globals.css)  
**Blocks:** Agents 3–5

### Prompt

```
You are implementing Agent 2 of the Next.js migration for the Company Costing App.

Read:
- docs/08-nextjs-openai-usage-plan.md (sections 3, 9, 10 — migration parity checklist)
- docs/01-project-overview.md (tabs, state pattern, schema)
- docs/04-decisions-and-accomplishments.md (Agent 1 section — confirm Next scaffold exists)

Verify Agent 1 landed: app/, lib/supabase/, npm run build works. If not, stop and report.

## Goal
Port the entire existing Vite SPA to Next.js with TypeScript and **feature parity**. The app should look and behave the same as before: auth, all 5 tabs, modals, import, P&L, subscriptions, settings. Remove obsolete Vite entry files when done.

## Migration strategy

### 1. Data layer (TypeScript)
Port and type:
- src/data/supabase.js → lib/data/supabase.ts (or src/data/supabase.ts — match Agent 1 path alias)
  - Replace import.meta.env.VITE_* with process.env.NEXT_PUBLIC_*
  - Add types for Expense, Recurring, Settings, Category, Project, CurrencySettings
  - Map snake_case ↔ camelCase as today
- src/data/store.js → lib/data/store.ts (utils, defaults, fmtCurrency, P&L helpers, etc.)
- src/data/parseMastersheetCsv.js → lib/data/parseMastersheetCsv.ts

### 2. Components (TypeScript + "use client")
Port all files from src/components/ to components/ (or src/components/ — be consistent with Agent 1):
- Add "use client" at top of every component using hooks, browser APIs, or Recharts
- Port src/ResetPasswordPage.jsx if used
- Fix imports to use @/ alias

Recharts: if SSR hydration errors occur, use dynamic import with { ssr: false } for chart-heavy components (Dashboard, ProjectPnl).

### 3. App shell
Port src/App.jsx → components/AppShell.tsx (or app/AppShell.tsx):
- "use client" at top
- Same state hub pattern (user, expenses, recurring, tab state, handlers)
- Same TABS array (5 tabs only — Agent 4 adds AI Usage)
- Replace import.meta / Vite env checks with NEXT_PUBLIC_*
- Password reset: replace window.location.hash check with useEffect on window.location.hash OR create app/auth/reset/page.tsx that renders ResetPasswordForm (either approach ok if flow works)
- localStorage sidebar collapse: keep as-is inside useEffect

Wire in app/page.tsx:
```tsx
import { AppShell } from "@/components/AppShell";
export default function Page() {
  return <AppShell />;
}
```

### 4. Cleanup
- Delete src/main.jsx, index.html, vite.config.js if still present
- Delete empty src/ only after everything moved
- Ensure no remaining import.meta.env references

### 5. Types
Expand types/index.ts with interfaces used across components.

## Files you may edit
- All migrated components and data files
- app/page.tsx
- app/auth/reset/page.tsx (if created)
- types/index.ts
- Delete Vite artifacts

## Do NOT
- Add AI Usage tab or openai_usage_events (Agents 3–4)
- Change business logic in subscriptions/P&L unless required for TypeScript compile
- Add API routes yet

## Acceptance criteria
- [ ] Login, logout, password reset work
- [ ] All 5 tabs: Dashboard, Expenses, P&L, Subscriptions, Settings
- [ ] Add/edit/delete expense works and saves to Supabase
- [ ] CSV import works
- [ ] Theme toggle works
- [ ] `npm run build` passes with no TypeScript errors
- [ ] No VITE_ env references remain

## If context is tight
Stop after data layer + AppShell + Login; report remaining components for Agent 2b. Prefer completing over partial if possible.

Append to docs/04-decisions-and-accomplishments.md under "Next.js + OpenAI usage (Agent 2)".
```

---

## Agent 3 — OpenAI usage schema & ingest API

**Estimated scope:** ~5–8 files  
**Depends on:** Agent 1 (admin client), Agent 2 (Next app builds)  
**Blocks:** Agents 4–5

### Prompt

```
You are implementing Agent 3 of the OpenAI token usage feature for the Company Costing App.

Read:
- docs/08-nextjs-openai-usage-plan.md (sections 4.1, 4.2, 5, 7)
- docs/04-decisions-and-accomplishments.md (Agents 1–2)

Verify: Next app runs, lib/supabase/admin.ts exists. If not, stop.

## Goal
Create the database table for usage events, server-side pricing logic, and POST /api/openai-usage ingest endpoint. No UI in this agent.

## Implement

### 1. Database migration
Add to supabase-migration.sql (new section, additive):

Table `openai_usage_events` with columns matching plan §4.1:
- id (uuid, pk, default gen_random_uuid())
- app_id (text, not null)
- app_name (text, nullable)
- request_id (text, nullable, unique partial index where not null)
- model (text, not null)
- prompt_tokens (int, not null)
- completion_tokens (int, not null)
- total_tokens (int, not null)
- feature (text, nullable)
- occurred_at (timestamptz, not null)
- estimated_cost_usd (numeric, not null)
- price_snapshot (text, nullable) — e.g. pricing table date
- ingested_at (timestamptz, default now())

RLS:
- SELECT allowed for authenticated users (auth.uid() is not null) — single-tenant app, all logged-in users see all events
- INSERT/UPDATE/DELETE: no anon insert — writes only via service role from API route

Document in migration comment: run in Supabase SQL editor.

### 2. Pricing lib
Create lib/openai-pricing.ts:
- Export OPENAI_PRICING_VERSION string (e.g. "2026-07-10")
- Export getModelPricing(model: string): { inputPer1M: number; outputPer1M: number } | null
- Include common models: gpt-4o, gpt-4o-mini, gpt-4-turbo, o1, o1-mini, o3-mini (use public OpenAI list prices as of implementation date)
- Export estimateCostUsd(model, promptTokens, completionTokens): number

### 3. Zod schema
Create lib/validations/openai-usage.ts:
- openaiUsageIngestSchema with all required fields from plan §5
- Validate totalTokens is consistent (warn or coerce if off by small margin)
- occurredAt as ISO datetime string

### 4. API route
Create app/api/openai-usage/route.ts:
- POST only
- Parse JSON body, validate with Zod → 400 on failure
- If requestId provided and already exists → 409
- Compute estimatedCostUsd via pricing lib; unknown model → 0 cost + console.warn
- Insert via lib/supabase/admin.ts (service role)
- Return 201 { id, estimatedCostUsd, appId, model }

Optional: if process.env.INGEST_SECRET is set, require header X-Ingest-Secret match.

No API key per app v1.

### 5. Types
Add OpenAiUsageEvent type to types/index.ts

## Files you may create/edit
- supabase-migration.sql
- lib/openai-pricing.ts
- lib/validations/openai-usage.ts
- app/api/openai-usage/route.ts
- types/index.ts

## Do NOT
- Build AI Usage page (Agent 4)
- Build Swagger (Agent 5)
- Change existing expense/recurring tables

## Acceptance criteria
- [ ] Migration SQL is valid and documented
- [ ] POST with valid body returns 201 and row in DB
- [ ] POST with invalid body returns 400
- [ ] Duplicate requestId returns 409
- [ ] estimatedCostUsd > 0 for gpt-4o-mini with tokens > 0
- [ ] `npm run build` passes

## Manual verification
Provide curl example in your summary:
curl -X POST http://localhost:3000/api/openai-usage -H "Content-Type: application/json" -d '{...}'

Append to docs/04-decisions-and-accomplishments.md under "Next.js + OpenAI usage (Agent 3)".
```

---

## Agent 4 — RPC aggregations & AI Usage page

**Estimated scope:** ~4–6 files  
**Depends on:** Agents 2 (AppShell, Dashboard patterns), 3 (table + ingest)  
**Blocks:** Agent 5

### Prompt

```
You are implementing Agent 4 of the OpenAI token usage feature for the Company Costing App.

Read:
- docs/08-nextjs-openai-usage-plan.md (sections 4.3, 6, 10)
- docs/04-decisions-and-accomplishments.md (Agents 1–3)
- src/components/Dashboard.jsx or components/Dashboard.tsx (patterns for charts, date range, StatCard)

Verify: openai_usage_events table migration exists, POST /api/openai-usage works. If not, stop.

## Goal
Add Supabase RPC for aggregated reads, build the AI Usage page, and add it as the 6th sidebar tab.

## Implement

### 1. Supabase RPC (add to supabase-migration.sql)
Function `get_openai_usage_summary(p_date_from date, p_date_to date)` returns JSON or table with:
- totals: total_tokens, total_cost_usd, request_count, avg_tokens_per_request
- by_app: array of { app_id, app_name, tokens, cost_usd, request_count, pct_of_total }
- by_model: array of { model, tokens, cost_usd }
- daily_trend: array of { date, tokens, cost_usd }
- previous_period: same totals for equal-length prior window (for % change badge)

Filter: occurred_at::date between p_date_from and p_date_to (inclusive).
Use COALESCE(app_name, app_id) for display names.

Also add `get_openai_usage_events(p_date_from, p_date_to, p_app_id optional, p_limit int default 100)` for recent detail table if helpful.

Grant execute to authenticated role.

### 2. Client data helpers
lib/data/openai-usage.ts:
- fetchUsageSummary(dateFrom, dateTo) — calls RPC via browser supabase client
- Types for summary response

### 3. OpenAiUsage component
components/OpenAiUsage.tsx ("use client"):
- Props: currencySettings (for MYR conversion using convertToDisplay / rate from settings)
- Date range state + QUICK_RANGES (copy pattern from Dashboard)
- Stat cards: Total tokens, Est. cost (USD + MYR), Requests, Avg tokens/request
- Trend badge vs previous period if RPC provides it
- Charts (Recharts, client-only):
  - Bar: cost or tokens by appId
  - Line: daily trend
  - Pie: by model
- Table: apps ranked by cost (appId, appName, tokens, cost, % of total)
- Optional app filter dropdown
- Empty state: "No usage recorded yet" + hint to POST to /api/openai-usage
- Match existing card/chart styling (CSS variables, CustomTooltip pattern)

### 4. Wire into AppShell
- Import Cpu or Bot icon from lucide-react
- Add to TABS: { id: 'ai-usage', label: 'AI Usage', icon: Cpu }
- Render <OpenAiUsage currencySettings={currencySettings} /> when tab === 'ai-usage'
- Pass currencySettings from existing state

## Files you may create/edit
- supabase-migration.sql (RPC section)
- lib/data/openai-usage.ts
- components/OpenAiUsage.tsx
- components/AppShell.tsx (tab + render only)

## Do NOT
- Swagger docs (Agent 5)
- Change ingest API (Agent 3)
- Add Realtime subscriptions

## Acceptance criteria
- [ ] AI Usage tab appears in sidebar
- [ ] With seeded events (via curl), summary cards show non-zero values
- [ ] By-app chart shows distinct app IDs
- [ ] Date range change updates data
- [ ] MYR display uses currencySettings (USD × rate)
- [ ] Empty state when no rows
- [ ] `npm run build` passes

Append to docs/04-decisions-and-accomplishments.md under "Next.js + OpenAI usage (Agent 4)".
```

---

## Agent 5 — OpenAPI spec & Swagger UI

**Estimated scope:** ~3–5 files  
**Depends on:** Agent 3 (ingest route), Agent 4 optional for context  
**Blocks:** nothing

### Prompt

```
You are implementing Agent 5 (final) of the OpenAI token usage feature for the Company Costing App.

Read:
- docs/08-nextjs-openai-usage-plan.md (sections 5, 10 — Swagger checklist)
- docs/04-decisions-and-accomplishments.md (Agents 1–4)
- app/api/openai-usage/route.ts (actual implementation)
- lib/validations/openai-usage.ts (Zod schema)

## Goal
Document POST /api/openai-usage with OpenAPI 3.0 and serve Swagger UI at /api-docs for other developers.

## Implement

### 1. OpenAPI spec
Create one of (pick simplest that works):
- public/openapi.yaml — hand-written spec matching actual route behavior, OR
- lib/openapi.ts — exported spec object

Must document:
- POST /api/openai-usage
- Request body schema (all fields from plan §5)
- Responses 201, 400, 409, 500 with example bodies
- Optional header X-Ingest-Secret if INGEST_SECRET documented
- Tag: "OpenAI Usage"
- Info title: "Company Costing App — Ingest API"
- servers: relative / or { url: "/" }

Keep in sync with Zod schema field names (camelCase in JSON).

### 2. Swagger UI page
- Add dependency: swagger-ui-react (and @types if needed)
- app/api-docs/page.tsx — "use client" dynamic import swagger-ui-react with ssr: false
- Load spec from /openapi.yaml or inline import
- Basic layout matching app dark/light theme if easy; default Swagger theme ok

Serve spec:
- public/openapi.yaml copied at build time, OR
- app/api/openapi/route.ts returns JSON spec

### 3. README note
Add short section to docs/08-nextjs-openai-usage-plan.md or docs/README.md:
- Link to /api-docs
- One-line: how other devs find the ingest contract

## Files you may create/edit
- public/openapi.yaml (or lib/openapi.ts + route)
- app/api-docs/page.tsx
- package.json (swagger-ui-react)
- docs/README.md (index row for new docs if missing)

## Do NOT
- Change ingest logic unless spec was wrong vs implementation (fix spec to match code)
- Add new API endpoints

## Acceptance criteria
- [ ] /api-docs loads Swagger UI without SSR errors
- [ ] POST /api/openai-usage shown with request body fields
- [ ] Example request in spec is copy-pasteable
- [ ] `npm run build` passes

Append to docs/04-decisions-and-accomplishments.md under "Next.js + OpenAI usage (Agent 5)".

When done, note in summary that all items in docs/08 section 10 checklists should be verifiable.
```

---

## Optional: Agent 2b — Remaining components (only if Agent 2 split)

Use only if Agent 2 could not finish in one run.

### Prompt

```
You are implementing Agent 2b (continuation) of the Next.js migration.

Read docs/04-decisions-and-accomplishments.md Agent 2 section for what was already migrated.

## Goal
Complete migration of any remaining src/components/* not yet ported. Achieve full feature parity per docs/08 section 10 "After Agent 2" checklist.

Do not add AI Usage or API routes. Match Agent 2 conventions (TypeScript, "use client", @/ imports).

Report which files you migrated. Append to docs/04-decisions-and-accomplishments.md under "Next.js + OpenAI usage (Agent 2b)".
```

---

## Optional: smoke-test agent (after Agent 5)

```
Read docs/08-nextjs-openai-usage-plan.md section 10 (full manual test checklist).
Walk through each checkbox against the codebase and note how to verify.
Fix only regressions; do not add features.
Report pass/fail list. Update docs/04-decisions-and-accomplishments.md with test results.
Do not commit unless asked.
```

---

## Agent sizing rationale

| Agent | Why this size |
|-------|----------------|
| **1** | Tooling only — unblocks everything; small, verifiable with `npm run build` |
| **2** | Largest agent — full UI port, but one coherent goal (parity); split to 2b only if needed |
| **3** | Backend slice isolated — schema + one route + pricing; no UI context needed |
| **4** | Read path + one new page — RPC SQL + Dashboard-style UI belong together |
| **5** | Docs only — small, can run in parallel after 3 if careful, but run last to match final API |

**Context budget tips for the human operator:**
- Give each agent the repo + these docs; avoid attaching unrelated chat history.
- After Agent 1, commit or stash so Agent 2 has a clean base.
- Seed test data between Agent 3 and 4 with 3–5 curl POSTs using different `appId`s.
