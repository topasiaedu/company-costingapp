# Next.js Migration + OpenAI Token Usage — Feature Plan

**Last updated:** 10 July 2026  
**Status:** Planned — not yet implemented  
**Current stack:** React 18 + Vite 5 + JSX (see [01-project-overview.md](./01-project-overview.md))  
**Target stack:** Next.js (App Router) + TypeScript + Tailwind + Supabase  
**Implementation prompts:** [09-nextjs-openai-usage-agent-prompts.md](./09-nextjs-openai-usage-agent-prompts.md)

Related docs: [01-project-overview.md](./01-project-overview.md) · [04-decisions-and-accomplishments.md](./04-decisions-and-accomplishments.md)

---

## 1. Why we are doing this

### Primary goal

We run **multiple internal apps** that call OpenAI (e.g. `cae-gpt`, `beacon-social-media`). Today, OpenAI API spend is tracked manually when billing arrives (credit-reload / paste from OpenAI dashboard — see `r_openai_api` in [04-decisions-and-accomplishments.md](./04-decisions-and-accomplishments.md)).

We want a **new page in this app** that shows **estimated token usage and cost per app** as events arrive — before the invoice lands.

### Secondary goal (enabler)

That requires a **server-side API endpoint** so other apps can POST usage after each OpenAI call. Vite SPA has no backend; **Next.js** adds API routes while keeping the existing costing UI.

### What this is NOT

| Not in scope (v1) | Notes |
|-------------------|--------|
| Replacing OpenAI billing | Usage page = **estimate**; expenses tab = **actuals paid** |
| Per-app API keys | Devs pick any `appId` string; keys added later if needed |
| High-volume pipelines | &lt;1k events/day — raw rows + RPC aggregation is enough |
| Fixing typo app IDs | Wrong `appId` → dev cleans data manually |
| SSR / Server Components for dashboard | Existing UI stays client-heavy (`"use client"`) |

---

## 2. Architecture (target)

```
┌──────────────────────────────────────────────────────────────────────────┐
│  Next.js on Vercel                                                        │
│  ┌─────────────────────┐  ┌──────────────────────┐  ┌──────────────────┐ │
│  │ App (client)        │  │ POST /api/openai-usage│  │ GET /api-docs    │ │
│  │ Existing tabs +     │  │ Zod validate, price   │  │ Swagger UI       │ │
│  │ new "AI Usage" tab  │  │ calc, service-role    │  │ (OpenAPI spec)   │ │
│  └──────────┬──────────┘  │ insert                │  └──────────────────┘ │
│             │             └───────────┬───────────┘                         │
│             │                         │                                     │
│             ▼                         ▼                                     │
│  ┌─────────────────────────────────────────────────────────────────────┐  │
│  │ Supabase (Postgres + Auth)                                           │  │
│  │ • Existing tables: expenses, recurring, settings, …                │  │
│  │ • New: openai_usage_events                                           │  │
│  │ • New RPC: get_openai_usage_summary(date_from, date_to)              │  │
│  └─────────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────────┘
          ▲
          │ POST usage (no API key v1)
┌─────────┴─────────┐
│ cae-gpt           │
│ beacon-social-…   │
│ (other apps)      │
└───────────────────┘
```

**Write path:** External app → Next API route → Supabase (service role) → `openai_usage_events`  
**Read path:** Logged-in user → AI Usage page → Supabase RPC (or query) → charts

---

## 3. Design decisions (confirmed)

| Decision | Choice | Notes |
|----------|--------|-------|
| Framework | Next.js App Router + **TypeScript** | Replace Vite when migration agents complete |
| App identity | Developer-defined `appId` string | e.g. `cae-gpt`, `beacon-social-media` — no registry v1 |
| API auth | **None v1** | Optional shared secret or per-app keys in a later phase |
| Volume | &lt;1k events/day | Store raw events; no rollup/cron tables |
| Aggregation | **Supabase RPC** + client-side drill-down | Summary via RPC; recent rows / detail tables in UI |
| Cost estimate | **Server-computed** on ingest | Apps send tokens only; never trust client-sent `$` |
| Idempotency | Optional `requestId` | Duplicate `requestId` → ignore (409 or silent skip) |
| Tenant model | **Single operator** (same as today) | All usage events visible to logged-in user |
| Existing features | **Feature parity** after migration | Dashboard, Expenses, P&L, Subscriptions, Settings unchanged |
| Nav | Add **AI Usage** tab | Same sidebar pattern as existing `TABS` in `App.jsx` |
| Swagger | Hand-written or generated OpenAPI + Swagger UI | Route: `/api-docs` (protected or internal) |

### App ID convention (guideline, not enforced)

- Use lowercase kebab-case: `cae-gpt`, `beacon-social-media`
- Stable over time — renaming creates a “new” app in charts
- Typos are a people problem, not a platform problem

### Future API key expansion (design now, build later)

```
POST /api/openai-usage
Headers: X-Api-Key: optional (future)
Body:    appId: required always
```

Modes later: no key (current) → soft key (validate if present) → strict key (required).

---

## 4. Data model — what we track

**Agents implement the table; this section defines fields and stats only.**

### 4.1 Per event (ingest payload)

| Field | Required | Source | Purpose |
|-------|----------|--------|---------|
| `appId` | Yes | Calling app | Stable key (`cae-gpt`) |
| `appName` | No | Calling app | Display label in UI |
| `requestId` | No | Calling app | Dedup on retry |
| `model` | Yes | OpenAI response | Cost calculation |
| `promptTokens` | Yes | `usage.prompt_tokens` | Input volume |
| `completionTokens` | Yes | `usage.completion_tokens` | Output volume |
| `totalTokens` | Yes | `usage.total_tokens` | Convenience / validation |
| `feature` | No | Calling app | e.g. `chat`, `embed`, `summarize` |
| `occurredAt` | Yes | Calling app | When the OpenAI call happened (ISO 8601) |

**Server-set on ingest (not in request body):**

| Field | Purpose |
|-------|---------|
| `estimatedCostUsd` | `promptTokens` × input price + `completionTokens` × output price |
| `priceSnapshot` | Model price table version / date used |
| `ingestedAt` | When row was received |

**Deferred (not v1):** `cachedTokens`, `latencyMs`, `status`, `metadata` JSON

### 4.2 Model pricing (server-side config)

Maintain a versioned price map in code (e.g. `lib/openai-pricing.ts`), updated when OpenAI changes rates:

- Per model: `inputPer1M`, `outputPer1M` (USD)
- Unknown model → store event with `estimatedCostUsd: 0` and flag / log warning

### 4.3 Dashboard aggregates (RPC + UI)

**Org-wide (selected date range):**

| Stat | UI |
|------|-----|
| Total tokens | Summary card |
| Total estimated cost (USD + MYR via existing 4.03 rate) | Summary card |
| Request count | Summary card |
| Avg tokens per request | Summary card |
| Daily trend (tokens or cost) | Line chart |
| Breakdown by `appId` | Bar chart + rank table |
| Breakdown by `model` | Pie or bar chart |
| Period vs previous period (% change) | Stat card trend badge |

**Per app (drill-down or filter):**

| Stat | UI |
|------|-----|
| Tokens + estimated cost | Table row / detail header |
| % of org total | Column or subtext |
| By model | Small breakdown |
| By `feature` | Table (top features) |
| Daily trend for one app | Optional line chart |

**Reconciliation (phase 2, not v1):** Compare estimated period total vs `r_openai_api` expense row.

---

## 5. API contract (v1)

### `POST /api/openai-usage`

**Auth:** None v1 (document risk; optional `INGEST_SECRET` header can be added without breaking callers).

**Request body (JSON):**

```json
{
  "appId": "cae-gpt",
  "appName": "CAE GPT Assistant",
  "requestId": "550e8400-e29b-41d4-a716-446655440000",
  "model": "gpt-4o-mini",
  "promptTokens": 1200,
  "completionTokens": 340,
  "totalTokens": 1540,
  "feature": "summarize-report",
  "occurredAt": "2026-07-10T09:15:00Z"
}
```

**Responses:**

| Code | Meaning |
|------|---------|
| `201` | Created; body includes `id`, `estimatedCostUsd` |
| `400` | Validation error (Zod) |
| `409` | Duplicate `requestId` (if dedup enabled) |
| `500` | Server / DB error |

### Example caller snippet (for other devs)

```typescript
// After OpenAI chat completion:
const usage = response.usage;
await fetch("https://your-app.vercel.app/api/openai-usage", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    appId: "cae-gpt",
    appName: "CAE GPT",
    requestId: crypto.randomUUID(),
    model: response.model,
    promptTokens: usage?.prompt_tokens ?? 0,
    completionTokens: usage?.completion_tokens ?? 0,
    totalTokens: usage?.total_tokens ?? 0,
    feature: "chat",
    occurredAt: new Date().toISOString(),
  }),
});
```

Fire-and-forget is acceptable; retries should reuse the same `requestId`.

---

## 6. UI — AI Usage page

**File (target):** `src/components/OpenAiUsage.tsx` (or `app/(dashboard)/ai-usage/page.tsx` wrapping a component)

**Match existing patterns from `Dashboard.jsx`:**

- Date range picker + quick ranges (This month, Last 3 mo, …)
- `StatCard` row for totals
- Recharts bar (by app), line (daily trend), pie (by model)
- Display currency conversion using existing `currencySettings` / MYR rate
- Empty state when no events yet

**Nav:** Add to `TABS` array in root app shell:

```typescript
{ id: "ai-usage", label: "AI Usage", icon: Cpu } // or Bot, Sparkles
```

---

## 7. Environment variables

| Variable | Where | Purpose |
|----------|-------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Client + server | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Client + server | Browser auth + RLS reads |
| `SUPABASE_SERVICE_ROLE_KEY` | **Server only** | Ingest API writes (never `NEXT_PUBLIC_`) |
| `INGEST_SECRET` | Server only (optional v1) | If set, require `X-Ingest-Secret` header |

Update `.env.example` and Vercel project settings. Remove `VITE_*` vars after migration.

---

## 8. Implementation phases (agent map)

Run agents **in order** — see [09-nextjs-openai-usage-agent-prompts.md](./09-nextjs-openai-usage-agent-prompts.md).

| Agent | Scope | ~Files |
|-------|--------|--------|
| **1** | Next.js scaffold, TypeScript, Tailwind, Supabase clients, folder layout | Config + lib |
| **2** | Migrate entire existing Vite app to Next (feature parity) | All current `src/` |
| **3** | `openai_usage_events` schema + ingest API + pricing lib | Migration SQL + 1 route |
| **4** | Supabase RPC summaries + AI Usage page + nav tab | RPC + 1 component + shell |
| **5** | OpenAPI spec + Swagger UI at `/api-docs` | Spec + docs page |

If Agent 2 exceeds context, split into **2a** (data layer + auth + App shell) and **2b** (feature components) — instructions in prompts doc.

---

## 9. Migration drawbacks to expect

| Area | Risk | Mitigation |
|------|------|------------|
| Monolithic `App.jsx` | Large client component | `"use client"` on shell; split later |
| Env rename | `VITE_*` → `NEXT_PUBLIC_*` | Update `.env.example`, Vercel |
| Password reset | `window.location.hash` flow | Dedicated `/auth/reset` route |
| Recharts | SSR hydration | Dynamic import or client-only wrapper |
| Unsecured ingest | Anyone can POST if URL is public | Optional `INGEST_SECRET`; rate limit later |
| Two write paths | UI → Supabase direct; apps → API | OK for v1; same DB |
| No live refresh | New events invisible until reload | Manual refresh v1; Realtime later |

---

## 10. Manual test checklist

### After Agent 2 (migration parity)

- [ ] Login / logout works
- [ ] All five existing tabs render and save data
- [ ] Password reset flow works
- [ ] Import CSV still works
- [ ] Theme toggle persists
- [ ] `npm run build` succeeds
- [ ] Vercel deploy env vars updated

### After Agent 3 (ingest)

- [ ] `POST /api/openai-usage` with valid body returns `201`
- [ ] Invalid body returns `400`
- [ ] Duplicate `requestId` handled
- [ ] `estimatedCostUsd` matches pricing table for known model
- [ ] Row appears in Supabase

### After Agent 4 (AI Usage page)

- [ ] AI Usage tab visible in sidebar
- [ ] Summary cards match RPC for a known date range
- [ ] By-app chart shows distinct `appId`s
- [ ] Date range filter updates charts
- [ ] MYR conversion uses settings rate
- [ ] Empty state when no data

### After Agent 5 (Swagger)

- [ ] `/api-docs` loads Swagger UI
- [ ] `POST /api/openai-usage` documented with request schema
- [ ] Try-it-out works against local/staging

---

## 11. Out of scope (explicit)

- Per-app API key registry and admin UI
- Daily rollup / materialized views / cron jobs
- Supabase Realtime subscriptions
- Cached token tracking
- Automatic reconciliation with OpenAI invoice
- Changing P&L, Dashboard, or Subscriptions logic (unless broken by migration)
- Render deployment (stay on Vercel)

---

## 12. Success criteria

1. Existing costing app works on Next.js + TypeScript with no feature regression.
2. Any internal app can POST token usage with a self-chosen `appId`.
3. AI Usage page shows estimated spend and token volume per app and over time.
4. Swagger documents the ingest API for other developers.
5. Total effort fits five focused agent runs without context overflow.
