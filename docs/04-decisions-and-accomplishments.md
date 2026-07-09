# Decisions & Accomplishments — Source of Truth

**Last updated:** 10 July 2026  
**Supabase project:** `brmhzbjhpfqmmhatffmi`  
**Purpose:** Record what was built, what was decided, and how data should be interpreted. Use this doc when onboarding, auditing P&L, or continuing development.

Related docs: [01-project-overview.md](./01-project-overview.md) · [03-supabase-mcp.md](./03-supabase-mcp.md) · [QA.md](./QA.md)

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

*This document supersedes informal chat decisions for the topics above. Update it when subscription amounts, domain inventory, or business rules change.*
